// Floating contextual toolbar anchored to the element selected on the canvas.
import { STYLE_FONT_NAMES } from './core.js';
import { normHex } from './kits.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = (body, label) => `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${label ? ` role="img"` : ''}>${body}</svg>`;
const ICON = {
  left: svg('<path d="M3 5h14M3 9h9M3 13h14M3 17h9"/>'),
  center: svg('<path d="M3 5h14M6 9h8M3 13h14M6 17h8"/>'),
  right: svg('<path d="M3 5h14M8 9h9M3 13h14M8 17h9"/>'),
  eyeOff: svg('<path d="M2.5 10s2.7-5 7.5-5 7.5 5 7.5 5-2.7 5-7.5 5-7.5-5-7.5-5z"/><circle cx="10" cy="10" r="2.2"/><path d="M3 17 17 3"/>'),
  reset: svg('<path d="M4 10a6 6 0 1 0 2-4.5"/><path d="M4 3.5v3.5h3.5"/>'),
  link: svg('<path d="M8.5 11.5a3 3 0 0 0 4.2 0l2.6-2.6a3 3 0 0 0-4.2-4.2l-.8.8"/><path d="M11.5 8.5a3 3 0 0 0-4.2 0L4.7 11.1a3 3 0 0 0 4.2 4.2l.8-.8"/>'),
  spacing: svg('<path d="M3 4v12M17 4v12M6.5 10h7M6.5 10l1.8-1.8M6.5 10l1.8 1.8M13.5 10l-1.8-1.8M13.5 10l-1.8 1.8"/>'),
  up: svg('<path d="M10 16V5M5.5 9.5 10 5l4.5 4.5"/>'),
  image: svg('<rect x="3" y="4" width="14" height="12" rx="2"/><circle cx="7.5" cy="8.5" r="1.3"/><path d="m4 15 4-4 3 3 2-2 3 3"/>'),
  text: svg('<path d="M4 5V4h12v1M10 4v12M7.5 16h5"/>'),
  alt: svg('<rect x="3" y="4" width="14" height="12" rx="2"/><path d="M6 12.5 8.5 7l2.5 5.5M7 11h3M13 7v5.5"/>')
  ,
  spark: svg('<path d="m10 3 1.4 4.1L15.5 8.5l-4.1 1.4L10 14l-1.4-4.1L4.5 8.5l4.1-1.4zM15.5 12.5l.6 1.600 1.600.6-1.600.6-.6 1.600-.6-1.600-1.600-.6 1.600-.6z"/>'),
  lib: svg('<rect x="3" y="5" width="11" height="11" rx="2"/><path d="M6 3.500h9.500A1.500 1.500 0 0 1 17 5v8.500M4 14l3.500-3.500 2.500 2.500 1.500-1.500L14 14"/>'),
  grip: svg('<circle cx="7" cy="5" r="1.2"/><circle cx="13" cy="5" r="1.2"/><circle cx="7" cy="10" r="1.2"/><circle cx="13" cy="10" r="1.2"/><circle cx="7" cy="15" r="1.2"/><circle cx="13" cy="15" r="1.2"/>'),
  blockUp: svg('<path d="M10 16V5M5.500 9.500 10 5l4.500 4.500"/>'),
  blockDown: svg('<path d="M10 4v11M5.500 10.500 10 15l4.500-4.500"/>'),
  dup: svg('<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>'),
  trash: svg('<path d="M4 6h12M8 6V3.500h4V6M6 6l.8 10h6.400L14 6"/>'),
  prev: svg('<path d="M16 10H4M8.500 5.500 4 10l4.500 4.500"/>'),
  next: svg('<path d="M4 10h12M11.500 5.500 16 10l-4.500 4.500"/>'),
  btn: svg('<rect x="3" y="6.500" width="14" height="7" rx="3.500"/>')
};
const FIXED_PALETTE = ['#191c19', '#ffffff', '#f6f5f0', '#c2f56a', '#98ff03'];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function createToolbar(el, ctx) {
  let pop = null; let sizeHint = 0;
  const effective = (sel, patch) => {
    const own = patch.styles?.[sel.id] || {}; const base = sel.style || {};
    return { fontFamily: own.fontFamily || '', baseFamily: base.fontFamily, fontSize: own.fontSize ? parseFloat(own.fontSize) : base.fontSize, fontWeight: own.fontWeight ? Number(own.fontWeight) : base.fontWeight, fontStyle: own.fontStyle || base.fontStyle, textAlign: own.textAlign || base.textAlign, color: own.color || base.color, letterSpacing: own.letterSpacing ? parseFloat(own.letterSpacing) : base.letterSpacing, lineHeight: own.lineHeight ? parseFloat(own.lineHeight) : base.lineHeight, edited: !!patch.styles?.[sel.id] || patch.texts?.[sel.id] !== undefined };
  };
  const btn = (act, label, content, { pressed, disabled, cls = '', tb } = {}) => `<button type="button" class="tb-btn ${cls}" data-act="${act}" data-tb="${tb || act}" aria-label="${esc(label)}" title="${esc(label)}"${pressed === undefined ? '' : ` aria-pressed="${pressed}"`}${disabled ? ' disabled' : ''}>${content}</button>`;
  const sep = '<span class="tb-sep" role="separator"></span>';
  function textBar(sel, patch) {
    const s = effective(sel, patch);
    const fonts = ['', ...STYLE_FONT_NAMES].map(name => `<option value="${esc(name)}" ${s.fontFamily === name ? 'selected' : ''}>${name ? esc(name === 'system-ui' ? 'Sistema' : name) : `Original · ${esc(s.baseFamily || 'plantilla')}`}</option>`).join('');
    const hex = String(s.color || '#000000').toLowerCase();
    const alignOff = !sel.canAlign; const alignTip = alignOff ? 'No disponible: este texto va dentro de una línea' : '';
    return `<label class="sr" for="tb-font">Fuente</label><select id="tb-font" class="tb-select" data-tb="font">${fonts}</select>` + sep +
      `<div class="tb-group" role="group" aria-label="Tamaño">${btn('size-dec', 'Reducir tamaño', '−')}<label class="sr" for="tb-size">Tamaño en píxeles</label><input id="tb-size" class="tb-num" data-tb="size" type="number" inputmode="numeric" min="6" max="400" step="1" value="${Math.round(s.fontSize || 16)}">${btn('size-inc', 'Aumentar tamaño', '＋')}</div>` + sep +
      btn('bold', 'Negrita', '<b>B</b>', { pressed: s.fontWeight >= 600 }) + btn('italic', 'Cursiva', '<i>I</i>', { pressed: s.fontStyle === 'italic' }) + sep +
      ['left', 'center', 'right'].map(a => btn('align-' + a, alignOff ? alignTip : { left: 'Alinear a la izquierda', center: 'Centrar', right: 'Alinear a la derecha' }[a], ICON[a], { pressed: s.textAlign === a, disabled: alignOff })).join('') + sep +
      `<button type="button" class="tb-btn tb-color" data-act="pop-color" data-tb="color" aria-label="Color del texto" title="Color del texto" aria-expanded="${pop === 'color'}"><i style="background:${esc(hex)}"></i><span>${esc(hex)}</span></button>` +
      btn('pop-spacing', 'Espaciado y interlineado', ICON.spacing, { pressed: pop === 'spacing', tb: 'spacing' }) +
      (sel.link ? btn('pop-link', 'Enlace', ICON.link, { pressed: pop === 'link', tb: 'link' }) : '') +
      (sel.control ? btn('pop-btn', 'Estilo del botón: fondo, texto, radio y contorno', ICON.btn + '<span class="tb-inline">Botón</span>', { pressed: pop === 'btn', tb: 'btn', cls: 'tb-text' }) : '') +
      btn('pop-ai', 'Mejorar con IA', ICON.spark + '<span class="tb-inline">IA</span>', { pressed: pop === 'ai', tb: 'ai', cls: 'tb-text' }) + sep +
      btn('reset-style', 'Restablecer estilo y texto', ICON.reset, { disabled: !s.edited }) + btn('hide', 'Ocultar (Supr)', ICON.eyeOff) + btn('select-section', 'Seleccionar la sección', ICON.up);
  }
  function popover(sel, patch) {
    if (!pop) return '';
    if (pop === 'color') {
      const s = effective(sel, patch); const hex = String(s.color || '#000000').toLowerCase();
      const palette = [...new Set([...ctx.palette(), ...FIXED_PALETTE])].slice(0, 20);
      return `<div class="tb-pop" role="dialog" aria-label="Color del texto"><div class="tb-swatches">${palette.map(c => `<button type="button" class="tb-chip" data-act="swatch" data-color="${esc(c)}" ${normHex(c) ? `style="background:${esc(normHex(c))}" ` : ''}aria-label="Color ${esc(c)}" title="${esc(c)}"${c.toLowerCase() === hex ? ' aria-pressed="true"' : ''}></button>`).join('')}</div><div class="tb-row"><input type="color" id="tb-colorpick" data-tb="colorpick" value="${esc(hex)}" aria-label="Elegir color"><label class="sr" for="tb-hex">Código hexadecimal</label><input id="tb-hex" class="tb-hex" data-tb="hex" value="${esc(hex)}" maxlength="7" spellcheck="false" autocomplete="off"></div></div>`;
    }
    if (pop === 'spacing') {
      const s = effective(sel, patch);
      return `<div class="tb-pop" role="dialog" aria-label="Espaciado"><label class="tb-slider"><span>Espaciado de letras <output id="tb-ls-out">${(s.letterSpacing || 0).toFixed(2)} em</output></span><input type="range" id="tb-ls" data-tb="ls" min="-0.1" max="0.6" step="0.01" value="${s.letterSpacing || 0}"></label><label class="tb-slider"><span>Interlineado <output id="tb-lh-out">${(s.lineHeight || 1.2).toFixed(2)}</output></span><input type="range" id="tb-lh" data-tb="lh" min="0.8" max="2.4" step="0.05" value="${s.lineHeight || 1.2}"></label></div>`;
    }
    if (pop === 'link' && sel.link) {
      const value = patch.links?.[sel.link.id] ?? sel.link.href ?? '';
      return `<div class="tb-pop" role="dialog" aria-label="Enlace"><label class="tb-slider"><span>Destino del enlace</span><input id="tb-link" class="tb-wide" data-tb="linkinput" value="${esc(value)}" placeholder="https://…" maxlength="2048" autocomplete="off"></label><small id="tb-link-msg">https://, mailto:, tel: o #ancla.</small></div>`;
    }
    if (pop === 'btn' && sel.control) {
      const c = sel.control; const own = patch.buttons?.[c.id] || {}; const hex = v => (/^#[0-9a-f]{6}$/i.test(v || '') ? v : '#000000');
      const radii = [[0, 'Recto'], [4, 'Suave (4)'], [8, 'Redondeado (8)'], [16, 'Muy redondeado (16)'], [999, 'Píldora']];
      return `<div class="tb-pop" role="dialog" aria-label="Estilo del botón"><label class="tb-slider"><span>Tipo</span><select id="tb-btn-variant" class="tb-select" data-tb="btn-variant" style="width:100%;max-width:none"><option value="fill" ${own.variant !== 'outline' ? 'selected' : ''}>Relleno</option><option value="outline" ${own.variant === 'outline' ? 'selected' : ''}>Solo contorno</option></select></label>
        <div class="tb-row" style="margin-bottom:8px"><label class="tb-slider" style="margin:0;flex:1"><span>Fondo</span><input type="color" id="tb-btn-bg" data-tb="btn-bg" value="${esc(hex(own.bg || c.bg))}"></label><label class="tb-slider" style="margin:0;flex:1"><span>Texto</span><input type="color" id="tb-btn-color" data-tb="btn-color" value="${esc(hex(own.color || c.color))}"></label><label class="tb-slider" style="margin:0;flex:1"><span>Contorno</span><input type="color" id="tb-btn-border" data-tb="btn-border" value="${esc(hex(own.border || c.border || c.color))}"></label></div>
        <label class="tb-slider"><span>Esquinas</span><select id="tb-btn-radius" class="tb-select" data-tb="btn-radius" style="width:100%;max-width:none">${radii.map(([v, t]) => `<option value="${v}" ${own.radius === v ? 'selected' : ''}>${t}</option>`).join('')}<option value="" ${own.radius === undefined ? 'selected' : ''}>Original (${c.radius}px)</option></select></label>
        <button type="button" class="tb-btn tb-text" data-act="btn-reset" data-tb="btn-reset" style="background:#efefe8;color:#191c19;width:100%">Restablecer el botón</button></div>`;
    }
    if (pop === 'ai') {
      const ai = ctx.aiStatus();
      return `<div class="tb-pop" role="dialog" aria-label="Mejorar con IA"><b>Mejorar con IA</b><p class="tb-ai">${esc(ai.message)}</p>${ai.link ? `<a class="tb-ai-link" href="${esc(ai.link)}">Ir a Cuenta → Conexiones</a>` : ''}<small>Mientras no haya proveedor, el editor no genera ni reescribe textos por su cuenta.</small></div>`;
    }
    if (pop === 'alt') {
      const value = patch.images?.[sel.id]?.alt ?? sel.alt ?? '';
      return `<div class="tb-pop" role="dialog" aria-label="Texto alternativo"><label class="tb-slider"><span>Descripción para lectores de pantalla</span><input id="tb-alt" class="tb-wide" data-tb="altinput" value="${esc(value)}" maxlength="300" placeholder="Describe lo que se ve"></label></div>`;
    }
    return '';
  }
  function mediaBar(sel, patch) {
    const own = patch.images?.[sel.id]; const video = patch.videos?.[sel.id];
    const modified = sel.kind === 'video' ? !!video : !!own || (sel.kind === 'logo' && !!patch.brand?.logo);
    if (sel.kind === 'video') return btn('replace-video', 'Reemplazar video', 'Reemplazar video', { cls: 'tb-primary', tb: 'replace' }) + btn('video-poster', 'Cambiar portada', 'Portada', { cls: 'tb-text' }) + sep + btn('reset-media', 'Restablecer', ICON.reset, { disabled: !modified }) + btn('hide', 'Ocultar (Supr)', ICON.eyeOff) + btn('select-section', 'Seleccionar la sección', ICON.up);
    if (sel.kind === 'icon') return btn('replace', 'Reemplazar ícono (PNG, WebP o SVG; se convierte a PNG por seguridad)', 'Reemplazar ícono', { cls: 'tb-primary', tb: 'replace' }) + btn('library', 'Elegir de la biblioteca de medios', ICON.lib + '<span class="tb-inline">Biblioteca</span>', { cls: 'tb-text' }) + sep + btn('reset-media', 'Restablecer', ICON.reset, { disabled: !own }) + btn('hide', 'Ocultar (Supr)', ICON.eyeOff) + btn('select-section', 'Seleccionar la sección', ICON.up);
    const fit = own?.fit || sel.fit || 'cover';
    const frame = sel.kind !== 'logo' ? `<span class="tb-hint">Arrastra la imagen para reencuadrar</span>` : '';
    return btn('replace', sel.kind === 'logo' ? 'Reemplazar logo' : 'Reemplazar imagen', 'Reemplazar', { cls: 'tb-primary' }) +
      (sel.kind !== 'logo' ? `<label class="sr" for="tb-fit">Ajuste</label><select id="tb-fit" class="tb-select" data-tb="fit"><option value="cover" ${fit !== 'contain' ? 'selected' : ''}>Llenar</option><option value="contain" ${fit === 'contain' ? 'selected' : ''}>Mostrar completa</option></select>` + btn('reset-frame', 'Centrar encuadre', 'Centrar', { cls: 'tb-text', disabled: !(own?.position && own.position !== '50% 50%') }) : '') +
      btn('pop-alt', 'Texto alternativo', ICON.alt, { pressed: pop === 'alt', tb: 'alt' }) + btn('library', 'Elegir de la biblioteca de medios', ICON.lib + '<span class="tb-inline">Biblioteca</span>', { cls: 'tb-text' }) + frame + sep +
      btn('reset-media', 'Restablecer', ICON.reset, { disabled: !modified }) + btn('hide', 'Ocultar (Supr)', ICON.eyeOff) + btn('select-section', 'Seleccionar la sección', ICON.up);
  }
  function itemGroup(sel) {
    const it = sel.item; if (!it) return '';
    const horiz = it.axis === 'x'; const c = it.caps || {};
    const noMove = c.reason || 'Estos elementos no se pueden mover.'; const first = it.index <= 0; const last = it.index >= it.count - 1;
    return sep + `<span class="tb-label" title="${esc(it.label + ' · elemento ' + (it.index + 1) + ' de ' + it.count)}">${esc(it.label)} ${it.index + 1}/${it.count}</span>` +
      btn('item-prev', c.move ? (horiz ? 'Mover antes' : 'Subir') : noMove, horiz ? ICON.prev : ICON.up, { disabled: !c.move || first }) +
      btn('item-next', c.move ? (horiz ? 'Mover después' : 'Bajar') : noMove, horiz ? ICON.next : ICON.blockDown, { disabled: !c.move || last }) +
      btn('item-dup', c.add ? 'Duplicar este elemento' : (c.reason || 'No se puede duplicar'), ICON.dup + '<span class="tb-inline">Duplicar</span>', { cls: 'tb-text', disabled: !c.add }) +
      btn('item-del', c.remove ? 'Eliminar este elemento' : (c.reason || 'No se puede eliminar'), ICON.trash + '<span class="tb-inline">Eliminar</span>', { cls: 'tb-text', disabled: !c.remove }) +
      (sel.kind !== 'item' ? btn('item-select', 'Seleccionar el elemento completo', ICON.up + '<span class="tb-inline">Tarjeta</span>', { cls: 'tb-text' }) : '') +
      (!c.move && c.reason ? `<span class="tb-label tb-warn" title="${esc(c.reason)}">Bloqueado: ${esc(c.reason.slice(0, 60))}…</span>` : '');
  }
  function sectionGroup(sel) {
    const L = sel.layout; if (!L?.id || sel.blockId) return '';
    return sep + btn('sec-up', L.canMove ? 'Subir sección' : L.moveReason, ICON.blockUp, { disabled: !L.canMove }) + btn('sec-down', L.canMove ? 'Bajar sección' : L.moveReason, ICON.blockDown, { disabled: !L.canMove }) +
      btn('sec-dup', L.canDup ? 'Duplicar sección' : L.dupReason, ICON.dup + '<span class="tb-inline">Duplicar</span>', { cls: 'tb-text', disabled: !L.canDup }) + btn('sec-del', 'Quitar sección (se puede restaurar)', ICON.trash + '<span class="tb-inline">Quitar</span>', { cls: 'tb-text' }) +
      btn('sec-style', 'Estilo de la sección: espaciado, fondo, superposición', ICON.spacing + '<span class="tb-inline">Estilo</span>', { cls: 'tb-text' }) +
      (!L.canMove ? `<span class="tb-label tb-warn" title="${esc(L.moveReason)}">Fija: ${esc(L.moveReason.slice(0, 54))}…</span>` : '');
  }
  function build(sel, patch) {
    let body;
    if (sel.kind === 'section') {
      body = `<span class="tb-label">${sel.blockId ? 'Bloque' : 'Sección'} · ${esc(ctx.sectionLabel(sel.section))}</span>` + btn('edit-section', 'Editar todos sus textos', 'Editar todos sus textos', { cls: 'tb-primary' }) +
        (sel.blockId ? btn('block-grip', 'Arrastrar para mover el bloque', ICON.grip + '<span class="tb-inline">Mover</span>', { cls: 'tb-text tb-grip' }) + btn('block-up', 'Subir bloque', ICON.blockUp) + btn('block-down', 'Bajar bloque', ICON.blockDown) + btn('block-dup', 'Duplicar bloque', ICON.dup) : '') +
        btn('hide', sel.blockId ? 'Eliminar bloque (Supr)' : 'Ocultar sección (Supr)', (sel.blockId ? ICON.trash : ICON.eyeOff) + `<span class="tb-inline">${sel.blockId ? 'Eliminar' : 'Ocultar'}</span>`, { cls: 'tb-text' }) + sectionGroup(sel);
    } else if (sel.kind === 'item') {
      body = `<span class="tb-label">Elemento repetido</span>` + itemGroup(sel) + sep + btn('select-section', 'Seleccionar la sección', ICON.up);
    } else if (sel.editable) body = textBar(sel, patch) + itemGroup(sel);
    else if (['image', 'background', 'logo', 'video', 'icon'].includes(sel.kind)) body = mediaBar(sel, patch) + itemGroup(sel);
    else body = (sel.dynamic ? '<span class="tb-label tb-warn" title="Este texto lo reescribe la animación de la plantilla (subtítulos, máquina de escribir…): editarlo no tendría efecto.">Bloqueado: lo controla la animación de la plantilla</span>' : '') + (sel.link ? btn('pop-link', 'Enlace', ICON.link + '<span class="tb-inline">Enlace</span>', { pressed: pop === 'link', tb: 'link', cls: 'tb-text' }) : '') + btn('hide', 'Ocultar (Supr)', ICON.eyeOff) + btn('select-section', 'Seleccionar la sección', ICON.up) + itemGroup(sel);
    return `<span class="tb-kind" aria-hidden="true">${esc(sel.label)}</span>${body}${popover(sel, patch)}`;
  }
  function render(force = false) {
    const sel = ctx.getSel();
    if (!sel?.id || ctx.isTesting()) { el.hidden = true; el.innerHTML = ''; pop = null; return; }
    const active = document.activeElement; const inside = el.contains(active);
    if (!force && inside && active.matches('input,select,textarea')) return;
    const key = inside ? active.dataset?.tb : null;
    el.innerHTML = build(sel, ctx.getPatch());
    el.hidden = false;
    el.setAttribute('aria-label', `Edición: ${sel.label}`);
    if (key) el.querySelector(`[data-tb="${key}"]`)?.focus({ preventScroll: true });
    ctx.reposition();
  }
  function position({ area, shell, scale, rect, vh }) {
    if (el.hidden) return;
    const mobile = matchMedia('(max-width:800px)').matches;
    el.classList.toggle('docked', mobile);
    if (mobile) { el.style.left = el.style.top = ''; el.style.visibility = 'visible'; el.style.setProperty('--tb-top', Math.round(el.getBoundingClientRect().top) + 'px'); return; }
    if (!rect) { el.style.visibility = 'hidden'; return; }
    const a = area.getBoundingClientRect(); const s = shell.getBoundingClientRect();
    const top = Math.max(0, rect.y); const bottom = Math.min(vh, rect.y + rect.h);
    if (bottom < 0 || rect.y > vh || bottom - top < 1) { el.style.visibility = 'hidden'; return; }
    const w = el.offsetWidth; const h = el.offsetHeight;
    const shellTop = s.top - a.top; const shellBottom = s.bottom - a.top;
    const topY = shellTop + top * scale; const bottomY = shellTop + bottom * scale;
    const centerX = s.left - a.left + (rect.x + rect.w / 2) * scale;
    let y = topY - h - 36; let below = false;
    if (y < shellTop + 4) { y = bottomY + 14; below = true; }
    // Tall elements (hero, whole section): keep the bar inside the page, near the top of the visible part.
    if (y + h > shellBottom - 4) { y = Math.max(shellTop + 8, Math.min(shellBottom - h - 8, topY + 10)); below = false; }
    const x = clamp(centerX - w / 2, 6, Math.max(6, a.width - w - 6));
    el.style.left = Math.round(x) + 'px'; el.style.top = Math.round(y) + 'px'; el.style.visibility = 'visible';
    el.classList.toggle('pop-up', y + h / 2 > shellTop + (shellBottom - shellTop) * .55);
  }
  // ---- events ----
  el.addEventListener('mousedown', e => { if (!e.target.closest('input,select,textarea,label')) e.preventDefault(); });
  el.addEventListener('click', e => {
    const b = e.target.closest('button[data-act]'); if (!b || b.disabled) return;
    const sel = ctx.getSel(); if (!sel?.id) return;
    const patch = ctx.getPatch(); const act = b.dataset.act; const s = sel.editable ? effective(sel, patch) : null;
    if (act.startsWith('pop-')) { pop = pop === act.slice(4) ? null : act.slice(4); render(true); return; }
    if (act === 'size-dec' || act === 'size-inc') { const next = clamp(Math.round(s.fontSize || 16) + (act === 'size-inc' ? 1 : -1), 6, 400); ctx.setStyle(sel.id, { fontSize: next + 'px' }); }
    else if (act === 'bold') ctx.setStyle(sel.id, { fontWeight: s.fontWeight >= 600 ? '400' : '700' });
    else if (act === 'italic') ctx.setStyle(sel.id, { fontStyle: s.fontStyle === 'italic' ? 'normal' : 'italic' });
    else if (act.startsWith('align-')) ctx.setStyle(sel.id, { textAlign: act.slice(6) });
    else if (act === 'swatch') ctx.setStyle(sel.id, { color: b.dataset.color });
    else if (act === 'reset-style') ctx.resetStyle(sel.id);
    else if (act === 'hide') ctx.hide();
    else if (act === 'select-section') ctx.selectSection();
    else if (act === 'edit-section') ctx.editSection(sel.section);
    else if (act === 'replace') ctx.replace(sel.id);
    else if (act === 'replace-video') ctx.replaceVideo(sel.id);
    else if (act === 'video-poster') ctx.videoPoster(sel.id);
    else if (act === 'reset-media') ctx.resetMedia(sel);
    else if (act === 'reset-frame') ctx.setImage(sel.id, { position: '50% 50%' });
    else if (act === 'library') ctx.pickLibrary(sel.id);
    else if (act === 'block-up' || act === 'block-down' || act === 'block-dup') ctx.blockAction(act.slice(6), sel.blockId);
    else if (act.startsWith('item-')) ctx.itemAction(act.slice(5), sel);
    else if (act.startsWith('sec-')) ctx.sectionAction(act.slice(4), sel);
    else if (act === 'btn-reset' && sel.control) ctx.setButton(sel.control.id, { bg: undefined, color: undefined, border: undefined, radius: undefined, variant: undefined });
    if (ctx.getSel()?.id) render(true);
  });
  el.addEventListener('input', e => {
    const t = e.target; const sel = ctx.getSel(); if (!sel?.id) return;
    if (t.id === 'tb-size') { const n = Math.round(Number(t.value)); if (Number.isFinite(n) && n >= 6 && n <= 400) ctx.setStyle(sel.id, { fontSize: n + 'px' }); }
    else if (t.id === 'tb-hex') { const v = t.value.trim().toLowerCase(); if (/^#(?:[a-f\d]{3}|[a-f\d]{6})$/.test(v)) { t.setCustomValidity(''); ctx.setStyle(sel.id, { color: v }); } else t.setCustomValidity('Usa #RGB o #RRGGBB.'); }
    else if (t.id === 'tb-colorpick') { ctx.setStyle(sel.id, { color: t.value.toLowerCase() }); const hex = el.querySelector('#tb-hex'); if (hex) hex.value = t.value.toLowerCase(); }
    else if (t.id === 'tb-ls') { el.querySelector('#tb-ls-out').textContent = Number(t.value).toFixed(2) + ' em'; ctx.setStyle(sel.id, { letterSpacing: Number(t.value) + 'em' }); }
    else if (t.id === 'tb-lh') { el.querySelector('#tb-lh-out').textContent = Number(t.value).toFixed(2); ctx.setStyle(sel.id, { lineHeight: String(Number(Number(t.value).toFixed(2))) }); }
    else if (t.id === 'tb-link' && sel.link) { const msg = el.querySelector('#tb-link-msg'); if (ctx.validLink(t.value)) { t.setCustomValidity(''); msg.textContent = 'https://, mailto:, tel: o #ancla.'; ctx.setLink(sel.link.id, t.value); } else { t.setCustomValidity('Enlace no válido'); msg.textContent = 'Enlace no válido: usa https://, mailto:, tel: o #ancla.'; } }
    else if (t.id === 'tb-alt') ctx.setImage(sel.id, { alt: t.value });
    else if (sel.control && t.id === 'tb-btn-bg') ctx.setButton(sel.control.id, { bg: t.value.toLowerCase() });
    else if (sel.control && t.id === 'tb-btn-color') ctx.setButton(sel.control.id, { color: t.value.toLowerCase() });
    else if (sel.control && t.id === 'tb-btn-border') ctx.setButton(sel.control.id, { border: t.value.toLowerCase() });
  });
  el.addEventListener('change', e => {
    const t = e.target; const sel = ctx.getSel(); if (!sel?.id) return;
    if (t.id === 'tb-font') { if (t.value) ctx.setStyle(sel.id, { fontFamily: t.value }); else ctx.unsetStyle(sel.id, 'fontFamily'); }
    else if (t.id === 'tb-fit') ctx.setImage(sel.id, { fit: t.value });
    else if (sel.control && t.id === 'tb-btn-variant') ctx.setButton(sel.control.id, { variant: t.value === 'outline' ? 'outline' : undefined });
    else if (sel.control && t.id === 'tb-btn-radius') ctx.setButton(sel.control.id, { radius: t.value === '' ? undefined : Number(t.value) });
    if (t.matches('select')) t.blur();
    else if (t.id === 'tb-size') { const n = clamp(Math.round(Number(t.value)) || 16, 6, 400); t.value = n; ctx.setStyle(sel.id, { fontSize: n + 'px' }); }
    else if (t.id === 'tb-hex' && !t.validity.valid) { t.setCustomValidity(''); }
  });
  el.addEventListener('keydown', e => { if (e.key === 'Escape' && pop) { e.stopPropagation(); pop = null; render(true); } });
  document.addEventListener('mousedown', e => { if (pop && !el.contains(e.target)) { pop = null; render(true); } }, true);
  return { render, position, closePop() { if (pop) { pop = null; render(true); } }, get popOpen() { return !!pop; } };
}
