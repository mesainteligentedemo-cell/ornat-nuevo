// Panel «Propiedades»: colección de propiedades de la capa de datos compartida (shared/data.js).
// Lista con filtros, alta/edición rápida, ejemplos, y atajos para insertar el catálogo en la página.
export function create(host, ext) {
  const { esc } = host;
  const f = { q: '', operation: '', type: '', status: '', city: '' };
  let editing = null; // null | 'new' | id
  let unsub = null;
  const api = () => ext.data;
  const fmt = p => (p.price == null ? 'Precio por definir' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: p.currency || 'MXN', maximumFractionDigits: 0 }).format(p.price));
  const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const list = () => { try { return api() ? api().properties.list() : []; } catch { return []; } };
  const filtered = () => list().filter(p => (!f.operation || p.operation === f.operation) && (!f.type || p.type === f.type) && (!f.status || p.status === f.status) && (!f.city || p.city === f.city) && (!f.q || norm(`${p.title} ${p.zone} ${p.city} ${p.development}`).includes(norm(f.q))));
  const opts = (map, value, all) => `<option value="">${all}</option>` + Object.entries(map).map(([k, l]) => `<option value="${k}" ${value === k ? 'selected' : ''}>${esc(l)}</option>`).join('');

  function form(p) {
    const v = p || { title: '', operation: 'venta', type: 'casa', status: 'disponible', price: '', currency: 'MXN', city: '', zone: '', bedrooms: '', bathrooms: '', areaM2: '', featured: false };
    const m = ext.dataApi;
    const input = (key, label, type = 'text') => `<label class="field"><span>${label}</span><input data-pf="${key}" type="${type}" value="${esc(v[key] ?? '')}" ${type === 'number' ? 'min="0" step="any"' : 'maxlength="160"'}></label>`;
    const select = (key, label, map) => `<label class="field"><span>${label}</span><select data-pf="${key}">${Object.entries(map).map(([k, l]) => `<option value="${k}" ${v[key] === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
    return `<form class="x-propform card" data-xs="props:save" data-pid="${esc(p?.id || '')}"><h3>${p ? 'Editar propiedad' : 'Nueva propiedad'}</h3>${input('title', 'Nombre')}<div class="x-two">${select('operation', 'Operación', m.OPERATIONS)}${select('type', 'Tipo', m.PROPERTY_TYPES)}</div><div class="x-two">${input('price', 'Precio', 'number')}${select('currency', 'Moneda', { MXN: 'MXN', USD: 'USD' })}</div>${select('status', 'Estado', m.PROPERTY_STATUSES)}<div class="x-two">${input('city', 'Ciudad')}${input('zone', 'Zona')}</div><div class="x-two">${input('bedrooms', 'Recámaras', 'number')}${input('bathrooms', 'Baños', 'number')}</div>${input('areaM2', 'Construcción (m²)', 'number')}<label class="x-check"><input type="checkbox" data-pf="featured" ${v.featured ? 'checked' : ''}> Propiedad destacada</label><div class="actions-row"><button type="submit" class="button lime">Guardar</button><button type="button" class="button" data-x="props:cancel">Cancelar</button></div></form>`;
  }
  function card(p) {
    const m = ext.dataApi;
    return `<div class="x-prop"><div class="x-prop-head"><b>${esc(p.title)}</b><span class="tag">${esc(m.PROPERTY_STATUSES[p.status] || p.status)}</span></div><div class="row-meta"><span class="tag">${esc(m.OPERATIONS[p.operation] || p.operation)}</span>${esc(m.PROPERTY_TYPES[p.type] || p.type)} · ${esc([p.zone, p.city].filter(Boolean).join(', ') || 'Sin ubicación')}${p.featured ? ' · ★ destacada' : ''}${p.source === 'demo' ? ' · ejemplo' : ''}</div><div class="x-price">${esc(fmt(p))}</div>${ext.access.canEditProps ? `<div class="actions-row"><button type="button" class="button" data-x="props:edit" data-xid="${esc(p.id)}">Editar</button><button type="button" class="button" data-x="props:feature" data-xid="${esc(p.id)}" aria-pressed="${p.featured}">${p.featured ? 'Quitar destacada' : 'Destacar'}</button></div>` : ''}</div>`;
  }
  const refresh = () => { if (host.currentTab === 'props') host.renderPanel(); };

  return {
    tab: { id: 'props', label: 'Propiedades', icon: 'home', eyebrow: 'COLECCIÓN', title: 'Propiedades', desc: 'Tu inventario y su catálogo en la página.', before: 'site' },
    init() { if (api()) unsub = api().subscribe(topic => { if (['properties', 'all'].includes(topic)) refresh(); }); },
    render() {
      if (!api()) return '<div class="notice warning">La capa de datos compartida no está disponible. Recarga la página.</div>';
      const m = ext.dataApi; const all = list(); const shown = filtered(); const cities = [...new Set(all.map(p => p.city).filter(Boolean))].sort();
      const canEdit = ext.access.canEditProps;
      return `<div class="actions-row"><button type="button" class="button lime" data-x="props:catalog" ${ext.canEdit() ? '' : 'disabled'}>Insertar catálogo</button><button type="button" class="button" data-x="props:featured" ${ext.canEdit() ? '' : 'disabled'}>Insertar destacadas</button></div>
      <p class="hint">El catálogo se dibuja con tus propiedades reales de este navegador. Para probarlo carga ejemplos.</p>
      ${canEdit ? `<div class="actions-row" style="margin:10px 0"><button type="button" class="button" data-x="props:new">Nueva propiedad</button><button type="button" class="button" data-x="props:seed">Cargar ejemplos</button><button type="button" class="button" data-x="props:clear">Quitar ejemplos</button></div>` : '<div class="notice">Tu rol puede ver las propiedades, pero no editarlas.</div>'}
      ${editing ? form(editing === 'new' ? null : api().properties.get(editing)) : ''}
      <div class="filters"><div class="search-field">${ext.icon('search')}<label class="sr" for="prop-q">Buscar propiedad</label><input id="prop-q" type="search" data-f="prop-q" data-xi="props:q" value="${esc(f.q)}" placeholder="Buscar por nombre, zona o ciudad…" autocomplete="off"></div>
        <div class="x-two"><label class="sr" for="prop-op">Operación</label><select id="prop-op" data-f="prop-op" data-xi="props:filter" data-key="operation">${opts(m.OPERATIONS, f.operation, 'Toda operación')}</select><label class="sr" for="prop-type">Tipo</label><select id="prop-type" data-f="prop-type" data-xi="props:filter" data-key="type">${opts(m.PROPERTY_TYPES, f.type, 'Todo tipo')}</select></div>
        <div class="x-two"><label class="sr" for="prop-st">Estado</label><select id="prop-st" data-f="prop-st" data-xi="props:filter" data-key="status">${opts(m.PROPERTY_STATUSES, f.status, 'Todo estado')}</select><label class="sr" for="prop-city">Ciudad</label><select id="prop-city" data-f="prop-city" data-xi="props:filter" data-key="city"><option value="">Toda ciudad</option>${cities.map(c => `<option ${f.city === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div></div>
      <div class="filter-meta"><span role="status" aria-live="polite">${shown.length} de ${all.length} propiedades</span>${f.q || f.operation || f.type || f.status || f.city ? '<button type="button" class="text-btn" data-x="props:clearf">Limpiar filtros</button>' : ''}</div>
      <div class="row-list">${shown.map(card).join('') || `<div class="empty-state">${all.length ? 'Ninguna propiedad coincide con estos filtros.' : 'Todavía no hay propiedades. Carga ejemplos o crea la primera.'}</div>`}</div>`;
    },
    click(act, b) {
      const id = b.dataset.xid;
      if (act === 'catalog') { ext.mods.blk.insert('catalog', { title: 'Propiedades disponibles', mode: 'catalog', filters: true, limit: 6 }); return; }
      if (act === 'featured') { ext.mods.blk.insert('catalog', { title: 'Propiedades destacadas', mode: 'featured', filters: false, limit: 3 }); return; }
      if (act === 'clearf') { Object.assign(f, { q: '', operation: '', type: '', status: '', city: '' }); host.renderPanel(); return; }
      if (!ext.access.canEditProps) { ext.denied(); return; }
      try {
        if (act === 'new') { editing = 'new'; host.renderPanel(); }
        else if (act === 'edit') { editing = id; host.renderPanel(); }
        else if (act === 'cancel') { editing = null; host.renderPanel(); }
        else if (act === 'seed') { const n = api().properties.seedDemo(); host.toast(`${n} propiedades de ejemplo cargadas.`); }
        else if (act === 'clear') { api().properties.clearDemo(); host.toast('Quitaste las propiedades de ejemplo.'); }
        else if (act === 'feature') { const p = api().properties.get(id); api().properties.save({ ...p, featured: !p.featured }); }
      } catch (error) { host.toast(error.message, true); }
    },
    input(act, el) { if (act === 'q') { f.q = el.value; host.renderPanel(); } },
    change(act, el) { if (act === 'filter') { f[el.dataset.key] = el.value; host.renderPanel(); } },
    submit(act, form) {
      if (act !== 'save') return;
      const raw = {}; for (const el of form.querySelectorAll('[data-pf]')) raw[el.dataset.pf] = el.type === 'checkbox' ? el.checked : el.value;
      const base = form.dataset.pid ? api().properties.get(form.dataset.pid) : { source: 'manual' };
      try { api().properties.save({ ...base, ...raw, id: form.dataset.pid || undefined }); editing = null; host.toast('Propiedad guardada.'); host.renderPanel(); }
      catch (error) { host.toast(error.message, true); }
    }
  };
}
