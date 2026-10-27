(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  if (reduced || !hasGsap) document.documentElement.classList.add('reduced');

  /* ---------- smooth scroll ---------- */
  let lenis = null;
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);
  if (!reduced && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    if (hasGsap) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  const goTo = target => {
    const el = typeof target === 'string' ? $(target) : target;
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.4 });
    else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  };

  /* ---------- nav ---------- */
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('is-solid', window.scrollY > 60);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const burger = $('#burger'), menu = $('#menu');
  const setMenu = open => {
    document.body.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    menu.setAttribute('aria-hidden', String(!open));
    if (lenis) open ? lenis.stop() : lenis.start();
  };
  burger.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const el = $(id);
    if (!el) return;
    e.preventDefault();
    const wasOpen = document.body.classList.contains('menu-open');
    setMenu(false);
    if (el.tagName === 'DETAILS') el.open = true;
    setTimeout(() => goTo(el), wasOpen ? 380 : 0);
  }));

  /* ---------- hero toggle ---------- */
  const hero = $('#hero');
  const tgs = $$('.tg', hero), pill = $('.tg-pill', hero);
  const placePill = () => {
    const on = tgs.find(b => b.classList.contains('is-on'));
    if (!on) return;
    pill.style.width = on.offsetWidth + 'px';
    pill.style.transform = `translateX(${on.offsetLeft - 4}px)`;
  };
  const setMode = k => {
    hero.dataset.mode = k;
    tgs.forEach(b => { const on = b.dataset.k === k; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', String(on)); });
    $$('.hero-img, .ht, .hs', hero).forEach(el => el.classList.toggle('is-on', el.dataset.k === k));
    placePill();
  };
  let heroAuto = setInterval(() => setMode(hero.dataset.mode === 'diseno' ? 'auto' : 'diseno'), 7000);
  tgs.forEach(b => b.addEventListener('click', () => { clearInterval(heroAuto); setMode(b.dataset.k); }));
  window.addEventListener('resize', placePill);
  document.fonts && document.fonts.ready.then(placePill);
  placePill();

  /* ---------- modules slider ---------- */
  const stage = $('#mstage');
  const slides = $$('.ms', stage), cards = $$('.mc', stage), chips = $$('.chip', stage);
  const chipBox = $('#mchips'), num = $('#mnum'), dashBox = $('#mdash');
  slides.forEach((_, i) => {
    const b = document.createElement('button');
    b.setAttribute('aria-label', `Módulo ${i + 1}`);
    b.addEventListener('click', () => { show(i); restart(); });
    dashBox.appendChild(b);
  });
  const dashes = $$('button', dashBox);
  let idx = 0, timer = null, inView = false;
  function show(i) {
    idx = (i + slides.length) % slides.length;
    [slides, cards, chips, dashes].forEach(list => list.forEach((el, j) => el.classList.toggle('is-on', j === idx)));
    chips.forEach((c, j) => c.setAttribute('aria-selected', String(j === idx)));
    num.textContent = String(idx + 1).padStart(2, '0');
    const c = chips[idx];
    if (chipBox.scrollWidth > chipBox.clientWidth) {
      chipBox.scrollTo({ left: c.offsetLeft - chipBox.clientWidth / 2 + c.offsetWidth / 2, behavior: 'smooth' });
    }
  }
  const restart = () => { clearInterval(timer); if (inView && !reduced) timer = setInterval(() => show(idx + 1), 6500); };
  chips.forEach((c, j) => c.addEventListener('click', () => { show(j); restart(); }));
  $('#mprev').addEventListener('click', () => { show(idx - 1); restart(); });
  $('#mnext').addEventListener('click', () => { show(idx + 1); restart(); });
  let tx = null;
  stage.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', e => {
    if (tx === null) return;
    const dx = e.changedTouches[0].clientX - tx; tx = null;
    if (Math.abs(dx) > 50 && !e.target.closest('.chips')) { show(idx + (dx < 0 ? 1 : -1)); restart(); }
  });
  new IntersectionObserver(([en]) => { inView = en.isIntersecting; restart(); }, { threshold: .35 }).observe(stage);
  show(0);

  /* ---------- reel + sound ---------- */
  const video = $('#reelv'), snd = $('#snd');
  let reelVisible = false;
  const tryPlay = () => { const p = video.play(); if (p && p.catch) p.catch(() => {}); };
  new IntersectionObserver(([en]) => {
    reelVisible = en.isIntersecting;
    reelVisible ? tryPlay() : video.pause();
  }, { threshold: .2 }).observe(video);
  snd.addEventListener('click', () => {
    const on = video.muted;
    video.muted = !on;
    snd.setAttribute('aria-pressed', String(on));
    snd.setAttribute('aria-label', on ? 'Silenciar showreel' : 'Activar sonido del showreel');
    if (on) {
      video.volume = .85;
      if (!reelVisible) goTo('#reel');
      tryPlay();
    }
  });

  /* ---------- sketch / render wipe ---------- */
  const wstage = $('#wstage'), wrd = $('#wrd'), wbar = $('#wbar');
  let dragAt = 0;
  const setWipe = p => {
    p = Math.max(0, Math.min(100, p));
    wrd.style.clipPath = `inset(0 0 0 ${p}%)`;
    wbar.style.left = p + '%';
  };
  const fromPointer = e => { const r = wstage.getBoundingClientRect(); setWipe((e.clientX - r.left) / r.width * 100); dragAt = performance.now(); };
  let dragging = false;
  wstage.addEventListener('pointerdown', e => { dragging = true; wstage.setPointerCapture(e.pointerId); fromPointer(e); });
  wstage.addEventListener('pointermove', e => { if (dragging || e.pointerType === 'mouse') fromPointer(e); });
  wstage.addEventListener('pointerup', () => { dragging = false; });
  wstage.addEventListener('pointercancel', () => { dragging = false; });
  setWipe(50);

  /* ---------- footer ---------- */
  const marq = $('#marq');
  marq.innerHTML += marq.innerHTML;
  const clock = $('#clock');
  const tick = () => {
    try { clock.textContent = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Cancun' }).format(new Date()); }
    catch (_) { clock.textContent = new Date().toTimeString().slice(0, 5); }
  };
  tick(); setInterval(tick, 20000);
  $('#news').addEventListener('submit', e => {
    e.preventDefault();
    e.currentTarget.outerHTML = '<p class="eyebrow gold" style="margin-top:8px">¡Gracias! Nuestro equipo te contactará muy pronto.</p>';
  });

  /* ---------- tilt cards ---------- */
  const cardEls = $$('.card3d');
  const tilt = () => {
    const vw = window.innerWidth;
    cardEls.forEach(c => {
      const r = c.getBoundingClientRect();
      const d = Math.max(-1.4, Math.min(1.4, ((r.left + r.width / 2) - vw / 2) / (vw / 2)));
      c.style.setProperty('--ry', (-d * 13).toFixed(2) + 'deg');
    });
  };
  $('#cards').addEventListener('scroll', tilt, { passive: true });
  window.addEventListener('resize', tilt);
  tilt();

  if (!hasGsap) { $$('.rv').forEach(el => { el.style.opacity = 1; el.style.transform = 'none'; }); return; }

  /* ---------- GSAP motion ---------- */
  if (reduced) return;

  // hero intro
  gsap.from('.hero-title .ht.is-on', { opacity: 0, y: 40, filter: 'blur(10px)', duration: 1.8, ease: 'power3.out', delay: .2, clearProps: 'filter,transform,opacity' });
  gsap.from(['.hero-label', '.toggle', '.hero-sub', '.hero-cue'], { opacity: 0, y: 18, duration: 1.2, ease: 'power2.out', stagger: .12, delay: .7 });
  gsap.from('.nav > *', { opacity: 0, y: -12, duration: 1, ease: 'power2.out', stagger: .08, delay: .4 });
  gsap.to('.hero-in', { yPercent: 18, opacity: .2, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true } });

  // reveals
  ScrollTrigger.batch('.rv', {
    start: 'top 88%',
    onEnter: els => gsap.to(els, { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out', stagger: .1, overwrite: true })
  });
  $$('.eyebrow.dot').forEach(el => gsap.from(el, { opacity: 0, y: 12, duration: 1, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 90%' } }));

  // parallax images
  $$('.par').forEach(el => {
    const s = parseFloat(el.dataset.speed || 8);
    gsap.fromTo(el, { yPercent: -s }, { yPercent: s, ease: 'none', scrollTrigger: { trigger: el.closest('section'), start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // modules stage reveal
  gsap.fromTo('#mstage', { clipPath: 'inset(6% 5% 6% 5% round 18px)' }, { clipPath: 'inset(0% 0% 0% 0% round 14px)', ease: 'none', scrollTrigger: { trigger: '#modulos', start: 'top 95%', end: 'top 15%', scrub: true } });

  // reel frame grows
  gsap.fromTo('#rframe', { scale: .88 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '#rframe', start: 'top bottom', end: 'center center', scrub: true } });

  // wipe follows scroll unless the user is dragging
  ScrollTrigger.create({
    trigger: '#wstage', start: 'top 85%', end: 'bottom 30%',
    onUpdate: st => { if (performance.now() - dragAt > 1500) setWipe(92 - st.progress * 84); }
  });

  // horizontal tilted cards (desktop)
  const mm = gsap.matchMedia();
  mm.add('(min-width: 901px)', () => {
    const track = $('#cards');
    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
    const tw = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: { trigger: '#cpin', start: 'center center', end: () => '+=' + dist(), pin: true, scrub: .8, invalidateOnRefresh: true, onUpdate: tilt, onRefresh: tilt }
    });
    return () => { tw.scrollTrigger && tw.scrollTrigger.kill(); tw.kill(); gsap.set(track, { x: 0 }); };
  });
  gsap.from('.card3d', { opacity: 0, y: 60, duration: 1.2, ease: 'power3.out', stagger: .08, scrollTrigger: { trigger: '#cards', start: 'top 85%' } });

  // audience list
  gsap.from('#alist li', { opacity: 0, y: 14, duration: .9, ease: 'power2.out', stagger: .08, scrollTrigger: { trigger: '#alist', start: 'top 85%' } });

  // cta floating renders
  [['.f1', -60, -4], ['.f2', 80, 5], ['.f3', 50, 3], ['.f4', -90, -5]].forEach(([s, y, r]) => {
    gsap.fromTo(s, { y: -y, rotate: r * -1 }, { y, rotate: r, ease: 'none', scrollTrigger: { trigger: '#contacto', start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // marquee
  const half = () => marq.scrollWidth / 2;
  gsap.to(marq, { x: () => -half(), duration: 60, ease: 'none', repeat: -1, modifiers: { x: gsap.utils.unitize(x => parseFloat(x) % half()) } });

  // footer word
  gsap.from('.foot-word', { yPercent: 30, opacity: 0, duration: 1.6, ease: 'power3.out', scrollTrigger: { trigger: '.foot-word', start: 'top 95%' } });

  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
