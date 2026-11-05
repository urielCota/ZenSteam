// ZenSteam · Inicio de sesión (correo y contraseña de Supabase Auth).
// ZSAuth.ready() → Promise<{ user, profile }>: muestra la pantalla de acceso hasta que el usuario entra.
(() => {
  const $ = s => document.querySelector(s);
  const store = () => window.ZSStore;

  function view(mode, msg = "", bad = false) {
    const box = $("#zs-login");
    box.hidden = false;
    $("#zs-login-form").hidden = mode !== "login";
    $("#zs-reset-form").hidden = mode !== "reset";
    $("#zs-newpass-form").hidden = mode !== "newpass";
    const m = $("#zs-login-msg"); m.textContent = msg; m.hidden = !msg; m.className = "notice" + (bad ? " bad" : "");
    const first = box.querySelector(`form:not([hidden]) input`); if (first) setTimeout(() => first.focus(), 30);
  }
  const busy = (form, on, label) => { const b = form.querySelector("button[type=submit]"); b.disabled = on; if (label) b.textContent = label; };

  let recovering = false;
  function ready() {
    return new Promise(resolve => {
      const done = async session => {
        if (recovering) return;
        $("#zs-login").hidden = true;
        let profile = null;
        try { profile = await store().auth.profile(session.user.id); } catch (e) { console.error(e); }
        const who = $("#zs-who"); who.hidden = false;
        $("#zs-who-name").textContent = profile?.nombre || session.user.email;
        resolve({ user: session.user, profile });
      };

      $("#zs-login-form").onsubmit = async e => {
        e.preventDefault(); const f = e.target;
        busy(f, true, "Entrando…");
        const { data, error } = await store().auth.signIn(f.email.value.trim(), f.password.value);
        busy(f, false, "Entrar");
        if (error) return view("login", /invalid/i.test(error.message) ? "Correo o contraseña incorrectos." : "No se pudo iniciar sesión: " + error.message, true);
        done(data.session);
      };
      $("#zs-forgot").onclick = () => view("reset");
      $("#zs-back").onclick = () => view("login");
      $("#zs-reset-form").onsubmit = async e => {
        e.preventDefault(); const f = e.target;
        busy(f, true, "Enviando…");
        const { error } = await store().auth.resetPassword(f.email.value.trim());
        busy(f, false, "Enviar enlace");
        view("login", error ? "No se pudo enviar el correo: " + error.message : "Si el correo está registrado, te llegará un enlace para crear una contraseña nueva.", !!error);
      };
      $("#zs-newpass-form").onsubmit = async e => {
        e.preventDefault(); const f = e.target;
        if (f.password.value.length < 8) return view("newpass", "Usa al menos 8 caracteres.", true);
        if (f.password.value !== f.password2.value) return view("newpass", "Las contraseñas no coinciden.", true);
        busy(f, true, "Guardando…");
        const { error } = await store().auth.setPassword(f.password.value);
        busy(f, false, "Guardar contraseña");
        if (error) return view("newpass", "No se pudo guardar: " + error.message, true);
        recovering = false; history.replaceState(null, "", location.pathname);
        done((await store().auth.session()));
      };
      $("#zs-logout").onclick = async () => { await store().auth.signOut(); location.reload(); };

      store().auth.onChange((event, session) => {
        if (event === "PASSWORD_RECOVERY") { recovering = true; view("newpass", "Escribe tu contraseña nueva."); }
        else if (event === "SIGNED_OUT") location.reload();
      });
      // Si el enlace de recuperación trae el token, esperar al evento PASSWORD_RECOVERY.
      if (/type=recovery/.test(location.hash + location.search)) { recovering = true; view("newpass", "Escribe tu contraseña nueva."); return; }
      store().auth.session().then(s => s ? done(s) : view("login"));
    });
  }
  window.ZSAuth = { ready };
})();
