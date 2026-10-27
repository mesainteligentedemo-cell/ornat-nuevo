(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- MODULES DATA (copy: ornat-nuevo) ---------- */
  const MODS = [
    { t: ['Web IA'], tags: 'Sitio web · Experiencia personalizada', d: 'Un sitio llamativo para presentar tu proyecto. Incluye un sitio web con experiencia personalizada.', img: 'https://ornat-elyse.vercel.app/img/m01.webp', alt: 'Sitio web y maqueta de villa en pantallas' },
    { t: ['Render IA'], tags: 'Render · Planos · Materiales', d: 'Visualiza espacios. Convertimos tus planos o bosquejos en entregables visuales para explicar distribución, materiales y espacios.', img: '/img/gpt-maroma-v1/elyse-m02-1536.webp?v=maroma-elyse-m02-299f1335184f', alt: 'Interior isométrico renderizado' },
    { t: ['Del plano', 'al render'], tags: 'Bosquejo · Render hiperrealista', d: 'Partimos de un plano o bosquejo para desarrollar planos, renders y videos hiperrealistas que ayuden a presentar espacios y explicar tu proyecto.', img: 'https://ornat-elyse.vercel.app/img/m03.webp', alt: 'Planos y maqueta de villa sobre la mesa' },
    { t: ['Recorrido', 'virtual'], tags: 'Recorrido virtual · RA · Realidad mixta · Dron', d: 'Suma presentadores de IA, realidad aumentada, realidad mixta y producción con dron para tus desarrollos.', img: '/img/gpt-unique-v4/elyse-exclusive-m04-1536.webp', alt: 'Maqueta con visor de realidad virtual' },
    { t: ['Agente', 'comercial'], tags: 'Agente comercial · Seguimiento', d: 'Un agente con IA responde de forma natural usando información de tu empresa. Configuramos los canales disponibles y el seguimiento junto con tu equipo.', img: 'https://ornat-elyse.vercel.app/img/m05.webp', alt: 'Tableta con agente comercial junto a la maqueta' },
    { t: ['Contenido', 'social'], tags: 'Videos · Presentadores virtuales · Redes', d: 'Videos impactantes, recorridos con presentadores virtuales y publicaciones automatizadas para mantener una comunicación consistente con tu comunidad.', img: 'https://ornat-elyse.vercel.app/img/m06.webp', alt: 'Edición de video y teléfonos con contenido social' },
    { t: ['Capacitación', 'con voz y IA'], tags: 'Voz con IA · Nuevo ingreso · Todo el equipo', d: 'Un instructor con voz de IA capacita a tu personal de nuevo ingreso y a cada empleado actual, sin importar el área o el puesto, con módulos y exámenes.', img: '/img/gpt-maroma-v1/elyse-exclusive-m07-1536.webp?v=maroma-elyse-exclusive-m07-d3710e186c51', alt: 'Pantalla con onda de voz y audífonos' },
    { t: ['Recursos', 'humanos con IA'], tags: 'Entrevistas con IA · Selección · Candidatos', d: 'Entrevista a las personas con inteligencia artificial y compara perfiles con el mismo criterio, para agilizar la selección de tu equipo.', img: '/img/gpt-unique-v4/elyse-exclusive-m08-1536.webp', alt: 'Tableta con entrevista y audífonos' },
    { t: ['Análisis', 'empresarial'], tags: 'Análisis · Departamentos · Decisiones', d: 'Analiza información de los departamentos de tu empresa para apoyar decisiones con contexto.', img: 'https://ornat-elyse.vercel.app/img/m09.webp', alt: 'Tablero de análisis sobre maqueta' }
  ];

  /* ---------- LENIS ---------- */
  let lenis = null;
  if (typeof Lenis !== 'undefined' && !reduce) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    if (hasGsap) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  const scrollToEl = (el) => {
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.4 });
    else el.scrollIntoView({ behavior: 'smooth' });
  };

  /* ---------- HEADER / MENU ---------- */
  const header = $('#header');
  const burger = $('#burger');
  const menu = $('#menu');
  const onScrollHeader = () => header.classList.toggle('is-scrolled', window.scrollY > 1);
  onScrollHeader();
  window.addEventListener('scroll', onScrollHeader, { passive: true });

  const setMenu = (open) => {
    menu.classList.toggle('open', open);
    header.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    menu.setAttribute('aria-hidden', !open);
    if (lenis) open ? lenis.stop() : lenis.start();
    document.body.style.overflow = open ? 'hidden' : '';
  };
  burger.addEventListener('click', () => setMenu(!menu.classList.contains('open')));

  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const el = id.length > 1 ? $(id) : null;
      if (!el) return;
      e.preventDefault();
      const wasOpen = menu.classList.contains('open');
      if (wasOpen) setMenu(false);
      setTimeout(() => scrollToEl(el), wasOpen ? 350 : 0);
    });
  });

  /* ---------- VIDEO ---------- */
  const video = $('.hero__video');
  if (video) {
    video.muted = true;
    const p = video.play();
    if (p && p.catch) p.catch(() => {});
  }

  /* ---------- line index vars ---------- */
  $$('[data-lines], .track__box, .mtitle').forEach((wrap) => $$('.ln', wrap).forEach((l, i) => l.style.setProperty('--i', i)));

  /* ---------- MODULES SLIDER ---------- */
  const track = $('#modsTrack');
  const viewport = $('#modsViewport');
  const titles = $('#modsTitles');
  const info = $('#modsInfo');
  const pag = $('#modsPag');
  const count = $('#modsCount');
  const N = MODS.length;
  const pad2 = (n) => String(n).padStart(2, '0');

  for (let c = 0; c < 3; c++) {
    MODS.forEach((m, i) => {
      const s = document.createElement('div');
      s.className = 'mslide';
      s.dataset.idx = c * N + i;
      s.innerHTML = `<img src="${m.img}" alt="${c === 1 ? m.alt : ''}" width="1400" height="933" decoding="async"${c === 1 ? '' : ' aria-hidden="true"'}>`;
      track.appendChild(s);
    });
  }
  MODS.forEach((m, i) => {
    const t = document.createElement('h3');
    t.className = 'mtitle';
    t.innerHTML = m.t.map((l, j) => `<span class="ln" style="--i:${j}"><span>${l}</span></span>`).join('');
    titles.appendChild(t);
    const f = document.createElement('div');
    f.className = 'minfo';
    f.innerHTML = `<div><p class="tags">${pad2(i + 1)} / Módulo · ${m.tags}</p><p>${m.d}</p></div><a href="#contacto" class="btn btn--line">Solicitar demo</a>`;
    info.appendChild(f);
    const b = document.createElement('button');
    b.textContent = `(${i + 1})`;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-label', `Módulo ${i + 1}: ${m.t.join(' ')}`);
    b.addEventListener('click', () => goTo(N + i, true));
    pag.appendChild(b);
  });
  // re-bind anchor clicks for generated buttons
  $$('a[href^="#"]', info).forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); scrollToEl($('#contacto')); }));

  const slides = $$('.mslide', track);
  const tEls = $$('.mtitle', titles);
  const iEls = $$('.minfo', info);
  const pEls = $$('button', pag);
  let cur = N, logical = 0, started = false;

  const dims = () => {
    const vw = window.innerWidth;
    const mobile = vw < 768;
    const sw = mobile ? Math.round(vw * 0.78) : Math.round(vw * 0.312);
    const gap = mobile ? 14 : Math.round(vw * 0.155);
    document.documentElement.style.setProperty('--sw', sw + 'px');
    document.documentElement.style.setProperty('--gap', gap + 'px');
    return { sw, gap, vw, mobile };
  };
  let D = dims();
  const place = (anim) => {
    const x = D.vw / 2 - (cur * (D.sw + D.gap) + D.sw / 2);
    track.style.transition = anim ? 'transform 1s cubic-bezier(.65,.05,.25,1)' : 'none';
    track.style.transform = `translate3d(${x}px,0,0)`;
  };
  const setActive = (prevLogical) => {
    slides.forEach((s, i) => s.classList.toggle('on', i === cur));
    tEls.forEach((t, i) => {
      t.classList.remove('out');
      if (i === logical) t.classList.add('on');
      else if (t.classList.contains('on')) { t.classList.remove('on'); t.classList.add('out'); }
    });
    iEls.forEach((t, i) => t.classList.toggle('on', i === logical));
    pEls.forEach((b, i) => { b.classList.toggle('on', i === logical); b.setAttribute('aria-selected', i === logical); });
    count.textContent = `${pad2(logical + 1)} / ${pad2(N)}`;
  };
  function goTo(i, anim = true) {
    cur = i;
    logical = ((i % N) + N) % N;
    place(anim);
    if (started) setActive();
    else slides.forEach((s, k) => s.classList.toggle('on', k === cur));
  }
  track.addEventListener('transitionend', (e) => {
    if (e.target !== track) return;
    if (cur < N || cur >= 2 * N) {
      cur = N + logical;
      slides.forEach((s) => (s.style.transition = 'none'));
      place(false);
      slides.forEach((s, i) => s.classList.toggle('on', i === cur));
      track.offsetHeight;
      slides.forEach((s) => (s.style.transition = ''));
    }
  });
  slides.forEach((s) => s.addEventListener('click', () => {
    if (moved) return;
    const i = +s.dataset.idx;
    if (i !== cur) goTo(i);
  }));
  // drag / swipe
  let sx = 0, sy = 0, down = false, moved = false;
  viewport.addEventListener('pointerdown', (e) => { down = true; moved = false; sx = e.clientX; sy = e.clientY; });
  window.addEventListener('pointerup', (e) => {
    if (!down) return; down = false;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { moved = true; goTo(cur + (dx < 0 ? 1 : -1)); setTimeout(() => (moved = false), 50); }
  });
  viewport.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') goTo(cur + 1); if (e.key === 'ArrowLeft') goTo(cur - 1); });
  viewport.tabIndex = 0;
  goTo(N, false);
  const startMods = () => { if (started) return; started = true; setActive(); };
  window.addEventListener('resize', () => { D = dims(); place(false); });

  /* ---------- ACCORDION ---------- */
  $$('.acc').forEach((acc) => {
    const q = $('.acc__q', acc);
    q.addEventListener('click', () => {
      const open = !acc.classList.contains('is-open');
      acc.classList.toggle('is-open', open);
      q.setAttribute('aria-expanded', open);
      setTimeout(() => hasGsap && ScrollTrigger.refresh(), 750);
    });
  });

  /* ---------- PINNED TRACK (slice mask transitions) ---------- */
  const bigs = $$('[data-big]');
  const smalls = $$('[data-small]');
  const boxes = $$('.track__box');
  const bar = $('#trackBar');
  const SL = 24;
  const maskFor = (pr) => {
    const step = 100 / SL;
    let g = 'linear-gradient(0deg';
    for (let j = 0; j < SL; j++) {
      const p = clamp(pr * 1.8 - (j / (SL - 1)) * 0.8);
      const a = (j * step).toFixed(3), b = (j * step + step * p).toFixed(3), c = ((j + 1) * step).toFixed(3);
      g += `,#000 ${a}% ${b}%`;
      if (p < 1) g += `,transparent ${b}% ${c}%`;
    }
    return g + ')';
  };
  let activeBox = -1;
  const setBox = (k) => {
    if (k === activeBox) return;
    activeBox = k;
    boxes.forEach((b, i) => b.classList.toggle('on', i === k));
  };
  const renderTrack = (p) => {
    const T = clamp(p * 1.1 - 0.05) * (bigs.length - 1);
    let act = 0;
    for (let k = 1; k < bigs.length; k++) {
      const local = clamp((T - (k - 1) - 0.15) / 0.7);
      bigs[k].style.setProperty('--m', local >= 1 ? 'none' : maskFor(local));
      bigs[k].style.visibility = local <= 0 ? 'hidden' : 'visible';
      smalls[k].style.clipPath = `inset(${(100 - local * 100).toFixed(2)}% 0 0 0)`;
      if (local > 0.5) act = k;
    }
    if (bar) bar.style.transform = `scaleY(${p.toFixed(4)})`;
    return act;
  };
  let trackEntered = false;
  const enterTrack = () => {
    if (trackEntered) return; trackEntered = true;
    if (hasGsap) {
      gsap.fromTo(bigs[0], { x: 100, opacity: 0 }, { x: 0, opacity: 1, duration: 1.2, ease: 'power2.out' });
      gsap.to(smalls[0], { clipPath: 'inset(0% 0 0 0)', duration: 0.9, ease: 'power2.out', delay: 0.2 });
    } else { smalls[0].style.clipPath = 'inset(0 0 0 0)'; }
  };
  bigs.forEach((b, i) => { if (i) b.style.visibility = 'hidden'; });

  /* ---------- GSAP ---------- */
  if (!hasGsap) {
    $$('[data-lines]').forEach((e) => e.classList.add('in'));
    startMods(); enterTrack(); setBox(0);
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  // hero chars
  const h1 = $('[data-hero="title"]');
  const letters = h1.textContent.trim().split('');
  h1.innerHTML = letters.map((c) => `<span class="ch" aria-hidden="true"><span>${c}</span></span>`).join('');
  const chars = $$('.ch>span', h1);
  const min = $('[data-hero="title-min"]');
  min.innerHTML = min.textContent.trim().split(/\s+/).map((w) => `<span class="w">${w}</span>`).join(' ');
  const words = $$('.w', min);

  if (!reduce) {
    gsap.set(chars, { yPercent: 105 });
    gsap.set(words, { opacity: 0, y: 30, rotationX: -45 });
    gsap.set(['[data-hero="subtitle"]'], { opacity: 0, y: 40 });
    gsap.set('[data-hero="scroll"]', { opacity: 0, y: 20 });
    gsap.set('.header__in', { opacity: 0, yPercent: -100 });
    gsap.set('[data-hero="line"]', { opacity: 0, scaleX: 0 });
    gsap.timeline({ defaults: { ease: 'power3.out' } })
      .to(chars, { yPercent: 0, duration: 2, stagger: 0.1 }, 0.5)
      .to(words, { opacity: 1, y: 0, rotationX: 0, duration: 1.2, stagger: 0.04 }, 1.3)
      .to('[data-hero="subtitle"]', { opacity: 1, y: 0, duration: 1.5 }, 1.7)
      .to('[data-hero="scroll"]', { opacity: 1, y: 0, duration: 1 }, 2.4)
      .to('.header__in', { opacity: 1, yPercent: 0, duration: 1 }, 2.2)
      .to('[data-hero="line"]', { opacity: 1, scaleX: 1, duration: 1 }, 3);

    gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 } })
      .to('[data-hero="img"]', { yPercent: 30, scale: 1.1, ease: 'none' }, 0)
      .to(h1, { yPercent: -50, opacity: 0, ease: 'none' }, 0)
      .to('[data-hero="content"]', { yPercent: -30, opacity: 0, ease: 'none' }, 0);
  }

  // line reveals
  $$('[data-lines]').forEach((el) => {
    ScrollTrigger.create({ trigger: el, start: 'top 85%', once: true, onEnter: () => el.classList.add('in') });
  });
  // fades
  $$('[data-fade]').forEach((el) => {
    gsap.from(el, { opacity: 0, y: 24, duration: 1.1, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 92%', once: true } });
  });
  $$('[data-stagger]').forEach((w) => {
    const items = $$('[data-card]', w);
    gsap.from(items, { opacity: 0, y: 30, duration: 0.9, stagger: 0.12, ease: 'power2.out', scrollTrigger: { trigger: w, start: 'top 82%', once: true } });
  });
  // parallax images
  $$('[data-parallax]').forEach((img) => {
    gsap.fromTo(img, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: 1 } });
  });
  // numbers
  const numEls = $$('[data-number]');
  ScrollTrigger.create({
    trigger: '[data-numbers]', start: 'top 80%', once: true,
    onEnter: () => numEls.forEach((el) => {
      const target = parseInt(el.textContent, 10);
      const o = { v: 0 };
      el.textContent = '0';
      gsap.to(o, { v: target, duration: 2, ease: 'power2.out', onUpdate: () => (el.textContent = Math.round(o.v)) });
    })
  });
  // modules
  ScrollTrigger.create({ trigger: '.mods__stage', start: 'top 80%', once: true, onEnter: startMods });

  // pinned track
  ScrollTrigger.create({
    trigger: '.track', start: 'top top', end: 'bottom bottom',
    onUpdate: (self) => setBox(renderTrack(self.progress)),
    onEnter: () => { enterTrack(); gsap.to(header, { yPercent: -100, duration: 0.3, overwrite: true }); },
    onLeave: () => gsap.to(header, { yPercent: 0, duration: 0.3, overwrite: true }),
    onEnterBack: () => gsap.to(header, { yPercent: -100, duration: 0.3, overwrite: true }),
    onLeaveBack: () => gsap.to(header, { yPercent: 0, duration: 0.3, overwrite: true })
  });
  ScrollTrigger.create({ trigger: '.track', start: 'top 70%', once: true, onEnter: () => { enterTrack(); setBox(0); } });
  renderTrack(0);

  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
