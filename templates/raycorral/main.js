const ORNAT = () => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = typeof window.gsap !== 'undefined';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  if (!hasGsap) { document.body.classList.remove('is-loading'); $('[data-loader]').classList.add('is-done'); return; }

  gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin, CustomEase, Observer);
  CustomEase.create('loader', '0.65, 0.01, 0.05, 0.99');
  CustomEase.create('osmo', 'M0,0 C0.625,0.05 0,1 1,1');
  CustomEase.create('parallax', '0.7, 0.05, 0.13, 1');

  /* ---------------- Lenis ---------------- */
  let lenis = null;
  if (!reduced && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1 });
    window.lenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  const scrollToTarget = (target) => {
    const el = typeof target === 'string' ? $(target) : target;
    if (!el) return;
    let y;
    if (el.id === 'para-quien' || el.id === 'modulos') {
      const hs = $('[data-hscroll]');
      const st = hs && hs._st;
      if (st && innerWidth >= 768) y = el.id === 'modulos' ? st.end : st.start;
    }
    if (y === undefined) y = el.getBoundingClientRect().top + scrollY;
    if (lenis) lenis.scrollTo(y, { duration: 1.6 }); else window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
  };
  $$('[data-scroll-link]').forEach((a) => a.addEventListener('click', (e) => {
    const href = a.getAttribute('href');
    if (!href || !href.startsWith('#')) return;
    e.preventDefault();
    closeMenu();
    scrollToTarget(href);
  }));

  /* ---------------- Menu (mobile) ---------------- */
  const burger = $('[data-burger]'), menu = $('[data-menu]');
  function closeMenu() {
    if (!menu.classList.contains('is-open')) return;
    menu.classList.remove('is-open'); menu.setAttribute('aria-hidden', 'true');
    burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Abrir menú');
    lenis && lenis.start();
  }
  burger.addEventListener('click', () => {
    const open = !menu.classList.contains('is-open');
    if (!open) return closeMenu();
    menu.classList.add('is-open'); menu.setAttribute('aria-hidden', 'false');
    burger.setAttribute('aria-expanded', 'true'); burger.setAttribute('aria-label', 'Cerrar menú');
    lenis && lenis.stop();
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

  /* ---------------- Cursor ---------------- */
  (() => {
    const root = $('[data-cursor]'); if (!root || matchMedia('(hover: none)').matches) return;
    const dot = $('[data-cursor-dot]'), ring = $('[data-cursor-ring]');
    let mx = 0, my = 0, x = 0, y = 0, fx = 0, fy = 0, started = false, theme = null;
    addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
      if (!started) { x = fx = mx; y = fy = my; started = true; root.classList.add('is-on'); }
      const el = document.elementFromPoint(mx, my);
      const t = el && el.closest('[data-cursor-theme]');
      const th = t ? t.getAttribute('data-cursor-theme') : null;
      if (th !== theme) { theme = th; root.classList.toggle('theme-dark', th === 'dark'); }
    }, { passive: true });
    document.addEventListener('mouseover', (e) => { if (e.target.closest('a, button, [data-ls-title]')) root.classList.add('is-hover'); });
    document.addEventListener('mouseout', (e) => { if (e.target.closest('a, button, [data-ls-title]')) root.classList.remove('is-hover'); });
    document.addEventListener('mouseleave', () => root.classList.remove('is-on'));
    document.addEventListener('mouseenter', () => started && root.classList.add('is-on'));
    gsap.ticker.add(() => {
      if (!started) return;
      x += (mx - x) * 0.22; y += (my - y) * 0.22;
      fx += (x - fx) * 0.18; fy += (y - fy) * 0.18;
      dot.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
      ring.style.transform = `translate3d(${fx}px,${fy}px,0) translate(-50%,-50%)`;
    });
  })();

  /* ---------------- Hero setup ---------------- */
  const heroWord = $('.hero__word');
  const split = reduced ? null : new SplitText(heroWord, { type: 'chars', charsClass: 'char' });
  const heroRender = $('[data-hero-render]'), heroHandle = $('[data-hero-handle]');
  const blob = $('[data-blob]');
  gsap.set('[data-hero-art]', { xPercent: -50, x: 0 });
  if (!reduced) {
    gsap.set(split.chars, { yPercent: 105, opacity: 0 });
    gsap.set('[data-hero-fade], .hero__script, .hero__bot', { opacity: 0, y: 14 });
    gsap.set('[data-hero-art]', { yPercent: 8, opacity: 0 });
    // organic blob morph (autonomous, not cursor-driven)
    const shapes = [
      '42% 58% 63% 37% / 41% 44% 56% 59%',
      '58% 42% 38% 62% / 52% 61% 39% 48%',
      '37% 63% 52% 48% / 63% 38% 62% 37%',
      '50% 50% 66% 34% / 38% 56% 44% 62%'
    ];
    const btl = gsap.timeline({ repeat: -1, yoyo: true, defaults: { duration: 4.2, ease: 'sine.inOut' } });
    shapes.slice(1).forEach((s, i) => btl.to(blob, { borderRadius: s, rotation: (i % 2 ? -8 : 10), xPercent: (i - 1) * 9, yPercent: (i % 2 ? 6 : -4) }));
  }

  /* ---------------- Loader ---------------- */
  function heroIntro() {
    if (reduced) return;
    const tl = gsap.timeline();
    tl.to(split.chars, { yPercent: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.045 }, 0)
      .to('.hero__script', { opacity: 1, y: 0, duration: 1, ease: 'expo.out' }, 0.45)
      .to('[data-hero-fade]', { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.08 }, 0.5)
      .to('[data-hero-art]', { yPercent: 0, opacity: 1, duration: 1.4, ease: 'expo.out' }, 0.3)
      .to('.hero__bot', { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out' }, 0.8)
      // sketch -> render wipe
      .set(heroHandle, { opacity: 1 }, 1.3)
      .fromTo(heroRender, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 2.2, ease: 'power2.inOut' }, 1.3)
      .fromTo(heroHandle, { left: '0%' }, { left: '100%', duration: 2.2, ease: 'power2.inOut' }, 1.3)
      .to(heroHandle, { opacity: 0, duration: 0.3 }, 3.4);
  }
  (() => {
    const loader = $('[data-loader]');
    const finish = () => { loader.classList.add('is-done'); document.body.classList.remove('is-loading'); lenis && lenis.start(); ScrollTrigger.refresh(); };
    if (reduced) { finish(); return; }
    const paths = $$('[data-loader-sign] .sign__p');
    const tl = gsap.timeline({ onComplete: finish });
    tl.fromTo(paths, { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.5, ease: 'power2.inOut', stagger: 1.2 })
      .fromTo('[data-loader-line]', { scaleX: 0 }, { scaleX: 1, duration: 2.6, ease: 'loader' }, 0)
      .to('[data-loader-line]', { opacity: 0, duration: 0.25 }, '>')
      .to('[data-loader-sign]', { opacity: 0, y: -12, duration: 0.5, ease: 'power2.in' }, '<')
      .to('[data-loader-bg]', { yPercent: -100, duration: 1.2, ease: 'loader' }, '>-0.05')
      .add(heroIntro, '<0.35');
  })();

  /* ---------------- Hero scroll (sinks under next section) ---------------- */
  if (!reduced) {
    gsap.fromTo('[data-hero-art]', { yPercent: 0 }, {
      yPercent: -10, ease: 'none',
      scrollTrigger: { trigger: '[data-hscroll]', start: 'top bottom', end: 'top top', scrub: true }
    });
  }

  /* ---------------- Layered slider ---------------- */
  (() => {
    const root = $('[data-lslider]'); if (!root) return;
    const titles = $$('[data-ls-title]', root), bgs = $$('[data-ls-bg]', root), mitems = $$('[data-ls-mitem]', root);
    const mask = $('[data-ls-mask]', root), fill = $('[data-ls-fill]', root), cur = $('[data-ls-current]', root), desc = $('[data-ls-desc]', root);
    const count = titles.length; const clamp = gsap.utils.clamp(0, 1);
    const wrap = (d) => d - count * Math.round(d / count);
    let titleStep = 0, maskStep = 0;
    const measure = () => {
      const widest = Math.max(...titles.map((t) => t.offsetWidth));
      titleStep = Math.max(root.clientWidth * 0.5, widest + 40);
      maskStep = mask.clientWidth;
    };
    const state = { progress: 0 }; let active = -1;
    const render = (p) => {
      const ci = ((Math.round(p) % count) + count) % count;
      for (let i = 0; i < count; i++) {
        const off = wrap(i - p), dist = Math.abs(off), o = clamp(1 - dist);
        gsap.set(bgs[i], { opacity: o, zIndex: Math.round(o * 100) });
        gsap.set(titles[i], { x: off * titleStep, xPercent: -50, yPercent: -50, opacity: i === ci ? 1 : 0.4 });
        gsap.set(mitems[i], { x: off * maskStep, zIndex: Math.round(o * 100) });
      }
      if (ci !== active) {
        [bgs, titles, mitems].forEach((l) => { if (active >= 0) l[active].removeAttribute('data-active'); l[ci].setAttribute('data-active', ''); });
        titles.forEach((t, i) => t.setAttribute('aria-current', i === ci ? 'true' : 'false'));
        active = ci; cur.textContent = String(ci + 1).padStart(2, '0');
        desc.textContent = titles[ci].dataset.desc || '';
      }
      gsap.set(fill, { scaleX: (ci + 1) / count });
    };
    measure(); render(0);
    let tween = null, timer = null, hovering = false;
    const go = (target) => {
      tween && tween.kill();
      if (reduced) { state.progress = target; render(target); return; }
      tween = gsap.to(state, { progress: target, duration: 1, ease: 'osmo', onUpdate: () => render(state.progress) });
    };
    const step = (d) => { go(Math.round(state.progress) + d); restart(); };
    const restart = () => { clearInterval(timer); if (reduced) return; timer = setInterval(() => { if (!hovering && !document.hidden && inView) go(Math.round(state.progress) + 1); }, 5000); };
    $('[data-ls-next]', root).addEventListener('click', () => step(1));
    $('[data-ls-prev]', root).addEventListener('click', () => step(-1));
    titles.forEach((t, i) => t.addEventListener('click', () => { const base = Math.round(state.progress); go(base + wrap(i - base)); restart(); }));
    root.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1); });
    [...titles, ...$$('button', root)].forEach((el) => { el.addEventListener('mouseenter', () => hovering = true); el.addEventListener('mouseleave', () => hovering = false); });
    let inView = false;
    ScrollTrigger.create({ trigger: root, start: 'top 80%', end: 'bottom top', onToggle: (s) => inView = s.isActive });
    Observer.create({ target: root, type: 'touch,pointer', dragMinimum: 30, tolerance: 30, lockAxis: true,
      onLeft: () => step(1), onRight: () => step(-1), ignore: 'button' });
    addEventListener('resize', () => { measure(); render(state.progress); });
    restart();
  })();

  /* ---------------- Horizontal scroll (desktop) ---------------- */
  const mm = gsap.matchMedia();
  mm.add('(min-width: 768px)', () => {
    const hs = $('[data-hscroll]'), track = $('[data-htrack]');
    const dist = () => track.scrollWidth - innerWidth;
    const tl = gsap.timeline({ scrollTrigger: { trigger: hs, start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true } });
    tl.to({}, { duration: 0.45 }).to(track, { x: () => -dist(), ease: 'none', duration: 1 }).to({}, { duration: 0.25 });
    hs._st = { get start() { return tl.scrollTrigger.start; }, get end() { return tl.scrollTrigger.start + (tl.scrollTrigger.end - tl.scrollTrigger.start) * (1.45 / 1.7); } };
    return () => { hs._st = null; };
  });

  /* ---------------- About: marquee + badge + highlight ---------------- */
  if (!reduced) {
    const mq = $('[data-marquee]');
    mm.add('(min-width: 768px)', () => {
      gsap.fromTo(mq, { x: 0 }, { x: () => -(mq.scrollWidth - innerWidth) * 0.55, ease: 'none', scrollTrigger: { trigger: '.about', start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true } });
    });
    mm.add('(max-width: 767px)', () => {
      gsap.fromTo(mq, { x: 0 }, { x: () => -(mq.scrollWidth - innerWidth), ease: 'none', scrollTrigger: { trigger: '.about', start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true } });
    });
    gsap.fromTo('[data-badge]', { rotation: 0 }, { rotation: 300, ease: 'none', scrollTrigger: { trigger: '.about', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.to('[data-badge]', { rotation: '+=360', duration: 30, repeat: -1, ease: 'none' });

    $$('[data-highlight]').forEach((el) => {
      const inAbout = el.closest('.about');
      new SplitText(el, { type: 'words, chars', autoSplit: true, onSplit(self) {
        return gsap.from(self.chars, {
          autoAlpha: 0.2, stagger: 0.1, ease: 'linear',
          scrollTrigger: inAbout && innerWidth >= 768
            ? { trigger: '.about', start: 'top 20%', end: 'bottom bottom', scrub: true }
            : { trigger: el, start: 'top 85%', end: 'bottom 45%', scrub: true }
        });
      } });
    });
  }

  /* ---------------- Arc transitions ---------------- */
  if (!reduced) {
    $$('[data-arc]').forEach((wrap) => {
      const path = $('[data-arc-path]', wrap); const mode = wrap.dataset.mode === 'reveal' ? 'reveal' : 'cover';
      const section = wrap.parentElement; const st = { p: 0 };
      const depth = () => 12 * (section.clientWidth / innerHeight);
      const draw = (p) => {
        const fill = mode === 'cover' ? p : 1 - p; const curve = depth() * Math.sin(fill * Math.PI);
        if (mode === 'cover') { const e = 100 - 100 * fill, c = e - curve * 2; path.setAttribute('d', `M0 100 L0 ${e} Q50 ${c} 100 ${e} L100 100 Z`); }
        else { const e = 100 * fill, c = e + curve * 2; path.setAttribute('d', `M0 0 L0 ${e} Q50 ${c} 100 ${e} L100 0 Z`); }
      };
      draw(0);
      gsap.to(st, { p: 1, ease: 'none', onUpdate: () => draw(st.p), scrollTrigger: {
        trigger: section, start: mode === 'cover' ? 'bottom bottom' : 'top bottom', end: mode === 'cover' ? 'bottom top' : 'top top', scrub: 0.3 } });
    });
  }

  /* ---------------- CTA parallax ---------------- */
  if (!reduced) gsap.fromTo('[data-cta-bg]', { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom top', scrub: true } });

  /* ---------------- Footer parallax + signature ---------------- */
  if (!reduced) {
    const tl = gsap.timeline({ scrollTrigger: { trigger: '[data-footer]', start: 'clamp(top bottom)', end: 'clamp(top top)', scrub: true } });
    tl.fromTo('[data-footer-inner]', { yPercent: -25 }, { yPercent: 0, ease: 'linear' })
      .fromTo('[data-footer-dark]', { opacity: 0.5 }, { opacity: 0, ease: 'linear' }, '<');
    gsap.timeline({ scrollTrigger: { trigger: '[data-draw-wrap]', start: 'clamp(top bottom)', end: 'clamp(bottom bottom)', scrub: true } })
      .fromTo('[data-draw]', { drawSVG: '0%' }, { drawSVG: '100%', ease: 'linear', stagger: 0.6, duration: 1 });
  }

  /* ---------------- Reveal for blocks ---------------- */
  if (!reduced) {
    $$('.scard, .step4, .prow, .incl li, .slist li').forEach((el) => {
      gsap.fromTo(el, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 92%', once: true, containerAnimation: undefined } });
    });
  }

  /* ---------------- Videos: play only in view ---------------- */
  $$('video').forEach((v) => {
    if (reduced) { v.removeAttribute('autoplay'); v.pause(); return; }
    ScrollTrigger.create({ trigger: v, start: 'top bottom', end: 'bottom top', onToggle: (s) => s.isActive ? v.play().catch(() => {}) : v.pause() });
  });

  /* ---------------- Nav active state ---------------- */
  const links = $$('[data-nav-link]');
  const setActive = (id) => links.forEach((l) => l.classList.toggle('is-active', l.dataset.navLink === id));
  $$('[data-section]').forEach((sec) => {
    const id = sec.dataset.section;
    const trig = id === 'para-quien' ? '[data-hscroll]' : sec;
    ScrollTrigger.create({ trigger: trig, start: 'top 50%', end: 'bottom 50%', onToggle: (s) => s.isActive && setActive(id) });
  });

  /* ---------------- Clock ---------------- */
  const clock = $('[data-clock]');
  const fmt = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Cancun', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const tick = () => { clock.textContent = fmt.format(new Date()); };
  tick(); setInterval(tick, 1000);

  addEventListener('load', () => ScrollTrigger.refresh());
};
const fontsReady = document.fonts && document.fonts.ready ? Promise.race([Promise.all([document.fonts.load('700 100px "Inter Tight"'), document.fonts.load('500 16px "Inter Tight"'), document.fonts.load('400 40px "Mrs Saint Delafield"')]).then(() => document.fonts.ready), new Promise((r) => setTimeout(r, 2500))]).catch(() => {}) : Promise.resolve();
fontsReady.then(ORNAT);
