(() => {
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const hasGsap = typeof gsap !== 'undefined';
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  /* ---------- Lenis ---------- */
  let lenis = null;
  if (!RM && typeof Lenis !== 'undefined') {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    window.lenis = lenis;
    if (hasGsap) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  const scrollToEl = el => {
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.4 });
    else el.scrollIntoView({ behavior: RM ? 'auto' : 'smooth' });
  };
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    const el = id.length > 1 ? document.querySelector(id) : null;
    if (!el) return;
    e.preventDefault();
    closeMenu();
    scrollToEl(el);
  }));

  /* ---------- Menu ---------- */
  const menu = $('#menu'), burger = $('.burger');
  function openMenu() {
    menu.classList.add('open'); document.body.classList.add('menu-open');
    menu.setAttribute('aria-hidden', 'false'); burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Cerrar menú');
    $$('.menu-links a').forEach((a, i) => a.style.transitionDelay = (0.25 + i * 0.06) + 's');
    lenis && lenis.stop();
  }
  function closeMenu() {
    if (!menu.classList.contains('open')) return;
    menu.classList.remove('open'); document.body.classList.remove('menu-open');
    menu.setAttribute('aria-hidden', 'true'); burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Abrir menú');
    $$('.menu-links a').forEach(a => a.style.transitionDelay = '0s');
    lenis && lenis.start();
  }
  burger.addEventListener('click', () => menu.classList.contains('open') ? closeMenu() : openMenu());
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  /* ---------- Hero words (letter blur cycle) ---------- */
  const words = $$('.hero-words span');
  words.forEach(w => {
    const t = w.textContent; w.textContent = '';
    [...t].forEach(ch => { const s = document.createElement('b'); s.textContent = ch; s.style.cssText = 'font-weight:inherit;display:inline-block'; w.appendChild(s); });
  });
  function heroWords() {
    if (!hasGsap || RM) { words[0].style.opacity = 1; return; }
    const tl = gsap.timeline({ repeat: -1 });
    words.forEach(w => {
      const L = $$('b', w);
      tl.set(w, { opacity: 1 })
        .fromTo(L, { opacity: 0, filter: 'blur(14px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.9, stagger: 0.07, ease: 'power2.out' })
        .to({}, { duration: 1.4 })
        .fromTo(L, { opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(14px)', duration: 0.7, stagger: 0.05, ease: 'power2.in' })
        .set(w, { opacity: 0 });
    });
  }

  /* ---------- Hero bg crossfade + Ken Burns ---------- */
  const bgs = $$('.hero-bg img');
  if (!RM) {
    let bi = 0;
    setInterval(() => { bgs[bi].classList.remove('is-on'); bi = (bi + 1) % bgs.length; bgs[bi].classList.add('is-on'); }, 6500);
    if (hasGsap) bgs.forEach((im, i) => gsap.fromTo(im, { scale: 1, xPercent: i % 2 ? -2 : 2 }, { scale: 1.1, xPercent: i % 2 ? 2 : -2, duration: 16, ease: 'none', repeat: -1, yoyo: true }));
  }

  /* ---------- Preloader ---------- */
  const pre = $('.preloader');
  function finishLoad() {
    document.body.classList.remove('is-loading');
    heroWords();
    if (hasGsap && !RM) {
      gsap.fromTo('.hero-logo', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out' });
      gsap.fromTo('.hero-box', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1, delay: 0.3, ease: 'power3.out' });
      gsap.fromTo('.hero-anchors a', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.07, delay: 0.4 });
    }
    ScrollTrigger && ScrollTrigger.refresh();
  }
  if (RM || !hasGsap) { pre.remove(); document.body.classList.remove('is-loading'); words[0] && (words[0].style.opacity = 1); }
  else {
    const imgs = $$('img', pre); let n = 0;
    lenis && lenis.stop();
    const flick = setInterval(() => {
      imgs.forEach(i => i.classList.remove('on'));
      const k = Math.floor(Math.random() * imgs.length); imgs[k].classList.add('on');
      if (Math.random() > 0.6) imgs[(k + 1) % imgs.length].classList.add('on');
      n++;
      if (n > 16) {
        clearInterval(flick);
        imgs.forEach(i => i.classList.remove('on'));
        gsap.to(pre, { opacity: 0, duration: 0.6, ease: 'power2.out', onComplete: () => { pre.remove(); lenis && lenis.start(); } });
        finishLoad();
      }
    }, 110);
  }

  if (!hasGsap) return;

  /* ---------- Reveals ---------- */
  if (!RM) {
    $$('.reveal').forEach(el => gsap.fromTo(el, { y: 44, opacity: 0 }, {
      y: 0, opacity: 1, duration: 1.1, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true }
    }));
    gsap.fromTo('.hero-center', { yPercent: 0, opacity: 1 }, { yPercent: -18, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.fromTo('.tex-lines', { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: 'body', start: 'top top', end: 'bottom bottom', scrub: true } });
  }

  /* ---------- Sketch → render wipe (studio) ---------- */
  const sw = $('.sketch-wipe .sw-render');
  if (sw && !RM) {
    gsap.fromTo(sw, { clipPath: 'inset(0% 100% 0% 0%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)', ease: 'none',
      scrollTrigger: { trigger: '.sketch-wipe', start: 'top 70%', end: 'bottom 35%', scrub: true }
    });
  }

  /* ---------- Auto tabs ---------- */
  const tabs = $$('.tab'), media = $$('.tabs-media img'), pauseBtn = $('.tabs-pause');
  let ti = 0, paused = false, prog = null;
  function setTab(i) {
    ti = i;
    tabs.forEach((t, k) => { t.classList.toggle('is-active', k === i); t.setAttribute('aria-selected', k === i); });
    media.forEach((m, k) => m.classList.toggle('is-on', k === i));
    gsap.fromTo(media[i], { scale: 1.08 }, { scale: 1, duration: 6.5, ease: 'none' });
    $$('.tab-line i').forEach(l => gsap.set(l, { scaleX: 0 }));
    prog && prog.kill();
    prog = gsap.fromTo($('.tab-line i', tabs[i]), { scaleX: 0 }, { scaleX: 1, duration: RM ? 0.01 : 6, ease: 'none', paused: RM, onComplete: () => setTab((ti + 1) % tabs.length) });
    if (paused) prog.pause();
  }
  tabs.forEach((t, k) => {
    t.addEventListener('click', () => setTab(k));
    t.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTab(k); } });
  });
  pauseBtn.addEventListener('click', () => {
    paused = !paused; pauseBtn.classList.toggle('paused', paused);
    pauseBtn.setAttribute('aria-label', paused ? 'Reproducir' : 'Pausar');
    paused ? prog.pause() : prog.resume();
  });
  if (RM) { paused = true; pauseBtn.classList.add('paused'); }
  setTab(0);
  ScrollTrigger.create({ trigger: '.tabs-sec', start: 'top bottom', end: 'bottom top', onToggle: s => { if (!paused && prog) s.isActive ? prog.resume() : prog.pause(); } });

  /* ---------- Horizontal modules ---------- */
  const hs = $('.hs'), track = $('.hs-track'), slides = $$('.slide'), bar = $('.hs-progress i');
  const mm = gsap.matchMedia();
  mm.add('(min-width: 768px)', () => {
    const dist = () => track.scrollWidth - window.innerWidth;
    const setH = () => { hs.style.height = (dist() + window.innerHeight) + 'px'; };
    setH();
    const st = ScrollTrigger.create({
      trigger: hs, start: 'top top', end: () => '+=' + dist(), invalidateOnRefresh: true,
      onRefreshInit: setH,
      onUpdate: self => {
        const p = self.progress;
        gsap.set(track, { x: -p * dist() });
        gsap.set(bar, { scaleX: p });
        const a = Math.round(p * (slides.length - 1));
        slides.forEach((s, k) => s.classList.toggle('is-active', k === a));
        slides.forEach((s, k) => {
          const im = $('.slide-img:not(.slide-wipe) img', s);
          if (im && !RM) gsap.set(im, { xPercent: (k - p * (slides.length - 1)) * -6 });
        });
      }
    });
    slides[0].classList.add('is-active');
    return () => { st.kill(); hs.style.height = ''; gsap.set(track, { x: 0 }); };
  });
  mm.add('(max-width: 767px)', () => {
    const sts = slides.map(s => ScrollTrigger.create({ trigger: s, start: 'top 65%', end: 'bottom 35%', toggleClass: 'is-active' }));
    return () => sts.forEach(s => s.kill());
  });

  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
