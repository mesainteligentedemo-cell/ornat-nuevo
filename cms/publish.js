// Publicar (demo): lista de revisión previa, sitemap.xml, robots.txt y utilidades de SEO. Funciones puras.
import { effectiveAlt } from './filters.js';
import { i18nEnabled, missingUnits, hreflangLinks } from './i18n.js';
import { publishWarning } from './comments.js';

export const TITLE_RANGE = [30, 60];
export const DESC_RANGE = [70, 160];
export function seoValues(patch = {}, inventory = {}) {
  const base = inventory.seo || {};
  return { title: patch.seo?.title ?? base.title ?? '', description: patch.seo?.description ?? base.description ?? '', canonical: patch.seo?.canonical ?? base.canonical ?? '', ogImage: patch.seo?.ogImage ?? base.ogImage ?? '' };
}
export function lengthState(value, [min, max]) { const n = String(value || '').length; return n === 0 ? 'empty' : n < min ? 'short' : n > max ? 'long' : 'good'; }

// level: 'ok' | 'warn'. Ninguna advertencia bloquea; el usuario decide si publica igual.
export function publishChecklist({ patch = {}, inventory = {}, review, isLowQuality = () => false, blockIssues = [] } = {}) {
  const items = []; const add = (id, level, title, detail = '', count = 0) => items.push({ id, level, title, detail, count });
  const seo = seoValues(patch, inventory);
  const t = lengthState(seo.title, TITLE_RANGE), d = lengthState(seo.description, DESC_RANGE);
  add('seo-title', t === 'good' ? 'ok' : 'warn', 'Título SEO', t === 'good' ? `${seo.title.length} caracteres.` : t === 'empty' ? 'Falta el título de la página (Sitio → Buscadores).' : `Tiene ${seo.title.length} caracteres; lo ideal es ${TITLE_RANGE[0]}–${TITLE_RANGE[1]}.`);
  add('seo-description', d === 'good' ? 'ok' : 'warn', 'Descripción SEO', d === 'good' ? `${seo.description.length} caracteres.` : d === 'empty' ? 'Falta la descripción para buscadores.' : `Tiene ${seo.description.length} caracteres; lo ideal es ${DESC_RANGE[0]}–${DESC_RANGE[1]}.`);
  add('canonical', /^https?:\/\//i.test(seo.canonical) ? 'ok' : 'warn', 'URL canónica', /^https?:\/\//i.test(seo.canonical) ? seo.canonical : 'Sin URL canónica, el sitemap y los idiomas (hreflang) usan una dirección de ejemplo.');
  const images = [...(inventory.images || []), ...(inventory.logos || [])].filter(i => (i.kind === 'image' || i.kind === 'logo') && !patch.hidden?.[i.id] && !patch.hidden?.['section:' + i.section]);
  const seen = new Set(); const noAlt = images.filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return !String(effectiveAlt(patch, i) || '').trim(); });
  add('alt', noAlt.length ? 'warn' : 'ok', 'Descripción de imágenes (alt)', noAlt.length ? `${noAlt.length} ${noAlt.length === 1 ? 'imagen no tiene' : 'imágenes no tienen'} descripción. Ayuda a la accesibilidad y al SEO.` : 'Todas las imágenes tienen descripción.', noAlt.length);
  const emptyLinks = (inventory.links || []).filter(l => { const href = String(patch.links?.[l.id] ?? l.href ?? '').trim(); return (href === '' || href === '#') && !patch.hidden?.[l.id] && !patch.hidden?.['section:' + l.section]; });
  add('links', emptyLinks.length ? 'warn' : 'ok', 'Enlaces', emptyLinks.length ? `${emptyLinks.length} ${emptyLinks.length === 1 ? 'enlace está vacío o apunta a «#»' : 'enlaces están vacíos o apuntan a «#»'}.` : 'Ningún enlace vacío.', emptyLinks.length);
  if (i18nEnabled(patch)) { const miss = missingUnits(inventory.texts || [], patch); add('translations', miss.length ? 'warn' : 'ok', 'Traducciones al inglés', miss.length ? `${miss.length} ${miss.length === 1 ? 'texto' : 'textos'} sin traducir (Idiomas → Faltantes).` : 'Todos los textos tienen traducción.', miss.length); }
  const low = images.filter(i => isLowQuality(i));
  add('quality', low.length ? 'warn' : 'ok', 'Calidad de imágenes', low.length ? `${low.length} ${low.length === 1 ? 'imagen puede verse borrosa' : 'imágenes pueden verse borrosas'} por su resolución.` : 'Resolución suficiente en las imágenes.', low.length);
  const approval = publishWarning(review);
  if (approval) add('approval', 'warn', 'Aprobación', approval);
  else if (review?.history?.some(h => h.status === 'review')) add('approval', 'ok', 'Aprobación', 'El cliente aprobó la versión actual.');
  for (const issue of blockIssues) add('block-' + issue.id, 'warn', 'Bloque sin posición segura', issue.reason || 'Un bloque se colocó antes del pie de página porque su posición no era segura.');
  return { items, warnings: items.filter(i => i.level === 'warn').length, ok: items.every(i => i.level === 'ok') };
}

const xml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
export const PLACEHOLDER_BASE = 'https://ejemplo.com/';
export function siteBase(patch = {}, inventory = {}) {
  const c = seoValues(patch, inventory).canonical;
  try { const u = new URL(c); if (/^https?:$/.test(u.protocol)) { u.hash = ''; u.search = ''; if (!u.pathname.endsWith('/')) u.pathname = u.pathname.replace(/[^/]*$/, ''); return { base: u.href, placeholder: false }; } } catch { /* sin canónica */ }
  return { base: PLACEHOLDER_BASE, placeholder: true };
}
// Ruta de una página respecto a la carpeta de la plantilla: «/templates/ux/about-us/» con base «/templates/ux/» → «about-us/».
export function relativeRoute(path, templateBase) {
  const p = String(path).replace(/index\.html$/, ''); const b = String(templateBase).replace(/index\.html$/, '');
  if (!p.startsWith(b)) return null;
  const rel = p.slice(b.length).replace(/^\/+/, '');
  return rel;
}
export function sitemapXml({ base, routes = [''], languages = false, now = new Date() }) {
  const lastmod = now.toISOString().slice(0, 10);
  const urls = routes.map(route => {
    const loc = new URL(route, base).href;
    const alts = languages ? hreflangLinks(loc, true).map(a => `    <xhtml:link rel="alternate" hreflang="${xml(a.hreflang)}" href="${xml(a.href)}"/>`).join('\n') : '';
    return `  <url>\n    <loc>${xml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>${alts ? '\n' + alts : ''}\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
}
export function robotsTxt({ base, allow = true }) { return `User-agent: *\n${allow ? 'Allow: /' : 'Disallow: /'}\n\nSitemap: ${new URL('sitemap.xml', base).href}\n`; }
export function sitemapRoutes(patch = {}, templateBase = '/') {
  const routes = [''];
  for (const [path, page] of Object.entries(patch.pages || {})) { if (page.sitemap === false) continue; const rel = relativeRoute(path, templateBase); if (rel) routes.push(rel); }
  return [...new Set(routes)];
}
// Vista previa estilo Google y tarjeta al compartir.
export function truncate(text, max) { const t = String(text || '').trim(); return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + '…'; }
export function googlePreview({ title, description, url }) {
  let shown = String(url || '');
  try { const u = new URL(url); shown = u.hostname + (u.pathname !== '/' ? ' › ' + u.pathname.split('/').filter(Boolean).join(' › ') : ''); } catch { /* texto libre */ }
  return { title: truncate(title || 'Sin título', 60), url: shown || 'ejemplo.com', description: truncate(description || 'Sin descripción.', 160) };
}

// Las plantillas como «ux» enlazan a sus páginas con la URL del sitio original (https://sitio.vercel.app/about-us).
// Esa ruta corresponde a la carpeta local de la plantilla: /templates/ux/about-us/.
export function remotePagePath(href, remote, templateDir) {
  try {
    const u = new URL(href); const r = new URL(remote);
    if (u.origin !== r.origin || /\.(?:png|jpe?g|webp|avif|svg|gif|pdf|zip|mp4|webm|js|css|json|xml|txt|ico|woff2?)$/i.test(u.pathname)) return null;
    const route = u.pathname.replace(/^\/+|\/+$/g, '');
    return route ? String(templateDir).replace(/\/?$/, '/') + route + '/' : null;
  } catch { return null; }
}
export function mergePages(internal = [], external = [], remote = '', templateDir = '/') {
  const out = new Map(internal.map(p => [p.path, p]));
  for (const e of external) { const path = remotePagePath(e.href, remote, templateDir); if (path && !out.has(path)) out.set(path, { path, label: e.label }); }
  return [...out.values()].slice(0, 60);
}
