(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const body = document.body;

  /* ---------- Smooth scroll ---------- */
  let lenis = null;
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);
  if (!reduce && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ duration: 1.25, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    if (hasGsap) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  const scrollToEl = (el) => {
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { duration: 1.6 });
    else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  };

  /* ---------- Menu ---------- */
  const menu = document.getElementById('menu');
  const mbtn = document.getElementById('mbtn');
  const setMenu = (open) => {
    body.classList.toggle('menu-open', open);
    mbtn.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-hidden', String(!open));
    if (lenis) open ? lenis.stop() : lenis.start();
    if (open) document.getElementById('mclose').focus({ preventScroll: true });
  };
  mbtn.addEventListener('click', () => setMenu(!body.classList.contains('menu-open')));
  document.getElementById('mclose').addEventListener('click', () => { setMenu(false); mbtn.focus({ preventScroll: true }); });
  document.getElementById('scrim').addEventListener('click', () => setMenu(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && body.classList.contains('menu-open')) { setMenu(false); mbtn.focus({ preventScroll: true }); } });

  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      const el = id === '#top' ? document.body : document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      const wasOpen = body.classList.contains('menu-open');
      if (wasOpen) setMenu(false);
      setTimeout(() => (id === '#top' ? (lenis ? lenis.scrollTo(0, { duration: 1.6 }) : window.scrollTo({ top: 0, behavior: 'smooth' })) : scrollToEl(el)), wasOpen ? 450 : 0);
    });
  });

  /* ---------- Hero video, subtitles, sound ---------- */
  const video = document.getElementById('reel');
  const sub = document.getElementById('subtitle');
  const sound = document.getElementById('sound');
  const soundLbl = document.getElementById('soundlbl');
  const cues = [
    [0.6, 4.0, 'ORNAT transforma tus ideas en experiencias visuales'],
    [4.4, 8.6, 'Tu proyecto necesita una experiencia que lo explique.'],
    [9.0, 12.6, 'Del plano a la experiencia.'],
    [13.0, 16.6, 'Presentar espacios, responder consultas y organizar información'],
    [17.0, 20.6, 'Cada consulta necesita una respuesta.'],
    [21.0, 25.0, 'Tu proyecto. Tu equipo. Conectados.']
  ];
  let curCue = -1;
  const tickSub = () => {
    const t = video.currentTime;
    const i = cues.findIndex(c => t >= c[0] && t < c[1]);
    if (i !== curCue) {
      curCue = i;
      if (i === -1) sub.classList.remove('on');
      else { sub.textContent = cues[i][2]; sub.classList.add('on'); }
    }
    requestAnimationFrame(tickSub);
  };
  requestAnimationFrame(tickSub);
  const tryPlay = () => { const p = video.play(); if (p && p.catch) p.catch(() => {}); };
  tryPlay();
  sound.addEventListener('click', () => {
    const on = video.muted;
    video.muted = !on;
    if (on) { video.volume = 1; tryPlay(); }
    sound.setAttribute('aria-pressed', String(on));
    soundLbl.textContent = on ? 'Silenciar' : 'Activar sonido';
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => {
      if (en.isIntersecting) tryPlay();
      else if (video.muted) video.pause();
    }, { threshold: 0.05 }).observe(video);
  }

  /* ---------- Servicios accordion ---------- */
  const terr = document.getElementById('terr');
  const servImg = document.getElementById('servImg');
  terr.querySelectorAll(':scope > li').forEach(li => {
    li.querySelector('.th').addEventListener('click', () => {
      const wasOpen = li.classList.contains('open');
      terr.querySelectorAll(':scope > li').forEach(o => { o.classList.remove('open'); o.querySelector('.th').setAttribute('aria-expanded', 'false'); });
      if (!wasOpen) {
        li.classList.add('open');
        li.querySelector('.th').setAttribute('aria-expanded', 'true');
        const src = li.dataset.img;
        if (src && !servImg.src.endsWith(src)) {
          servImg.style.opacity = 0;
          setTimeout(() => { servImg.removeAttribute('srcset'); servImg.removeAttribute('sizes'); servImg.src = src; servImg.onload = () => { servImg.style.opacity = 1; }; }, 250);
        }
      }
      if (hasGsap) setTimeout(() => ScrollTrigger.refresh(), 700);
    });
  });

  if (!hasGsap) {
    document.querySelectorAll('.hand span').forEach(s => (s.style.clipPath = 'none'));
    document.querySelectorAll('.cline span, .cline em').forEach(s => { s.style.opacity = 1; s.style.transform = 'none'; });
    return;
  }

  /* ---------- Nav theme per section ---------- */
  document.querySelectorAll('[data-nav]:not(body)').forEach(sec => {
    ScrollTrigger.create({
      trigger: sec, start: 'top 36px', end: 'bottom 36px',
      onToggle: self => { if (self.isActive) body.dataset.nav = sec.dataset.nav; }
    });
  });

  if (reduce) {
    document.querySelectorAll('[data-reveal]').forEach(el => (el.style.opacity = 1));
    return;
  }

  /* ---------- Reveals ---------- */
  gsap.utils.toArray('[data-reveal]').forEach(el => {
    gsap.fromTo(el, { opacity: 0, y: 34 }, {
      opacity: 1, y: 0, duration: 1.3, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true }
    });
  });

  /* ---------- Letter: handwriting write-on ---------- */
  const lines = gsap.utils.toArray('.letter .hand span');
  const letterTl = gsap.timeline({ scrollTrigger: { trigger: '.letter', start: 'top 62%', once: true } });
  lines.forEach((ln, i) => {
    const len = Math.max(0.5, ln.textContent.length * 0.026);
    letterTl.to(ln, { clipPath: 'inset(0 0% 0 0)', duration: len, ease: 'none' }, i === 0 ? 0 : '>-0.05');
  });
  letterTl.to('.sign-line', { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' }, '>-0.2');

  /* ---------- Collage ---------- */
  const vh = () => window.innerHeight;
  const collTl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: '.collage', start: 'top top', end: 'bottom bottom', scrub: 0.6, invalidateOnRefresh: true }
  });
  gsap.utils.toArray('.collage .cf').forEach(fig => {
    collTl.fromTo(fig, { y: () => vh() * 0.35 }, { y: () => -(fig.offsetTop + fig.offsetHeight + vh() * 0.05), duration: 1 }, 0);
    const img = fig.querySelector('img');
    collTl.fromTo(img, { scale: 1.18 }, { scale: 1, duration: 1 }, 0);
  });
  collTl.to('.cline .l1', { opacity: 1, y: 0, duration: 0.08, ease: 'power2.out' }, 0.06)
        .to('.cline .l2', { opacity: 1, y: 0, duration: 0.08, ease: 'power2.out' }, 0.3)
        .to('.cline .l3', { opacity: 1, y: 0, duration: 0.08, ease: 'power2.out' }, 0.52);

  /* ---------- Plano al render wipe ---------- */
  const wipeTl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: '.plano', start: 'top top', end: 'bottom bottom', scrub: 0.6 }
  });
  wipeTl.fromTo('.wipe .rd', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.8 }, 0.1)
        .fromTo('.wipe .bar', { left: '0%', opacity: 1 }, { left: '100%', duration: 0.8 }, 0.1)
        .to('.wipe .bar', { opacity: 0, duration: 0.05 }, 0.9);
  gsap.fromTo('.plano-hd', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: '.plano', start: 'top 60%', once: true } });

  /* ---------- Image parallax ---------- */
  gsap.utils.toArray('.px img').forEach(img => {
    gsap.fromTo(img, { yPercent: -15 }, {
      yPercent: 0, ease: 'none',
      scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true }
    });
  });
  gsap.utils.toArray('.qbg img').forEach(img => {
    gsap.fromTo(img, { yPercent: -7, scale: 1.08 }, {
      yPercent: 7, scale: 1, ease: 'none',
      scrollTrigger: { trigger: img.closest('section'), start: 'top bottom', end: 'bottom top', scrub: true }
    });
  });

  /* ---------- Module columns: differential drift (desktop) ---------- */
  ScrollTrigger.matchMedia({
    '(min-width: 821px)': () => {
      gsap.utils.toArray('.mcol').forEach(col => {
        const s = Number(col.dataset.speed || 0);
        if (!s) return;
        gsap.fromTo(col, { y: s * 50 }, {
          y: -s * 70, ease: 'none',
          scrollTrigger: { trigger: '.mgrid', start: 'top bottom', end: 'bottom top', scrub: true }
        });
      });
    }
  });

  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
