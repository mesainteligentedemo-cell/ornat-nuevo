/* ORNAT · submenú «Software IA» del menú de pantalla completa (nav#menu).
   - #msw-btn abre y cierra #msw-panel (Enter y Espacio, nativos del botón).
   - Esc con el submenú abierto lo cierra, regresa el foco al botón y no cierra el menú completo.
   - Al cerrarse el menú completo, el submenú vuelve a quedar cerrado.
   - Mientras el menú está abierto: html.is-menu-open (oculta el asistente de voz) y una banda opaca
     (.menu-veil) detrás del logo y de CERRAR, para que el texto del menú no pase legible por debajo.
   - En páginas sin main.js (nav#menu[data-simple]) también abre y cierra el menú completo. */
(function () {
  'use strict';
  var root = document.documentElement;
  var menu = document.getElementById('menu');
  var mbtn = document.getElementById('mbtn');
  var btn = document.getElementById('msw-btn');
  var panel = document.getElementById('msw-panel');
  var header = mbtn && mbtn.closest('header');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Banda: altura = borde inferior del header fijo.
  var veilH = 76;
  function measure() {
    if (!header || !menu) return;
    veilH = Math.ceil(header.getBoundingClientRect().bottom);
    menu.style.setProperty('--menu-veil', veilH + 'px');
  }
  if (menu) {
    var veil = document.createElement('div');
    veil.className = 'menu-veil'; veil.setAttribute('aria-hidden', 'true');
    menu.insertBefore(veil, menu.firstChild);
    measure();
    addEventListener('resize', measure);
  }

  function setSub(open) {
    if (!btn || !panel) return;
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open && menu) {
      // Si el submenú no cabe, sube el menú (tiene su propio scroll) hasta dejar el botón justo debajo de la banda.
      var b = btn.getBoundingClientRect(), p = panel.getBoundingClientRect();
      if (p.bottom > innerHeight) menu.scrollTo({ top: menu.scrollTop + Math.max(0, b.top - (veilH + 30)), behavior: reduce ? 'auto' : 'smooth' });
    }
  }

  if (btn && panel) {
    btn.addEventListener('click', function () { setSub(panel.hidden); });
    // Fase de captura: corre antes que el Esc de main.js, que cerraría todo el menú.
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || panel.hidden) return;
      e.preventDefault(); e.stopImmediatePropagation();
      setSub(false); btn.focus();
    }, true);
  }
  if (mbtn && window.MutationObserver) {
    new MutationObserver(function () {
      var isOpen = mbtn.getAttribute('aria-expanded') === 'true';
      root.classList.toggle('is-menu-open', isOpen);
      if (isOpen) measure(); else setSub(false);
    }).observe(mbtn, { attributes: true, attributeFilter: ['aria-expanded'] });
  }

  // Menú completo sin GSAP ni Lenis (páginas internas).
  if (!menu || !mbtn || !menu.hasAttribute('data-simple')) return;
  var lbl = document.getElementById('mlbl');
  var open = false;
  function toggle(v, restoreFocus) {
    open = v;
    menu.classList.toggle('is-open', v);
    mbtn.setAttribute('aria-expanded', v ? 'true' : 'false');
    if (lbl) lbl.textContent = v ? 'CERRAR' : 'MENÚ';
    if (!v && restoreFocus) mbtn.focus();
  }
  mbtn.addEventListener('click', function () { toggle(!open); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) toggle(false, true); });
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) toggle(false); });
})();
