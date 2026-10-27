// Estructura de la plantilla: secciones propias (duplicar, quitar, reordenar), elementos repetidos (tarjetas, menús, galerías…),
// estilo por sección y estilo de botones. Funciones puras: el bridge las usa para aplicar, el editor para armar el patch y las pruebas
// para validar. Todo lo que llega aquí se valida con listas blancas estrictas (nada de CSS, HTML ni url() libres).

import { CLONE_ID_RE, LIST_ID_RE, ITEM_ID_RE, PAD_STEPS, RADIUS_STEPS, MAX_CLONES, imageSrcOK, baseId, rebaseId, sectionCloneId, itemCloneId, itemList, validateLayout, validateItems, validateSectionStyles, validateButtons } from './core.js';
export { CLONE_ID_RE, LIST_ID_RE, ITEM_ID_RE, PAD_STEPS, RADIUS_STEPS, MAX_CLONES, imageSrcOK, baseId, rebaseId, sectionCloneId, itemCloneId, itemList, validateLayout, validateItems, validateSectionStyles, validateButtons };

const FORBIDDEN = ['__proto__', 'prototype', 'constructor'];

// ---------- identificadores ----------
export function newCloneId(existing = new Set(), rnd = Math.random) {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  for (let n = 0; n < 50; n++) {
    let id = letters[Math.floor(rnd() * 26)];
    for (let i = 0; i < 6; i++) id += Math.floor(rnd() * 36).toString(36);
    if (!existing.has(id)) return id;
  }
  throw new Error('No se pudo generar un identificador único.');
}

// ---------- orden ----------
// Orden por defecto: los originales en su orden de origen y cada copia justo después de su origen.
export function defaultSequence(originals, clones = []) {
  const seq = [...originals];
  for (const c of clones) { const i = seq.indexOf(c.of); if (i >= 0 && !seq.includes(c.id)) seq.splice(i + 1, 0, c.id); }
  return seq;
}
// `order` ocupa los lugares de los elementos que lista; lo que no se lista conserva su sitio. Ignora ids que ya no existen.
export function resolveSequence(def, order = []) {
  const present = new Set(def); const listed = []; const seen = new Set();
  for (const id of order) if (present.has(id) && !seen.has(id)) { seen.add(id); listed.push(id); }
  const out = [...def]; let k = 0;
  for (let i = 0; i < out.length; i++) if (seen.has(out[i])) out[i] = listed[k++];
  return out;
}
export const sameSequence = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
// Mueve un id una posición (dir = -1 sube, +1 baja) dentro de la secuencia visible; devuelve null si ya está en el extremo.
export function moveInSequence(seq, id, dir) {
  const i = seq.indexOf(id); const j = i + dir;
  if (i < 0 || j < 0 || j >= seq.length) return null;
  const out = [...seq]; [out[i], out[j]] = [out[j], out[i]]; return out;
}
export function moveToIndex(seq, id, to) {
  const i = seq.indexOf(id); if (i < 0) return null;
  const t = Math.max(0, Math.min(seq.length - 1, to)); if (t === i) return null;
  const out = [...seq]; out.splice(i, 1); out.splice(t, 0, id); return out;
}

// ---------- operaciones sobre el patch ----------
const COPY_AREAS = ['texts', 'images', 'videos', 'links', 'styles', 'hidden', 'buttons', 'mediaMeta'];
const clone = v => JSON.parse(JSON.stringify(v));
function withArea(patch, area, fn) {
  const next = { ...(patch[area] || {}) }; fn(next);
  const out = { ...patch };
  if (Array.isArray(next) ? next.length : Object.keys(next).length) out[area] = next; else delete out[area];
  return out;
}
// Copia las ediciones de los elementos de la original a los de la copia (la copia empieza igual y luego se edita por separado).
export function copyEntries(patch, pairs) {
  let out = { ...patch };
  for (const area of COPY_AREAS) {
    const src = patch[area]; if (!src) continue;
    const add = {};
    for (const [from, to] of pairs) if (Object.hasOwn(src, from)) add[to] = clone(src[from]);
    if (Object.keys(add).length) out[area] = { ...src, ...add };
  }
  const en = patch.i18n?.en;
  if (en) {
    const add = {};
    for (const [from, to] of pairs) if (Object.hasOwn(en, from)) add[to] = en[from];
    if (Object.keys(add).length) out.i18n = { ...patch.i18n, en: { ...en, ...add } };
  }
  return out;
}
const tokens = key => String(key).split(/[~:]/);
// Quita todo lo que pertenece a una copia (textos, imágenes, estilos…) cuando se elimina.
export function purgeCloneKeys(patch, cloneId) {
  const has = key => tokens(key).includes(cloneId);
  let out = { ...patch };
  for (const area of [...COPY_AREAS, 'sectionStyles', 'items', 'sequences']) {
    if (!out[area]) continue;
    const next = {}; let changed = false;
    for (const [k, v] of Object.entries(out[area])) { if (has(k)) changed = true; else next[k] = v; }
    if (changed) { if (Object.keys(next).length) out[area] = next; else delete out[area]; }
  }
  if (out.i18n?.en) {
    const en = {}; let changed = false;
    for (const [k, v] of Object.entries(out.i18n.en)) { if (has(k)) changed = true; else en[k] = v; }
    if (changed) out.i18n = { ...out.i18n, en };
  }
  // Los pares dentro de items/layout que mencionan la copia también salen.
  if (out.items) {
    const items = {};
    for (const [listId, spec] of Object.entries(out.items)) {
      const s = { ...spec };
      for (const k of ['order', 'removed']) if (s[k]) { s[k] = s[k].filter(id => !has(id)); if (!s[k].length) delete s[k]; }
      if (s.clones) { s.clones = s.clones.filter(c => c.id !== cloneId && !has(c.of)); if (!s.clones.length) delete s.clones; }
      if (Object.keys(s).length) items[listId] = s;
    }
    if (Object.keys(items).length) out.items = items; else delete out.items;
  }
  return out;
}

function setLayout(patch, layout) {
  const l = { ...layout };
  for (const k of ['order', 'removed', 'clones']) if (l[k] && !l[k].length) delete l[k];
  const out = { ...patch };
  if (Object.keys(l).length) out.layout = l; else delete out.layout;
  return out;
}
function setItems(patch, listId, spec) {
  const s = { ...spec };
  for (const k of ['order', 'removed', 'clones']) if (s[k] && !s[k].length) delete s[k];
  const items = { ...(patch.items || {}) };
  if (Object.keys(s).length) items[listId] = s; else delete items[listId];
  const out = { ...patch };
  if (Object.keys(items).length) out.items = items; else delete out.items;
  return out;
}
const allCloneIds = patch => {
  const ids = new Set((patch.layout?.clones || []).map(c => c.id));
  for (const spec of Object.values(patch.items || {})) for (const c of spec.clones || []) ids.add(c.id);
  return ids;
}
export { allCloneIds };

// Duplicar una sección. `sequence` es el orden actual de su grupo en pantalla; `elementIds` los ids de sus textos, imágenes… (para copiar su contenido).
export function duplicateSection(patch, { of, cloneId, sequence, elementIds = [], sectionStyle = null }) {
  const entry = { id: cloneId, of, after: of };
  const newId = sectionCloneId(entry);
  const layout = { ...(patch.layout || {}) };
  layout.clones = [...(layout.clones || []), entry];
  const seq = (sequence && sequence.length ? [...sequence] : [of]);
  const at = seq.indexOf(of); seq.splice(at >= 0 ? at + 1 : seq.length, 0, newId);
  layout.order = seq;
  let out = setLayout(patch, layout);
  const pairs = elementIds.map(id => [id, rebaseId(id, cloneId)]);
  pairs.push(['section:' + of, 'section:' + newId]);
  out = copyEntries(out, pairs);
  const style = sectionStyle ?? patch.sectionStyles?.[of];
  if (style) out.sectionStyles = { ...(out.sectionStyles || {}), [newId]: clone(style) };
  return { patch: out, id: newId };
}
// Quitar una sección: una copia se elimina del todo; una original se marca como quitada (se puede restaurar).
export function removeSection(patch, { id, cloneId = null }) {
  if (cloneId) {
    const dependents = (patch.layout?.clones || []).filter(c => baseId(c.of) === baseId(id) && c.of === id).map(c => c.id);
    let out = patch;
    for (const dep of dependents) out = purgeCloneKeys(out, dep);
    out = purgeCloneKeys(out, cloneId);
    const layout = { ...(out.layout || {}) };
    const gone = new Set([cloneId, ...dependents]);
    const goneFull = new Set((patch.layout?.clones || []).filter(c => gone.has(c.id)).map(sectionCloneId));
    layout.clones = (layout.clones || []).filter(c => !gone.has(c.id));
    layout.order = (layout.order || []).filter(x => !goneFull.has(x));
    layout.removed = (layout.removed || []).filter(x => !goneFull.has(x));
    return setLayout(out, layout);
  }
  const layout = { ...(patch.layout || {}) };
  layout.removed = [...new Set([...(layout.removed || []), id])];
  return setLayout(patch, layout);
}
export function restoreSection(patch, id) {
  const layout = { ...(patch.layout || {}) };
  layout.removed = (layout.removed || []).filter(x => x !== id);
  return setLayout(patch, layout);
}
export function setSectionOrder(patch, sequence) {
  return setLayout(patch, { ...(patch.layout || {}), order: [...sequence] });
}

export function duplicateItem(patch, { listId, of, cloneId, sequence, elementIds = [] }) {
  const spec = { ...(patch.items?.[listId] || {}) };
  const entry = { id: cloneId, of };
  spec.clones = [...(spec.clones || []), entry];
  const newId = itemCloneId(listId, entry);
  const seq = [...(sequence || [of])]; const at = seq.indexOf(of); seq.splice(at >= 0 ? at + 1 : seq.length, 0, newId);
  spec.order = seq;
  let out = setItems(patch, listId, spec);
  out = copyEntries(out, elementIds.map(id => [id, rebaseId(id, cloneId)]));
  return { patch: out, id: newId };
}
export function removeItem(patch, { listId, itemId }) {
  const spec = { ...(patch.items?.[listId] || {}) };
  const suffix = itemId.slice(listId.length + 1);
  if (!/^\d+$/.test(suffix)) {
    // Es una copia: se borra con todo lo suyo (y las copias que salieron de ella).
    const dependents = (spec.clones || []).filter(c => c.of === itemId).map(c => c.id);
    let out = patch;
    for (const dep of dependents) out = purgeCloneKeys(out, dep);
    return purgeCloneKeys(out, suffix);
  }
  spec.removed = [...new Set([...(spec.removed || []), itemId])];
  return setItems(patch, listId, spec);
}
export function restoreItem(patch, { listId, itemId }) {
  const spec = { ...(patch.items?.[listId] || {}) };
  spec.removed = (spec.removed || []).filter(x => x !== itemId);
  return setItems(patch, listId, spec);
}
export function setItemOrder(patch, listId, sequence) {
  return setItems(patch, listId, { ...(patch.items?.[listId] || {}), order: [...sequence] });
}
// Cuántos cambios de estructura hay (para el contador de «Diseño»).
export function structureEdits(patch = {}) {
  let n = (patch.layout?.clones?.length || 0) + (patch.layout?.removed?.length || 0) + (patch.layout?.order ? 1 : 0);
  for (const s of Object.values(patch.items || {})) n += (s.clones?.length || 0) + (s.removed?.length || 0) + (s.order ? 1 : 0);
  return n + Object.keys(patch.sectionStyles || {}).length + Object.keys(patch.buttons || {}).length;
}
