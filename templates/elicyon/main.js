(() => {
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const WA = 'https://wa.me/529842353159?text=';
  gsap.registerPlugin(ScrollTrigger);

  /* ---------- Lenis ---------- */
  let lenis = null;
  if (!RM && window.Lenis) {
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 1 });
    window.lenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const t = document.querySelector(a.getAttribute('href'));
    if (!t) return;
    e.preventDefault(); closeMenu();
    lenis ? lenis.scrollTo(t, { duration: 1.6 }) : t.scrollIntoView();
  }));

  /* ---------- split helpers ---------- */
  const splitChars = el => {
    const txt = el.textContent; el.textContent = '';
    [...txt].forEach(c => { const s = document.createElement('span'); s.className = 'ch'; s.textContent = c === ' ' ? ' ' : c; el.appendChild(s); });
  };
  document.querySelectorAll('.hero__words .w').forEach(splitChars);

  /* ---------- Loader + hero intro ---------- */
  const heroKB = document.querySelectorAll('.hero__kb');
  const finishLoad = () => {
    document.body.classList.remove('is-loading');
    lenis && lenis.start();
    kenBurns();
    ScrollTrigger.refresh();
  };
  if (RM) {
    document.querySelector('.loader').remove();
    gsap.set(heroKB, { scale: 1.05 });
    finishLoad();
  } else {
    const L = gsap.timeline({ onComplete: finishLoad });
    L.to('.loader__logo span', { opacity: 1, y: 0, duration: .9, stagger: .09, ease: 'power3.out' })
     .to('.loader__logo span', { opacity: 0, y: -20, duration: .5, stagger: .05, ease: 'power2.in' }, '+=.35')
     .to('.loader', { opacity: 0, duration: .6, ease: 'none' }, '-=.15')
     .fromTo('.hero__media', { clipPath: 'inset(12% 26% 12% 26%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.6, ease: 'expo.inOut' }, '-=.55')
     .fromTo(heroKB, { scale: 1.35 }, { scale: 1.08, duration: 2.2, ease: 'expo.inOut' }, '<')
     .fromTo('.nav', { autoAlpha: 0, y: -10 }, { autoAlpha: 1, y: 0, duration: .8 }, '-=.9')
     .fromTo('.hero__words .ch', { opacity: 0, filter: 'blur(10px)', y: 10 }, { opacity: 1, filter: 'blur(0px)', y: 0, duration: 1.1, stagger: { each: .035, from: 'random' }, ease: 'power2.out' }, '-=1.1')
     .set('.loader', { display: 'none' });
  }
  // simulated video: slow Ken Burns + crossfade between two renders
  function kenBurns() {
    if (RM) return;
    const [a, b] = heroKB;
    gsap.to(a.querySelector('img'), { scale: 1.12, xPercent: -2, duration: 14, ease: 'none', repeat: -1, yoyo: true });
    gsap.fromTo(b.querySelector('img'), { scale: 1.02 }, { scale: 1.14, xPercent: 2, duration: 16, ease: 'none', repeat: -1, yoyo: true });
    gsap.timeline({ repeat: -1, delay: 5 })
      .to(b, { opacity: 1, duration: 2.4, ease: 'sine.inOut' })
      .to(b, { opacity: 0, duration: 2.4, ease: 'sine.inOut' }, '+=6')
      .to({}, { duration: 6 });
  }
  // hero scroll-out
  gsap.to('.hero__media', { yPercent: 18, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.w1', { yPercent: -120, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.w3', { yPercent: 80, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  /* ---------- Manifesto: word reveal + floating images ---------- */
  const mText = document.querySelector('.manifesto__text');
  mText.querySelectorAll('.l').forEach(l => {
    const walk = node => [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(p => {
          if (!p) return;
          if (/^\s+$/.test(p)) frag.appendChild(document.createTextNode(' '));
          else { const s = document.createElement('span'); s.className = 'wd'; s.textContent = p; frag.appendChild(s); }
        });
        n.replaceWith(frag);
      } else walk(n);
    });
    walk(l);
  });
  const words = mText.querySelectorAll('.wd');
  const mTL = gsap.timeline({ scrollTrigger: { trigger: '.manifesto', start: 'top top', end: 'bottom bottom', scrub: .6 } });
  mTL.fromTo(words, { color: '#d9d6d0' }, { color: (i, el) => el.closest('em') ? '#a19d95' : '#111111', stagger: .1, duration: .6, ease: 'none' }, 0);
  const speeds = [1.35, 1.1, 1.6, 1.25, 1.45, 1.2];
  document.querySelectorAll('.fl').forEach((f, i) => {
    mTL.fromTo(f, { y: 0 }, { y: () => -window.innerHeight * 2.6 * speeds[i], ease: 'none', duration: words.length * .1 + .5 }, 0);
  });

  /* ---------- Module stack: scattered letters gather, panels wipe up ---------- */
  const panels = [...document.querySelectorAll('.panel')];
  const dots = [...document.querySelectorAll('.stack__dots i')];
  const lettersOf = [];
  panels.forEach(p => {
    const h = p.querySelector('.panel__word');
    const w = p.dataset.word;
    [...w].forEach(c => { const s = document.createElement('span'); s.className = 'lt'; s.textContent = c; s.setAttribute('aria-hidden', 'true'); h.appendChild(s); });
    lettersOf.push([...h.children]);
  });
  const sizeWords = () => {
    panels.forEach((p, i) => {
      const h = p.querySelector('.panel__word');
      const n = p.dataset.word.length;
      h.style.fontSize = Math.min(160, (window.innerWidth * 0.95) / (n * 0.72)) + 'px';
    });
  };
  sizeWords();
  // scattered offset for each letter, relative to its final (gathered) place
  const scatter = (el, i, n) => {
    const W = window.innerWidth, H = window.innerHeight;
    const cols = Math.ceil(n / 3), row = i % 3, col = Math.floor(i / 3);
    const tx = (col + .15 + ((i * 37) % 10) / 20) * (W / cols) * .92;
    const ty = H * (.12 + row * .26);
    return { x: tx - el.offsetLeft, y: ty - el.offsetTop };
  };
  const sTL = gsap.timeline({
    scrollTrigger: {
      trigger: '.stack', start: 'top top', end: 'bottom bottom', scrub: .7, invalidateOnRefresh: true,
      onRefreshInit: sizeWords,
      onUpdate: self => {
        const idx = Math.min(panels.length - 1, Math.floor(self.progress * panels.length * .999));
        dots.forEach((d, k) => d.classList.toggle('on', k === idx));
      }
    }
  });
  panels.forEach((p, i) => {
    const ls = lettersOf[i];
    sTL.fromTo(ls, { x: (k, el) => scatter(el, k, ls.length).x, y: (k, el) => scatter(el, k, ls.length).y },
      { x: 0, y: 0, duration: 1, ease: 'power2.inOut', stagger: .02 }, i * 2);
    sTL.fromTo(p.querySelector('.panel__img'), { yPercent: 0 }, { yPercent: 5, duration: 2, ease: 'none' }, i * 2);
    if (i < panels.length - 1) {
      sTL.fromTo(p, { clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 100% 0%)', duration: .9, ease: 'power2.inOut' }, i * 2 + 1.1);
      sTL.fromTo(panels[i + 1].querySelector('.panel__img img'), { scale: 1.15 }, { scale: 1, duration: 1, ease: 'power2.out' }, i * 2 + 1.1);
    } else {
      sTL.to({}, { duration: .4 });
    }
  });

  /* ---------- Parallax bits ---------- */
  const par = (sel, trig, from, to) => gsap.fromTo(sel, { yPercent: from }, { yPercent: to, ease: 'none', scrollTrigger: { trigger: trig, start: 'top bottom', end: 'bottom top', scrub: true } });
  par('.sc1', '.services__cards', 6, -6);
  par('.sc2', '.services__cards', 14, -14);
  par('.sc3', '.services__cards', 3, -9);
  par('.vision__bg', '.vision', -8, 8);
  par('.vision__photo img', '.vision', -10, 0);
  par('.touch__bg', '.touch', -8, 8);
  gsap.utils.toArray('.title, .small, .ulink:not(.light), .vision__p, .vision__method li, .wcard, .touch__card').forEach(el => {
    if (el.closest('.loader,.nav,.panel')) return;
    gsap.fromTo(el, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
  });
  // sketch -> render wipe when cards enter view
  document.querySelectorAll('.wcard').forEach((c, i) => {
    ScrollTrigger.create({ trigger: c, start: 'top 70%', onEnter: () => setTimeout(() => c.classList.add('on'), i * 180) });
  });

  /* ---------- Audiences drag slider ---------- */
  const AUD = [
    ['Arquitectos', 'Explica tus proyectos con planos, renders y experiencias visuales que acompañen tu presentación.', 'a1', 'Maqueta de arquitectura contemporánea'],
    ['Diseño interior', 'Presenta ambientes, materiales y acabados con visualizaciones que expliquen cada decisión de diseño.', 'a2', 'Maqueta de interiores con mobiliario'],
    ['Arquitectos paisajistas', 'Muestra jardines y espacios exteriores mediante renders, videos y recorridos que comuniquen tu propuesta.', 'a3', 'Maqueta de villa con jardín y alberca'],
    ['Constructoras', 'Documenta avances con dron y videos apoyados por IA para comunicar el desarrollo del proyecto.', 'a4', 'Maqueta de edificio en obra'],
    ['Desarrolladores inmobiliarios', 'Presenta preventas con sitios web, renders, videos hiperrealistas y experiencias de realidad aumentada o mixta.', 'a5', 'Maqueta de torre frente al mar'],
    ['Brokers', 'Atiende consultas con agentes inteligentes y comparte contenido visual que explique las propiedades de tu cartera.', 'a6', 'Maqueta de residencia con pantallas de presentación'],
    ['Inmobiliarias', 'Conecta presentación, atención, capacitación y análisis en tu operación inmobiliaria.', 'a7', 'Maqueta de desarrollo con plataforma web'],
    ['Despachos de diseño', 'Integra visualización, contenido y herramientas digitales según las necesidades de tu despacho.', 'a8', 'Maqueta de conjunto residencial con dispositivos']
  ];
  const track = document.querySelector('.slider__track');
  const slides = AUD.map(([n, , img, alt]) => {
    const d = document.createElement('div'); d.className = 'slide';
    d.innerHTML = `<img src="https://ornat-elicyon.vercel.app/img/${img}.webp" alt="${alt}" loading="lazy" draggable="false">`;
    track.appendChild(d); return d;
  });
  const N = slides.length;
  let pos = 0, target = 0, active = -1;
  const nameEl = document.querySelector('.objects__name'), descEl = document.querySelector('.objects__desc'), cntEl = document.querySelector('.objects__count');
  const renderSlider = () => {
    const sp = Math.min(window.innerWidth * .155, 225);
    slides.forEach((s, i) => {
      let d = ((i - pos) % N + N) % N; if (d > N / 2) d -= N;
      const ad = Math.abs(d);
      const sc = ad < 1 ? 1.45 - ad * .45 : Math.max(.75, 1 - (ad - 1) * .08);
      const x = d * sp + Math.sign(d) * Math.min(ad, 1) * sp * .28;
      const y = (i % 2 ? 1 : -1) * Math.min(ad, 1) * 14;
      s.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px) scale(${sc})`;
      s.style.zIndex = 100 - Math.round(ad * 10);
      s.style.opacity = ad > 3.6 ? 0 : 1;
    });
    const a = ((Math.round(pos) % N) + N) % N;
    if (a !== active) {
      active = a; slides.forEach((s, i) => s.classList.toggle('on', i === a));
      nameEl.textContent = AUD[a][0]; descEl.textContent = AUD[a][1];
      cntEl.textContent = String(a + 1).padStart(2, '0') + ' / ' + String(N).padStart(2, '0');
    }
  };
  gsap.ticker.add(() => { pos += (target - pos) * (RM ? 1 : .12); renderSlider(); });
  const slider = document.querySelector('.slider');
  let dragging = false, sx = 0, st = 0;
  slider.addEventListener('pointerdown', e => { dragging = true; sx = e.clientX; st = target; slider.setPointerCapture(e.pointerId); });
  slider.addEventListener('pointermove', e => { if (dragging) target = st - (e.clientX - sx) / Math.min(window.innerWidth * .155, 225); });
  const end = () => { if (!dragging) return; dragging = false; target = Math.round(target); };
  slider.addEventListener('pointerup', end); slider.addEventListener('pointercancel', end);
  document.querySelector('.objects .prev').addEventListener('click', () => target = Math.round(target) - 1);
  document.querySelector('.objects .next').addEventListener('click', () => target = Math.round(target) + 1);
  slider.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') target = Math.round(target) - 1; if (e.key === 'ArrowRight') target = Math.round(target) + 1; });

  /* ---------- Nav tone + hide on scroll ---------- */
  const nav = document.querySelector('.nav');
  const toneEls = [...document.querySelectorAll('[data-tone]')].filter(e => e !== nav);
  let lastY = 0;
  const navUpdate = () => {
    const y = window.scrollY;
    let tone = 'light';
    for (const el of toneEls) { const r = el.getBoundingClientRect(); if (r.top <= 30 && r.bottom > 30) tone = el.dataset.tone; }
    // inside stack: panels are images → light
    nav.classList.toggle('dark', tone === 'dark' && !document.body.classList.contains('menu-open'));
    const menuOpen = document.body.classList.contains('menu-open');
    nav.classList.toggle('hide', !menuOpen && y > window.innerHeight * .8 && y > lastY + 2);
    if (y < lastY - 2 || y < 50) nav.classList.remove('hide');
    lastY = y;
  };
  window.addEventListener('scroll', navUpdate, { passive: true });
  navUpdate();

  /* ---------- Mobile menu ---------- */
  const menu = document.getElementById('menu'), mBtn = document.querySelector('.nav__menu');
  function closeMenu() { if (menu.hidden) return; menu.hidden = true; mBtn.setAttribute('aria-expanded', 'false'); mBtn.textContent = 'Menú'; document.body.classList.remove('menu-open'); lenis && lenis.start(); navUpdate(); }
  mBtn.addEventListener('click', () => {
    if (!menu.hidden) return closeMenu();
    menu.hidden = false; mBtn.setAttribute('aria-expanded', 'true'); mBtn.textContent = 'Cerrar';
    document.body.classList.add('menu-open'); nav.classList.remove('dark', 'hide'); lenis && lenis.stop();
    gsap.fromTo('.menu li', { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, stagger: .06, duration: .6, ease: 'power3.out' });
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  /* ---------- Subscribe form → WhatsApp ---------- */
  document.getElementById('joinForm').addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const msg = `Hola ORNAT, quiero suscribirme. Nombre: ${f.get('nombre')}${f.get('empresa') ? ' · Empresa: ' + f.get('empresa') : ''} · Correo: ${f.get('correo')}`;
    window.open(WA + encodeURIComponent(msg), '_blank', 'noopener');
  });

  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
