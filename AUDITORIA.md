# Auditoría QA · ORNAT

Fecha: 27 de octubre de 2026 · Rama: `auditoria-qa` · Sitio: https://ornat-nuevo.vercel.app

## Contexto y método

- **Código fuente.** El sitio no estaba en GitHub. Con autorización del dueño, se descargó lo publicado en Vercel (HTML/CSS/JS estático, sin paso de build) y se versionó como base en `main`. Los cambios de esta auditoría están en `auditoria-qa`.
- **Funciones del servidor.** Las funciones `/api/*` (análisis de planos, IA de propiedades, equipo) **no se pueden descargar**: viven solo en el proyecto de Vercel. El repo las usa pero no las contiene. Ver TODO 1.
- **Servidor local.** `npm run dev` levanta un servidor que imita a Vercel: sirve `index.html` por carpeta, usa `404.html` como página de error, aplica la reescritura `/sitios/:id` y reenvía `/api/*` a producción.
- **Verificación estática.** `npm run check` hace las veces de «build + lint» en un sitio sin compilación: revisa la sintaxis de los JS, que los JSON sean válidos, los enlaces y recursos internos, y lo básico del HTML.
- **Pruebas con Playwright.** Se recorrió cada ruta en escritorio (1440×900) y en móvil (390×844). En cada una se capturaron errores y warnings de consola, `pageerror`, requests fallidos, desbordes y capturas de pantalla. Se probó cada flujo de cada módulo con datos válidos, inválidos y vacíos.

## Rutas encontradas

| Tipo | Rutas |
|---|---|
| Sitio público | `/`, `/software-ia/`, `/propiedades/`, `/legal/` (nueva), `404.html` (nueva) |
| Software | `/plano-a-render/`, `/cms/`, `/cms/sitio.html` (también `/sitios/:id`), `/control/`, `/cuenta/`, `/propiedades/subir/`, `/rrhh/`, `/capacitacion/` |
| Plantillas del CMS (30) | `/templates/{aurelia, bamo, concrete, edolus, elicyon, elyse, emarat, empire, faith, felixnieto, find, fitandyou, ifi, joshuas, lenval, loft, olivia, pamidor, range, raycorral, studiodsk, superlogica, tengile, tref, ux, velaa, whitedesert, whp, yodezeen, zorge}/` |
| Componentes compartidos | Mapa interactivo (`/mapa-pdc/`, montado en `/`, `/propiedades/` y `/propiedades/subir/`), widget de voz, barra de sesión, formularios (`/shared/`) |

## Hallazgos y correcciones

Severidad: **crítico** (rompe un flujo o pierde datos) · **alto** (falla visible o riesgo serio) · **medio** (funciona mal o confunde) · **bajo** (detalle).

### Problemas reportados por el dueño

| Ruta | Problema | Severidad | Resultado |
|---|---|---|---|
| Menú (todas las páginas) | «05 Software IA» parecía no tener enlace | — | **No era bug.** Es un botón que despliega un submenú con 9 enlaces. Probado: abre, cierra, Escape y los 9 destinos responden 200, en escritorio y móvil. |
| Footer de `/` y `/software-ia/` | Redes sociales sin URL | medio | Siguen como texto, sin enlaces muertos, con TODO en el HTML. **Faltan las URL reales** (TODO 2). |
| Footer | «Aviso de Privacidad», «Términos legales» y «Cookies» no eran enlaces | alto | Ahora enlazan a la nueva página `/legal/` (`#privacidad`, `#terminos`, `#cookies`), con el diseño del sitio. El texto es preliminar (TODO 3). |
| Footer | «ORNAT.COM.MX» no es enlace | bajo | El dominio **no existe en DNS** (NXDOMAIN en Google y Cloudflare); enlazarlo crearía un enlace roto. Queda como texto con TODO (TODO 4). |

### Sitio público, SEO e infraestructura

| Ruta | Problema | Severidad | Corrección |
|---|---|---|---|
| Rutas inexistentes | 404 genérica de Vercel | medio | Nueva `404.html` con el diseño del sitio y enlaces útiles. |
| `/robots.txt`, `/sitemap.xml`, `/favicon.ico` | No existían (404) | medio | Creados. El sitemap incluye solo las páginas indexables; `robots.txt` excluye las herramientas internas. |
| 11 páginas principales | Faltaban canonical, Open Graph, `apple-touch-icon` y, en `/cms/` y `/control/`, la meta description | medio | Agregados por ruta. |
| `/sitios/:id` | La reescritura de producción no estaba en el repo: desplegar desde aquí rompía los sitios publicados con el CMS | alto | Nuevo `vercel.json` con esa reescritura y las mismas cabeceras de seguridad que producción. |
| `/` (proceso) | La numeración repetía «001» y «002» bajo «Diez pasos» | bajo | Se quitaron los rellenos repetidos; las filas animadas siguen cubriendo todo el ancho (medido). |
| `/` (servicios) | Verificar «Seis territorios, dieciocho servicios» | — | **Correcto:** 6 territorios, 3+3+3+4+2+3 = 18 servicios. «Ocho módulos» en Software IA también cuadra (7 de demo + asistente de voz). |
| Mapa en `/`, `/propiedades/`, `/propiedades/subir/` | «Cómo llegar» era un `<a>` sin `href` hasta elegir un lugar | bajo | Tiene destino desde el inicio. |
| `/cms/`, `/control/` | Campos de archivo sin etiqueta accesible | bajo | `aria-label` en los 5. |
| `/cms/`, `/cms/sitio.html` | Warning de consola por `sandbox` con `allow-scripts` + `allow-same-origin`, que además no aislaba nada | bajo | Se quitó el atributo ineficaz. |

### CMS · ORNAT Studio (`/cms/`, `/cms/sitio.html`)

| Problema | Severidad | Corrección |
|---|---|---|
| Bloques «Equipo» y «Logos de clientes» pedían 10 imágenes inexistentes (404) | alto | Se crearon SVG neutros de ejemplo en `cms/assets/`. |
| La imagen social de 18 plantillas daba 404 en el panel de Sitio/Entregar | medio | Se resuelve contra el sitio original de cada plantilla. |
| Abrir un texto dentro de un bloque abría otra fila o ninguna (en `lenval` no se podía editar) | medio | La fila elegida se mantiene abierta. |
| `sitio.html` sin parámetros quedaba sin salida («Ir a ORNAT» oculto) | medio | Muestra el error con salida y título correcto. |
| Error en inglés al subir una imagen dañada | medio | Mensaje en español. |
| En la biblioteca, los fallos de una subida múltiple quedaban tapados | bajo | El resumen nombra los archivos fallidos. |
| Escape no cerraba el menú «Más»; nombre de archivo con doble espacio; error al escribir el nombre sin proyecto | bajo | Corregidos. |

### CRM (`/control/`)

| Problema | Severidad | Corrección |
|---|---|---|
| El invitado y los roles de solo lectura podían restaurar un respaldo (reemplazando todos los datos) o borrarlos | alto | Bloqueado con el mismo mensaje del resto de acciones; los botones que no pueden usar se ocultan. |
| La tabla de tareas en móvil hacía que toda la página se desplazara horizontalmente (854 px en 390) | alto | Corregido. |
| Desbordes y textos encimados: secuencias, filtros, pestañas de la ficha, tarjetas del tablero, indicadores, toast | medio/bajo | Corregidos. |
| Importar JSON/TXT inválido mostraba el error técnico en inglés | medio | Mensajes claros en español. |
| «Mis contactos» sin asignados ofrecía cargar ejemplos aunque hubiera contactos | medio | Estado vacío específico. |
| PWA: faltaban archivos en el precache (sin ellos no abría offline) | medio | Precache completo, caché v4. |
| Filtros negativos ignorados en silencio, casillas que no se guardaban quedaban marcadas, espacio faltante, campos de cotización sin etiqueta | bajo | Corregidos. |

### Cuenta, RRHH y Capacitación

| Ruta | Problema | Severidad | Corrección |
|---|---|---|---|
| `/cuenta/#equipo` | El Dueño único podía degradarse desde «Invitar» y dejar la cuenta sin Dueño | **crítico** | Se aplican las mismas reglas que en la tabla. |
| `/cuenta/` (y `shared/data.js`) | Al actualizar un usuario se perdían su fecha de alta y su nombre | medio | Se conservan. |
| `/rrhh/#/alta` | Con datos inválidos se creaba un acceso huérfano y el formulario desaparecía | alto | Se valida antes de crear el acceso. |
| `/rrhh/#/alta` | Un correo podía quedar en dos expedientes, o un Cliente en RRHH | medio | Rechazado con mensaje. |
| `/rrhh/` | Editar un registro de ejemplo le quitaba la marca y ya no se podía limpiar; ciclos de evaluación vacíos o con fechas invertidas; fechas de nacimiento futuras y de baja anteriores al ingreso | medio/bajo | Validados y corregidos. |
| `/cuenta/`, `/rrhh/`, `/capacitacion/` (móvil) | Nombres o títulos largos desbordaban la página; firmas de la constancia salían 36 px | bajo | Corte de palabra y firmas que pasan a otra línea (en `shared/workspace.css` y `session-bar.js`). |
| `/cuenta/` | Faltaban enlaces a Capacitación y RRHH; «Failed to fetch» en inglés | bajo | Agregados y traducido. |

### Propiedades y mapa

| Ruta | Problema | Severidad | Corrección |
|---|---|---|---|
| `/propiedades/subir/` | Un número fuera de rango en el paso 3 lanzaba un error sin capturar y el usuario quedaba atorado | **crítico** | Rangos validados con mensaje, foco y borde rojo. |
| `/propiedades/subir/` | Tras publicar, el borrador «revivía» al volver | alto | Ya no se guarda borrador de una propiedad publicada. |
| `/propiedades/` | «Limpiar filtros» no limpiaba si el foco estaba en el buscador (100 % reproducible) | alto | Corregido en `shared/catalog.js`. |
| Mapa | Los enlaces `#pdc-…` no abrían la ficha sin recargar | medio | Corregido. |
| `/propiedades/subir/` | Dos `<h1>`; banner de IA confuso con 401; campos sin límite; botones ilegibles en móvil | medio/bajo | Corregidos. |
| `/propiedades/` | El texto del estado vacío prometía un botón que no existe | bajo | Texto corregido. |
| Ficha técnica | El código de la propiedad se partía en móvil | bajo | Corregido. |

### Plano a render (`/plano-a-render/`)

| Problema | Severidad | Corrección |
|---|---|---|
| La detección de trazado de rayos creaba un contexto WebGL nuevo en cada clic (hasta 1.4 s) | alto | Se calcula una vez. |
| «Empezar de nuevo» no liberaba los contextos WebGL (el navegador limita cuántos hay vivos) y tronaba si había un render en curso | medio | Se libera todo y el cierre es seguro. |
| El último cambio se perdía si se cerraba la pestaña antes de 600 ms | medio | Se guarda al cerrar u ocultar la pestaña. |
| 63 warnings al exportar .glb por normales no unitarias | medio | Normales corregidas. |
| El editor no mostraba lo recién dibujado y dejaba «selecciones fantasma» | medio | Corregido. |
| Se podían pasar de las 12 láminas prometidas; PNG nulo sin manejar; repintado que borraba el editor; texto del select «Motor» cortado; ayuda del visor tapando el modelo en móvil | bajo | Corregidos. |
| Copy: «más de 30 estilos» | — | **Correcto:** hay 36. |

### Plantillas del CMS (30)

| Plantilla | Problema | Severidad | Corrección |
|---|---|---|---|
| ux | El bundle `main.js` publicado en ornat-nuevo estaba corrupto (SyntaxError); la plantilla dependía de otro deploy | crítico | Reemplazado por la versión válida y servido desde el repo, con su SVG faltante. |
| ux | ids duplicados (SVG y Webflow) y 11 `href="#"` | medio | Corregidos sin cambiar estilos (verificado en 76 instancias). Redes con TODO. |
| ux | Enlaces a `ornat.com.mx`, que no existe | medio | Apuntan al sitio publicado, con TODO. |
| whitedesert | La película daba 404 | alto | Ruta corregida. |
| fitandyou | Desborde horizontal en móvil que cortaba la hamburguesa | alto | Corregido. |
| lenval, loft | 17 enlaces `href="#"` | medio | Enlazados a su modal o sección real. |
| 19 plantillas | `og:image` relativa e inexistente | medio | URL absoluta verificada (200). |
| 13 plantillas | Warnings «preloaded but not used» | bajo | Precargas alineadas con `srcset`/`sizes`. |
| pamidor, whp, lenval | Descargas de imágenes abortadas a mitad | bajo | Orden de scripts corregido. |
| elicyon, felixnieto, raycorral | Sin favicon | bajo | Agregado. |

### Copia del sitio (base)

Al descargar lo publicado aparecieron recursos que solo se piden desde JavaScript (fotos del mapa, fotos de propiedades de ejemplo, planos de ejemplo, HDR del visor). Se recuperaron todos de producción y se verificaron, para que **un despliegue desde este repo funcione igual que hoy**.

## TODOs que necesitan información del dueño

1. **Código de las funciones `/api/*`.** No está en este repo y no se puede descargar. Si se despliega este repo en un proyecto de Vercel nuevo, el análisis de planos, la IA de propiedades y `/api/team` dejarían de funcionar. Hay que agregar ese código (carpeta `api/`) desde donde se desarrolló, o desplegar este repo **en el mismo proyecto** de Vercel solo si ahí siguen vivas las funciones.
2. **URLs de redes sociales**: Facebook, Instagram, X, TikTok, LinkedIn, Threads y Pinterest (footer de `/`, `/software-ia/`, `/legal/`, 404), y YouTube en la plantilla `ux`. Buscar `TODO(ORNAT)` en el código.
3. **Textos legales definitivos**: razón social, domicilio fiscal y correo del responsable para `/legal/`. La página actual es una versión preliminar escrita a partir de lo que el sitio realmente hace (formularios, almacenamiento local, proveedores externos), y así lo dice.
4. **Dominio `ornat.com.mx`**: no existe en DNS. Cuando esté activo, convertir «ORNAT.COM.MX» del footer en enlace, cambiar los enlaces de la plantilla `ux` y actualizar canonical, OG, `robots.txt` y `sitemap.xml` (hoy apuntan a `ornat-nuevo.vercel.app`).
5. **Llaves de servicios en Vercel**: la llave de Anthropic para «Leer con IA» (plano) y para la IA de propiedades; `GEMINI_API_KEY` o `HOMEDESIGNS_API_KEY` para el render en la nube; Supabase (URL y clave publicable en `shared/config.js`) para que los datos dejen de vivir solo en el navegador. Mientras tanto, todo funciona en modo demo y la interfaz lo dice.
6. **Decisiones de producto**:
   - ¿Puede el Dueño único aprobar sus propias vacaciones?
   - ¿El respaldo de `/cuenta/` debe incluir RRHH y Capacitación? Hoy no los incluye.
   - ¿El invitado del CRM debe ver datos de ejemplo?
   - ¿Quien entra a `/cms/` sin sesión debe poder editar en modo local?
   - Color oficial de la barra del navegador del CRM: `#000000` o `#1a1d19`.
7. **Imágenes de marca** para los bloques «Equipo» y «Logos de clientes» del CMS (hoy son genéricas).
8. **Plantilla `ux`**: destino del texto del hero «arquitectos, desarrolladores y brokers» y de «Dirección», si deben llevar a algún lado.

## Recomendaciones (fuera de alcance, no aplicadas)

- **Peso de imágenes**: algunas WebP de la portada pesan entre 650 y 825 KB (por ejemplo, `08-module-transformation-sketch-1402.webp`). Recomprimirlas bajaría el tiempo de carga. No se tocaron para no alterar la calidad visual sin aprobación.
- **`/plano-a-render/` está en `noindex`** aunque se promociona como «Nuevo» en el menú. Si se quiere posicionar, quitar el `noindex` y agregarlo al sitemap.
- **Hover en pantallas táctiles**: el efecto `padding-left` de los ítems del menú se queda «pegado» tras un toque. Envolverlo en `@media (hover:hover)`.
- **Menú en `/propiedades/` bajo 980 px**: el menú se oculta y no hay alternativa compacta.
- **Widget de voz en móvil**: el botón flotante tapa momentáneamente contenido y avisos al desplazarse. Considerar reducirlo o moverlo en pantallas pequeñas.
- **Path tracing**: `three-gpu-pathtracer` emite avisos de deprecación propios (sin impacto). Migrar a `WebGPUPathTracer` cuando sea estable.
- **Mensajes de detección en Plano a render**: las advertencias («Descarté 1 grupo…») se muestran en rojo como si fueran errores.
- **Contrato de `/api/plano/analizar`**: confirmar que el servidor siempre valida y devuelve `escala`, `recorte`, `muros`, `espacios` y `aberturas`.
- **Placeholder del buscador del mapa** se corta en móvil; considerar uno más corto.
- **Pruebas automatizadas en el repo**: las suites de Playwright de esta auditoría podrían versionarse y correr en CI. No se agregaron para no sumar dependencias.

## Evidencia de la prueba final

La batería final corrió **completa sobre el código final de la rama** después de la última corrección. Se repitió lo que tocaba cada cambio posterior.

### Verificación estática

`npm run check`: **1718 archivos revisados · 0 errores · 0 avisos**.

### Recorrido de rutas

Son 43 rutas en 2 viewports (86 cargas): las 10 páginas del sitio y del software, `/legal/`, 404, `/sitios/:id` y las 30 plantillas. En cada una se hizo scroll completo y se midió:

| Revisión | Resultado |
|---|---|
| Errores de JS (`pageerror`) | 0 |
| Desbordes horizontales | 0 |
| Recursos internos rotos | 0 |
| Imágenes rotas | 0 |
| Imágenes sin `alt` | 0 |
| Enlaces sin destino | 0 |
| Un solo `<h1>` por página | sí, en todas |
| Description, canonical, OG y favicon | completos en las 11 páginas principales |

### Suites funcionales

Resultado final: **0 fallas reales**.

| Módulo | Comprobaciones que pasan | Qué cubren |
|---|---|---|
| Sitio público (`/`, `/software-ia/`, `/legal/`, 404) | 96 + filas del proceso medidas | Menú, submenú Software IA y sus 9 destinos, 5 anclas, Escape, formulario (vacío, inválido y válido, con guardado), enlaces del footer, WhatsApp/tel, `/legal/#…` |
| CMS · ORNAT Studio | 833 | Galería, cambio de plantilla, proyectos, texto, imágenes, video, secuencias, colores, fuentes, secciones, marca, SEO, legales, entregar (JSON, HTML, importar), publicar, `sitio.html`, lienzo, los 20 bloques, comentarios, aprobación, versiones, biblioteca, idiomas, CRM, persistencia y acceso; barrido de 31 plantillas en el editor |
| CRM | 340 + barrido de 108 controles (escritorio) y 103 (móvil) | Contactos, tablero (incluido arrastrar y teclado), filtros, vistas, acciones masivas, ficha, tareas y .ics, cotizaciones y firma, propiedades, publicaciones, consumo, reportes, ajustes, importar y exportar, roles, solo lectura, PWA offline |
| Cuenta, RRHH y Capacitación | 270 + casos límite + recorrido limpio | Acceso, equipo y roles, auditoría, respaldo, conexiones, expedientes, vacaciones, evaluaciones, cursos, exámenes, constancias, permisos, XSS |
| Propiedades y mapa | 62 (catálogo) + 106 (subir) + 42 (IA simulada) + 273 (mapa en 3 rutas × 2 viewports) | Filtros, ficha, WhatsApp, formulario; subir fotos, pasos 1-5, publicar; IA con 401/500/sin red; mapa completo |
| Plano a render | 372 | Ejemplos, subir PNG/PDF y archivos inválidos, editor, calibración, 36 estilos, vistas, render (raster y trazado de rayos), exportar .glb/PNG/JSON, persistencia, API caída |
| Plantillas (30) | 60 recorridos limpios + 416 anclas | Consola, requests, imágenes, desbordes, enlaces y favicon por plantilla y viewport; clic en menús, tabs, acordeones, carruseles y modales |

### Qué queda en los registros y por qué no es un fallo

Cada caso se verificó a mano:

- **El 404 en consola de la página 404.** Es el código HTTP correcto de una página inexistente y el navegador siempre lo registra.
- **«GPU stall due to ReadPixels» y «KHR_parallel_shader_compile not supported».** Los emite el driver WebGL por software del entorno de prueba (SwiftShader), en `empire`, `ifi` y el iframe de OpenStreetMap. El código no llama a `readPixels`. No ocurre con una GPU real.
- **Avisos de deprecación de `three-gpu-pathtracer` y `three-mesh-bvh`.** Vienen de esas librerías (ya en su última versión) y solo aparecen al usar el trazado de rayos.
- **`net::ERR_ABORTED` de videos e imágenes.** Son descargas que el navegador cancela al cerrar la página o al cambiar el iframe de plantilla; los 7 videos responden 206 (streaming normal).
- **4 «FALLA» y 2 «FAIL» en los scripts.** Eran expectativas mal escritas; se revisó cada una:
  - «ICS de todas» (CRM): el botón está deshabilitado a propósito cuando no hay tareas. Con 2 tareas descarga un .ics con 2 eventos.
  - «grande.png» (plano a render): la app responde bien a un PNG en blanco: «No encontré muros» y ofrece dibujar a mano.
- **6 anclas «fuera» en el recorrido de plantillas.** También se revisaron una por una:
  - `concrete`: el enlace está en el portal de entrada, y desde ahí llega exacto a la sección.
  - `loft` móvil: cada capítulo ocupa toda la pantalla y el título va abajo por diseño.

Los scripts de prueba, registros y capturas quedaron en el entorno de la sesión de auditoría; no se versionaron para no sumar dependencias (ver Recomendaciones).
