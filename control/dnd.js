// Arrastre del tablero con Pointer Events y teclado (T12). Lo puro (hitColumn, dragReducer, keyboardMove) se prueba en dnd.test.mjs.
export const DRAG_THRESHOLD = 6;
export const LONG_PRESS_MS = 250;

// rects: [{id,left,top,right,bottom}] → id de la columna bajo (x,y) o null. Borde izquierdo/superior incluido, derecho/inferior excluido; los huecos devuelven null.
export function hitColumn(rects, x, y) {
  if (!Array.isArray(rects) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  for (const r of rects) if (x >= r.left && x < r.right && y >= r.top && y < r.bottom) return r.id;
  return null;
}

export const initialDrag = () => ({ phase: 'idle', x0: 0, y0: 0, x: 0, y: 0, touch: false, end: null });

// Eventos: {type:'down',x,y,touch} {type:'move',x,y} {type:'timer'} {type:'up'} {type:'key',key} {type:'cancel'}
// phase: idle | pressed | dragging. `end` (solo en la transición que termina el gesto): click | drop | cancel | abort.
export function dragReducer(s, ev) {
  const idle = end => ({ ...initialDrag(), end });
  switch (ev.type) {
    case 'down':
      return s.phase === 'idle' ? { phase: 'pressed', x0: ev.x, y0: ev.y, x: ev.x, y: ev.y, touch: !!ev.touch, end: null } : s;
    case 'move': {
      if (s.phase === 'idle') return s;
      const next = { ...s, x: ev.x, y: ev.y, end: null };
      if (s.phase === 'dragging') return next;
      const far = Math.hypot(ev.x - s.x0, ev.y - s.y0) >= DRAG_THRESHOLD;
      if (!far) return next;
      return s.touch ? idle('abort') : { ...next, phase: 'dragging' }; // táctil: moverse antes de la pulsación larga es desplazarse, no arrastrar
    }
    case 'timer':
      return s.phase === 'pressed' && s.touch ? { ...s, phase: 'dragging', end: null } : s;
    case 'up':
      if (s.phase === 'pressed') return idle('click');
      if (s.phase === 'dragging') return idle('drop');
      return s;
    case 'key':
      return ev.key === 'Escape' && s.phase !== 'idle' ? idle(s.phase === 'dragging' ? 'cancel' : 'abort') : s;
    case 'cancel':
      return s.phase === 'idle' ? s : idle(s.phase === 'dragging' ? 'cancel' : 'abort');
    default:
      return s;
  }
}

// Teclado con la tarjeta "agarrada": devuelve la columna destino (se queda en el extremo) o null si la tecla no aplica.
export function keyboardMove(colIds, cur, key) {
  if (!Array.isArray(colIds) || !colIds.length) return null;
  const i = colIds.indexOf(cur);
  if (key === 'Home') return colIds[0];
  if (key === 'End') return colIds[colIds.length - 1];
  if (key !== 'ArrowRight' && key !== 'ArrowLeft') return null;
  if (i < 0) return colIds[0];
  return colIds[Math.max(0, Math.min(colIds.length - 1, i + (key === 'ArrowRight' ? 1 : -1)))];
}

const noop = () => {};
function scrollParentX(el) {
  for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
    const o = getComputedStyle(a).overflowX;
    if ((o === 'auto' || o === 'scroll') && a.scrollWidth > a.clientWidth + 1) return a;
  }
  return null;
}

// root: contenedor estable (los resultados se vuelven a pintar). card/column: selectores. Ids: card.dataset.id y column.dataset.dropStatus.
export function mountBoardDnD(root, { card = '.lead-card', column = '[data-drop-status]', onDrop = noop, announce = noop } = {}) {
  const doc = root.ownerDocument || document;
  const win = doc.defaultView || window;
  const idOf = el => el?.dataset?.id || '';
  const colIdOf = el => el?.dataset?.dropStatus || '';
  const colName = el => (el?.getAttribute('aria-label') || '').split(':')[0] || colIdOf(el);
  const cardName = el => (el?.querySelector('strong')?.textContent || 'Tarjeta').trim();
  const columns = () => [...root.querySelectorAll(column)];
  let s = initialDrag(), cardEl = null, ghost = null, offX = 0, offY = 0, timer = 0, raf = 0, target = '', pid = null, scroller = null;
  let kb = null; // {cardEl, id, cur}

  const rectsNow = () => {
    const cols = columns(), clip = cols.length ? (scroller || cols[0].parentElement)?.getBoundingClientRect() : null;
    return cols.map(c => {
      const r = c.getBoundingClientRect();
      return { id: colIdOf(c), left: clip ? Math.max(r.left, clip.left) : r.left, right: clip ? Math.min(r.right, clip.right) : r.right, top: r.top, bottom: r.bottom };
    });
  };
  const mark = id => {
    target = id || '';
    for (const c of columns()) c.classList.toggle('dnd-target', !!id && colIdOf(c) === id);
  };
  const clear = () => {
    clearTimeout(timer); cancelAnimationFrame(raf); raf = 0;
    ghost?.remove(); ghost = null;
    cardEl?.classList.remove('dragging', 'grabbed');
    doc.body.classList.remove('dnd-active');
    mark('');
    win.removeEventListener('pointermove', onMove, true);
    win.removeEventListener('pointerup', onUp, true);
    win.removeEventListener('pointercancel', onCancel, true);
    win.removeEventListener('touchmove', onTouchMove, { capture: true });
    win.removeEventListener('keydown', onEsc, true);
    doc.removeEventListener('selectstart', noSel, true);
    cardEl = null; pid = null; scroller = null;
  };
  const swallowClick = () => {
    const stop = e => { e.stopPropagation(); e.preventDefault(); };
    win.addEventListener('click', stop, { capture: true, once: true });
    setTimeout(() => win.removeEventListener('click', stop, true), 50);
  };
  const noSel = e => e.preventDefault();
  const place = () => { if (ghost) ghost.style.transform = `translate(${s.x - offX}px,${s.y - offY}px)`; };
  const startDrag = () => {
    if (!cardEl) return;
    const r = cardEl.getBoundingClientRect();
    offX = s.x0 - r.left; offY = s.y0 - r.top;
    ghost = cardEl.cloneNode(true);
    ghost.removeAttribute('data-id'); ghost.setAttribute('aria-hidden', 'true'); ghost.inert = true;
    ghost.classList.add('dnd-ghost');
    Object.assign(ghost.style, { position: 'fixed', left: '0', top: '0', width: r.width + 'px', margin: '0', zIndex: '2147483000', pointerEvents: 'none' });
    doc.body.append(ghost);
    cardEl.classList.add('dragging');
    doc.body.classList.add('dnd-active');
    scroller = scrollParentX(cardEl.closest(column) || cardEl);
    place(); mark(hitColumn(rectsNow(), s.x, s.y));
    announce(`Arrastrando a ${cardName(cardEl)}. Suéltala sobre una etapa o pulsa Escape para cancelar.`);
    loop();
  };
  const loop = () => {
    raf = requestAnimationFrame(() => {
      if (s.phase !== 'dragging') return;
      if (scroller) {
        const b = scroller.getBoundingClientRect(), edge = 56;
        let dx = 0;
        if (s.x < b.left + edge) dx = -Math.ceil((b.left + edge - s.x) / 4);
        else if (s.x > b.right - edge) dx = Math.ceil((s.x - (b.right - edge)) / 4);
        if (dx) { scroller.scrollLeft += Math.max(-24, Math.min(24, dx)); mark(hitColumn(rectsNow(), s.x, s.y)); }
      }
      loop();
    });
  };
  const finish = (end, id, name, from) => {
    if (end === 'drop') {
      swallowClick();
      const to = target;
      clear();
      if (to && to !== from) onDrop(id, to);
      else announce(to ? `${name} se queda en ${colName(columns().find(c => colIdOf(c) === to))}.` : `Soltaste fuera de las etapas; ${name} no se movió.`);
    } else if (end === 'cancel') {
      swallowClick(); clear(); announce(`Movimiento cancelado. ${name} se queda donde estaba.`);
    } else clear();
  };
  const step = ev => {
    const id = idOf(cardEl), name = cardName(cardEl), from = colIdOf(cardEl?.closest(column));
    const prev = s.phase;
    s = dragReducer(s, ev);
    if (prev === 'pressed' && s.phase === 'dragging') startDrag();
    else if (s.phase === 'dragging') { place(); mark(hitColumn(rectsNow(), s.x, s.y)); }
    if (s.end) {
      const end = s.end; // `s` ya está en idle; el destino se leyó antes de limpiar
      if (end === 'click' || end === 'abort') clear(); else finish(end, id, name, from);
      s = initialDrag();
    }
  };
  const onMove = e => { if (e.pointerId !== pid) return; step({ type: 'move', x: e.clientX, y: e.clientY }); };
  const onUp = e => { if (e.pointerId !== pid) return; step({ type: 'move', x: e.clientX, y: e.clientY }); if (s.phase !== 'idle') step({ type: 'up' }); };
  const onCancel = e => { if (e.pointerId === pid) step({ type: 'cancel' }); };
  const onTouchMove = e => { if (s.phase === 'dragging' && e.cancelable) e.preventDefault(); };
  const onEsc = e => { if (e.key === 'Escape' && s.phase !== 'idle') { e.preventDefault(); e.stopPropagation(); step({ type: 'key', key: 'Escape' }); } };

  const onDown = e => {
    if (e.button > 0 || !e.isPrimary || s.phase !== 'idle' || kb) return;
    const c = e.target.closest?.(card);
    if (!c || !idOf(c) || !root.contains(c) || e.target.closest('select,a,input,textarea,label')) return;
    cardEl = c; pid = e.pointerId;
    const touch = e.pointerType === 'touch' || e.pointerType === 'pen';
    s = dragReducer(initialDrag(), { type: 'down', x: e.clientX, y: e.clientY, touch });
    win.addEventListener('pointermove', onMove, true);
    win.addEventListener('pointerup', onUp, true);
    win.addEventListener('pointercancel', onCancel, true);
    win.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
    win.addEventListener('keydown', onEsc, true);
    doc.addEventListener('selectstart', noSel, true);
    if (touch) timer = setTimeout(() => step({ type: 'timer' }), LONG_PRESS_MS);
  };
  const onCtx = e => { if (e.target.closest?.(card) && (s.phase !== 'idle' || e.pointerType === 'touch' || navigator.maxTouchPoints > 0)) e.preventDefault(); };

  // Teclado: Espacio agarra la tarjeta enfocada; ←/→ eligen etapa; Enter o Espacio sueltan; Esc cancela.
  const kbEnd = () => { if (kb) { kb.cardEl.classList.remove('grabbed'); mark(''); kb = null; win.removeEventListener('keyup', swallowSpace, true); } };
  const swallowSpace = e => { if (e.key === ' ') { e.preventDefault(); e.stopPropagation(); win.removeEventListener('keyup', swallowSpace, true); } };
  const describe = () => {
    const cols = columns(), col = cols.find(c => colIdOf(c) === kb.cur), i = cols.indexOf(col);
    announce(`${cardName(kb.cardEl)}: etapa ${colName(col)}, ${i + 1} de ${cols.length}. Enter para soltar, Escape para cancelar.`);
  };
  const onKey = e => {
    if (s.phase !== 'idle') return;
    if (kb) {
      const ids = columns().map(colIdOf);
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); const n = cardName(kb.cardEl); kbEnd(); announce(`Movimiento cancelado. ${n} se queda donde estaba.`); return; }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); e.stopPropagation();
        if (e.key === ' ') win.addEventListener('keyup', swallowSpace, true);
        const { id, cur, cardEl: el } = kb, from = colIdOf(el.closest(column)), n = cardName(el);
        kbEnd();
        if (cur !== from) onDrop(id, cur); else announce(`${n} se queda en su etapa.`);
        return;
      }
      const next = keyboardMove(ids, kb.cur, e.key);
      if (next !== null) { e.preventDefault(); e.stopPropagation(); kb.cur = next; mark(next); describe(); return; }
      if (e.key === 'Tab') { const n = cardName(kb.cardEl); kbEnd(); announce(`Movimiento cancelado. ${n} se queda donde estaba.`); }
      return;
    }
    if (e.key !== ' ' || e.repeat) return;
    const open = e.target.closest?.(`${card} .lead-open`), c = open?.closest(card);
    if (!c || !idOf(c)) return;
    e.preventDefault(); e.stopPropagation();
    win.addEventListener('keyup', swallowSpace, true);
    kb = { cardEl: c, id: idOf(c), cur: colIdOf(c.closest(column)) };
    c.classList.add('grabbed'); mark(kb.cur); describe();
  };
  const onBlur = e => { if (kb && !kb.cardEl.contains(e.relatedTarget)) { const n = cardName(kb.cardEl); kbEnd(); announce(`Movimiento cancelado. ${n} se queda donde estaba.`); } };

  root.addEventListener('pointerdown', onDown);
  root.addEventListener('contextmenu', onCtx);
  win.addEventListener('keydown', onKey, true);
  root.addEventListener('focusout', onBlur);
  return function unmount() {
    clear(); kbEnd();
    root.removeEventListener('pointerdown', onDown);
    root.removeEventListener('contextmenu', onCtx);
    win.removeEventListener('keydown', onKey, true);
    root.removeEventListener('focusout', onBlur);
  };
}
