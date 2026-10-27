// Arrastrar y soltar con puntero (ratón, lápiz o dedo) desde el panel o la barra flotante hasta el lienzo.
// No usa el arrastre nativo de HTML5: así funciona igual con el zoom del lienzo, sobre el iframe y en pantallas táctiles.
// El lienzo (bridge.js) calcula el punto seguro más cercano y dibuja la línea «Soltar aquí»; aquí solo se manda el puntero.
const THRESHOLD = 6;

export function createDnd(host, { onDrop }) {
  const frame = host.$('#preview');
  let st = null; let rafId = 0; let waiting = null; let suppress = 0;

  const ghostEl = label => { const g = document.createElement('div'); g.className = 'x-ghost'; g.setAttribute('aria-hidden', 'true'); g.textContent = label; document.body.append(g); return g; };
  function coords(ev) {
    const r = frame.getBoundingClientRect(); const k = frame.offsetWidth ? r.width / frame.offsetWidth : 1;
    const inside = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
    return { x: (ev.clientX - r.left) / (k || 1), y: (ev.clientY - r.top) / (k || 1), inside };
  }
  function flush() {
    rafId = 0; if (!st?.active || !st.last) return;
    host.send('dnd-move', coords(st.last));
  }
  function cleanup() {
    if (!st) return;
    window.removeEventListener('pointermove', onMove, true); window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('pointercancel', onCancel, true); window.removeEventListener('keydown', onKey, true);
    st.shield?.remove(); st.ghost?.remove(); document.body.classList.remove('x-dragging'); cancelAnimationFrame(rafId); rafId = 0; st = null;
  }
  function activate() {
    st.active = true;
    st.ghost = ghostEl(st.label); st.shield = document.createElement('div'); st.shield.className = 'x-dnd-shield'; document.body.append(st.shield);
    document.body.classList.add('x-dragging');
    host.send('dnd-start', { dragId: st.blockId || '' });
  }
  function onMove(ev) {
    if (!st || ev.pointerId !== st.pointerId) return;
    // Sin botón pulsado: el pointerup se perdió (soltaste fuera de la ventana o sobre otra capa). Se descarta el arrastre.
    if (ev.buttons === 0 && ev.pointerType === 'mouse') { if (st.active) host.send('dnd-end'); cleanup(); return; }
    st.last = ev;
    if (!st.active) { if (Math.hypot(ev.clientX - st.startX, ev.clientY - st.startY) < THRESHOLD) return; activate(); }
    ev.preventDefault();
    st.ghost.style.transform = `translate(${ev.clientX + 14}px,${ev.clientY + 12}px)`;
    st.ghost.dataset.inside = String(coords(ev).inside);
    if (!rafId) rafId = requestAnimationFrame(flush);
  }
  function onUp(ev) {
    if (!st || ev.pointerId !== st.pointerId) return;
    if (!st.active) { cleanup(); return; }
    ev.preventDefault(); suppress = Date.now() + 400;
    const source = { type: st.type, blockId: st.blockId };
    host.send('dnd-drop', coords(ev));
    cleanup();
    waiting = { source, timer: setTimeout(() => { waiting = null; host.send('dnd-end'); }, 1200) };
  }
  function onCancel(ev) { if (!st || ev.pointerId !== st.pointerId) return; if (st.active) host.send('dnd-end'); cleanup(); }
  function onKey(ev) { if (ev.key === 'Escape' && st) { ev.preventDefault(); ev.stopPropagation(); if (st.active) host.send('dnd-end'); cleanup(); host.toast('Arrastre cancelado.'); } }

  // El clic que sigue a un arrastre no debe insertar/abrir nada.
  document.addEventListener('click', e => { if (Date.now() < suppress) { e.stopPropagation(); e.preventDefault(); } }, true);

  return {
    // source: { type } para un bloque nuevo o { blockId } para reubicar uno existente.
    begin(ev, source, label) {
      if (st && !st.active && ev.buttons === 0) cleanup();
      if (st || ev.button > 0 || !ev.isPrimary) return;
      st = { pointerId: ev.pointerId, startX: ev.clientX, startY: ev.clientY, active: false, label, type: source.type || '', blockId: source.blockId || '', last: ev };
      window.addEventListener('pointermove', onMove, true); window.addEventListener('pointerup', onUp, true);
      window.addEventListener('pointercancel', onCancel, true); window.addEventListener('keydown', onKey, true);
    },
    message(m) {
      if (m.type !== 'dnd-dropped' || !waiting) return;
      clearTimeout(waiting.timer); const { source } = waiting; waiting = null;
      if (m.ok) onDrop(source, { after: String(m.after ?? ''), before: m.before ? String(m.before) : null });
      else host.toast('Suéltalo sobre el lienzo, cerca de una sección.', true);
    },
    get active() { return !!st?.active; }
  };
}
