gsap.registerPlugin(ScrollTrigger);
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

const lenis = new Lenis({ duration: 1.3, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add(t => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
lenis.stop();

// palm-leaf shadow overlay
const leaf = (x, y, len, ang, n) => {
  let d = `<path d="M${x} ${y} q${len * .5} ${len * .08} ${len} 0" stroke="#000" stroke-width="10" fill="none" transform="rotate(${ang} ${x} ${y})"/>`;
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1), px = x + len * t, w = 26 + 60 * Math.sin(Math.PI * t);
    d += `<ellipse cx="${px}" cy="${y - w * .55}" rx="11" ry="${w * .6}" transform="rotate(${ang} ${x} ${y}) rotate(-28 ${px} ${y})"/>`;
    d += `<ellipse cx="${px}" cy="${y + w * .55}" rx="11" ry="${w * .6}" transform="rotate(${ang} ${x} ${y}) rotate(28 ${px} ${y})"/>`;
  }
  return d;
};
const shadowSVG = `<svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice"><g fill="#000">${leaf(-80, 120, 900, 18, 16)}${leaf(-40, 420, 780, -8, 14)}${leaf(1700, 60, 820, 160, 15)}${leaf(1650, 700, 700, 200, 12)}${leaf(300, -60, 600, 70, 11)}</g></svg>`;
$$('.shadow').forEach(s => s.innerHTML = shadowSVG);

// clock
const clock = () => $('#clock').textContent = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Cancun', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
clock(); setInterval(clock, 15000);

// loader → hero
const pct = { v: 0 };
gsap.timeline()
  .from('.loader .wm span', { yPercent: 110, duration: 1, ease: 'expo.out' })
  .to(pct, { v: 100, duration: 1.6, ease: 'power2.inOut', onUpdate: () => $('#pct').textContent = Math.round(pct.v) }, 0)
  .to('#loader', { clipPath: 'inset(0 0 100% 0)', duration: 1.1, ease: 'expo.inOut' }, '+=.1')
  .from('.hero .slides', { scale: 1.15, duration: 2, ease: 'expo.out' }, '-=.8')
  .from('.hero h1 .ln span', { yPercent: 110, duration: 1.2, stagger: .1, ease: 'expo.out' }, '-=1.6')
  .from('.hero .scroll, .hero .card, .header', { opacity: 0, duration: .8 }, '-=1')
  .add(() => { $('#loader').remove(); lenis.start(); });

// hero slideshow (video feel)
const slides = $$('#slides img'), labels = [['P1', 'Recorrido virtual'], ['P2', 'Plataforma y diseño'], ['P3', 'Agentes inteligentes']];
let si = 0;
const cycle = () => {
  gsap.fromTo('#bar', { width: 0 }, { width: '100%', duration: 6, ease: 'none', onComplete: () => {
    slides[si].classList.remove('on'); si = (si + 1) % slides.length; slides[si].classList.add('on');
    $('#thumb').src = slides[(si + 1) % slides.length].src; [$('#pn').textContent, $('#pt').textContent] = labels[si]; cycle();
  } });
};
$('#thumb').src = slides[1].src; cycle();
gsap.to('.hero .slides', { yPercent: 18, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

// split into visual lines
const toLines = (el, cls) => {
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words.map(w => `<span style="display:inline-block">${w}</span>`).join(' ');
  const rows = []; let top = null;
  [...el.children].forEach(s => { if (s.offsetTop !== top) { rows.push([]); top = s.offsetTop; } rows[rows.length - 1].push(s.textContent); });
  el.innerHTML = rows.map(r => `<span class="${cls}"><span>${r.join(' ')}</span></span>`).join('');
  return [...el.querySelectorAll('.' + cls)];
};
document.fonts.ready.then(() => {
  const ls = toLines($('.about .big'), 'l');
  gsap.to(ls, { opacity: 1, stagger: .3, ease: 'none', scrollTrigger: { trigger: '.about .big', start: 'top 75%', end: 'bottom 45%', scrub: true } });
  const ql = toLines($('.qlines'), 'l');
  gsap.from(ql.map(l => l.firstChild), { yPercent: 105, duration: 1.2, stagger: .08, ease: 'expo.out', scrollTrigger: { trigger: '.quote', start: 'top 40%' } });
  ScrollTrigger.refresh();
});

// parallax images
$$('.about .pic img, .exc .im img').forEach(img => gsap.fromTo(img, { yPercent: -12 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } }));
$$('.exc .im').forEach(im => gsap.from(im, { clipPath: 'inset(100% 0 0 0)', duration: 1.4, ease: 'expo.inOut', scrollTrigger: { trigger: im, start: 'top 85%' } }));
gsap.from('.exc .w1', { xPercent: -20, ease: 'none', scrollTrigger: { trigger: '.exc', start: 'top bottom', end: 'center center', scrub: true } });
gsap.from('.exc .w2, .exc .w3', { xPercent: 25, ease: 'none', scrollTrigger: { trigger: '.exc', start: 'top bottom', end: 'center center', scrub: true } });

// modules: frame opens to full screen
$$('.proj').forEach(p => {
  gsap.timeline({ scrollTrigger: { trigger: p, start: 'top bottom', end: 'center top', scrub: true } })
    .fromTo(p.querySelector('.media'), { clipPath: 'inset(18% 30% 18% 30%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'power2.inOut', duration: 1 })
    .fromTo(p.querySelector('.media img'), { scale: 1.35 }, { scale: 1, ease: 'none', duration: 1.4 }, 0)
    .fromTo(p.querySelectorAll('.info > *, .num'), { opacity: 0, y: 30 }, { opacity: 1, y: 0, stagger: .05, duration: .3 }, .75);
});

// sketch draws itself, then turns into render
gsap.timeline({ scrollTrigger: { trigger: '.sketch-wrap', start: 'top 70%', end: 'bottom 60%', scrub: true } })
  .to('#draw .sk', { webkitMaskPosition: '0% 0', maskPosition: '0% 0', ease: 'none', duration: .65 })
  .to('#draw .rd', { opacity: 1, duration: .25 }, .7)
  .to('#draw .sk', { opacity: .15, duration: .25 }, .7);
gsap.from('.sketch .copy > *', { y: 40, opacity: 0, stagger: .1, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.sketch', start: 'top 55%' } });

// generational
gsap.timeline({ scrollTrigger: { trigger: '.gen', start: 'top top', end: 'bottom bottom', scrub: true } })
  .fromTo('#genbg', { clipPath: 'inset(12% 8% 12% 8%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: .5 }, 0)
  .fromTo('#genbg img', { scale: 1.25 }, { scale: 1, duration: .7 }, 0)
  .fromTo('#genw span:first-child', { x: '28vw' }, { x: 0, duration: .5 }, 0)
  .fromTo('#genw span:last-child', { x: '-28vw' }, { x: 0, duration: .5 }, 0)
  .fromTo('#genw', { opacity: .4 }, { opacity: 1, duration: .3 }, 0)
  .to('#gennote', { opacity: 1, duration: .2 }, .7);

// method tabs driven by scroll
const tis = $$('#timgs img'), tls = $$('#tlist li'), tps = $$('#tpanel .pane');
let ti = 0;
const setTab = i => {
  if (i === ti) return;
  tis.forEach((im, k) => { im.classList.toggle('was', k === ti); im.classList.toggle('on', k === i); });
  tls.forEach((l, k) => l.classList.toggle('on', k === i));
  tps.forEach((p, k) => p.classList.toggle('on', k === i));
  ti = i;
};
const tst = ScrollTrigger.create({ trigger: '.tabs', start: 'top top', end: 'bottom bottom', onUpdate: s => setTab(Math.min(3, Math.floor(s.progress * 4))) });
tls.forEach((l, k) => l.addEventListener('click', () => lenis.scrollTo(tst.start + (tst.end - tst.start) * (k + .5) / 4)));

// quote + footer parallax
gsap.fromTo('#qbg', { yPercent: -10 }, { yPercent: 10, ease: 'none', scrollTrigger: { trigger: '.quote', start: 'top bottom', end: 'bottom top', scrub: true } });
gsap.fromTo('#fband', { yPercent: -20 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.footer .band', start: 'top bottom', end: 'bottom top', scrub: true } });
gsap.from('.footer .ex li', { yPercent: 100, opacity: 0, stagger: .06, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.footer .main', start: 'top 80%' } });

// anchors
$$('a[href^="#"]:not([data-modal])').forEach(a => a.addEventListener('click', e => {
  const el = $(a.getAttribute('href')); if (!el) return; e.preventDefault(); lenis.scrollTo(el, { duration: 1.8 });
}));

// contact sheet
const modal = $('#modal');
const openM = v => { modal.classList.toggle('open', v); v ? lenis.stop() : lenis.start(); if (v) setTimeout(() => modal.querySelector('input').focus(), 500); };
$$('[data-modal]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); openM(true); }));
$$('[data-close]').forEach(b => b.addEventListener('click', () => openM(false)));
addEventListener('keydown', e => { if (e.key === 'Escape') openM(false); });
$('#form').addEventListener('submit', e => {
  e.preventDefault();
  const f = new FormData(e.target);
  const msg = `Hola ORNAT, quiero solicitar una demo.\nNombre: ${f.get('n')}\nEmpresa: ${f.get('e')}\nCorreo: ${f.get('m')}\n${f.get('t')}`;
  window.open('https://wa.me/529842353159?text=' + encodeURIComponent(msg), '_blank', 'noopener');
});

addEventListener('load', () => ScrollTrigger.refresh());
