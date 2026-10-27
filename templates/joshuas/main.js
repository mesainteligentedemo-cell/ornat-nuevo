(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = typeof window.gsap !== 'undefined';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  // split spaced words (F E A T U R E style)
  $$('.f-spaced').forEach(el => {
    el.innerHTML = [...el.textContent.trim()].map(ch => `<span>${ch}</span>`).join('');
  });
  // hero lines wrappers
  $$('.hero-title .ln').forEach(l => { l.innerHTML = `<span>${l.innerHTML}</span>`; });

  // ---------- LENIS ----------
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    window.lenis = lenis;
    if (hasGsap) {
      gsap.registerPlugin(ScrollTrigger);
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  } else if (hasGsap) {
    gsap.registerPlugin(ScrollTrigger);
  }

  const scrollToEl = (target) => {
    const el = typeof target === 'string' ? $(target) : target;
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.4 });
    else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  };
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    e.preventDefault();
    if (document.body.classList.contains('menu-open')) closeMenu();
    if (id === '#top') { lenis ? lenis.scrollTo(0) : window.scrollTo({ top: 0 }); return; }
    scrollToEl(id);
  }));

  // ---------- LOADER ----------
  const loader = $('#loader');
  const endLoad = () => {
    document.body.classList.remove('is-loading');
    if (loader) loader.remove();
    if (lenis) lenis.start();
    if (hasGsap) ScrollTrigger.refresh();
  };
  if (reduce || !hasGsap || !loader) {
    endLoad();
  } else {
    if (lenis) lenis.stop();
    const tl = gsap.timeline({ onComplete: endLoad });
    tl.fromTo('.loader-quote blockquote, .loader-quote figcaption',
        { filter: 'blur(14px)', opacity: 0 }, { filter: 'blur(0px)', opacity: 1, duration: 1.2, ease: 'power2.out', stagger: .12 })
      .fromTo('.loader-dash', { scaleX: 0 }, { scaleX: 1, duration: .5 }, .2)
      .to('.loader-quote', { opacity: 0, filter: 'blur(8px)', duration: .5, ease: 'power2.in' }, '+=.55')
      .fromTo('.loader-emblem', { opacity: 0, scale: .7, rotate: -90 }, { opacity: 1, scale: 1, rotate: 0, duration: .8, ease: 'expo.out' }, '-=.1')
      .fromTo('.loader-card', { clipPath: 'inset(0% 0% 0% 0% round 0px)' }, { clipPath: 'inset(3% 3% 2% 3% round 10px)', duration: .7, ease: 'power3.inOut' }, '-=.3')
      .to('.loader-card', { yPercent: -105, duration: 1, ease: 'expo.inOut' }, '+=.15')
      .fromTo('.hero-media', { scale: 1.18 }, { scale: 1, duration: 1.8, ease: 'expo.out' }, '-=.75')
      .fromTo('.hero-title .ln>span', { yPercent: 110 }, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: .09 }, '-=1.55')
      .fromTo('.hero-sub, .hero-marquee', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .8, stagger: .1 }, '-=.9');
  }

  if (!hasGsap) return;

  // ---------- HERO "video" (Ken Burns + crossfades) ----------
  if (!reduce) {
    const imgs = $$('.kb');
    gsap.set(imgs, { scale: 1.02 });
    const kb = gsap.timeline({ repeat: -1 });
    imgs.forEach((im, i) => {
      const next = imgs[(i + 1) % imgs.length];
      kb.fromTo(im, { scale: 1.02, xPercent: 0 }, { scale: 1.14, xPercent: i % 2 ? 1.5 : -1.5, duration: 7.5, ease: 'none' }, i * 6)
        .to(next, { opacity: 1, duration: 1.6, ease: 'power1.inOut' }, i * 6 + 5.9)
        .to(im, { opacity: 0, duration: 1.6, ease: 'power1.inOut' }, i * 6 + 5.9);
    });
    // hero parallax as main covers it
    gsap.to('.hero-copy', { yPercent: -25, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero-spacer', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero', { yPercent: -18, ease: 'none', scrollTrigger: { trigger: '.hero-spacer', start: 'top top', end: 'bottom top', scrub: true } });

    // latest card parallax
    gsap.fromTo('.latest-img', { yPercent: -6, scale: 1.12 }, { yPercent: 6, scale: 1, ease: 'none', scrollTrigger: { trigger: '.latest', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.fromTo('.latest-copy > *', { y: 40, opacity: 0 }, { y: 0, opacity: 1, stagger: .08, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.latest', start: 'top 45%' } });

    // stacking features: previous card recedes as the next one slides over
    const feats = $$('.feature');
    feats.forEach((f, i) => {
      const next = feats[i + 1];
      if (next) {
        gsap.fromTo(f, { scale: 1, opacity: 1 }, { scale: .9, opacity: .35, ease: 'none', scrollTrigger: { trigger: next, start: 'top bottom', end: 'top top', scrub: true } });
      }
      gsap.fromTo($('.f-spaced', f).children, { opacity: 0, y: 14 }, { opacity: 1, y: 0, stagger: .04, duration: .8, ease: 'power3.out', scrollTrigger: { trigger: f, start: 'top 55%' } });
      gsap.fromTo($$('.f-kicker, .f-title, .f-text, .tags li', f), { opacity: 0, y: 30 }, { opacity: 1, y: 0, stagger: .05, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: f, start: 'top 40%' } });
      const im = $('.f-img', f);
      if (im) gsap.fromTo(im, { scale: 1.15 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: f, start: 'top bottom', end: 'top top', scrub: true } });
    });

    // sketch -> render wipe
    const wipeTl = gsap.timeline({ scrollTrigger: { trigger: '.feature-wipe', start: 'top 60%', end: 'top -70%', scrub: true } });
    wipeTl.fromTo('.wipe-rd', { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none' }, 0)
          .fromTo('.wipe-line', { left: '0%' }, { left: '100%', ease: 'none' }, 0);

    // curated intro
    gsap.fromTo('.cur-card', { y: 60, opacity: 0 }, { y: 0, opacity: 1, stagger: .05, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: '.curated', start: 'top 70%' } });

    // stories
    gsap.fromTo('.stories-title, .filters, .filter-desc', { y: 30, opacity: 0 }, { y: 0, opacity: 1, stagger: .08, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.stories', start: 'top 70%' } });
    ScrollTrigger.batch('.mcard', {
      start: 'top 88%',
      onEnter: b => gsap.fromTo(b, { y: 60, opacity: 0 }, { y: 0, opacity: 1, stagger: .08, duration: 1.1, ease: 'expo.out', overwrite: true })
    });
    gsap.fromTo('.method-list li', { y: 40, opacity: 0 }, { y: 0, opacity: 1, stagger: .1, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.method-list', start: 'top 85%' } });

    // reminisce
    gsap.fromTo('.rem-title', { letterSpacing: '0.4em', opacity: 0 }, { letterSpacing: '1.1em', opacity: 1, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: '.reminisce', start: 'top 75%' } });

    // footer giant word
    gsap.fromTo('.giant-word', { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: '.foot-giant', start: 'top bottom', end: 'bottom bottom', scrub: true } });
    gsap.fromTo('.foot-bg', { scale: 1.25 }, { scale: 1.05, ease: 'none', scrollTrigger: { trigger: '.foot-giant', start: 'top bottom', end: 'bottom bottom', scrub: true } });
  }

  // touch devices: plan→render mini wipe when in view
  ScrollTrigger.create({ trigger: '.wipe-mini', start: 'top 70%', onEnter: () => $('.wipe-mini').classList.add('is-on') });

  // ---------- FILTERS ----------
  const desc = {
    all: 'Combinamos diseño visual, software e inteligencia artificial en módulos que eliges según tu proyecto y equipo.',
    plataforma: 'Presenta tu proyecto con un sitio llamativo, planos, renders y videos. Suma presentadores de IA, realidad aumentada, realidad mixta y producción con dron.',
    agentes: 'Atiende prospectos con agentes de IA y automatiza contenido. Capacita mediante voz, módulos y exámenes. Analiza tus departamentos para apoyar decisiones con información de tu operación.'
  };
  $$('.filter').forEach(btn => btn.addEventListener('click', () => {
    const f = btn.dataset.f;
    $$('.filter').forEach(b => { b.classList.toggle('is-on', b === btn); b.setAttribute('aria-selected', b === btn); });
    $$('.mcard').forEach(c => c.classList.toggle('is-out', f !== 'all' && c.dataset.c !== f));
    const d = $('#filterDesc');
    gsap.fromTo(d, { opacity: 0, y: 8 }, { opacity: .8, y: 0, duration: .5 });
    d.textContent = desc[f];
  }));

  // ---------- SWIPER (reminisce) ----------
  if (window.Swiper) {
    new Swiper('.rem-swiper', {
      slidesPerView: 'auto', centeredSlides: true, loop: true, spaceBetween: 26, grabCursor: true, speed: 800,
      autoplay: reduce ? false : { delay: 3200, disableOnInteraction: false, pauseOnMouseEnter: true },
      keyboard: { enabled: true }, a11y: { enabled: true, slideLabelMessage: 'Paso {{index}} de {{slidesLength}}' }
    });
  }

  // ---------- MENU ----------
  const menu = $('#menu'), btn = $('#menuBtn');
  let deckTimer = null, deckIdx = 0;
  const deckImgs = $$('#menuDeck img');
  const layoutDeck = () => {
    const n = deckImgs.length;
    deckImgs.forEach((im, i) => {
      let o = ((i - deckIdx) % n + n) % n; if (o > n / 2) o -= n;
      const x = o * 46, s = 1 - Math.abs(o) * .14;
      im.style.transform = `translate(calc(-50% + ${x}%), -50%) scale(${s})`;
      im.style.zIndex = 10 - Math.abs(o);
      im.style.filter = o === 0 ? 'none' : 'blur(1.5px) brightness(.8)';
      im.style.opacity = Math.abs(o) > 2 ? 0 : 1;
    });
    const cur = deckImgs[deckIdx];
    $('#menuTitle').textContent = cur.dataset.t;
    $('#menuCat').textContent = cur.dataset.c;
  };
  layoutDeck();
  function openMenu() {
    document.body.classList.add('menu-open');
    btn.setAttribute('aria-expanded', 'true'); btn.querySelector('.lbl').textContent = 'Cerrar';
    menu.setAttribute('aria-hidden', 'false');
    if (lenis) lenis.stop();
    gsap.set(menu, { visibility: 'visible' });
    gsap.fromTo('.menu-bg', { opacity: 0 }, { opacity: 1, duration: .5 });
    gsap.fromTo('.menu-links a, .menu-social li', { y: 40, opacity: 0 }, { y: 0, opacity: 1, stagger: .035, duration: .8, ease: 'expo.out', delay: .1 });
    gsap.fromTo('.menu-feature, .menu-cta, .menu-emblem', { y: 30, opacity: 0 }, { y: 0, opacity: 1, stagger: .08, duration: .9, ease: 'expo.out', delay: .2 });
    if (!reduce) deckTimer = setInterval(() => { deckIdx = (deckIdx + 1) % deckImgs.length; layoutDeck(); }, 2400);
  }
  function closeMenu() {
    document.body.classList.remove('menu-open');
    btn.setAttribute('aria-expanded', 'false'); btn.querySelector('.lbl').textContent = 'Menú';
    menu.setAttribute('aria-hidden', 'true');
    clearInterval(deckTimer);
    if (lenis) lenis.start();
    gsap.to('.menu-links a, .menu-social li, .menu-feature, .menu-cta, .menu-emblem', { opacity: 0, duration: .25 });
    gsap.to('.menu-bg', { opacity: 0, duration: .4, delay: .1, onComplete: () => gsap.set(menu, { visibility: 'hidden' }) });
  }
  btn.addEventListener('click', () => document.body.classList.contains('menu-open') ? closeMenu() : openMenu());
  $$('[data-close]').forEach(a => a.addEventListener('click', () => document.body.classList.contains('menu-open') && closeMenu()));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('menu-open')) closeMenu(); });

  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
