// Historial de versiones: copias automáticas (cada N cambios o cada 2 minutos con cambios), versiones con nombre,
// vista previa y restauración deshacible. Se guardan en IndexedDB (store «versions»).
import { dbAll, dbPut, dbDelete, storageEstimate } from './core.js';
import { makeVersion, shouldSnapshot, pruneVersions, restorePatch, fingerprint, spaceWarning, totalBytes, summarizePatch } from './versions.js';
import { humanBytes } from './library.js';

const MAX_KEY = 'ornat-cms-versions-max';
const DEFAULT_MAX = 30;

export function create(host, ext) {
  const { esc } = host;
  let list = []; let changes = 0; let lastAt = Date.now(); let lastPatch = null; let lastPrint = ''; let timer = null; let warning = null; let busy = false;
  const readMax = () => { try { const n = Number(localStorage.getItem(MAX_KEY)); return n >= 5 && n <= 200 ? n : DEFAULT_MAX; } catch { return DEFAULT_MAX; } };
  let max = readMax();
  const fmtDate = iso => new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  async function load() {
    if (!host.project) { list = []; return; }
    try { list = (await dbAll('versions')).filter(v => v.projectId === host.project.id).sort((a, b) => String(b.at).localeCompare(String(a.at))); } catch { list = []; }
    try { const e = await storageEstimate(); warning = spaceWarning({ usage: e.usage, quota: e.quota, versionsBytes: totalBytes(list) }); } catch { warning = null; }
    if (host.currentTab === 'versions') host.renderPanel();
  }
  async function prune() {
    const { keep, drop } = pruneVersions(list, max);
    for (const v of drop) { try { await dbDelete('versions', v.id); } catch { /* ya no existe */ } }
    list = keep;
  }
  async function snapshot({ name = '', auto = true, force = false } = {}) {
    if (!host.project || busy) return null;
    const patch = host.patch; const print = fingerprint(patch);
    if (!force && print === lastPrint) { changes = 0; lastAt = Date.now(); return null; }
    busy = true;
    try {
      const v = makeVersion({ projectId: host.project.id, patch: JSON.parse(JSON.stringify(patch)), author: ext.actorLabel(), name, auto, prev: lastPatch || {} });
      await dbPut('versions', v);
      list = [v, ...list]; lastPatch = v.patch; lastPrint = print; changes = 0; lastAt = Date.now();
      await prune();
      return v;
    } catch (error) { host.toast(error.message, true); return null; }
    finally { busy = false; if (host.currentTab === 'versions') host.renderPanel(); }
  }
  function tick() { if (ext.access.canEdit && shouldSnapshot({ changes, lastAt })) snapshot({ auto: true }); }

  async function restore(id) {
    const v = list.find(x => x.id === id); if (!v) return;
    if (!ext.canEdit()) { ext.denied(); return; }
    await snapshot({ name: 'Antes de restaurar', auto: true, force: true });
    try { const patch = restorePatch(v); if (host.replacePatch(patch)) { lastPatch = patch; lastPrint = fingerprint(patch); ext.audit('Versión restaurada', `${host.project.name} · ${v.name || fmtDate(v.at)}`); host.toast(`Restauraste «${v.name || fmtDate(v.at)}».`, false, { label: 'Deshacer', run: host.undo }); } }
    catch (error) { host.toast(error.message, true); }
  }
  function preview(id) {
    const v = list.find(x => x.id === id); if (!v) return;
    let dlg = document.getElementById('version-dialog');
    if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'version-dialog'; dlg.className = 'wide-dialog x-preview-dialog'; document.body.append(dlg); }
    dlg.setAttribute('aria-label', 'Vista previa de una versión');
    dlg.innerHTML = `<div class="dialog-head"><div><span class="eyebrow">VISTA PREVIA</span><h2>${esc(v.name || 'Versión automática')}</h2><p>${esc(fmtDate(v.at))} · ${esc(v.author)} · ${esc(v.summary)}</p></div><button type="button" class="icon-btn" data-x="ui:close" aria-label="Cerrar vista previa">${ext.icon('close')}</button></div><iframe class="x-preview-frame" title="Vista previa de la versión" src="/cms/sitio.html?v=${encodeURIComponent(v.id)}"></iframe><div class="actions-row" style="margin-top:12px"><button type="button" class="button lime" data-x="ver:restore" data-xid="${esc(v.id)}" ${ext.access.canEdit ? '' : 'disabled'}>Restaurar esta versión</button><button type="button" class="button" data-x="ui:close">Cerrar</button></div>`;
    dlg.showModal();
  }

  return {
    tab: { id: 'versions', label: 'Versiones', icon: 'clock', eyebrow: 'HISTORIAL', title: 'Versiones', desc: 'Vuelve a cualquier momento de tu proyecto.', before: 'export' },
    async init() { timer = setInterval(tick, 30000); },
    onProject() { changes = 0; lastAt = Date.now(); lastPatch = JSON.parse(JSON.stringify(host.patch)); lastPrint = fingerprint(host.patch); load(); },
    onChange(key) { if (key === 'project.name') return; changes++; if (shouldSnapshot({ changes, lastAt: Date.now() })) snapshot({ auto: true }); },
    snapshot, // lo usa publicar
    render() {
      const named = list.filter(v => !v.auto).length; const bytes = totalBytes(list);
      return `${warning ? `<div class="notice warning">${esc(warning)}</div>` : ''}
      <form class="x-inline" data-xs="ver:save"><label class="sr" for="ver-name">Nombre de la versión</label><input id="ver-name" data-f="ver-name" maxlength="80" placeholder="Nombre, por ejemplo «Entrega al cliente»" autocomplete="off" ${ext.access.canEdit ? '' : 'disabled'}><button type="submit" class="button lime" ${ext.access.canEdit ? '' : 'disabled'}>Guardar versión</button></form>
      <p class="hint">Se guardan copias automáticas cada 10 cambios o cada 2 minutos si hubo cambios. Las versiones con nombre nunca se borran solas.</p>
      <div class="x-two" style="align-items:end"><label class="field"><span>Límite de versiones</span><input type="number" min="5" max="200" value="${Number(max) || 30}" data-xi="ver:max" data-f="ver-max"></label><div class="muted" style="padding-bottom:16px">${list.length} versiones · ${named} con nombre · ${esc(humanBytes(bytes || 1))}</div></div>
      <div class="row-list">${list.map(v => `<div class="x-ver"><div class="x-ver-head"><b>${esc(v.name || 'Versión automática')}</b><span class="tag">${v.auto ? 'Auto' : 'Manual'}</span></div><div class="row-meta">${esc(fmtDate(v.at))} · ${esc(v.author)}</div><p class="x-ver-sum">${esc(v.summary)}</p><div class="actions-row"><button type="button" class="button" data-x="ver:preview" data-xid="${esc(v.id)}">Ver</button><button type="button" class="button" data-x="ver:restore" data-xid="${esc(v.id)}" ${ext.access.canEdit ? '' : 'disabled'}>Restaurar</button><button type="button" class="icon-btn" data-x="ver:del" data-xid="${esc(v.id)}" aria-label="Eliminar versión ${esc(v.name || fmtDate(v.at))}" ${ext.access.canEdit ? '' : 'disabled'}>${ext.icon('trash')}</button></div></div>`).join('') || '<div class="empty-state">Todavía no hay versiones. Edita tu sitio o guarda una versión con nombre.</div>'}</div>`;
    },
    click(act, b) {
      const id = b.dataset.xid;
      if (act === 'preview') preview(id);
      else if (act === 'restore') { document.getElementById('version-dialog')?.close(); restore(id); }
      else if (act === 'del') {
        const v = list.find(x => x.id === id); if (!v) return;
        if (!v.auto && !confirm(`¿Eliminar la versión «${v.name}»? No se puede deshacer.`)) return;
        dbDelete('versions', id).then(() => { list = list.filter(x => x.id !== id); host.renderPanel(); }).catch(e => host.toast(e.message, true));
      }
    },
    async submit(act, form) {
      if (act !== 'save') return;
      if (!ext.canEdit()) { ext.denied(); return; }
      const input = form.querySelector('input'); const name = input.value.trim() || `Versión ${fmtDate(new Date().toISOString())}`;
      const v = await snapshot({ name, auto: false, force: true });
      if (v) { host.toast(`Versión «${name}» guardada.`); ext.audit('Versión guardada', `${host.project.name} · ${name}`); }
    },
    change(act, el) {
      if (act !== 'max') return;
      const n = Math.max(5, Math.min(200, Math.round(Number(el.value)) || DEFAULT_MAX)); max = n;
      try { localStorage.setItem(MAX_KEY, String(n)); } catch { /* opcional */ }
      prune().then(() => host.renderPanel());
    },
    summarize: summarizePatch
  };
}
