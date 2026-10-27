// Idiomas (ES/EN) y SEO por página: traducciones, faltantes, vista previa de Google y de compartir.
import { i18nEnabled, setTranslation, translationUnits, translatableUnits, missingUnits, translationStats, filterUnits } from './i18n.js';
import { seoValues, lengthState, TITLE_RANGE, DESC_RANGE, googlePreview, truncate, mergePages } from './publish.js';

export function create(host, ext) {
  const { esc } = host;
  const f = { q: '', missing: false, section: '' }; let limit = 40; let seoPage = '';
  const units = () => translationUnits(host.inventory.texts || [], host.patch);
  const stateLabel = { good: 'Largo adecuado', short: 'Muy corto', long: 'Muy largo', empty: 'Vacío' };

  function seoCards(title, description, canonical, ogImage) {
    const g = googlePreview({ title, description, url: canonical || 'https://ejemplo.com/' });
    const t = lengthState(title, TITLE_RANGE), d = lengthState(description, DESC_RANGE);
    return `<div class="x-seo" id="seo-preview"><div class="x-google" aria-label="Vista previa en Google"><span class="x-g-url">${esc(g.url)}</span><span class="x-g-title">${esc(g.title)}</span><span class="x-g-desc">${esc(g.description)}</span></div>
      <p class="x-count" data-state="${t}"><b>Título</b> ${title.length} caracteres · ${stateLabel[t]} (ideal ${TITLE_RANGE[0]}–${TITLE_RANGE[1]})</p><p class="x-count" data-state="${d}"><b>Descripción</b> ${description.length} caracteres · ${stateLabel[d]} (ideal ${DESC_RANGE[0]}–${DESC_RANGE[1]})</p>
      <div class="x-share" aria-label="Vista previa al compartir"><div class="x-share-img">${ogImage ? `<img src="${esc(ogImage)}" alt="">` : '<span>Sin imagen para compartir</span>'}</div><div class="x-share-txt"><small>${esc(g.url.split(' ')[0])}</small><b>${esc(truncate(title || 'Sin título', 70))}</b><span>${esc(truncate(description || 'Sin descripción.', 110))}</span></div></div></div>`;
  }
  function refreshSeoPreview() {
    const box = document.getElementById('seo-preview'); if (!box) return;
    const t = document.getElementById('seo-title')?.value ?? '', d = document.getElementById('seo-description')?.value ?? '';
    const c = document.getElementById('seo-canonical')?.value || seoValues(host.patch, host.inventory).canonical;
    box.outerHTML = seoCards(t, d, c, host.patch.seo?.ogImage ?? host.inventory.seo?.ogImage ?? '');
  }
  function allPages() {
    const t = host.template; const dir = new URL('.', new URL(t.src, location.origin)).pathname;
    return mergePages(host.inventory.pages || [], host.inventory.externalPages || [], t.remote || '', dir);
  }
  function pageSection() {
    const patch = host.patch; const pages = allPages();
    const select = `<label class="field"><span>Página</span><select data-xi="lang:page" data-f="seo-page" aria-label="Página que estás configurando"><option value="">Página principal</option>${pages.map(p => `<option value="${esc(p.path)}" ${seoPage === p.path ? 'selected' : ''}>${esc(p.label.slice(0, 40))} · ${esc(p.path)}</option>`).join('')}</select><small>${pages.length ? `Se detectaron ${pages.length} páginas internas en esta plantilla.` : 'Esta plantilla es de una sola página.'}</small></label>`;
    if (!seoPage) { const s = seoValues(patch, host.inventory); return select + seoCards(s.title, s.description, s.canonical, s.ogImage); }
    const p = patch.pages?.[seoPage] || {}; const s = seoValues(patch, host.inventory);
    return select + `<label class="field"><span>Título de esta página</span><input data-f="pg-title" data-xi="lang:pagefield" data-key="title" value="${esc(p.title ?? '')}" maxlength="200" placeholder="Título SEO de ${esc(seoPage)}"></label><label class="field"><span>Descripción de esta página</span><textarea data-f="pg-desc" data-xi="lang:pagefield" data-key="description" maxlength="1000">${esc(p.description ?? '')}</textarea></label><label class="x-check"><input type="checkbox" data-xi="lang:pagefield" data-key="sitemap" ${p.sitemap === false ? '' : 'checked'}> Incluir en el sitemap</label>` + seoCards(p.title ?? '', p.description ?? '', new URL(seoPage.replace(/^\/+/, ''), s.canonical || 'https://ejemplo.com/').href, s.ogImage) + '<p class="hint">Al publicar, el .zip incluye una copia de esta página con el título y la descripción que escribiste.</p>';
  }
  function translationsHTML() {
    const patch = host.patch; const all = units(); const stats = translationStats(host.inventory.texts || [], patch);
    const list = filterUnits(translatableUnits(host.inventory.texts || [], patch), f);
    const sections = [...new Set(translatableUnits(host.inventory.texts || [], patch).map(u => String(u.section)))];
    const seo = seoValues(patch, host.inventory);
    const seoRows = [['seo:title', 'Título SEO', seo.title], ['seo:description', 'Descripción SEO', seo.description]].filter(([, , src]) => src);
    const row = (id, label, src, tr, locate) => `<div class="x-tr"><p class="x-src"><span class="tag">ES</span> ${esc(src)}</p><label class="field"><span>${esc(label)} · EN</span><textarea data-f="tr-${esc(id)}" data-xi="lang:tr" data-xid="${esc(id)}" maxlength="3000" ${ext.canEdit() ? '' : 'disabled'}>${esc(tr)}</textarea></label>${locate ? `<button type="button" class="text-btn" data-x="lang:locate" data-xid="${esc(locate)}">Ver en mi sitio</button>` : ''}</div>`;
    return `${ext.lang === 'en' ? '<div class="notice">Estás editando en inglés. Tu texto en español no cambia: aquí escribes la traducción de cada texto.</div>' : ''}
      <div class="x-progress" role="group" aria-label="Avance de la traducción"><div class="x-bar"><i style="width:${stats.pct}%"></i></div><span><b>${stats.done}</b> de ${stats.total} traducidos · ${stats.missing} faltantes</span></div>
      <label class="x-check"><input type="checkbox" data-xi="lang:enable" ${i18nEnabled(patch) ? 'checked' : ''} ${ext.canEdit() ? '' : 'disabled'}> Mostrar el conmutador ES/EN en el sitio publicado</label>
      <p class="hint">El sitio publicado y el .zip incluyen un botón ES | EN accesible, <code>lang</code> correcto y etiquetas <code>hreflang</code> cuando hay URL canónica.</p>
      <div class="filters"><div class="search-field">${ext.icon('search')}<label class="sr" for="tr-q">Buscar texto</label><input id="tr-q" type="search" data-f="tr-q" data-xi="lang:q" value="${esc(f.q)}" placeholder="Buscar en español o en inglés…" autocomplete="off"></div>
      <label class="sr" for="tr-sec">Sección</label><select id="tr-sec" class="full-input" data-xi="lang:section" data-f="tr-sec"><option value="">Todas las secciones</option>${sections.map(s => `<option value="${esc(s)}" ${f.section === s ? 'selected' : ''}>${esc(host.sectionLabel(s))}</option>`).join('')}</select>
      <div class="chips-row wrap"><button type="button" class="chip" data-x="lang:missing" aria-pressed="${f.missing}">Solo faltantes (${stats.missing})</button></div></div>
      ${seoRows.length && !f.q && !f.section ? `<h3 class="section-title">Para buscadores</h3>${seoRows.map(([id, label, src]) => row(id, label, src, patch.i18n?.en?.[id] ?? '', '')).join('')}` : ''}
      <h3 class="section-title">Textos del sitio <span class="badge">${list.length}</span></h3>
      ${list.slice(0, limit).map(u => row(u.id, host.sectionLabel(u.section), u.source, u.translation, u.ids[0])).join('') || `<div class="empty-state">${all.length ? (f.missing ? 'No hay textos sin traducir.' : 'Ningún texto coincide.') : 'Aún no se detectaron textos. Abre el menú o módulo de la plantilla.'}</div>`}
      ${list.length > limit ? `<button type="button" class="button full" data-x="lang:more">Mostrar más (${list.length - limit})</button>` : ''}`;
  }

  return {
    tab: { id: 'lang', label: 'Idiomas y traducciones', short: 'Idiomas', icon: 'lang', eyebrow: 'ESPAÑOL · ENGLISH', title: 'Idiomas', desc: 'Traduce tu sitio y revisa qué falta.', before: 'comments' },
    init() {
      document.addEventListener('error', e => { const t = e.target; if (t instanceof HTMLImageElement && t.closest('.x-share-img')) t.replaceWith(Object.assign(document.createElement('span'), { textContent: 'No se pudo cargar la imagen para compartir.' })); }, true);
      document.addEventListener('input', e => { if (e.target?.id === 'seo-title' || e.target?.id === 'seo-description' || e.target?.id === 'seo-canonical') refreshSeoPreview(); });
    },
    onProject() { seoPage = ''; limit = 40; },
    render: translationsHTML,
    translationsHTML,
    extra: { site: pageSection },
    // Edición directa en el lienzo mientras el editor está en inglés: se guarda como traducción.
    saveEnglishEdits(edits) {
      const texts = host.inventory.texts || []; let patch = host.patch;
      for (const [id, value] of Object.entries(edits)) {
        const t = texts.find(x => x.id === id); const unit = id.startsWith('block-') ? id : (t?.block || id);
        const pieces = t?.block ? texts.filter(x => x.block === t.block) : null;
        const full = pieces && pieces.length > 1 && !id.startsWith('block-') ? pieces.map(p => (p.id === id ? value : (patch.texts?.[p.id] ?? p.text))).join(' ') : value;
        patch = setTranslation(patch, unit, full);
      }
      host.commit(patch, 'i18n.canvas');
    },
    locate(id) { host.send('navigate', { id }); },
    click(act, b) {
      if (act === 'set') { ext.setLang(b.dataset.xv); return; }
      if (act === 'missing') { f.missing = !f.missing; limit = 40; host.renderPanel(); return; }
      if (act === 'more') { limit += 60; host.renderPanel(); return; }
      if (act === 'locate') host.send('navigate', { id: b.dataset.xid });
    },
    input(act, el) {
      if (act === 'q') { f.q = el.value; limit = 40; host.renderPanel(); return; }
      if (act === 'tr') {
        if (!ext.canEdit()) { ext.denied(); return; }
        host.commit(setTranslation(host.patch, el.dataset.xid, el.value), 'i18n.' + el.dataset.xid);
        const row = el.closest('.x-tr'); if (row) row.dataset.done = String(!!el.value.trim());
        return;
      }
      if (act === 'pagefield' && el.type !== 'checkbox') {
        if (!ext.canEdit()) { ext.denied(); return; }
        const cur = host.patch.pages?.[seoPage] || {}; host.update('pages', seoPage, { ...cur, [el.dataset.key]: el.value });
        refreshPage();
      }
    },
    change(act, el) {
      if (act === 'page') { seoPage = el.value; host.renderPanel(); return; }
      if (act === 'section') { f.section = el.value; limit = 40; host.renderPanel(); return; }
      if (act === 'enable') { if (!ext.canEdit()) { ext.denied(); return; } host.commit({ ...host.patch, i18n: { ...(host.patch.i18n || {}), enabled: el.checked } }, 'i18n.enabled'); return; }
      if (act === 'pagefield' && el.type === 'checkbox') { const cur = host.patch.pages?.[seoPage] || {}; host.update('pages', seoPage, { ...cur, sitemap: el.checked }); }
    }
  };
  function refreshPage() {
    const box = document.getElementById('seo-preview'); if (!box || !seoPage) return;
    const p = host.patch.pages?.[seoPage] || {}; const s = seoValues(host.patch, host.inventory);
    box.outerHTML = seoCards(p.title ?? '', p.description ?? '', new URL(seoPage.replace(/^\/+/, ''), s.canonical || 'https://ejemplo.com/').href, s.ogImage);
  }
}
