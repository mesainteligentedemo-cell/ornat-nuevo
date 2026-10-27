(() => {
  const html = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const hasGsap = typeof window.gsap !== 'undefined';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = () => window.innerWidth <= 767;

  /* ---------------- fallback without libraries ---------------- */
  if (!hasGsap) {
    html.classList.add('revealed', 'entered');
    $$('[data-go]').forEach(a => a.addEventListener('click', () => {}));
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  /* ---------------- Lenis ---------------- */
  let lenis = null;
  if (typeof window.Lenis !== 'undefined' && !reduce) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const stopScroll = () => { lenis && lenis.stop(); };
  const startScroll = () => { lenis && lenis.start(); };

  const absTop = el => { let y = 0; while (el) { y += el.offsetTop; el = el.offsetParent; } return y; };
  const goTo = (target, immediate) => {
    const el = typeof target === 'string' ? $(target) : target;
    if (!el) return;
    const y = el.id === 'top' ? 0 : absTop(el);
    if (lenis) lenis.scrollTo(y, immediate ? { immediate: true, force: true } : { duration: 1.6, force: true });
    else window.scrollTo({ top: y, behavior: immediate ? 'auto' : 'smooth' });
  };

  /* ---------------- header theme ---------------- */
  const hdr = $('#hdr');
  const zones = $$('[data-hdr]');
  const setHeader = () => {
    const line = 23; let theme = 'light';
    for (const z of zones) { const r = z.getBoundingClientRect(); if (r.top <= line && r.bottom > line) theme = z.dataset.hdr; }
    hdr.classList.toggle('is-dark', theme === 'dark');
    hdr.classList.toggle('is-light', theme === 'light');
  };
  if (lenis) lenis.on('scroll', setHeader); else window.addEventListener('scroll', setHeader, { passive: true });
  window.addEventListener('resize', setHeader);
  setHeader();

  /* ---------------- hero title ---------------- */
  const heroWords = $$('.hero-t .w');
  const heroCh = $$('.hero-ch li, .hero-scroll');
  const playHero = (delay = 0) => {
    gsap.fromTo(heroWords, { x: () => gsap.utils.random(-300, 300), opacity: 0 }, { x: 0, opacity: 1, duration: 2.4, ease: 'expo.out', stagger: 0.04, delay });
    gsap.fromTo(heroCh, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 1.6, ease: 'expo.out', stagger: 0.06, delay: delay + 0.2, clearProps: 'transform' });
  };

  /* ---------------- portal ---------------- */
  const portal = $('#portal');
  let entered = false;
  const finishEnter = () => {
    html.classList.add('entered');
    html.classList.remove('locked');
    startScroll();
    ScrollTrigger.refresh();
    setHeader();
  };

  const enter = (path, opts = {}) => {
    if (entered) return; entered = true;
    try { sessionStorage.setItem('ornat-path', path); } catch (e) {}
    const target = path === 'automatizacion' ? '#automatizacion' : (opts.hash || '#top');
    html.classList.remove('locked');
    html.classList.add('revealed');
    ScrollTrigger.refresh();
    goTo(target, true);
    setHeader();
    if (opts.instant || reduce) {
      gsap.set(heroWords, { opacity: 1, x: 0 });
      finishEnter();
      return;
    }
    stopScroll();
    const iris = document.createElement('div'); iris.className = 'iris'; document.body.appendChild(iris);
    const atTop = target === '#top';
    const tl = gsap.timeline({ defaults: { duration: 2.4, ease: 'expo.inOut' }, onComplete: () => { iris.remove(); finishEnter(); } });
    tl.to(portal, { opacity: 0, duration: 0.8, ease: 'expo.out' }, 0)
      .fromTo(iris, { width: 0, height: 0 }, { width: '100vw', height: '100vh' }, 0)
      .from(hdr, { yPercent: -100, duration: 1.6, ease: 'expo.out', clearProps: 'transform' }, 1.2);
    if (atTop) {
      tl.from('.hero-bg img', { scale: 0.5, duration: 2.8, clearProps: 'transform' }, 0);
      tl.call(() => playHero(0), [], 0.8);
    } else {
      gsap.set(heroWords, { opacity: 1, x: 0 });
    }
  };

  if (portal && html.classList.contains('js')) {
    html.classList.add('locked');
    stopScroll();
    gsap.set(heroWords, { opacity: 0 });
    const hash = location.hash && location.hash.length > 1 ? location.hash : '';
    let hashTarget = null;
    try { hashTarget = hash ? document.querySelector(hash) : null; } catch (e) { hashTarget = null; }
    if (hashTarget) {
      requestAnimationFrame(() => enter(hash === '#automatizacion' ? 'automatizacion' : 'diseno', { instant: true, hash }));
    } else {
      // intro animation
      const m = isMobile();
      const intro = gsap.timeline({ defaults: { duration: 1.2, ease: 'power4.out' } });
      intro.from('.portal-brand span', { yPercent: 100, stagger: 0.04 }, 0)
        .from('.portal-brand', { y: () => window.innerHeight * 0.32, ease: 'expo.inOut', duration: 2.2 }, 0.35)
        .from('.p-inner', { scale: 0.4, yPercent: i => (i === 0 ? 50 : -40) * (m ? -1 : 1), duration: 2.2, ease: 'expo.inOut' }, 0.5)
        .from('.p-bg', { clipPath: 'inset(90% 91% 92% 93%)', duration: 2.2, ease: 'power4.inOut' }, 0.4)
        .from('.p-bg img', { scale: 1.3, duration: 2.4 }, 0.4)
        .from('.p-label', { yPercent: 250, opacity: 0, stagger: 0.25 }, 1.6)
        .from('.p-skip', { opacity: 0, duration: 1 }, 2);

      $$('.p-btn', portal).forEach(btn => {
        btn.addEventListener('click', e => { e.preventDefault(); intro.progress(1); enter(btn.dataset.path); });
        const box = $('.p-visuals', btn); const imgs = $$('img', box);
        let tl = null, z = 1;
        btn.addEventListener('mouseenter', () => {
          if (isMobile()) return;
          gsap.killTweensOf([box, ...imgs]);
          tl && tl.kill();
          tl = gsap.timeline({ defaults: { duration: 1.8, ease: 'expo.out' } });
          tl.to(box, { clipPath: 'inset(0% 0% 0% 0%)', rotate: 0, opacity: 1 }, 0);
          imgs.forEach((im, i) => { im.style.zIndex = i; });
          z = imgs.length;
          tl.fromTo(imgs, { scale: 0 }, { scale: 1.0003, stagger: { each: 1.2, repeat: -1, onRepeat() { this.targets()[0].style.zIndex = ++z; } } }, 0);
        });
        btn.addEventListener('mouseleave', () => {
          if (isMobile()) return;
          tl && tl.kill();
          gsap.to(box, { clipPath: 'inset(90% 91% 92% 93%)', rotate: -4, opacity: 0, duration: 1, ease: 'expo.out' });
        });
      });
      // don't trap the user: scroll, swipe, keys or the skip link enter the site
      $('#pskip').addEventListener('click', () => { intro.progress(1); enter('diseno'); });
      portal.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > 12) { intro.progress(1); enter('diseno'); } }, { passive: true });
      let ty = null;
      portal.addEventListener('touchstart', e => { ty = e.touches[0].clientY; }, { passive: true });
      portal.addEventListener('touchmove', e => { if (ty !== null && ty - e.touches[0].clientY > 40) { ty = null; intro.progress(1); enter('diseno'); } }, { passive: true });
      window.addEventListener('keydown', e => {
        if (entered) return;
        if (['ArrowDown', 'PageDown', ' ', 'Escape', 'End'].includes(e.key)) { e.preventDefault(); intro.progress(1); enter('diseno'); }
      });
    }
  } else {
    html.classList.add('revealed', 'entered');
  }

  /* ---------------- submenu ---------------- */
  const sub = $('#sub');
  const subBtns = $$('[data-sub]');
  const mplus = $('#mplus');
  const subImg = $('.sub-vis img');
  const openSub = which => {
    sub.dataset.show = which;
    sub.classList.add('is-open'); sub.setAttribute('aria-hidden', 'false');
    subBtns.forEach(b => b.setAttribute('aria-expanded', String(b.dataset.sub === which)));
    mplus.setAttribute('aria-expanded', String(which === 'all'));
    stopScroll();
    gsap.fromTo($$('.sub-grp:not([style*="none"]) .sub-list li', sub), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'power4.out', stagger: 0.04, delay: 0.2 });
  };
  const closeSub = () => {
    if (!sub.classList.contains('is-open')) return;
    sub.classList.remove('is-open'); sub.setAttribute('aria-hidden', 'true');
    subBtns.forEach(b => b.setAttribute('aria-expanded', 'false'));
    mplus.setAttribute('aria-expanded', 'false');
    if (entered || html.classList.contains('entered')) startScroll();
  };
  subBtns.forEach(b => b.addEventListener('click', () => {
    if (sub.classList.contains('is-open') && sub.dataset.show === b.dataset.sub) closeSub(); else openSub(b.dataset.sub);
  }));
  mplus.addEventListener('click', () => { sub.classList.contains('is-open') ? closeSub() : openSub('all'); });
  $$('[data-close]', sub).forEach(el => el.addEventListener('click', closeSub));
  window.addEventListener('keydown', e => { if (e.key === 'Escape') closeSub(); });
  $$('.sub-list a[data-img]').forEach(a => a.addEventListener('mouseenter', () => { subImg.removeAttribute('srcset'); subImg.removeAttribute('sizes'); subImg.src = a.dataset.img; }));

  /* ---------------- anchors ---------------- */
  $$('[data-go]').forEach(a => a.addEventListener('click', e => {
    const href = a.getAttribute('href');
    if (!href || href[0] !== '#') return;
    e.preventDefault();
    const wasOpen = sub.classList.contains('is-open');
    closeSub();
    setTimeout(() => goTo(href), wasOpen ? 250 : 0);
  }));

  /* ---------------- scroll animations ---------------- */
  // stacking sections
  $$('.st').forEach(st => {
    const vis = $('.st-vis', st), c = $('.st-c', st), fade = $('.st-fade', st);
    gsap.timeline({ defaults: { ease: 'none', duration: 1 }, scrollTrigger: { trigger: st, start: 'bottom bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true } })
      .fromTo(st, { yPercent: 0 }, { yPercent: 50 })
      .fromTo(vis, { rotate: 0, yPercent: 0 }, { rotate: -5, yPercent: -50 }, '<')
      .fromTo(c, { yPercent: 0 }, { yPercent: -100 }, '<')
      .fromTo(fade, { opacity: 0 }, { opacity: 1, duration: 0.5 }, '<+=0.5');
    // image tilts in as the section arrives
    gsap.fromTo(vis, { rotate: 4, yPercent: 18 }, { rotate: 0, yPercent: 0, ease: 'none', scrollTrigger: { trigger: st, start: 'top bottom', end: 'top top', scrub: true } });
  });

  // parallax visuals
  $$('.prllx').forEach(p => {
    const v = $('.visual', p); if (!v) return;
    const from = parseFloat(p.dataset.from || -8), to = parseFloat(p.dataset.to || 8);
    gsap.fromTo(v, { yPercent: from }, { yPercent: to, ease: 'none', scrollTrigger: { trigger: p, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true } });
  });

  // sketch -> render wipe
  const wipe = $('#wipe');
  if (wipe) gsap.fromTo('.wipe-rd', { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', scrollTrigger: { trigger: wipe, start: 'top 80%', end: 'center 35%', scrub: true } });

  // reveals
  $$('.reveal').forEach(el => {
    gsap.from(el, { y: 40, opacity: 0, duration: 1.4, ease: 'power4.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  });

  // steps
  $$('.step').forEach(s => {
    gsap.timeline({ defaults: { ease: 'power4.out', duration: 1 }, scrollTrigger: { trigger: s, start: 'top bottom', end: 'top 55%', scrub: true } })
      .fromTo($('.step-n', s), { yPercent: -150 }, { yPercent: 0 })
      .fromTo($('.step-c', s), { xPercent: 20, opacity: 0 }, { xPercent: 0, opacity: 1 }, '<');
  });

  // module cards & method items
  ScrollTrigger.batch('.card, .meth-grid li', {
    start: 'top 92%', once: true,
    onEnter: b => gsap.from(b, { y: 60, opacity: 0, duration: 1.4, ease: 'power4.out', stagger: 0.08 })
  });

  // reel frame scale-in
  const frame = $('#reelFrame');
  if (frame) gsap.fromTo(frame, { scale: 0.86 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: frame, start: 'top bottom', end: 'center center', scrub: true } });

  // cta portrait
  gsap.fromTo('.cta-p', { yPercent: 10, rotate: 3 }, { yPercent: -4, rotate: 0, ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom top', scrub: true } });

  // footer object follows pointer + floats
  const fobj = $('#fobj');
  if (fobj) {
    gsap.set(fobj, { transformPerspective: 600 });
    gsap.to(fobj, { y: -12, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    const rx = gsap.quickTo(fobj, 'rotationX', { duration: 1.2, ease: 'power3.out' });
    const ry = gsap.quickTo(fobj, 'rotationY', { duration: 1.2, ease: 'power3.out' });
    window.addEventListener('pointermove', e => { ry((e.clientX / window.innerWidth - 0.5) * 50); rx((e.clientY / window.innerHeight - 0.5) * -30); }, { passive: true });
  }
  gsap.from('.ftr-word', { yPercent: 60, ease: 'none', scrollTrigger: { trigger: '.ftr', start: 'top bottom', end: 'bottom bottom', scrub: true } });

  /* ---------------- video ---------------- */
  const reel = $('#reel');
  if (reel) {
    reel.muted = true;
    const io = new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting) { const p = reel.play(); p && p.catch(() => {}); } else reel.pause();
    }), { threshold: 0.15 });
    io.observe(reel);
  }

  /* ---------------- refresh ---------------- */
  window.addEventListener('load', () => { ScrollTrigger.refresh(); setHeader(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
})();
