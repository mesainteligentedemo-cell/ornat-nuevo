/* Translate dynamic accessibility labels without replacing animated SplitText nodes. */
(() => {
  const labels = {
    'Next slide': 'Siguiente diapositiva', 'Previous slide': 'Diapositiva anterior',
    'Go to slide': 'Ir a la diapositiva', 'Close': 'Cerrar', 'Open menu': 'Abrir menú',
    'Submit': 'Enviar', 'Menu': 'Menú', 'Footer Form': 'Formulario del pie',
    'Footer Form success': 'Confirmación del formulario del pie'
  };
  const update = () => {
    document.documentElement.lang = 'es-MX';
    document.querySelectorAll('[aria-label]').forEach(el => {
      const old = el.getAttribute('aria-label');
      let next = labels[old] || old.replace(/^Go to slide (\d+)$/, 'Ir a la diapositiva $1');
      if (next !== old) el.setAttribute('aria-label', next);
    });
    document.querySelectorAll('.header-logo a').forEach(el => {
      if (el.getAttribute('aria-label') !== 'ORNAT UX — Inicio') el.setAttribute('aria-label', 'ORNAT UX — Inicio');
    });
  };
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; update(); });
  }).observe(document.documentElement, { childList: true, subtree: true });
  update();
})();
