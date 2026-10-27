gsap.registerPlugin(ScrollTrigger);
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const mobile = matchMedia('(max-width: 900px)').matches;

const lenis = new Lenis({ duration: 1.25, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add(t => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);

// menu
const menu = $('#menu'), mbtn = $('#mbtn');
let open = false;
const mtl = gsap.timeline({ paused: true })
  .to(menu, { clipPath: 'inset(0 0 0% 0)', duration: .9, ease: 'expo.inOut' })
  .from('.menu > ul > li > a, .menu > ul > li > .msw-btn', { yPercent: 110, duration: .9, stagger: .06, ease: 'expo.out' }, '-=.35')
  .from('.menu aside', { opacity: 0, y: 30, duration: .7 }, '<');
const toggle = v => { open = v; mbtn.setAttribute('aria-expanded', v); $('#mlbl').textContent = v ? 'CERRAR' : 'MENÚ'; v ? (mtl.play(), lenis.stop()) : (mtl.reverse(), lenis.start()); };
mbtn.addEventListener('click', () => toggle(!open));
addEventListener('keydown', e => { if (e.key === 'Escape' && open) toggle(false); });
$$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const el = $(a.getAttribute('href')); if (!el) return;
  e.preventDefault(); if (open) toggle(false); lenis.scrollTo(el, { duration: 1.6 });
}));

// 1 intro: scroll owns the SVG transform; entrance owns its wrapper
gsap.timeline({ scrollTrigger: { trigger: '.intro', start: 'top top', end: 'bottom bottom', scrub: true } })
  .to('.intro .top, .intro .cue, .intro .vm', { opacity: 0, duration: .15 }, 0)
  .to('#bigast', { rotate: 720, ease: 'none', duration: 1 }, 0)
  .to('#bigast', { scale: 34, ease: 'power2.in', duration: 1 }, 0)
  .to('.intro-wipe', { opacity: 1, duration: .5, ease: 'power1.in' }, .5);
gsap.from('.intro-mark-entry', { scale: .78, rotate: -45, autoAlpha: 0, duration: 1.1, ease: 'expo.out', delay: .15 });
gsap.from('.intro .top', { opacity: 0, y: 20, duration: 1, delay: .6 });

// 2 hero
gsap.from('.hero h1 .ln>span', { yPercent: 110, duration: 1.3, stagger: .1, ease: 'expo.out', scrollTrigger: { trigger: '.hero', start: 'top 60%' } });
gsap.fromTo('#heroImg', { scale: 1.25 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top bottom', end: 'top top', scrub: true } });
gsap.to('#heroImg', { yPercent: 15, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

// 3 anchor: words light up
$$('.split').forEach(p => {
  p.innerHTML = p.textContent.trim().split(/\s+/).map(w => `<span class="w">${w}</span>`).join(' ');
  gsap.to(p.querySelectorAll('.w'), { opacity: 1, stagger: .05, ease: 'none', scrollTrigger: { trigger: p, start: 'top 80%', end: 'bottom 40%', scrub: true } });
});

// 4 showreel: box grows to full screen, sketch becomes render
gsap.timeline({ scrollTrigger: { trigger: '.reel', start: 'top top', end: 'bottom bottom', scrub: true,
  onUpdate: s => $('#rcap').classList.toggle('on', s.progress > .3) } })
  .to('#rast', { scale: 0, rotate: 180, duration: .15 }, 0)
  .to('#rbox', { width: '100vw', height: '100vh', borderRadius: 0, ease: 'power2.inOut', duration: .45 }, 0)
  .to('.reel .we', { opacity: 0, duration: .08 }, .42)
  .to('#rrender', { clipPath: 'inset(0 0% 0 0)', ease: 'none', duration: .4 }, .5)
  .fromTo('#we1', { x: '25vw' }, { x: '-45vw', ease: 'none', duration: 1 }, 0)
  .fromTo('#we2', { x: '-40vw' }, { x: '15vw', ease: 'none', duration: 1 }, 0);

// 5 manifesto slides
const slides = $$('.mani .slide');
const mtl2 = gsap.timeline({ scrollTrigger: { trigger: '.mani', start: 'top top', end: 'bottom bottom', scrub: true } });
mtl2.to('#mast', { rotate: 160, ease: 'none', duration: slides.length * 2 }, 0);
slides.forEach((s, i) => {
  const t = i * 2;
  if (!i) {
    gsap.set(s, { opacity: 1 });
    gsap.from(s.children, { y: 80, opacity: 0, stagger: .12, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.mani', start: 'top 40%' } });
    mtl2.to(s, { opacity: 0, y: -60, duration: .3 }, 1.7);
    return;
  }
  mtl2.fromTo(s, { opacity: 0 }, { opacity: 1, duration: .3 }, t + .1)
    .from(s.querySelector('h2'), { y: 80, duration: .5 }, t + .1)
    .from(s.querySelector('.sub'), { y: 40, opacity: 0, duration: .4 }, t + .35)
    .from(s.querySelector('.green'), { y: 100, opacity: 0, duration: .6 }, t + .5);
  if (i < slides.length - 1) mtl2.to(s, { opacity: 0, y: -60, duration: .3 }, t + 1.7);
});

// 6 definition
gsap.from('.def h2, .def .ph, .def p', { y: 50, opacity: 0, stagger: .1, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: '.def', start: 'top 55%' } });
gsap.to('.def h2 .ast', { rotate: 360, ease: 'none', scrollTrigger: { trigger: '.def', start: 'top bottom', end: 'bottom top', scrub: true } });

// question scenes
$$('.q').forEach(q => {
  gsap.timeline({ scrollTrigger: { trigger: q, start: 'top top', end: 'bottom bottom', scrub: true } })
    .fromTo(q.querySelector('.word'), { scale: 1.6, yPercent: 30, opacity: .2 }, { scale: 1, yPercent: 0, opacity: 1, ease: 'power2.out', duration: .6 }, 0)
    .fromTo(q.querySelector('.fig'), { yPercent: 60 }, { yPercent: 0, ease: 'power2.out', duration: .6 }, .05)
    .to(q.querySelector('.shade'), { opacity: 1, duration: .3 }, .45)
    .fromTo(q.querySelector('h2'), { opacity: 0, scale: .9, y: 40 }, { opacity: 1, scale: 1, y: 0, duration: .3 }, .5)
    .to(q.querySelector('.word'), { opacity: .35, duration: .3 }, .6);
});

// 7 projects: stacked cards
gsap.from('.promise h2', { y: 80, opacity: 0, duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: '.promise', start: 'top 60%' } });
const cards = $$('.pcard'), counts = $$('#pcount span');
cards.forEach((c, i) => {
  const img = c.querySelector('figure img:not(.sk):not(.rd)');
  if (img) gsap.to(img, { scale: 1, ease: 'none', scrollTrigger: { trigger: c, start: 'top bottom', end: 'top top', scrub: true } });
  gsap.from(c.querySelectorAll('.tags, h3, p, .go'), { y: 60, opacity: 0, stagger: .08, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: c, start: 'top 45%' } });
  const next = cards[i + 1];
  if (next) gsap.fromTo(c, { scale: 1, filter: 'brightness(1)', borderRadius: 0 }, { scale: .9, filter: 'brightness(.4)', borderRadius: 12, ease: 'none', scrollTrigger: { trigger: next, start: 'top 55%', end: 'top top', scrub: true } });
  ScrollTrigger.create({ trigger: c, start: 'top center', end: 'bottom center', onToggle: s => s.isActive && counts.forEach((n, k) => n.classList.toggle('on', k === i)) });
});
ScrollTrigger.create({ trigger: '.projects', start: 'top center', end: 'bottom bottom', toggleClass: { targets: '#pcount', className: 'on' } });
const wipe = $('.wipe .rd');
if (wipe) gsap.to(wipe, { clipPath: 'inset(0 0 0 0%)', ease: 'none', scrollTrigger: { trigger: wipe.closest('.pcard'), start: 'top 30%', end: 'top -70%', scrub: true } });

// 8 wall rows
$$('.wall .row').forEach(r => gsap.to(r, { x: () => r.dataset.dir * innerWidth * .45, ease: 'none', scrollTrigger: { trigger: '.wall', start: 'top bottom', end: 'bottom top', scrub: true } }));
gsap.to('.wall .bgast', { rotate: 120, ease: 'none', scrollTrigger: { trigger: '.wall', start: 'top bottom', end: 'bottom top', scrub: true } });
gsap.from('.wall .hd h2', { y: 60, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.wall', start: 'top 70%' } });

// 9 services
gsap.from('.terr li', { y: 80, opacity: 0, stagger: .08, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: '.terr', start: 'top 80%' } });
gsap.from('.serv .hd h2', { y: 60, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.serv', start: 'top 70%' } });

// 10 audience scroll list
const alist = $('#alist'), aps = [...alist.children];
gsap.timeline({ scrollTrigger: { trigger: '.aud', start: 'top top', end: 'bottom bottom', scrub: true,
  onUpdate: () => { const mid = innerHeight / 2; aps.forEach(p => { const r = p.getBoundingClientRect(); const d = Math.abs(r.top + r.height / 2 - mid) / mid; p.style.opacity = Math.max(.12, 1 - d * 1.3); }); } } })
  .fromTo(alist, { y: () => innerHeight * .15 }, { y: () => -alist.offsetHeight * .75, ease: 'none', duration: .8 })
  .to(alist, { opacity: 0, duration: .1 }, .78)
  .fromTo('#aend', { opacity: 0, y: 60 }, { opacity: 1, y: -innerHeight * .25, duration: .2 }, .8);

// 11 method rows
gsap.from('.jrow', { y: 50, opacity: 0, stagger: .1, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.journal', start: 'top 70%' } });

// 12 cta
gsap.timeline({ scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'top top', scrub: true } })
  .fromTo('#ctaword', { scale: 1.4, yPercent: 40 }, { scale: 1, yPercent: 0, ease: 'none' }, 0)
  .fromTo('#ctafig', { yPercent: 40 }, { yPercent: 0, ease: 'none' }, 0);
gsap.from('.cta .round', { scale: 0, rotate: -90, duration: 1.2, ease: 'back.out(1.6)', scrollTrigger: { trigger: '.cta', start: 'top 20%' } });

// 13 footer reveal
const setFoot = () => { const footer = $('#footer'); $('main').style.marginBottom = getComputedStyle(footer).position === 'fixed' ? footer.offsetHeight + 'px' : '0px'; ScrollTrigger.refresh(); };
addEventListener('load', setFoot);
if (document.fonts) document.fonts.ready.then(setFoot);
addEventListener('resize', () => { clearTimeout(window.__rf); window.__rf = setTimeout(setFoot, 200); });
gsap.from('.fbig', { yPercent: 60, ease: 'none', scrollTrigger: { trigger: 'main', start: 'bottom bottom', end: () => '+=' + $('#footer').offsetHeight, scrub: true } });


