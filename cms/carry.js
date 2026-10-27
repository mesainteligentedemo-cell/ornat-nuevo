// Cambiar de plantilla llevando tu contenido: qué se puede pasar a otra plantilla y qué no.
// Se lleva lo que no depende de la plantilla: módulos insertados (con sus textos, fotos y traducciones), marca (nombre y logo),
// tipografía global, SEO y documentos legales. Los colores se adaptan por rol (acento, fondo, texto) con el kit de marca.
// No se pueden pasar los textos, fotos, ocultados ni estilos de la plantilla anterior: cada plantilla tiene su propia estructura.
import { ownsKey } from './blocks.js';
import { kitFromPatch } from './kits.js';

const clone = value => JSON.parse(JSON.stringify(value));
const AREAS = ['texts', 'styles', 'images', 'links', 'hidden', 'mediaMeta'];
const count = obj => Object.keys(obj || {}).length;

export function carryOver(patch = {}, colorEntries = []) {
  // Los puntos de inserción son secciones de la plantilla anterior: los módulos quedan antes del pie, en el mismo orden.
  const blocks = (patch.blocks || []).map(b => ({ ...b, after: '', fields: clone(b.fields) }));
  const owns = key => blocks.some(b => ownsKey(key, b.id));
  const next = {};
  const summary = { blocks: blocks.length, brand: false, logo: false, typography: false, seo: false, legal: false, colors: 0, droppedTexts: 0, droppedImages: 0, droppedOther: 0, droppedPages: 0 };
  if (blocks.length) next.blocks = blocks;
  for (const area of AREAS) {
    const kept = {};
    for (const [key, value] of Object.entries(patch[area] || {})) {
      if (owns(key) || (area === 'mediaMeta' && key === 'brandLogo')) kept[key] = clone(value);
      else if (area === 'texts') summary.droppedTexts++;
      else if (area === 'images') summary.droppedImages++;
      else if (area !== 'mediaMeta') summary.droppedOther++;
    }
    if (count(kept)) next[area] = kept;
  }
  summary.droppedImages += count(patch.videos) + count(patch.sequences);
  summary.droppedPages = count(patch.pages);
  if (patch.brand && (patch.brand.name || patch.brand.logo)) { next.brand = clone(patch.brand); summary.brand = !!patch.brand.name; summary.logo = !!patch.brand.logo; }
  if (count(patch.typography)) { next.typography = clone(patch.typography); summary.typography = true; }
  if (count(patch.seo)) { next.seo = clone(patch.seo); summary.seo = true; }
  if (count(patch.legal)) { next.legal = clone(patch.legal); summary.legal = true; }
  if (patch.i18n) {
    const en = Object.fromEntries(Object.entries(patch.i18n.en || {}).filter(([key]) => owns(key)));
    if (patch.i18n.enabled !== undefined || count(en)) next.i18n = { ...(patch.i18n.enabled !== undefined ? { enabled: patch.i18n.enabled } : {}), ...(count(en) ? { en } : {}) };
  }
  let kit = null;
  if (count(patch.colors) && colorEntries.length) { try { kit = kitFromPatch(patch, colorEntries, 'Proyecto anterior'); summary.colors = Object.keys(kit.colors).length; } catch { kit = null; } }
  return { patch: next, kit, summary };
}

// ¿Hay algo que valga la pena preguntar? (un proyecto sin cambios cambia de plantilla sin diálogo)
export const hasContent = patch => !!patch && Object.keys(patch).some(k => (Array.isArray(patch[k]) ? patch[k].length : count(patch[k])) > 0);

// Texto para el diálogo: qué se lleva y qué no.
export function describeCarry(summary) {
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const brought = [];
  if (summary.blocks) brought.push(plural(summary.blocks, 'módulo insertado', 'módulos insertados') + ' (con sus textos y fotos)');
  if (summary.brand || summary.logo) brought.push(['nombre de marca', 'logo'].filter((_, i) => (i === 0 ? summary.brand : summary.logo)).join(' y '));
  if (summary.colors) brought.push(`${plural(summary.colors, 'color', 'colores')} del kit de marca, adaptados por rol (acento, fondo, texto)`);
  if (summary.typography) brought.push('tipografía global');
  if (summary.seo) brought.push('SEO');
  if (summary.legal) brought.push('documentos legales');
  const left = [];
  if (summary.droppedTexts) left.push(plural(summary.droppedTexts, 'texto propio', 'textos propios'));
  if (summary.droppedImages) left.push(plural(summary.droppedImages, 'imagen o video', 'imágenes y videos'));
  if (summary.droppedOther) left.push(plural(summary.droppedOther, 'ajuste de estilo, enlace u ocultado', 'ajustes de estilo, enlaces u ocultados'));
  if (summary.droppedPages) left.push(plural(summary.droppedPages, 'SEO de página', 'SEO de páginas'));
  return { brought, left };
}
