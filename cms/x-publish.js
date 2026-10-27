// Publicar (demo): lista de revisión previa, instantánea de la publicación y enlace a /cms/sitio.html.
import { dbAll, dbPut, dbDelete } from './core.js';
import { publishChecklist } from './publish.js';
import { STATUS_LABEL } from './comments.js';

const FIX_TAB = { 'seo-title': 'site', 'seo-description': 'site', canonical: 'site', alt: 'media', links: 'text', translations: 'lang', quality: 'media', approval: 'comments' };
export const DEMO_NOTE = 'Demo: esta publicación se ve en este navegador; con dominio y backend conectados será pública.';

export function create(host, ext) {
  const { esc } = host;
  let pubs = []; let last = null; let checklist = null;
  const fmt = iso => new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const urlOf = id => new URL('/cms/sitio.html?p=' + encodeURIComponent(id), location.origin).href;
  async function load() { try { pubs = (await dbAll('publications')).filter(p => p.projectId === host.project?.id).sort((a, b) => String(b.at).localeCompare(String(a.at))); } catch { pubs = []; } if (host.currentTab === 'export') host.renderPanel(); }

  function dlg() {
    let d = document.getElementById('publish-dialog');
    if (!d) { d = document.createElement('dialog'); d.id = 'publish-dialog'; d.setAttribute('aria-labelledby', 'publish-title'); document.body.append(d); }
    return d;
  }
  function render() {
    const d = dlg(); const review = ext.review();
    if (last) {
      d.innerHTML = `<div class="dialog-head"><div><span class="eyebrow">PUBLICADO</span><h2 id="publish-title">Listo</h2><p>${esc(DEMO_NOTE)}</p></div><button type="button" class="icon-btn" data-x="ui:close" aria-label="Cerrar">${ext.icon('close')}</button></div>
        <div class="notice">Guardamos una copia de «${esc(last.projectName)}» tal como está ahora. Puedes seguir editando sin cambiarla.</div>
        <div class="actions-row"><a class="button lime" id="pub-open" href="${esc(urlOf(last.id))}" target="_blank" rel="noopener">Abrir la publicación</a><button type="button" class="button" data-x="pub:copy" data-xid="${esc(last.id)}">Copiar enlace</button><button type="button" class="button" data-x="ui:close">Cerrar</button></div>
        <p class="hint">Desde la publicación puedes descargar el sitio (.zip) con index.html, sitemap.xml y robots.txt.</p>`;
      return;
    }
    const c = checklist;
    d.innerHTML = `<div class="dialog-head"><div><span class="eyebrow">ANTES DE PUBLICAR</span><h2 id="publish-title">Revisión previa</h2><p>${esc(DEMO_NOTE)}</p></div><button type="button" class="icon-btn" data-x="ui:close" aria-label="Cerrar">${ext.icon('close')}</button></div>
      <p class="muted">Estado actual: <b>${esc(STATUS_LABEL[review.status])}</b>. ${c.warnings ? `Hay ${c.warnings} ${c.warnings === 1 ? 'punto' : 'puntos'} por revisar; ninguno bloquea la publicación.` : 'Todo en orden.'}</p>
      <ul class="x-check-list">${c.items.map(i => `<li data-level="${i.level}"><span class="x-lvl" aria-hidden="true">${i.level === 'ok' ? ext.icon('check') : ext.icon('warn')}</span><div><b>${esc(i.title)}</b><span class="sr">${i.level === 'ok' ? ' (correcto)' : ' (revisar)'}</span><p>${esc(i.detail)}</p></div>${i.level === 'warn' && FIX_TAB[i.id] ? `<button type="button" class="text-btn" data-x="pub:fix" data-xv="${FIX_TAB[i.id]}">Corregir</button>` : ''}</li>`).join('')}</ul>
      <div class="actions-row"><button type="button" class="button lime" data-x="pub:confirm" id="pub-confirm">${c.warnings ? 'Publicar de todos modos' : 'Publicar'}</button><button type="button" class="button" data-x="ui:close">Cancelar</button></div>`;
  }
  async function confirmPublish() {
    if (!ext.access.canPublish) { host.toast('Tu rol no puede publicar.', true); return; }
    try {
      await host.persist();
      const id = 'pub-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const pub = { id, projectId: host.project.id, projectName: host.project.name, templateSlug: host.project.template, templateSrc: host.template.src, at: new Date().toISOString(), by: ext.actorLabel(), patch: JSON.parse(JSON.stringify(host.patch)), review: ext.review().status, warnings: checklist.warnings, name: `Publicación ${fmt(new Date().toISOString())}` };
      await dbPut('publications', pub);
      pubs = [pub, ...pubs]; last = pub;
      try { ext.transition('published'); } catch (error) { host.toast(error.message, true); }
      ext.audit('Proyecto publicado (demo)', `${host.project.name} · ${id}`);
      ext.mods.ver.snapshot({ name: `Publicado ${fmt(pub.at)}`, auto: false, force: true });
      render(); window.open(urlOf(id), '_blank', 'noopener');
    } catch (error) { host.toast(error.message, true); }
  }

  return {
    init() { return load(); },
    onProject() { pubs = []; last = null; load(); },
    extra: {
      export() {
        return `<hr class="divider"><h3 class="section-title">Publicar (demo)</h3><p class="muted">${esc(DEMO_NOTE)}</p>${ext.access.canPublish ? '<button type="button" class="button lime full" data-x="pub:open">Publicar con revisión previa</button>' : '<div class="notice">Tu rol no puede publicar.</div>'}
        <div class="x-pubs">${pubs.slice(0, 6).map(p => `<div class="x-pub"><div><b>${esc(p.name)}</b><small class="muted">${esc(p.by)}${Number(p.warnings) ? ` · ${Number(p.warnings)} avisos` : ''}</small></div><div class="actions-row"><a class="button" href="${esc(urlOf(p.id))}" target="_blank" rel="noopener">Abrir</a><button type="button" class="button" data-x="pub:copy" data-xid="${esc(p.id)}">Copiar enlace</button>${ext.access.canPublish ? `<button type="button" class="icon-btn" data-x="pub:del" data-xid="${esc(p.id)}" aria-label="Eliminar ${esc(p.name)}">${ext.icon('trash')}</button>` : ''}</div></div>`).join('')}</div>`;
      }
    },
    click(act, b) {
      if (act === 'open') {
        if (!ext.access.canPublish) { host.toast(ext.access.guest ? 'Entra con tu cuenta para publicar.' : `Tu rol (${ext.roleLabel()}) no puede publicar.`, true); return; }
        if (!host.ready) { host.toast('Espera a que cargue la plantilla.', true); return; }
        last = null;
        checklist = publishChecklist({ patch: host.patch, inventory: host.inventory, review: ext.review(), isLowQuality: host.lowQuality, blockIssues: host.blockIssues() });
        render(); dlg().showModal(); document.getElementById('pub-confirm')?.focus(); return;
      }
      if (act === 'confirm') { confirmPublish(); return; }
      if (act === 'fix') { document.getElementById('publish-dialog')?.close(); host.setTab(b.dataset.xv); return; }
      if (act === 'copy') { const url = urlOf(b.dataset.xid); (navigator.clipboard?.writeText(url) || Promise.reject()).then(() => host.toast('Enlace copiado.')).catch(() => host.toast(`Copia este enlace: ${url}`)); return; }
      if (act === 'del') { if (!confirm('¿Eliminar esta publicación? El enlace dejará de funcionar.')) return; dbDelete('publications', b.dataset.xid).then(() => { pubs = pubs.filter(p => p.id !== b.dataset.xid); host.renderPanel(); }).catch(e => host.toast(e.message, true)); }
    }
  };
}
