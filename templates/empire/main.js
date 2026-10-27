/* ORNAT UX — empire-style build */
(function () {
  'use strict';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = typeof window.gsap !== 'undefined';
  var body = document.body;
  if (hasGsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  /* ---------- split text into words ---------- */
  function splitWords(el) {
    var idx = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var parts = n.textContent.split(/(\s+)/);
          var frag = document.createDocumentFragment();
          parts.forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span'); w.className = 'w';
            var i = document.createElement('i'); i.textContent = p; i.style.setProperty('--i', idx++);
            w.appendChild(i); frag.appendChild(w);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') { walk(n); }
      });
    })(el);
  }
  var taEls = document.querySelectorAll('.ta');
  taEls.forEach(splitWords);
  if ('IntersectionObserver' in window && !reduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    taEls.forEach(function (el) { io.observe(el); });
  } else { taEls.forEach(function (el) { el.classList.add('in'); }); }

  /* ---------- Lenis ---------- */
  var lenis = null;
  if (!reduced && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1 });
    window.lenis = lenis;
    if (hasGsap) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);
    }
    lenis.stop();
  }
  function scrollToY(y) {
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo(0, y);
  }

  /* ---------- loader ---------- */
  var loader = document.getElementById('loader');
  var pctEl = document.getElementById('loaderPct');
  var barEl = document.getElementById('loaderBar');
  var assetsReady = false;
  var heroIntro = function () {};

  function preload(src) {
    return new Promise(function (res) { var im = new Image(); im.onload = im.onerror = function () { res(); }; im.src = src; });
  }
  var waits = [preload('/templates/empire/img/tower-sketch.webp'), preload('/templates/empire/img/tower-render.webp')];
  if (document.fonts && document.fonts.ready) waits.push(document.fonts.ready);
  Promise.race([Promise.all(waits), new Promise(function (r) { setTimeout(r, 6000); })]).then(function () { assetsReady = true; });

  function finishLoader() {
    body.classList.remove('is-loading');
    if (lenis) lenis.start();
    if (hasGsap) ScrollTrigger.refresh();
    heroIntro();
  }

  if (reduced || !hasGsap) {
    loader.style.display = 'none';
    finishLoader();
  } else {
    var letters = loader.querySelectorAll('.loader__word span');
    var state = { v: 0 };
    var tl = gsap.timeline();
    tl.to(letters, { y: 0, rotate: 0, duration: 0.9, ease: 'power4.out', stagger: 0.07 }, 0.15)
      .to(loader.querySelector('.dot'), { scale: 1, duration: 0.5, ease: 'back.out(3)' }, 0.75);
    var prog = gsap.to(state, {
      v: 88, duration: 1.8, ease: 'power1.inOut',
      onUpdate: function () { pctEl.textContent = Math.round(state.v) + '%'; barEl.style.width = state.v + '%'; }
    });
    var waitDone = function () {
      if (!assetsReady) { setTimeout(waitDone, 80); return; }
      gsap.to(state, {
        v: 100, duration: 0.45, ease: 'power2.out',
        onUpdate: function () { pctEl.textContent = Math.round(state.v) + '%'; barEl.style.width = state.v + '%'; },
        onComplete: function () {
          gsap.timeline({ onComplete: function () { loader.style.display = 'none'; } })
            .to(letters, { y: '-105%', duration: 0.6, ease: 'power3.in', stagger: 0.04 })
            .to(loader, { clipPath: 'inset(0 0 100% 0)', duration: 0.8, ease: 'power3.inOut' }, '-=0.15')
            .add(finishLoader, '-=0.55');
        }
      });
    };
    prog.eventCallback('onComplete', waitDone);
  }

  /* hero big text intro */
  var bigSpans = document.querySelectorAll('.hero__big span');
  if (hasGsap && !reduced) {
    gsap.set(bigSpans, { yPercent: 110 });
    heroIntro = function () { gsap.to(bigSpans, { yPercent: 0, duration: 1.2, ease: 'power4.out', stagger: 0.1 }); };
  }

  /* ---------- nav: hide on scroll down, theme by section ---------- */
  var nav = document.getElementById('nav');
  var navSections = Array.prototype.slice.call(document.querySelectorAll('[data-nav]'));
  var lastY = window.scrollY;
  var footEl = document.querySelector('.foot');
  function onScroll() {
    var y = window.scrollY;
    if (!body.classList.contains('menu-open')) {
      if (y > lastY + 4 && y > 120) nav.classList.add('is-hidden');
      else if (y < lastY - 4 || y < 120) nav.classList.remove('is-hidden');
    }
    lastY = y;
    var probe = 40, dark = false;
    for (var i = 0; i < navSections.length; i++) {
      var r = navSections[i].getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) { dark = navSections[i].getAttribute('data-nav') === 'dark'; break; }
    }
    nav.classList.toggle('is-dark', dark);
    var fr = footEl.getBoundingClientRect();
    body.classList.toggle('at-end', fr.top < window.innerHeight * 0.9);
  }
  if (lenis) lenis.on('scroll', onScroll); else window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- menu ---------- */
  var burger = document.getElementById('burger');
  var menu = document.getElementById('menu');
  function setMenu(open) {
    body.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    menu.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (lenis) { open ? lenis.stop() : lenis.start(); }
    if (open && hasGsap && !reduced) {
      gsap.fromTo(menu.querySelectorAll('.menu__links a'), { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', stagger: 0.06, delay: 0.25 });
      gsap.fromTo(menu.querySelector('.menu__brand'), { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1, ease: 'power3.out', delay: 0.3 });
    }
  }
  burger.addEventListener('click', function () { setMenu(!body.classList.contains('menu-open')); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && body.classList.contains('menu-open')) { setMenu(false); burger.focus(); } });

  /* ---------- horizontal curtain page-swap for internal links ---------- */
  var curtain = document.getElementById('curtain');
  var busy = false;
  document.querySelectorAll('[data-go]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      var target = id && id.charAt(0) === '#' ? document.querySelector(id) : null;
      if (!target) return;
      e.preventDefault();
      if (busy) return;
      var wasOpen = body.classList.contains('menu-open');
      var go = function () {
        if (wasOpen) setMenu(false);
        if (lenis) lenis.start();
        var y = target.getBoundingClientRect().top + window.scrollY;
        if (target.id === 'modulos' && window.innerWidth < 900) y += 0;
        scrollToY(Math.max(0, y));
        nav.classList.remove('is-hidden');
      };
      if (reduced || !hasGsap) { go(); return; }
      busy = true;
      gsap.timeline({ onComplete: function () { busy = false; gsap.set(curtain, { xPercent: 101 }); } })
        .fromTo(curtain, { xPercent: 101 }, { xPercent: 0, duration: 0.6, ease: 'power3.inOut' })
        .add(go)
        .to(curtain, { xPercent: -101, duration: 0.7, ease: 'power3.inOut' }, '+=0.12');
      if (target.querySelectorAll) {
        target.querySelectorAll('.ta').forEach(function (t) { t.classList.add('in'); });
      }
    });
  });

  /* ---------- scroll effects ---------- */
  if (hasGsap && !reduced) {
    var mm = gsap.matchMedia();
    mm.add('(min-width: 900px)', function () {
      var track = document.getElementById('track');
      var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
      gsap.to(track, {
        x: function () { return -dist(); }, ease: 'none',
        scrollTrigger: { trigger: '.floors', start: 'top top', end: function () { return '+=' + dist(); }, pin: true, scrub: 1, invalidateOnRefresh: true }
      });
    });

    gsap.fromTo('.hero__big', { yPercent: 0, opacity: 1 }, { yPercent: -35, opacity: 0, ease: 'none', scrollTrigger: { trigger: '#inicio', start: 'top top', end: '38% top', scrub: true } });
    gsap.fromTo('.values__facade', { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.values__hero', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.fromTo('.values__hero h2', { scale: 0.86, opacity: 0.3 }, { scale: 1, opacity: 1, ease: 'none', scrollTrigger: { trigger: '.values__hero', start: 'top bottom', end: 'center center', scrub: true } });
    document.querySelectorAll('.vimg img').forEach(function (img) {
      gsap.fromTo(img, { scale: 1.18, yPercent: -4 }, { scale: 1.04, yPercent: 4, ease: 'none', scrollTrigger: { trigger: img.parentNode, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    gsap.utils.toArray('.vcard, .bv__box, .steps li').forEach(function (el) {
      gsap.fromTo(el, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 92%' } });
    });
    gsap.utils.toArray('.tile').forEach(function (el, i) {
      gsap.fromTo(el, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', delay: (i % 4) * 0.08, scrollTrigger: { trigger: '.tiles', start: 'top 88%' } });
    });

    /* sketch -> render wipe */
    var wipe = document.getElementById('wipe');
    if (wipe) {
      var sk = wipe.querySelector('.wipe__sketch'), ln = wipe.querySelector('.wipe__line');
      ScrollTrigger.create({
        trigger: wipe, start: 'top 75%', end: 'bottom 25%', scrub: 0.6,
        onUpdate: function (s) {
          var p = (s.progress * 100).toFixed(2);
          sk.style.clipPath = 'inset(0 0 0 ' + p + '%)';
          ln.style.left = p + '%';
          ln.style.opacity = s.progress > 0.001 && s.progress < 0.999 ? 1 : 0;
        }
      });
    }

    /* letter fill "ready" text */
    var rt = document.getElementById('readyText');
    if (rt) {
      var words = rt.textContent.trim().split(/\s+/);
      rt.textContent = '';
      var chars = [];
      words.forEach(function (w, wi) {
        var ws = document.createElement('span'); ws.style.display = 'inline-block'; ws.style.whiteSpace = 'nowrap';
        w.split('').forEach(function (ch) { var c = document.createElement('span'); c.className = 'c'; c.textContent = ch; ws.appendChild(c); chars.push(c); });
        rt.appendChild(ws);
        if (wi < words.length - 1) rt.appendChild(document.createTextNode(' '));
      });
      rt.setAttribute('aria-label', words.join(' '));
      var lastN = -1;
      ScrollTrigger.create({
        trigger: '#ready', start: 'top top', end: 'bottom bottom',
        onUpdate: function (s) {
          var n = Math.round(Math.min(1, s.progress * 1.25) * chars.length);
          if (n === lastN) return; lastN = n;
          for (var i = 0; i < chars.length; i++) chars[i].style.color = i < n ? '#FF660F' : '';
        }
      });
    }
  }

  /* ---------- WebGL tower (three.js) ---------- */
  var canvas = document.getElementById('towerCanvas');
  var hero = document.getElementById('inicio');
  function webglOK() {
    try { var c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); } catch (e) { return false; }
  }
  if (reduced || typeof window.THREE === 'undefined' || !webglOK()) {
    document.documentElement.classList.add('no-webgl');
    return;
  }

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  var loaderT = new THREE.TextureLoader();
  var texS = loaderT.load('/templates/empire/img/tower-sketch.webp', function () { needsRender = true; });
  var texR = loaderT.load('/templates/empire/img/tower-render.webp', function () { needsRender = true; });
  [texS, texR].forEach(function (t) { t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; });

  var uniforms = { uS: { value: texS }, uR: { value: texR }, uP: { value: 0 }, uT: { value: 0 } };

  // CMS changes textures only. Scroll progress, shaders and camera stay intact.
  (() => {
    const states = [
      { id: 'texture-sketch', label: 'Imagen inicial · boceto', src: '/templates/empire/img/tower-sketch.webp', uniform: 'uS', base: texS, custom: null, requested: '', version: 0 },
      { id: 'texture-render', label: 'Imagen final · render', src: '/templates/empire/img/tower-render.webp', uniform: 'uR', base: texR, custom: null, requested: '', version: 0 }
    ];
    const safe = src => {
      if (typeof src !== 'string' || !src) return false;
      if (/^data:image\/(?:png|jpeg|webp|avif|gif);base64,/i.test(src)) return true;
      try { const url = new URL(src, location.href); return ['https:', 'blob:'].includes(url.protocol) || (url.protocol === 'http:' && url.origin === location.origin); } catch (_) { return false; }
    };
    window.ornatCmsTextures = {
      slots: states.map(s => ({ id: s.id, label: s.label, src: s.src, width: 1024, height: 1536 })),
      apply(values = {}) {
        states.forEach(state => {
          const entry = values[state.id];
          const input = entry && (typeof entry === 'string' ? entry : entry.src);
          const src = input && safe(input) && input !== state.src ? input : '';
          if (src === state.requested) return;
          state.requested = src;
          const version = ++state.version;
          if (!src) {
            if (state.custom) state.custom.dispose();
            state.custom = null; uniforms[state.uniform].value = state.base; needsRender = true;
            return;
          }
          loaderT.load(src, texture => {
            if (state.version !== version) { texture.dispose(); return; }
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.anisotropy = 4;
            const old = state.custom;
            state.custom = texture; uniforms[state.uniform].value = texture; needsRender = true;
            if (old) old.dispose();
          }, undefined, () => {
            if (state.version !== version) return;
            if (state.custom) state.custom.dispose();
            state.custom = null; uniforms[state.uniform].value = state.base; needsRender = true;
            state.requested = '';
          });
        });
      }
    };
  })();

  var mat = new THREE.ShaderMaterial({
    uniforms: uniforms, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: [
      'uniform sampler2D uS; uniform sampler2D uR; uniform float uP; uniform float uT; varying vec2 vUv;',
      'float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }',
      'float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);',
      '  return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }',
      'void main(){',
      '  vec4 s=texture2D(uS,vUv); vec4 r=texture2D(uR,vUv);',
      '  float n=(n2(vUv*vec2(7.,12.)+vec2(0.,uT*.15))-.5)*.07 + (n2(vUv*40.)-.5)*.015;',
      '  float edge=uP*1.18-.09;',
      '  float d=vUv.y+n-edge;',
      '  float m=1.-smoothstep(-.012,.012,d);',
      '  vec4 c=mix(s,r,m);',
      '  float a=max(s.a,r.a);',
      '  float glow=(1.-smoothstep(0.,.018,abs(d)))*step(.02,uP)*step(uP,.98);',
      '  c.rgb=mix(c.rgb,vec3(1.,.42,.08),glow*.85*a);',
      '  float fadeB=smoothstep(0.,.05,vUv.y)*mix(smoothstep(0.,.06,vUv.x)*smoothstep(1.,.94,vUv.x),1.,smoothstep(.12,.3,vUv.y));',
      '  gl_FragColor=vec4(c.rgb,c.a*fadeB);',
      '}'
    ].join('\n')
  });
  var ASPECT = 1024 / 1536;
  var geo = new THREE.PlaneGeometry(ASPECT, 1, 1, 1);
  var tower = new THREE.Mesh(geo, mat);
  scene.add(tower);

  /* floating dust for depth */
  var N = 260, pos = new Float32Array(N * 3), seeds = new Float32Array(N);
  for (var i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 9; pos[i * 3 + 1] = (Math.random() - 0.5) * 7; pos[i * 3 + 2] = (Math.random() - 0.3) * 5;
    seeds[i] = Math.random();
  }
  var pgeo = new THREE.BufferGeometry();
  pgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  var dot = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 32; var g = c.getContext('2d');
    var gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c);
  })();
  var pmat = new THREE.PointsMaterial({ size: 0.05, map: dot, transparent: true, opacity: 0.85, depthWrite: false, color: 0xffffff });
  var dust = new THREE.Points(pgeo, pmat);
  scene.add(dust);

  var visH, visW, mobile;
  function resize() {
    var w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    visH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    visW = visH * camera.aspect;
    mobile = w < 900;
    needsRender = true;
  }
  var needsRender = true, running = false, inView = true, t0 = performance.now();
  var smoothP = 0;

  function heroProgress() {
    var r = hero.getBoundingClientRect();
    var range = hero.offsetHeight - window.innerHeight;
    return Math.min(1, Math.max(0, -r.top / (range || 1)));
  }

  function frame(now) {
    running = false;
    if (!inView || document.hidden) return;
    var t = (now - t0) / 1000;
    var p = heroProgress();
    smoothP += (p - smoothP) * 0.12;
    var sp = smoothP;

    var th = mobile ? Math.min(visH * 0.95, (visW * 1.3) / ASPECT) : visH * 1.2;
    tower.scale.set(th, th, 1);
    var endY = -visH / 2 + th / 2 - visH * (mobile ? 0.04 : 0.1);
    var startY = endY - visH * (mobile ? 0.62 : 0.72);
    var e = 1 - Math.pow(1 - sp, 3);
    tower.position.y = startY + (endY - startY) * e;
    tower.position.x = mobile ? visW * 0.12 : visW * (0.27 - 0.03 * e);
    tower.position.z = -0.6 * (1 - e);
    tower.rotation.y = 0.32 - 0.26 * e + Math.sin(t * 0.4) * 0.012;
    tower.rotation.x = -0.05 * (1 - e);
    uniforms.uP.value = Math.min(1, Math.max(0, (sp - 0.08) / 0.78));
    uniforms.uT.value = t;

    var arr = pgeo.attributes.position.array;
    for (var k = 0; k < N; k++) {
      arr[k * 3 + 1] += 0.0025 + seeds[k] * 0.003;
      if (arr[k * 3 + 1] > 3.6) arr[k * 3 + 1] = -3.6;
    }
    pgeo.attributes.position.needsUpdate = true;
    dust.position.y = sp * 1.4;
    pmat.opacity = 0.35 + 0.5 * sp;

    renderer.render(scene, camera);
    needsRender = false;
    loop();
  }
  function loop() { if (!running) { running = true; requestAnimationFrame(frame); } }

  resize();
  window.addEventListener('resize', function () { resize(); loop(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { inView = en[0].isIntersecting; if (inView) loop(); }, { threshold: 0 }).observe(hero);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) loop(); });
  loop();
})();
