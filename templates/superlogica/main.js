(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasG = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';

  /* ---------- Lenis + ScrollTrigger ---------- */
  let lenis = null;
  if (hasG) gsap.registerPlugin(ScrollTrigger);
  if (typeof Lenis !== 'undefined' && !reduce) {
    lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    if (hasG) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }

  /* ---------- header + menu ---------- */
  const hdr = $('#hdr'), burger = $('#burger'), mm = $('#mmenu');
  const onScroll = () => hdr.classList.toggle('sc', scrollY > 10);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const closeMenu = () => { mm.hidden = true; burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Abrir menú'); document.body.style.overflow = ''; lenis && lenis.start(); };
  burger.addEventListener('click', () => {
    const open = mm.hidden;
    if (open) { mm.hidden = false; burger.setAttribute('aria-expanded', 'true'); burger.setAttribute('aria-label', 'Cerrar menú'); document.body.style.overflow = 'hidden'; lenis && lenis.stop(); }
    else closeMenu();
  });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !mm.hidden) closeMenu(); });

  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    const t = id === '#top' ? document.body : $(id);
    if (!t) return;
    e.preventDefault();
    if (!mm.hidden) closeMenu();
    const off = -(hdr.offsetHeight + 8);
    if (lenis) lenis.scrollTo(id === '#top' ? 0 : t, { offset: off, duration: 1.4 });
    else window.scrollTo({ top: id === '#top' ? 0 : t.getBoundingClientRect().top + scrollY + off, behavior: 'smooth' });
  }));

  /* ---------- rotating words ---------- */
  const track = $('#rotTrack');
  if (track) {
    const n = track.children.length; let i = 0;
    setInterval(() => {
      i++;
      track.style.transition = 'transform .6s cubic-bezier(.7,0,.2,1)';
      track.style.transform = `translateY(${-22 * i}px)`;
      if (i === n - 1) setTimeout(() => { track.style.transition = 'none'; track.style.transform = 'translateY(0)'; i = 0; }, 650);
    }, 2200);
  }

  /* ---------- ring of 9 segments ---------- */
  const segs = $('#ringSegs');
  if (segs) {
    const r = 48, C = 2 * Math.PI * r, gap = 3.2, seg = C / 9 - gap;
    let html = '';
    for (let k = 0; k < 9; k++) {
      const col = k < 3 ? '#1034f2' : k < 6 ? '#3d5cf5' : '#8fa2ff';
      html += `<circle cx="60" cy="60" r="${r}" stroke="${col}" stroke-dasharray="${seg} ${C - seg}" stroke-dashoffset="${-k * (seg + gap)}" class="sg" style="opacity:.12"/>`;
    }
    segs.innerHTML = html;
  }

  /* ---------- chat loop ---------- */
  const chat = $('#chatBody');
  if (chat) {
    const me = $('.me', chat), typ = $('.typing', chat), ans = $('.ans', chat);
    const set = (el, on) => { el.style.display = on ? '' : 'none'; };
    const run = () => {
      set(me, false); set(typ, false); set(ans, false);
      setTimeout(() => { set(me, true); me.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 400, easing: 'ease-out' }); }, 400);
      setTimeout(() => set(typ, true), 1300);
      setTimeout(() => { set(typ, false); set(ans, true); ans.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 450, easing: 'ease-out' }); }, 2900);
    };
    run(); setInterval(run, 9000);
  }

  /* ---------- accordions (module panels) ---------- */
  $$('.acc-b').forEach(b => { const w = document.createElement('div'); while (b.firstChild) w.appendChild(b.firstChild); b.appendChild(w); });
  $$('.panel').forEach(p => {
    const img = $('.panel-fig img', p);
    $$('.acc-it', p).forEach(it => {
      $('.acc-h', it).addEventListener('click', () => {
        if (it.classList.contains('open')) return;
        $$('.acc-it', p).forEach(o => { o.classList.remove('open'); $('.acc-h', o).setAttribute('aria-expanded', 'false'); });
        it.classList.add('open'); $('.acc-h', it).setAttribute('aria-expanded', 'true');
        img.classList.add('swap');
        const src = it.dataset.img, alt = it.dataset.alt;
        const pre = new Image(); pre.src = src;
        const done = () => { img.removeAttribute('srcset'); img.removeAttribute('sizes'); img.src = src; img.alt = alt; requestAnimationFrame(() => img.classList.remove('swap')); };
        setTimeout(() => pre.complete ? done() : (pre.onload = done, pre.onerror = done), 280);
      });
    });
  });
  // preload the other module images so swaps are instant
  addEventListener('load', () => $$('.acc-it').forEach(it => { const i = new Image(); i.src = it.dataset.img; }));

  /* ---------- services tabs ---------- */
  const tabs = $$('.sv-tabs [role="tab"]');
  const selectTab = t => {
    tabs.forEach(o => { const on = o === t; o.setAttribute('aria-selected', on); o.tabIndex = on ? 0 : -1; $('#' + o.getAttribute('aria-controls')).classList.toggle('active', on); });
  };
  tabs.forEach((t, k) => {
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); const n = tabs[(k + 1) % tabs.length]; selectTab(n); n.focus(); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); const n = tabs[(k - 1 + tabs.length) % tabs.length]; selectTab(n); n.focus(); }
    });
  });

  /* ---------- reel ---------- */
  const v = $('#reelVid'), vp = $('#vPlay'), vs = $('#vSound');
  if (v) {
    let userPaused = false;
    v.muted = true;
    const tryPlay = () => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
    new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { if (!userPaused) tryPlay(); } else v.pause();
    }), { threshold: .25 }).observe(v);
    vp.addEventListener('click', () => {
      if (v.paused) { userPaused = false; tryPlay(); } else { userPaused = true; v.pause(); }
    });
    v.addEventListener('play', () => { vp.setAttribute('aria-pressed', 'false'); vp.setAttribute('aria-label', 'Pausar video'); });
    v.addEventListener('pause', () => { vp.setAttribute('aria-pressed', 'true'); vp.setAttribute('aria-label', 'Reproducir video'); });
    vs.addEventListener('click', () => {
      v.muted = !v.muted;
      vs.setAttribute('aria-pressed', String(!v.muted));
      vs.setAttribute('aria-label', v.muted ? 'Activar sonido' : 'Silenciar');
      if (!v.muted && v.paused) { userPaused = false; tryPlay(); }
    });
  }

  /* ---------- audience slider ---------- */
  const at = $('#audTrack');
  if (at) {
    const step = () => (at.querySelector('.acard').offsetWidth + 6) * (innerWidth < 960 ? 1 : 2);
    $('#audNext').addEventListener('click', () => at.scrollBy({ left: step(), behavior: 'smooth' }));
    $('#audPrev').addEventListener('click', () => at.scrollBy({ left: -step(), behavior: 'smooth' }));
  }

  /* ---------- contact form -> WhatsApp ---------- */
  const f = $('#ctForm');
  if (f) {
    const segBtns = $$('.seg button', f);
    segBtns.forEach(b => b.addEventListener('click', () => segBtns.forEach(o => o.setAttribute('aria-checked', String(o === b)))));
    f.addEventListener('submit', e => {
      e.preventDefault();
      const nombre = f.nombre.value.trim();
      if (!nombre) { f.nombre.classList.add('err'); f.nombre.focus(); $('#fMsg').textContent = 'Escribe tu nombre para continuar.'; return; }
      f.nombre.classList.remove('err');
      const perfil = (segBtns.find(b => b.getAttribute('aria-checked') === 'true') || segBtns[0]).dataset.v;
      const lines = [`Hola ORNAT, quiero solicitar una demo.`, `Nombre: ${nombre}`, `Perfil: ${perfil}`];
      if (f.tel.value.trim()) lines.push(`Teléfono: ${f.tel.value.trim()}`);
      if (f.empresa.value.trim()) lines.push(`Empresa: ${f.empresa.value.trim()}`);
      if (f.modulo.value) lines.push(`Módulo de interés: ${f.modulo.value}`);
      $('#fMsg').textContent = 'Abriendo WhatsApp…';
      window.open('https://wa.me/529842353159?text=' + encodeURIComponent(lines.join('\n')), '_blank', 'noopener');
    });
  }

  /* ---------- band words ---------- */
  const bt = $('#bandTitle');
  if (bt) bt.innerHTML = bt.textContent.split(' ').map(w => `<span class="w">${w}</span>`).join(' ');

  if (!hasG || reduce) {
    $$('.band-title .w').forEach(w => w.style.opacity = 1);
    $$('.sg').forEach(s => s.style.opacity = 1);
    const art = $('#stArt'); if (art) art.style.width = 'min(520px,40vw)';
    return;
  }

  /* ================= GSAP ================= */
  const mmq = gsap.matchMedia();

  // hero intro
  const wave = $('#wavePath');
  const wl = wave.getTotalLength();
  gsap.set(wave, { strokeDasharray: wl, strokeDashoffset: wl });
  const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
  intro.from('.hero-img', { scale: 1.08, duration: 1.8, ease: 'power2.out' }, 0)
    .from('.hero-kicker', { y: 24, opacity: 0, duration: .9 }, .25)
    .from('.hero-title .ln>span', { yPercent: 110, duration: 1.1, stagger: .16 }, .35)
    .to(wave, { strokeDashoffset: 0, duration: 1.8, ease: 'power2.inOut' }, .5)
    .from('.rot', { y: 20, opacity: 0, duration: .8 }, .9)
    .from('.hdr', { y: -20, opacity: 0, duration: .7 }, 0);

  // hero parallax on scroll
  gsap.to('.hero-img', { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero-title .l1', { xPercent: -6, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero-title .l2', { xPercent: 4, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  // ring segments fill
  gsap.to('.sg', { opacity: 1, duration: .35, stagger: .12, ease: 'power1.out', delay: 1.2 });

  // floating cards migrate from hero into the product stage (desktop)
  mmq.add('(min-width: 961px)', () => {
    const tl = gsap.timeline({ scrollTrigger: { trigger: '#estudio', start: 'top bottom', end: 'top 25%', scrub: .6 } });
    tl.fromTo('#cardRender', { x: 120, y: -560, scale: .86 }, { x: 0, y: 0, scale: 1, ease: 'none' }, 0)
      .fromTo('#cardRing', { x: 500, y: -1080, scale: .9 }, { x: 0, y: 0, scale: 1, ease: 'none' }, 0)
      .fromTo('.chat', { y: 140, opacity: 0 }, { y: 0, opacity: 1, ease: 'none' }, .15);
    return () => tl.kill();
  });
  mmq.add('(max-width: 960px)', () => {
    gsap.from('.stage .ui', { y: 40, opacity: 0, duration: .8, stagger: .12, ease: 'power3.out', scrollTrigger: { trigger: '.stage', start: 'top 85%' } });
  });

  // line-art draw
  $$('.lineart').forEach(svg => {
    const rects = $$('.la', svg);
    rects.forEach(r => { const L = r.getTotalLength(); gsap.set(r, { strokeDasharray: L, strokeDashoffset: L }); });
    gsap.to(rects, { strokeDashoffset: 0, ease: 'none', stagger: .08, scrollTrigger: { trigger: svg, start: 'top 90%', end: 'bottom 40%', scrub: 1 } });
  });

  // reveals
  $$('.reveal, .intro-copy > *, .m-head, .mcard, .reel-copy > *, .process .wrap, .aud-copy').forEach(el => {
    gsap.from(el, { y: 36, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
  });

  // counters
  $$('[data-count]').forEach(el => {
    const end = +el.dataset.count, o = { v: 0 };
    el.textContent = '0';
    gsap.to(o, { v: end, duration: 1.6, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 90%' }, onUpdate: () => el.textContent = Math.round(o.v) });
  });
  gsap.from('.stat', { y: 40, opacity: 0, duration: .9, stagger: .1, ease: 'power3.out', scrollTrigger: { trigger: '.stat-row', start: 'top 85%' } });

  // statement: words split apart, sketch grows, then render wipes in
  mmq.add({ d: '(min-width: 961px)', m: '(max-width: 960px)' }, ctx => {
    const W = ctx.conditions.d ? Math.min(560, innerWidth * .4) : Math.min(innerWidth * .86, 460);
    const tl = gsap.timeline({ scrollTrigger: { trigger: '.statement', start: 'top top', end: 'bottom bottom', scrub: .8 } });
    tl.fromTo('#stArt', { width: 0, opacity: 0 }, { width: W, opacity: 1, ease: 'power2.inOut', duration: 1 }, 0)
      .fromTo(['#stA', '#stB'], { opacity: .25 }, { opacity: 1, duration: .6 }, 0)
      .fromTo('#stA', { x: ctx.conditions.d ? 0 : 0 }, { x: ctx.conditions.d ? -20 : 0, duration: 1 }, 0)
      .fromTo('#stB', { x: 0 }, { x: ctx.conditions.d ? 20 : 0, duration: 1 }, 0)
      .to('#stRd', { clipPath: 'inset(0 0% 0 0)', ease: 'none', duration: 1 }, 1.1)
      .to('#stCap', { opacity: 1, duration: .4 }, 1.2)
      .to({}, { duration: .3 });
    return () => tl.kill();
  });

  // compare: blue card slides in over the white one
  mmq.add('(min-width: 961px)', () => {
    const t = gsap.from('#cmpPost', { xPercent: -35, ease: 'power2.out', scrollTrigger: { trigger: '.cmp', start: 'top 85%', end: 'top 35%', scrub: .8 } });
    return () => t.scrollTrigger && t.scrollTrigger.kill();
  });

  // stacking panels: previous panel recedes as the next one covers it
  mmq.add('(min-width: 961px)', () => {
    const panels = $$('[data-panel]');
    const tws = panels.slice(0, -1).map((p, k) => gsap.fromTo(p, { scale: 1, filter: 'brightness(1)' }, {
      scale: .94, filter: 'brightness(0.72)', ease: 'none',
      scrollTrigger: { trigger: panels[k + 1], start: 'top bottom', end: 'top 15%', scrub: true }
    }));
    return () => tws.forEach(t => t.scrollTrigger && t.scrollTrigger.kill());
  });
  gsap.utils.toArray('.panel').forEach(p => {
    gsap.from($$('.eyebrow, .h-md, .acc', p), { y: 40, opacity: 0, duration: 1, stagger: .1, ease: 'power3.out', scrollTrigger: { trigger: p, start: 'top 70%' } });
  });

  // services
  gsap.from('.sv-copy > *', { y: 30, opacity: 0, duration: .9, stagger: .08, ease: 'power3.out', scrollTrigger: { trigger: '.sv-frame', start: 'top 70%' } });
  gsap.from('.sv-panel', { y: 60, opacity: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: '.sv-frame', start: 'top 65%' } });

  // band: parallax + word-by-word light-up
  gsap.to('.band-img', { yPercent: 6, ease: 'none', scrollTrigger: { trigger: '.band', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.to('.band-title .w', { opacity: 1, stagger: .15, ease: 'none', scrollTrigger: { trigger: '.band', start: 'top 70%', end: 'center 45%', scrub: true } });
  gsap.from('.band-note', { y: 40, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.band-note', start: 'top 90%' } });
  $$('.band-lines path').forEach(p => { const L = p.getTotalLength(); gsap.fromTo(p, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: '.band', start: 'top 80%', end: 'center center', scrub: 1 } }); });

  // reel frame scale-in
  gsap.from('.reel-frame', { scale: .92, borderRadius: 32, ease: 'none', scrollTrigger: { trigger: '.reel-frame', start: 'top bottom', end: 'center center', scrub: true } });

  // contact line + copy
  const cp = $('#ctPath'), cl = cp.getTotalLength();
  gsap.fromTo(cp, { strokeDasharray: cl, strokeDashoffset: cl }, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: '.contact', start: 'top 80%', end: 'bottom bottom', scrub: 1 } });
  gsap.from('.ct-copy > *, .ct-form', { y: 40, opacity: 0, duration: 1, stagger: .1, ease: 'power3.out', scrollTrigger: { trigger: '.contact', start: 'top 70%' } });

  addEventListener('load', () => ScrollTrigger.refresh());
})();
