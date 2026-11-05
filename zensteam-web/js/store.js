// ZenSteam · Capa de datos sobre Supabase.
// Expone la misma interfaz que usaba la app dentro de Claude (db.collection(...).onSnapshot, db.doc(...).set/update/delete),
// para que el resto de la app (asignación, importación, tablero) no cambie.
(() => {
  const C = window.ZS_CONFIG || {};
  if (!window.supabase?.createClient || !C.supabaseUrl || !C.supabaseAnonKey || /TU-PROYECTO|TU_CLAVE/.test(C.supabaseUrl + C.supabaseAnonKey)) return;

  const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  const TABLES = ["cars", "services", "incidents", "config"];
  const cache = new Map();      // tabla → Map(id → datos)
  const listeners = new Map();  // tabla → Set(fn)
  const loading = new Map();    // tabla → Promise de la carga inicial

  const err = (code, message, cause) => Object.assign(new Error(message || code), { code, cause });
  function mapErr(e) {
    if (["invalid_argument", "revoked", "unavailable", "resource_exhausted"].includes(e?.code) && e instanceof Error) return e; // ya traducido
    const msg = String(e?.message || e || "");
    if (e?.code === "42501" || /row-level security|permission denied/i.test(msg)) return err("invalid_argument", "Sin permiso para escribir", e);
    if (/JWT|expired|not authenticated/i.test(msg) || e?.status === 401) return err("revoked", "La sesión expiró", e);
    if (e instanceof TypeError || /fetch|network|Failed to fetch/i.test(msg)) return err("unavailable", "Sin conexión", e);
    if (e?.status === 429) return err("resource_exhausted", "Demasiadas solicitudes", e);
    return err(e?.code || "unknown", msg, e);
  }
  const check = ({ data, error }) => { if (error) throw mapErr(error); return data; };

  function emit(t) { for (const fn of listeners.get(t) || []) { try { fn(); } catch (e) { console.error(e); } } }

  async function loadAll(t) {
    const map = new Map();
    for (let from = 0; ; from += 1000) {
      const rows = check(await sb.from(t).select("id,data").order("id").range(from, from + 999));
      rows.forEach(r => map.set(r.id, r.data || {}));
      if (rows.length < 1000) break;
    }
    cache.set(t, map);
  }

  // Un solo canal de tiempo real para las cuatro tablas. Al reconectarse se recarga todo para no perder cambios.
  let channel = null, subscribedOnce = false;
  function ensureChannel() {
    if (channel) return;
    channel = sb.channel("zensteam-db");
    for (const t of TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table: t }, p => {
        const m = cache.get(t); if (!m) return;
        if (p.eventType === "DELETE") m.delete(p.old?.id);
        else if (p.new?.id) m.set(p.new.id, p.new.data || {});
        emit(t);
      });
    }
    channel.subscribe(status => {
      if (status !== "SUBSCRIBED") return;
      if (subscribedOnce) for (const t of cache.keys()) loadAll(t).then(() => emit(t)).catch(e => console.error(e));
      subscribedOnce = true;
    });
  }

  function watch(t, fn, onErr) {
    if (!TABLES.includes(t)) throw err("invalid_argument", "Colección desconocida: " + t);
    ensureChannel();
    if (!listeners.has(t)) listeners.set(t, new Set());
    listeners.get(t).add(fn);
    if (!loading.has(t)) loading.set(t, loadAll(t).then(() => emit(t)));
    else if (cache.has(t)) queueMicrotask(fn);
    loading.get(t).catch(e => { loading.delete(t); onErr?.(mapErr(e)); });
    return () => listeners.get(t)?.delete(fn);
  }

  // Cambio local inmediato (la pantalla responde al instante) y se revierte si el servidor lo rechaza.
  async function optimistic(t, id, next, remote) {
    const m = cache.get(t); const had = m?.has(id), prev = m?.get(id);
    if (m) { if (next === undefined) m.delete(id); else m.set(id, next); emit(t); }
    try { await remote(); }
    catch (e) { if (m) { if (had) m.set(id, prev); else m.delete(id); emit(t); } throw mapErr(e); }
  }

  const split = path => { const [t, id] = String(path).split("/"); if (!TABLES.includes(t) || !id) throw err("invalid_argument", "Ruta inválida: " + path); return [t, id]; };
  const clean = obj => JSON.parse(JSON.stringify(obj ?? {}));

  const db = {
    collection: name => ({
      onSnapshot(cb, onErr) {
        return watch(name, () => {
          const docs = [...(cache.get(name) || new Map())].map(([id, d]) => ({ id, data: () => d }));
          cb({ docs, size: docs.length, empty: !docs.length });
        }, onErr);
      }
    }),
    doc(path) {
      const [t, id] = split(path);
      return {
        id,
        async set(data) {
          const d = clean(data);
          await optimistic(t, id, d, async () => check(await sb.from(t).upsert({ id, data: d })));
        },
        async update(patch) {
          const p = clean(patch); const cur = cache.get(t)?.get(id);
          await optimistic(t, id, { ...(cur || {}), ...p }, async () => {
            const n = check(await sb.rpc("doc_update", { t, doc_id: id, patch: p }));
            if (!n) throw err("invalid_argument", "No se pudo actualizar (sin permiso o el registro ya no existe)");
          });
        },
        async delete() {
          await optimistic(t, id, undefined, async () => {
            const rows = check(await sb.from(t).delete().eq("id", id).select("id"));
            if (!rows.length) {
              // Sin filas borradas: o ya no existía, o la regla de acceso lo impidió. Se confirma releyendo.
              const still = check(await sb.from(t).select("id").eq("id", id));
              if (still.length) throw err("invalid_argument", "Sin permiso para eliminar");
            }
          });
        },
        onSnapshot(cb, onErr) {
          return watch(t, () => { const d = cache.get(t)?.get(id); cb({ id, exists: d !== undefined, data: () => d }); }, onErr);
        }
      };
    }
  };

  const auth = {
    async session() { return (await sb.auth.getSession()).data.session; },
    signIn: (email, password) => sb.auth.signInWithPassword({ email, password }),
    signOut: () => sb.auth.signOut(),
    resetPassword: email => sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }),
    setPassword: password => sb.auth.updateUser({ password }),
    onChange: fn => sb.auth.onAuthStateChange((event, session) => fn(event, session)),
    async profile(userId) { return check(await sb.from("profiles").select("role,nombre").eq("user_id", userId).maybeSingle()); }
  };

  window.ZSStore = { db, auth, client: sb };
})();
