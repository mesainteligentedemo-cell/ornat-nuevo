(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const FILM_SRC = 'https://ornat-whitedesert.vercel.app/media/ornat-pelicula.mp4';

  /* ---------- smooth scroll ---------- */
  let lenis = null;
  if (!reduce && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ duration: 1.15, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    if (hasGsap) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  const goTo = (target) => {
    const el = typeof target === 'string' ? $(target) : target;
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.4 });
    else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  };
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id.length < 2 || !$(id)) return;
    e.preventDefault();
    closeMenu(); closeDrawer();
    goTo(id === '#top' ? document.body : id);
  }));

  /* ---------- nav state ---------- */
  const nav = $('#nav'), tab = $('#sideTab');
  const onScroll = () => {
    const y = window.scrollY, vh = window.innerHeight;
    nav.classList.toggle('light', y > vh * 0.75);
    tab.classList.toggle('show', y > vh * 0.9);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- mobile menu ---------- */
  const menu = $('#menu'), menuBtn = $('#menuBtn');
  function openMenu() { menu.hidden = false; menuBtn.setAttribute('aria-expanded', 'true'); lenis && lenis.stop(); $('#menuClose').focus(); }
  function closeMenu() { if (menu.hidden) return; menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); lenis && lenis.start(); }
  menuBtn.addEventListener('click', openMenu);
  $('#menuClose').addEventListener('click', closeMenu);

  /* ---------- drawer (Cómo funciona) ---------- */
  const drawer = $('#drawer'), scrim = $('#scrim');
  function openDrawer() {
    drawer.hidden = false; scrim.hidden = false;
    requestAnimationFrame(() => { drawer.classList.add('open'); scrim.classList.add('show'); });
    tab.setAttribute('aria-expanded', 'true'); lenis && lenis.stop();
    $('#drawerClose').focus();
  }
  function closeDrawer() {
    if (drawer.hidden) return;
    drawer.classList.remove('open'); scrim.classList.remove('show');
    tab.setAttribute('aria-expanded', 'false'); lenis && lenis.start();
    setTimeout(() => { drawer.hidden = true; scrim.hidden = true; }, 600);
  }
  tab.addEventListener('click', openDrawer);
  $('#menuHow').addEventListener('click', () => { closeMenu(); openDrawer(); });
  $('#drawerClose').addEventListener('click', closeDrawer);
  scrim.addEventListener('click', closeDrawer);

  /* ---------- film modal ---------- */
  const film = $('#film'), video = $('#filmVideo');
  let lastFocus = null;
  function openFilm() {
    lastFocus = document.activeElement;
    if (!video.getAttribute('src')) video.src = FILM_SRC;
    film.hidden = false;
    requestAnimationFrame(() => film.classList.add('show'));
    lenis && lenis.stop();
    document.documentElement.style.overflow = 'hidden';
    video.muted = false;
    const p = video.play();
    if (p && p.catch) p.catch(() => {});
    $('#filmClose').focus();
  }
  function closeFilm() {
    if (film.hidden) return;
    video.pause();
    try { video.currentTime = 0; } catch (e) {}
    film.classList.remove('show');
    document.documentElement.style.overflow = '';
    lenis && lenis.start();
    setTimeout(() => { film.hidden = true; }, 450);
    lastFocus && lastFocus.focus && lastFocus.focus();
  }
  $$('[data-film]').forEach(b => b.addEventListener('click', openFilm));
  $('#filmClose').addEventListener('click', closeFilm);
  film.addEventListener('click', e => { if (e.target === film) closeFilm(); });
  video.addEventListener('ended', closeFilm);
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    closeFilm(); closeDrawer(); closeMenu();
  });
  $$('[data-close-drawer]').forEach(a => a.addEventListener('click', closeDrawer));

  /* ---------- modules accordion ---------- */
  const pans = $$('#acc .pan');
  const activate = p => { pans.forEach(x => x.classList.toggle('on', x === p)); };
  pans.forEach(p => {
    p.addEventListener('mouseenter', () => { if (matchMedia('(min-width: 901px)').matches) activate(p); });
    p.addEventListener('focus', () => activate(p));
    p.addEventListener('click', () => activate(p));
  });

  /* ---------- statement word split ---------- */
  $$('.reveal-words').forEach(el => {
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map(w => `<span class="w">${w}</span>`).join(' ');
  });

  if (!hasGsap) {
    $$('.statement .w').forEach(w => (w.style.opacity = 1));
    $$('#alist li').forEach(li => li.classList.add('on'));
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  /* hero intro: letters rise */
  const hw = $('#heroTitle .hw');
  hw.innerHTML = [...hw.textContent].map(c => `<span class="ch">${c}</span>`).join('');
  if (!reduce) {
    gsap.from('#heroTitle .ch', { yPercent: 105, opacity: 0, duration: 1.6, ease: 'expo.out', stagger: 0.07, delay: 0.15 });
    gsap.from(['.hero-tag', '.hero-film'], { opacity: 0, y: 14, duration: 1.2, ease: 'power3.out', delay: 0.9, stagger: 0.12 });
    gsap.from('.nav .box, .logo', { opacity: 0, y: -10, duration: 1, ease: 'power3.out', delay: 0.5, stagger: 0.04 });
  }

  const mm = gsap.matchMedia();
  mm.add({ desk: '(min-width: 901px)', mob: '(max-width: 900px)', motion: '(prefers-reduced-motion: no-preference)' }, ctx => {
    const { desk, motion } = ctx.conditions;
    if (!motion) {
      $$('.statement .w').forEach(w => (w.style.opacity = 1));
      $$('#alist li').forEach(li => li.classList.add('on'));
      $$('#planoRender').forEach(r => (r.style.opacity = 1));
      return;
    }

    /* hero -> fog (pinned via sticky) */
    const htl = gsap.timeline({ scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom bottom', scrub: 0.6 } });
    htl.to('#heroTitle', { yPercent: -55, scale: 1.12, filter: 'blur(12px)', opacity: 0.55, ease: 'none' }, 0)
       .to('.hero-tag, .hero-film', { y: -80, opacity: 0, ease: 'none', duration: 0.5 }, 0)
       .to('.hero-media', { scale: 1.12, ease: 'none' }, 0)
       .fromTo('#fog', { y: 0, yPercent: 80, opacity: 0 }, { yPercent: 0, opacity: 1, ease: 'none', duration: 0.55 }, 0)
       .to('#fog', { scaleY: 2.3, transformOrigin: '50% 100%', ease: 'none', duration: 0.45 }, 0.55)
       .fromTo('.hero-white', { opacity: 0 }, { opacity: 1, ease: 'none', duration: 0.3 }, 0.7);

    /* statement words */
    gsap.to('.statement .w', { opacity: 1, stagger: 0.06, ease: 'none',
      scrollTrigger: { trigger: '.statement', start: 'top 82%', end: 'bottom 45%', scrub: true } });

    /* swoosh drawing */
    $$('path.draw').forEach(p => {
      const len = p.getTotalLength();
      gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 2.2, ease: 'power2.inOut',
        scrollTrigger: { trigger: p.closest('section'), start: 'top 70%' } });
    });

    /* intro render rising from fog */
    gsap.fromTo('#introImg', { yPercent: 18, opacity: 0.2 }, { yPercent: -6, opacity: 1, ease: 'none',
      scrollTrigger: { trigger: '.intro-fig', start: 'top 100%', end: 'center 45%', scrub: true } });

    /* fade-ups */
    $$('.mrow, .defn blockquote, .intro-cols .col, .st, .mods-intro, .aud-title, .aud-sub, .aud-line').forEach(el => {
      gsap.from(el, { y: 50, opacity: 0, duration: 1.3, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
    });
    gsap.from('.acc .pan', { y: 80, opacity: 0, duration: 1.2, ease: 'power3.out', stagger: 0.06, scrollTrigger: { trigger: '.acc', start: 'top 85%' } });

    /* servicios parallax */
    gsap.fromTo('.sv-media img', { yPercent: -8 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.sv-hero', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.from('.sv-title', { scale: 0.86, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.sv-hero', start: 'top 80%', end: 'center 55%', scrub: true } });

    /* territorios horizontal (desktop) */
    if (desk) {
      const track = $('#terrTrack');
      const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
      gsap.to(track, { x: () => -dist(), ease: 'none',
        scrollTrigger: { trigger: '.terr', start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1 } });
    } else {
      $$('.tcard').forEach(c => gsap.from(c, { y: 40, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: c, start: 'top 90%' } }));
    }

    /* plano -> render */
    const ptl = gsap.timeline({ scrollTrigger: { trigger: '#plano', start: 'top top', end: 'bottom bottom', scrub: 0.6 } });
    ptl.fromTo('.plano-fig', { scale: 0.92 }, { scale: 1.04, ease: 'none', duration: 1 }, 0)
       .to('#planoRender', { opacity: 1, ease: 'none', duration: 0.4 }, 0.3)
       .fromTo('.ghostword', { opacity: 0.4, letterSpacing: '0em' }, { opacity: 1, letterSpacing: '.04em', ease: 'none', duration: 1 }, 0)
       .fromTo('.plano-q', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.2 }, 0.05);

    /* audience list highlight */
    $$('#alist li').forEach(li => {
      ScrollTrigger.create({ trigger: li, start: 'top 62%', end: 'bottom 38%', toggleClass: 'on' });
    });

    /* cta */
    gsap.fromTo('#ctaImg', { yPercent: -10 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.from('.cta-in > *', { y: 40, opacity: 0, duration: 1.2, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: '.cta-in', start: 'top 80%' } });

    /* footer word */
    gsap.from('.fbig', { yPercent: 30, opacity: 0, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: '.fbig', start: 'top 95%' } });
  });

  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
