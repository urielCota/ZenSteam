# ZenSteam · Sitio web

Versión pública de ZenSteam: el sitio se publica con **GitHub Pages**, los datos se guardan en **Supabase** y las direcciones se ubican con **Google Geocoding** o **Mapbox**.

```
zensteam-web/
├── index.html            la app (generada desde despacho-limpieza.html)
├── config.js             tus claves públicas: Supabase y Google/Mapbox
├── js/store.js           conexión con la base de datos
├── js/geocoder.js        ubicación por dirección
├── js/auth.js            inicio de sesión
├── assets/               logo
└── supabase/esquema.sql  tablas, permisos y tiempo real
```

Los datos actuales de la app están **fuera** de esta carpeta, en `../migracion-supabase/datos.sql`, porque contienen información de clientes. **No los subas a GitHub.**

---

## 1. Base de datos en Supabase

1. Crea una cuenta en <https://supabase.com> y un proyecto nuevo (plan Free). Elige la región más cercana (por ejemplo *East US*) y guarda la contraseña de la base de datos.
2. Ve a **SQL Editor → New query**, pega todo el contenido de `supabase/esquema.sql` y pulsa **Run**.
3. En la misma pantalla, abre otra consulta, pega el contenido de `../migracion-supabase/datos.sql` y pulsa **Run**. Esto carga los autos, los servicios y las reglas.
4. Ve a **Authentication → Sign In / Providers** y **desactiva** «Allow new users to sign up». Así, solo los usuarios que tú crees podrán entrar.
5. Ve a **Authentication → URL Configuration**:
   - **Site URL**: la dirección de tu sitio, por ejemplo `https://TU-USUARIO.github.io/zensteam/`.
   - **Redirect URLs**: agrega esa misma dirección. Sirve para el enlace de «Olvidé mi contraseña».
6. Ve a **Project Settings → API** y copia:
   - **Project URL** → `supabaseUrl` en `config.js`.
   - **anon public** key → `supabaseAnonKey` en `config.js`.
   - ⚠️ **Nunca** copies la `service_role` key. Esa clave salta todas las reglas de acceso.

### Usuarios y roles

Crea a cada persona en **Authentication → Users → Add user → Create new user**. Activa «Auto Confirm User».

Cada usuario nuevo empieza como **lectura**. Para cambiar el rol, ejecuta en el SQL Editor:

```sql
update public.profiles set role = 'admin', nombre = 'Nombre Apellido'
where user_id = (select id from auth.users where email = 'correo@empresa.com');
```

| Rol | Qué puede hacer |
|---|---|
| `admin` | Todo, incluida la pestaña **Monitoreo** |
| `operador` | Registrar y editar servicios, autos, reglas y siniestros, y recalcular rutas |
| `lectura` | Solo consultar |

---

## 2. Ubicación por dirección (elige una)

### Opción A · Google (recomendada en México)
1. En <https://console.cloud.google.com> crea un proyecto y activa la facturación. Google la pide aunque te quedes dentro de su uso gratuito mensual.
2. En **APIs & Services → Library**, habilita **Maps JavaScript API** y **Geocoding API**.
3. En **APIs & Services → Credentials → Create credentials → API key**, crea la clave y **restríngela**:
   - *Application restrictions* → **Websites** → `https://TU-USUARIO.github.io/*`.
   - *API restrictions* → solo **Maps JavaScript API** y **Geocoding API**.
4. En `config.js`, pon `provider: "google"` y `key: "tu clave"`.
5. Opcional: en **Billing → Budgets & alerts**, crea un presupuesto con alerta para evitar sorpresas.

### Opción B · Mapbox
1. Crea una cuenta en <https://account.mapbox.com>.
2. En **Tokens → Create a token**, crea un token **público** y, en *URL restrictions*, pon `https://TU-USUARIO.github.io`.
3. En `config.js`, pon `provider: "mapbox"` y `key: "pk...."`.

> Revisa los precios y términos vigentes de cada proveedor. Ambos tienen un uso gratuito mensual, y los dos limitan cuánto tiempo puedes **guardar** las coordenadas que entregan: Google permite guardarlas temporalmente, y Mapbox cobra aparte el almacenamiento permanente. En la app, las ubicaciones marcadas como «aproximadas» conviene confirmarlas con el enlace de Google Maps del cliente.

Si dejas `key` vacía, el sitio funciona igual: solo se oculta el botón «Ubicar dirección» y hay que pegar las coordenadas a mano.

---

## 3. Publicar con GitHub Pages

1. Crea un repositorio nuevo en GitHub, por ejemplo `zensteam`. En el plan gratuito, Pages requiere que el repositorio sea **público**. Esta carpeta no contiene datos ni claves secretas.
2. Sube **el contenido de esta carpeta** (`zensteam-web`) a la raíz del repositorio. Desde una terminal, dentro de la carpeta:
   ```bash
   git init
   git add .
   git commit -m "ZenSteam: primera versión web"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/zensteam.git
   git push -u origin main
   ```
3. En GitHub, ve a **Settings → Pages → Build and deployment → Deploy from a branch**, elige `main` y la carpeta `/ (root)`, y guarda.
4. En uno o dos minutos, el sitio queda en `https://TU-USUARIO.github.io/zensteam/`.

---

## 4. Revisión final

- [ ] Entra con un usuario **admin**: deben aparecer los autos, los servicios y la pestaña Monitoreo.
- [ ] Con un usuario **lectura**: debe salir el aviso de solo lectura y no debe dejar guardar nada.
- [ ] Abre el sitio en dos navegadores, cambia un servicio en uno y revisa que el otro se actualice solo.
- [ ] En Servicios, prueba «Ubicar dirección» con una dirección conocida.
- [ ] Prueba «Descargar todo en Excel».

---

## Actualizar la app más adelante

La app se sigue editando en `despacho-limpieza.html`. Para pasar los cambios al sitio:

```bash
python herramientas/generar-web.py
```

El comando se ejecuta desde la carpeta *Despacho de Limpieza*. Después, sube el nuevo `index.html` a GitHub con `git add`, `git commit` y `git push`.

## Capacidad

- **Supabase Free**: 500 MB de base de datos. Cada servicio ocupa alrededor de 1 KB, así que caben cientos de miles. Un proyecto gratuito se **pausa tras 7 días sin uso**; se reactiva desde el panel.
- **Supabase Pro** (unos 25 USD al mes): 8 GB incluidos, respaldos diarios y sin pausas. Es la opción recomendada cuando la operación dependa del sitio.
- Hoy la app carga todos los servicios al abrir. Con decenas de miles de registros conviene cargar solo las semanas recientes; ese cambio se hace en `js/store.js` sin tocar el resto.
- Para reportes, usa la vista `v_servicios` (fecha, cliente, monto, auto, estado) en **Table Editor** o en el SQL Editor.
