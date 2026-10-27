(() => {
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const body = document.body;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const isMobile = () => innerWidth <= 760;

  /* ---------- Lenis ---------- */
  let lenis = null;
  if (!RM && window.Lenis) {
    lenis = new Lenis({ duration: 1.25, smoothWheel: true });
    window.lenis = lenis;
    lenis.stop();
    if (window.gsap) {
      lenis.on('scroll', () => window.ScrollTrigger && ScrollTrigger.update());
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  const scrollToY = (y, opts = {}) => lenis ? lenis.scrollTo(y, opts) : window.scrollTo({ top: y, behavior: RM ? 'auto' : 'smooth' });

  /* ---------- Split intro title into chars ---------- */
  $$('.intro-title .line').forEach(l => {
    const words = l.textContent.split(' ');
    l.innerHTML = words.map(w => '<span style="display:inline-block;white-space:nowrap">' + [...w].map(c => `<span class="ch" aria-hidden="true">${c}</span>`).join('') + '</span>').join(' ');
  });
  const st = $('#stateText');
  st.innerHTML = st.textContent.split(' ').map(w => `<span class="w">${w}</span>`).join(' ');

  /* ---------- Loader ---------- */
  const ring = $('.o-prog');
  const rolls = $$('.roll');
  const setPct = p => {
    const v = Math.round(p);
    const s = String(v).padStart(3, ' ');
    rolls.forEach((r, i) => { const c = s[i] === ' ' ? '' : s[i]; if (r.textContent !== c) r.textContent = c; });
    if (ring) ring.style.strokeDashoffset = String(100.5 * (1 - p / 100));
  };
  const imgs = $$('img').slice(0, 6);
  let loaded = 0;
  const target = { v: 0 };
  imgs.forEach(im => {
    const done = () => { loaded++; };
    if (im.complete) done(); else { im.addEventListener('load', done, { once: true }); im.addEventListener('error', done, { once: true }); }
  });
  const t0 = performance.now();
  const minT = RM ? 0 : 2200;
  let shown = 0;
  function tick() {
    const real = (loaded / imgs.length) * 100;
    const timeCap = Math.min(100, ((performance.now() - t0) / minT) * 100);
    target.v = Math.min(real, timeCap);
    shown += (target.v - shown) * 0.12;
    if (target.v >= 100 && shown > 99.4) shown = 100;
    setPct(shown);
    if (shown >= 100) return finishLoad();
    requestAnimationFrame(tick);
  }
  // safety: never block longer than 7s
  setTimeout(() => { loaded = imgs.length; }, 7000);
  function finishLoad() {
    setTimeout(() => {
      body.classList.add('loaded');
      body.classList.remove('is-loading');
      revealIntro();
      setTimeout(() => { const l = $('#loader'); if (l) l.style.display = 'none'; }, 1500);
    }, RM ? 0 : 250);
  }
  RM ? (setPct(100), finishLoad()) : requestAnimationFrame(tick);

  function revealIntro() {
    if (RM || !window.gsap) { $$('.intro-title .ch').forEach(c => { c.style.opacity = 1; c.style.filter = 'none'; c.style.transform = 'none'; }); unlock(); return; }
    gsap.fromTo('.intro-title .ch', { opacity: 0, filter: 'blur(8px)', y: '0.25em' },
      { opacity: 1, filter: 'blur(0px)', y: 0, duration: 1.1, ease: 'power3.out', stagger: { each: 0.012, from: 'random' }, delay: 0.3 });
    gsap.fromTo(['.intro-sub', '.cta-init', '.intro-foot'], { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1, stagger: 0.12, delay: 1.3, ease: 'power2.out' });
    gsap.fromTo('.intro-sketch', { scale: 1.25, opacity: 0 }, { scale: 1, opacity: 0.32, duration: 3, ease: 'power2.out' });
  }

  /* ---------- Initiate ---------- */
  let unlocked = false;
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    body.classList.remove('is-locked');
    if (lenis) lenis.start();
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }
  $('#initiate').addEventListener('click', () => {
    const go = () => { unlock(); scrollToY($('#plano').offsetTop, { duration: 2.2 }); };
    if (RM || !window.gsap) return go();
    gsap.timeline()
      .to('#flash', { opacity: 0.85, duration: 0.18, ease: 'power2.in' })
      .add(go)
      .to('#flash', { opacity: 0, duration: 0.9, ease: 'power2.out' });
  });
  $('#replay').addEventListener('click', () => scrollToY(0, { duration: 2.5 }));
  // keyboard users: unlock on Tab/arrow if they skip the button
  addEventListener('keydown', e => { if (['ArrowDown', 'PageDown', ' ', 'End'].includes(e.key) && document.activeElement === document.body && !unlocked && body.classList.contains('loaded')) unlock(); });

  /* ---------- Constellation canvas ---------- */
  const cv = $('#constellation');
  const ctx = cv.getContext('2d');
  let W, H, DPR, pts = [];
  function resize() {
    DPR = Math.min(2, devicePixelRatio || 1);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const n = isMobile() ? 34 : 72;
    pts = Array.from({ length: n }, (_, i) => ({
      x: Math.random() * W, y: Math.random() * H * 1.6, z: 0.3 + Math.random() * 0.9,
      vx: (Math.random() - 0.5) * 0.08, vy: (Math.random() - 0.5) * 0.05, cross: i % 9 === 0
    }));
  }
  resize();
  addEventListener('resize', resize);
  let scrollY0 = 0, running = true;
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) requestAnimationFrame(draw); });
  function draw() {
    if (!running) return;
    ctx.clearRect(0, 0, W, H);
    const sy = (lenis ? lenis.scroll : scrollY);
    const proj = pts.map(p => {
      if (!RM) { p.x += p.vx; p.y += p.vy; }
      if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20;
      let y = (p.y - sy * 0.06 * p.z) % (H * 1.6); if (y < 0) y += H * 1.6;
      return { x: p.x, y: y - H * 0.3, z: p.z, cross: p.cross };
    });
    ctx.lineWidth = 0.6;
    for (let i = 0; i < proj.length; i++) {
      const a = proj[i];
      for (let j = i + 1; j < proj.length; j++) {
        const b = proj[j]; const dx = a.x - b.x, dy = a.y - b.y; const d = dx * dx + dy * dy;
        const lim = isMobile() ? 16000 : 30000;
        if (d < lim) { ctx.strokeStyle = `rgba(190,210,255,${0.22 * (1 - d / lim)})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      }
    }
    proj.forEach(p => {
      ctx.fillStyle = `rgba(220,232,255,${0.35 + p.z * 0.4})`;
      if (p.cross) { ctx.fillRect(p.x - 7, p.y - 0.5, 14, 1); ctx.fillRect(p.x - 0.5, p.y - 7, 1, 14); }
      else ctx.fillRect(p.x - 1, p.y - 1, 1.6 * p.z, 1.6 * p.z);
    });
    if (!RM) requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  /* ---------- Audio (generated ambient pad) ---------- */
  const abtn = $('.hud-audio');
  let ac, master;
  abtn.addEventListener('click', () => {
    const on = abtn.getAttribute('aria-pressed') !== 'true';
    abtn.setAttribute('aria-pressed', String(on));
    abtn.setAttribute('aria-label', on ? 'Desactivar audio ambiental' : 'Activar audio ambiental');
    if (on && !ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 0.7;
      lp.connect(master); master.connect(ac.destination);
      [55, 82.4, 110.2, 164.8, 220.6].forEach((f, i) => {
        const o = ac.createOscillator(); o.type = i % 2 ? 'sine' : 'triangle'; o.frequency.value = f; o.detune.value = (i - 2) * 4;
        const g = ac.createGain(); g.gain.value = 0.06 / (i + 1);
        const l = ac.createOscillator(); l.frequency.value = 0.05 + i * 0.03; const lg = ac.createGain(); lg.gain.value = 0.03 / (i + 1);
        l.connect(lg); lg.connect(g.gain); o.connect(g); g.connect(lp); o.start(); l.start();
      });
    }
    if (ac) { ac.resume(); master.gain.cancelScheduledValues(ac.currentTime); master.gain.linearRampToValueAtTime(on ? 0.9 : 0, ac.currentTime + 1.2); }
  });

  /* ---------- Scroll choreography ---------- */
  if (RM || !window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  const S = (trigger, extra = {}) => ({ trigger, start: 'top top', end: 'bottom bottom', scrub: 1, ...extra });

  // Intro parallax out
  gsap.to('.intro-inner', { yPercent: -30, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.intro', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.intro-sketch', { scale: 1.5, ease: 'none', scrollTrigger: { trigger: '.intro', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.nebula', { xPercent: 40, yPercent: 30, ease: 'none', scrollTrigger: { trigger: 'main', start: 'top top', end: 'bottom bottom', scrub: true } });
  gsap.to('.flare', { xPercent: -260, yPercent: -120, ease: 'none', scrollTrigger: { trigger: 'main', start: 'top top', end: 'bottom bottom', scrub: true } });

  // CH1 plano → render
  const coordX = $('[data-x]'), coordY = $('[data-y]');
  const t1 = gsap.timeline({ scrollTrigger: S('.ch-plan', { onUpdate: s => { coordX.textContent = Math.round(1131 + s.progress * 2303); coordY.textContent = Math.round(1131 - s.progress * 587); } }) });
  t1.fromTo('.obj-plan', { scale: 0.72, rotationX: 14, y: 60 }, { scale: 1.08, rotationX: 0, y: 0, ease: 'none', duration: 1 }, 0)
    .fromTo('.plan-render', { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'power1.inOut', duration: 0.45 }, 0.2)
    .fromTo('.scanline', { x: () => -Math.min(innerWidth * 0.46, 650), opacity: 0 }, { x: () => Math.min(innerWidth * 0.46, 650), opacity: 1, ease: 'power1.inOut', duration: 0.45 }, 0.2)
    .to('.scanline', { opacity: 0, duration: 0.05 }, 0.65)
    .fromTo('.plan-art', { opacity: 1 }, { opacity: 0.15, duration: 0.3 }, 0.55)
    .fromTo('.ch-plan .mega span', { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: 0.05, duration: 0.18 }, 0.02)
    .fromTo('.ch-plan .kicker, .ch-plan .desc', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.15 }, 0.1)
    .to('.ch-plan .scroll-hint', { opacity: 0, duration: 0.1 }, 0.85)
    .to('.obj-plan', { scale: 1.2, duration: 0.14, ease: 'none' }, 0.86);

  // CH2 close-up
  const t2 = gsap.timeline({ scrollTrigger: S('.ch-render') });
  t2.fromTo('.obj-closeup img', { clipPath: 'inset(22% 30% 22% 30%)', scale: 1.35 }, { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, ease: 'none', duration: 0.7 }, 0)
    .fromTo('.ch-render .tag-faint', { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 0.15, stagger: 0.1 }, 0.25)
    .to('.obj-closeup img', { scale: 1.12, duration: 0.3, ease: 'none' }, 0.7);

  // CH3 problem cards fly-through
  const cards = $$('.card3d');
  const t3 = gsap.timeline({ scrollTrigger: S('.ch-problems') });
  t3.to('.problems-head', { opacity: 0.3, duration: 0.1 }, 0.12);
  const side = [-1, 1, -1, 1];
  cards.forEach((c, i) => {
    const s = 0.0 + i * 0.21;
    gsap.set(c, { xPercent: -50, yPercent: -50 });
    t3.fromTo(c, { z: -1800, x: () => side[i] * innerWidth * 0.12, y: () => innerHeight * 0.06, rotationY: side[i] * -18, opacity: 0 },
      { z: 0, x: () => side[i] * innerWidth * (isMobile() ? 0.02 : 0.18), y: () => innerHeight * 0.1, rotationY: side[i] * -6, opacity: 1, ease: 'power2.out', duration: 0.2 }, s)
      .to(c, { z: 700, x: () => side[i] * innerWidth * 0.5, rotationY: side[i] * 10, opacity: 0, ease: 'power2.in', duration: 0.16 }, s + 0.24);
  });
  t3.to({}, { duration: 0.05 }, 1);

  // CH4 modules horizontal track
  const track = $('#track');
  const trackDist = () => Math.max(0, track.scrollWidth - innerWidth);
  const nEl = $('#trackn');
  const t4 = gsap.timeline({ scrollTrigger: S('.ch-modules', { invalidateOnRefresh: true, onUpdate: s => { const i = Math.min(8, 1 + Math.floor(s.progress * 8)); nEl.textContent = `00${i} / 008`; } }) });
  t4.fromTo(track, { x: () => innerWidth * 0.25 }, { x: () => -trackDist(), ease: 'none', duration: 0.9 }, 0.05)
    .fromTo('#trackbar', { scaleX: 0 }, { scaleX: 1, ease: 'none', duration: 0.9 }, 0.05)
    .fromTo('.mod', { rotationY: -14, opacity: 0.35 }, { rotationY: 0, opacity: 1, stagger: 0.06, duration: 0.2 }, 0.05);
  $$('.mod-wipe').forEach(m => {
    ScrollTrigger.create({ trigger: '.ch-modules', start: 'top+=40% top', end: 'bottom bottom', onEnter: () => m.classList.add('auto'), });
  });

  // CH5 map
  const coast = $('.map .coast'), route = $('.map .route');
  const cl = coast.getTotalLength();
  gsap.set(coast, { strokeDasharray: cl, strokeDashoffset: cl });
  const t5 = gsap.timeline({ scrollTrigger: S('.ch-map') });
  t5.to(coast, { strokeDashoffset: 0, ease: 'none', duration: 0.4 }, 0)
    .fromTo('.map .land', { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.1)
    .fromTo(route, { opacity: 0 }, { opacity: 1, duration: 0.1 }, 0.4)
    .fromTo('.pin-g', { opacity: 0, scale: 0, transformOrigin: '0px 0px' }, { opacity: 1, scale: 1, stagger: 0.08, duration: 0.08, ease: 'back.out(3)' }, 0.3)
    .fromTo('.aud li', { opacity: 0, x: -20 }, { opacity: 1, x: 0, stagger: 0.05, duration: 0.08 }, 0.2)
    .to({}, { duration: 0.1 }, 0.9);

  // CH6 tour (camera push)
  const tick6 = $$('.ticker li');
  const steps = $$('.s4');
  let curStep = -1;
  const t6 = gsap.timeline({ scrollTrigger: S('.ch-tour', { onUpdate: s => {
    const p = s.progress;
    const k = Math.min(9, Math.floor(p * 10));
    tick6.forEach((li, i) => li.classList.toggle('on', i <= k));
    const si = Math.min(3, Math.floor(p * 4));
    if (si !== curStep) {
      curStep = si;
      steps.forEach((el, i) => gsap.to(el, { opacity: i === si ? 1 : 0, y: i === si ? 0 : (i < si ? -24 : 24), filter: i === si ? 'blur(0px)' : 'blur(6px)', duration: 0.6, overwrite: true }));
    }
  } }) });
  t6.fromTo('.tour-img', { scale: 1.05 }, { scale: 1.55, ease: 'none', duration: 1 }, 0)
    .fromTo('.tour-frame', { clipPath: 'inset(18% 10% 18% 10%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.15, ease: 'power2.out' }, 0)
    .fromTo('.streaks i', { x: 0 }, { x: () => innerWidth * 1.9, stagger: 0.12, duration: 0.35, ease: 'none', repeat: 2 }, 0.05)
    .to({}, { duration: 0.05 }, 0.95);

  // Statement word reveal
  gsap.to('.state-text .w', { opacity: 1, stagger: 0.04, ease: 'none', scrollTrigger: { trigger: '.statement', start: 'top 70%', end: 'bottom 70%', scrub: true } });

  // Services parallax
  $$('.svc figure img').forEach(im => gsap.fromTo(im, { scale: 1.2, yPercent: -6 }, { scale: 1, yPercent: 6, ease: 'none', scrollTrigger: { trigger: im.closest('.svc'), start: 'top bottom', end: 'bottom top', scrub: true } }));
  gsap.fromTo('.svc', { opacity: 0, y: 60 }, { opacity: 1, y: 0, stagger: 0.15, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.services', start: 'top 80%' } });

  // Ending credits
  const lines = $$('.ec-line');
  const t7 = gsap.timeline({ scrollTrigger: S('.ending') });
  t7.fromTo('.ec-band', { height: 0 }, { height: '13vh', duration: 0.1 }, 0);
  lines.forEach((l, i) => {
    t7.fromTo(l, { opacity: 0, filter: 'blur(10px)', letterSpacing: '0.12em' }, { opacity: 1, filter: 'blur(0px)', letterSpacing: '-0.01em', duration: 0.1 }, 0.05 + i * 0.22)
      .to(l, { opacity: 0, filter: 'blur(10px)', duration: 0.06 }, 0.22 + i * 0.22);
  });
  t7.fromTo('.ec-final', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.1 }, 0.74)
    .to('.ec-band', { height: '9vh', duration: 0.2 }, 0.74);

  addEventListener('load', () => ScrollTrigger.refresh());
})();
