// ZenSteam · Configuración del sitio.
// Todo lo de este archivo es PÚBLICO (cualquiera que abra el sitio lo puede ver), y está bien así:
//  - La "anon key" de Supabase está hecha para el navegador; los datos los protegen las reglas de acceso (esquema.sql).
//  - La clave de Google o el token de Mapbox deben estar RESTRINGIDOS a la dirección de tu sitio (ver LEEME.md).
// Nunca pongas aquí la "service_role key" de Supabase ni claves sin restricción.
window.ZS_CONFIG = {
  // Supabase → Project Settings → API
  supabaseUrl: "https://cidbiaougmygrlxvrmjk.supabase.co",
  supabaseAnonKey: "sb_publishable_wwYT7DKQ8xqjo-YrqTyqpg_hwrW-2Ko",

  // Ubicación automática por dirección: "google" o "mapbox" (deja key vacía para desactivarla).
  geocoder: {
    provider: "google",
    key: "AIzaSyDxrXag7NaqWNPxZ1DlgrMWI976IhfVzmQ"
  }
};
