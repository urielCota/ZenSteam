# ZenSteam · Genera zensteam-web/index.html a partir de despacho-limpieza.html (la versión del artefacto de Claude).
# Uso:  python herramientas/generar-web.py
# Cambia solo la conexión: base de datos (Supabase), usuario, ubicación por dirección (Google/Mapbox) y descargas.
import re, sys, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
src = (root / "despacho-limpieza.html").read_text(encoding="utf-8")
out = root / "zensteam-web" / "index.html"
s = src

def rep(a, b, count=1):
    global s
    n = s.count(a)
    if n != count:
        sys.exit(f"ERROR: se esperaba {count} vez/veces y hay {n}: {a[:100]!r}")
    s = s.replace(a, b)

def rep_between(start, end, new, keep_end=True):
    """Reemplaza desde `start` (incluido) hasta `end` (excluido si keep_end)."""
    global s
    i = s.find(start); assert i >= 0, ("no se encontró", start[:80])
    j = s.find(end, i); assert j >= 0, ("no se encontró", end[:80])
    if not keep_end: j += len(end)
    s = s[:i] + new + s[j:]

# ---------- Documento completo (el artefacto lo envolvía al publicar) ----------
i = s.index('<header class="top">')
head, body = s[:i], s[i:]
s = ('<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n'
     '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
     '<link rel="icon" href="assets/zensteam-logo.png">\n'
     + head.rstrip() + "\n" + "@@AUTHCSS@@" + "\n</head>\n<body>\n" + body.rstrip() + "\n</body>\n</html>\n")

# ---------- Logo como archivo ----------
s, n = re.subn(r'src="data:image/png;base64,[^"]+"', 'src="assets/zensteam-logo.png"', s, count=1)
assert n == 1, "no se encontró el logo"

# ---------- Usuario y salir, en el encabezado; pantalla de acceso ----------
rep("""    </nav>
  </div>
</header>""", """    </nav>
    <div class="zs-who" id="zs-who" hidden><span id="zs-who-name"></span><button type="button" id="zs-logout">Salir</button></div>
  </div>
</header>

<div id="zs-login" class="zs-login" hidden>
  <div class="zs-login-card">
    <img src="assets/zensteam-logo.png" alt="" width="64" height="64">
    <h1>ZenSteam</h1>
    <div id="zs-login-msg" class="notice" hidden></div>
    <form id="zs-login-form" hidden>
      <label>Correo<input name="email" type="email" autocomplete="username" required></label>
      <label>Contraseña<input name="password" type="password" autocomplete="current-password" required></label>
      <button type="submit" class="primary">Entrar</button>
      <button type="button" class="link" id="zs-forgot">Olvidé mi contraseña</button>
    </form>
    <form id="zs-reset-form" hidden>
      <label>Correo<input name="email" type="email" autocomplete="username" required></label>
      <button type="submit" class="primary">Enviar enlace</button>
      <button type="button" class="link" id="zs-back">Volver</button>
    </form>
    <form id="zs-newpass-form" hidden>
      <label>Contraseña nueva<input name="password" type="password" autocomplete="new-password" required minlength="8"></label>
      <label>Repítela<input name="password2" type="password" autocomplete="new-password" required minlength="8"></label>
      <button type="submit" class="primary">Guardar contraseña</button>
    </form>
  </div>
</div>""")

AUTHCSS = """<style>
.zs-who { display: flex; align-items: center; gap: 8px; margin-left: auto; font-size: 13px; color: var(--muted); }
.zs-who button { font-size: 13px; }
.zs-login { position: fixed; inset: 0; z-index: 50; background: var(--bg); display: grid; place-items: center; padding: 16px; }
.zs-login[hidden] { display: none; }
.zs-login-card { width: 100%; max-width: 360px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r); padding: 24px; display: grid; gap: 12px; text-align: center; }
.zs-login-card h1 { margin: 0; font-family: var(--script); color: var(--brand); font-weight: 400; font-size: 34px; }
.zs-login-card img { margin: 0 auto; }
.zs-login-card form { display: grid; gap: 12px; text-align: left; }
.zs-login-card [hidden], .zs-who[hidden] { display: none !important; }
.zs-login-card label { display: grid; gap: 4px; font-size: 13px; color: var(--muted); }
.zs-login-card input { font: inherit; padding: 9px 10px; border: 1px solid var(--line); border-radius: var(--r); background: var(--surface); color: var(--fg); }
.zs-login-card button.link { background: none; border: 0; color: var(--accent); cursor: pointer; padding: 4px; font: inherit; font-size: 13px; }
</style>"""
rep("@@AUTHCSS@@", AUTHCSS)

# ---------- Librerías: Supabase, configuración, datos, ubicación, acceso ----------
rep("<script>\n", """<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>
<script src="config.js"></script>
<script src="js/store.js"></script>
<script src="js/geocoder.js"></script>
<script src="js/auth.js"></script>
<script>
""")

# ---------- Ubicación aproximada: "claude" (datos anteriores) o "geo" (Google/Mapbox) ----------
rep('const DEFAULTS = {', 'const isApprox = f => f === "claude" || f === "geo";\nconst DEFAULTS = {')
rep('s.coordFuente === "claude" ? `<span class="chip approx">', 'isApprox(s.coordFuente) ? `<span class="chip approx">')
rep('${s.coordFuente === "claude" ? " · aprox." : ""}', '${isApprox(s.coordFuente) ? " · aprox." : ""}')
rep('$("#svc-coords").dataset.fuente === "claude" ? " (aproximada, verifícala)"', 'isApprox($("#svc-coords").dataset.fuente) ? " (aproximada, verifícala)"')
rep('if (s.coordFuente === "claude") $("#svc-coords").dataset.fuente = "claude";', 'if (s.coordFuente && s.coordFuente !== "manual") $("#svc-coords").dataset.fuente = s.coordFuente;')
rep('"Ubicación aproximada": s.coordFuente === "claude" ? "Sí" : ""', '"Ubicación aproximada": isApprox(s.coordFuente) ? "Sí" : ""')

# ---------- Textos que mencionaban a Claude ----------
rep('<button type="button" id="btn-geo">Ubicar dirección con Claude</button>', '<button type="button" id="btn-geo">Ubicar dirección</button>')
rep('Se ubicará con Claude</span>', 'Se ubicará automáticamente</span>')
rep('se ubicarán con Claude a partir de la dirección (ubicación aproximada).', 'se ubicarán a partir de la dirección (verifica las aproximadas).')
rep('(la ubicación con Claude no está disponible en esta vista)', '(la ubicación automática no está configurada)')
rep('geoOk = await geoBatch(toGeo, (i, k) => { go.textContent = `Ubicando con Claude ${i + 1}–${i + k} de ${toGeo.length}…`; });',
    'geoOk = await geoBatch(toGeo, i => { go.textContent = `Ubicando ${i + 1} de ${toGeo.length}…`; });')
rep('// ubicada con Claude', '// ubicada automáticamente')
rep('ubicados con Claude (aproximados)', 'ubicados automáticamente')
rep('<b>Claude la calcula a partir de la dirección</b>', '<b>se calcula a partir de la dirección</b> (Google o Mapbox)')
rep('// Ubica con Claude, por lotes,', '// Ubica automáticamente,')
rep('// Ubicar dirección con Claude', '// Ubicar dirección (Google o Mapbox)')

# ---------- Ubicación por lotes en la importación ----------
rep_between("async function geoBatch(rows, onProgress) {", '\n$("#imp-go").onclick', """async function geoBatch(rows, onProgress) {
  let ok = 0; const bias = geoBias();
  for (let i = 0; i < rows.length && sampleFn; i++) {
    const r = rows[i]; onProgress(i);
    try {
      const g = await sampleFn.geocode(r.data.direccion, { bias });
      if (g && g.lat > 14 && g.lat < 33 && g.lng > -119 && g.lng < -86) { r.data.lat = Math.round(g.lat * 1e6) / 1e6; r.data.lng = Math.round(g.lng * 1e6) / 1e6; r.data.coordFuente = g.confianza === "alta" ? "geo-exacta" : "geo"; ok++; }
    } catch (e) {
      if (NOGEO.includes(e?.code)) { sampleFn = null; $("#btn-geo").hidden = true; toast("La ubicación automática fue rechazada: revisa la clave en config.js."); break; }
      if (e?.code === "rate_limited") { toast("Se alcanzó el límite de consultas de ubicación; las filas restantes quedan sin ubicación."); break; }
      // otro error: se sigue con la siguiente fila
    }
    await new Promise(res => setTimeout(res, 60));
  }
  return ok;
}
// Punto de referencia para ubicar direcciones: la base del primer auto con ubicación.
function geoBias() { const c = S.cars.find(c => hasLoc(c.base)); return c ? { lat: c.base.lat, lng: c.base.lng } : null; }""")

# ---------- Botón "Ubicar dirección" del formulario ----------
rep_between('$("#btn-geo").onclick = async () => {', 'btn.textContent = "Ubicar dirección con Claude"; }\n};', """$("#btn-geo").onclick = async () => {
  const dir = $("#svc-dir").value.trim(); if (!dir) { toast("Escribe primero la dirección."); $("#svc-dir").focus(); return; }
  if (!sampleFn) { toast("La ubicación automática no está configurada. Pega las coordenadas desde Google Maps."); return; }
  const btn = $("#btn-geo"); btn.disabled = true; btn.textContent = "Ubicando…"; geoCtl = new AbortController();
  try {
    const r = await sampleFn.geocode(dir, { bias: geoBias(), signal: geoCtl.signal });
    if (!r) { toast("No se pudo ubicar la dirección. Pide al cliente su ubicación de Google Maps."); return; }
    $("#svc-coords").value = `${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}`;
    $("#svc-coords").dataset.fuente = r.confianza === "alta" ? "geo-exacta" : "geo";
    coordsHint();
    toast(r.confianza === "alta" ? `Ubicada: ${r.lugar}` : `Ubicación aproximada (${r.confianza}): ${r.lugar}. Verifícala en Google Maps antes de guardar.`);
  } catch (e) {
    if (NOGEO.includes(e?.code)) { sampleFn = null; btn.hidden = true; toast("La ubicación automática fue rechazada: revisa la clave en config.js."); }
    else if (e?.code === "rate_limited") toast("Demasiadas consultas. Intenta en un momento.");
    else if (e?.code !== "cancelled") toast("No se pudo ubicar ahora. Intenta de nuevo o pega las coordenadas.");
  } finally { btn.disabled = false; btn.textContent = "Ubicar dirección"; }
};""", keep_end=False)

# ---------- Arranque: Supabase en lugar de window.claude ----------
rep_between("""(async () => {
  const note = $("#sysnote");""", "\n  const coll = (name, key, sortFn)", """(async () => {
  const note = $("#sysnote");
  const showNote = (text, bad) => { note.hidden = false; note.className = "notice" + (bad ? " bad" : ""); note.textContent = text; };
  sampleFn = window.ZSGeo?.enabled ? window.ZSGeo : null; if (!sampleFn) $("#btn-geo").hidden = true;
  downloadsFn = { save: async ({ filename, data }) => { const a = document.createElement("a"); a.href = URL.createObjectURL(data); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); } };
  $("#btn-export").hidden = false;
  if (!window.ZSStore) return showNote("Falta configurar la conexión con la base de datos: llena supabaseUrl y supabaseAnonKey en config.js.", true);
  const { profile } = await ZSAuth.ready();
  const role = profile?.role;
  if (!role) return showNote("Tu usuario todavía no tiene permisos. Pide a un administrador que te asigne un rol.", true);
  const db = ZSStore.db;
  S.db = db;
  S.isAdmin = role === "admin";
  $("#tab-monitoreo").hidden = !S.isAdmin; if (S.isAdmin && S.wantTab === "monitoreo") setTab("monitoreo");
  if (role === "lectura") { S.canWrite = false; showNote("Tienes acceso de solo lectura. Pide a un administrador acceso de operador para registrar servicios o reportar siniestros."); }
  const onErr = e => { if (e?.code !== "revoked") console.error(e); showNote(e?.code === "revoked" ? "Tu sesión expiró. Vuelve a entrar." : "Se perdió la conexión con los datos. Recarga la página.", true); };""")
# Desde "const coll = ..." se conserva el arranque original (suscripciones a cars/services/incidents/config).

assert "window.claude" not in s and "claude.use" not in s, "quedó una referencia a window.claude"
out.write_text(s, encoding="utf-8")
print("Generado:", out, f"({len(s):,} caracteres)")
