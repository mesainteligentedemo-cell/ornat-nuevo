// Kit de marca: logos + paleta + fuentes reutilizables entre proyectos. Aplicarlo a un proyecto lo traduce al parche
// (brand.logo, brand.name, colors, typography). El mapeo de colores es por el nombre de cada variable CSS de la plantilla.
export const KIT_FONTS = ['Inter', 'Arial', 'Georgia', 'Times New Roman', 'system-ui'];
export const KIT_ROLES = [['accent', 'Acento'], ['background', 'Fondo'], ['text', 'Texto'], ['secondary', 'Secundario']];
const HEX = /^#(?:[a-f\d]{3}|[a-f\d]{6})$/i;
const imageOK = v => typeof v === 'string' && (/^data:image\/(?:png|jpeg|webp|avif);base64,[A-Za-z0-9+/]*={0,2}$/i.test(v) || /^https:\/\/[^\s"'<>\\]+$/i.test(v) || /^\/(?!\/)[^\s"'<>\\]*$/.test(v));
export const normHex = v => { const s = String(v || '').trim().toLowerCase(); if (!HEX.test(s)) return null; return s.length === 4 ? '#' + [...s.slice(1)].map(c => c + c).join('') : s; };

export function newKit({ name = 'Mi marca', brandName = '', logos = [], colors = {}, fonts = {}, id, now = new Date() } = {}) {
  return validateKit({ id: id || `kit-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, name, brandName, logos, colors, fonts, createdAt: now.toISOString(), updatedAt: now.toISOString() });
}
export function validateKit(kit) {
  if (!kit || typeof kit !== 'object') throw new Error('El kit de marca no es válido.');
  const name = String(kit.name ?? '').trim();
  if (!name || name.length > 80) throw new Error('El kit necesita un nombre de hasta 80 caracteres.');
  const logos = (kit.logos || []).slice(0, 4).map(l => ({ name: String(l?.name || 'Logo').slice(0, 120), src: l?.src }));
  for (const l of logos) if (!imageOK(l.src)) throw new Error('Un logo del kit no es una imagen válida (PNG, JPEG, WebP, AVIF o URL https).');
  const colors = {};
  for (const [role] of KIT_ROLES) { if (kit.colors?.[role] === undefined || kit.colors[role] === '') continue; const hex = normHex(kit.colors[role]); if (!hex) throw new Error(`El color «${role}» debe ser hexadecimal (#RGB o #RRGGBB).`); colors[role] = hex; }
  const swatches = (kit.swatches || []).slice(0, 8).map(normHex).filter(Boolean);
  const fonts = {};
  for (const key of ['heading', 'body']) { const f = kit.fonts?.[key]; if (!f) continue; if (!KIT_FONTS.includes(f)) throw new Error('Una fuente del kit no está disponible.'); fonts[key] = f; }
  return { id: String(kit.id), name, brandName: String(kit.brandName || '').trim().slice(0, 80), logos, colors, swatches, fonts, createdAt: kit.createdAt || new Date().toISOString(), updatedAt: kit.updatedAt || new Date().toISOString() };
}

export function colorRole(key) {
  const k = String(key || '').replace(/^--/, '').toLowerCase();
  if (/^(or|accent\d?|lime|gold|brand|primary|main|content--brand|goldd)$/.test(k) || /accent|brand/.test(k)) return 'accent';
  if (/^(bg|bg1|background|paper|cream|base|ivory|sand|linen)$/.test(k)) return 'background';
  if (/^(ink|text|fg|content--primary|foreground)$/.test(k)) return 'text';
  if (/^(soft|muted|mute|ink2|secondary|content--secondary|stone|line)$/.test(k)) return 'secondary';
  return null;
}
export function mapKitToColors(kit, colorKeys = []) {
  const out = {};
  for (const key of colorKeys) { const role = colorRole(key); const hex = role && kit.colors?.[role]; if (hex) out[key] = hex; }
  return out;
}
// Kit tomado del proyecto actual: logo, nombre de marca, colores de los roles que existan y fuentes globales.
export function kitFromPatch(patch = {}, colorEntries = [], name = 'Mi marca') {
  const colors = {};
  for (const { key, value } of colorEntries) { const role = colorRole(key); const hex = normHex(patch.colors?.[key] || value); if (role && hex && !colors[role]) colors[role] = hex; }
  return newKit({ name, brandName: patch.brand?.name || '', logos: patch.brand?.logo ? [{ name: 'Logo del proyecto', src: patch.brand.logo }] : [], colors, fonts: { heading: patch.typography?.heading, body: patch.typography?.body } });
}
export function applyKit(patch = {}, kit, options = {}, colorKeys = []) {
  const { logo = true, colors = true, fonts = true, name = true } = options;
  const next = { ...patch }; const changed = [];
  if (logo && kit.logos?.[0]?.src) { next.brand = { ...next.brand, logo: kit.logos[0].src }; changed.push('logo'); }
  if (name && kit.brandName) { next.brand = { ...next.brand, name: kit.brandName }; changed.push('nombre'); }
  if (colors) { const map = mapKitToColors(kit, colorKeys); if (Object.keys(map).length) { next.colors = { ...next.colors, ...map }; changed.push(`${Object.keys(map).length} colores`); } }
  if (fonts && (kit.fonts?.heading || kit.fonts?.body)) { next.typography = { ...next.typography, ...(kit.fonts.heading ? { heading: kit.fonts.heading } : {}), ...(kit.fonts.body ? { body: kit.fonts.body } : {}) }; changed.push('fuentes'); }
  return { patch: next, changed };
}
