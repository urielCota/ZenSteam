// ZenSteam · Ubicación por dirección con Google Geocoding o Mapbox (se elige en config.js).
// Las claves de ambos servicios están pensadas para usarse en el navegador, siempre que se restrinjan al dominio del sitio.
// ZSGeo.geocode(direccion, { bias: {lat, lng}, signal }) → { lat, lng, confianza: "alta"|"media"|"baja", lugar } o null.
(() => {
  const cfg = window.ZS_CONFIG?.geocoder || {};
  const provider = String(cfg.provider || "").toLowerCase();
  const key = String(cfg.key || "");
  const enabled = !!key && !/TU_CLAVE/.test(key) && (provider === "google" || provider === "mapbox");
  if (!enabled) console.warn("ZenSteam: ubicación automática desactivada.", { provider: provider || "(vacío)", clave: !key ? "vacía" : /TU_CLAVE/.test(key) ? "de ejemplo" : "ok", configCargado: !!window.ZS_CONFIG });
  const err = (code, message, cause) => Object.assign(new Error(message || code), { code, cause });
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ---------- Google (Maps JavaScript API + Geocoding API) ----------
  let gReady = null;
  function loadGoogle() {
    return gReady ||= new Promise((ok, bad) => {
      window.__zsGmReady = ok;
      window.gm_authFailure = () => { gReady = null; document.querySelector('script[src*="maps.googleapis.com"]')?.remove(); bad(err("not_granted", "Google rechazó la clave (revisa que el sitio esté en «Websites», que Maps JavaScript API esté habilitada y que la facturación esté activa)")); };
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&language=es&region=MX&callback=__zsGmReady`;
      s.async = true;
      s.onerror = () => { gReady = null; bad(err("unavailable", "No se pudo cargar Google Maps")); };
      document.head.appendChild(s);
    }).then(() => google.maps.importLibrary("geocoding")).then(lib => new lib.Geocoder());
  }
  const G_CONF = { ROOFTOP: "alta", RANGE_INTERPOLATED: "media", GEOMETRIC_CENTER: "baja", APPROXIMATE: "baja" };
  async function google_(address, { bias } = {}, retry = true) {
    const geocoder = await loadGoogle();
    const req = { address, region: "mx", componentRestrictions: { country: "MX" } };
    if (bias) req.bounds = { south: bias.lat - 0.6, north: bias.lat + 0.6, west: bias.lng - 0.6, east: bias.lng + 0.6 };
    try {
      const { results } = await geocoder.geocode(req);
      const r = results?.[0]; if (!r) return null;
      const loc = r.geometry.location;
      return { lat: loc.lat(), lng: loc.lng(), confianza: G_CONF[r.geometry.location_type] || "media", lugar: r.formatted_address || "" };
    } catch (e) {
      const c = e?.code || String(e?.message || "").match(/[A-Z_]{6,}/)?.[0];
      if (c === "ZERO_RESULTS") return null;
      if (c === "OVER_QUERY_LIMIT") { if (retry) { await sleep(1500); return google_(address, { bias }, false); } throw err("rate_limited", "Límite de consultas de Google", e); }
      if (c === "REQUEST_DENIED") { console.warn("ZenSteam · Google Geocoding:", e?.message || e); throw err("not_granted", "Google indica que la Geocoding API no está habilitada para esta clave, o la clave no la permite en «API restrictions»", e); }
      throw err("unavailable", "Google no respondió", e);
    }
  }

  // ---------- Mapbox (Geocoding API v6) ----------
  const M_CONF = { exact: "alta", high: "alta", medium: "media", low: "baja" };
  async function mapbox(address, { bias, signal } = {}) {
    const q = new URLSearchParams({ q: address, country: "mx", language: "es", limit: "1", access_token: key });
    if (bias) q.set("proximity", `${bias.lng},${bias.lat}`);
    let r;
    try { r = await fetch("https://api.mapbox.com/search/geocode/v6/forward?" + q, { signal }); }
    catch (e) { if (e?.name === "AbortError") throw err("cancelled"); throw err("unavailable", "Mapbox no respondió", e); }
    if (r.status === 401 || r.status === 403) throw err("not_granted", "Mapbox rechazó el token");
    if (r.status === 429) throw err("rate_limited", "Límite de consultas de Mapbox");
    if (!r.ok) throw err("unavailable", "Mapbox respondió " + r.status);
    const f = (await r.json())?.features?.[0]; if (!f) return null;
    const [lng, lat] = f.geometry.coordinates;
    const p = f.properties || {};
    return { lat, lng, confianza: M_CONF[p.match_code?.confidence] || (p.feature_type === "address" ? "alta" : "media"), lugar: p.full_address || p.place_formatted || p.name || "" };
  }

  const GEO = {
    enabled,
    provider,
    nombre: provider === "google" ? "Google" : provider === "mapbox" ? "Mapbox" : "",
    async geocode(address, opts = {}) {
      if (!GEO.enabled) throw err("not_granted", "Ubicación automática no configurada");
      if (opts.signal?.aborted) throw err("cancelled");
      const text = String(address || "").trim(); if (!text) return null;
      const r = provider === "google" ? await google_(text, opts) : await mapbox(text, opts);
      if (opts.signal?.aborted) throw err("cancelled");
      return r && Number.isFinite(r.lat) && Number.isFinite(r.lng) ? r : null;
    }
  };
  window.ZSGeo = GEO;
})();
