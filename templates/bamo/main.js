(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  if (reduced) root.classList.add('reduced');
  const WA = 'https://wa.me/529842353159?text=';

  /* Lenis smooth scroll */
  let lenis = null;
  if (!reduced && window.Lenis) {
    lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
    window.lenis = lenis;
    if (window.gsap && window.ScrollTrigger) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  const scrollToEl = (el) => {
    if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.4 });
    else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  };

  /* Menu */
  const burger = document.getElementById('burger');
  const menu = document.getElementById('menu');
  const setMenu = (open) => {
    document.body.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    menu.setAttribute('aria-hidden', !open);
    if (lenis) open ? lenis.stop() : lenis.start();
  };
  burger.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  /* Anchor links */
  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    const el = id === '#top' ? document.body : document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    setMenu(false);
    if (id === '#top') { lenis ? lenis.scrollTo(0) : window.scrollTo(0, 0); } else scrollToEl(el);
  }));

  /* Header hide / show */
  const header = document.getElementById('header');
  const hero = document.querySelector('.hero');
  let lastY = 0;
  const onScroll = (y) => {
    const heroH = hero.offsetHeight;
    if (document.body.classList.contains('menu-open')) return;
    if (y > 140 && y > lastY + 2) header.classList.add('is-hidden');
    else if (y < lastY - 2) header.classList.remove('is-hidden');
    header.classList.toggle('is-solid', y > heroH - 120);
    if (y < 140) header.classList.remove('is-hidden');
    lastY = y;
    if (y > heroH * 0.85) showPopup();
  };
  if (lenis) lenis.on('scroll', e => onScroll(e.scroll));
  else window.addEventListener('scroll', () => onScroll(window.scrollY), { passive: true });

  /* Hero slideshow (fade + Ken Burns) */
  const slides = [...document.querySelectorAll('.slide')];
  let cur = 0;
  const go = (n) => {
    slides[cur].classList.remove('is-active');
    cur = (n + slides.length) % slides.length;
    const img = slides[cur].querySelector('img');
    img.loading = 'eager';
    slides[cur].classList.add('is-active');
    const nxt = slides[(cur + 1) % slides.length].querySelector('img');
    nxt.loading = 'eager';
  };
  slides[1].querySelector('img').loading = 'eager';
  if (!reduced) setInterval(() => { if (!document.hidden) go(cur + 1); }, 6000);

  /* Popup */
  const popup = document.getElementById('popup');
  let popShown = false;
  let popClosed = false;
  try { popClosed = sessionStorage.getItem('ornatPop') === '1'; } catch (e) {}
  function showPopup() {
    if (popShown || popClosed) return;
    popShown = true;
    popup.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => popup.classList.add('is-in')));
  }
  document.getElementById('popupClose').addEventListener('click', () => {
    popup.classList.remove('is-in');
    popClosed = true;
    try { sessionStorage.setItem('ornatPop', '1'); } catch (e) {}
    setTimeout(() => { popup.hidden = true; }, 900);
  });
  const subscribe = (form) => form.addEventListener('submit', e => {
    e.preventDefault();
    const email = form.email.value.trim();
    const msg = `Hola ORNAT, quiero recibir contenidos y demostraciones. Mi correo: ${email}`;
    window.open(WA + encodeURIComponent(msg), '_blank', 'noopener');
    form.reset();
  });
  subscribe(document.getElementById('popupForm'));
  subscribe(document.getElementById('newsForm'));

  /* GSAP scroll effects */
  if (!window.gsap || !window.ScrollTrigger) { document.querySelectorAll('.reveal').forEach(el => { el.style.opacity = 1; el.style.transform = 'none'; }); return; }
  gsap.registerPlugin(ScrollTrigger);

  if (reduced) { gsap.set('.reveal', { opacity: 1, y: 0 }); return; }

  // reveal text
  gsap.utils.toArray('.reveal').forEach(el => {
    gsap.fromTo(el, { opacity: 0, y: 34 }, {
      opacity: 1, y: 0, duration: 1.2, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true }
    });
  });

  // fade-in images (bamo js-fade-in) + parallax
  gsap.utils.toArray('.tile, .studio__collage figure, .person').forEach((el, i) => {
    gsap.fromTo(el, { opacity: 0 }, {
      opacity: 1, duration: 1.4, ease: 'power2.out', delay: (i % 4) * 0.08,
      scrollTrigger: { trigger: el, start: 'top 92%', once: true }
    });
  });
  const mm = gsap.matchMedia();
  mm.add('(min-width: 761px)', () => {
    gsap.utils.toArray('[data-speed]').forEach(el => {
      const s = parseFloat(el.dataset.speed);
      gsap.fromTo(el, { y: () => s * window.innerHeight * 0.45 }, {
        y: () => -s * window.innerHeight * 0.45, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true }
      });
    });
  });

  // sketch → render wipe
  gsap.utils.toArray('.wipe').forEach(w => {
    gsap.fromTo(w.querySelector('.wipe__ren'), { clipPath: 'inset(0% 100% 0% 0%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)', ease: 'none',
      scrollTrigger: { trigger: w, start: 'top 75%', end: 'bottom 30%', scrub: true }
    });
  });

  // hero content parallax out
  gsap.fromTo('.hero__slides', { yPercent: 0 }, { yPercent: 18, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  // CTA background parallax
  gsap.fromTo('.cta__bg', { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom top', scrub: true } });

  // footer wordmark rise
  gsap.fromTo('.footer__word', { yPercent: 30, opacity: 0.2 }, { yPercent: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top 80%', end: 'bottom bottom', scrub: true } });

  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
