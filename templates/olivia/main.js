(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasG = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';

  /* ---------- smooth scroll ---------- */
  let lenis = null;
  if (!reduce && typeof Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    if (hasG) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  const go = (target) => {
    const el = typeof target === 'string' ? $(target) : target;
    if (!el) return;
    const off = el.id === 'top' ? 0 : -84;
    if (lenis) lenis.scrollTo(el, { offset: off, duration: 1.4 });
    else window.scrollTo({ top: el.getBoundingClientRect().top + scrollY + off, behavior: 'smooth' });
  };

  /* ---------- menu ---------- */
  const menu = $('#menu');
  const toggles = $$('[data-menu]');
  const setMenu = (open) => {
    menu.hidden = !open;
    document.body.classList.toggle('menu-open', open);
    toggles.forEach(b => { b.setAttribute('aria-expanded', open); b.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú'); });
    if (lenis) open ? lenis.stop() : lenis.start();
  };
  toggles.forEach(b => b.addEventListener('click', () => setMenu(menu.hidden)));
  addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });

  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const el = $(id);
    if (!el) return;
    e.preventDefault();
    if (!menu.hidden) setMenu(false);
    go(el);
  }));

  /* ---------- hero title fit ---------- */
  const title = $('#heroTitle'), fit = $('.fit', title);
  const fitTitle = () => {
    title.style.fontSize = '';
    if (innerWidth <= 600) return;
    const avail = title.clientWidth - 20;
    const cur = parseFloat(getComputedStyle(title).fontSize);
    const w = fit.getBoundingClientRect().width;
    if (w > 0) title.style.fontSize = Math.min(cur * avail / w, 260) + 'px';
  };
  // split into chars (keep words together for wrapping on mobile)
  fit.innerHTML = fit.textContent.split(' ').map(w => '<span style="display:inline-block;white-space:nowrap">' + [...w].map(c => '<span class="ch">' + c + '</span>').join('') + '</span>').join(' ');
  fitTitle();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { fitTitle(); hasG && ScrollTrigger.refresh(); });
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(fitTitle, 120); });

  /* ---------- compact bar ---------- */
  const bar = $('#bar');
  const hero = $('.hero');
  const onScroll = () => { bar.classList.toggle('on', scrollY > hero.offsetHeight * 0.8); };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ---------- word fill text ---------- */
  $$('.fill').forEach(el => {
    el.innerHTML = el.textContent.trim().split(/\s+/).map(w => '<span class="w">' + w + '</span>').join(' ');
  });

  /* ---------- carousel ---------- */
  const view = $('#carView'), track = $('#carTrack'), cards = $$('.pcard', track);
  const prev = $('.car-btn.prev'), next = $('.car-btn.next'), count = $('#carCount');
  let idx = 0, x = 0;
  const perView = () => innerWidth <= 900 ? 1 : 2;
  const step = () => cards[1].offsetLeft - cards[0].offsetLeft;
  const maxIdx = () => Math.max(0, cards.length - perView());
  const maxX = () => Math.max(0, track.scrollWidth - view.clientWidth);
  const place = (anim = true) => {
    idx = Math.max(0, Math.min(idx, maxIdx()));
    x = Math.min(idx * step(), maxX());
    if (hasG && anim) gsap.to(track, { x: -x, duration: 0.9, ease: 'power3.out' });
    else track.style.transform = `translateX(${-x}px)`;
    prev.disabled = idx === 0; next.disabled = idx >= maxIdx();
    count.textContent = String(idx + 1).padStart(2, '0') + ' / ' + String(cards.length).padStart(2, '0');
  };
  prev.addEventListener('click', () => { idx--; place(); });
  next.addEventListener('click', () => { idx++; place(); });
  addEventListener('resize', () => place(false));
  // drag / swipe
  let sx = 0, sy = 0, dragging = false, moved = false, base = 0, axis = null;
  view.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    dragging = true; moved = false; axis = null; sx = e.clientX; sy = e.clientY; base = x;
    hasG && gsap.killTweensOf(track);
  });
  addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!axis && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (axis !== 'x') return;
    moved = true; view.classList.add('drag');
    const nx = Math.max(-60, Math.min(maxX() + 60, base - dx));
    track.style.transform = `translateX(${-nx}px)`;
    if (hasG) gsap.set(track, { x: -nx });
  });
  addEventListener('pointerup', e => {
    if (!dragging) return;
    dragging = false; view.classList.remove('drag');
    if (moved) {
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 50) idx += dx < 0 ? 1 : -1;
      place();
    }
  });
  view.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  view.addEventListener('dragstart', e => e.preventDefault());
  place(false);

  /* ---------- sketch → render wipe on module 03 ---------- */
  const wipe = $('#wipe');
  if (wipe) {
    const sk = $('.sk', wipe), line = $('.wipe-line', wipe);
    const setP = p => { sk.style.clipPath = `inset(0 0 0 ${p}%)`; line.style.left = p + '%'; line.style.opacity = p > 1 && p < 99 ? 1 : 0; };
    const st = { p: 0 };
    let tl = null;
    if (hasG && !reduce) {
      tl = gsap.timeline({ repeat: -1, yoyo: true, repeatDelay: 1.2, defaults: { ease: 'power2.inOut' } })
        .to(st, { p: 100, duration: 2.6, onUpdate: () => setP(st.p) });
    }
    wipe.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      tl && tl.pause();
      const r = wipe.getBoundingClientRect();
      st.p = Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100)); setP(st.p);
    });
    wipe.addEventListener('pointerleave', () => tl && tl.play());
  }

  /* ---------- video ---------- */
  const reel = $('#reel');
  if (reel) {
    reel.muted = true;
    const io = new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting) { const p = reel.play(); p && p.catch(() => {}); } else reel.pause();
    }), { threshold: 0.15 });
    io.observe(reel);
  }

  if (!hasG) return;
  gsap.registerPlugin(ScrollTrigger);

  /* ---------- hero intro ---------- */
  if (!reduce) {
    const chars = $$('.ch', title);
    gsap.set(chars, { yPercent: 105 });
    gsap.timeline({ delay: 0.15 })
      .to('#heroImg', { scale: 1, duration: 2.4, ease: 'power2.out' }, 0)
      .to(chars, { yPercent: 0, duration: 1.1, ease: 'power4.out', stagger: 0.025 }, 0.25)
      .from('.hero-rule', { scaleX: 0, duration: 1.4, ease: 'power3.inOut' }, 0.5)
      .from('.hnav', { y: -20, opacity: 0, duration: 1, ease: 'power3.out' }, 0.3)
      .from('.hero-dots li', { opacity: 0, y: 10, duration: 0.8, stagger: 0.08 }, 0.8)
      .from('.hero-foot', { opacity: 0, duration: 0.8 }, 1);
    gsap.to('.hero-media', { yPercent: 12, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  } else {
    gsap.set('#heroImg', { scale: 1 });
  }

  /* ---------- word fill scrub ---------- */
  $$('.fill').forEach(el => {
    const ws = $$('.w', el);
    gsap.to(ws, { color: '#313131', ease: 'none', stagger: 0.1,
      scrollTrigger: { trigger: el, start: 'top 88%', end: el.classList.contains('fill-serif') ? 'bottom 82%' : 'bottom 60%', scrub: true } });
  });

  /* ---------- reveals ---------- */
  $$('.display, .kicker, .body, .intro .btn, .serv-l .lead, .team-big, .steps li, .proc-list li, .foot-cols > div, .car-foot').forEach(el => {
    gsap.from(el, { y: 34, opacity: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });

  /* ---------- parallax inside rounded cards ---------- */
  $$('.ap-card').forEach(card => {
    gsap.fromTo($('.ap-media', card), { yPercent: -7 }, { yPercent: 7, ease: 'none', scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.from($('.ap-glass', card), { y: 50, opacity: 0, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: card, start: 'top 55%', once: true } });
  });
  gsap.from('.ap-mark', { rotate: -90, scale: 0.6, opacity: 0, duration: 1.6, ease: 'power3.out', scrollTrigger: { trigger: '.ap-mark', start: 'top 80%', once: true } });

  /* ---------- carousel entrance ---------- */
  gsap.from(cards.slice(0, 3), { y: 60, opacity: 0, duration: 1.2, stagger: 0.12, ease: 'power3.out', scrollTrigger: { trigger: '#car', start: 'top 85%', once: true } });

  /* ---------- stacking cards ---------- */
  const sc = $$('.scard');
  sc.forEach((c, i) => {
    const nxt = sc[i + 1];
    if (!nxt) return;
    gsap.to(c, { scale: 0.9, filter: 'brightness(.82)', ease: 'none',
      scrollTrigger: { trigger: nxt, start: 'top bottom', end: 'top ' + (innerWidth <= 600 ? 84 : 120) + 'px', scrub: true } });
  });

  /* ---------- reel panel ---------- */
  gsap.from('.reel-frame', { y: 80, rotate: 2, opacity: 0, duration: 1.4, ease: 'power3.out', scrollTrigger: { trigger: '.team-card', start: 'top 70%', once: true } });

  addEventListener('load', () => ScrollTrigger.refresh());
})();
