# Despliegue en Vercel y conexión con Supabase

Plan para publicar la rama `auditoria-qa` en el **mismo proyecto de Vercel** (`ornat-nuevo`) **sin perder nada**, y para conectar Supabase.

## Por qué hace falta un token de Vercel

El proyecto publicado incluye las funciones del servidor `/api/*` y archivos que no son públicos:
- las funciones de análisis de planos, IA de propiedades y equipo;
- `backend/supabase/schema-v2.sql` y la función `intake`;
- `package.json` y la configuración.

Nada de eso se puede descargar desde el sitio. Vercel sí guarda el código fuente de cada despliegue y lo entrega por su API con un token. Si se despliega este repo sin recuperarlo antes, **las funciones `/api/*` dejarían de existir**.

## Pasos que hace el dueño (una sola vez)

1. **Crear un token de Vercel:** https://vercel.com/account/settings/tokens → *Create Token*.
   - Alcance: la cuenta o el equipo dueño del proyecto `ornat-nuevo`.
   - Caducidad: 7 días. Se revoca al terminar.
2. **Guardarlo en el entorno de Claude Code, nunca en el chat:**
   - Ruta: menú del entorno en la barra de título de la sesión → *Edit*.
   - Dónde: *Network secrets* (o *API credentials*, o variable de entorno).
   - Nombre: `VERCEL_TOKEN`.
3. **Abrir una sesión nueva** con el repo `mesainteligentedemo-cell/ornat-nuevo` y pedir: «Sigue DESPLIEGUE.md».

## Pasos que hace Claude con el token (nada se borra)

1. **Respaldar:** identificar el despliegue de producción actual y anotar su URL única. Vercel conserva todos los despliegues; volver a este es un clic (*Instant Rollback*).
2. **Recuperar el código fuente completo** de ese despliegue (API de archivos de Vercel) en una carpeta aparte.
3. **Comparar** esa fuente con `main` (la copia descargada). Cualquier archivo que exista en producción y no en el repo se agrega: `api/`, `backend/`, `package.json`, `vercel.json` original, etc.
4. **Integrar** en `auditoria-qa`:
   - Las correcciones de la auditoría se conservan.
   - El `vercel.json` original se combina con el de la auditoría, conservando todas sus reglas.
   - `npm run check` debe dar 0 errores.
5. **Desplegar como *preview*** (no producción) en el mismo proyecto. Las variables de entorno del proyecto (llaves de IA) siguen ahí porque es el mismo proyecto.
   - Si las llaves solo están en *Production*, se copian también a *Preview* para poder probar.
6. **Correr la batería completa** contra la URL de preview: las 43 rutas en escritorio y móvil, más las suites de todos los módulos. Además se prueban las funciones `/api/*` (`/api/plano/estado`, `/api/team` con 401 sin sesión, etc.).
7. **Promover a producción** solo si todo queda limpio, y verificar `ornat-nuevo.vercel.app`.
8. **Opcional, recomendado:** conectar el repo de GitHub al proyecto (*Settings → Git*) para que cada merge a `main` despliegue solo. Esto se hace **después** de que el repo tenga `api/`; antes, borraría las funciones.
9. **Fusionar el PR** a `main`.
10. **Avisar al dueño** que revoque el token.

Si algo falla en cualquier paso, producción no se toca.

## Supabase: qué hace el dueño

Hoy todo funciona en **modo demo**: cada navegador guarda sus propios datos. Con Supabase hay login real, datos compartidos del equipo, permisos por rol (RLS) y formularios que llegan al CRM.

1. **Crear el proyecto:** https://supabase.com → *New project*.
   - Región: la más cercana a México disponible.
   - Guardar la contraseña de la base de datos en un gestor de contraseñas.
2. **Copiar los datos públicos:** *Project Settings → API*.
   - **Project URL** (`https://xxxx.supabase.co`).
   - **Publishable key** (`sb_publishable_…`, o la *anon key*).
   - Estos dos son **públicos por diseño** (los protege RLS) y se pueden pasar por el chat.
3. **La clave secreta** (`sb_secret_…` o *service_role*) **no se comparte en el chat**. Va en Vercel → proyecto `ornat-nuevo` → *Settings → Environment Variables*:
   - Nombre: `SUPABASE_SERVICE_ROLE_KEY`.
   - Entornos: *Production* y *Preview*.
4. **Opcional:** para que Claude despliegue la función `intake` y aplique el esquema sin pasos manuales, crear un *access token* en https://supabase.com/dashboard/account/tokens. Se guarda igual que el de Vercel, como `SUPABASE_ACCESS_TOKEN` en los *Network secrets* del entorno. Sin él, Claude entrega el SQL para pegarlo en *SQL Editor*.

## Supabase: qué hace Claude

1. Ejecutar `backend/supabase/schema-v2.sql`, recuperado del despliegue: tablas, RLS por rol, Realtime y buckets.
2. Llenar `supabaseUrl` y `supabaseAnonKey` en `shared/config.js`, y `organizationId` con la organización creada.
3. Desplegar la función `intake` de los formularios públicos (límite de 5 envíos por visitante cada 10 minutos).
4. Crear el usuario Dueño. El dueño entra en `/cuenta/` y migra los datos de demo si los quiere conservar.
5. Probar de punta a punta, en preview y luego en producción:
   - login;
   - roles;
   - un formulario de la portada que llegue al CRM;
   - datos compartidos entre dos navegadores;
   - Realtime.

## Redes sociales

Cuando el dueño pase las URL, se convierten en enlaces los `TODO(ORNAT)` del footer (`index.html`, `software-ia/index.html`, `legal/index.html`, `404.html`) y de la plantilla `templates/ux/`.
