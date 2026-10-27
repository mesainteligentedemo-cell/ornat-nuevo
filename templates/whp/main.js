(() => {
  const WA = 'https://wa.me/529842353159?text=Hola%20ORNAT%2C%20quiero%20solicitar%20una%20demo';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = () => innerWidth < 768;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  gsap.registerPlugin(ScrollTrigger);

  /* ---------- DATA: reference projects -> ORNAT modules ---------- */
  const MODS = [
    { t: 'Web IA', s: 'Un sitio para presentar tu proyecto', left: 'secondary-module-web-ia-primary', alt: 'Sitio web de proyecto en pantallas y maqueta', right: ['secondary-module-web-ia-secondary-1', 'secondary-module-web-ia-secondary-2'] },
    { t: 'Render IA', s: 'Visualiza espacios.', left: 'secondary-module-render-ia-primary', dark: true, alt: 'Render de residencia tropical', right: ['secondary-module-render-ia-secondary-1|dark', 'secondary-module-render-ia-secondary-2'] },
    { t: 'Del plano al render', s: 'Convertimos tus planos o bosquejos en entregables visuales', wipe: '17-07', wipeArt: 'secondary-module-del-plano-al-render-sketch', wipeRender: 'secondary-module-del-plano-al-render-render', alt: 'Bosquejo que se convierte en render', right: ['secondary-module-del-plano-al-render-secondary-1', 'secondary-module-del-plano-al-render-secondary-2'] },
    { t: 'Recorrido virtual', s: 'Recorridos con presentadores virtuales', left: 'secondary-module-recorrido-virtual-primary', alt: 'Interior con vista al mar', right: ['secondary-module-recorrido-virtual-secondary-1', 'secondary-module-recorrido-virtual-secondary-2'] },
    { t: 'Agente comercial', s: 'Consultas con seguimiento', left: 'secondary-module-agente-comercial-primary', alt: 'Agente comercial en pantallas junto a maqueta', right: ['secondary-module-agente-comercial-secondary-1', 'secondary-module-agente-comercial-secondary-2'] },
    { t: 'Contenido social', s: 'Tus redes necesitan contenido con un propósito', left: 'secondary-module-contenido-social-primary', alt: 'Contenido para redes en pantallas', right: ['secondary-module-contenido-social-secondary-1', 'secondary-module-contenido-social-secondary-2'] },
    { t: 'Capacitación', s: 'Capacitación con audio, módulos y exámenes', left: 'secondary-module-capacitaci-n-primary', alt: 'Capacitación con audio en escritorio', right: ['secondary-module-capacitaci-n-secondary-1', 'secondary-module-capacitaci-n-secondary-2'] },
    { t: 'Análisis empresarial', s: 'Análisis empresarial para apoyar tus decisiones', left: 'secondary-module-an-lisis-empresarial-primary', alt: 'Tableros de análisis junto a maqueta', right: ['secondary-module-an-lisis-empresarial-secondary-1', 'secondary-module-an-lisis-empresarial-secondary-2'] },
  ];
  const CARDS = [
    { k: '[01]', t: 'Plataforma y diseño', s: 'Sitio llamativo, planos, renders y videos.', img: 'secondary-carousel-card-1' },
    { k: '[02]', t: 'Agentes inteligentes', s: 'Atiende prospectos y automatiza contenido.', img: 'secondary-carousel-card-2' },
    { k: 'Diseño visual', t: 'Del plano al render', s: 'Distribución, materiales y espacios.', img: 'secondary-carousel-card-3' },
    { k: 'Agente comercial', t: 'Consultas con seguimiento', s: 'Responde con información de tu empresa.', img: 'secondary-carousel-card-4' },
    { k: 'Equipo y datos', t: 'Conocimiento para decidir', s: 'Audio, módulos, exámenes y análisis.', img: 'secondary-carousel-card-5' },
    { k: 'Inmersivo', t: 'Realidad aumentada y dron', s: 'Presentadores de IA, realidad mixta y dron.', img: 'secondary-carousel-card-6' },
  ];

  const words = (txt) => txt.split(' ').map((w, i, a) => `<span class="w">${w}${i < a.length - 1 ? ' ' : ''}</span>`).join('');

  /* ---------- build projects ---------- */
  const projWrap = $('.projects');
  projWrap.innerHTML = MODS.map((m, i) => {
    const left = m.wipe
      ? `<div class="wipe"><img class="wipe__art" src="https://ornat-whp.vercel.app/img/${m.wipeArt || `art-${m.wipe}`}.webp" alt="" style="filter:invert(0)"><img class="wipe__render" src="https://ornat-whp.vercel.app/img/${m.wipeRender || `render-${m.wipe}`}.webp" alt="${m.alt}"><span class="wipe__line"></span></div>`
      : `<img src="https://ornat-whp.vercel.app/img/${m.left}.webp" alt="${m.alt}" ${i ? 'loading="lazy"' : ''}>`;
    const right = m.right.map(r => { const [f, d] = r.split('|'); return `<figure class="${d ? 'on-dark' : ''}"><img src="https://ornat-whp.vercel.app/img/${f}.webp" alt="${m.t}: vista complementaria del servicio" loading="lazy"></figure>`; }).join('');
    return `<article class="proj" data-sub="${m.s}" aria-label="${m.t}">
      <div class="proj__sticky">
        <div class="proj__left"><div class="proj__frame ${m.dark ? 'on-dark' : ''}">${left}</div></div>
        <div class="proj__right"><div class="proj__track">${right}</div></div>
        <h3 class="proj__title">${words(m.t)}</h3>
        <a class="proj__link" href="${WA}" target="_blank" rel="noopener" aria-label="${m.t}: solicitar demo"></a>
      </div></article>`;
  }).join('');

  /* ---------- build carousel ---------- */
  const track = $('.carousel__track');
  track.innerHTML = CARDS.map(c => `<div class="card" role="group" aria-label="${c.t}">
      <p style="min-height:0;margin-bottom:2px">${c.k}</p><h3>${c.t}</h3><p>${c.s}</p>
      <div class="card__img"><img src="https://ornat-whp.vercel.app/img/${c.img}.webp" alt="Escultura abstracta de piedra, vidrio y madera" loading="lazy"></div>
      <a class="card__btn" href="${WA}" target="_blank" rel="noopener" tabindex="-1">Solicitar demo</a></div>`).join('');
  $$('.split').forEach(el => el.innerHTML = words(el.textContent));

  /* ---------- Lenis ---------- */
  let lenis = null;
  if (!reduce) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    window.lenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  const scrollToEl = (el) => { if (!el) return; lenis ? lenis.scrollTo(el, { duration: 1.4 }) : el.scrollIntoView(); };

  /* ---------- pill ---------- */
  const pillWrap = $('.pill-wrap'), pill = $('.pill'), pillLabel = $('.pill__label');
  let curLabel = 'Menú', ctaMode = false;
  function setLabel(txt, cta = false) {
    pillWrap.classList.toggle('is-cta', cta); ctaMode = cta;
    if (txt === curLabel) return; curLabel = txt;
    if (reduce) { pillLabel.textContent = txt; return; }
    gsap.timeline()
      .to(pillLabel, { yPercent: -100, opacity: 0, duration: .22, ease: 'power2.in' })
      .add(() => { pillLabel.textContent = txt; })
      .fromTo(pillLabel, { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .32, ease: 'power3.out' });
  }

  /* ---------- menu ---------- */
  const menu = $('#menu'), panel = $('.menu__panel');
  let menuOpen = false;
  function openMenu() {
    menuOpen = true; menu.classList.add('is-open'); menu.setAttribute('aria-hidden', 'false'); pill.setAttribute('aria-expanded', 'true');
    lenis && lenis.stop();
    gsap.fromTo(panel, { scaleY: .12, scaleX: isMobile() ? 1 : 1.6, opacity: 0 }, { scaleY: 1, scaleX: 1, opacity: 1, duration: reduce ? 0 : .6, ease: 'expo.out' });
    gsap.fromTo($$('.menu__nav a, .menu__logo, .menu__social, .menu__close'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, stagger: .04, delay: reduce ? 0 : .15, duration: reduce ? 0 : .5, ease: 'power3.out' });
    gsap.to(pillWrap, { opacity: 0, duration: .2 });
    setTimeout(() => $('.menu__nav a:nth-child(2)').focus({ preventScroll: true }), 50);
  }
  function closeMenu(after) {
    if (!menuOpen) return; menuOpen = false;
    gsap.to(panel, { scaleY: .12, opacity: 0, duration: reduce ? 0 : .35, ease: 'power3.in', onComplete: () => {
      menu.classList.remove('is-open'); menu.setAttribute('aria-hidden', 'true'); pill.setAttribute('aria-expanded', 'false');
      lenis && lenis.start(); after && after();
    } });
    gsap.to(pillWrap, { opacity: 1, duration: .3, delay: .2 });
    pill.focus({ preventScroll: true });
  }
  pill.addEventListener('click', () => { if (ctaMode) { window.open(WA, '_blank', 'noopener'); return; } menuOpen ? closeMenu() : openMenu(); });
  $('.menu__close').addEventListener('click', () => closeMenu());
  menu.addEventListener('click', e => { if (e.target === menu) closeMenu(); });
  addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  $$('.menu__nav a, .footer a[href^="#"], .mosaic__btn').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href'); if (!id || !id.startsWith('#')) return;
    e.preventDefault(); const target = id === '#top' ? document.body : $(id);
    if (menuOpen) closeMenu(() => scrollToEl(target)); else scrollToEl(target);
  }));

  /* ---------- hero slideshow (simulated video) ---------- */
  const slides = $$('.hero__slide'), heroTitle = $('.hero__title span'), sideBtn = $('.pill-side');
  let si = 0, paused = false, timer = null;
  function kb(slide) {
    if (reduce) return;
    const img = $('img', slide), dir = Math.random() > .5 ? 1 : -1;
    gsap.fromTo(img, { scale: 1.16, xPercent: 2 * dir }, { scale: 1.02, xPercent: -2 * dir, duration: 6, ease: 'none', overwrite: true });
  }
  function showSlide(n) {
    slides[si].classList.remove('is-on'); si = (n + slides.length) % slides.length;
    const s = slides[si]; s.classList.add('is-on'); kb(s);
    if (reduce) { heroTitle.textContent = s.dataset.title; return; }
    gsap.timeline().to(heroTitle, { opacity: 0, letterSpacing: '.2em', duration: .5, ease: 'power2.in' })
      .add(() => heroTitle.textContent = s.dataset.title)
      .fromTo(heroTitle, { opacity: 0, letterSpacing: '.2em' }, { opacity: 1, letterSpacing: '.08em', duration: 1, ease: 'power3.out' });
  }
  const play = () => { clearInterval(timer); if (!paused && !reduce) timer = setInterval(() => showSlide(si + 1), 4200); };
  sideBtn.addEventListener('click', () => {
    paused = !paused; sideBtn.classList.toggle('is-paused', paused);
    sideBtn.setAttribute('aria-label', paused ? 'Reproducir presentación' : 'Pausar presentación');
    paused ? (clearInterval(timer), gsap.getTweensOf($$('.hero__slide img')).forEach(t => t.pause())) : (gsap.getTweensOf($$('.hero__slide img')).forEach(t => t.resume()), play());
  });

  /* ---------- loader ---------- */
  function startSite() {
    document.body.classList.remove('is-loading');
    lenis && lenis.start();
    kb(slides[0]); play();
    ScrollTrigger.refresh();
  }
  const loader = $('.loader');
  if (reduce) { loader.remove(); startSite(); }
  else {
    const pct = $('.loader__pct'), o = { v: 0 };
    const first = new Image(); first.src = slides[0].querySelector('img').src;
    const ready = new Promise(r => { if (first.complete) r(); first.onload = first.onerror = r; setTimeout(r, 3500); });
    const tl = gsap.timeline();
    tl.from('.loader__logo', { opacity: 0, y: -10, duration: .6, ease: 'power2.out' })
      .from('.loader__pill', { opacity: 0, scaleX: .6, duration: .6, ease: 'expo.out' }, '<.1')
      .to(o, { v: 86, duration: 1.2, ease: 'power1.inOut', onUpdate: () => { pct.textContent = Math.round(o.v); gsap.set('.loader__fill', { scaleX: o.v / 100 }); } });
    ready.then(() => tl.then(() => {
      gsap.timeline()
        .to(o, { v: 100, duration: .35, onUpdate: () => { pct.textContent = Math.round(o.v); gsap.set('.loader__fill', { scaleX: o.v / 100 }); } })
        .to('.loader__pct', { opacity: 0, duration: .2 })
        .to('.loader__logo', { y: 0, opacity: 0, duration: .3 }, '<')
        .to(loader, { opacity: 0, duration: .7, ease: 'power2.inOut', onStart: startSite, onComplete: () => loader.remove() })
        .fromTo('.hero__media', { scale: 1.12 }, { scale: 1, duration: 1.6, ease: 'expo.out' }, '<')
        .fromTo('.site-header', { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: .8 }, '<.2')
        .fromTo('.pill-wrap', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: .8, ease: 'power3.out' }, '<');
    }));
  }

  /* ---------- section-driven pill ---------- */
  const sideCheck = () => pillWrap.classList.toggle('has-side', scrollY < innerHeight * .45);
  addEventListener('scroll', sideCheck, { passive: true }); sideCheck();
  ScrollTrigger.create({ trigger: '.footer', start: 'top 55%', onToggle: s => s.isActive ? setLabel('Solicitar demo', true) : setLabel('Menú') });

  /* ---------- reveals ---------- */
  if (!reduce) {
    $$('.rv').forEach(el => gsap.fromTo(el, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none reverse' } }));
    gsap.to('.hero__title', { yPercent: 30, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  }

  /* ---------- projects ---------- */
  $$('.proj').forEach((p, i) => {
    const ws = $$('.proj__title .w', p), trk = $('.proj__track', p), frameImg = $('.proj__frame > img', p);
    ScrollTrigger.create({ trigger: p, start: 'top 50%', end: 'bottom 50%', onToggle: s => s.isActive ? setLabel(p.dataset.sub) : (i === 0 && s.direction < 0 ? setLabel('Menú') : null) });
    if (i === MODS.length - 1) ScrollTrigger.create({ trigger: p, start: 'bottom 50%', onEnter: () => setLabel('Menú') });
    if (reduce) return;
    gsap.fromTo(ws, { opacity: 0, yPercent: -100, rotateX: 90 }, { opacity: 1, yPercent: 0, rotateX: 0, stagger: .08, duration: .9, ease: 'power3.out',
      scrollTrigger: { trigger: p, start: 'top 45%', end: 'bottom 30%', toggleActions: 'play reverse play reverse' } });
    const mm = gsap.matchMedia();
    mm.add({ d: '(min-width:768px)', m: '(max-width:767px)' }, ctx => {
      const shift = ctx.conditions.d ? -0.5 : -1;
      gsap.fromTo(trk, { x: () => innerWidth * 0.25 * (ctx.conditions.d ? 1 : 0), opacity: .0 }, { x: () => innerWidth * shift, opacity: 1, ease: 'none',
        scrollTrigger: { trigger: p, start: 'top 70%', end: 'bottom bottom', scrub: .6, invalidateOnRefresh: true } });
    });
    if (frameImg) gsap.fromTo(frameImg, { scale: 1.18 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: p, start: 'top bottom', end: 'bottom top', scrub: true } });
    const wipe = $('.wipe', p);
    if (wipe) {
      const r = $('.wipe__render', wipe), ln = $('.wipe__line', wipe);
      const tl = gsap.timeline({ scrollTrigger: { trigger: p, start: 'top 40%', end: 'bottom 60%', scrub: .5 } });
      tl.fromTo(r, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none' })
        .fromTo(ln, { left: '0%' }, { left: '100%', ease: 'none' }, 0);
    }
  });

  /* ---------- mosaic ---------- */
  if (!reduce) {
    $$('.mosaic__col').forEach((c, i) => gsap.fromTo(c, { yPercent: i % 2 ? -30 : 0 }, { yPercent: i % 2 ? 0 : -30, ease: 'none', scrollTrigger: { trigger: '.mosaic', start: 'top bottom', end: 'bottom top', scrub: true } }));
    gsap.fromTo('.mosaic__title .w', { opacity: 0, yPercent: -100, rotateX: 90 }, { opacity: 1, yPercent: 0, rotateX: 0, stagger: .08, duration: .9, ease: 'power3.out',
      scrollTrigger: { trigger: '.mosaic', start: 'top 40%', end: 'bottom 40%', toggleActions: 'play reverse play reverse' } });
  }

  /* ---------- problems ---------- */
  const probs = $$('.prob'), dots = $$('.problems__dots i');
  let pi = 0;
  function setProb(n) {
    if (n === pi) return;
    const prev = probs[pi], next = probs[n], dir = n > pi ? 1 : -1; pi = n;
    dots.forEach((d, k) => d.classList.toggle('is-on', k === n));
    if (reduce) { prev.classList.remove('is-on'); next.classList.add('is-on'); return; }
    gsap.to(prev.children, { opacity: 0, y: -30 * dir, stagger: .04, duration: .35, ease: 'power2.in', onComplete: () => prev.classList.remove('is-on') });
    next.classList.add('is-on');
    gsap.fromTo(next.children, { opacity: 0, y: 40 * dir }, { opacity: 1, y: 0, stagger: .06, duration: .7, delay: .25, ease: 'power3.out' });
  }
  ScrollTrigger.create({ trigger: '.problems', start: 'top top', end: 'bottom bottom', onUpdate: s => setProb(Math.min(3, Math.floor(s.progress * 4))) });

  /* ---------- carousel ---------- */
  const cards = $$('.card'), N = cards.length, car = $('.carousel');
  const st = { pos: 0 };
  const gapW = () => (isMobile() ? 250 : 240);
  function layout() {
    const g = gapW(), active = ((Math.round(st.pos) % N) + N) % N;
    cards.forEach((c, i) => {
      let off = i - st.pos; off = ((off % N) + N) % N; if (off > N / 2) off -= N;
      const a = Math.abs(off);
      gsap.set(c, { x: off * g, scale: a < .5 ? 1.06 - a * .12 : Math.max(.9, 1 - a * .05), opacity: a > 2.6 ? 0 : 1, zIndex: 10 - Math.round(a), y: a < .5 ? -12 * (1 - a * 2) : 0 });
      const on = i === active; c.classList.toggle('is-active', on);
      $('.card__btn', c).tabIndex = on ? 0 : -1;
    });
  }
  const goTo = (p) => gsap.to(st, { pos: p, duration: reduce ? 0 : .7, ease: 'power3.out', onUpdate: layout, overwrite: true });
  st.pos = 2; layout();
  $('.cbtn--prev').onclick = () => goTo(Math.round(st.pos) - 1);
  $('.cbtn--next').onclick = () => goTo(Math.round(st.pos) + 1);
  car.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') goTo(Math.round(st.pos) - 1); if (e.key === 'ArrowRight') goTo(Math.round(st.pos) + 1); });
  let drag = null;
  car.addEventListener('pointerdown', e => { if (e.target.closest('.card__btn')) return; drag = { x: e.clientX, p: st.pos, moved: 0 }; car.setPointerCapture(e.pointerId); gsap.killTweensOf(st); });
  car.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x; drag.moved = Math.max(drag.moved, Math.abs(dx)); st.pos = drag.p - dx / gapW(); layout(); });
  const end = (e) => {
    if (!drag) return; const d = drag; drag = null;
    if (d.moved < 6) { const c = e.target.closest && e.target.closest('.card'); if (c) { const i = cards.indexOf(c); let off = i - st.pos; off = ((off % N) + N) % N; if (off > N / 2) off -= N; goTo(Math.round(st.pos + off)); return; } }
    goTo(Math.round(st.pos));
  };
  car.addEventListener('pointerup', end); car.addEventListener('pointercancel', end);
  addEventListener('resize', layout);

  addEventListener('load', () => ScrollTrigger.refresh());
})();
