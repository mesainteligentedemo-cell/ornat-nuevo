// Español / inglés. El parche guarda el español en patch.texts (o el texto original de la plantilla) y el inglés en
// patch.i18n.en[id]. Funciones puras para el panel «Idiomas», la lista de faltantes y las etiquetas hreflang.
import { isHidden } from './filters.js';

export const LANGS = { es: 'Español', en: 'English' };

export function i18nEnabled(patch = {}) { return !!patch.i18n?.enabled || Object.keys(patch.i18n?.en || {}).length > 0; }
export function enableI18n(patch = {}) { return { ...patch, i18n: { ...(patch.i18n || {}), enabled: true } }; }
export function translationOf(patch = {}, id) { return patch.i18n?.en?.[id]; }

// value vacío elimina la traducción de ese texto.
export function setTranslation(patch = {}, id, value) {
  const en = { ...(patch.i18n?.en || {}) };
  const text = String(value ?? '');
  if (text.trim()) en[id] = text; else delete en[id];
  return { ...patch, i18n: { ...(patch.i18n || {}), enabled: true, en } };
}
export function removeTranslation(patch = {}, id) {
  const en = { ...(patch.i18n?.en || {}) }; delete en[id];
  return { ...patch, i18n: { ...(patch.i18n || {}), en } };
}

// Textos sueltos como «2026», «+52 55 1234», un correo o una URL no necesitan traducción.
export function isTranslatable(text) {
  const t = String(text ?? '').trim();
  if (t.length < 2) return false;
  if (!/\p{L}{2,}/u.test(t)) return false;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) || /^https?:\/\//i.test(t)) return false;
  return true;
}

// Unidades de traducción: un bloque de varias piezas animadas cuenta como un solo texto.
export function translationUnits(texts = [], patch = {}) {
  const units = []; const byBlock = new Map();
  for (const t of texts) {
    if (t.dynamic) continue;
    const key = t.block || t.id;
    const piece = patch.texts?.[t.id] ?? t.text;
    if (byBlock.has(key)) { const u = byBlock.get(key); u.pieces.push(piece); u.ids.push(t.id); continue; }
    const unit = { id: key, ids: [t.id], pieces: [piece], section: t.section, hidden: isHidden(patch, t.id, t.section, t.block), block: !!t.block, type: t.type };
    byBlock.set(key, unit); units.push(unit);
  }
  for (const u of units) {
    u.source = (u.block && patch.texts?.[u.id] !== undefined ? patch.texts[u.id] : u.pieces.join(' ')).replace(/\s+/g, ' ').trim();
    u.translation = patch.i18n?.en?.[u.id] ?? '';
  }
  return units.filter(u => u.source);
}
export function translatableUnits(texts, patch) { return translationUnits(texts, patch).filter(u => !u.hidden && isTranslatable(u.source)); }
export function missingUnits(texts, patch) { return translatableUnits(texts, patch).filter(u => !u.translation.trim()); }
export function translationStats(texts, patch) {
  const all = translatableUnits(texts, patch); const done = all.filter(u => u.translation.trim()).length;
  return { total: all.length, done, missing: all.length - done, pct: all.length ? Math.round(done / all.length * 100) : 100 };
}
export function filterUnits(units, { q = '', missing = false, section = '' } = {}) {
  const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const needle = norm(q.trim());
  return units.filter(u => (!missing || !u.translation.trim()) && (!section || String(u.section) === String(section)) && (!needle || norm(u.source).includes(needle) || norm(u.translation).includes(needle)));
}

export function hreflangLinks(canonical, enabled) {
  if (!enabled || !/^https?:\/\//i.test(String(canonical || ''))) return [];
  let u; try { u = new URL(canonical); } catch { return []; }
  const es = u.href; const en = new URL(u.href); en.searchParams.set('lang', 'en');
  return [{ hreflang: 'es', href: es }, { hreflang: 'en', href: en.href }, { hreflang: 'x-default', href: es }];
}
export function pickLanguage(search = '', stored = '', fallback = 'es') {
  const q = new URLSearchParams(search).get('lang');
  if (q === 'es' || q === 'en') return q;
  return stored === 'es' || stored === 'en' ? stored : fallback;
}
