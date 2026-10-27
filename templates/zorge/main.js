(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const body = document.body;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const desktopMQ = window.matchMedia('(min-width: 900px) and (min-height: 600px) and (hover: hover) and (pointer: fine)');
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  /* ---------- Smooth scroll (Lenis) ---------- */
  let lenis = null;
  if (!reduce && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: 0.11, smoothWheel: true });
    if (hasGsap) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  const curY = () => (lenis ? lenis.scroll : window.scrollY);
  const maxY = () => document.documentElement.scrollHeight - window.innerHeight;

  /* ---------- Chapters: natural tops (sticky never changes flow) ---------- */
  const chapters = [...$$('[data-ch]'), $('#ftr')];
  let tops = [];
  const measure = () => {
    let y = 0;
    const mainTop = $('#main').offsetTop;
    y = mainTop;
    tops = chapters.map(el => { const t = y; y += el.offsetHeight; return { el, top: t, h: el.offsetHeight, bottom: y }; });
  };
  measure();
  window.addEventListener('resize', () => { measure(); });
  window.addEventListener('load', () => { measure(); if (hasGsap) ScrollTrigger.refresh(); });

  const topOf = el => { const c = tops.find(t => t.el === el); return c ? c.top : el.getBoundingClientRect().top + curY(); };

  let animating = false;
  const goTo = (y, dur = 1.15) => {
    y = Math.max(0, Math.min(maxY(), Math.round(y)));
    if (lenis) {
      animating = true;
      lenis.scrollTo(y, {
        duration: reduce ? 0 : dur,
        easing: t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
        lock: true, force: true,
        onComplete: () => { animating = false; needGap = true; }
      });
      // safety release
      setTimeout(() => { animating = false; }, dur * 1000 + 400);
    } else {
      window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    }
  };

  /* ---------- Full-screen chapter paging (desktop wheel + keyboard) ---------- */
  let needGap = false, lastWheel = 0, lastAbs = 0;
  const vh = () => window.innerHeight;
  const currentIndex = (y) => {
    let idx = 0;
    for (let i = 0; i < tops.length; i++) if (tops[i].top <= y + 2) idx = i;
    return idx;
  };
  const isShort = c => c.h <= vh() + 4;
  // returns true if handled (snap), false to let natural scroll happen
  const page = (dir, dy) => {
    const y = curY();
    const i = currentIndex(y);
    const c = tops[i];
    if (!c) return false;
    if (dir > 0) {
      if (isShort(c)) {
        const nx = tops[i + 1];
        if (!nx) return y < maxY() - 2 ? (goTo(maxY()), true) : false;
        goTo(nx.top); return true;
      }
      // tall chapter: scroll inside until its bottom, then snap to next
      if (y + vh() + dy >= c.bottom - 2) {
        const nx = tops[i + 1];
        if (!nx) return false;
        goTo(nx.top); return true;
      }
      return false;
    } else {
      if (y <= 0) return false;
      if (isShort(c)) {
        if (y > c.top + 4) { goTo(c.top); return true; }
        const pv = tops[i - 1];
        if (!pv) { goTo(0); return true; }
        goTo(isShort(pv) ? pv.top : pv.bottom - vh()); return true;
      }
      if (y + dy <= c.top + 2) {
        const pv = tops[i - 1];
        if (!pv) { goTo(0); return true; }
        goTo(isShort(pv) ? pv.top : pv.bottom - vh()); return true;
      }
      return false;
    }
  };

  window.addEventListener('wheel', e => {
    if (!lenis || !desktopMQ.matches || body.classList.contains('menu-open') || e.ctrlKey) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    const now = performance.now();
    const gap = now - lastWheel; lastWheel = now;
    const abs = Math.abs(e.deltaY);
    const block = () => { e.preventDefault(); e.stopImmediatePropagation(); };
    if (animating) { lastAbs = abs; return block(); }
    if (needGap) {
      // swallow trackpad inertia tail; accept a fresh, stronger gesture
      if (gap < 180 && !(abs > lastAbs * 1.6 && abs > 30)) { lastAbs = abs; return block(); }
      needGap = false;
    }
    lastAbs = abs;
    if (abs < 2) return;
    const dy = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
    if (page(Math.sign(dy), dy)) block();
  }, { passive: false, capture: true });

  document.addEventListener('keydown', e => {
    if (!lenis || !desktopMQ.matches || body.classList.contains('menu-open')) return;
    const t = e.target;
    if (t && (t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName))) return;
    let dir = 0;
    if (['ArrowDown', 'PageDown'].includes(e.key) || (e.key === ' ' && !e.shiftKey)) dir = 1;
    if (['ArrowUp', 'PageUp'].includes(e.key) || (e.key === ' ' && e.shiftKey)) dir = -1;
    if (e.key === 'Home') { e.preventDefault(); goTo(0); return; }
    if (e.key === 'End') { e.preventDefault(); goTo(maxY()); return; }
    if (!dir) return;
    if (animating) { e.preventDefault(); return; }
    const step = dir * vh() * 0.8;
    if (page(dir, step)) { e.preventDefault(); return; }
    e.preventDefault();
    goTo(curY() + step, 0.8);
  });

  /* ---------- Menu ---------- */
  const menu = $('#menu'), mbtn = $('#mbtn');
  const setMenu = open => {
    body.classList.toggle('menu-open', open);
    mbtn.setAttribute('aria-expanded', String(open));
    mbtn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    menu.setAttribute('aria-hidden', String(!open));
    if (lenis) open ? lenis.stop() : lenis.start();
  };
  mbtn.addEventListener('click', () => setMenu(!body.classList.contains('menu-open')));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && body.classList.contains('menu-open')) { setMenu(false); mbtn.focus(); } });

  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    const el = id === '#top' ? $('#top') : $(id);
    if (!el) return;
    e.preventDefault();
    const wasOpen = body.classList.contains('menu-open');
    if (wasOpen) setMenu(false);
    setTimeout(() => { measure(); goTo(topOf(el), 1.6); }, wasOpen ? 500 : 0);
  }));

  /* ---------- Header state + progress ---------- */
  const pager = $('#pager');
  const onScroll = () => {
    const y = curY();
    body.classList.toggle('past-hero', y > vh() * 0.6);
    pager.style.setProperty('--p', (y / Math.max(1, maxY())).toFixed(4));
  };
  if (lenis) lenis.on('scroll', onScroll); else window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Services accordion ---------- */
  const trs = $$('.tr'), tImgs = $$('.terr-visual img'), tNum = $('#terrNum');
  const openTr = i => {
    trs.forEach((t, k) => { t.classList.toggle('open', k === i); $('.tr-h', t).setAttribute('aria-expanded', String(k === i)); });
    tImgs.forEach((im, k) => im.classList.toggle('on', k === i));
    tNum.textContent = String(i + 1).padStart(2, '0');
    setTimeout(() => { measure(); if (hasGsap) ScrollTrigger.refresh(); }, 750);
  };
  trs.forEach((t, i) => {
    $('.tr-h', t).addEventListener('click', () => openTr(i));
    if (desktopMQ.matches) t.addEventListener('mouseenter', () => { tImgs.forEach((im, k) => im.classList.toggle('on', k === i)); tNum.textContent = String(i + 1).padStart(2, '0'); });
  });
  $('.terr-list').addEventListener('mouseleave', () => {
    const i = trs.findIndex(t => t.classList.contains('open'));
    if (i > -1) { tImgs.forEach((im, k) => im.classList.toggle('on', k === i)); tNum.textContent = String(i + 1).padStart(2, '0'); }
  });

  /* ---------- Modules carousel ---------- */
  const car = $('#car'), cards = $$('.mc', car), carNum = $('#carNum');
  const cardStep = () => cards[1] ? cards[1].offsetLeft - cards[0].offsetLeft : car.clientWidth;
  const carIndex = () => Math.round(car.scrollLeft / cardStep());
  const carGo = i => { i = Math.max(0, Math.min(cards.length - 1, i)); car.scrollTo({ left: i * cardStep(), behavior: reduce ? 'auto' : 'smooth' }); };
  const carUpd = () => {
    const i = Math.min(cards.length - 1, carIndex());
    carNum.textContent = String(i + 1).padStart(2, '0');
    $('#carPrev').disabled = car.scrollLeft < 4;
    $('#carNext').disabled = car.scrollLeft > car.scrollWidth - car.clientWidth - 4;
  };
  car.addEventListener('scroll', carUpd, { passive: true });
  $('#carPrev').addEventListener('click', () => carGo(carIndex() - 1));
  $('#carNext').addEventListener('click', () => carGo(carIndex() + 1));
  carUpd();
  // drag + arrow cursor (desktop)
  const cursor = $('#cursor');
  if (desktopMQ.matches) {
    let down = false, sx = 0, sl = 0, moved = false;
    car.addEventListener('pointerdown', e => { if (e.button !== 0 || e.target.closest('a')) return; down = true; moved = false; sx = e.clientX; sl = car.scrollLeft; car.style.scrollSnapType = 'none'; });
    window.addEventListener('pointermove', e => {
      if (down) { const dx = e.clientX - sx; if (Math.abs(dx) > 4) moved = true; car.scrollLeft = sl - dx; }
    });
    window.addEventListener('pointerup', e => {
      if (!down) return; down = false; car.style.scrollSnapType = '';
      if (moved) { carGo(carIndex()); return; }
      if (e.target.closest && e.target.closest('a')) return;
      const r = car.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) carGo(carIndex() + (e.clientX > r.left + r.width / 2 ? 1 : -1));
    });
    car.addEventListener('mousemove', e => {
      const r = car.getBoundingClientRect();
      const onLink = e.target.closest('a');
      cursor.classList.toggle('on', !onLink);
      cursor.classList.toggle('left', e.clientX < r.left + r.width / 2);
      cursor.style.transform = '';
      cursor.style.left = e.clientX + 'px'; cursor.style.top = e.clientY + 'px';
    });
    car.addEventListener('mouseleave', () => cursor.classList.remove('on'));
    car.style.cursor = 'none';
    $$('a', car).forEach(a => a.style.cursor = 'pointer');
  }

  /* ---------- Reel dial ---------- */
  const vid = $('#reelVid');
  const chaptersReel = [
    [0, 'Del bosquejo a tu operación'],
    [4, 'Diseñamos sitios web, renders y agentes'],
    [11, 'Del plano al render'],
    [19, 'Los 9 módulos'],
    [33, 'Playa del Carmen · Cancún · Tulum · Riviera Maya'],
    [37, 'Presentar · Conversar · Capacitar · Decidir'],
    [44, 'El proceso: 10 pasos'],
    [58, 'Hecho para quienes diseñan y comercializan espacios'],
    [62, 'El método: entender, diseñar, conectar, acompañar']
  ];
  const fmt = s => { s = Math.floor(s); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const dTime = $('#dialTime'), dTitle = $('#dialTitle'), dProg = $('#dialProg'), dDot = $('#dialDot');
  let lastCh = -1;
  const chAt = t => { let k = 0; chaptersReel.forEach((c, i) => { if (t >= c[0]) k = i; }); return k; };
  const dialUpd = () => {
    const t = vid.currentTime || 0, d = vid.duration || 65.5;
    const p = Math.min(1, t / d);
    dTime.textContent = fmt(t);
    dProg.style.strokeDashoffset = String(1 - p);
    const a = p * Math.PI * 2 - Math.PI / 2;
    dDot.setAttribute('cx', (300 + 290 * Math.cos(a)).toFixed(1));
    dDot.setAttribute('cy', (300 + 290 * Math.sin(a)).toFixed(1));
    const k = chAt(t);
    if (k !== lastCh) {
      lastCh = k;
      if (hasGsap && !reduce) gsap.fromTo(dTitle, { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .6, ease: 'power3.out' });
      dTitle.textContent = chaptersReel[k][1];
    }
  };
  vid.addEventListener('timeupdate', dialUpd);
  vid.addEventListener('loadedmetadata', dialUpd);
  const seekCh = dir => { const k = (chAt(vid.currentTime) + dir + chaptersReel.length) % chaptersReel.length; vid.currentTime = chaptersReel[k][0] + 0.05; vid.play().catch(() => {}); dialUpd(); };
  $('#chPrev').addEventListener('click', () => seekCh(-1));
  $('#chNext').addEventListener('click', () => seekCh(1));
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) vid.play().catch(() => {}); else vid.pause(); }), { threshold: 0.15 }).observe(vid);
  }

  /* ---------- Method cards ---------- */
  const kcs = $$('.kc'), kImgs = $$('.met-img img');
  let kIdx = 0, kTimer = null, kUser = false;
  const setK = i => { kIdx = i; kcs.forEach((k, j) => k.classList.toggle('on', j === i)); kImgs.forEach((im, j) => im.classList.toggle('on', j === i)); };
  kcs.forEach((k, i) => {
    k.addEventListener('click', () => { kUser = true; setK(i); });
    k.addEventListener('mouseenter', () => { if (desktopMQ.matches) { kUser = true; setK(i); } });
  });
  if ('IntersectionObserver' in window && !reduce) {
    new IntersectionObserver(es => es.forEach(en => {
      clearInterval(kTimer);
      if (en.isIntersecting) kTimer = setInterval(() => { if (!kUser) setK((kIdx + 1) % kcs.length); }, 3600);
    }), { threshold: 0.5 }).observe($('#metodo'));
  }

  /* ---------- GSAP motion ---------- */
  if (!hasGsap || reduce) {
    $$('.hm-b').forEach(el => el.style.opacity = 0);
    $$('#steps li').forEach(li => li.classList.add('on'));
    $('#wipeTop').style.clipPath = 'inset(0 0 0 0)';
    return;
  }

  // Hero intro
  const intro = gsap.timeline({ defaults: { ease: 'power4.out' } });
  intro.from('.hero-media', { clipPath: 'inset(0 0 0 100%)', duration: 1.6, ease: 'power3.inOut' })
    .from('.hm-a', { scale: 1.18, duration: 2.2 }, '<')
    .from('.hero-h .ln>span', { yPercent: 110, duration: 1.1, stagger: .09 }, '-=1.4')
    .from('.hero-tower', { yPercent: 30, opacity: 0, duration: 1.6 }, '-=1.2')
    .from('.hero .wordmark span', { yPercent: 70, opacity: 0, duration: 1.2, stagger: .06 }, '-=1.3')
    .from('.hero-arrow, .hdr', { opacity: 0, duration: .8 }, '-=.6');
  // day/dusk crossfade like the reference
  gsap.to('.hm-b', { opacity: 1, duration: 2.4, ease: 'sine.inOut', repeat: -1, yoyo: true, repeatDelay: 4.5, delay: 4 });
  gsap.to('.hero-arrow', { y: 8, duration: 1.2, ease: 'sine.inOut', repeat: -1, yoyo: true });

  // Hero scroll-out: parallax as next chapter covers it
  gsap.timeline({ scrollTrigger: { trigger: '#estudio', start: 'top bottom', end: 'top top', scrub: true } })
    .to('.hero-tower', { yPercent: -10, ease: 'none' }, 0)
    .to('.hero .wordmark', { yPercent: -60, ease: 'none' }, 0)
    .to('.hero-media', { yPercent: -8, ease: 'none' }, 0);

  // Covered chapters dim + recede (full-screen chapter transition)
  const stacks = $$('.ch.stack');
  stacks.forEach(sec => {
    const next = sec.nextElementSibling;
    if (!next) return;
    const dim = document.createElement('span'); dim.className = 'dim'; sec.appendChild(dim);
    ScrollTrigger.create({
      trigger: next, start: 'top bottom', end: 'top top', scrub: true,
      animation: gsap.timeline().to(dim, { opacity: .72, ease: 'none' }, 0)
    });
  });

  // Cover images zoom
  $$('.pz').forEach(img => {
    gsap.fromTo(img, { scale: 1.15 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'top top', scrub: true } });
  });

  // Inner image parallax
  $$('.pfx img').forEach(img => {
    gsap.fromTo(img, { yPercent: -9 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // Gallery float
  $$('.g').forEach(g => {
    const s = parseFloat(g.dataset.speed || 0);
    gsap.fromTo(g, { y: () => -s * 400 }, { y: () => s * 400, ease: 'none', scrollTrigger: { trigger: '.gal', start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true } });
  });
  gsap.from('.gal-title', { opacity: 0, scale: .9, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: '.gal', start: 'top 60%' } });

  // Reveals
  $$('.rv').forEach(el => {
    const lines = $$('.ln>span', el);
    if (lines.length) gsap.from(lines, { yPercent: 110, duration: 1.1, stagger: .08, ease: 'power4.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
    else gsap.from(el, { y: 44, opacity: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
  });
  gsap.from('.mc', { y: 60, opacity: 0, duration: 1, stagger: .08, ease: 'power3.out', scrollTrigger: { trigger: '#car', start: 'top 85%' } });
  gsap.from('.kc', { x: 40, opacity: 0, duration: .9, stagger: .08, ease: 'power3.out', scrollTrigger: { trigger: '#metodo', start: 'top 60%' } });
  gsap.from('.pin', { scale: 0, opacity: 0, duration: .8, stagger: .1, ease: 'back.out(2)', scrollTrigger: { trigger: '#definicion', start: 'top 55%' } });
  gsap.from('.defin-lines path', { strokeDasharray: 2000, strokeDashoffset: 2000, duration: 2.4, ease: 'power2.inOut', scrollTrigger: { trigger: '#definicion', start: 'top 60%' } });

  // Process: steps + sketch→render wipe
  const steps = $$('#steps li');
  steps.forEach((li, i) => ScrollTrigger.create({
    trigger: li, start: 'top 62%', end: 'bottom 62%',
    onToggle: self => { if (self.isActive) steps.forEach((s, k) => s.classList.toggle('on', k <= i)); },
    onLeaveBack: () => { if (i === 0) steps.forEach(s => s.classList.remove('on')); }
  }));
  const wipeObj = { p: 0 };
  gsap.to(wipeObj, {
    p: 1, ease: 'none',
    scrollTrigger: { trigger: '.proc-body', start: 'top 70%', end: 'bottom 70%', scrub: true },
    onUpdate: () => {
      const r = (1 - wipeObj.p) * 100;
      $('#wipeTop').style.clipPath = `inset(0 ${r.toFixed(2)}% 0 0)`;
      $('#wipeLine').style.left = (wipeObj.p * 100).toFixed(2) + '%';
    }
  });

  // Stats count-up
  $$('[data-count]').forEach(b => {
    const n = parseInt(b.dataset.count, 10), o = { v: 0 };
    gsap.to(o, { v: n, duration: 1.6, ease: 'power2.out', scrollTrigger: { trigger: b, start: 'top 90%' }, onUpdate: () => { b.textContent = String(Math.round(o.v)).padStart(2, '0'); } });
  });

  // CTA button + footer wordmark
  gsap.from('.cta-btn', { scale: .6, rotate: -20, opacity: 0, duration: 1.2, ease: 'back.out(1.6)', scrollTrigger: { trigger: '#contacto', start: 'top 50%' } });
  gsap.from('.wm-foot span', { yPercent: 80, opacity: 0, duration: 1.1, stagger: .06, ease: 'power4.out', scrollTrigger: { trigger: '#ftr', start: 'top 90%' } });

  ScrollTrigger.addEventListener('refresh', measure);
})();
