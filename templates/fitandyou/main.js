(() => {
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isDesk = () => window.innerWidth > 991;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const WA = 'https://wa.me/529842353159?text=';

  gsap.registerPlugin(ScrollTrigger);

  /* Lenis */
  let lenis = null;
  if (!RM && window.Lenis) {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    window.lenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }

  /* Anchor links */
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    const el = id === '#inicio' ? document.body : $(id);
    if (!el) return;
    e.preventDefault();
    closeMenu();
    if (lenis) lenis.scrollTo(id === '#inicio' ? 0 : el, { offset: -20, duration: 1.4 });
    else window.scrollTo({ top: id === '#inicio' ? 0 : el.getBoundingClientRect().top + scrollY - 20, behavior: RM ? 'auto' : 'smooth' });
  }));

  /* Mobile menu */
  const burger = $('#burger'), mm = $('#mmenu');
  function closeMenu() { if (!mm.hidden) { mm.hidden = true; burger.setAttribute('aria-expanded', 'false'); burger.lastElementChild.textContent = '[+]'; lenis && lenis.start(); } }
  burger.addEventListener('click', () => {
    const open = mm.hidden;
    mm.hidden = !open; burger.setAttribute('aria-expanded', String(open));
    burger.lastElementChild.textContent = open ? '[×]' : '[+]';
    if (lenis) open ? lenis.stop() : lenis.start();
  });

  /* Nav hide on scroll down */
  const nav = $('#nav'); let lastY = 0;
  const onScroll = y => { nav.classList.toggle('is-hidden', y > lastY && y > 300); lastY = y; };
  if (lenis) lenis.on('scroll', e => onScroll(e.scroll)); else addEventListener('scroll', () => onScroll(scrollY), { passive: true });

  /* Ken Burns slideshows (simulated video) */
  $$('.kb').forEach((kb, k) => {
    const imgs = $$('.kb__img', kb); let i = 0;
    const kbAnim = img => { if (!RM) gsap.fromTo(img, { scale: 1.04, xPercent: 0 }, { scale: 1.16, xPercent: k % 2 ? -2 : 2, duration: 7.5, ease: 'none' }); };
    kbAnim(imgs[0]);
    if (imgs.length > 1) setInterval(() => {
      imgs[i].classList.remove('is-on'); i = (i + 1) % imgs.length;
      imgs[i].classList.add('is-on'); kbAnim(imgs[i]);
    }, 5200 + k * 700);
  });

  /* Loader */
  const loader = $('#loader'), num = $('#loaderNum');
  const heroLines = $$('.hero__title .li');
  const finishLoad = () => {
    document.body.classList.remove('is-loading');
    lenis && lenis.start();
    ScrollTrigger.refresh();
  };
  if (RM) {
    loader.remove(); finishLoad();
  } else {
    gsap.set(heroLines, { yPercent: 110 });
    gsap.set('#heroMedia', { clipPath: 'inset(100% 0% 0% 0%)' });
    const c = { v: 0 };
    const tl = gsap.timeline();
    tl.to(c, { v: 100, duration: 1.8, ease: 'power2.inOut', onUpdate: () => { num.textContent = Math.round(c.v); } })
      .to(loader, { yPercent: -100, duration: .9, ease: 'power4.inOut' }, '+=.15')
      .to(heroLines, { yPercent: 0, duration: 1.1, stagger: .12, ease: 'power4.out' }, '-=.35')
      .fromTo('#heroMedia', { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'power4.inOut' }, '<.1')
      .add(() => { loader.remove(); finishLoad(); });
  }

  if (RM) {
    $$('.wipe__top').forEach(el => el.style.clipPath = 'none');
    initStatic();
    return;
  }

  const mm2 = gsap.matchMedia();

  /* Hero: media grows / parallax */
  gsap.fromTo('#heroMedia .kb', { yPercent: 0 }, { yPercent: 18, ease: 'none', scrollTrigger: { trigger: '#heroMedia', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.fromTo('.hero__title', { y: 0 }, { y: -120, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: '+=700', scrub: true } });

  /* Line reveals */
  $$('.reveal-lines').forEach(el => {
    gsap.fromTo($$('.li', el), { yPercent: 110 }, { yPercent: 0, duration: 1.1, stagger: .1, ease: 'power4.out', scrollTrigger: { trigger: el, start: 'top 85%' } });
  });

  /* About title words */
  gsap.fromTo('.about__title .row1', { xPercent: -12, opacity: 0 }, { xPercent: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: '.about__title', start: 'top 95%', end: 'top 45%', scrub: true } });
  gsap.fromTo('.about__title .row2', { xPercent: 12, opacity: 0 }, { xPercent: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: '.about__title', start: 'top 90%', end: 'top 35%', scrub: true } });
  gsap.fromTo('.about__title .star', { rotate: -180, scale: .2 }, { rotate: 0, scale: 1, ease: 'none', scrollTrigger: { trigger: '.about__title', start: 'top 85%', end: 'top 30%', scrub: true } });

  /* Grid: circles + tiles parallax */
  $$('.tile--circ').forEach(t => {
    const c = $('.circ', t), s = $('span', t);
    gsap.fromTo(c, { scale: .15 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: t, start: 'top 95%', end: 'top 35%', scrub: true } });
    gsap.fromTo(s, { opacity: 0, y: 20 }, { opacity: 1, y: 0, ease: 'none', scrollTrigger: { trigger: t, start: 'top 60%', end: 'top 35%', scrub: true } });
  });
  $$('.tile--img, .tile--big').forEach((t, i) => {
    const img = $('img', t) ;
    gsap.fromTo(t, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'power3.inOut', scrollTrigger: { trigger: t, start: 'top 88%' } });
    if (img && t.classList.contains('tile--img')) gsap.fromTo(img, { scale: 1.25 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: t, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  gsap.fromTo('.g4 .brk', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.g4', start: 'top 80%' } });
  gsap.fromTo('.bubble--abs', { scale: 0, rotate: -40 }, { scale: 1, rotate: 0, duration: 1, ease: 'back.out(1.6)', scrollTrigger: { trigger: '.g7', start: 'top 55%' } });

  /* Modules */
  gsap.fromTo('.mods__rule', { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: 'power3.inOut', scrollTrigger: { trigger: '.mods__rule', start: 'top 85%' } });
  gsap.fromTo('.brk--side', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1, scrollTrigger: { trigger: '.mods__head', start: 'top 70%' } });
  $$('.mgroup li').forEach(li => {
    gsap.fromTo(li, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: .9, ease: 'power3.out', scrollTrigger: { trigger: li, start: 'top 92%' } });
  });
  const bgs = $$('.mods__bg img');
  const setBg = i => bgs.forEach((b, k) => b.classList.toggle('is-on', k === i));
  $$('.mgroup li').forEach(li => {
    li.addEventListener('mouseenter', () => setBg(+li.dataset.i));
    li.addEventListener('mouseleave', () => setBg(0));
  });
  gsap.fromTo('.mods__bg', { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: '.mods', start: 'top bottom', end: 'bottom top', scrub: true } });

  /* Numbers marquee (scroll driven) */
  gsap.fromTo('.mq--a .mq__track', { xPercent: 0 }, { xPercent: -35, ease: 'none', scrollTrigger: { trigger: '.nums', start: 'top bottom', end: 'bottom top', scrub: .6 } });
  gsap.fromTo('.mq--b .mq__track', { xPercent: -45 }, { xPercent: -10, ease: 'none', scrollTrigger: { trigger: '.nums', start: 'top bottom', end: 'bottom top', scrub: .6 } });
  [['.float--1', 120, -60], ['.float--2', -40, 80], ['.float--3', 160, -120]].forEach(([s, a, b]) =>
    gsap.fromTo(s, { y: a }, { y: b, ease: 'none', scrollTrigger: { trigger: '.nums', start: 'top bottom', end: 'bottom top', scrub: true } }));
  gsap.fromTo('.wipe__top', { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', scrollTrigger: { trigger: '.nums', start: 'top 70%', end: 'center 35%', scrub: true } });

  /* Problems: pinned card spread (desktop) */
  mm2.add('(min-width: 992px)', () => {
    const cards = $$('.card');
    const start = [{ x: -60, y: 120, r: -8 }, { x: 40, y: 70, r: 7 }, { x: -20, y: 160, r: -3 }, { x: 70, y: 200, r: 10 }];
    const W = () => Math.min(innerWidth, 1600);
    const end = () => [{ x: -W() * .33, y: -innerHeight * .12, r: -5 }, { x: -W() * .11, y: innerHeight * .1, r: 4 }, { x: W() * .11, y: -innerHeight * .08, r: -3 }, { x: W() * .33, y: innerHeight * .12, r: 6 }];
    cards.forEach((c, i) => gsap.set(c, { x: start[i].x, y: start[i].y + innerHeight * .25, rotate: start[i].r }));
    const tl = gsap.timeline({ scrollTrigger: { trigger: '.probs', start: 'top top', end: '+=160%', pin: '.probs__pin', scrub: .8, invalidateOnRefresh: true } });
    cards.forEach((c, i) => tl.fromTo(c, { x: start[i].x, y: () => start[i].y + innerHeight * .25, rotate: start[i].r },
      { x: () => end()[i].x, y: () => end()[i].y, rotate: () => end()[i].r, ease: 'power2.inOut', duration: 1 }, i * .08));
    tl.fromTo('.probs__title', { scale: 1, opacity: 1 }, { scale: .86, opacity: .35, ease: 'none', duration: 1 }, 0);
    tl.fromTo('.probs__bg img', { yPercent: 0 }, { yPercent: -10, ease: 'none', duration: 1.24 }, 0);
    return () => cards.forEach(c => gsap.set(c, { clearProps: 'all' }));
  });
  mm2.add('(max-width: 991px)', () => {
    gsap.fromTo('.probs__title', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1, scrollTrigger: { trigger: '.probs', start: 'top 75%' } });
  });

  /* Method cards */
  gsap.fromTo('.plan', { y: 80, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: .12, ease: 'power3.out', scrollTrigger: { trigger: '.plans', start: 'top 85%' } });

  /* Map */
  gsap.fromTo('.loc__map', { scale: .8, opacity: 0, rotate: -20 }, { scale: 1, opacity: 1, rotate: 0, duration: 1.4, ease: 'power3.out', scrollTrigger: { trigger: '.loc', start: 'top 70%' }, onComplete: drawLine });
  gsap.fromTo('.loc__card', { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'power3.out', delay: .3, scrollTrigger: { trigger: '.loc', start: 'top 60%' } });

  /* CTA */
  gsap.fromTo('.cta__bg', { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom top', scrub: true } });
  mm2.add('(min-width: 992px)', () => {
    gsap.fromTo('.cta__inline', { width: '0vw' }, { width: '30vw', ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top 85%', end: 'top 25%', scrub: true } });
  });
  gsap.fromTo('.cr1', { xPercent: -6, opacity: 0 }, { xPercent: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top 90%', end: 'top 40%', scrub: true } });
  gsap.fromTo('.cr2', { xPercent: 6, opacity: 0 }, { xPercent: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top 80%', end: 'top 30%', scrub: true } });
  gsap.fromTo('.cta__form .bubble', { scale: 0 }, { scale: 1, duration: 1.1, ease: 'back.out(1.5)', scrollTrigger: { trigger: '.cta__form', start: 'top 80%' } });
  gsap.fromTo('.foot__big', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1, scrollTrigger: { trigger: '.foot', start: 'top 90%' } });

  initStatic();

  /* ---------- shared (also for reduced motion) ---------- */
  function initStatic() {
    /* Cards details */
    $$('.card').forEach(card => {
      const b = $('.card__more', card);
      b.addEventListener('click', () => {
        const o = card.classList.toggle('is-open');
        b.setAttribute('aria-expanded', String(o));
        b.lastElementChild.textContent = o ? '[−]' : '[+]';
      });
    });
    /* Modules: keyboard/touch active state */
    $$('.mgroup li').forEach(li => { li.tabIndex = 0; li.addEventListener('focus', () => li.classList.add('is-on')); li.addEventListener('blur', () => li.classList.remove('is-on')); });

    /* Map canvas */
    drawMap();
    const cities = [
      { n: 'Cancún', img: 'https://ornat-fitandyou.vercel.app/img/loc-cancun.webp', alt: 'Maqueta 3D de una torre residencial' },
      { n: 'Playa del Carmen', img: 'https://ornat-fitandyou.vercel.app/img/loc-playa.webp', alt: 'Maqueta 3D de un edificio frente a la playa' },
      { n: 'Tulum', img: 'https://ornat-fitandyou.vercel.app/img/loc-tulum.webp', alt: 'Maqueta 3D de villas sobre el agua' }
    ];
    const setCity = i => {
      $$('.pin').forEach(p => p.classList.toggle('is-on', +p.dataset.c === i));
      $$('.loc__row button').forEach(p => p.classList.toggle('is-on', +p.dataset.c === i));
      $('#locCity').textContent = cities[i].n;
      const im = $('#locImg'); im.style.opacity = 0;
      setTimeout(() => { im.removeAttribute("srcset"); im.removeAttribute("sizes"); im.src = cities[i].img; im.alt = cities[i].alt; im.style.opacity = 1; }, 200);
      drawLine();
    };
    $$('.pin, .loc__row button').forEach(p => p.addEventListener('click', () => setCity(+p.dataset.c)));
    addEventListener('resize', () => { drawMap(); drawLine(); });

    /* CTA form → WhatsApp */
    $('#ctaForm').addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(e.target);
      let msg = 'Hola ORNAT, quiero solicitar una demo';
      const parts = [['Nombre', f.get('nombre')], ['Empresa', f.get('empresa')], ['Teléfono', f.get('tel')]].filter(p => p[1] && p[1].trim());
      if (parts.length) msg += '. ' + parts.map(p => p[0] + ': ' + p[1].trim()).join(', ');
      window.open(WA + encodeURIComponent(msg), '_blank', 'noopener');
    });
  }

  function drawLine() {
    const svg = $('#locLine'); if (!svg || getComputedStyle(svg).display === 'none') return;
    const loc = $('.loc').getBoundingClientRect();
    const pin = $('.pin.is-on').getBoundingClientRect();
    const card = $('#locCard').getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${loc.width} ${loc.height}`);
    const l = $('line', svg);
    l.setAttribute('x1', card.right - loc.left); l.setAttribute('y1', card.top - loc.top + 40);
    l.setAttribute('x2', pin.left + pin.width / 2 - loc.left); l.setAttribute('y2', pin.top + pin.height / 2 - loc.top);
  }

  function drawMap() {
    const cv = $('#mapCanvas'); if (!cv) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const s = cv.clientWidth; if (!s) return;
    cv.width = s * dpr; cv.height = s * dpr;
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // seeded random
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, s, s);
    // coastline: land to the left, Caribbean to the right (diagonal NE→SW)
    const coast = y => s * (0.70 - 0.32 * (y / s)) + Math.sin(y / s * 9) * s * .025;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(0, 0);
    for (let y = 0; y <= s; y += 4) ctx.lineTo(coast(y), y);
    ctx.lineTo(0, s); ctx.closePath(); ctx.clip();
    ctx.fillStyle = '#1c1c1c'; ctx.fillRect(0, 0, s, s);
    // street grid blocks
    ctx.strokeStyle = 'rgba(255,255,255,.13)'; ctx.lineWidth = 1;
    for (let b = 0; b < 26; b++) {
      const cx = rnd() * s * .8, cy = rnd() * s, ang = (rnd() - .5) * 1.2, len = s * (.1 + rnd() * .25), step = 6 + rnd() * 10;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
      for (let k = -len / 2; k < len / 2; k += step) { ctx.beginPath(); ctx.moveTo(-len / 2, k); ctx.lineTo(len / 2, k); ctx.stroke(); }
      for (let k = -len / 2; k < len / 2; k += step * 1.7) { ctx.beginPath(); ctx.moveTo(k, -len / 2); ctx.lineTo(k, len / 2); ctx.stroke(); }
      ctx.restore();
    }
    // main highway along the coast
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2; ctx.beginPath();
    for (let y = 0; y <= s; y += 4) { const x = coast(y) - s * .07; y ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    ctx.restore();
    // sea ripples
    ctx.strokeStyle = 'rgba(255,255,255,.04)';
    for (let k = 1; k < 9; k++) { ctx.beginPath(); for (let y = 0; y <= s; y += 6) { const x = coast(y) + k * s * .035; y ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
    // Cozumel island
    ctx.fillStyle = '#141414'; ctx.beginPath(); ctx.ellipse(s * .68, s * .55, s * .035, s * .09, -.5, 0, Math.PI * 2); ctx.fill();
    // vignette
    const g = ctx.createRadialGradient(s / 2, s / 2, s * .3, s / 2, s / 2, s * .5);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.85)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  }
})();
