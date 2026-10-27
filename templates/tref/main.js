(() => {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  /* ---------- Lenis ---------- */
  let lenis = null;
  if (!reduce && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ duration: 1.2, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    if (hasGsap) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
    lenis.stop();
  }
  const scrollToTarget = target => {
    if (lenis) lenis.scrollTo(target, { duration: 1.5, offset: target === 0 ? 0 : -70 });
    else if (target === 0) window.scrollTo({ top: 0, behavior: 'smooth' });
    else target.scrollIntoView({ behavior: 'smooth' });
  };

  /* ---------- loader ---------- */
  const body = document.body;
  const loader = document.getElementById('loader');
  const bannerBlock = document.querySelector('.banner-block');
  const finishLoader = () => {
    body.classList.remove('is-loading');
    if (loader) loader.classList.add('hide');
    if (lenis) lenis.start();
    if (hasGsap) ScrollTrigger.refresh();
  };
  if (reduce || !loader) {
    bannerBlock && bannerBlock.classList.add('vis');
    finishLoader();
  } else {
    setTimeout(() => {
      loader.classList.add('animate');
      setTimeout(() => bannerBlock && bannerBlock.classList.add('vis'), 1000);
      setTimeout(finishLoader, 1900);
    }, 1500);
  }

  /* ---------- header ---------- */
  const header = document.getElementById('header');
  const banner = document.querySelector('.banner');
  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('is-solid', y > (banner ? banner.offsetHeight - 120 : 200));
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* active nav link */
  const navLinks = [...document.querySelectorAll('.nav-l a, .nav-r a:not(.tel)')];
  const sections = navLinks.map(a => document.querySelector(a.getAttribute('href') === '#top' ? '.banner' : a.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const idx = sections.indexOf(e.target);
        navLinks.forEach((a, i) => a.classList.toggle('is-active', i === idx));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(s => io.observe(s));
  }

  /* ---------- mobile nav ---------- */
  const mobBtn = document.getElementById('mobBtn');
  const mobNav = document.getElementById('mobNav');
  const setMenu = open => {
    mobBtn.classList.toggle('active', open);
    mobNav.classList.toggle('vis', open);
    mobBtn.setAttribute('aria-expanded', String(open));
    mobBtn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    if (lenis) open ? lenis.stop() : lenis.start();
  };
  mobBtn.addEventListener('click', () => setMenu(!mobBtn.classList.contains('active')));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && mobBtn.classList.contains('active')) setMenu(false); });

  /* anchors */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const el = id === '#top' ? 0 : document.querySelector(id);
      if (el === null) return;
      e.preventDefault();
      const wasOpen = mobBtn.classList.contains('active');
      if (wasOpen) setMenu(false);
      setTimeout(() => scrollToTarget(el), wasOpen ? 380 : 0);
    });
  });

  /* ---------- hero slider (fade) ---------- */
  const slides = [...document.querySelectorAll('#slider .slide')];
  let cur = 0, timer = null;
  const go = n => {
    slides[cur].classList.remove('is-on');
    cur = (n + slides.length) % slides.length;
    slides[cur].classList.add('is-on');
  };
  const auto = () => { clearInterval(timer); timer = setInterval(() => go(cur + 1), 6500); };
  document.getElementById('prev').addEventListener('click', () => { go(cur - 1); auto(); });
  document.getElementById('next').addEventListener('click', () => { go(cur + 1); auto(); });
  if (!reduce) setTimeout(auto, 3000);

  /* ---------- accordion ---------- */
  document.querySelectorAll('#terr .terr-row').forEach(btn => {
    btn.addEventListener('click', () => {
      const li = btn.parentElement;
      const open = !li.classList.contains('is-open');
      li.parentElement.querySelectorAll(':scope > li').forEach(o => {
        o.classList.remove('is-open');
        o.querySelector('.terr-row').setAttribute('aria-expanded', 'false');
      });
      if (open) { li.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true'); }
      setTimeout(() => hasGsap && ScrollTrigger.refresh(), 650);
    });
  });

  /* ---------- reel ---------- */
  const video = document.getElementById('reelVideo');
  const toggle = document.getElementById('reelToggle');
  const setToggle = () => {
    const paused = video.paused;
    toggle.classList.toggle('is-paused', paused);
    toggle.querySelector('.lbl').textContent = paused ? 'Reproducir' : 'Pausa';
    toggle.setAttribute('aria-label', paused ? 'Reproducir video' : 'Pausar video');
  };
  let userPaused = false;
  toggle.addEventListener('click', () => {
    if (video.paused) { userPaused = false; video.play().catch(() => {}); }
    else { userPaused = true; video.pause(); }
  });
  video.addEventListener('play', setToggle);
  video.addEventListener('pause', setToggle);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { if (!userPaused) video.play().catch(() => {}); }
      else video.pause();
    }, { threshold: .15 }).observe(video);
  }

  /* ---------- contact form -> WhatsApp ---------- */
  const form = document.getElementById('demoForm');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const d = new FormData(form);
    const nombre = (d.get('nombre') || '').toString().trim();
    const note = document.getElementById('formNote');
    if (!nombre) { note.textContent = 'Escribe tu nombre para continuar.'; form.querySelector('input[name=nombre]').focus(); return; }
    const parts = ['Hola ORNAT, quiero solicitar una demo.', 'Nombre: ' + nombre];
    ['correo', 'telefono', 'mensaje'].forEach(k => { const v = (d.get(k) || '').toString().trim(); if (v) parts.push(k.charAt(0).toUpperCase() + k.slice(1) + ': ' + v); });
    window.open('https://wa.me/529842353159?text=' + encodeURIComponent(parts.join('\n')), '_blank', 'noopener');
    note.textContent = '¡Gracias! Nuestro equipo te contactará muy pronto.';
  });

  if (!hasGsap) {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('animate'));
    document.querySelectorAll('.line-dash').forEach(el => el.classList.add('animate'));
    return;
  }

  /* ================= GSAP ================= */
  gsap.registerPlugin(ScrollTrigger);

  /* reveal on enter */
  document.querySelectorAll('.reveal').forEach(el => {
    ScrollTrigger.create({ trigger: el, start: 'top 85%', once: true, onEnter: () => el.classList.add('animate') });
  });
  document.querySelectorAll('.line-reveal').forEach(sec => {
    const line = sec.querySelector(':scope > .line-dash');
    if (line) ScrollTrigger.create({ trigger: sec, start: 'top 55%', once: true, onEnter: () => line.classList.add('animate') });
  });

  if (reduce) {
    document.querySelectorAll('.mod-img').forEach(m => { m.style.clipPath = 'none'; });
    document.querySelectorAll('.wipe .rd, .wipe-mini .rd').forEach(r => { r.style.clipPath = 'none'; });
    return;
  }

  /* hero parallax */
  gsap.to('.banner-float', { yPercent: -10, ease: 'none', scrollTrigger: { trigger: '.banner', start: 'top top', end: 'bottom top', scrub: true } });

  /* image float parallax */
  document.querySelectorAll('.img-float img').forEach(img => {
    gsap.fromTo(img, { yPercent: 0 }, { yPercent: -16, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  /* module image cards slide in */
  document.querySelectorAll('.mod').forEach((mod, i) => {
    const box = mod.querySelector('.mod-img');
    const fromRight = i % 2 === 1;
    const tl = gsap.timeline({ scrollTrigger: { trigger: mod, start: 'top 78%', once: true } });
    tl.fromTo(box, { clipPath: fromRight ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)', x: fromRight ? 60 : -60 },
      { clipPath: 'inset(0 0% 0 0%)', x: 0, duration: 1.4, ease: 'expo.out' })
      .fromTo(box.querySelectorAll('img'), { scale: 1.15 }, { scale: 1, duration: 1.8, ease: 'expo.out' }, 0);
    const rd = box.querySelector('.rd');
    if (rd) {
      gsap.fromTo(rd, { clipPath: 'inset(0 0 0 100%)' }, { clipPath: 'inset(0 0 0 0%)', ease: 'none',
        scrollTrigger: { trigger: box, start: 'top 60%', end: 'bottom 30%', scrub: true } });
    }
  });

  /* big sketch -> render wipe */
  const wipe = document.getElementById('wipe');
  if (wipe) {
    gsap.fromTo(wipe.querySelector('.rd'), { clipPath: 'inset(0 0 0 100%)' }, { clipPath: 'inset(0 0 0 0%)', ease: 'none',
      scrollTrigger: { trigger: wipe, start: 'top 70%', end: 'bottom 35%', scrub: true } });
    gsap.fromTo(wipe, { scale: .9 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: wipe, start: 'top bottom', end: 'center center', scrub: true } });
  }

  /* reel frame grows */
  gsap.fromTo('#reelFrame', { scale: .88 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '#reelFrame', start: 'top bottom', end: 'top 25%', scrub: true } });

  /* counts */
  document.querySelectorAll('.count b').forEach(b => {
    const n = +b.dataset.n; const o = { v: 0 };
    ScrollTrigger.create({ trigger: b, start: 'top 85%', once: true, onEnter: () => gsap.to(o, { v: n, duration: 1.6, ease: 'power2.out', onUpdate: () => { b.textContent = String(Math.round(o.v)).padStart(2, '0'); } }) });
  });

  /* ---------- slogan line split + fill ---------- */
  const slogans = [...document.querySelectorAll('.slogan-text')];
  slogans.forEach(p => { p.dataset.src = p.textContent.trim(); });
  let sloganTriggers = [];
  const buildSlogans = () => {
    sloganTriggers.forEach(t => t.kill()); sloganTriggers = [];
    slogans.forEach(p => {
      const words = p.dataset.src.split(/\s+/);
      p.innerHTML = words.map(w => '<span class="w">' + w + '</span>').join(' ');
      const spans = [...p.querySelectorAll('.w')];
      const lines = [];
      let top = null;
      spans.forEach(s => {
        const t = s.offsetTop;
        if (top === null || Math.abs(t - top) > 4) { lines.push([]); top = t; }
        lines[lines.length - 1].push(s.textContent);
      });
      p.innerHTML = lines.map(l => { const txt = l.join(' '); return '<span class="slogan-line">' + txt + '<span class="slogan-cover" aria-hidden="true">' + txt + '</span></span>'; }).join('<span class="ln-break"></span>');
      p.querySelectorAll('.slogan-cover').forEach(c => {
        const tw = gsap.fromTo(c, { width: '0%' }, { width: '100%', ease: 'none', scrollTrigger: { trigger: c.parentElement, start: 'top 90%', end: 'top 45%', scrub: true } });
        sloganTriggers.push(tw.scrollTrigger);
      });
    });
  };
  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  fontsReady.then(() => { buildSlogans(); ScrollTrigger.refresh(); });
  let lastW = window.innerWidth, rT;
  window.addEventListener('resize', () => {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    clearTimeout(rT);
    rT = setTimeout(() => { buildSlogans(); ScrollTrigger.refresh(); }, 250);
  });
  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
