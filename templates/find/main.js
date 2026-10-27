(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  /* ---------- smooth scroll ---------- */
  let lenis = null;
  if (!reduce && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ duration: 1.15, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    if (hasGsap) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }

  /* ---------- header + menu ---------- */
  const hdr = $('#hdr');
  const onScroll = () => hdr.classList.toggle('is-scrolled', window.scrollY > 30);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const burger = $('#burger');
  const drawer = $('#drawer');
  const setMenu = open => {
    document.body.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    drawer.setAttribute('aria-hidden', String(!open));
    if (lenis) open ? lenis.stop() : lenis.start();
  };
  burger.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      const el = id.length > 1 ? document.querySelector(id) : null;
      if (!el && id !== '#top') return;
      e.preventDefault();
      setMenu(false);
      const target = id === '#top' ? 0 : el;
      const offset = -(parseInt(getComputedStyle(document.documentElement).getPropertyValue('--hh')) || 64) + 1;
      if (lenis) lenis.scrollTo(target, { offset: target === 0 ? 0 : offset, duration: 1.4 });
      else window.scrollTo({ top: target === 0 ? 0 : el.getBoundingClientRect().top + window.scrollY + offset, behavior: reduce ? 'auto' : 'smooth' });
    });
  });

  /* ---------- newsletter ---------- */
  const news = $('#news');
  news.addEventListener('submit', e => {
    e.preventDefault();
    news.innerHTML = '<p>Gracias. Nuestro equipo te contactará muy pronto.</p>';
  });

  /* ---------- video ---------- */
  const vid = $('#reelVideo');
  if (vid) {
    vid.muted = true;
    const tryPlay = () => { const p = vid.play(); if (p && p.catch) p.catch(() => {}); };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => es.forEach(en => en.isIntersecting ? tryPlay() : vid.pause()), { threshold: .15 }).observe(vid);
    } else tryPlay();
  }

  /* ---------- modules carousel ---------- */
  const dots = $$('#modDots button');
  const slides = $$('#modSlides article');
  const imgs = $$('#modMedia img');
  const num = $('#modNum');
  let cur = 0, timer = null;
  const go = i => {
    cur = (i + slides.length) % slides.length;
    [dots, slides, imgs].forEach(list => list.forEach((el, k) => el.classList.toggle('on', k === cur)));
    dots.forEach((d, k) => d.setAttribute('aria-selected', String(k === cur)));
    num.textContent = String(cur + 1).padStart(2, '0') + ' / 09';
  };
  const auto = () => { clearInterval(timer); timer = setInterval(() => go(cur + 1), 5200); };
  dots.forEach((d, k) => d.addEventListener('click', () => { go(k); auto(); }));
  const mods = $('#modulos');
  mods.addEventListener('mouseenter', () => clearInterval(timer));
  mods.addEventListener('mouseleave', auto);
  auto();

  /* ---------- split words ---------- */
  $$('.reveal-words').forEach(el => {
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part));
            else { const s = document.createElement('span'); s.className = 'w'; s.textContent = part; frag.appendChild(s); }
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
      });
    };
    walk(el);
  });

  const word = $('.ftr-word');
  if (word) word.innerHTML = [...word.textContent].map(c => `<span class="ch">${c}</span>`).join('');

  if (!hasGsap || reduce) {
    $$('.reveal-words .w').forEach(w => (w.style.opacity = 1));
    const m = $('#mark'); if (m) m.style.opacity = 0;
    return;
  }

  /* ---------- hero ---------- */
  const mm = gsap.matchMedia();
  gsap.set('#villa', { xPercent: -50, x: 0 });
  gsap.set('#clouds', { yPercent: 100, y: 0 });
  const heroTl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom bottom', scrub: 0.8, invalidateOnRefresh: true }
  });
  heroTl
    .to('#heroCue', { opacity: 0, duration: .8 }, 0)
    .to('.sky', { scale: 1.12, yPercent: -3, duration: 10 }, 0)
    .to('.hero-sub, .hero-copy .pill', { opacity: 0, y: -24, duration: 1.4 }, 0)
    .to('#heroTitle', { '--fa': 0, '--st': .95, letterSpacing: '-0.01em', scale: 1.1, y: -30, duration: 2.6 }, 0)
    .to('#heroTitle', { opacity: 0, duration: 1 }, 2.6)
    .fromTo('#villa', { y: 0, scale: 1 }, { y: () => -window.innerHeight * 0.4, scale: 1.24, duration: 4.4 }, 0)
    .to('#villa', { opacity: 0, filter: 'blur(6px)', duration: 1.2 }, 2.7)
    .fromTo('#mark', { opacity: 0, scale: 1.22 }, { opacity: 1, scale: 1, duration: 2, ease: 'power1.out' }, 3.2)
    .fromTo('#markWord', { backgroundPosition: '50% 85%' }, { backgroundPosition: '50% 20%', duration: 7 }, 3.2)
    .fromTo('#markSub', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1.4 }, 4.2)
    .fromTo('#clouds', { yPercent: 100 }, { yPercent: -18, duration: 3, ease: 'power1.inOut' }, 7)
    .to('#mark', { opacity: 0, y: -50, duration: 1 }, 8.8)
    .to('#whiteout', { opacity: 1, duration: .8 }, 9.4);

  /* ---------- word reveals ---------- */
  $$('.reveal-words').forEach(el => {
    gsap.to($$('.w', el), {
      opacity: 1, stagger: .06, ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 96%', end: 'bottom 58%', scrub: true }
    });
  });

  /* ---------- reel expand ---------- */
  mm.add('(min-width: 761px)', () => {
    gsap.fromTo('#reelFrame', { clipPath: 'inset(12% 28% 12% 28% round 22px)' }, {
      clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none',
      scrollTrigger: { trigger: '#reel', start: 'top bottom', end: 'center center', scrub: true }
    });
  });
  mm.add('(max-width: 760px)', () => {
    gsap.fromTo('#reelFrame', { clipPath: 'inset(14% 14% 14% 14% round 18px)' }, {
      clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none',
      scrollTrigger: { trigger: '#reel', start: 'top bottom', end: 'center center', scrub: true }
    });
  });
  gsap.from('.reel-side', {
    opacity: 0, y: 20, stagger: .15, ease: 'none',
    scrollTrigger: { trigger: '#reel', start: '52% center', end: '62% center', scrub: true }
  });

  /* ---------- chevrons ---------- */
  gsap.from('.chv', {
    xPercent: -45, opacity: 0, stagger: .12, duration: 1.1, ease: 'power3.out',
    scrollTrigger: { trigger: '#chevRow', start: 'top 82%' }
  });
  gsap.fromTo('.chv img', { scale: 1.25 }, {
    scale: 1, ease: 'none',
    scrollTrigger: { trigger: '#chevRow', start: 'top bottom', end: 'bottom top', scrub: true }
  });

  /* ---------- simple rises ---------- */
  const rise = (sel, trig, opts = {}) => gsap.from(sel, Object.assign({
    y: 34, opacity: 0, duration: 1, stagger: .09, ease: 'power3.out',
    scrollTrigger: { trigger: trig || sel, start: 'top 85%' }
  }, opts));
  rise('.step-list li', '.step-list');
  rise('.proc-list li', '.proc-list', { stagger: .05 });
  rise('.mcard', '.mani-cards', { y: 60, stagger: .12 });
  rise('.terr-cols > div', '.terr-cols', { stagger: .06 });
  rise('.mods-body', '.mods-body', { y: 50 });
  $$('.srow').forEach(r => {
    gsap.from($('.srow-w', r), { yPercent: 40, opacity: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: r, start: 'top 82%' } });
    gsap.from($('.srow-l', r), { y: 24, opacity: 0, duration: 1, delay: .1, ease: 'power3.out', scrollTrigger: { trigger: r, start: 'top 82%' } });
  });

  /* ---------- parallax ---------- */
  $$('.pf').forEach(f => {
    const s = parseFloat(f.dataset.speed) || 0;
    gsap.fromTo(f, { y: -s }, { y: s, ease: 'none', scrollTrigger: { trigger: '.para-grid', start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  gsap.fromTo('.cta-bg', { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.from('.cta-in > *', { y: 30, opacity: 0, stagger: .1, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.cta', start: 'top 60%' } });

  /* ---------- footer wordmark ---------- */
  gsap.from('.ftr-word .ch', {
    yPercent: 60, opacity: 0, stagger: .06, duration: 1.1, ease: 'power3.out',
    scrollTrigger: { trigger: '.ftr-word', start: 'top 95%' }
  });

  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
