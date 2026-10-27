(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = () => matchMedia('(max-width: 900px)').matches;
  const hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  /* ---------- Lenis ---------- */
  let lenis = null;
  if (!reduce && typeof Lenis !== 'undefined') {
    lenis = new Lenis({ duration: 1.15, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    if (hasGsap) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  const scrollToEl = (target, offset = -70) => {
    if (!target) return;
    if (lenis) lenis.scrollTo(target, { offset, duration: 1.4 });
    else window.scrollTo({ top: target.getBoundingClientRect().top + scrollY + offset, behavior: 'smooth' });
  };

  /* ---------- header / menu ---------- */
  const nav = $('#nav'), totop = $('#totop');
  const onScroll = () => {
    const y = scrollY;
    nav.classList.toggle('is-scrolled', y > 40);
    totop.classList.toggle('is-on', y > innerHeight * 0.8);
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  const burger = $('#burger'), mmenu = $('#mmenu');
  const setMenu = open => {
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    mmenu.hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
    if (lenis) open ? lenis.stop() : lenis.start();
  };
  burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
  addEventListener('keydown', e => { if (e.key === 'Escape' && !mmenu.hidden) setMenu(false); });

  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    const t = id === '#top' ? document.body : $(id);
    if (!t) return;
    e.preventDefault();
    if (!mmenu.hidden) setMenu(false);
    if (id === '#top') { lenis ? lenis.scrollTo(0, { duration: 1.4 }) : scrollTo({ top: 0, behavior: 'smooth' }); }
    else scrollToEl(t);
  }));

  /* ---------- hero slideshow ---------- */
  const slides = $$('.slide'), bars = $$('#bars button'), pinTxt = $('#pin span');
  let cur = 0, start = performance.now();
  const DUR = 6500;
  const show = (n) => {
    if (n === cur) return;
    const prev = slides[cur], next = slides[n];
    cur = n; start = performance.now();
    pinTxt.textContent = next.dataset.pin;
    bars.forEach((b, i) => { b.firstElementChild.style.setProperty('--p', i < n ? 1 : 0); b.setAttribute('aria-selected', i === n); });
    if (hasGsap && !reduce) {
      gsap.to(prev, { autoAlpha: 0, duration: 1.1, ease: 'power2.inOut', onComplete: () => prev.classList.remove('is-on') });
      next.classList.add('is-on');
      gsap.fromTo(next, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.1, ease: 'power2.inOut' });
      gsap.fromTo(next.querySelector('.villa'), { scale: 1.05, xPercent: -1.5 }, { scale: 1, xPercent: 0, duration: 7, ease: 'power1.out', transformOrigin: '50% 100%' });
      gsap.fromTo(next.querySelectorAll('.hl span'), { yPercent: 40, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 1.2, stagger: 0.12, delay: 0.35, ease: 'power3.out' });
    } else {
      prev.classList.remove('is-on'); prev.style.opacity = ''; next.classList.add('is-on');
    }
  };
  bars.forEach((b, i) => b.addEventListener('click', () => show(i)));
  const tick = (now) => {
    const p = Math.min(1, (now - start) / DUR);
    if (bars[cur]) bars[cur].firstElementChild.style.setProperty('--p', p);
    if (p >= 1) show((cur + 1) % slides.length);
    requestAnimationFrame(tick);
  };
  if (!reduce) requestAnimationFrame(tick);
  if (hasGsap && !reduce) {
    gsap.from('.slide.is-on .hl span', { yPercent: 40, autoAlpha: 0, duration: 1.3, stagger: 0.14, delay: 0.2, ease: 'power3.out' });
    gsap.from('.slide.is-on .villa', { y: 40, autoAlpha: 0, duration: 1.6, ease: 'power3.out' });
    gsap.from('.finder', { y: 30, autoAlpha: 0, duration: 1.2, delay: 0.5, ease: 'power3.out' });
  }

  /* ---------- services filter ---------- */
  const cards = $$('.scard'), chips = $$('#chips .pill'), scount = $('#scount');
  const fTerr = $('#fTerr'), fSvc = $('#fSvc'), fLoc = $('#fLoc');
  chips.slice(1).forEach(c => fTerr.add(new Option(c.textContent, c.dataset.t)));
  const fillSvc = () => {
    const t = fTerr.value;
    fSvc.length = 1;
    cards.forEach((c, i) => { if (t === 'all' || c.dataset.t === t) fSvc.add(new Option(c.querySelector('h3').textContent, String(i))); });
  };
  fTerr.addEventListener('change', fillSvc); fillSvc();

  const applyFilter = (t) => {
    chips.forEach(c => { const on = c.dataset.t === t; c.classList.toggle('is-on', on); c.setAttribute('aria-pressed', on); });
    let n = 0;
    cards.forEach(c => { const show = t === 'all' || c.dataset.t === t; c.hidden = !show; if (show) n++; });
    scount.textContent = n + (n === 1 ? ' servicio' : ' servicios');
    const vis = cards.filter(c => !c.hidden);
    if (hasGsap && !reduce) gsap.fromTo(vis, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.05, ease: 'power3.out', clearProps: 'transform,opacity,visibility' });
    if (hasGsap) ScrollTrigger.refresh();
  };
  chips.forEach(c => c.addEventListener('click', () => applyFilter(c.dataset.t)));

  const waLinks = [$('#waCta'), $('#waFloat')];
  const setWa = (loc) => {
    const msg = 'Hola ORNAT, quiero solicitar una demo' + (loc ? ' (' + loc + ')' : '');
    waLinks.forEach(a => a && (a.href = 'https://wa.me/529842353159?text=' + encodeURIComponent(msg)));
  };
  fLoc.addEventListener('change', () => setWa(fLoc.value));

  $('#finder').addEventListener('submit', e => {
    e.preventDefault();
    applyFilter(fTerr.value);
    setWa(fLoc.value);
    const sec = $('#servicios');
    let target = sec;
    if (fSvc.value !== 'all') {
      const card = cards[+fSvc.value];
      cards.forEach(c => c.classList.remove('flash'));
      card.classList.add('flash');
      setTimeout(() => card.classList.remove('flash'), 3200);
      target = card;
    }
    scrollToEl(target, target === sec ? -40 : -140);
  });

  /* ---------- reel ---------- */
  const vid = $('#reelVid'), vbtn = $('#reelBtn');
  let userPaused = false;
  const setBtn = () => {
    const playing = !vid.paused;
    vbtn.innerHTML = playing ? '<span class="ic-pause"></span>' : '<span class="ic-play"></span>';
    vbtn.setAttribute('aria-label', playing ? 'Pausar video' : 'Reproducir video');
  };
  vid.addEventListener('play', setBtn); vid.addEventListener('pause', setBtn);
  vbtn.addEventListener('click', () => { if (vid.paused) { userPaused = false; vid.play(); } else { userPaused = true; vid.pause(); } });
  new IntersectionObserver(es => es.forEach(en => {
    if (en.isIntersecting) { if (!userPaused) vid.play().catch(() => {}); } else vid.pause();
  }), { threshold: 0.2 }).observe(vid);

  /* ---------- proceso ---------- */
  const tabs = $$('.tabs .pill'), panes = $$('.tabpane');
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => { const on = x === t; x.classList.toggle('is-on', on); x.setAttribute('aria-selected', on); });
    panes.forEach(p => { const on = p.dataset.pane === t.dataset.tab; p.hidden = !on; p.classList.toggle('is-on', on); });
    const pane = panes.find(p => !p.hidden);
    if (hasGsap && !reduce) gsap.from(pane.children, { y: 18, autoAlpha: 0, duration: 0.7, stagger: 0.06, ease: 'power3.out' });
    if (hasGsap) ScrollTrigger.refresh();
  }));
  const marks = $$('.mk'), steps = $$('#steps li');
  const hot = (i, on) => { if (marks[i]) marks[i].classList.toggle('is-hot', on); if (steps[i]) steps[i].classList.toggle('is-hot', on); };
  steps.forEach((s, i) => { s.addEventListener('mouseenter', () => hot(i, true)); s.addEventListener('mouseleave', () => hot(i, false)); });

  /* ---------- reveal ---------- */
  const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' });
  $$('.rv').forEach(el => io.observe(el));
  io.observe($('#pmap'));

  if (!hasGsap) {
    $$('.mlist li').forEach((li, i) => li.querySelector('button').addEventListener('click', () => scrollToEl($$('.mcard')[i], -120)));
    return;
  }

  /* ---------- module list (sticky) ---------- */
  const mcards = $$('.mcard'), mitems = $$('.mlist li'), mlabel = $('#mlabel');
  const labels = ['Plataforma y diseño', 'Diseño visual', 'Diseño visual', 'Experiencias inmersivas', 'Agentes inteligentes', 'Contenido social', 'Equipo', 'Equipo', 'Datos'];
  const setMod = i => {
    mitems.forEach((li, k) => li.classList.toggle('is-on', k === i));
    mlabel.textContent = 'Módulo ' + String(i + 1).padStart(2, '0') + ' · ' + labels[i];
  };
  mcards.forEach((c, i) => ScrollTrigger.create({ trigger: c, start: 'top 55%', end: 'bottom 55%', onToggle: s => s.isActive && setMod(i) }));
  mitems.forEach((li, i) => li.querySelector('button').addEventListener('click', () => scrollToEl(mcards[i], -(innerHeight - mcards[i].offsetHeight) / 2)));

  const wipe = $('#wipe');
  gsap.fromTo(wipe, { '--w': '100%' }, { '--w': '0%', ease: 'none', scrollTrigger: { trigger: wipe, start: 'top 75%', end: 'bottom 35%', scrub: true } });

  /* ---------- split parallax ---------- */
  if (!reduce) $$('.split img').forEach(img => gsap.fromTo(img, { yPercent: -8 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } }));

  /* ---------- expanding panel ---------- */
  const mm = gsap.matchMedia();
  mm.add('(min-width: 901px)', () => {
    gsap.fromTo('#panelBox', { clipPath: 'inset(5vh 16vw 5vh 16vw)' }, { clipPath: 'inset(0vh 0vw 0vh 0vw)', ease: 'none', scrollTrigger: { trigger: '#panel', start: 'top top', end: 'bottom bottom', scrub: true } });
  });
  mm.add('(max-width: 900px)', () => {
    gsap.fromTo('#panelBox', { clipPath: 'inset(8vh 7vw 8vh 7vw)' }, { clipPath: 'inset(0vh 0vw 0vh 0vw)', ease: 'none', scrollTrigger: { trigger: '#panel', start: 'top top', end: 'bottom bottom', scrub: true } });
  });
  gsap.fromTo('.panel-bg', { scale: 1.12 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '#panel', start: 'top bottom', end: 'bottom bottom', scrub: true } });

  /* ---------- audience list ---------- */
  const alis = $$('#alist li');
  alis.forEach(li => ScrollTrigger.create({ trigger: li, start: 'top 58%', end: 'bottom 42%', toggleClass: { targets: li, className: 'is-on' } }));
  if (!reduce) $$('.fl').forEach((f, i) => gsap.fromTo(f, { y: 90 + (i % 3) * 20 }, { y: -90 - (i % 2) * 30, ease: 'none', scrollTrigger: { trigger: f.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } }));

  /* ---------- counters ---------- */
  $$('.stats b').forEach(b => {
    const n = +b.dataset.count, o = { v: 0 };
    ScrollTrigger.create({ trigger: b, start: 'top 90%', once: true, onEnter: () => gsap.to(o, { v: n, duration: 1.6, ease: 'power2.out', onUpdate: () => (b.textContent = Math.round(o.v)) }) });
  });

  /* ---------- footer ---------- */
  gsap.fromTo('.foot-bg', { yPercent: 12 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.foot', start: 'top bottom', end: 'bottom bottom', scrub: true } });

  /* ---------- WhatsApp hint ---------- */
  const wa = $('#waFloat');
  setTimeout(() => { wa.classList.add('is-open'); setTimeout(() => wa.classList.remove('is-open'), 4500); }, 2500);

  addEventListener('load', () => ScrollTrigger.refresh());
})();
