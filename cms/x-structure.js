// Panel «Estructura»: el árbol de la plantilla (secciones → elementos repetidos → textos, imágenes y botones) con ojo, candado y acciones
// (duplicar, quitar, mover), el estilo de cada sección y el inventario de efectos dibujados por código.
// Todo cambio es un patch validado (layout, items, sectionStyles); el lienzo solo lo aplica.
import { PAD_STEPS, MAX_CLONES, newCloneId, allCloneIds, duplicateSection, removeSection, restoreSection, setSectionOrder, duplicateItem, removeItem, restoreItem, setItemOrder, moveToIndex, structureEdits } from './layout.js';
import { contrastRatio } from './core.js';

const TYPE_ICON = {
  title: '<path d="M4 5V4h12v1M10 4v12M7.5 16h5"/>', text: '<path d="M3 5h14M3 9h14M3 13h9"/>', button: '<rect x="3" y="6" width="14" height="8" rx="4"/>', tag: '<path d="M3 10 10 3h6v6l-7 7z"/>',
  image: '<rect x="3" y="4" width="14" height="12" rx="2"/><circle cx="7.5" cy="8.5" r="1.3"/><path d="m4 15 4-4 3 3 2-2 3 3"/>', icon: '<circle cx="10" cy="10" r="6"/><path d="m7 10 2 2 4-4"/>',
  video: '<rect x="3" y="5" width="14" height="10" rx="2"/><path d="m9 8 4 2-4 2z"/>', logo: '<circle cx="10" cy="10" r="6.5"/><path d="M7 12.5 10 6l3 6.500"/>'
};
const tIcon = k => `<svg class="ic st-type" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TYPE_ICON[k] || TYPE_ICON.text}</svg>`;
const KIND_NAME = { title: 'Título', text: 'Texto', button: 'Botón', tag: 'Etiqueta', image: 'Imagen', icon: 'Ícono', video: 'Video', logo: 'Logo', background: 'Fondo' };

export function create(host, ext) {
  const { esc } = host;
  let known = new Set();
  const open = new Set(); let showMore = new Set(); let pendingNav = null; let drag = null;
  const inv = () => host.inventory; const patch = () => host.patch;
  const sections = () => (inv().sections || []).filter(s => s.layout?.eligible || s.leaf !== false || lists().some(l => l.section === s.id) || (inv().texts || []).some(t => String(t.section) === String(s.id)));
  const sec = id => (inv().sections || []).find(s => String(s.id) === String(id));
  const lists = () => inv().lists || [];
  const list = id => lists().find(l => l.id === id);
  const label = id => host.sectionLabel(id);
  const group = s => (inv().sections || []).filter(x => x.layout?.eligible && x.layout.group === s.layout.group).sort((a, b) => a.layout.pos - b.layout.pos);
  const reasonToast = text => host.toast(text, true);
  const can = () => { if (!ext.canEdit()) { ext.denied(); return false; } return true; };

  // ---------- acciones sobre secciones ----------
  function moveSection(id, dir) {
    if (!can()) return; const s = sec(id); if (!s?.layout?.eligible) return;
    if (!s.layout.canMove) { reasonToast(`«${label(id)}» no se puede mover. ${s.layout.moveReason}`); return; }
    const g = group(s); const i = g.findIndex(x => x.id === id); let j = i + dir;
    while (g[j]?.layout.removed) j += dir;
    const n = g[j]; if (!n) { host.toast('Ya está en el extremo.'); return; }
    if (!n.layout.canMove) { reasonToast(`No se puede pasar por encima de «${label(n.id)}». ${n.layout.moveReason}`); return; }
    const seq = g.map(x => x.id); [seq[i], seq[j]] = [seq[j], seq[i]];
    host.commit(setSectionOrder(patch(), seq), 'layout:move:' + id); pendingNav = 'section:' + id;
  }
  function moveSectionTo(id, targetId) {
    if (!can()) return; const s = sec(id); if (!s?.layout?.canMove) { if (s) reasonToast(`«${label(id)}» no se puede mover. ${s.layout.moveReason}`); return; }
    const g = group(s); const seq = g.map(x => x.id); const a = seq.indexOf(id); const b = seq.indexOf(targetId); if (a < 0 || b < 0 || a === b) return;
    const lo = Math.min(a, b), hi = Math.max(a, b);
    const blocker = g.find((x, k) => k >= lo && k <= hi && x.id !== id && !x.layout.canMove);
    if (blocker) { reasonToast(`No se puede pasar por encima de «${label(blocker.id)}». ${blocker.layout.moveReason}`); return; }
    const next = moveToIndex(seq, id, b); if (!next) return;
    host.commit(setSectionOrder(patch(), next), 'layout:drag:' + id); pendingNav = 'section:' + id;
  }
  function dupSection(id) {
    if (!can()) return; const s = sec(id); if (!s?.layout?.eligible) return;
    if (!s.layout.canDup) { reasonToast(`«${label(id)}» no se puede duplicar. ${s.layout.dupReason}`); return; }
    if ((patch().layout?.clones || []).length >= MAX_CLONES) { reasonToast(`Ya hay ${MAX_CLONES} secciones duplicadas (el máximo).`); return; }
    const r = duplicateSection(patch(), { of: id, cloneId: newCloneId(allCloneIds(patch())), sequence: group(s).map(x => x.id), elementIds: s.layout.ids || [] });
    if (host.replacePatch(r.patch)) { pendingNav = 'section:' + r.id; open.add('s:' + r.id); ext.audit('Sección duplicada', label(id)); host.toast(`Duplicaste «${label(id)}». La copia se edita por separado.`); }
  }
  function delSection(id) {
    if (!can()) return; const s = sec(id); if (!s?.layout?.eligible) return;
    const next = removeSection(patch(), { id, cloneId: s.layout.clone });
    if (host.replacePatch(next)) { ext.audit('Sección quitada', label(id)); host.toast(`Quitaste «${label(id)}».`, false, { label: 'Deshacer', run: host.undo }); }
  }
  // ---------- acciones sobre elementos repetidos ----------
  function itemSeq(l) { return l.items.map(i => i.id); }
  function moveItem(listId, itemId, dir) {
    if (!can()) return; const l = list(listId); if (!l) return;
    if (!l.caps.move) { reasonToast(l.caps.reason || 'Estos elementos no se pueden mover.'); return; }
    const seq = itemSeq(l); const vis = l.items.filter(i => !i.removed).map(i => i.id); const k = vis.indexOf(itemId);
    const other = vis[k + dir]; if (!other) { host.toast('Ya está en el extremo.'); return; }
    const a = seq.indexOf(itemId), b = seq.indexOf(other); [seq[a], seq[b]] = [seq[b], seq[a]];
    host.commit(setItemOrder(patch(), listId, seq), 'items:move:' + itemId); pendingNav = 'item:' + itemId;
  }
  function moveItemTo(listId, itemId, targetId) {
    if (!can()) return; const l = list(listId); if (!l) return;
    if (!l.caps.move) { reasonToast(l.caps.reason || 'Estos elementos no se pueden mover.'); return; }
    const next = moveToIndex(itemSeq(l), itemId, itemSeq(l).indexOf(targetId)); if (!next) return;
    host.commit(setItemOrder(patch(), listId, next), 'items:drag:' + itemId); pendingNav = 'item:' + itemId;
  }
  function dupItem(listId, itemId) {
    if (!can()) return; const l = list(listId); if (!l) return;
    if (!l.caps.add) { reasonToast(l.caps.reason || 'Estos elementos no se pueden duplicar.'); return; }
    if ((patch().items?.[listId]?.clones || []).length >= MAX_CLONES) { reasonToast(`Ya hay ${MAX_CLONES} copias en esta lista (el máximo).`); return; }
    const it = l.items.find(i => i.id === itemId); if (!it) return;
    const r = duplicateItem(patch(), { listId, of: itemId, cloneId: newCloneId(allCloneIds(patch())), sequence: itemSeq(l), elementIds: it.ids || [] });
    if (host.replacePatch(r.patch)) { pendingNav = 'item:' + r.id; open.add('l:' + listId); ext.audit('Elemento duplicado', `${l.label} · ${it.label}`); host.toast(`Duplicaste «${it.label}». Haz clic en sus textos para editar la copia.`); }
  }
  function delItem(listId, itemId) {
    if (!can()) return; const l = list(listId); if (!l) return;
    if (!l.caps.remove) { reasonToast(l.caps.reason || 'Estos elementos no se pueden quitar.'); return; }
    const it = l.items.find(i => i.id === itemId);
    if (host.replacePatch(removeItem(patch(), { listId, itemId }))) { ext.audit('Elemento quitado', `${l.label} · ${it?.label || ''}`); host.toast(`Quitaste «${it?.label || 'el elemento'}».`, false, { label: 'Deshacer', run: host.undo }); }
  }

  // ---------- estilo de sección ----------
  function setSectionStyle(id, fn, group) {
    if (!can()) return;
    const cur = { ...(patch().sectionStyles?.[id] || {}) }; fn(cur);
    for (const k of Object.keys(cur)) if (cur[k] === undefined || cur[k] === null || cur[k] === '' || cur[k] === false) delete cur[k];
    const map = { ...(patch().sectionStyles || {}) }; if (Object.keys(cur).length) map[id] = cur; else delete map[id];
    const next = { ...patch() }; if (Object.keys(map).length) next.sectionStyles = map; else delete next.sectionStyles;
    host.commit(next, `secstyle:${id}:${group}`);
  }
  const sel = (key, options, value, id, labelText) => `<label class="field"><span>${esc(labelText)}</span><select data-xi="str:pad" data-xid="${esc(id)}" data-key="${key}"><option value="">Original</option>${options.map(o => `<option value="${o}" ${String(value) === String(o) ? 'selected' : ''}>${o} px</option>`).join('')}</select></label>`;
  function styleCard(s) {
    const id = s.id; const st = patch().sectionStyles?.[id] || {}; const look = s.layout?.look || {};
    const bg = st.bg || ''; let contrast = '';
    if (bg) { try { const w = contrastRatio(bg.length === 4 ? '#' + [...bg.slice(1)].map(c => c + c).join('') : bg, '#ffffff'); const k = contrastRatio(bg.length === 4 ? '#' + [...bg.slice(1)].map(c => c + c).join('') : bg, '#000000'); contrast = `<small>Contraste orientativo: texto blanco ${w.toFixed(1)}:1 · texto negro ${k.toFixed(1)}:1 (WCAG pide 4.5:1 en texto normal).</small>`; } catch { /* color inválido */ } }
    const pos = String(st.bgImage?.position || '50% 50%').match(/[\d.]+/g) || ['50', '50'];
    const al = (v, t) => `<button type="button" class="chip" data-x="str:align" data-xid="${esc(id)}" data-xv="${v}" aria-pressed="${(st.align || '') === v}">${t}</button>`;
    return `<div class="card st-style" data-style-card="${esc(id)}"><h3>Estilo de la sección</h3>
      <div class="x-two">${sel('padTop', PAD_STEPS, st.padTop, id, 'Espacio arriba' + (look.pt !== undefined ? ` (hoy ${look.pt} px)` : ''))}${sel('padBottom', PAD_STEPS, st.padBottom, id, 'Espacio abajo' + (look.pb !== undefined ? ` (hoy ${look.pb} px)` : ''))}</div>
      <div class="field"><span>Alineación del contenido</span><div class="chips-row" role="group" aria-label="Alineación">${al('', 'Original')}${al('left', 'Izquierda')}${al('center', 'Centro')}${al('right', 'Derecha')}</div><small>Aplica a los textos que heredan la alineación de la sección.</small></div>
      <div class="field"><span>Color de fondo</span><div class="x-inline"><input type="color" data-xi="str:bgcolor" data-xid="${esc(id)}" value="${esc(/^#[0-9a-f]{6}$/i.test(bg) ? bg : look.bg || '#ffffff')}" aria-label="Color de fondo de la sección"><input data-f="sbg-${esc(id)}" data-xi="str:bghex" data-xid="${esc(id)}" value="${esc(bg)}" placeholder="#RRGGBB (vacío = original)" maxlength="7" aria-label="Código del color de fondo" spellcheck="false"></div>${contrast}</div>
      <div class="field"><span>Imagen de fondo</span>${st.bgImage?.src ? `<div class="media-picture" style="margin-bottom:8px"><img src="${esc(st.bgImage.src)}" alt="Fondo de la sección" loading="lazy" style="object-fit:cover"></div>` : ''}<div class="actions-row"><button type="button" class="button" data-x="str:bgupload" data-xid="${esc(id)}">Subir</button><button type="button" class="button" data-x="str:bglib" data-xid="${esc(id)}">Biblioteca</button>${st.bgImage ? `<button type="button" class="button" data-x="str:bgclear" data-xid="${esc(id)}">Quitar</button>` : ''}</div></div>
      ${st.bgImage ? `<label class="field"><span>Encuadre horizontal <output>${pos[0]}%</output></span><input type="range" min="0" max="100" value="${pos[0]}" data-xi="str:bgpos" data-xid="${esc(id)}" data-axis="0"></label><label class="field"><span>Encuadre vertical <output>${pos[1]}%</output></span><input type="range" min="0" max="100" value="${pos[1]}" data-xi="str:bgpos" data-xid="${esc(id)}" data-axis="1"></label>` : ''}
      <label class="field"><span>Superposición oscura para legibilidad <output>${st.overlay || 0}%</output></span><input type="range" min="0" max="90" step="5" value="${st.overlay || 0}" data-xi="str:overlay" data-xid="${esc(id)}"></label>
      <label class="x-check"><input type="checkbox" data-xi="str:hide" data-xid="${esc(id)}" data-key="hideMobile" ${st.hideMobile ? 'checked' : ''}> Ocultar en móvil</label>
      <label class="x-check"><input type="checkbox" data-xi="str:hide" data-xid="${esc(id)}" data-key="hideDesktop" ${st.hideDesktop ? 'checked' : ''}> Ocultar en escritorio</label>
      ${patch().sectionStyles?.[id] ? `<button type="button" class="button full" data-x="str:stylereset" data-xid="${esc(id)}">Restablecer el estilo de esta sección</button>` : ''}</div>`;
  }

  // ---------- HTML del árbol ----------
  const btn = (act, id, extra, icon, labelText, { disabled = false, title = '' } = {}) => `<button type="button" class="icon-btn st-btn" data-x="str:${act}" data-xid="${esc(id)}" ${extra} aria-label="${esc(labelText)}" title="${esc(title || labelText)}" ${disabled ? 'aria-disabled="true"' : ''}>${ext.icon(icon)}</button>`;
  function elementRow(e, kind) {
    const hid = !!patch().hidden?.[e.id]; const dynamic = e.dynamic;
    const text = kind === 'text' ? (patch().texts?.[e.id] ?? e.text) : (e.alt || KIND_NAME[e.kind] || 'Imagen');
    const type = kind === 'text' ? (e.type || 'text') : (e.kind === 'background' ? 'image' : e.kind || 'image');
    return `<div class="st-el ${hid ? 'is-hidden-row' : ''}" data-st-el="${esc(e.id)}"><button type="button" class="row-main" data-x="str:pick" data-xid="${esc(e.id)}">${tIcon(type)}<span class="row-text">${esc(String(text).slice(0, 60))}</span><span class="row-meta">${esc(KIND_NAME[type] || 'Texto')}${dynamic ? ' · bloqueado por animación' : ''}</span></button>${dynamic ? `<span class="st-lock" title="Este texto lo reescribe la animación de la plantilla" role="img" aria-label="Bloqueado por animación">${ext.icon('lock')}</span>` : ''}<button type="button" class="row-eye" data-toggle-hide="${esc(e.id)}" aria-pressed="${hid}" aria-label="${hid ? 'Mostrar' : 'Ocultar'} ${esc(String(text).slice(0, 30))}" title="${hid ? 'Mostrar' : 'Ocultar'}">${host.icon(hid ? 'eye-off' : 'eye')}</button></div>`;
  }
  function elementsOf(pred, key) {
    const t = (inv().texts || []).filter(pred); const im = [...(inv().images || []), ...(inv().logos || [])].filter(pred).filter((x, i, a) => a.findIndex(y => y.id === x.id) === i);
    const all = [...t.map(x => ['text', x]), ...im.map(x => ['media', x])]; const lim = showMore.has(key) ? 200 : 8;
    return all.slice(0, lim).map(([k, x]) => elementRow(x, k)).join('') + (all.length > lim ? `<button type="button" class="text-btn" data-x="str:more" data-xid="${esc(key)}">Mostrar más (${all.length - lim})</button>` : '') + (all.length ? '' : '<p class="hint">Sin textos ni imágenes propias.</p>');
  }
  function itemRows(l) {
    const horiz = l.axis === 'x'; const move = (dir, it) => {
      const lock = !l.caps.move; const [a, ic] = dir < 0 ? [horiz ? 'Mover antes' : 'Subir', horiz ? 'left' : 'up'] : [horiz ? 'Mover después' : 'Bajar', horiz ? 'right' : 'down'];
      return btn('imove', l.id, `data-xv="${dir}" data-item="${esc(it.id)}"`, ic, `${a}: ${it.label}`, { disabled: lock, title: lock ? l.caps.reason : a });
    };
    return l.items.map((it, i) => {
      const isOpen = open.has('i:' + it.id);
      if (it.removed) return `<div class="st-item is-removed" data-st-item="${esc(it.id)}"><span class="row-text">${esc(it.label)} <em>(quitado)</em></span><button type="button" class="button" data-x="str:irestore" data-xid="${esc(l.id)}" data-item="${esc(it.id)}">Restaurar</button></div>`;
      return `<div class="st-item ${isOpen ? 'is-open' : ''}" data-st-item="${esc(it.id)}" data-drag-kind="item" data-drag-group="${esc(l.id)}" data-drag-id="${esc(it.id)}"><div class="row-head"><button type="button" class="x-grip st-grip" data-sgrip aria-label="Arrastrar ${esc(it.label)} para reordenar" title="Arrastra para reordenar" ${l.caps.move ? '' : 'aria-disabled="true"'}>${ext.icon(l.caps.move ? 'grip' : 'lock')}</button><button type="button" class="row-main" data-x="str:itempick" data-item="${esc(it.id)}" aria-expanded="${isOpen}"><span class="row-text">${esc(it.label)}</span><span class="row-meta">${it.clone ? '<span class="tag">Copia</span>' : ''}${i + 1} de ${l.items.filter(x => !x.removed).length}</span></button><div class="x-actions">${move(-1, it)}${move(1, it)}${btn('idup', l.id, `data-item="${esc(it.id)}"`, 'copy', `Duplicar ${it.label}`, { disabled: !l.caps.add, title: l.caps.add ? 'Duplicar' : l.caps.reason })}${btn('idel', l.id, `data-item="${esc(it.id)}"`, 'trash', `Quitar ${it.label}`, { disabled: !l.caps.remove, title: l.caps.remove ? 'Quitar' : l.caps.reason })}</div></div>${isOpen ? `<div class="st-children">${elementsOf(e => e.item === it.id, 'it:' + it.id)}</div>` : ''}</div>`;
    }).join('');
  }
  function listBlock(l) {
    const isOpen = open.has('l:' + l.id);
    return `<div class="st-list"><button type="button" class="st-list-head" data-x="str:listtoggle" data-xid="${esc(l.id)}" aria-expanded="${isOpen}"><b>${esc(l.label)}</b><span class="row-meta">${l.items.filter(i => !i.removed).length} elementos${l.caps.reason ? ' · ' + esc(l.caps.reason) : ''}</span></button>${isOpen ? `<div class="st-children">${itemRows(l)}${l.caps.add && l.items.length ? `<button type="button" class="button full" data-x="str:iadd" data-xid="${esc(l.id)}">Agregar otro (duplica el último)</button>` : ''}</div>` : ''}</div>`;
  }
  function sectionBlock(s, i) {
    const L = s.layout || {}; const id = s.id; const isOpen = open.has('s:' + id);
    const hid = !!patch().hidden?.['section:' + id]; const here = host.currentSection === id;
    const mv = (dir) => { const lock = !L.canMove; const t = dir < 0 ? 'Subir' : 'Bajar'; return btn('smove', id, `data-xv="${dir}"`, dir < 0 ? 'up' : 'down', `${t} ${label(id)}`, { disabled: lock, title: lock ? L.moveReason : t }); };
    const own = x => (s.pseudo ? !known.has(String(x.section)) : String(x.section) === String(id));
    const mine = lists().filter(own);
    return `<div class="st-sec ${hid ? 'is-hidden-row' : ''} ${here ? 'is-current' : ''}" data-st-sec="${esc(id)}" ${L.eligible ? `data-drag-kind="sec" data-drag-group="${esc(L.group)}" data-drag-id="${esc(id)}"` : ''}>
      <div class="row-head">${L.eligible ? `<button type="button" class="x-grip st-grip" data-sgrip aria-label="Arrastrar ${esc(label(id))} para reordenar" title="${esc(L.canMove ? 'Arrastra para reordenar' : L.moveReason)}" ${L.canMove ? '' : 'aria-disabled="true"'}>${ext.icon(L.canMove ? 'grip' : 'lock')}</button>` : '<span class="section-index" aria-hidden="true">·</span>'}
      <button type="button" class="row-main" data-x="str:sectoggle" data-xid="${esc(id)}" aria-expanded="${isOpen}"><span class="row-text">${i + 1}. ${esc(s.pseudo ? 'Fuera de las secciones' : label(id))}</span><span class="row-meta"><span class="tag">${esc(s.leaf === false && !L.eligible ? 'Contenedor' : { header: 'Encabezado', footer: 'Pie', nav: 'Menú', main: 'Contenido' }[s.tag] || 'Sección')}</span>${L.clone ? '<span class="tag">Copia</span>' : ''}${mine.length ? mine.length + (mine.length === 1 ? ' lista · ' : ' listas · ') : ''}${(inv().texts || []).filter(own).length} textos${L.eligible && !L.canMove ? ' · fija' : ''}</span></button>
      <div class="x-actions">${L.eligible ? mv(-1) + mv(1) + btn('sdup', id, '', 'copy', `Duplicar ${label(id)}`, { disabled: !L.canDup, title: L.canDup ? 'Duplicar' : L.dupReason }) + btn('sdel', id, '', 'trash', `Quitar ${label(id)}`, { title: 'Quitar' }) : ''}${s.pseudo ? '' : `<button type="button" class="row-eye" data-toggle-section="${esc(id)}" aria-pressed="${hid}" aria-label="${hid ? 'Mostrar' : 'Ocultar'} la sección ${esc(label(id))}" title="${hid ? 'Mostrar' : 'Ocultar'}">${host.icon(hid ? 'eye-off' : 'eye')}</button>`}</div></div>
      ${isOpen ? `<div class="st-children">${L.eligible && !L.canMove ? `<p class="hint st-why">${ext.icon('lock')} No se puede mover: ${esc(L.moveReason)}</p>` : ''}${L.eligible && !L.canDup ? `<p class="hint st-why">${ext.icon('lock')} No se puede duplicar: ${esc(L.dupReason)}</p>` : ''}${L.eligible ? styleCard(s) : ''}${mine.map(listBlock).join('')}<h4 class="st-sub">Otros textos e imágenes</h4>${elementsOf(e => own(e) && !e.item, 'sec:' + id)}</div>` : ''}</div>`;
  }
  function effectsBlock() {
    const fx = (inv().effects || []); if (!fx.length) return '';
    return `<h3 class="section-title">Efectos dibujados por código</h3><p class="muted">Estos efectos los genera el código de la plantilla (canvas, WebGL o 3D). No se editan como diseño: ni su forma, ni su movimiento, ni sus colores internos.</p>${fx.map(f => `<div class="card st-fx"><b>${esc(f.label)}</b> <span class="tag ${f.editable ? '' : 'warn'}">${f.editable ? 'Se pueden reemplazar sus imágenes' : 'Solo código'}</span><p class="hint">${esc(f.note)}</p></div>`).join('')}`;
  }

  const api = {
    tab: { id: 'structure', label: 'Estructura', icon: 'tree', eyebrow: 'TODA LA PLANTILLA', title: 'Estructura', desc: 'Secciones y elementos: duplica, quita, mueve y da estilo.', before: 'sections' },
    render() {
      if (!ext.canEdit()) return ext.readOnlyIntro();
      const list0 = sections(); known = new Set((inv().sections || []).map(s => String(s.id)));
      const loose = lists().some(l => !known.has(String(l.section))) || (inv().texts || []).some(t => !known.has(String(t.section)));
      const list = loose ? [...list0, { id: 'general', tag: '', leaf: true, layout: {}, pseudo: true }] : list0; const removed = (inv().sections || []).filter(s => s.layout?.removed);
      const edits = structureEdits(patch());
      const mobile = '';
      return `<div class="notice">Esta es la vista completa de tu plantilla: cada sección y cada elemento repetido (tarjetas, menús, galerías, preguntas…). Duplicar crea una copia que se edita por separado; el candado indica lo que la animación de la plantilla protege.${edits ? ` <b>${edits} cambios de estructura.</b>` : ''}</div>${mobile}
      <div class="st-tree">${list.map(sectionBlock).join('') || '<div class="empty-state">Las secciones aparecerán cuando cargue la plantilla.</div>'}</div>
      ${removed.length ? `<h3 class="section-title">Secciones quitadas</h3>${removed.map(s => `<div class="st-item is-removed"><span class="row-text">${esc(label(s.id))}</span><button type="button" class="button" data-x="str:srestore" data-xid="${esc(s.id)}">Restaurar</button></div>`).join('')}` : ''}
      ${effectsBlock()}
      <p class="hint">Reordenar: arrastra el asa de cada fila o usa las flechas. Si algo no se puede mover, el candado explica por qué.</p>`;
    },
    click(act, b) {
      const id = b.dataset.xid; const item = b.dataset.item;
      const toggle = key => { if (open.has(key)) open.delete(key); else open.add(key); host.renderPanel(); };
      if (act === 'sectoggle') { toggle('s:' + id); if (open.has('s:' + id)) host.send('goto-section', { id }); return; }
      if (act === 'listtoggle') return toggle('l:' + id);
      if (act === 'itempick') { toggle('i:' + item); host.send('navigate', { id: 'item:' + item }); return; }
      if (act === 'more') { showMore.add(id); host.renderPanel(); return; }
      if (act === 'pick') { host.send('navigate', { id }); return; }
      if (act === 'smove') return moveSection(id, Number(b.dataset.xv));
      if (act === 'sdup') return dupSection(id);
      if (act === 'sdel') return delSection(id);
      if (act === 'srestore') { if (can()) host.replacePatch(restoreSection(patch(), id)); return; }
      if (act === 'imove') return moveItem(id, item, Number(b.dataset.xv));
      if (act === 'idup') return dupItem(id, item);
      if (act === 'idel') return delItem(id, item);
      if (act === 'iadd') { const l = list_(id); const last = [...(l?.items || [])].reverse().find(i => !i.removed); if (last) dupItem(id, last.id); return; }
      if (act === 'irestore') { if (can()) host.replacePatch(restoreItem(patch(), { listId: id, itemId: item })); return; }
      if (act === 'align') return setSectionStyle(id, s => { s.align = b.dataset.xv; }, 'align');
      if (act === 'bgupload') { host.pickUpload('secbg:' + id); return; }
      if (act === 'bglib') { ext.mods.lib.pick('secbg:' + id); return; }
      if (act === 'bgclear') { setSectionStyle(id, s => { delete s.bgImage; }, 'bg'); host.renderPanel(); return; }
      if (act === 'stylereset') { const next = { ...patch() }; const map = { ...(next.sectionStyles || {}) }; delete map[id]; if (Object.keys(map).length) next.sectionStyles = map; else delete next.sectionStyles; host.replacePatch(next); return; }
    },
    input(act, el) {
      const id = el.dataset.xid;
      if (act === 'bgcolor') { setSectionStyle(id, s => { s.bg = el.value; }, 'bg'); const hex = el.parentElement.querySelector('input:not([type=color])'); if (hex) hex.value = el.value; return; }
      if (act === 'bghex') { const v = el.value.trim(); if (v === '' ) { setSectionStyle(id, s => { delete s.bg; }, 'bg'); el.setCustomValidity(''); return; } if (/^#[0-9a-f]{6}$/i.test(v) || /^#[0-9a-f]{3}$/i.test(v)) { el.setCustomValidity(''); setSectionStyle(id, s => { s.bg = v.toLowerCase(); }, 'bg'); } else el.setCustomValidity('Usa #RGB o #RRGGBB.'); return; }
      if (act === 'overlay') { el.closest('label').querySelector('output').textContent = el.value + '%'; setSectionStyle(id, s => { s.overlay = Number(el.value) || undefined; }, 'ov'); return; }
      if (act === 'bgpos') {
        const cur = patch().sectionStyles?.[id]?.bgImage; if (!cur) return;
        const xy = String(cur.position || '50% 50%').match(/[\d.]+/g) || ['50', '50']; xy[Number(el.dataset.axis)] = el.value; el.closest('label').querySelector('output').textContent = el.value + '%';
        setSectionStyle(id, s => { s.bgImage = { ...s.bgImage, position: xy.map(n => n + '%').join(' ') }; }, 'pos');
      }
    },
    change(act, el) {
      const id = el.dataset.xid;
      if (act === 'pad') { const v = el.value === '' ? undefined : Number(el.value); setSectionStyle(id, s => { s[el.dataset.key] = v; }, el.dataset.key); host.renderPanel(); return; }
      if (act === 'hide') { setSectionStyle(id, s => { s[el.dataset.key] = el.checked; }, el.dataset.key); }
    },
    message(m) {
      if (m.type === 'selected' && m.id && host.currentTab === 'structure') {
        const sid = m.layout?.id || m.section; if (sid) open.add('s:' + sid);
        if (m.item) { open.add('l:' + m.item.listId); open.add('i:' + m.item.itemId); }
        host.renderPanel();
      }
      if ((m.type === 'inventory' || m.type === 'applied') && pendingNav) {
        const target = pendingNav; const found = target.startsWith('item:') ? lists().some(l => l.items.some(i => 'item:' + i.id === target)) : (inv().sections || []).some(s => 'section:' + s.id === target);
        if (found) { pendingNav = null; host.send('navigate', { id: target }); }
      }
    },
    onChange() { if (host.currentTab === 'structure') clearTimeout(this._t), this._t = setTimeout(() => host.renderPanel(), 250); },
    // usados por la barra flotante y las otras pestañas
    moveSection, dupSection, delSection, moveItem, dupItem, delItem, moveSectionTo, moveItemTo, setSectionStyle,
    openFor(sid) { open.add('s:' + sid); },
    startDrag(e) {
      const grip = e.target.closest?.('[data-sgrip]'); if (!grip || e.button > 0) return false;
      const row = grip.closest('[data-drag-id]'); if (!row || grip.getAttribute('aria-disabled') === 'true') { if (grip.getAttribute('aria-disabled') === 'true') { const kind = row?.dataset.dragKind; const l = kind === 'item' ? list(row.dataset.dragGroup) : null; const s = kind === 'sec' ? sec(row.dataset.dragId) : null; reasonToast(l?.caps.reason || s?.layout.moveReason || 'Esto no se puede mover.'); } return false; }
      drag = { kind: row.dataset.dragKind, group: row.dataset.dragGroup, id: row.dataset.dragId, row, target: null, pointerId: e.pointerId, x0: e.clientY, active: false };
      const move = ev => {
        if (ev.pointerId !== drag.pointerId) return;
        if (!drag.active && Math.abs(ev.clientY - drag.x0) < 5) return;
        drag.active = true; row.classList.add('is-dragging'); ev.preventDefault();
        const rows = [...document.querySelectorAll(`[data-drag-kind="${drag.kind}"][data-drag-group="${CSS.escape(drag.group)}"]`)];
        document.querySelectorAll('.drop-mark').forEach(x => x.classList.remove('drop-mark'));
        let best = null, dist = Infinity;
        for (const r of rows) { const b = r.getBoundingClientRect(); const d = Math.abs((b.top + b.height / 2) - ev.clientY); if (d < dist) { dist = d; best = r; } }
        drag.target = best && best !== row ? best.dataset.dragId : null; if (best && best !== row) best.classList.add('drop-mark');
      };
      const up = ev => {
        if (ev.pointerId !== drag.pointerId) return;
        window.removeEventListener('pointermove', move, true); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true);
        document.querySelectorAll('.drop-mark,.is-dragging').forEach(x => x.classList.remove('drop-mark', 'is-dragging'));
        const d = drag; drag = null;
        if (d.active && d.target) { if (d.kind === 'sec') moveSectionTo(d.id, d.target); else moveItemTo(d.group, d.id, d.target); }
      };
      window.addEventListener('pointermove', move, true); window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true);
      e.preventDefault(); return true;
    }
  };
  function list_(id) { return list(id); }
  document.addEventListener('pointerdown', e => { if (e.target instanceof Element && e.target.closest('#panel')) api.startDrag(e); });
  return api;
}
