// Panel «Elementos»: biblioteca de bloques que se insertan en la plantilla (clic o arrastrar al lienzo) y el editor de campos de cada bloque.
import { BLOCK_ORDER, BLOCK_GROUPS, BLOCK_META, ITEM_LABEL, newBlock, newItem, itemLimit, itemMin, insertBlock, removeBlock, duplicateBlock, moveBlock, placeBlock, samePlace, removeBlockItem, blockSlots, textId, defaultFields } from './blocks.js';
import { BLOCK_TYPES, validateBlocks } from './core.js';
import { createDnd } from './x-dnd.js';

const OPERATIONS = { '': 'Todas', venta: 'Venta', renta: 'Renta', preventa: 'Preventa' };
const DEMO_IMG = ['/img/r0202.webp', '/img/r0306.webp', '/img/r02.webp', '/img/r17.webp', '/img/s01.webp', '/img/s05.webp', '/img/s13.webp', '/img/s21.webp'];
// Miniaturas esquemáticas (dibujan la estructura de cada bloque con el color del texto).
const R = (x, y, w, h, o = 0.85, rx = 1.5) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" opacity="${o}"/>`;
const C = (cx, cy, r, o = 0.45) => `<circle cx="${cx}" cy="${cy}" r="${r}" opacity="${o}"/>`;
const cols = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join('');
const THUMBS = {
  hero: R(0, 0, 64, 40, 0.16, 2) + R(8, 11, 32, 5) + R(8, 20, 24, 2.4, 0.55) + R(8, 26, 13, 5, 1),
  textimage: R(5, 9, 24, 3.4) + R(5, 15, 24, 2, 0.5) + R(5, 19, 20, 2, 0.5) + R(5, 26, 12, 5) + R(35, 6, 24, 28, 0.28),
  richtext: R(9, 6, 24, 4) + R(9, 14, 46, 2, 0.5) + R(9, 18, 46, 2, 0.5) + R(9, 22, 38, 2, 0.5) + R(9, 29, 46, 2, 0.5) + R(9, 33, 28, 2, 0.5),
  process: cols(3, i => R(6 + i * 19, 7, 15, 2.4) + R(6 + i * 19, 13, 15, 3, 0.3) + R(6 + i * 19, 20, 15, 2, 0.5) + R(6 + i * 19, 25, 11, 2, 0.5)),
  stats: cols(3, i => R(6 + i * 19, 11, 14, 9) + R(6 + i * 19, 25, 14, 2, 0.5)),
  team: cols(3, i => C(14 + i * 18, 15, 6.5) + R(7 + i * 18, 26, 14, 2.6) + R(9 + i * 18, 31, 10, 2, 0.5)),
  logos: cols(3, i => R(5 + i * 20, 10, 16, 6, 0.4)) + cols(3, i => R(5 + i * 20, 22, 16, 6, 0.4)),
  testimonials: cols(3, i => R(5 + i * 19.5, 8, 17, 24, 0.14) + R(8 + i * 19.5, 12, 11, 2, 0.6) + R(8 + i * 19.5, 17, 11, 2, 0.6) + R(8 + i * 19.5, 26, 7, 2.4)),
  pricing: cols(3, i => R(5 + i * 19.5, 6, 17, 28, i === 1 ? 0.3 : 0.12) + R(8 + i * 19.5, 10, 11, 4) + R(8 + i * 19.5, 18, 11, 2, 0.5) + R(8 + i * 19.5, 28, 11, 3.4)),
  cta: R(14, 9, 36, 4.5) + R(19, 17, 26, 2, 0.5) + R(24, 25, 16, 6),
  newsletter: R(12, 8, 40, 4) + R(14, 17, 36, 2, 0.5) + R(10, 25, 30, 7, 0.22) + R(42, 25, 12, 7),
  contact: R(5, 8, 22, 4) + R(5, 15, 22, 2, 0.5) + R(33, 6, 26, 6, 0.25) + R(33, 15, 26, 6, 0.25) + R(33, 24, 12, 6),
  faq: cols(4, i => R(8, 6 + i * 8, 48, 5, 0.18) + R(49, 7.6 + i * 8, 4, 1.8, 0.8)),
  gallery: cols(3, i => R(5 + i * 20, 7, 17, 12, 0.35)) + cols(3, i => R(5 + i * 20, 22, 17, 12, 0.25)),
  beforeafter: R(5, 7, 54, 26, 0.22) + R(32, 7, 27, 26, 0.45, 0) + R(31, 7, 2, 26, 1, 0) + C(32, 20, 4.5, 1),
  video: R(6, 6, 52, 28, 0.2) + '<path d="M28 14v12l10-6z" opacity=".9"/>',
  map: R(6, 6, 52, 28, 0.2) + C(32, 18, 4.5, 0.9) + R(31, 21, 2, 7, 0.9),
  property: R(5, 6, 30, 28, 0.3) + R(40, 9, 18, 3) + R(40, 16, 14, 4.4) + R(40, 24, 18, 2, 0.5) + R(40, 29, 10, 4),
  catalog: cols(3, i => R(5 + i * 20, 6, 17, 13, 0.3) + R(5 + i * 20, 22, 17, 2.6) + R(5 + i * 20, 27, 12, 2, 0.5)),
  spacer: R(6, 19, 52, 2, 0.35, 0) + '<path d="M32 8v8M32 24v8M28 12l4-4 4 4M28 28l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".75"/>'
};
export const blockThumb = type => `<svg class="x-thumb" viewBox="0 0 64 40" fill="currentColor" aria-hidden="true" focusable="false">${THUMBS[type] || ''}</svg>`;

export function create(host, ext) {
  const { esc } = host;
  let chosen = null; let openId = null; let pendingSelect = null; let query = ''; const toasted = new Set();
  const blocks = () => host.patch.blocks || [];
  const points = () => host.inventory.insertPoints || [];
  const pointLabel = id => (id === '' ? 'Antes del pie de página' : `Después de «${host.sectionLabel(id)}»`);

  function autoTarget() {
    const sel = host.sel;
    if (sel?.blockId) { const b = blocks().find(x => x.id === sel.blockId); if (b) return b.after; }
    if (sel?.section && points().some(p => p.id === sel.section)) return sel.section;
    if (host.currentSection && points().some(p => p.id === host.currentSection)) return host.currentSection;
    return '';
  }
  const target = () => (chosen !== null && (chosen === '' || points().some(p => p.id === chosen)) ? chosen : autoTarget());

  function commit(list, selectId) {
    try { validateBlocks(list); } catch (error) { host.toast(error.message, true); return false; }
    if (!host.replacePatch({ ...host.patch, blocks: list })) return false;
    if (selectId) pendingSelect = 'section:blk-' + selectId;
    return true;
  }
  function insert(type, overrides = {}, place = null) {
    if (!ext.canEdit()) return ext.denied();
    if (host.inventory.blocksSupported === false) { host.toast('Esta plantilla controla el scroll por su cuenta: un bloque quedaría fuera de alcance. Elige otra plantilla para usar bloques.', true); return; }
    const block = newBlock(type, place ? place.after : target(), blocks());
    Object.assign(block.fields, overrides);
    const list = place ? placeBlock(blocks(), block, place.after, place.before) : [...blocks(), block];
    if (commit(list, block.id)) { openId = block.id; host.setTab('elements'); host.toast(`Bloque «${BLOCK_META[type].label}» insertado. Haz clic en sus textos para editarlos.`); }
  }
  function moveTo(id, after, before) {
    if (!ext.canEdit()) return ext.denied();
    const b = blocks().find(x => x.id === id); if (!b) return;
    if (samePlace(blocks(), id, after, before)) { host.toast('El bloque ya está en ese lugar.'); return; }
    if (commit(placeBlock(blocks(), b, after, before), id)) host.toast('Bloque movido.');
  }
  const dnd = createDnd(host, { onDrop: (source, where) => (source.type ? insert(source.type, {}, where) : moveTo(source.blockId, where.after, where.before)) });
  document.addEventListener('pointerdown', e => {
    const t = e.target instanceof Element ? e.target : null; if (!t || !ext.canEdit()) return;
    const card = t.closest('.x-card[data-xv]');
    if (card && !card.disabled) { dnd.begin(e, { type: card.dataset.xv }, BLOCK_META[card.dataset.xv]?.label || 'Bloque'); return; }
    const grip = t.closest('[data-grip]');
    if (grip) { const b = blocks().find(x => x.id === grip.dataset.grip); if (b) dnd.begin(e, { blockId: b.id }, preview(b)); return; }
    const tb = t.closest('#float-toolbar [data-act="block-grip"]');
    if (tb && host.sel?.blockId) { const b = blocks().find(x => x.id === host.sel.blockId); if (b) dnd.begin(e, { blockId: b.id }, preview(b)); }
  });
  function updateBlock(id, fn) {
    if (!ext.canEdit()) return ext.denied();
    const list = blocks().map(b => { if (b.id !== id) return b; const fields = JSON.parse(JSON.stringify(b.fields)); fn(fields); return { ...b, fields }; });
    commit(list);
  }
  const preview = b => String(host.patch.texts?.[textId(b.id, 'title')] ?? b.fields.title ?? '').slice(0, 44) || BLOCK_META[b.type].label;

  async function pickProperty(id, slug) {
    if (!ext.canEdit()) return ext.denied();
    const p = properties().find(x => x.slug === slug); if (!p) return;
    let price = '';
    try { const cat = await import('/shared/catalog.js'); price = cat.formatPrice(p.price, p.currency, p.operation); } catch { price = p.price ? `$${Number(p.price).toLocaleString('es-MX')} ${p.currency || ''}`.trim() : ''; }
    const facts = [p.bedrooms ? `${p.bedrooms} recámara${p.bedrooms === 1 ? '' : 's'}` : '', p.bathrooms ? `${p.bathrooms} baño${p.bathrooms === 1 ? '' : 's'}` : '', p.areaM2 ? `${p.areaM2} m²` : '', p.lotM2 ? `${p.lotM2} m² de terreno` : ''].filter(Boolean).join(' · ');
    const list = blocks().map(b => {
      if (b.id !== id) return b;
      const fields = { ...b.fields, slug: p.slug, name: String(p.title).slice(0, 160), price: String(price).slice(0, 60), location: [p.zone, p.city].filter(Boolean).join(', ').slice(0, 160), facts: (facts || String(p.description || '')).slice(0, 200), imageSrc: p.images?.[0] || b.fields.imageSrc, imageAlt: String(p.title).slice(0, 300) };
      return { ...b, fields };
    });
    try { validateBlocks(list); } catch (error) { host.toast(error.message, true); return; }
    const texts = { ...(host.patch.texts || {}) }; for (const k of ['name', 'loc', 'price', 'facts']) delete texts[textId(id, k)];
    const images = { ...(host.patch.images || {}) }; delete images[`image-b-${id}-img`];
    const next = { ...host.patch, blocks: list }; if (Object.keys(texts).length) next.texts = texts; else delete next.texts; if (Object.keys(images).length) next.images = images; else delete next.images;
    if (host.replacePatch(next)) host.toast(`Propiedad «${p.title}» cargada en el bloque.`);
  }
  async function geocode(id) {
    const b = blocks().find(x => x.id === id); const q = String(b?.fields.address || '').trim();
    if (!q) { host.toast('Escribe una dirección para buscarla.', true); return; }
    host.toast('Buscando la dirección en OpenStreetMap…');
    try {
      const res = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q), { headers: { Accept: 'application/json' } });
      const list = await res.json();
      if (!list[0]) { host.toast('No se encontró esa dirección. Escribe las coordenadas a mano.', true); return; }
      updateBlock(id, f => { f.lat = Number(Number(list[0].lat).toFixed(6)); f.lng = Number(Number(list[0].lon).toFixed(6)); });
      host.toast('Dirección encontrada. El mapa se centró en ella.');
    } catch { host.toast('No se pudo consultar OpenStreetMap. Revisa tu conexión o escribe las coordenadas.', true); }
  }

  // ---------- HTML ----------
  const textInputs = b => blockSlots(b).texts.filter(s => s.value !== '').map(s => {
    const val = host.patch.texts?.[s.id] ?? s.value; const tag = s.multiline ? `<textarea data-f="bt-${esc(s.id)}" data-xi="blk:text" data-xv="${esc(s.id)}" maxlength="3000">${esc(val)}</textarea>` : `<input data-f="bt-${esc(s.id)}" data-xi="blk:text" data-xv="${esc(s.id)}" value="${esc(val)}" maxlength="300">`;
    return `<label class="field"><span>${esc(s.label)}</span>${tag}</label>`;
  }).join('');
  const imageControls = b => blockSlots(b).images.map(s => {
    const own = host.patch.images?.[s.id]; const src = own?.src || s.src; const alt = own?.alt ?? s.alt;
    const removable = ['gallery', 'team', 'logos'].includes(b.type) && (b.fields.items || []).length > Math.max(1, itemMin(b.type));
    const idx = Number(/^g(\d+)$/.exec(s.key)?.[1]);
    return `<div class="x-imgrow"><img src="${esc(src)}" alt="" loading="lazy"><div class="x-imgcol"><b>${esc(s.label)}</b><input data-f="ba-${esc(s.id)}" data-xi="blk:alt" data-xv="${esc(s.id)}" value="${esc(alt)}" maxlength="300" placeholder="Descripción de la imagen (alt)" aria-label="Descripción de ${esc(s.label)}"><div class="actions-row"><button type="button" class="button" data-x="blk:upload" data-xv="${esc(s.id)}">Subir</button><button type="button" class="button" data-x="blk:library" data-xv="${esc(s.id)}">Biblioteca</button>${removable ? `<button type="button" class="button" data-x="blk:item-del" data-xid="${esc(b.id)}" data-xv="${idx}" aria-label="Quitar ${esc(s.label)}">Quitar</button>` : ''}</div></div></div>`;
  }).join('');
  const sel = (b, key, options, value) => `<label class="field"><span>${esc(options.label)}</span><select data-xi="blk:field" data-xid="${esc(b.id)}" data-key="${key}">${options.items.map(([v, l]) => `<option value="${esc(v)}" ${String(value) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
  const num = (b, key, label, value, min, max, step = 1) => `<label class="field"><span>${esc(label)}</span><input type="number" data-xi="blk:field" data-xid="${esc(b.id)}" data-key="${key}" value="${esc(value ?? '')}" min="${Number(min)}" max="${Number(max)}" step="${Number(step)}"></label>`;
  const txt = (b, key, label, value, hint = '', type = 'text') => `<label class="field"><span>${esc(label)}</span><input type="${type}" data-xi="blk:field" data-xid="${esc(b.id)}" data-key="${key}" value="${esc(value ?? '')}" maxlength="500">${hint ? `<small>${esc(hint)}</small>` : ''}</label>`;
  const chk = (b, key, label, value) => `<label class="x-check"><input type="checkbox" data-xi="blk:field" data-xid="${esc(b.id)}" data-key="${key}" ${value ? 'checked' : ''}> ${esc(label)}</label>`;

  const properties = () => { try { return ext.data?.properties?.list?.() || []; } catch { return []; } };
  const listButtons = (b, plural) => {
    const type = b.type; const n = (b.fields.items || []).length; const [noun, last] = ITEM_LABEL[type] || ['elemento', 'el último'];
    const add = n < itemLimit(type) ? (type === 'richtext'
      ? `<div class="x-two"><button type="button" class="button" data-x="blk:item-add" data-xid="${esc(b.id)}" data-xv="p">Añadir párrafo</button><button type="button" class="button" data-x="blk:item-add" data-xid="${esc(b.id)}" data-xv="h3">Añadir subtítulo</button></div>`
      : `<button type="button" class="button full" data-x="blk:item-add" data-xid="${esc(b.id)}">Añadir ${esc(noun)}</button>`) : `<small class="muted">Máximo: ${itemLimit(type)} ${esc(plural || noun + 's')}.</small>`;
    const del = n > Math.max(1, itemMin(type)) && !['gallery', 'team', 'logos'].includes(type) ? `<button type="button" class="button full" data-x="blk:item-del" data-xid="${esc(b.id)}" data-xv="${n - 1}">Quitar ${esc(last)}</button>` : '';
    return add + del;
  };
  const subChk = (b, i, key, label, value) => `<label class="x-check"><input type="checkbox" data-xi="blk:sub" data-xid="${esc(b.id)}" data-item="${i}" data-key="${key}" ${value ? 'checked' : ''}> ${esc(label)}</label>`;
  const subTxt = (b, i, key, label, value, hint = '') => `<label class="field"><span>${esc(label)}</span><input type="text" data-xi="blk:sub" data-xid="${esc(b.id)}" data-item="${i}" data-key="${key}" value="${esc(value ?? '')}" maxlength="300">${hint ? `<small>${esc(hint)}</small>` : ''}</label>`;
  function propertyPicker(b) {
    const list = properties();
    if (!list.length) return `<div class="notice warning">Aún no hay propiedades en el inventario. Cárgalas en el panel «Propiedades» y vuelve aquí.</div><button type="button" class="button full" data-x="blk:seed-props">Cargar propiedades de ejemplo</button>`;
    return `<label class="field"><span>Propiedad</span><select data-xi="blk:prop" data-xid="${esc(b.id)}"><option value="">Elige una propiedad…</option>${list.map(p => `<option value="${esc(p.slug)}" ${p.slug === b.fields.slug ? 'selected' : ''}>${esc(p.title)}</option>`).join('')}</select><small>Los datos se copian al elegirla; vuelve a elegirla si cambian en el inventario. El botón lleva a /propiedades/?p=…</small></label>`;
  }
  function structure(b) {
    const f = b.fields;
    switch (b.type) {
      case 'textimage': return chk(b, 'reverse', 'Imagen a la izquierda', f.reverse) + chk(b, 'ctaLabel', 'Mostrar botón', !!f.ctaLabel) + (f.ctaLabel ? txt(b, 'ctaHref', 'Destino del botón', f.ctaHref, 'https://, mailto:, tel: o #ancla.') : '');
      case 'gallery': return sel(b, 'columns', { label: 'Columnas', items: [[1, '1'], [2, '2'], [3, '3'], [4, '4']] }, f.columns) + ((f.items || []).length < 8 ? `<button type="button" class="button full" data-x="blk:item-add" data-xid="${esc(b.id)}">Añadir imagen</button>` : '');
      case 'testimonials': case 'faq': case 'stats': case 'process': return listButtons(b);
      case 'team': case 'logos': return listButtons(b);
      case 'richtext': return listButtons(b, 'párrafos');
      case 'pricing': return listButtons(b, 'paquetes') + (f.items || []).map((it, i) => `<div class="x-sub"><b>Paquete ${i + 1}</b>${subChk(b, i, 'featured', 'Destacado (recomendado)', it.featured)}${chk2(b, i, it)}</div>`).join('');
      case 'hero': return sel(b, 'align', { label: 'Alineación', items: [['left', 'A la izquierda'], ['center', 'Centrado']] }, f.align) + chk(b, 'bgSrc', 'Imagen de fondo', !!f.bgSrc) + chk(b, 'ctaLabel', 'Mostrar botón', !!f.ctaLabel) + (f.ctaLabel ? txt(b, 'ctaHref', 'Destino del botón', f.ctaHref, 'https://, mailto:, tel: o #ancla.') : '');
      case 'beforeafter': return '<p class="hint">El deslizador se maneja con el ratón, el dedo o las flechas del teclado. Borra una etiqueta para ocultarla.</p>';
      case 'property': return propertyPicker(b) + chk(b, 'ctaLabel', 'Mostrar botón', !!f.ctaLabel);
      case 'newsletter': return txt(b, 'placeholder', 'Texto de ayuda del campo', f.placeholder) + txt(b, 'form', 'Nombre del formulario', f.form, 'Así lo verás en el CRM (Control → entradas).');
      case 'cta': return txt(b, 'href', 'Destino del botón', f.href, 'https://, mailto:, tel: o #ancla.');
      case 'contact': return txt(b, 'form', 'Nombre del formulario', f.form, 'Así lo verás en el CRM (Control → entradas).');
      case 'map': return txt(b, 'address', 'Dirección para buscar', f.address) + `<button type="button" class="button full" data-x="blk:geocode" data-xid="${esc(b.id)}">Buscar en OpenStreetMap</button>` + `<div class="x-two">${num(b, 'lat', 'Latitud', f.lat, -90, 90, 0.0001)}${num(b, 'lng', 'Longitud', f.lng, -180, 180, 0.0001)}</div>` + num(b, 'zoom', 'Zoom (3 a 19)', f.zoom, 3, 19);
      case 'video': return txt(b, 'url', 'URL https del video', f.url, 'YouTube, Vimeo o un archivo .mp4/.webm.', 'url');
      case 'catalog': return sel(b, 'mode', { label: 'Qué mostrar', items: [['catalog', 'Catálogo completo'], ['featured', 'Solo destacadas']] }, f.mode) + chk(b, 'filters', 'Mostrar filtros', f.filters) + num(b, 'limit', 'Tarjetas por página', f.limit, 1, 24) + sel(b, 'operation', { label: 'Operación', items: Object.entries(OPERATIONS) }, f.operation) + txt(b, 'type', 'Tipo (casa, villa, terreno…)', f.type) + txt(b, 'city', 'Ciudad', f.city);
      case 'spacer': return num(b, 'height', 'Altura en px', f.height, 8, 400);
      default: return '';
    }
  }
  const chk2 = (b, i, it) => subChk(b, i, 'ctaLabel', 'Mostrar botón', !!it.ctaLabel) + (it.ctaLabel ? subTxt(b, i, 'ctaHref', 'Destino del botón', it.ctaHref, 'https://, mailto:, tel: o #ancla.') : '');
  function row(b, i) {
    const open = openId === b.id;
    return `<div class="x-block ${open ? 'is-open' : ''}" data-block-row="${esc(b.id)}"><div class="x-block-head"><button type="button" class="x-grip" data-grip="${esc(b.id)}" aria-label="Arrastrar ${esc(preview(b))} para moverlo (o usa subir y bajar)" title="Arrastra para mover">${ext.icon('grip')}</button><button type="button" class="row-main" data-x="blk:view" data-xid="${esc(b.id)}"><span class="row-text">${esc(preview(b))}</span><span class="row-meta"><span class="tag">${esc(BLOCK_META[b.type].label)}</span>${esc(pointLabel(b.after))}</span></button><div class="x-actions"><button type="button" class="icon-btn" data-x="blk:up" data-xid="${esc(b.id)}" aria-label="Subir ${esc(preview(b))}" title="Subir">${ext.icon('up')}</button><button type="button" class="icon-btn" data-x="blk:down" data-xid="${esc(b.id)}" aria-label="Bajar ${esc(preview(b))}" title="Bajar">${ext.icon('down')}</button><button type="button" class="icon-btn" data-x="blk:dup" data-xid="${esc(b.id)}" aria-label="Duplicar ${esc(preview(b))}" title="Duplicar">${ext.icon('copy')}</button><button type="button" class="icon-btn" data-x="blk:del" data-xid="${esc(b.id)}" aria-label="Eliminar ${esc(preview(b))}" title="Eliminar">${ext.icon('trash')}</button></div></div><button type="button" class="x-toggle" data-x="blk:edit" data-xid="${esc(b.id)}" aria-expanded="${open}">${open ? 'Cerrar ajustes' : 'Ajustes y contenido'}</button>${open ? `<div class="x-block-body">${structure(b)}${imageControls(b)}${textInputs(b)}</div>` : ''}</div>`;
  }

  return {
    tab: { id: 'elements', label: 'Elementos', icon: 'blocks', eyebrow: 'BLOQUES LISTOS', title: 'Elementos', desc: 'Inserta secciones prediseñadas con tu estilo.', before: 'text' },
    render() {
      const t = target(); const pts = points(); const can = ext.canEdit() && host.inventory.blocksSupported !== false;
      const options = [...pts.map(p => [p.id, pointLabel(p.id)]), ['', pointLabel('')]];
      const q = query.trim().toLowerCase();
      const match = type => !q || `${BLOCK_META[type].label} ${BLOCK_META[type].desc}`.toLowerCase().includes(q);
      const groups = BLOCK_GROUPS.map(g => ({ ...g, types: g.types.filter(match) })).filter(g => g.types.length);
      const library = groups.map(g => `<h3 class="section-title x-group">${esc(g.label)} <span class="badge">${g.types.length}</span></h3><div class="x-grid" role="list">${g.types.map(type => `<button type="button" role="listitem" class="x-card" data-x="blk:insert" data-xv="${type}" title="${esc(BLOCK_META[type].desc)}" aria-label="${esc(BLOCK_META[type].label)}. ${esc(BLOCK_META[type].desc)} Haz clic para insertar o arrástralo al lienzo." ${can ? '' : 'disabled'}>${blockThumb(type)}<b>${esc(BLOCK_META[type].label)}</b><span>${esc(BLOCK_META[type].desc)}</span></button>`).join('')}</div>`).join('') || '<div class="empty-state">Ningún elemento coincide con tu búsqueda.</div>';
      return `${host.inventory.blocksSupported === false ? '<div class="notice warning">Esta plantilla controla el scroll por su cuenta (la página no crece con el contenido), así que no admite bloques insertados. Las demás funciones siguen disponibles.</div>' : ''}<div class="notice">Arrastra un elemento al lienzo y suéltalo donde marca la línea verde, o haz clic para insertarlo. Los bloques toman los colores y las tipografías de la plantilla y solo se colocan en lugares seguros.</div>
      <div class="search-field x-search">${ext.icon('search')}<label class="sr" for="x-blk-search">Buscar elementos</label><input id="x-blk-search" type="search" data-f="blk-search" data-xi="blk:search" placeholder="Buscar elementos: equipo, precios, mapa…" value="${esc(query)}" autocomplete="off"></div>
      <label class="field"><span>Dónde se inserta</span><select data-xi="blk:target" aria-label="Dónde se inserta el bloque">${options.map(([v, l]) => `<option value="${esc(v)}" ${t === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select><small>${chosen === null ? 'Automático: sigue a lo que seleccionas en el lienzo.' : 'Posición elegida a mano.'} Vale al hacer clic o con el teclado; al arrastrar, manda la línea verde. ${pts.length ? '' : 'Esta plantilla no tiene puntos intermedios seguros: los bloques van antes del pie de página.'}</small></label>
      ${library}
      <h3 class="section-title">Bloques en tu página <span class="badge">${blocks().length}</span></h3>
      ${blocks().length ? `<div class="x-blocks">${blocks().map(row).join('')}</div>` : '<div class="empty-state">Aún no hay bloques. Arrastra uno al lienzo.</div>'}
      <p class="hint">Para reordenar, arrastra el asa de cada bloque (o su botón «Mover» en la barra flotante) hasta la línea verde, o usa subir y bajar. No se reordenan las secciones de la plantilla: protege su scroll y animaciones.</p>`;
    },
    click(act, b) {
      const id = b.dataset.xid;
      if (act === 'insert') return insert(b.dataset.xv);
      if (act === 'view') { host.send('navigate', { id: 'section:blk-' + id }); return; }
      if (act === 'edit') { openId = openId === id ? null : id; host.renderPanel(); return; }
      if (!ext.canEdit()) { ext.denied(); return; }
      if (act === 'up' || act === 'down') { commit(moveBlock(blocks(), id, act === 'up' ? -1 : 1, points().map(p => p.id)), id); return; }
      if (act === 'dup') { const r = duplicateBlock(host.patch, id); if (r.id && host.replacePatch(r.patch)) { pendingSelect = 'section:blk-' + r.id; openId = r.id; host.renderPanel(); ext.audit('Bloque duplicado', host.project.name); } return; }
      if (act === 'del') { this.remove(id); return; }
      if (act === 'item-add') {
        const type = blocks().find(x => x.id === id)?.type; if (!type) return;
        updateBlock(id, f => {
          if (f.items.length >= itemLimit(type)) return;
          const item = newItem(type, f.items.length, b.dataset.xv || '');
          if (item) f.items = [...f.items, item];
        });
        return;
      }
      if (act === 'seed-props') { try { const n = ext.data.properties.seedDemo(); host.toast(`${n} propiedades de ejemplo cargadas.`); host.renderPanel(); } catch (e) { host.toast(e.message, true); } return; }
      if (act === 'item-del') { const cur = blocks().find(x => x.id === id); if (cur && (cur.fields.items || []).length <= Math.max(1, itemMin(cur.type))) { host.toast('Este bloque necesita al menos ' + Math.max(1, itemMin(cur.type)) + ' elemento(s).', true); return; } const next = removeBlockItem(host.patch, id, Number(b.dataset.xv)); try { validateBlocks(next.blocks); } catch (e) { host.toast(e.message, true); return; } host.replacePatch(next); return; }
      if (act === 'geocode') { geocode(id); return; }
      if (act === 'upload') { host.pickUpload(b.dataset.xv); return; }
      if (act === 'library') { ext.mods.lib.pick(b.dataset.xv); return; }
    },
    input(act, el) {
      if (act === 'search') { query = el.value; host.renderPanel(); return; }
      if (!ext.canEdit()) return;
      if (act === 'text') host.update('texts', el.dataset.xv, el.value);
      else if (act === 'alt') host.setImage(el.dataset.xv, { alt: el.value });
    },
    change(act, el) {
      if (act === 'target') { chosen = el.value === '' || points().some(p => p.id === el.value) ? el.value : null; host.renderPanel(); return; }
      if (act === 'sub') {
        const id = el.dataset.xid; const i = Number(el.dataset.item); const key = el.dataset.key; const type = blocks().find(x => x.id === id)?.type;
        if (!type || !Number.isInteger(i)) return;
        let value = el.type === 'checkbox' ? el.checked : el.value;
        if (key === 'ctaLabel') value = value ? 'Elegir' : '';
        updateBlock(id, f => { if (f.items[i]) f.items[i][key] = value; });
        return;
      }
      if (act === 'prop') { pickProperty(el.dataset.xid, el.value); return; }
      if (act !== 'field') return;
      const key = el.dataset.key; const id = el.dataset.xid; const spec = BLOCK_TYPES[blocks().find(x => x.id === id)?.type]?.fields[key]; if (!spec) return;
      let value;
      if (el.type === 'checkbox') value = el.checked;
      else if (['int', 'num'].includes(spec[0])) value = el.value === '' && spec[0] === 'num' ? null : Number(el.value);
      else value = el.value;
      if (key === 'ctaLabel') value = value ? (blocks().find(x => x.id === id)?.type === 'property' ? 'Ver la propiedad' : 'Conocer más') : '';
      if (key === 'bgSrc' && el.type === 'checkbox') value = el.checked ? DEMO_IMG[3] : '';
      if (spec[0] === 'int' && Number.isFinite(value)) value = Math.round(value);
      updateBlock(id, f => { f[key] = spec[0] === 'int' && key === 'columns' ? Number(value) : value; });
    },
    remove(id) {
      if (!ext.canEdit()) return ext.denied();
      const b = blocks().find(x => x.id === id); if (!b) return;
      if (host.replacePatch(removeBlock(host.patch, id))) { if (openId === id) openId = null; host.toast(`Eliminaste «${preview(b)}».`, false, { label: 'Deshacer', run: host.undo }); }
    },
    insert, // lo usa el panel Propiedades
    message(m) {
      dnd.message(m);
      if (m.type !== 'applied') return;
      if (pendingSelect && (m.placed || []).some(id => 'section:blk-' + id === pendingSelect)) { host.send('navigate', { id: pendingSelect }); pendingSelect = null; }
      for (const issue of m.issues || []) if (!toasted.has(issue.id)) { toasted.add(issue.id); host.toast(issue.reason); }
    }
  };
}
