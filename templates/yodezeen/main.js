(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const root = document.documentElement;
  const body = document.body;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

  /* ---------- split helpers ---------- */
  $$('[data-words]').forEach(el => {
    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute('aria-label', el.textContent.trim());
    el.innerHTML = words.map(w => `<span class="w" aria-hidden="true">${w}</span>`).join(' ');
  });
  $$('[data-split-chars]').forEach(el => {
    el.setAttribute('aria-label', el.textContent.trim());
    el.innerHTML = [...el.textContent].map(c => c === ' ' ? ' ' : `<span class="char" aria-hidden="true">${c}</span>`).join('');
  });

  /* ---------- clocks (America/Cancun) ---------- */
  const clocks = $$('[data-clock]');
  const tick = () => {
    let t = '';
    try { t = new Intl.DateTimeFormat('es-MX', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Cancun' }).format(new Date()); } catch (e) { t = ''; }
    clocks.forEach(c => (c.textContent = t));
  };
  tick(); setInterval(tick, 30000);

  /* ---------- menu ---------- */
  const menu = $('#menu'), menuBtn = $('#menuBtn');
  const setMenu = open => {
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    menuBtn.setAttribute('aria-expanded', String(open));
    if (window.lenis) open ? window.lenis.stop() : window.lenis.start();
  };
  menuBtn.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
  $$('[data-close]', menu).forEach(el => el.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  /* ---------- cookies ---------- */
  const cookies = $('#cookies');
  const showCookies = () => {
    let seen = null;
    try { seen = localStorage.getItem('ornat-cookies'); } catch (e) {}
    if (!seen) cookies.hidden = false;
  };
  $$('[data-cookie]', cookies).forEach(b => b.addEventListener('click', () => {
    try { localStorage.setItem('ornat-cookies', b.dataset.cookie); } catch (e) {}
    cookies.hidden = true;
  }));

  /* ---------- anchor links ---------- */
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    const target = id === '#top' ? 0 : $(id);
    if (target === null) return;
    e.preventDefault();
    if (window.lenis) window.lenis.scrollTo(target, { duration: 1.6 });
    else if (target === 0) window.scrollTo(0, 0);
    else target.scrollIntoView();
  }));

  /* ---------- reduced motion / no gsap ---------- */
  const pre = $('#preloader');
  if (reduce || !hasGsap) {
    root.classList.add('rm');
    pre.remove();
    body.classList.remove('is-loading');
    $$('.stack-item').forEach(i => i.classList.add('is-active'));
    showCookies();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  /* ---------- Lenis ---------- */
  let lenis = null;
  if (typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    window.lenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }

  /* ---------- cursor ring (no image) ---------- */
  const cursor = $('.cursor');
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const qx = gsap.quickTo(cursor, 'x', { duration: 0.45, ease: 'power3' });
    const qy = gsap.quickTo(cursor, 'y', { duration: 0.45, ease: 'power3' });
    window.addEventListener('pointermove', e => { qx(e.clientX); qy(e.clientY); cursor.classList.add('is-on'); }, { passive: true });
    document.addEventListener('pointerleave', () => cursor.classList.remove('is-on'));
    $$('a,button').forEach(el => {
      el.addEventListener('pointerenter', () => cursor.classList.add('is-hover'));
      el.addEventListener('pointerleave', () => cursor.classList.remove('is-hover'));
    });
  }

  /* ---------- preloader ---------- */
  const steps = $$('.pre-steps li');
  const intro = gsap.timeline({ defaults: { ease: 'power2.out' } });
  intro
    .fromTo('.pre-img--a', { scale: 1.22 }, { scale: 1.04, duration: 5.2, ease: 'none' }, 0)
    .fromTo('.pre-img--b', { scale: 1.16, opacity: 0 }, { scale: 1.02, duration: 4, ease: 'none' }, 1.7)
    .to('.pre-img--b', { opacity: 1, duration: 1.1, ease: 'power1.inOut' }, 1.7)
    .fromTo('.pre-logo', { opacity: 0, y: 30, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.2 }, 1.0)
    .fromTo('.pre-sub .char', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.018 }, 1.4)
    .to('.pre-steps li', { yPercent: -100 * (steps.length - 1), duration: 3.4, ease: `steps(${steps.length - 1})` }, 0.5)
    .addLabel('exit', 4.3)
    .to('.pre-content, .pre-steps, .pre-skip', { opacity: 0, duration: 0.5 }, 'exit')
    .to(pre, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.2, ease: 'power4.inOut' }, 'exit+=0.2')
    .fromTo('.hero-img', { scale: 1.25 }, { scale: 1, duration: 2, ease: 'power3.out' }, 'exit+=0.2')
    .fromTo('.nav', { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.8 }, 'exit+=1')
    .fromTo('.hero-bar', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.8 }, 'exit+=1.1')
    .add(() => {
      pre.remove();
      body.classList.remove('is-loading');
      if (lenis) lenis.start();
      ScrollTrigger.refresh();
      showCookies();
    });
  gsap.set(pre, { clipPath: 'inset(0% 0% 0% 0%)' });
  $('#skip').addEventListener('click', () => intro.seek('exit'));

  /* ---------- header color over dark sections ---------- */
  const header = $('#header');
  $$('[data-dark]').forEach(sec => ScrollTrigger.create({
    trigger: sec, start: 'top 40px', end: 'bottom 40px',
    onToggle: s => header.classList.toggle('is-dark', s.isActive)
  }));

  /* ---------- hero parallax ---------- */
  gsap.to('.hero-media', { yPercent: 35, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  const rnd = (a, b) => a + Math.random() * (b - a);
  const mm = gsap.matchMedia();

  /* ---------- about: words scatter ---------- */
  const wA = $$('.about-title--a .w'), wB = $$('.about-title--b .w');
  const about = gsap.timeline({ scrollTrigger: { trigger: '.about', start: 'top top', end: 'bottom bottom', scrub: 0.6 } });
  about.to({}, { duration: 0.25 });
  wA.forEach((w, i) => {
    about.fromTo(w, { x: 0, y: 0, opacity: 1, filter: 'blur(0px)' },
      { x: rnd(-260, 260), y: rnd(-140, 140), opacity: 0, filter: 'blur(14px)', duration: 0.6, ease: 'power1.in' }, 0.25 + Math.random() * 0.25);
  });
  wB.forEach(w => {
    about.fromTo(w, { x: rnd(-260, 260), y: rnd(-140, 140), opacity: 0, filter: 'blur(14px)' },
      { x: 0, y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.6, ease: 'power2.out' }, 1.0 + Math.random() * 0.25);
  });
  about.to({}, { duration: 0.4 });

  /* ---------- info: image grows from left ---------- */
  mm.add('(min-width: 1024px)', () => {
    const tl = gsap.timeline({ scrollTrigger: { trigger: '.info', start: 'top top', end: 'bottom bottom', scrub: 0.6 } });
    tl.fromTo('.info-media', { width: '0vw' }, { width: '60vw', duration: 1, ease: 'power2.inOut' }, 0)
      .fromTo('.info-text', { x: '30vw' }, { x: '0vw', duration: 1, ease: 'power2.inOut' }, 0)
      .fromTo('.info-media img', { filter: 'grayscale(1) contrast(1.05)' }, { filter: 'grayscale(0) contrast(1)', duration: 1.4, ease: 'none' }, 0.6)
      .to({}, { duration: 0.5 })
      .to('.info-media', { width: '100vw', duration: 1, ease: 'power2.inOut' }, 1.6)
      .to('.info-text', { x: '-40vw', opacity: 0, duration: 1, ease: 'power2.inOut' }, 1.6)
      .to({}, { duration: 0.2 });
  });
  mm.add('(max-width: 1023px)', () => {
    const tl = gsap.timeline({ scrollTrigger: { trigger: '.info', start: 'top top', end: 'bottom bottom', scrub: 0.6 } });
    tl.fromTo('.info-media', { width: '0vw' }, { width: '100vw', duration: 1, ease: 'power2.inOut' }, 0)
      .fromTo('.info-text', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 }, 0.5)
      .fromTo('.info-media img', { filter: 'grayscale(1)' }, { filter: 'grayscale(0)', duration: 1, ease: 'none' }, 0.6)
      .to({}, { duration: 0.6 })
      .to('.info-text', { opacity: 0, y: -30, duration: 0.6 }, 1.9)
      .to('.info-media', { top: 0, height: '100%', duration: 0.9, ease: 'power2.inOut' }, 1.9);
  });

  /* ---------- modules: pinned sequence ---------- */
  const layers = $$('.pj-layer'), items = $$('.pj-item'), cur = $('.pj-cur');
  const n = layers.length;
  const pj = gsap.timeline({
    scrollTrigger: {
      trigger: '.projects', start: 'top top', end: 'bottom bottom', scrub: 0.8,
      onUpdate: s => { const i = Math.min(n - 1, Math.floor(s.progress * n * 0.999)); cur.textContent = String(i + 1).padStart(2, '0'); }
    }
  });
  layers.forEach((layer, i) => {
    const t = i;
    if (layer.classList.contains('pj-layer--wipe')) {
      pj.fromTo($('.pj-art', layer), { scale: 1.08 }, { scale: 1, duration: 1, ease: 'none' }, t)
        .fromTo($('.pj-render', layer), { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.6, ease: 'power1.inOut' }, t + 0.2);
    } else {
      pj.fromTo($('img', layer), { scale: 1.2 }, { scale: 1.0, duration: 1.25, ease: 'none' }, Math.max(0, t - 0.2));
    }
    if (i > 0) {
      pj.fromTo(layer, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'none' }, t - 0.1)
        .fromTo(items[i], { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.15, ease: 'power2.out' }, t)
        .to(items[i - 1], { opacity: 0, y: -40, duration: 0.15, ease: 'power2.in' }, t - 0.15);
    }
  });
  pj.to({}, { duration: 0.3 }, n - 0.3);

  /* ---------- stack lists ---------- */
  $$('.stack').forEach(sec => {
    const its = $$('.stack-item', sec);
    const set = i => its.forEach((it, k) => it.classList.toggle('is-active', k === i));
    set(0);
    ScrollTrigger.create({
      trigger: sec, start: 'top top', end: 'bottom bottom',
      onUpdate: s => set(Math.min(its.length - 1, Math.floor(s.progress * its.length)))
    });
    gsap.fromTo($$('.stack-word', sec), { yPercent: 60, opacity: 0 }, {
      yPercent: 0, opacity: 1, stagger: 0.06, duration: 0.9, ease: 'power3.out',
      scrollTrigger: { trigger: sec, start: 'top 70%' }
    });
  });

  /* ---------- HECHO PARA ---------- */
  mm.add({ d: '(min-width: 1024px)', m: '(max-width: 1023px)' }, ctx => {
    const d = ctx.conditions.d;
    const tl = gsap.timeline({ scrollTrigger: { trigger: '.other', start: 'top top', end: 'bottom bottom', scrub: 0.6 } });
    tl.to({}, { duration: 0.2 })
      .fromTo('.other-word--l', { x: 0, color: '#4a4646' }, { x: d ? '-34vw' : '-60vw', color: '#dedad8', duration: 1, ease: 'power2.inOut' }, 0.2)
      .fromTo('.other-word--r', { x: 0, color: '#4a4646' }, { x: d ? '34vw' : '60vw', color: '#dedad8', duration: 1, ease: 'power2.inOut' }, 0.2)
      .fromTo('.other-center', { opacity: 0, scale: 0.86, filter: 'blur(8px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.7, ease: 'power2.out' }, 0.55)
      .to({}, { duration: 0.6 });
  });

  /* ---------- map ---------- */
  const mapTl = gsap.timeline({ scrollTrigger: { trigger: '.map', start: 'top top', end: 'bottom bottom', scrub: 0.6 } });
  mapTl.fromTo('.map-title', { x: () => window.innerWidth }, { x: () => -$('.map-title').scrollWidth - 40, duration: 1.4, ease: 'none' }, 0)
    .fromTo('.pin', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.25, stagger: 0.12 }, 0.75)
    .fromTo('.map-cta', { opacity: 0 }, { opacity: 1, duration: 0.2 }, 1.45)
    .to({}, { duration: 0.3 });

  /* ---------- method / book ---------- */
  mm.add({ d: '(min-width: 1024px)', m: '(max-width: 1023px)' }, ctx => {
    const d = ctx.conditions.d;
    const tl = gsap.timeline({ scrollTrigger: { trigger: '.book', start: 'top top', end: 'bottom bottom', scrub: 0.7 } });
    tl.fromTo('.book-obj', { y: '70vh', rotationX: 40, rotationZ: -28, rotationY: -18 }, { y: d ? '6vh' : '4vh', rotationX: 8, rotationZ: -6, rotationY: 6, duration: 1, ease: 'power2.out' }, 0)
      .fromTo('.book-text--a', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4 }, 0.4)
      .to({}, { duration: 0.3 })
      .to('.book-word--a', { x: '-60vw', opacity: 0, duration: 0.8, ease: 'power2.in' }, 1.3)
      .to('.book-text--a', { opacity: 0, y: -30, duration: 0.4 }, 1.3)
      .to('.book-obj', { x: d ? '22vw' : '0vw', y: d ? '-18vh' : '-2vh', rotationZ: 14, rotationX: 18, rotationY: -14, scale: d ? 0.92 : 0.7, duration: 1, ease: 'power2.inOut' }, 1.3)
      .fromTo('.book-word--b', { x: '40vw', opacity: 0 }, { x: '0vw', opacity: 1, duration: 0.8, ease: 'power2.out' }, 1.6)
      .fromTo('.book-steps', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5 }, 2.05)
      .to({}, { duration: 0.4 });
  });

  /* ---------- reveals ---------- */
  $$('[data-reveal]').forEach(el => gsap.fromTo(el, { y: 50, opacity: 0 }, {
    y: 0, opacity: 1, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' }
  }));

  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
