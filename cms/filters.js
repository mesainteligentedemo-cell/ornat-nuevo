// Pure filtering helpers for the editor panels (no DOM): easy to test and reuse.
export const norm = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export const TEXT_TYPES = [['title', 'Títulos'], ['text', 'Párrafos'], ['button', 'Botones y enlaces'], ['tag', 'Etiquetas']];
export const MEDIA_TYPES = [["photo", "Fotos"], ["background", "Fondos"], ["logo", "Logos"], ["icon", "Íconos"], ['video', 'Video'], ['sequence', 'Secuencia']];
export const TEMPLATE_CHIPS = [['all', 'Todas'], ['dark', 'Oscuras'], ['light', 'Claras'], ['mixed', 'Contraste'], ['video', 'Con video'], ['d3', 'Animación 3D'], ['sequence', 'Con secuencia'], ['logo', 'Con logo'], ['procedural', 'Efecto procedural'], ['images', '30+ imágenes']];
export const TEMPLATE_SORTS = [['az', 'A–Z'], ['images', 'Más imágenes'], ['sections', 'Más secciones']];

export function textType(t) {
  if (['title', 'text', 'button', 'tag'].includes(t?.type)) return t.type;
  const tag = String(t?.tag || '');
  if (/^h[1-6]$/.test(tag)) return 'title';
  if (tag === 'p' || tag === 'li') return 'text';
  if (tag === 'a' || tag === 'button') return 'button';
  return 'tag';
}
export function isHidden(patch, id, section, block) { return !!(patch?.hidden?.[id] || (block && patch?.hidden?.[block]) || (section !== undefined && patch?.hidden?.['section:' + section])); }
export function textEdited(patch, id, block) { return patch?.texts?.[id] !== undefined || !!patch?.styles?.[id] || (!!block && (!!patch?.styles?.[block] || patch?.texts?.[block] !== undefined)) || patch?.links?.[id] !== undefined; }

export function filterTexts(texts, patch = {}, f = {}) {
  const q = norm(f.q);
  return texts.filter(t => {
    if (f.section && String(t.section) !== String(f.section)) return false;
    if (f.type && textType(t) !== f.type) return false;
    if (f.edited && !textEdited(patch, t.id, t.block)) return false;
    if (f.hidden && !isHidden(patch, t.id, t.section, t.block)) return false;
    if (q && !norm(patch.texts?.[t.id] ?? t.text).includes(q) && !norm(t.text).includes(q)) return false;
    return true;
  });
}
export const textFiltersActive = f => !!(f.q || f.section || f.type || f.edited || f.hidden);

export function mediaType(item) {
  if (item.type) return item.type;
  if (item.kind === 'logo') return 'logo';
  if (item.kind === 'background') return 'background';
  if (item.kind === 'icon') return 'icon';
  return 'photo';
}
export function mediaModified(patch, item) {
  const id = item.id; const type = mediaType(item);
  if (type === 'video') return !!patch?.videos?.[id];
  if (type === 'sequence') return !!patch?.sequences?.[id]?.frames?.length;
  return !!patch?.images?.[id] || (type === 'logo' && !!patch?.brand?.logo);
}
export function effectiveAlt(patch, item) { return patch?.images?.[item.id]?.alt ?? item.alt ?? ''; }
export function filterMedia(items, patch = {}, f = {}, { lowQuality = () => false } = {}) {
  const q = norm(f.q);
  return items.filter(item => {
    const type = mediaType(item);
    if (f.type && type !== f.type) return false;
    if (f.section && String(item.section) !== String(f.section)) return false;
    if (f.modified && !mediaModified(patch, item)) return false;
    if (f.noAlt && (!['photo', 'logo'].includes(type) || norm(effectiveAlt(patch, item)))) return false;
    if (f.lowQuality && !lowQuality(item)) return false;
    if (f.hidden && !isHidden(patch, item.id, item.section)) return false;
    if (q && !norm(effectiveAlt(patch, item) + ' ' + (item.label || '')).includes(q)) return false;
    return true;
  });
}
export const mediaFiltersActive = f => !!(f.q || f.section || f.type || f.modified || f.noAlt || f.lowQuality || f.hidden);

// Etiquetas de las plantillas para la galería. Salen del manifest (video, fotogramas, efecto procedural, cantidad de imágenes)
// y de lo que se midió abriendo cada plantilla: tono (color de fondo de la página) y si dibuja 3D/WebGL.
export const TAG_LABELS = { dark: 'Oscura', light: 'Clara', mixed: 'Contraste', video: 'Con video', d3: 'Animación 3D', procedural: 'Efecto procedural', frames: 'Recorrido por fotogramas', images: '30+ imágenes' };
// Tono: se mide en la portada (miniatura) y en el fondo de la página. «Contraste» = portada y páginas de tono distinto.
export const TONE = {
  dark: ['sitio-actual', 'edolus', 'studiodsk', 'lenval', 'ifi', 'whp', 'fitandyou', 'emarat', 'joshuas', 'elyse', 'concrete', 'tref', 'zorge'],
  light: ['ux', 'raycorral', 'felixnieto', 'pamidor', 'faith', 'superlogica', 'range', 'find'],
  mixed: ['empire', 'loft', 'bamo', 'elicyon', 'yodezeen', 'whitedesert', 'velaa', 'tengile', 'aurelia', 'olivia']
};
export const THREE_D = ['empire', 'ifi']; // Three.js / WebGL
export function templateTags(t) {
  const images = Array.isArray(t.images) ? t.images : [];
  const tags = [];
  for (const tone of ['dark', 'light', 'mixed']) if (TONE[tone].includes(t.slug)) tags.push(tone);
  if (Array.isArray(t.videos) ? t.videos.length > 0 : Number(t.videos) > 0) tags.push('video');
  if (THREE_D.includes(t.slug)) tags.push('d3');
  if (t.protectedEngines) tags.push('procedural');
  if (t.sequence) tags.push('frames');
  if (images.length >= 30) tags.push('images');
  return tags;
}

export function templateTraits(t) {
  const tags = templateTags(t);
  const images = Array.isArray(t.images) ? t.images : [];
  return {
    video: Array.isArray(t.videos) ? t.videos.length > 0 : Number(t.videos) > 0,
    sequence: !!t.sequence,
    logo: images.some(i => /(?:^|[/_-])(?:logo|wordmark|brandmark|isotipo|monogram)/i.test(String(i.src || ''))),
    procedural: !!t.protectedEngines,
    images: images.length >= 30,
    dark: tags.includes('dark'),
    light: tags.includes('light'),
    mixed: tags.includes('mixed'),
    d3: tags.includes('d3')
  };
}
// `tags` (varias a la vez, todas deben cumplirse) tiene prioridad sobre `chip` (una sola).
export function filterTemplates(templates, { q = '', chip = 'all', tags = [], sort = 'az' } = {}) {
  const needle = norm(q);
  const wanted = tags.length ? tags : (chip && chip !== 'all' ? [chip] : []);
  const list = templates.filter(t => {
    if (needle && !norm(`${t.name} ${t.slug} ${templateTags(t).map(x => TAG_LABELS[x]).join(' ')}`).includes(needle)) return false;
    const traits = templateTraits(t);
    return wanted.every(w => !!traits[w]);
  });
  const size = (t, key) => (Array.isArray(t[key]) ? t[key].length : 0);
  const sorters = { az: (a, b) => a.name.localeCompare(b.name, 'es'), images: (a, b) => size(b, 'images') - size(a, 'images') || a.name.localeCompare(b.name, 'es'), sections: (a, b) => size(b, 'sections') - size(a, 'sections') || a.name.localeCompare(b.name, 'es') };
  return list.sort(sorters[sort] || sorters.az);
}

export const PROJECT_SORTS = [['recent', 'Más recientes'], ['old', 'Más antiguos'], ['name', 'Nombre'], ['template', 'Plantilla']];
export function filterProjects(projects, { q = '', template = '', sort = 'recent' } = {}, templateName = slug => slug) {
  const needle = norm(q);
  const list = projects.filter(p => (!template || p.template === template) && (!needle || norm(`${p.name} ${templateName(p.template)}`).includes(needle)));
  const by = { recent: (a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)), old: (a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)), name: (a, b) => a.name.localeCompare(b.name, 'es'), template: (a, b) => templateName(a.template).localeCompare(templateName(b.template), 'es') || String(b.updatedAt).localeCompare(String(a.updatedAt)) };
  return list.sort(by[sort] || by.recent);
}
