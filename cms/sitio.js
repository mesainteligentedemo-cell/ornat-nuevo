// Visor de publicaciones (demo): renderiza la plantilla con el parche aplicado SIN editor (misma lógica del bridge)
// y arma el .zip con index.html + sitemap.xml + robots.txt. También muestra la vista previa de una versión (?v=).
import { dbGet, validatePatch } from './core.js';
import { sitemapXml, robotsTxt, siteBase, sitemapRoutes } from './publish.js';
import { i18nEnabled } from './i18n.js';

const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
const DEMO = 'Demo: esta publicación se ve en este navegador; con dominio y backend conectados será pública.';
const frame = $('#site');
let record = null, tplSrc = '', inventory = {}, patch = {}, kind = 'pub';
const waiting = [];

function fail(title, text) { $('#state-title').textContent = title; $('#state-text').textContent = text; document.querySelector('.spinner')?.remove(); $('#state').hidden = false; }
function say(text) { $('#msg').textContent = text; }

async function load() {
  const pubId = params.get('p'), verId = params.get('v');
  if (pubId) { record = await dbGet('publications', pubId); kind = 'pub'; if (record) tplSrc = record.templateSrc; }
  else if (verId) {
    record = await dbGet('versions', verId); kind = 'ver';
    if (record) {
      const project = await dbGet('projects', record.projectId);
      const manifest = await (await fetch('templates-manifest.json')).json();
      tplSrc = manifest.templates.find(t => t.slug === project?.template)?.src || '';
    }
  }
  if (!record || !tplSrc) { fail('No encontramos esta publicación', 'Las publicaciones de la demo viven en el navegador donde se crearon. Ábrela en ese mismo navegador o vuelve a publicar desde el editor.'); return; }
  // Publicaciones y versiones se leen de IndexedDB: se validan al leer, no solo al guardar.
  if (typeof tplSrc !== 'string' || !/^\/[A-Za-z0-9_\-./]*$/.test(tplSrc) || tplSrc.includes('..')) { fail('No encontramos esta publicación', 'La publicación guardada no tiene una plantilla válida.'); return; }
  patch = validatePatch(record.patch || {});
  const lang = params.get('lang');
  const src = new URL(tplSrc, location.origin); src.searchParams.set('cms', '1'); src.searchParams.set('pub', '1'); if (lang === 'en' || lang === 'es') src.searchParams.set('lang', lang);
  $('#demo-text').textContent = kind === 'ver' ? `Vista previa de la versión «${record.name || 'automática'}». Solo lectura.` : DEMO;
  if (kind === 'ver') { $('#zip').hidden = true; $('#copy').hidden = true; }
  frame.src = src.pathname + src.search;
}

const post = message => frame.contentWindow?.postMessage({ channel: 'ornat-cms', ...message }, location.origin);
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== frame.contentWindow || event.data?.channel !== 'ornat-cms') return;
  const m = event.data;
  if (m.type === 'ready' || m.type === 'inventory') {
    inventory = m.inventory || inventory;
    if (m.type === 'ready') { post({ type: 'mode', selecting: false, commenting: false }); }
    post({ type: 'apply', patch });
  }
  if (m.type === 'applied') {
    $('#state').hidden = true;
    if (!$('#reopen').dataset.closed) $('#demo-bar').hidden = false;
    $('#zip').disabled = false;
    const t = patch.seo?.title; if (t) document.title = t;
    document.documentElement.dataset.ready = 'true';
  }
  if (m.type === 'export') { const w = waiting.shift(); w?.(m.html); }
});

const requestExport = () => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('La plantilla tardó demasiado en preparar el HTML.')), 20000);
  waiting.push(html => { clearTimeout(timer); resolve(html); });
  post({ type: 'export' });
});
function loadJSZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'; s.crossOrigin = 'anonymous'; s.referrerPolicy = 'no-referrer';
    s.onload = () => (window.JSZip ? resolve(window.JSZip) : reject(new Error('No se pudo iniciar la librería ZIP.')));
    s.onerror = () => reject(new Error('No se pudo cargar la librería ZIP (cdnjs). Revisa tu conexión.'));
    document.head.append(s);
  });
}
async function subpage(path, page, templateDir) {
  const res = await fetch(path); if (!res.ok) throw new Error(`No se pudo leer ${path}`);
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
  if (page.title) doc.title = page.title;
  if (page.description !== undefined && page.description !== '') {
    let meta = doc.querySelector('meta[name="description"]'); if (!meta) { meta = doc.createElement('meta'); meta.setAttribute('name', 'description'); doc.head.append(meta); }
    meta.setAttribute('content', page.description);
  }
  doc.querySelectorAll('script[src*="/cms/bridge.js"]').forEach(x => x.remove());
  let base = doc.querySelector('base'); if (!base) { base = doc.createElement('base'); doc.head.prepend(base); }
  base.setAttribute('href', new URL(path.replace(/[^/]*$/, ''), location.origin).href);
  return '<!doctype html>\n' + doc.documentElement.outerHTML;
}
async function buildZip() {
  const btn = $('#zip'); btn.disabled = true; say('Preparando el .zip…');
  try {
    const [JSZip, html] = await Promise.all([loadJSZip(), requestExport()]);
    const zip = new JSZip();
    zip.file('index.html', html);
    const { base, placeholder } = siteBase(patch, inventory);
    const templateDir = new URL('.', new URL(tplSrc, location.origin)).pathname;
    const routes = sitemapRoutes(patch, templateDir);
    let sitemap = sitemapXml({ base, routes, languages: i18nEnabled(patch) });
    if (placeholder) sitemap = sitemap.replace('?>\n', '?>\n<!-- Sustituye https://ejemplo.com/ por tu dominio real (Sitio → URL canónica) antes de subir este archivo. -->\n');
    zip.file('sitemap.xml', sitemap);
    zip.file('robots.txt', robotsTxt({ base }));
    const skipped = [];
    for (const [path, page] of Object.entries(patch.pages || {})) {
      if (page.sitemap === false) continue;
      const rel = path.startsWith(templateDir) ? path.slice(templateDir.length).replace(/^\/+/, '') : null; if (!rel) continue;
      try { zip.file(rel.replace(/\/?$/, '/') + 'index.html', await subpage(path.endsWith('/') ? path + 'index.html' : path, page, templateDir)); } catch { skipped.push(path); }
    }
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${(record.projectName || 'sitio').replace(/[^\p{L}\p{N}\- ]/gu, '').trim().replace(/\s+/g, '-') || 'sitio'}-ornat.zip`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 15000);
    say(`.zip descargado (${(blob.size / 1024).toFixed(0)} KB). Incluye index.html, sitemap.xml y robots.txt${routes.length > 1 ? ` y ${routes.length - 1 - skipped.length} página(s) con SEO propio` : ''}.${placeholder ? ' Sin URL canónica: el sitemap usa ejemplo.com.' : ''} Los recursos originales de la plantilla requieren conexión.`);
  } catch (error) { say(error.message); }
  finally { btn.disabled = false; }
}
$('#zip').addEventListener('click', buildZip);
$('#copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.href); say('Enlace copiado. Funciona en este navegador.'); } catch { say(`Copia este enlace: ${location.href}`); } });
$('#hide').addEventListener('click', () => { $('#demo-bar').hidden = true; $('#reopen').hidden = false; $('#reopen').dataset.closed = '1'; $('#reopen').focus(); });
$('#reopen').addEventListener('click', () => { $('#demo-bar').hidden = false; $('#reopen').hidden = true; delete $('#reopen').dataset.closed; $('#zip').focus(); });
load().catch(error => fail('No se pudo abrir la publicación', error.message));
