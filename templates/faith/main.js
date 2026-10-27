(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = () => window.matchMedia('(max-width:760px)').matches;
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  if (hasGsap && !reduce) document.documentElement.classList.add('js');

  /* ---------- menu ---------- */
  const mbtn = document.getElementById('mbtn');
  const menu = document.getElementById('menu');
  const mlbl = document.getElementById('mlbl');
  let lenis = null;
  const setMenu = (open) => {
    menu.classList.toggle('open', open);
    document.body.classList.toggle('menu-open', open);
    mbtn.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-hidden', String(!open));
    mlbl.textContent = open ? 'Cerrar' : 'Menú';
    if (lenis) open ? lenis.stop() : lenis.start();
    if (open) { const f = menu.querySelector('a'); f && setTimeout(() => f.focus({ preventScroll: true }), 350); }
  };
  mbtn.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
  menu.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.classList.contains('open')) { setMenu(false); mbtn.focus(); } });

  /* ---------- service cards ---------- */
  document.querySelectorAll('.card__plus').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.card');
      const open = !card.classList.contains('open');
      card.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
      if (hasGsap) setTimeout(() => ScrollTrigger.refresh(), 520);
    });
  });

  /* ---------- video: make sure it plays ---------- */
  const reel = document.getElementById('reel');
  if (reel) { const p = reel.play(); p && p.catch(() => {}); }

  /* ---------- manifesto stack ---------- */
  const stack = [...document.querySelectorAll('.st')];
  const blocks = [...document.querySelectorAll('.vb')];
  const showCard = (i) => {
    stack.forEach((el, k) => {
      el.classList.toggle('is-out', k < i);
      el.style.zIndex = String(10 + (stack.length - Math.abs(k - i)) + (k === i ? 10 : 0));
    });
    blocks.forEach((b, k) => b.classList.toggle('is-on', k === i));
  };
  showCard(0);

  if (!hasGsap || reduce) {
    document.querySelectorAll('.hero__script,.hero__sub,.hero__mark').forEach(el => { el.style.opacity = 1; el.style.clipPath = 'none'; });
    document.querySelectorAll('.wipe__rd').forEach(el => el.style.clipPath = 'inset(0 0 0 0)');
    blocks.forEach(b => b.classList.add('is-on'));
    if (mobile()) { let i = 0; setInterval(() => { i = (i + 1) % stack.length; showCard(i); }, 3000); }
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  /* ---------- Lenis smooth scroll ---------- */
  if (typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const id = a.getAttribute('href');
        const target = id === '#top' ? 0 : document.querySelector(id);
        if (target === null) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: 0, duration: 1.4 });
      });
    });
  }

  /* ---------- hero: arch expands into full-bleed video ---------- */
  const mm = gsap.matchMedia();
  mm.add({ d: '(min-width:761px)', m: '(max-width:760px)' }, ctx => {
    const from = ctx.conditions.d
      ? 'inset(20vh 28.5vw 0vh 28.5vw round 21.5vw 21.5vw 0vw 0vw)'
      : 'inset(19vh 5vw 0vh 5vw round 45vw 45vw 0vw 0vw)';
    const tl = gsap.timeline({
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom bottom', scrub: 0.8 }
    });
    tl.fromTo('#arch', { clipPath: from }, { clipPath: 'inset(0vh 0vw 0vh 0vw round 0vw 0vw 0vw 0vw)', ease: 'power2.inOut', duration: 1 }, 0)
      .to('.hero__copy', { yPercent: -12, ease: 'none', duration: 1 }, 0)
      .to('.logo', { color: '#ffffff', duration: 0.3 }, 0.45)
      .to('#heroScript', { opacity: 1, clipPath: 'inset(-30% -10% -50% -10%)', ease: 'power1.inOut', duration: 0.55 }, 0.45)
      .to('#heroSub', { opacity: 1, duration: 0.3 }, 0.75)
      .to('#heroMark', { opacity: 1, duration: 0.3 }, 0.8)
      .to({}, { duration: 0.35 });
  });

  /* ---------- generic reveals ---------- */
  gsap.utils.toArray('[data-reveal]').forEach(el => {
    gsap.to(el, { opacity: 1, y: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
  });
  gsap.utils.toArray('.script:not(.hero__script):not(.mq__script):not(.menu__script)').forEach(el => {
    gsap.to(el, { clipPath: 'inset(-30% -12% -50% -12%)', duration: 1.6, ease: 'power2.inOut', scrollTrigger: { trigger: el, start: 'top 88%' }, onComplete: () => { el.style.clipPath = 'none'; } });
  });

  /* ---------- parallax ---------- */
  gsap.utils.toArray('[data-speed]').forEach(el => {
    const s = parseFloat(el.dataset.speed) || 0;
    if (!s) return;
    gsap.fromTo(el, { y: () => -s * window.innerHeight * 0.6 }, {
      y: () => s * window.innerHeight * 0.6, ease: 'none',
      scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true }
    });
  });
  gsap.fromTo('.aud__img img', { yPercent: -8 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.aud__img', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.fromTo('.contact__img img', { scale: 1.12 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '.contact', start: 'top bottom', end: 'center center', scrub: true } });

  /* ---------- sketch → render wipes ---------- */
  gsap.utils.toArray('[data-wipe]').forEach(w => {
    gsap.to(w.querySelector('.wipe__rd'), {
      clipPath: 'inset(0 0% 0 0)', ease: 'none',
      scrollTrigger: { trigger: w, start: 'top 75%', end: 'bottom 30%', scrub: true }
    });
  });

  /* ---------- marquee (scroll-linked) ---------- */
  const mq = document.getElementById('mqTrack');
  if (mq) {
    gsap.fromTo(mq, { x: () => window.innerWidth * 0.1 }, {
      x: () => -(mq.scrollWidth - window.innerWidth * 0.9), ease: 'none',
      scrollTrigger: { trigger: '.mani', start: 'top bottom', end: 'center top', scrub: true, invalidateOnRefresh: true }
    });
  }

  /* ---------- manifesto stack ---------- */
  if (!mobile()) {
    blocks.forEach((b, i) => {
      ScrollTrigger.create({ trigger: b, start: 'top 60%', end: 'bottom 40%', onToggle: self => { if (self.isActive) showCard(i); } });
    });
  } else {
    let i = 0;
    ScrollTrigger.create({ trigger: '.mani__grid', start: 'top 80%', end: 'bottom 20%',
      onUpdate: self => { const k = Math.min(stack.length - 1, Math.floor(self.progress * stack.length)); if (k !== i) { i = k; showCard(k); } } });
  }

  /* ---------- polaroids drop-in ---------- */
  gsap.utils.toArray('.step').forEach((p, i) => {
    gsap.from(p, { y: 80, opacity: 0, duration: 1.1, delay: (i % 4) * 0.08, ease: 'power3.out', scrollTrigger: { trigger: p, start: 'top 92%' } });
  });

  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
