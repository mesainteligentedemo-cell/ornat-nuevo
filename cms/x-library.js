// Biblioteca de medios: todas las imágenes subidas, sin duplicados (hash SHA-256), reutilizables en cualquier hueco o bloque.
import { dbAll, dbPut, dbDelete, readMedia } from './core.js';
import { hashString, mediaEntry, usageOf, filterLibrary, canDelete, LIB_TYPES, LIB_SIZES, LIB_USAGE, humanBytes } from './library.js';

export function create(host, ext) {
  const { esc } = host;
  let items = []; let openId = null; let pickTarget = null; let loaded = false;
  const f = { q: '', type: '', size: '', usage: '', noAlt: false };

  async function load() { try { items = await dbAll('media'); } catch { items = []; } loaded = true; refresh(); }
  const refresh = () => { if (host.currentTab === 'library') host.renderPanel(); const dlg = document.getElementById('library-dialog'); if (dlg?.open) renderPicker(); };

  // `media` es el resultado de readMedia(): src optimizado + medidas. logo: la subida venía de un hueco de logo.
  async function add(media, { logo = false } = {}) {
    if (!media?.src) return null;
    const hash = await hashString(media.src);
    const existing = items.find(i => i.id === hash);
    if (existing) return { item: existing, duplicate: true };
    const item = mediaEntry({ hash, name: media.name, src: media.src, width: media.storedWidth || media.width, height: media.storedHeight || media.height, bytes: media.bytes, storedBytes: media.storedBytes, type: media.type, hasAlpha: media.hasAlpha, logo, alt: '' });
    try { await dbPut('media', item); items = [item, ...items]; refresh(); return { item, duplicate: false }; }
    catch (error) { host.toast(error.message, true); return null; }
  }
  async function uploadFiles(files) {
    let added = 0, dup = 0; const failed = [];
    for (const file of files) {
      try { const media = await readMedia(file, { maxDimension: 3840 }); const r = await add(media, { logo: false }); if (r?.duplicate) dup++; else if (r) added++; }
      catch (error) { failed.push({ name: file.name, message: error.message }); }
    }
    // El resumen final reemplaza al aviso anterior: los archivos que fallaron se nombran aquí para que no se pierdan.
    const fail = failed.length === 1 ? ` · ${failed[0].name}: ${failed[0].message}` : failed.length ? ` · ${failed.length} no se pudieron leer (${failed.map(x => x.name).join(', ').slice(0, 120)}). Usa PNG, JPEG, WebP o AVIF.` : '';
    host.toast(`${added} ${added === 1 ? 'imagen añadida' : 'imágenes añadidas'}${dup ? ` · ${dup} ya estaba${dup === 1 ? '' : 'n'} en la biblioteca` : ''}${fail || '.'}`, failed.length > 0);
  }
  function labels() {
    const out = {};
    for (const i of host.allImages()) out[i.id] = i.alt || host.sectionLabel(i.section) || 'Imagen';
    return out;
  }
  function slotOptions() {
    const out = [['brandLogo', 'Logo de la marca']];
    for (const i of host.allImages()) out.push([i.id, `${i.kind === 'logo' ? 'Logo' : 'Imagen'}: ${(i.alt || host.sectionLabel(i.section) || i.id).slice(0, 40)}`]);
    return out;
  }
  function tile(it, picker) {
    const use = usageOf(host.patch, it.src, labels()); const open = !picker && openId === it.id;
    return `<div class="x-lib ${open ? 'is-open' : ''}"><button type="button" class="x-lib-pick" data-x="${picker ? 'lib:apply' : 'lib:open'}" data-xid="${esc(it.id)}" aria-label="${picker ? 'Usar' : 'Ver'} ${esc(it.name)}"><span class="thumb"><img src="${esc(it.src)}" alt="" loading="lazy">${use.length ? '<span class="tag">En uso</span>' : ''}${!String(it.alt).trim() ? '<span class="tag warn">Sin alt</span>' : ''}</span><span class="cap"><b>${esc(it.name)}</b><span class="row-meta">${Number(it.width) || 0}×${Number(it.height) || 0} · ${esc(humanBytes(it.storedBytes || it.bytes))}</span></span></button>${open ? detail(it, use) : ''}</div>`;
  }
  function detail(it, use) {
    const sel = host.sel; const canUse = ext.access.canEdit;
    const usable = sel && ['image', 'background', 'logo'].includes(sel.kind) ? `<button type="button" class="button lime" data-x="lib:use-selected" data-xid="${esc(it.id)}" ${canUse ? '' : 'disabled'}>Usar en lo seleccionado</button>` : '';
    return `<div class="x-lib-detail"><label class="field"><span>Descripción (alt)</span><input data-f="lib-alt-${esc(it.id.slice(0, 10))}" data-xi="lib:alt" data-xid="${esc(it.id)}" value="${esc(it.alt)}" maxlength="300" placeholder="Describe lo que se ve"></label>
      <label class="field"><span>Usar en…</span><select id="lib-slot-${esc(it.id.slice(0, 10))}" aria-label="Elegir dónde usar la imagen">${slotOptions().map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select></label>
      <div class="actions-row">${usable}<button type="button" class="button" data-x="lib:use-slot" data-xid="${esc(it.id)}" ${canUse ? '' : 'disabled'}>Aplicar</button></div>
      <div class="x-uses"><b>Dónde se usa</b>${use.length ? `<ul>${use.map(u => `<li>${esc(u.label)}</li>`).join('')}</ul>` : '<p class="muted">En ningún lugar de este proyecto.</p>'}</div>
      <button type="button" class="button full" data-x="lib:del" data-xid="${esc(it.id)}" ${canDelete(it, host.patch) && canUse ? '' : 'disabled'} title="${canDelete(it, host.patch) ? '' : 'Está en uso: quítala de donde se usa para poder borrarla'}">Borrar de la biblioteca</button></div>`;
  }
  const chips = (list, key) => [['', 'Todo'], ...list].map(([v, l]) => `<button type="button" class="chip" data-x="lib:filter" data-xv="${v}" data-key="${key}" aria-pressed="${f[key] === v}">${esc(l)}</button>`).join('');
  function filters(picker) {
    return `<div class="filters"><div class="search-field">${ext.icon('search')}<label class="sr" for="lib-q${picker ? '-p' : ''}">Buscar en la biblioteca</label><input id="lib-q${picker ? '-p' : ''}" type="search" data-f="lib-q${picker ? '-p' : ''}" data-xi="lib:q" value="${esc(f.q)}" placeholder="Buscar por nombre o descripción…" autocomplete="off"></div>
      <div class="chips-row wrap" role="group" aria-label="Tipo">${chips(LIB_TYPES, 'type')}</div><div class="chips-row wrap" role="group" aria-label="Tamaño">${chips(LIB_SIZES, 'size')}</div><div class="chips-row wrap" role="group" aria-label="Uso">${chips(LIB_USAGE, 'usage')}<button type="button" class="chip" data-x="lib:noalt" aria-pressed="${f.noAlt}">Sin alt</button></div></div>`;
  }
  const shownItems = () => filterLibrary(items, host.patch, f);
  function renderPicker() {
    const dlg = document.getElementById('library-dialog'); if (!dlg) return;
    const shown = shownItems(); const focusId = dlg.contains(document.activeElement) ? document.activeElement.id : ''; const caret = focusId ? document.activeElement.selectionStart : null;
    dlg.innerHTML = `<div class="dialog-head"><div><span class="eyebrow">TU BIBLIOTECA</span><h2>Elige una imagen</h2><p>Se aplicará sin volver a subirla.</p></div><button type="button" class="icon-btn" data-x="ui:close" aria-label="Cerrar biblioteca"><svg class="ic" aria-hidden="true"><use href="#i-close"/></svg></button></div>${filters(true)}<p class="result-count" role="status">${shown.length} de ${items.length} imágenes</p><div class="media-grid x-libgrid">${shown.map(i => tile(i, true)).join('') || '<div class="empty-state">No hay imágenes que coincidan. Sube una desde el panel Biblioteca.</div>'}</div><div class="actions-row" style="margin-top:12px"><button type="button" class="button" data-x="lib:upload">Subir imágenes</button></div>`;
    if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); try { el.setSelectionRange(caret, caret); } catch { /* sin selección */ } } }
  }
  function applyTo(target, item) {
    if (!ext.canEdit()) { ext.denied(); return false; }
    host.applyImage(target, item.src, item.alt, { width: item.width, height: item.height, bytes: item.bytes, type: item.type, name: item.name, hasAlpha: item.hasAlpha });
    ext.audit('Imagen aplicada desde la biblioteca', `${item.name} → ${target}`);
    return true;
  }
  function fileInput() {
    let input = document.getElementById('library-files');
    if (!input) { input = document.createElement('input'); input.type = 'file'; input.id = 'library-files'; input.multiple = true; input.hidden = true; input.accept = 'image/png,image/jpeg,image/webp,image/avif'; input.addEventListener('change', async () => { const files = [...input.files]; input.value = ''; if (files.length) await uploadFiles(files); }); document.body.append(input); }
    return input;
  }

  return {
    tab: { id: 'library', label: 'Biblioteca de medios', short: 'Biblioteca', icon: 'library', eyebrow: 'TUS ARCHIVOS', title: 'Biblioteca', desc: 'Sube una vez, usa donde quieras.', before: 'style' },
    init() { return load(); },
    add,
    pick(targetId) {
      if (!ext.canEdit()) { ext.denied(); return; }
      pickTarget = targetId;
      let dlg = document.getElementById('library-dialog');
      if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'library-dialog'; dlg.className = 'wide-dialog'; dlg.setAttribute('aria-label', 'Biblioteca de medios'); document.body.append(dlg); }
      renderPicker(); dlg.showModal();
    },
    render() {
      const shown = shownItems(); const total = items.reduce((s, i) => s + (i.storedBytes || 0), 0);
      return `${ext.access.canEdit ? `<button type="button" class="button lime full" data-x="lib:upload">Subir imágenes</button><p class="hint">PNG, JPEG, WebP o AVIF. Se optimizan en tu navegador y las repetidas no se duplican.</p>` : '<div class="notice">Tu rol puede ver la biblioteca, no cambiarla.</div>'}${filters(false)}<div class="filter-meta"><span role="status" aria-live="polite">${shown.length} de ${items.length} imágenes · ${esc(humanBytes(total || 1))}</span></div>${loaded && shown.length ? `<div class="media-grid x-libgrid">${shown.map(i => tile(i, false)).join('')}</div>` : `<div class="empty-state">${items.length ? 'Ninguna imagen coincide con estos filtros.' : 'Tu biblioteca está vacía. Las imágenes que subas en cualquier hueco aparecerán aquí.'}</div>`}`;
    },
    click(act, b) {
      const id = b.dataset.xid;
      if (act === 'upload') { fileInput().click(); return; }
      if (act === 'open') { openId = openId === id ? null : id; host.renderPanel(); return; }
      if (act === 'filter') { f[b.dataset.key] = f[b.dataset.key] === b.dataset.xv ? '' : b.dataset.xv; refresh(); return; }
      if (act === 'noalt') { f.noAlt = !f.noAlt; refresh(); return; }
      const item = items.find(i => i.id === id);
      if (act === 'apply' && item && pickTarget) { if (applyTo(pickTarget, item)) { document.getElementById('library-dialog')?.close(); host.toast('Imagen aplicada desde la biblioteca.'); } return; }
      if (!item) return;
      if (act === 'use-selected') { const sel = host.sel; if (sel?.id && applyTo(sel.id, item)) host.toast('Imagen aplicada a lo seleccionado.'); return; }
      if (act === 'use-slot') { const target = document.getElementById('lib-slot-' + id.slice(0, 10))?.value; if (target && applyTo(target, item)) host.toast('Imagen aplicada.'); return; }
      if (act === 'del') {
        if (!canDelete(item, host.patch)) { host.toast('Esa imagen está en uso en este proyecto.', true); return; }
        if (!confirm('¿Borrar esta imagen de la biblioteca? Otros proyectos que ya la usan no se afectan.')) return;
        dbDelete('media', id).then(() => { items = items.filter(i => i.id !== id); openId = null; refresh(); }).catch(e => host.toast(e.message, true));
      }
    },
    input(act, el) {
      if (act === 'q') { f.q = el.value; refresh(); return; }
      if (act === 'alt') { const item = items.find(i => i.id === el.dataset.xid); if (!item) return; item.alt = el.value; clearTimeout(this._t); this._t = setTimeout(() => dbPut('media', item).catch(() => {}), 400); }
    }
  };
}
