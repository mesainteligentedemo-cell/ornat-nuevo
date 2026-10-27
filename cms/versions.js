// Historial de versiones: resumen de cambios, cuándo sacar una copia automática, poda y restauración. Funciones puras.
import { validatePatch } from './core.js';
const COUNT_AREAS = [
  ['texts', 'texto', 'textos'], ['images', 'imagen', 'imágenes'], ['videos', 'video', 'videos'], ['styles', 'estilo', 'estilos'],
  ['colors', 'color', 'colores'], ['links', 'enlace', 'enlaces'], ['hidden', 'elemento oculto', 'elementos ocultos']
];
const stable = value => JSON.stringify(value, (key, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v));
export const fingerprint = patch => { const s = stable(patch || {}); let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return `${(h >>> 0).toString(36)}-${s.length}`; };

// Cuántos elementos distintos o modificados hay entre dos parches (por área).
export function diffPatch(prev = {}, next = {}) {
  const out = {};
  for (const [area] of COUNT_AREAS) {
    const a = prev[area] || {}, b = next[area] || {}; let n = 0;
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) if (stable(a[key]) !== stable(b[key])) n++;
    if (n) out[area] = n;
  }
  const blocksPrev = new Map((prev.blocks || []).map(b => [b.id, stable(b)])); const blocksNext = new Map((next.blocks || []).map(b => [b.id, stable(b)]));
  let blocks = 0; for (const id of new Set([...blocksPrev.keys(), ...blocksNext.keys()])) if (blocksPrev.get(id) !== blocksNext.get(id)) blocks++;
  if (blocks) out.blocks = blocks;
  const enPrev = prev.i18n?.en || {}, enNext = next.i18n?.en || {}; let tr = 0;
  for (const key of new Set([...Object.keys(enPrev), ...Object.keys(enNext)])) if (enPrev[key] !== enNext[key]) tr++;
  if (tr) out.translations = tr;
  for (const area of ['brand', 'seo', 'legal', 'typography', 'pages']) if (stable(prev[area]) !== stable(next[area])) out[area] = 1;
  return out;
}
const LABEL = { brand: 'marca', seo: 'SEO', legal: 'textos legales', typography: 'tipografía', pages: 'SEO de páginas', blocks: ['bloque', 'bloques'], translations: ['traducción', 'traducciones'] };
export function describeDiff(diff = {}) {
  const parts = [];
  for (const [area, one, many] of COUNT_AREAS) if (diff[area]) parts.push(`${diff[area]} ${diff[area] === 1 ? one : many}`);
  if (diff.blocks) parts.push(`${diff.blocks} ${diff.blocks === 1 ? 'bloque' : 'bloques'}`);
  if (diff.translations) parts.push(`${diff.translations} ${diff.translations === 1 ? 'traducción' : 'traducciones'}`);
  for (const area of ['brand', 'seo', 'legal', 'typography', 'pages']) if (diff[area]) parts.push(LABEL[area]);
  return parts.length ? parts.join(', ') : 'Sin cambios';
}
// Qué contiene un parche (no lo que cambió): sirve para describir una versión sola.
export function summarizePatch(patch = {}) { return describeDiff(diffPatch({}, patch)); }

export function shouldSnapshot({ changes = 0, lastAt = 0, now = Date.now(), everyChanges = 10, everyMs = 120000 } = {}) {
  if (changes <= 0) return false;
  return changes >= everyChanges || now - lastAt >= everyMs;
}
export function makeVersion({ projectId, patch, author = 'invitado', name = '', auto = true, prev = {}, now = new Date(), id }) {
  const diff = diffPatch(prev, patch);
  return { id: id || `${projectId}:${now.getTime().toString(36)}:${Math.random().toString(36).slice(2, 6)}`, projectId, at: now.toISOString(), author, name: String(name).slice(0, 80), auto, patch, diff, summary: describeDiff(diff), fingerprint: fingerprint(patch), bytes: new TextEncoder().encode(JSON.stringify(patch)).byteLength };
}
// Conserva siempre las versiones con nombre; elimina las automáticas más antiguas hasta quedar en `max`.
export function pruneVersions(list = [], max = 30) {
  const limit = Math.max(1, Math.floor(max));
  const sorted = [...list].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  if (sorted.length <= limit) return { keep: sorted, drop: [] };
  const keep = [], drop = [];
  let room = limit;
  for (const v of sorted) if (!v.auto) { keep.push(v); room--; }
  for (const v of sorted) { if (v.auto) { if (room > 0) { keep.push(v); room--; } else drop.push(v); } }
  keep.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return { keep, drop };
}
export function restorePatch(version) {
  if (!version?.patch || typeof version.patch !== 'object') throw new Error('Esta versión no tiene datos para restaurar.');
  // Lo guardado en IndexedDB no es de confianza: se valida con la misma lista blanca que al importar un proyecto.
  return validatePatch(JSON.parse(JSON.stringify(version.patch)));
}
export function totalBytes(list = []) { return list.reduce((sum, v) => sum + (v.bytes || 0), 0); }
export function spaceWarning({ usage, quota, versionsBytes = 0 } = {}) {
  if (!quota) return null;
  const ratio = usage / quota;
  if (ratio >= 0.8) return `El almacenamiento del navegador está al ${Math.round(ratio * 100)}%. Borra versiones antiguas o descarga una copia del proyecto.`;
  if (versionsBytes > 40 * 1024 * 1024) return 'Tus versiones ocupan mucho espacio. Reduce el límite o bórralas.';
  return null;
}
