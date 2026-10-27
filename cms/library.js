// Biblioteca de medios: hash para evitar duplicados, dónde se usa cada imagen y filtros. Funciones puras.
export async function hashString(text) {
  const bytes = new TextEncoder().encode(String(text));
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 0x811c9dc5; for (const b of bytes) { h ^= b; h = Math.imul(h, 0x01000193); }
  return 'f' + (h >>> 0).toString(16).padStart(8, '0') + bytes.length.toString(16);
}
export function mediaEntry({ hash, name = 'Imagen', src, width = 0, height = 0, bytes = 0, storedBytes = 0, type = '', hasAlpha, logo = false, alt = '', now = new Date() }) {
  return { id: hash, name: String(name).slice(0, 300), src, width, height, bytes, storedBytes: storedBytes || Math.floor((src.length - src.indexOf(',') - 1) * 0.75), type, hasAlpha, logo: !!logo, alt: String(alt).slice(0, 300), createdAt: now.toISOString() };
}
// Todos los lugares del parche donde aparece esta imagen.
export function usageOf(patch = {}, src, labels = {}) {
  const used = [];
  if (!src) return used;
  const label = (kind, id) => labels[id] || ({ image: 'Imagen', logo: 'Logo', poster: 'Portada de video', seo: 'SEO', block: 'Bloque' }[kind] || kind);
  for (const [id, v] of Object.entries(patch.images || {})) if (v?.src === src) used.push({ kind: 'image', id, label: label('image', id) });
  if (patch.brand?.logo === src) used.push({ kind: 'logo', id: 'brandLogo', label: 'Logo de la marca' });
  for (const key of ['favicon', 'ogImage']) if (patch.seo?.[key] === src) used.push({ kind: 'seo', id: key, label: key === 'favicon' ? 'Favicon' : 'Imagen al compartir' });
  for (const [id, v] of Object.entries(patch.videos || {})) if (v?.poster === src) used.push({ kind: 'poster', id, label: label('poster', id) });
  for (const b of patch.blocks || []) {
    const f = b.fields || {};
    if (f.imageSrc === src || (f.items || []).some(i => i?.src === src)) used.push({ kind: 'block', id: b.id, label: `Bloque «${b.type}»` });
  }
  return used;
}
export function usedSources(patch = {}) {
  const set = new Set();
  for (const v of Object.values(patch.images || {})) if (v?.src) set.add(v.src);
  if (patch.brand?.logo) set.add(patch.brand.logo);
  for (const key of ['favicon', 'ogImage']) if (patch.seo?.[key]) set.add(patch.seo[key]);
  for (const v of Object.values(patch.videos || {})) if (v?.poster) set.add(v.poster);
  for (const b of patch.blocks || []) { const f = b.fields || {}; if (f.imageSrc) set.add(f.imageSrc); for (const i of f.items || []) if (i?.src) set.add(i.src); }
  return set;
}
export function sizeClass(item) { const m = Math.max(item.width || 0, item.height || 0); return m < 900 ? 'small' : m < 2000 ? 'medium' : 'large'; }
export const LIB_TYPES = [['photo', 'Fotos'], ['logo', 'Logos']];
export const LIB_SIZES = [['small', 'Pequeñas'], ['medium', 'Medianas'], ['large', 'Grandes']];
export const LIB_USAGE = [['used', 'En uso'], ['unused', 'Sin usar']];
export function filterLibrary(items = [], patch = {}, { q = '', type = '', size = '', usage = '', noAlt = false } = {}) {
  const needle = String(q).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const used = usedSources(patch);
  return items.filter(it => {
    if (type === 'logo' && !it.logo) return false;
    if (type === 'photo' && it.logo) return false;
    if (size && sizeClass(it) !== size) return false;
    if (usage === 'used' && !used.has(it.src)) return false;
    if (usage === 'unused' && used.has(it.src)) return false;
    if (noAlt && String(it.alt || '').trim()) return false;
    if (needle && !`${it.name} ${it.alt}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(needle)) return false;
    return true;
  }).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}
export function canDelete(item, patch) { return !usedSources(patch).has(item.src); }
export const humanBytes = n => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
