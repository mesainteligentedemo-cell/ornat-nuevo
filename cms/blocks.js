// Biblioteca de bloques insertables. Funciones puras: el bridge las usa para dibujar en la plantilla,
// el editor para el panel y las pruebas para validar. Todo lo que se dibuja sale de campos validados en core.js
// (lista blanca) y se escapa aquí; no existe HTML libre.
import { BLOCK_TYPES, BLOCK_ID_RE } from './core.js';

export const BLOCK_ORDER = ['hero', 'textimage', 'richtext', 'process', 'stats', 'team', 'logos', 'testimonials', 'pricing', 'cta', 'newsletter', 'contact', 'faq', 'gallery', 'beforeafter', 'video', 'map', 'property', 'catalog', 'spacer'];
export const BLOCK_GROUPS = [
  { id: 'content', label: 'Contenido', types: ['hero', 'textimage', 'richtext', 'process'] },
  { id: 'proof', label: 'Confianza', types: ['stats', 'team', 'logos', 'testimonials'] },
  { id: 'convert', label: 'Conversión', types: ['pricing', 'cta', 'newsletter', 'contact', 'faq'] },
  { id: 'media', label: 'Medios', types: ['gallery', 'beforeafter', 'video', 'map'] },
  { id: 'props', label: 'Propiedades', types: ['property', 'catalog'] },
  { id: 'util', label: 'Utilidades', types: ['spacer'] }
];
export const BLOCK_META = {
  textimage: { label: 'Texto + imagen', desc: 'Un mensaje junto a una foto, con botón.' },
  gallery: { label: 'Galería', desc: 'Rejilla de hasta 8 imágenes.' },
  testimonials: { label: 'Testimonios', desc: 'Opiniones de clientes en tarjetas.' },
  faq: { label: 'Preguntas frecuentes', desc: 'Acordeón accesible de preguntas y respuestas.' },
  cta: { label: 'Llamada a la acción', desc: 'Título, texto y un botón destacado.' },
  contact: { label: 'Formulario de contacto', desc: 'Recibe prospectos en el CRM de la demo.' },
  map: { label: 'Mapa', desc: 'Mapa de OpenStreetMap por coordenadas.' },
  video: { label: 'Video', desc: 'YouTube, Vimeo o un archivo MP4/WebM por https.' },
  catalog: { label: 'Catálogo de propiedades', desc: 'Tarjetas con tus propiedades, con filtros.' },
  spacer: { label: 'Separador', desc: 'Espacio en blanco entre secciones.' },
  hero: { label: 'Encabezado de sección', desc: 'Título grande con subtítulo y fondo de imagen opcional.' },
  richtext: { label: 'Texto largo', desc: 'Párrafos y subtítulos para contar una historia.' },
  process: { label: 'Proceso por pasos', desc: 'De 3 a 6 pasos numerados.' },
  stats: { label: 'Cifras', desc: 'Números grandes con animación al aparecer.' },
  team: { label: 'Equipo', desc: 'Fotos, nombre y cargo de tu gente.' },
  logos: { label: 'Logos de clientes', desc: 'Fila de logos de clientes o aliados.' },
  pricing: { label: 'Paquetes y precios', desc: 'De 2 a 4 tarjetas con lista y botón.' },
  beforeafter: { label: 'Antes y después', desc: 'Deslizador comparativo de dos imágenes.' },
  property: { label: 'Propiedad destacada', desc: 'Una propiedad de tu inventario con foto y precio.' },
  newsletter: { label: 'Suscripción', desc: 'Correo y botón; llega al CRM de la demo.' }
};
// Elementos de lista (preguntas, testimonios, integrantes…): tope y valor de un elemento nuevo.
export const itemLimit = type => { const spec = BLOCK_TYPES[type]?.fields?.items; return spec && spec[0] === 'list' ? spec[1] : 0; };
// Mínimo de elementos que conserva un bloque con lista (el resto de tipos admite quedarse con uno).
export const itemMin = type => { const spec = BLOCK_TYPES[type]?.fields?.items; return spec && spec[0] === 'list' ? (spec[3] ?? 0) : 0; };
export const ITEM_LABEL = { gallery: ['imagen', 'la última'], testimonials: ['testimonio', 'el último'], faq: ['pregunta', 'la última'], team: ['integrante', 'el último'], logos: ['logo', 'el último'], pricing: ['paquete', 'el último'], process: ['paso', 'el último'], stats: ['cifra', 'la última'], richtext: ['párrafo', 'el último'] };
export function newItem(type, count = 0, variant = '') {
  const n = count + 1;
  switch (type) {
    case 'gallery': return { src: DEMO_IMAGES[count % DEMO_IMAGES.length], alt: `Imagen ${n} de la galería` };
    case 'testimonials': return { quote: 'Nuevo testimonio de ejemplo.', name: 'Nombre del cliente', role: 'Cargo o ciudad' };
    case 'faq': return { q: 'Nueva pregunta', a: 'Escribe aquí la respuesta.' };
    case 'team': return { src: `/cms/assets/avatar-${(count % 4) + 1}.svg`, alt: `Foto de ejemplo ${n}`, name: 'Nombre y apellido', role: 'Cargo' };
    case 'logos': return { src: `/cms/assets/logo-${(count % 6) + 1}.svg`, alt: `Logo de ejemplo ${n}` };
    case 'pricing': return { name: 'Nuevo paquete', price: '$0', note: 'por proyecto', features: '✓ Primera ventaja\n✓ Segunda ventaja', ctaLabel: 'Quiero este', ctaHref: '#contacto', featured: false };
    case 'process': return { title: `Paso ${n}`, body: 'Explica en una o dos líneas qué pasa en este paso.' };
    case 'stats': return { value: '100+', label: 'Dato de ejemplo' };
    case 'richtext': return variant === 'h3' ? { kind: 'h3', text: 'Nuevo subtítulo' } : { kind: 'p', text: 'Escribe aquí un párrafo nuevo.' };
    default: return null;
  }
}

const DEMO_IMAGES = ['/img/r0202.webp', '/img/r0306.webp', '/img/r02.webp', '/img/r17.webp', '/img/s01.webp', '/img/s05.webp', '/img/s13.webp', '/img/s21.webp'];

export const textId = (blockId, key) => `text-b-${blockId}-${key}`;
export const imageId = (blockId, key) => `image-b-${blockId}-${key}`;
export const blockSectionId = blockId => `blk-${blockId}`;
export const ownsKey = (key, blockId) => typeof key === 'string' && (key.includes(`-b-${blockId}-`) || key === `section:blk-${blockId}`);

export function newBlockId(existing = [], random = Math.random) {
  const taken = new Set(existing.map(b => (typeof b === 'string' ? b : b.id)));
  for (let i = 0; i < 50; i++) {
    let id = '';
    while (id.length < 8) id += 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(random() * 36)];
    if (BLOCK_ID_RE.test(id) && !taken.has(id)) return id;
  }
  throw new Error('No se pudo crear un identificador de bloque.');
}

export function defaultFields(type) {
  switch (type) {
    case 'textimage': return { eyebrow: 'SOBRE NOSOTROS', title: 'Un título claro para tu mensaje', body: 'Cuenta en dos o tres líneas qué te hace diferente. Cambia este texto haciendo doble clic sobre él.', imageSrc: DEMO_IMAGES[0], imageAlt: 'Imagen ilustrativa', ctaLabel: 'Conocer más', ctaHref: '#contacto', reverse: false };
    case 'gallery': return { title: 'Galería', columns: 3, items: DEMO_IMAGES.slice(0, 6).map((src, i) => ({ src, alt: `Imagen ${i + 1} de la galería` })) };
    case 'testimonials': return { title: 'Lo que dicen nuestros clientes', items: [
      { quote: 'Ejemplo de testimonio: reemplázalo por la opinión real de un cliente.', name: 'Nombre del cliente', role: 'Cargo o ciudad' },
      { quote: 'Otro testimonio de ejemplo. Edítalo con doble clic.', name: 'Otro cliente', role: 'Cargo o ciudad' },
      { quote: 'Un tercer testimonio de ejemplo para completar la fila.', name: 'Tercer cliente', role: 'Cargo o ciudad' }] };
    case 'faq': return { title: 'Preguntas frecuentes', items: [
      { q: '¿Cómo empiezo?', a: 'Escribe aquí la respuesta. Puedes editarla con doble clic.' },
      { q: '¿Cuánto tarda el proceso?', a: 'Escribe aquí la respuesta.' },
      { q: '¿Qué incluye el servicio?', a: 'Escribe aquí la respuesta.' }] };
    case 'cta': return { title: '¿Listo para dar el siguiente paso?', body: 'Cuéntanos qué necesitas y te respondemos pronto.', label: 'Contáctanos', href: '#contacto' };
    case 'contact': return { title: 'Hablemos', body: 'Déjanos tus datos y te contactamos.', buttonLabel: 'Enviar', form: 'contacto' };
    case 'map': return { title: 'Dónde encontrarnos', address: 'Tulum, Quintana Roo, México', lat: 20.2114, lng: -87.4654, zoom: 14 };
    case 'video': return { title: 'Mira cómo trabajamos', url: '' };
    case 'catalog': return { title: 'Propiedades disponibles', mode: 'catalog', filters: true, limit: 6, operation: '', type: '', city: '' };
    case 'spacer': return { height: 80 };
    case 'hero': return { eyebrow: 'NUESTRO ENFOQUE', title: 'Un título grande que presenta esta sección', subtitle: 'Una frase de apoyo que explica qué encontrarán a continuación.', bgSrc: DEMO_IMAGES[3], align: 'left', ctaLabel: 'Conocer más', ctaHref: '#contacto' };
    case 'richtext': return { title: 'Nuestra historia', items: [
      { kind: 'p', text: 'Empieza contando de dónde viene tu proyecto y qué lo mueve. Haz doble clic sobre cualquier párrafo para escribir el tuyo.' },
      { kind: 'h3', text: 'Un subtítulo para separar ideas' },
      { kind: 'p', text: 'Continúa con los detalles que quieres que tus clientes recuerden. Puedes añadir más párrafos y subtítulos desde los ajustes.' }] };
    case 'process': return { title: 'Cómo trabajamos', items: [
      { title: 'Escuchamos', body: 'Entendemos lo que necesitas y lo que quieres lograr.' },
      { title: 'Diseñamos', body: 'Preparamos una propuesta clara con tiempos y costos.' },
      { title: 'Entregamos', body: 'Ejecutamos, revisamos contigo y dejamos todo funcionando.' }] };
    case 'stats': return { title: 'Resultados que hablan', items: [
      { value: '120+', label: 'Proyectos entregados' }, { value: '98%', label: 'Clientes satisfechos' }, { value: '15', label: 'Años de experiencia' }, { value: '24 h', label: 'Tiempo de respuesta' }] };
    case 'team': return { title: 'Conoce al equipo', items: ['Nombre y apellido', 'Segundo integrante', 'Tercer integrante', 'Cuarto integrante'].map((name, i) => ({ src: `/cms/assets/avatar-${i + 1}.svg`, alt: `Foto de ejemplo ${i + 1}`, name, role: ['Dirección', 'Diseño', 'Ventas', 'Operaciones'][i] })) };
    case 'logos': return { title: 'Confían en nosotros', items: [1, 2, 3, 4, 5, 6].map(n => ({ src: `/cms/assets/logo-${n}.svg`, alt: `Logo de ejemplo ${n}` })) };
    case 'pricing': return { title: 'Paquetes', items: [
      { name: 'Esencial', price: '$9,900', note: 'pago único', features: '✓ Lo básico para empezar\n✓ Soporte por correo', ctaLabel: 'Elegir Esencial', ctaHref: '#contacto', featured: false },
      { name: 'Profesional', price: '$19,900', note: 'pago único', features: '✓ Todo lo del paquete Esencial\n✓ Más páginas y secciones\n✓ Soporte prioritario', ctaLabel: 'Elegir Profesional', ctaHref: '#contacto', featured: true },
      { name: 'A medida', price: 'Cotiza', note: 'según tu proyecto', features: '✓ Alcance personalizado\n✓ Equipo dedicado', ctaLabel: 'Hablemos', ctaHref: '#contacto', featured: false }] };
    case 'beforeafter': return { title: 'Antes y después', beforeSrc: DEMO_IMAGES[1], beforeAlt: 'Imagen de antes', afterSrc: DEMO_IMAGES[0], afterAlt: 'Imagen de después', beforeLabel: 'Antes', afterLabel: 'Después' };
    case 'property': return { title: 'Propiedad destacada', slug: '', name: 'Elige una propiedad', price: '', location: '', facts: 'Elige una propiedad en los ajustes del bloque.', imageSrc: DEMO_IMAGES[2], imageAlt: 'Foto de la propiedad', ctaLabel: 'Ver la propiedad' };
    case 'newsletter': return { title: 'Recibe nuestras novedades', body: 'Una vez al mes, sin spam. Date de baja cuando quieras.', placeholder: 'tu@correo.com', buttonLabel: 'Suscribirme', form: 'suscripcion' };
    default: throw new Error('Tipo de bloque desconocido.');
  }
}
export function newBlock(type, after = '', existing = [], random) {
  if (!BLOCK_TYPES[type]) throw new Error('Tipo de bloque desconocido.');
  return { id: newBlockId(existing, random), type, after: String(after || ''), fields: defaultFields(type) };
}

// Huecos editables del bloque (texto/imagen) con el valor por defecto que vive en `fields`.
export const isRenderableBlock = block => !!block && typeof block === 'object' && typeof block.id === 'string' && BLOCK_ID_RE.test(block.id) && typeof block.type === 'string' && Object.hasOwn(BLOCK_TYPES, block.type);
export function blockSlots(block) {
  if (!isRenderableBlock(block)) return { texts: [], images: [] };
  const f = block.fields || {}; const id = block.id; const t = [], im = [];
  const text = (key, label, value, multiline = false) => t.push({ key, id: textId(id, key), label, value: String(value ?? ''), multiline });
  const img = (key, label, src, alt) => im.push({ key, id: imageId(id, key), label, src: String(src || ''), alt: String(alt || '') });
  switch (block.type) {
    case 'textimage': text('eyebrow', 'Etiqueta', f.eyebrow); text('title', 'Título', f.title); text('body', 'Texto', f.body, true); if (f.ctaLabel) text('cta', 'Botón', f.ctaLabel); img('img', 'Imagen', f.imageSrc, f.imageAlt); break;
    case 'gallery': text('title', 'Título', f.title); (f.items || []).forEach((it, i) => img('g' + i, `Imagen ${i + 1}`, it.src, it.alt)); break;
    case 'testimonials': text('title', 'Título', f.title); (f.items || []).forEach((it, i) => { text(`i${i}q`, `Testimonio ${i + 1}`, it.quote, true); text(`i${i}n`, `Nombre ${i + 1}`, it.name); text(`i${i}r`, `Cargo ${i + 1}`, it.role); }); break;
    case 'faq': text('title', 'Título', f.title); (f.items || []).forEach((it, i) => { text(`i${i}q`, `Pregunta ${i + 1}`, it.q); text(`i${i}a`, `Respuesta ${i + 1}`, it.a, true); }); break;
    case 'cta': text('title', 'Título', f.title); text('body', 'Texto', f.body, true); text('btn', 'Botón', f.label); break;
    case 'contact': text('title', 'Título', f.title); text('body', 'Texto', f.body, true); text('lblname', 'Etiqueta nombre', 'Nombre'); text('lblemail', 'Etiqueta correo', 'Correo'); text('lblphone', 'Etiqueta teléfono', 'Teléfono'); text('lblmsg', 'Etiqueta mensaje', 'Mensaje'); text('btn', 'Botón', f.buttonLabel); break;
    case 'map': text('title', 'Título', f.title); text('addr', 'Dirección visible', f.address); break;
    case 'video': text('title', 'Título', f.title); break;
    case 'catalog': text('title', 'Título', f.title); break;
    case 'hero': if (f.eyebrow) text('eyebrow', 'Etiqueta', f.eyebrow); text('title', 'Título', f.title); if (f.subtitle) text('subtitle', 'Subtítulo', f.subtitle, true); if (f.ctaLabel) text('cta', 'Botón', f.ctaLabel); if (f.bgSrc) img('bg', 'Imagen de fondo', f.bgSrc, ''); break;
    case 'richtext': text('title', 'Título', f.title); (f.items || []).forEach((it, i) => text(`i${i}t`, it.kind === 'h3' ? `Subtítulo ${i + 1}` : `Párrafo ${i + 1}`, it.text, it.kind !== 'h3')); break;
    case 'process': text('title', 'Título', f.title); (f.items || []).forEach((it, i) => { text(`i${i}h`, `Paso ${i + 1}`, it.title); text(`i${i}b`, `Detalle ${i + 1}`, it.body, true); }); break;
    case 'stats': text('title', 'Título', f.title); (f.items || []).forEach((it, i) => { text(`i${i}v`, `Cifra ${i + 1}`, it.value); text(`i${i}l`, `Etiqueta ${i + 1}`, it.label); }); break;
    case 'team': text('title', 'Título', f.title); (f.items || []).forEach((it, i) => { img('g' + i, `Foto ${i + 1}`, it.src, it.alt); text(`i${i}n`, `Nombre ${i + 1}`, it.name); text(`i${i}r`, `Cargo ${i + 1}`, it.role); }); break;
    case 'logos': text('title', 'Título', f.title); (f.items || []).forEach((it, i) => img('g' + i, `Logo ${i + 1}`, it.src, it.alt)); break;
    case 'pricing': text('title', 'Título', f.title); (f.items || []).forEach((it, i) => { text(`i${i}n`, `Paquete ${i + 1}`, it.name); text(`i${i}p`, `Precio ${i + 1}`, it.price); if (it.note) text(`i${i}o`, `Nota ${i + 1}`, it.note); text(`i${i}f`, `Incluye ${i + 1}`, it.features, true); if (it.ctaLabel) text(`i${i}b`, `Botón ${i + 1}`, it.ctaLabel); }); break;
    case 'beforeafter': text('title', 'Título', f.title); if (f.beforeLabel) text('lb', 'Etiqueta de antes', f.beforeLabel); if (f.afterLabel) text('la', 'Etiqueta de después', f.afterLabel); img('b', 'Imagen de antes', f.beforeSrc, f.beforeAlt); img('a', 'Imagen de después', f.afterSrc, f.afterAlt); break;
    case 'property': text('title', 'Título', f.title); text('name', 'Nombre', f.name); if (f.location) text('loc', 'Ubicación', f.location); if (f.price) text('price', 'Precio', f.price); if (f.facts) text('facts', 'Datos', f.facts); if (f.ctaLabel) text('cta', 'Botón', f.ctaLabel); img('img', 'Foto', f.imageSrc, f.imageAlt); break;
    case 'newsletter': text('title', 'Título', f.title); text('body', 'Texto', f.body, true); text('btn', 'Botón', f.buttonLabel); break;
    default: break;
  }
  return { texts: t, images: im };
}

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const THEME_VARS = { font: '--b-font', hfont: '--b-hfont', hweight: '--b-hweight', hls: '--b-hls', htt: '--b-htt', ink: '--b-ink', bg: '--b-bg', accent: '--b-accent', btnink: '--b-btnink', radius: '--b-radius' };
export function themeStyle(theme = {}) {
  const parts = [];
  for (const [key, cssVar] of Object.entries(THEME_VARS)) {
    const v = theme[key];
    if (typeof v !== 'string' || !v || v.length > 220 || !/^[a-zA-Z0-9\s,.'"%#()\/+-]+$/.test(v) || /url\s*\(|expression|javascript/i.test(v)) continue;
    parts.push(`${cssVar}:${v}`);
  }
  return parts.join(';');
}

export function videoEmbed(url) {
  const value = String(url || '').trim();
  if (!/^https:\/\//i.test(value)) return { kind: 'none', src: '' };
  let u; try { u = new URL(value); } catch { return { kind: 'none', src: '' }; }
  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  let id = '';
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') id = u.searchParams.get('v') || (/^\/(?:embed|shorts|live)\/([^/?]+)/.exec(u.pathname) || [])[1] || '';
  if (id && /^[\w-]{6,20}$/.test(id)) return { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${id}` };
  if (host === 'vimeo.com' || host === 'player.vimeo.com') { const m = /(\d{5,12})/.exec(u.pathname); if (m) return { kind: 'vimeo', src: `https://player.vimeo.com/video/${m[1]}` }; }
  if (/\.(?:mp4|webm)$/i.test(u.pathname)) return { kind: 'file', src: u.href };
  return { kind: 'link', src: u.href };
}
export function mapEmbed({ lat, lng, zoom = 14 } = {}) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const z = Math.min(19, Math.max(3, Math.round(Number(zoom) || 14)));
  const d = Math.max(0.0006, (180 / 2 ** z) * 1.5);
  const f = n => Number(n.toFixed(6));
  return {
    src: `https://www.openstreetmap.org/export/embed.html?bbox=${f(lng - d * 1.6)}%2C${f(lat - d)}%2C${f(lng + d * 1.6)}%2C${f(lat + d)}&layer=mapnik&marker=${f(lat)}%2C${f(lng)}`,
    link: `https://www.openstreetmap.org/?mlat=${f(lat)}&mlon=${f(lng)}#map=${z}/${f(lat)}/${f(lng)}`
  };
}
const safeHref = value => { const v = String(value ?? '').trim(); return v === '' || !/^(?:https?:\/\/|mailto:|tel:|#|\/(?!\/)|\.\.?\/)/i.test(v) || /[\u0000-\u0020\u007f\\]/.test(v) ? '#' : v; };

// HTML de un bloque. Los atributos data-cms-id dan ids estables a cada texto/imagen para que el editor
// y el parche (texts/images/styles/links) funcionen igual que en la plantilla.
export function renderBlock(block, theme = {}) {
  // Un id que no cumpla BLOCK_ID_RE nunca llega al HTML (id, data-cms-block, data-cms-id).
  if (!isRenderableBlock(block)) return '';
  const f = block.fields || {}; const id = esc(block.id);
  const T = key => `data-cms-id="${textId(id, key)}"`;
  const I = key => `data-cms-id="${imageId(id, key)}"`;
  const slots = blockSlots(block);
  const val = key => esc(slots.texts.find(s => s.key === key)?.value ?? '');
  const style = themeStyle(theme);
  const head = (cls, label, vars = '') => { const st = [style, vars].filter(Boolean).join(';'); return `<section class="ornat-blk ornat-blk--${esc(block.type)} ${esc(cls)}" id="blk-${id}" data-cms-block="${id}" data-cms-block-type="${esc(block.type)}" data-cms-section="blk-${id}" aria-label="${esc(label)}"${st ? ` style="${esc(st)}"` : ''}><div class="ornat-blk__in">`; };
  const tail = '</div></section>';
  const title = key => (f.title ? `<h2 ${T(key || 'title')}>${val(key || 'title')}</h2>` : '');
  switch (block.type) {
    case 'textimage':
      return head(f.reverse ? 'is-reverse' : '', f.title || 'Texto e imagen') +
        `<div class="ornat-blk__copy">${f.eyebrow ? `<p class="ornat-blk__eyebrow" ${T('eyebrow')}>${val('eyebrow')}</p>` : ''}${title()}${f.body ? `<p class="ornat-blk__body" ${T('body')}>${val('body')}</p>` : ''}${f.ctaLabel ? `<a class="ornat-blk__btn" href="${esc(safeHref(f.ctaHref))}" ${T('cta')}>${val('cta')}</a>` : ''}</div>` +
        `<div class="ornat-blk__media">${f.imageSrc ? `<img ${I('img')} src="${esc(f.imageSrc)}" alt="${esc(f.imageAlt)}" loading="lazy" decoding="async">` : ''}</div>` + tail;
    case 'gallery':
      return head('', f.title || 'Galería', `--cols:${Number(f.columns) || 3}`) +
        title() + `<div class="ornat-blk__grid">${(f.items || []).map((it, i) => `<figure class="ornat-blk__fig"><img ${I('g' + i)} src="${esc(it.src)}" alt="${esc(it.alt)}" loading="lazy" decoding="async"></figure>`).join('')}</div>` + tail;
    case 'testimonials':
      return head('', f.title || 'Testimonios') + title() +
        `<div class="ornat-blk__cards">${(f.items || []).map((it, i) => `<div class="ornat-blk__card"><p class="ornat-blk__quote" ${T(`i${i}q`)}>${val(`i${i}q`)}</p><p class="ornat-blk__who"><strong ${T(`i${i}n`)}>${val(`i${i}n`)}</strong><span ${T(`i${i}r`)}>${val(`i${i}r`)}</span></p></div>`).join('')}</div>` + tail;
    case 'faq':
      return head('', f.title || 'Preguntas frecuentes') + title() +
        `<div class="ornat-blk__faq">${(f.items || []).map((it, i) => `<details class="ornat-blk__qa"><summary><span ${T(`i${i}q`)}>${val(`i${i}q`)}</span></summary><p ${T(`i${i}a`)}>${val(`i${i}a`)}</p></details>`).join('')}</div>` + tail;
    case 'cta':
      return head('', f.title || 'Llamada a la acción') + `<div class="ornat-blk__center">${title()}${f.body ? `<p ${T('body')}>${val('body')}</p>` : ''}${f.label ? `<a class="ornat-blk__btn" href="${esc(safeHref(f.href))}" ${T('btn')}>${val('btn')}</a>` : ''}</div>` + tail;
    case 'contact':
      return head('', f.title || 'Contacto') + `<div class="ornat-blk__contact"><div class="ornat-blk__copy">${title()}${f.body ? `<p ${T('body')}>${val('body')}</p>` : ''}</div>` +
        `<form class="ornat-blk__form" data-ornat-form="${esc(f.form || 'contacto')}" id="contacto-${id}"><label><span ${T('lblname')}>${val('lblname')}</span><input name="name" type="text" autocomplete="name" maxlength="150"></label><label><span ${T('lblemail')}>${val('lblemail')}</span><input name="email" type="email" autocomplete="email" maxlength="250"></label><label><span ${T('lblphone')}>${val('lblphone')}</span><input name="phone" type="tel" autocomplete="tel" maxlength="80"></label><label class="is-wide"><span ${T('lblmsg')}>${val('lblmsg')}</span><textarea name="message" rows="4" maxlength="5000"></textarea></label><button type="submit" class="ornat-blk__btn" ${T('btn')}>${val('btn')}</button><p class="ornat-blk__status" data-ornat-status role="status" aria-live="polite"></p></form></div>` + tail;
    case 'map': {
      const m = mapEmbed(f);
      return head('', f.title || 'Mapa') + title() +
        (m ? `<div class="ornat-blk__map"><iframe src="${esc(m.src)}" title="${esc(f.title || 'Mapa')}: ${esc(f.address || '')}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div><p class="ornat-blk__addr"><span ${T('addr')}>${val('addr')}</span> · <a href="${esc(m.link)}" target="_blank" rel="noopener noreferrer">Ver mapa más grande</a></p>`
          : `<div class="ornat-blk__ph">Añade coordenadas para mostrar el mapa.</div>${f.address ? `<p class="ornat-blk__addr"><span ${T('addr')}>${val('addr')}</span></p>` : ''}`) + tail;
    }
    case 'video': {
      const v = videoEmbed(f.url);
      const inner = v.kind === 'youtube' || v.kind === 'vimeo' ? `<iframe src="${esc(v.src)}" title="${esc(f.title || 'Video')}" loading="lazy" allow="fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`
        : v.kind === 'file' ? `<video src="${esc(v.src)}" controls preload="metadata" playsinline aria-label="${esc(f.title || 'Video')}"></video>`
        : v.kind === 'link' ? `<p class="ornat-blk__ph"><a href="${esc(v.src)}" target="_blank" rel="noopener noreferrer">Abrir el video</a></p>`
        : '<p class="ornat-blk__ph">Pega la URL https de un video de YouTube, Vimeo o un archivo MP4/WebM.</p>';
      return head('', f.title || 'Video') + title() + `<div class="ornat-blk__video">${inner}</div>` + tail;
    }
    case 'catalog': {
      const attrs = [f.filters ? 'filters' : '', f.mode === 'featured' ? 'featured' : '', `limit="${Number(f.limit) || 6}"`, f.operation ? `operation="${esc(f.operation)}"` : '', f.type ? `type="${esc(f.type)}"` : '', f.city ? `city="${esc(f.city)}"` : ''].filter(Boolean).join(' ');
      return head('', f.title || 'Propiedades') + title() + `<ornat-catalog ${attrs}><span class="ornat-blk__ph">Catálogo — se mostrará al cargar el módulo</span></ornat-catalog>` + tail;
    }
    case 'hero':
      return head(`${f.align === 'center' ? 'is-center' : 'is-left'}${f.bgSrc ? ' has-bg' : ''}`, f.title || 'Encabezado') +
        (f.bgSrc ? `<img class="ornat-blk__herobg" ${I('bg')} src="${esc(f.bgSrc)}" alt="" loading="lazy" decoding="async">` : '') +
        `<div class="ornat-blk__herocopy">${f.eyebrow ? `<p class="ornat-blk__eyebrow" ${T('eyebrow')}>${val('eyebrow')}</p>` : ''}${title()}${f.subtitle ? `<p class="ornat-blk__sub" ${T('subtitle')}>${val('subtitle')}</p>` : ''}${f.ctaLabel ? `<a class="ornat-blk__btn" href="${esc(safeHref(f.ctaHref))}" ${T('cta')}>${val('cta')}</a>` : ''}</div>` + tail;
    case 'richtext':
      return head('', f.title || 'Texto') + title() + `<div class="ornat-blk__prose">${(f.items || []).map((it, i) => (it.kind === 'h3' ? `<h3 ${T(`i${i}t`)}>${val(`i${i}t`)}</h3>` : `<p ${T(`i${i}t`)}>${val(`i${i}t`)}</p>`)).join('')}</div>` + tail;
    case 'process':
      return head('', f.title || 'Proceso') + title() + `<ol class="ornat-blk__steps" style="--n:${Math.min(4, Math.max(1, (f.items || []).length))}">${(f.items || []).map((it, i) => `<li class="ornat-blk__step"><h3 ${T(`i${i}h`)}>${val(`i${i}h`)}</h3><p ${T(`i${i}b`)}>${val(`i${i}b`)}</p></li>`).join('')}</ol>` + tail;
    case 'stats':
      return head('', f.title || 'Cifras') + title() + `<div class="ornat-blk__stats">${(f.items || []).map((it, i) => `<div class="ornat-blk__stat"><p class="ornat-blk__num" ${T(`i${i}v`)}>${val(`i${i}v`)}</p><p class="ornat-blk__lbl" ${T(`i${i}l`)}>${val(`i${i}l`)}</p></div>`).join('')}</div>` + tail;
    case 'team':
      return head('', f.title || 'Equipo') + title() + `<div class="ornat-blk__team">${(f.items || []).map((it, i) => `<figure class="ornat-blk__member"><img ${I('g' + i)} src="${esc(it.src)}" alt="${esc(it.alt)}" loading="lazy" decoding="async"><figcaption><strong ${T(`i${i}n`)}>${val(`i${i}n`)}</strong><span ${T(`i${i}r`)}>${val(`i${i}r`)}</span></figcaption></figure>`).join('')}</div>` + tail;
    case 'logos':
      return head('', f.title || 'Logos') + title() + `<div class="ornat-blk__logos">${(f.items || []).map((it, i) => `<img ${I('g' + i)} src="${esc(it.src)}" alt="${esc(it.alt)}" loading="lazy" decoding="async">`).join('')}</div>` + tail;
    case 'pricing':
      return head('', f.title || 'Paquetes') + title() + `<div class="ornat-blk__plans" style="--n:${Math.min(4, Math.max(1, (f.items || []).length))}">${(f.items || []).map((it, i) => `<article class="ornat-blk__plan${it.featured ? ' is-featured' : ''}"><h3 ${T(`i${i}n`)}>${val(`i${i}n`)}</h3><p class="ornat-blk__price" ${T(`i${i}p`)}>${val(`i${i}p`)}</p>${it.note ? `<p class="ornat-blk__note" ${T(`i${i}o`)}>${val(`i${i}o`)}</p>` : ''}<p class="ornat-blk__feat" ${T(`i${i}f`)}>${val(`i${i}f`)}</p>${it.ctaLabel ? `<a class="ornat-blk__btn" href="${esc(safeHref(it.ctaHref))}" ${T(`i${i}b`)}>${val(`i${i}b`)}</a>` : ''}</article>`).join('')}</div>` + tail;
    case 'beforeafter':
      return head('', f.title || 'Antes y después') + title() +
        `<div class="ornat-blk__ba" style="--pos:50%"><img class="ornat-blk__ba-img" ${I('b')} src="${esc(f.beforeSrc)}" alt="${esc(f.beforeAlt)}" loading="lazy" decoding="async"><div class="ornat-blk__ba-after"><img class="ornat-blk__ba-img" ${I('a')} src="${esc(f.afterSrc)}" alt="${esc(f.afterAlt)}" loading="lazy" decoding="async"></div>` +
        `${f.beforeLabel ? `<span class="ornat-blk__ba-tag is-l" ${T('lb')}>${val('lb')}</span>` : ''}${f.afterLabel ? `<span class="ornat-blk__ba-tag is-r" ${T('la')}>${val('la')}</span>` : ''}<span class="ornat-blk__ba-handle" aria-hidden="true"></span><input class="ornat-blk__ba-range" type="range" min="0" max="100" value="50" step="1" aria-label="Comparar: arrastra o usa las flechas para ver el antes y el después" aria-valuetext="50%"></div>` + tail;
    case 'property': {
      const href = /^[a-z0-9-]{1,120}$/.test(String(f.slug || '')) ? `/propiedades/?p=${esc(f.slug)}` : '#';
      return head('', f.title || 'Propiedad destacada') + title() +
        `<article class="ornat-blk__prop"><div class="ornat-blk__media">${f.imageSrc ? `<img ${I('img')} src="${esc(f.imageSrc)}" alt="${esc(f.imageAlt)}" loading="lazy" decoding="async">` : ''}</div><div class="ornat-blk__copy">${f.location ? `<p class="ornat-blk__eyebrow" ${T('loc')}>${val('loc')}</p>` : ''}<h3 ${T('name')}>${val('name')}</h3>${f.price ? `<p class="ornat-blk__price" ${T('price')}>${val('price')}</p>` : ''}${f.facts ? `<p class="ornat-blk__body" ${T('facts')}>${val('facts')}</p>` : ''}${f.ctaLabel ? `<a class="ornat-blk__btn" href="${href}" ${T('cta')}>${val('cta')}</a>` : ''}</div></article>` + tail;
    }
    case 'newsletter':
      return head('', f.title || 'Suscripción') + `<div class="ornat-blk__center">${title()}${f.body ? `<p ${T('body')}>${val('body')}</p>` : ''}` +
        `<form class="ornat-blk__form ornat-blk__news" data-ornat-form="${esc(f.form || 'suscripcion')}" id="suscribir-${id}"><input name="email" type="email" required autocomplete="email" maxlength="250" aria-label="Correo electrónico" placeholder="${esc(f.placeholder)}"><button type="submit" class="ornat-blk__btn" ${T('btn')}>${val('btn')}</button><p class="ornat-blk__status" data-ornat-status role="status" aria-live="polite"></p></form></div>` + tail;
    case 'spacer':
      return `<section class="ornat-blk ornat-blk--spacer" id="blk-${id}" data-cms-block="${id}" data-cms-block-type="spacer" data-cms-section="blk-${id}" aria-hidden="true" style="height:${Number(f.height) || 80}px;padding:0"></section>`;
    default: return '';
  }
}

export const BLOCK_CSS = `
.ornat-blk{--b-ink:#191c19;--b-bg:#fff;--b-accent:#4d6c2d;--b-btnink:#fff;--b-radius:2px;position:relative;z-index:1;display:block;width:100%;box-sizing:border-box;padding:clamp(44px,7vw,104px) clamp(20px,5vw,80px);background:var(--b-bg);color:var(--b-ink);font-family:var(--b-font,inherit);font-size:16px;line-height:1.6;text-align:left;text-transform:none;letter-spacing:normal}
.ornat-blk *,.ornat-blk *::before,.ornat-blk *::after{box-sizing:border-box}
.ornat-blk{--ornat-catalog-accent:var(--b-accent);--ornat-catalog-accent-ink:var(--b-btnink);--ornat-catalog-ink:var(--b-ink);--ornat-catalog-paper:var(--b-bg);--ornat-catalog-font:var(--b-font,inherit);--ornat-catalog-display:var(--b-hfont,inherit)}
.ornat-blk__in{max-width:1180px;margin:0 auto}
.ornat-blk h2{font-family:var(--b-hfont,inherit);font-weight:var(--b-hweight,600);letter-spacing:var(--b-hls,normal);text-transform:var(--b-htt,none);font-size:clamp(28px,4.2vw,56px);line-height:1.06;margin:0 0 .45em;color:inherit}
.ornat-blk p{margin:0 0 1em;font-size:clamp(15px,1.3vw,18px);color:inherit;max-width:62ch;white-space:pre-line}
.ornat-blk .ornat-blk__eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:.9em}
.ornat-blk a{color:inherit}
.ornat-blk .ornat-blk__btn{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:.8em 1.7em;border:0;border-radius:var(--b-radius);background:var(--b-accent);color:var(--b-btnink);text-decoration:none;font:inherit;font-weight:600;cursor:pointer;letter-spacing:.01em;text-transform:none}
.ornat-blk .ornat-blk__btn:hover{filter:brightness(1.08)}
.ornat-blk :focus-visible{outline:3px solid var(--b-accent);outline-offset:3px}
.ornat-blk--textimage .ornat-blk__in{display:grid;grid-template-columns:1fr 1fr;gap:clamp(24px,5vw,72px);align-items:center}
.ornat-blk--textimage.is-reverse .ornat-blk__media{order:-1}
.ornat-blk__media img{display:block;width:100%;height:auto;aspect-ratio:4/3;object-fit:cover;border-radius:var(--b-radius)}
.ornat-blk__grid{display:grid;grid-template-columns:repeat(var(--cols,3),minmax(0,1fr));gap:clamp(8px,1.4vw,18px)}
.ornat-blk__fig{margin:0}.ornat-blk__fig img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:var(--b-radius)}
.ornat-blk__cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:clamp(12px,2vw,24px)}
.ornat-blk__card{border:1px solid color-mix(in srgb,currentColor 22%,transparent);border-radius:var(--b-radius);padding:clamp(18px,2.4vw,30px)}
.ornat-blk .ornat-blk__quote{font-size:clamp(16px,1.4vw,19px);margin-bottom:1.2em}
.ornat-blk .ornat-blk__who{margin:0;font-size:14px;display:flex;flex-direction:column;gap:2px}.ornat-blk__who span{opacity:.7}
.ornat-blk__faq{border-bottom:1px solid color-mix(in srgb,currentColor 22%,transparent);max-width:860px}
.ornat-blk__qa{border-top:1px solid color-mix(in srgb,currentColor 22%,transparent)}
.ornat-blk__qa summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:1.05em 0;font-weight:600;font-size:clamp(16px,1.4vw,19px)}
.ornat-blk__qa summary::-webkit-details-marker{display:none}
.ornat-blk__qa summary::after{content:"+";font-size:1.5em;line-height:1;font-weight:300;flex:none;transition:transform .2s}
.ornat-blk__qa[open] summary::after{transform:rotate(45deg)}
.ornat-blk__qa p{padding-bottom:1em;margin:0}
.ornat-blk__center{text-align:center;max-width:760px;margin:0 auto}.ornat-blk__center p{margin-left:auto;margin-right:auto}
.ornat-blk__contact{display:grid;grid-template-columns:1fr 1fr;gap:clamp(24px,5vw,72px);align-items:start}
.ornat-blk__form{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.ornat-blk__form label{display:block}.ornat-blk__form .is-wide,.ornat-blk__form button,.ornat-blk__form .ornat-blk__status{grid-column:1/-1}
.ornat-blk__form label>span{display:block;font-size:13px;font-weight:600;margin-bottom:6px}
.ornat-blk__form input,.ornat-blk__form textarea{width:100%;font:inherit;color:inherit;background:transparent;border:1px solid color-mix(in srgb,currentColor 35%,transparent);border-radius:var(--b-radius);padding:.7em .85em;min-height:46px}
.ornat-blk__form button{justify-self:start}
.ornat-blk .ornat-blk__status{font-size:14px;margin:0;min-height:1.4em}
.ornat-blk__map,.ornat-blk__video{position:relative;width:100%;aspect-ratio:16/9;border-radius:var(--b-radius);overflow:hidden;background:color-mix(in srgb,currentColor 8%,transparent)}
.ornat-blk__map iframe,.ornat-blk__video iframe,.ornat-blk__video video{position:absolute;inset:0;width:100%;height:100%;border:0}
.ornat-blk .ornat-blk__addr{margin-top:.8em;font-size:14px}
.ornat-blk .ornat-blk__ph{display:block;padding:2em;text-align:center;font-size:14px;opacity:.75;border:1px dashed color-mix(in srgb,currentColor 35%,transparent);border-radius:var(--b-radius);margin:0}
.ornat-blk--spacer{background:transparent}
ornat-catalog{display:block;min-height:60px}
@media(max-width:760px){.ornat-blk--textimage .ornat-blk__in,.ornat-blk__contact,.ornat-blk__form{grid-template-columns:1fr}.ornat-blk__grid{grid-template-columns:repeat(min(var(--cols,3),2),minmax(0,1fr))}.ornat-blk--textimage.is-reverse .ornat-blk__media{order:0}}

.ornat-blk h3{font-family:var(--b-hfont,inherit);font-weight:var(--b-hweight,600);letter-spacing:var(--b-hls,normal);text-transform:var(--b-htt,none);font-size:clamp(18px,1.8vw,24px);line-height:1.2;margin:0 0 .4em;color:inherit}
.ornat-blk--hero{overflow:hidden;min-height:clamp(320px,54vh,580px);display:flex;align-items:center}
.ornat-blk--hero .ornat-blk__in{width:100%}
.ornat-blk__herobg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0}
.ornat-blk--hero.has-bg::after{content:"";position:absolute;inset:0;z-index:0;background:linear-gradient(90deg,rgba(8,10,8,.72),rgba(8,10,8,.28))}
.ornat-blk--hero.has-bg{color:#fff}
.ornat-blk__herocopy{position:relative;z-index:1;max-width:820px}
.ornat-blk--hero.is-center .ornat-blk__herocopy{margin:0 auto;text-align:center}
.ornat-blk--hero.is-center .ornat-blk__herocopy p{margin-left:auto;margin-right:auto}
.ornat-blk--hero h2{font-size:clamp(34px,6vw,84px);line-height:1}
.ornat-blk .ornat-blk__sub{font-size:clamp(17px,1.7vw,22px);opacity:.92;margin-bottom:1.6em}
.ornat-blk__prose{max-width:760px}.ornat-blk__prose p{max-width:none}.ornat-blk__prose h3{margin-top:1.4em;font-size:clamp(20px,2.2vw,30px)}
.ornat-blk__steps{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(var(--n,3),minmax(0,1fr));gap:clamp(16px,2.4vw,36px);counter-reset:step}
.ornat-blk__step{counter-increment:step;border-top:2px solid var(--b-accent);padding-top:1em}
.ornat-blk__step::before{content:counter(step,decimal-leading-zero);display:block;font-family:var(--b-hfont,inherit);font-size:clamp(28px,3.4vw,46px);line-height:1;margin-bottom:.5em;color:var(--b-accent)}
.ornat-blk__step p{margin:0}
.ornat-blk__stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:clamp(18px,3vw,44px)}
.ornat-blk__stat{border-top:1px solid color-mix(in srgb,currentColor 28%,transparent);padding-top:1em}
.ornat-blk .ornat-blk__num{font-family:var(--b-hfont,inherit);font-weight:var(--b-hweight,600);font-size:clamp(40px,5.4vw,76px);line-height:1;margin:0 0 .15em;letter-spacing:var(--b-hls,normal);font-variant-numeric:tabular-nums}
.ornat-blk .ornat-blk__lbl{margin:0;font-size:15px;opacity:.78}
.ornat-blk__team{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:clamp(14px,2vw,28px)}
.ornat-blk__member{margin:0}.ornat-blk__member img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:var(--b-radius);background:color-mix(in srgb,currentColor 8%,transparent)}
.ornat-blk__member figcaption{display:flex;flex-direction:column;gap:2px;margin-top:.8em}.ornat-blk__member strong{font-size:17px}.ornat-blk__member span{font-size:14px;opacity:.72}
.ornat-blk__logos{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:clamp(20px,4vw,56px)}
.ornat-blk__logos img{display:block;height:clamp(30px,4vw,48px);width:auto;max-width:180px;object-fit:contain;filter:grayscale(1);opacity:.8}
.ornat-blk__plans{display:grid;grid-template-columns:repeat(var(--n,3),minmax(0,1fr));gap:clamp(12px,2vw,24px);align-items:stretch}
.ornat-blk__plan{display:flex;flex-direction:column;border:1px solid color-mix(in srgb,currentColor 24%,transparent);border-radius:var(--b-radius);padding:clamp(20px,2.6vw,34px)}
.ornat-blk__plan.is-featured{border:2px solid var(--b-accent);box-shadow:0 18px 44px color-mix(in srgb,var(--b-accent) 22%,transparent)}
.ornat-blk .ornat-blk__price{font-family:var(--b-hfont,inherit);font-weight:var(--b-hweight,600);font-size:clamp(30px,3.6vw,48px);line-height:1.05;margin:0 0 .15em}
.ornat-blk .ornat-blk__note{font-size:14px;opacity:.7;margin:0 0 1.2em}
.ornat-blk .ornat-blk__feat{flex:1;margin:0 0 1.5em;line-height:1.9;font-size:15px}
.ornat-blk__plan .ornat-blk__btn{align-self:flex-start}
.ornat-blk__ba{--pos:50%;position:relative;max-width:980px;aspect-ratio:16/10;overflow:hidden;border-radius:var(--b-radius);user-select:none;-webkit-user-select:none;touch-action:pan-y;background:color-mix(in srgb,currentColor 8%,transparent)}
.ornat-blk__ba-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.ornat-blk__ba-after{position:absolute;inset:0;clip-path:inset(0 0 0 var(--pos))}
.ornat-blk__ba-handle{position:absolute;top:0;bottom:0;left:var(--pos);width:3px;margin-left:-1.5px;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.28);pointer-events:none;z-index:2}
.ornat-blk__ba-handle::after{content:"";position:absolute;top:50%;left:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:var(--b-accent) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m9 7-5 5 5 5M15 7l5 5-5 5'/%3E%3C/svg%3E") center/26px no-repeat;border:3px solid #fff;box-shadow:0 4px 14px rgba(0,0,0,.35)}
.ornat-blk__ba:focus-within .ornat-blk__ba-handle::after{outline:3px solid #fff;outline-offset:3px;box-shadow:0 0 0 6px var(--b-accent)}
.ornat-blk__ba-range{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:ew-resize;z-index:3;-webkit-appearance:none;appearance:none}
.ornat-blk__ba-tag{position:absolute;bottom:14px;z-index:2;padding:.3em .8em;background:rgba(0,0,0,.62);color:#fff;font-size:13px;font-weight:600;letter-spacing:.04em;border-radius:2px;pointer-events:none}
.ornat-blk__ba-tag.is-l{left:14px}.ornat-blk__ba-tag.is-r{right:14px}
html[data-cms-selecting] .ornat-blk__ba-range{pointer-events:none}
.ornat-blk__prop{display:grid;grid-template-columns:1.15fr 1fr;gap:clamp(20px,4vw,64px);align-items:center}
.ornat-blk__prop .ornat-blk__media img{aspect-ratio:4/3}
.ornat-blk__prop h3{font-size:clamp(26px,3.2vw,44px);line-height:1.08}
.ornat-blk__news{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;max-width:560px;margin:1.4em auto 0}
.ornat-blk__news input{flex:1 1 240px;width:auto}
.ornat-blk__news .ornat-blk__status{flex:1 0 100%;text-align:center}
@media(max-width:760px){.ornat-blk__steps,.ornat-blk__plans{grid-template-columns:1fr}.ornat-blk__prop{grid-template-columns:1fr}.ornat-blk__stats{grid-template-columns:repeat(2,minmax(0,1fr))}.ornat-blk__team{grid-template-columns:repeat(2,minmax(0,1fr))}.ornat-blk--hero{min-height:clamp(280px,60vh,480px)}}
@media(prefers-reduced-motion:reduce){.ornat-blk *{transition:none!important}}
`;

// ---------- Operaciones puras sobre el parche ----------
export function insertBlock(patch, block) { return { ...patch, blocks: [...(patch.blocks || []), block] }; }

export function purgeBlockRefs(patch, blockId) {
  const next = { ...patch };
  for (const area of ['texts', 'styles', 'images', 'links', 'hidden', 'mediaMeta']) {
    if (!patch[area]) continue;
    const kept = Object.fromEntries(Object.entries(patch[area]).filter(([key]) => !ownsKey(key, blockId)));
    if (Object.keys(kept).length) next[area] = kept; else delete next[area];
  }
  if (patch.i18n?.en) {
    const en = Object.fromEntries(Object.entries(patch.i18n.en).filter(([key]) => !ownsKey(key, blockId)));
    next.i18n = { ...patch.i18n, en };
  }
  return next;
}
export function removeBlock(patch, blockId) {
  const next = purgeBlockRefs(patch, blockId);
  const blocks = (patch.blocks || []).filter(b => b.id !== blockId);
  if (blocks.length) next.blocks = blocks; else delete next.blocks;
  return next;
}
export function duplicateBlock(patch, blockId, random) {
  const list = patch.blocks || []; const i = list.findIndex(b => b.id === blockId);
  if (i < 0) return patch;
  const newId = newBlockId(list, random);
  const copy = { ...list[i], id: newId, fields: JSON.parse(JSON.stringify(list[i].fields)) };
  const blocks = [...list.slice(0, i + 1), copy, ...list.slice(i + 1)];
  const remap = key => key.split(`-b-${blockId}-`).join(`-b-${newId}-`).replace(`section:blk-${blockId}`, `section:blk-${newId}`);
  const next = { ...patch, blocks };
  for (const area of ['texts', 'styles', 'images', 'links', 'hidden', 'mediaMeta']) {
    if (!patch[area]) continue;
    const extra = Object.fromEntries(Object.entries(patch[area]).filter(([key]) => ownsKey(key, blockId)).map(([key, value]) => [remap(key), JSON.parse(JSON.stringify(value))]));
    if (Object.keys(extra).length) next[area] = { ...patch[area], ...extra };
  }
  if (patch.i18n?.en) {
    const extra = Object.fromEntries(Object.entries(patch.i18n.en).filter(([key]) => ownsKey(key, blockId)).map(([key, value]) => [remap(key), value]));
    if (Object.keys(extra).length) next.i18n = { ...patch.i18n, en: { ...patch.i18n.en, ...extra } };
  }
  return { patch: next, id: newId };
}
// Sube (-1) o baja (+1) un bloque. Dentro de un mismo punto reordena; en el borde pasa al punto siguiente de la página.
// points: ids de sección (en orden del documento) donde se puede insertar de forma segura. '' = antes del pie.
export function moveBlock(blocks, blockId, dir, points = []) {
  const list = [...blocks]; const i = list.findIndex(b => b.id === blockId);
  if (i < 0 || !dir) return blocks;
  const key = list[i].after;
  const group = list.map((b, idx) => (b.after === key ? idx : -1)).filter(idx => idx >= 0);
  const pos = group.indexOf(i);
  const target = group[pos + (dir < 0 ? -1 : 1)];
  if (target !== undefined) { [list[i], list[target]] = [list[target], list[i]]; return list; }
  let p = key === '' ? points.length : points.indexOf(key);
  if (p < 0) p = points.length;
  const np = p + (dir < 0 ? -1 : 1);
  if (np < 0 || np > points.length) return blocks;
  const newKey = np === points.length ? '' : points[np];
  const [moved] = list.splice(i, 1);
  const fresh = { ...moved, after: newKey };
  const idxs = list.map((b, idx) => (b.after === newKey ? idx : -1)).filter(idx => idx >= 0);
  const at = idxs.length ? (dir < 0 ? idxs[idxs.length - 1] + 1 : idxs[0]) : list.length;
  list.splice(at, 0, fresh);
  return list;
}

// Quita el elemento `index` de una lista del bloque (preguntas, testimonios, imágenes) y recorre las ediciones
// guardadas (textos, estilos, imágenes, traducciones) para que sigan pegadas al elemento correcto.
export function removeBlockItem(patch, blockId, index) {
  const blocks = (patch.blocks || []).map(b => {
    if (b.id !== blockId) return b;
    const items = (b.fields.items || []).filter((_, i) => i !== index);
    return { ...b, fields: { ...b.fields, items } };
  });
  const prefix = `-b-${blockId}-`;
  const shift = key => {
    const at = key.indexOf(prefix); if (at < 0) return key;
    const m = /^([ig])(\d+)(.*)$/.exec(key.slice(at + prefix.length)); if (!m) return key;
    const n = Number(m[2]); if (n === index) return null;
    return n > index ? key.slice(0, at + prefix.length) + m[1] + (n - 1) + m[3] : key;
  };
  const remap = obj => { const out = {}; for (const [k, v] of Object.entries(obj)) { const nk = shift(k); if (nk !== null) out[nk] = v; } return out; };
  const next = { ...patch, blocks };
  for (const area of ['texts', 'styles', 'images', 'links', 'hidden', 'mediaMeta']) if (patch[area]) { const r = remap(patch[area]); if (Object.keys(r).length) next[area] = r; else delete next[area]; }
  if (patch.i18n?.en) next.i18n = { ...patch.i18n, en: remap(patch.i18n.en) };
  return next;
}

// ---------- Colocación (arrastrar y soltar) ----------
// Pone `block` (nuevo o ya insertado) en el punto `after`, justo antes del bloque `beforeId` de ese mismo punto
// o, si no se indica, al final de los bloques de ese punto. Devuelve una lista nueva.
export function placeBlock(blocks, block, after, beforeId = null) {
  const rest = blocks.filter(b => b.id !== block.id);
  const moved = { ...block, after: String(after || '') };
  let at = -1;
  if (beforeId) at = rest.findIndex(b => b.id === beforeId && b.after === moved.after);
  if (at < 0) { let last = -1; rest.forEach((b, i) => { if (b.after === moved.after) last = i; }); at = last >= 0 ? last + 1 : rest.length; }
  rest.splice(at, 0, moved);
  return rest;
}
// ¿Dejar `blockId` en (after, beforeId) cambiaría algo? (sirve para no marcar como cambio un movimiento nulo).
export function samePlace(blocks, blockId, after, beforeId = null) {
  const next = placeBlock(blocks, blocks.find(b => b.id === blockId) || { id: blockId }, after, beforeId);
  return next.length === blocks.length && next.every((b, i) => b.id === blocks[i].id && b.after === blocks[i].after);
}

// ---------- Comportamiento de los bloques en la página (se inyecta tal cual en el HTML exportado) ----------
// No debe referirse a nada fuera de su cuerpo: se serializa con toString(). Con animate=false (editor) solo conecta el deslizador.
export function blockRuntime(animate) {
  const w = window;
  if (!w.__ornatBlockRt) {
    w.__ornatBlockRt = true;
    document.addEventListener('input', function (e) {
      const t = e.target;
      if (t && t.classList && t.classList.contains('ornat-blk__ba-range')) {
        const box = t.closest('.ornat-blk__ba');
        if (box) box.style.setProperty('--pos', t.value + '%');
        t.setAttribute('aria-valuetext', t.value + '%');
      }
    });
  }
  if (!animate || !('IntersectionObserver' in w)) return;
  if (w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const run = function (el) {
    const original = el.textContent;
    const m = /^(\D*?)(\d[\d.,]*)(.*)$/.exec(original.trim());
    if (!m) return;
    const raw = m[2]; const hasComma = raw.indexOf(',') >= 0; const dec = /[.]\d+$/.test(raw) && !hasComma ? raw.split('.')[1].length : 0;
    const target = parseFloat(raw.replace(/,/g, ''));
    if (!isFinite(target) || target <= 0) return;
    const t0 = performance.now(); const dur = 1300;
    const fmt = function (v) { const n = dec ? v.toFixed(dec) : String(Math.round(v)); return hasComma ? n.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : n; };
    const tick = function (now) {
      const k = Math.min(1, (now - t0) / dur); const eased = 1 - Math.pow(1 - k, 3);
      el.textContent = k >= 1 ? original : m[1] + fmt(target * eased) + m[3];
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) { io.unobserve(en.target); run(en.target); } });
  }, { threshold: 0.4 });
  document.querySelectorAll('.ornat-blk__num').forEach(function (el) { io.observe(el); });
}
