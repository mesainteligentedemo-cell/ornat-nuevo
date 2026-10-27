(() => {
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasG = typeof gsap !== 'undefined';
  if (hasG && typeof ScrollTrigger !== 'undefined') gsap.registerPlugin(ScrollTrigger);
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const WA = 'https://wa.me/529842353159?text=';

  /* ---------- Modules data ---------- */
  const MODS = [
    { t: 'Web IA', d: 'Un sitio para presentar tu proyecto. Tu software incluye un sitio web llamativo con experiencia personalizada.', s: 'Plataforma y diseño', e: 'Sitio web y experiencia personalizada', p: 'Desarrolladores inmobiliarios', n: '005', img: 'https://ornat-pamidor.vercel.app/img/custom-web-1536.webp', alt: 'Maqueta 3D con pantallas de un sitio web inmobiliario' },
    { t: 'Render IA', d: 'Visualiza espacios. Renders hiperrealistas que ayudan a presentar distribución, materiales y acabados.', s: 'Plataforma y diseño', e: 'Renders hiperrealistas', p: 'Arquitectos', n: '003', render: 'https://ornat-pamidor.vercel.app/img/custom-render-1536.webp', alt: 'Render a color de una residencia con alberca' },
    { t: 'Del plano al render', d: 'Convertimos tus planos o bosquejos en entregables visuales para explicar distribución, materiales y espacios.', s: 'Plataforma y diseño', e: 'Planos, renders y videos', p: 'Diseño interior', n: '002', pair: ['https://ornat-pamidor.vercel.app/img/custom-isometric-1536.webp', 'https://ornat-pamidor.vercel.app/img/custom-plan-render-1536.webp'], alt: 'Bosquejo a lápiz que se transforma en render a color' },
    { t: 'Recorrido virtual', d: 'Recorridos con presentadores virtuales que permiten explicar tus proyectos y presentar cada espacio.', s: 'Plataforma y diseño', e: 'Recorrido virtual', p: 'Brokers', n: '004', img: 'https://ornat-pamidor.vercel.app/img/custom-tour-1536.webp', alt: 'Maqueta 3D de interiores con pantalla de recorrido' },
    { t: 'Agente comercial', d: 'Un agente con IA responde de forma natural usando información de tu empresa. Configuramos los canales disponibles y el seguimiento junto con tu equipo.', s: 'Agentes inteligentes', e: 'Consultas con seguimiento', p: 'Inmobiliarias', n: '006', img: 'https://ornat-pamidor.vercel.app/img/custom-agent-1536.webp', alt: 'Maqueta 3D con tableta y agente de atención' },
    { t: 'Contenido social', d: 'Videos impactantes y publicaciones automatizadas para mantener una comunicación consistente con tu comunidad.', s: 'Agentes inteligentes', e: 'Redes automatizadas', p: 'Desarrolladores inmobiliarios', n: '007', img: 'https://ornat-pamidor.vercel.app/img/custom-social-1536.webp', alt: 'Teléfono con contenido social junto a una maqueta' },
    { t: 'Capacitación', d: 'Capacita mediante audio, módulos y exámenes para que tu equipo aprenda y decida.', s: 'Agentes inteligentes', e: 'Capacitación con audio, módulos y exámenes', p: 'Constructoras', n: '008', img: 'https://ornat-pamidor.vercel.app/img/custom-training-1536.webp', alt: 'Monitor y audífonos junto a una maqueta 3D' },
    { t: 'Análisis empresarial', d: 'Analiza información de los departamentos de tu empresa para apoyar decisiones con contexto.', s: 'Agentes inteligentes', e: 'Análisis empresarial para apoyar tus decisiones', p: 'Despachos de diseño', n: '009', img: 'https://ornat-pamidor.vercel.app/img/custom-analysis-1536.webp', alt: 'Pantallas con gráficas de análisis junto a una maqueta' }
  ];
  const list = $('#modList');
  MODS.forEach((m, i) => {
    const li = document.createElement('li');
    li.className = 'mod' + (i === 0 ? ' is-active' : '');
    let media;
    if (m.pair) media = `<div class="mod__img mod__img--pair"><img src="${m.pair[0]}" alt="${m.alt}" loading="lazy"><img class="r" src="${m.pair[1]}" alt="" loading="lazy"></div>`;
    else if (m.render) media = `<div class="mod__img mod__img--render"><img src="${m.render}" alt="${m.alt}" loading="lazy"></div>`;
    else media = `<div class="mod__img"><img src="${m.img}" alt="${m.alt}" loading="lazy"></div>`;
    li.innerHTML = `
      <div class="mod__bar">
        <h3 class="mod__t">${m.t}</h3>
        <a class="btn mod__go" href="${WA + encodeURIComponent('Hola ORNAT, quiero solicitar una demo del módulo ' + m.t)}" target="_blank" rel="noopener">Ver módulo <i class="arr" aria-hidden="true">→</i></a>
        <span class="mod__sp"></span>
      </div>
      <div class="mod__body"><div class="mod__in"><div class="mod__grid">
        <div class="mod__left">
          <p class="mod__desc">${m.d}</p>
          <dl class="mod__meta">
            <div><dt>Servicio</dt><dd>${m.s}</dd></div>
            <div><dt>Entregable</dt><dd>${m.e}</dd></div>
            <div><dt>Para</dt><dd>${m.p}</dd></div>
            <div><dt>Paso</dt><dd>${m.n}</dd></div>
          </dl>
        </div>
        ${media}
      </div></div></div>`;
    list.appendChild(li);
  });
  const mods = $$('.mod', list);
  let active = 0;
  const setActive = (i) => {
    if (i === active) return;
    active = i;
    mods.forEach((m, k) => m.classList.toggle('is-active', k === i));
  };

  /* ---------- Split headings into words ---------- */
  $$('.split').forEach(el => {
    el.innerHTML = el.textContent.trim().split(/\s+/).map(w => `<span class="w"><span>${w}</span></span>`).join(' ');
  });

  /* ---------- Word reveal text ---------- */
  const rt = $('#revealText');
  rt.innerHTML = rt.textContent.trim().split(/\s+/).map(w => `<span class="wd">${w}</span>`).join(' ');
  const words = $$('.wd', rt);
  const aboutRender = $('#aboutRender');
  const setReveal = (p) => {
    const n = Math.round(Math.min(1, Math.max(0, p)) * (words.length + 6));
    words.forEach((w, i) => {
      w.classList.toggle('on', i < n - 5);
      w.classList.toggle('hot', i >= n - 5 && i < n);
    });
    aboutRender.style.clipPath = `inset(0 ${100 - Math.min(1, Math.max(0, p * 1.15)) * 100}% 0 0)`;
  };

  /* ---------- Menu ---------- */
  const burger = $('#burger'), menu = $('#menu');
  const toggleMenu = (open) => {
    document.body.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    menu.setAttribute('aria-hidden', !open);
    if (window.lenis) open ? lenis.stop() : lenis.start();
  };
  burger.addEventListener('click', () => toggleMenu(!document.body.classList.contains('menu-open')));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') toggleMenu(false); });

  /* ---------- Anchors ---------- */
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    const t = id.length > 1 && $(id);
    if (!t) return;
    e.preventDefault();
    if (a.hasAttribute('data-close')) toggleMenu(false);
    if (window.lenis) lenis.scrollTo(t, { duration: 1.4 }); else t.scrollIntoView({ behavior: RM ? 'auto' : 'smooth' });
  }));

  /* ---------- Form ---------- */
  $('#demoForm').addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(e.target);
    let txt = 'Hola ORNAT, quiero solicitar una demo';
    if (f.get('modulo')) txt += ' del módulo ' + f.get('modulo');
    txt += '.';
    if (f.get('nombre')) txt += '\nNombre: ' + f.get('nombre');
    if (f.get('empresa')) txt += '\nEmpresa: ' + f.get('empresa');
    if (f.get('tel')) txt += '\nTeléfono: ' + f.get('tel');
    if (f.get('msg')) txt += '\nMensaje: ' + f.get('msg');
    window.open(WA + encodeURIComponent(txt), '_blank', 'noopener');
  });

  /* ---------- Cookie ---------- */
  const ck = $('#cookie');
  let ckSeen = null;
  try { ckSeen = localStorage.getItem('ornat-ck'); } catch (e) {}
  const showCookie = () => { if (!ckSeen) ck.hidden = false; };
  ck.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    try { localStorage.setItem('ornat-ck', b.dataset.c); } catch (er) {}
    ck.hidden = true;
  });

  /* ---------- Footer curtain ---------- */
  const fc = $('.foot-clip'), foot = $('#footer');
  const sizeFoot = () => {
    const h = foot.offsetHeight;
    if (h > window.innerHeight - 40) { foot.style.position = 'relative'; fc.style.setProperty('--fh', 'auto'); fc.style.clipPath = 'none'; }
    else { foot.style.position = ''; fc.style.setProperty('--fh', h + 'px'); fc.style.clipPath = ''; }
  };
  sizeFoot();
  window.addEventListener('resize', sizeFoot);
  if (document.fonts) document.fonts.ready.then(sizeFoot);

  /* ---------- Hero Ken Burns (simulated showreel) ---------- */
  const kb = $$('.kb img');
  const startKB = () => {
    if (!hasG || RM) return;
    let i = 0;
    gsap.fromTo(kb[0], { scale: 1.12 }, { scale: 1, duration: 7, ease: 'none' });
    setInterval(() => {
      const prev = kb[i]; i = (i + 1) % kb.length; const cur = kb[i];
      gsap.set(cur, { zIndex: 2 }); gsap.set(prev, { zIndex: 1 });
      gsap.killTweensOf(cur);
      cur.classList.add('is-on');
      gsap.fromTo(cur, { scale: 1.14 }, { scale: 1, duration: 7, ease: 'power1.out' });
      gsap.fromTo(cur, { opacity: 0 }, { opacity: 1, duration: 1.4, ease: 'power2.out' });
      gsap.delayedCall(1.5, () => { prev.classList.remove('is-on'); gsap.set(prev, { opacity: 0 }); });
    }, 4600);
  };

  /* ---------- No-GSAP / reduced motion fallback ---------- */
  if (!hasG || RM) {
    $('#loader').remove();
    document.body.classList.remove('is-loading');
    setReveal(1);
    mods.forEach(m => m.addEventListener('click', () => setActive(mods.indexOf(m))));
    showCookie();
    return;
  }

  /* ---------- Lenis ---------- */
  if (typeof Lenis !== 'undefined') {
    const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1 });
    window.lenis = lenis;
    lenis.stop();
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  /* ---------- Loader ---------- */
  const loader = $('#loader'), frame = $('#loaderFrame'), fimgs = $$('img', frame);
  gsap.set('.hero__title .line>span', { yPercent: 110 });
  gsap.set('.hero__sub', { y: 20, opacity: 0 });
  gsap.set('.pills li', { y: 14, opacity: 0 });
  gsap.set('#heroMedia', { clipPath: 'inset(100% 0% 0% 0%)' });
  gsap.set('.hdr', { opacity: 0 });
  let fi = 0, fTimer;
  const tl = gsap.timeline({ delay: 0.2 });
  tl.to('.loader__mask>span', { y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08 })
    .to(frame, { width: () => frame.offsetHeight, duration: 0.7, ease: 'power3.inOut',
      onStart: () => { fimgs[0].classList.add('on'); fTimer = setInterval(() => { fimgs[fi].classList.remove('on'); fi = (fi + 1) % fimgs.length; fimgs[fi].classList.add('on'); }, 230); } }, 0.75)
    .to({}, { duration: 1.25 })
    .add(() => clearInterval(fTimer))
    .to('.loader__word', { y: -30, opacity: 0, duration: 0.5, ease: 'power2.in' })
    .to(loader, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.9, ease: 'power4.inOut' }, '-=0.15')
    .add(() => { document.body.classList.remove('is-loading'); if (window.lenis) lenis.start(); startKB(); showCookie(); }, '-=0.4')
    .to('.hdr', { opacity: 1, duration: 0.6 }, '-=0.5')
    .to('#heroMedia', { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'power4.out' }, '-=0.55')
    .to('.hero__title .line>span', { yPercent: 0, duration: 1, ease: 'power4.out', stagger: 0.1 }, '<0.1')
    .to('.hero__sub', { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }, '<0.3')
    .to('.pills li', { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out', stagger: 0.05 }, '<0.15')
    .add(() => loader.remove());

  /* ---------- Scroll triggers ---------- */
  // split headings reveal
  $$('.split').forEach(el => {
    gsap.from($$('.w>span', el), { yPercent: 110, duration: 1, ease: 'power4.out', stagger: 0.06,
      scrollTrigger: { trigger: el, start: 'top 88%' } });
  });

  const mm = gsap.matchMedia();
  mm.add('(min-width:1024px)', () => {
    // word reveal (sticky)
    const st1 = ScrollTrigger.create({ trigger: '.about-pin', start: 'top top', end: 'bottom bottom', onUpdate: s => setReveal(s.progress) });
    setReveal(0);
    // modules pinned accordion
    const st2 = ScrollTrigger.create({ trigger: '.mods', start: 'top top', end: () => '+=' + window.innerHeight * 0.42 * MODS.length, pin: true, pinSpacing: true,
      onUpdate: s => setActive(Math.min(MODS.length - 1, Math.floor(s.progress * MODS.length))) });
    const clickers = mods.map((m, i) => {
      const fn = (e) => {
        if (e.target.closest('a')) return;
        const y = st2.start + (st2.end - st2.start) * ((i + 0.5) / MODS.length);
        window.lenis ? lenis.scrollTo(y, { duration: 1 }) : window.scrollTo(0, y);
      };
      m.addEventListener('click', fn); return fn;
    });
    return () => { st1.kill(); st2.kill(); mods.forEach((m, i) => m.removeEventListener('click', clickers[i])); };
  });
  mm.add('(max-width:1023px)', () => { setReveal(1); mods.forEach(m => m.classList.add('is-active')); return () => { mods.forEach((m, i) => m.classList.toggle('is-active', i === active)); }; });

  // lab card: auto wipe when in view on touch
  ScrollTrigger.create({ trigger: '.lab__img--wipe', start: 'top 65%', onEnter: () => { if (!window.matchMedia('(hover:hover)').matches) $('.lab__img--wipe').classList.add('auto'); } });

  // fade-up elements
  gsap.utils.toArray('.lab__card, .skill, .contact__card, .clients').forEach(el => {
    gsap.fromTo(el, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
  });
  // contact bg parallax
  gsap.fromTo('.contact__bg', { yPercent: -8 }, { yPercent: 4, ease: 'none', scrollTrigger: { trigger: '.contact', start: 'top bottom', end: 'bottom top', scrub: true } });
  // footer wordmark rise
  gsap.fromTo('.foot__word', { yPercent: 40, opacity: 0.2 }, { yPercent: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: '.foot-clip', start: 'top bottom', end: 'bottom bottom', scrub: true } });

  window.addEventListener('load', () => { sizeFoot(); ScrollTrigger.refresh(); });
})();
