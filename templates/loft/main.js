const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const N = 300;
const set = innerWidth <= 768 || innerWidth / innerHeight < 1.25 ? 'm' : 'd';
const src = i => `https://ornat-loft.vercel.app/f/${set}/${String(i + 1).padStart(3, '0')}.webp`;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

document.body.classList.add('locked');

// frames: coarse pass first so any scroll position has something to draw
const frames = new Array(N);
const order = [];
for (const step of [32, 16, 8, 4, 2, 1]) for (let i = 0; i < N; i += step) if (!order.includes(i)) order.push(i);
let q = 0, loaded = 0;
const enterBtn = document.getElementById('enter');
const onProgress = () => {
  const pct = Math.round(loaded / N * 100);
  if (loaded < N) { enterBtn.textContent = `CARGANDO ${pct}%`; return; }
  enterBtn.textContent = 'COMENZAR'; enterBtn.disabled = false; enterBtn.classList.add('ready');
};
const fetchFrame = (i, tries = 0) => {
  const im = new Image();
  im.decoding = 'async';
  im.onload = () => im.decode().catch(() => {}).then(() => {
    frames[i] = im; loaded++; onProgress();
    if (Math.abs(i - Math.round(cur)) < 3) dirty = true;
    pump();
  });
  im.onerror = () => {
    if (tries < 8) return setTimeout(() => fetchFrame(i, tries + 1), Math.min(4000, 400 * (tries + 1)));
    loaded++; onProgress(); pump();
  };
  im.src = src(i) + (tries ? `?r=${tries}` : '');
};
const pump = () => { if (q < order.length) fetchFrame(order[q++]); };
for (let k = 0; k < 16; k++) pump();
const nearest = i => {
  for (let d = 0; d < N; d++) {
    if (frames[i - d]) return frames[i - d];
    if (frames[i + d]) return frames[i + d];
  }
  return null;
};

// canvas
const cv = $('#seq'), cx = cv.getContext('2d');
let W = 0, H = 0, dirty = true, drawn = -9;
const size = () => {
  const r = Math.min(devicePixelRatio || 1, 2);
  W = cv.width = Math.round(innerWidth * r); H = cv.height = Math.round(innerHeight * r);
  dirty = true;
};
size(); addEventListener('resize', size);
const paint = (im, a) => {
  const s = Math.max(W / im.naturalWidth, H / im.naturalHeight) * 1.03;
  const w = im.naturalWidth * s, h = im.naturalHeight * s;
  cx.globalAlpha = a;
  cx.imageSmoothingQuality = 'high';
  cx.drawImage(im, (W - w) / 2, (H - h) * (set === 'd' ? .5 : .52), w, h);
};
// cross-fade the two neighbouring frames so slow scrolling reads as continuous motion
const draw = f => {
  const i = Math.floor(f), r = f - i;
  const k = clamp((r - .4) / .2) ** 2 * (3 - 2 * clamp((r - .4) / .2));
  const a = nearest(i); if (!a) return;
  paint(a, 1);
  const b = i + 1 < N && frames[i + 1];
  if (b && k > .02) paint(b, k > .98 ? 1 : k);
  cx.globalAlpha = 1;
  drawn = f; dirty = false;
};

// stage-dependent atmosphere: [progress, haze, sun]
const ATM = [[0, .16, .12], [.12, .22, .06], [.26, .16, .06], [.34, .1, .45], [.48, .08, .35], [.6, .06, .2], [.72, .06, .5], [.84, .1, .3], [.93, .12, .05], [1, .35, 0]];
const atm = p => {
  for (let j = 1; j < ATM.length; j++) if (p <= ATM[j][0]) {
    const [p0, h0, s0] = ATM[j - 1], [p1, h1, s1] = ATM[j], t = (p - p0) / (p1 - p0);
    return [h0 + (h1 - h0) * t, s0 + (s1 - s0) * t];
  }
  return [ATM.at(-1)[1], ATM.at(-1)[2]];
};
const stageEl = $('.stage');
let mx = 0, my = 0, cmx = 0, cmy = 0;
addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });

// scroll
const lenis = new Lenis({ infinite: true, syncTouch: true, duration: 1.4, wheelMultiplier: .8, touchMultiplier: 1.4 });
lenis.stop();
const prog = () => { const L = lenis.limit || 1; return (((lenis.scroll % L) + L) % L) / L; };

const chs = $$('.ch').map(el => ({ el, a: +el.dataset.from, b: +el.dataset.to, sc: el.querySelector('.script'), big: el.querySelectorAll('.big .ln > span') }));
const fill = $('#fill'), tip = $('#tip'), bar = $('.prog');

let cur = 0, playing = false, last = performance.now();
const tick = now => {
  const dt = Math.min(64, now - last); last = now;
  lenis.raf(now);
  if (playing) {
    let t = lenis.scroll + dt * .09 * innerHeight / 100;
    if (t >= lenis.limit) t -= lenis.limit;
    lenis.scrollTo(t, { immediate: true, force: true });
  }
  const p = prog();
  const target = p * (N - 1);
  if (Math.abs(target - cur) > N / 2) cur = target;
  cur += (target - cur) * .18;
  const settled = Math.abs(target - cur) < .03;
  const fr = settled ? Math.round(cur) : cur;
  if (Math.abs(fr - drawn) > .01 || dirty) draw(fr);

  // drone-like camera: slow push/pull tied to scroll plus a little pointer parallax
  cmx += (mx - cmx) * .04; cmy += (my - cmy) * .04;
  const zoom = 1.06 + .03 * Math.sin(p * Math.PI * 6);
  cv.style.transform = `translate3d(${-cmx * 1.6}%, ${-cmy * 1.2}%, 0) scale(${zoom.toFixed(4)})`;
  const [hz, sun] = atm(p);
  stageEl.style.setProperty('--hz', hz.toFixed(3));
  stageEl.style.setProperty('--sun', sun.toFixed(3));
  stageEl.style.setProperty('--hy', `${(-p * 60).toFixed(1)}px`);

  for (const c of chs) {
    const t = (p - c.a) / (c.b - c.a);
    const on = t > -.02 && t < 1.02;
    c.el.classList.toggle('on', on);
    if (!on) continue;
    const o = c.a === 0 ? clamp((1 - t) / .2) : Math.min(clamp(t / .12), clamp((1 - t) / .12));
    c.el.style.opacity = o;
    c.el.style.setProperty('--y', `${(1 - o) * 24}px`);
    c.el.classList.toggle('mid', t > .14 && t < .88);
    if (c.sc) c.sc.style.setProperty('--w', `${clamp(t / .42) * 112}%`);
  }
  fill.style.transform = `scaleX(${p})`;
  tip.style.transform = `translateX(${p * bar.clientWidth - 7}px)`;
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);

// entrada
const gate = $('#gate'), stage = $('.stage');
stage.style.opacity = 0;
$('#enter').addEventListener('click', () => {
  gate.classList.add('out');
  stage.style.transition = 'opacity 1.8s ease .3s'; stage.style.opacity = 1;
  document.body.classList.remove('locked'); document.body.classList.add('in');
  chs[0].big.forEach((s, k) => s.animate([{ transform: 'translateY(105%)' }, { transform: 'none' }], { duration: 1300, delay: 700 + k * 120, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
  lenis.start();
  setTimeout(() => gate.remove(), 2600);
});

// reproducir
const play = $('#play');
const setPlay = v => { playing = v; play.setAttribute('aria-pressed', v); play.setAttribute('aria-label', v ? 'Pausar recorrido' : 'Reproducir recorrido'); };
play.addEventListener('click', () => setPlay(!playing));
addEventListener('wheel', () => playing && setPlay(false), { passive: true });
addEventListener('touchstart', () => playing && setPlay(false), { passive: true });

// menú
const menu = $('#menu');
const openMenu = v => {
  menu.classList.toggle('open', v); menu.setAttribute('aria-hidden', !v);
  if (v) { setPlay(false); lenis.stop(); } else lenis.start();
};
$('#menuBtn').addEventListener('click', () => openMenu(true));
$$('[data-open-menu]').forEach(b => b.addEventListener('click', () => openMenu(true)));
$('#menuClose').addEventListener('click', () => openMenu(false));
addEventListener('keydown', e => { if (e.key === 'Escape') openMenu(false); });
$$('[data-go]').forEach(a => a.addEventListener('click', e => {
  e.preventDefault(); openMenu(false);
  lenis.scrollTo(+a.dataset.go * lenis.limit, { duration: 2.4 });
}));
