(function(){
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  var doc = document.documentElement;
  var $ = function(s, c){ return (c||document).querySelector(s); };
  var $$ = function(s, c){ return Array.prototype.slice.call((c||document).querySelectorAll(s)); };

  /* ---------- Lenis ---------- */
  var lenis = null;
  if (!reduce && typeof window.Lenis !== 'undefined') {
    lenis = new window.Lenis({ duration: 1.15, smoothWheel: true });
    window.lenis = lenis;
    if (hasGsap) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function(t){ lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      (function raf(t){ lenis.raf(t); requestAnimationFrame(raf); })();
    }
  }
  function goTo(target){
    if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.4 });
    else { var el = typeof target === 'string' ? $(target) : target; if (el) el.scrollIntoView(); }
  }

  /* ---------- anchors ---------- */
  $$('a[href^="#"]').forEach(function(a){
    a.addEventListener('click', function(e){
      var id = a.getAttribute('href');
      if (id.length < 2) return;
      var el = $(id); if (!el) return;
      e.preventDefault(); closeMenu(); goTo(el);
    });
  });

  /* ---------- header + mobile menu ---------- */
  var hdr = $('#hdr'), burger = $('#burger'), mnav = $('#mnav');
  function onScroll(){ hdr.classList.toggle('scrolled', window.scrollY > window.innerHeight * 0.6); }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  function closeMenu(){ mnav.classList.remove('open'); burger.setAttribute('aria-expanded','false'); mnav.setAttribute('aria-hidden','true'); if (lenis) lenis.start(); }
  burger.addEventListener('click', function(){
    var open = !mnav.classList.contains('open');
    mnav.classList.toggle('open', open); burger.setAttribute('aria-expanded', String(open)); mnav.setAttribute('aria-hidden', String(!open));
    if (lenis) { open ? lenis.stop() : lenis.start(); }
  });

  /* ---------- problems slider ---------- */
  var slides = $$('.res-slide'), tabs = $$('.res-tabs button'), cur = 0, timer;
  function show(i){
    cur = (i + slides.length) % slides.length;
    slides.forEach(function(s, k){ s.classList.toggle('is-active', k === cur); });
    tabs.forEach(function(t, k){ t.classList.toggle('is-active', k === cur); t.setAttribute('aria-selected', String(k === cur)); });
  }
  tabs.forEach(function(t, k){ t.addEventListener('click', function(){ show(k); restart(); }); });
  $('.res-prev').addEventListener('click', function(){ show(cur - 1); restart(); });
  $('.res-next').addEventListener('click', function(){ show(cur + 1); restart(); });
  function restart(){ clearInterval(timer); if (!reduce) timer = setInterval(function(){ show(cur + 1); }, 6500); }
  restart();

  /* ---------- drag slider (audiences) ---------- */
  var track = $('#audTrack');
  (function(){
    var down = false, sx = 0, sl = 0, moved = false;
    track.addEventListener('pointerdown', function(e){ if (e.pointerType !== 'mouse') return; down = true; moved = false; sx = e.clientX; sl = track.scrollLeft; });
    window.addEventListener('pointermove', function(e){ if (!down) return; var dx = e.clientX - sx; if (Math.abs(dx) > 4) { moved = true; track.classList.add('drag'); } track.scrollLeft = sl - dx; });
    window.addEventListener('pointerup', function(){ if (!down) return; down = false; track.classList.remove('drag'); });
    track.addEventListener('click', function(e){ if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
  })();

  /* ---------- form → WhatsApp ---------- */
  var form = $('#demoForm'), msg = $('#formMsg');
  form.addEventListener('submit', function(e){
    e.preventDefault();
    var f = form.elements;
    if (!f.nombre.value.trim()) { msg.textContent = 'Escribe tu nombre para continuar.'; f.nombre.focus(); return; }
    if (!f.ok.checked) { msg.textContent = 'Acepta el Aviso de Privacidad para continuar.'; return; }
    var t = 'Hola ORNAT, quiero solicitar una demo.\nNombre: ' + f.nombre.value.trim();
    if (f.tel.value.trim()) t += '\nTeléfono: ' + f.tel.value.trim();
    if (f.correo.value.trim()) t += '\nCorreo: ' + f.correo.value.trim();
    if (f.perfil.value) t += '\nPerfil: ' + f.perfil.value;
    if (f.modulo.value) t += '\nMódulo: ' + f.modulo.value;
    msg.textContent = 'Abriendo WhatsApp…';
    window.open('https://wa.me/529842353159?text=' + encodeURIComponent(t), '_blank', 'noopener');
  });

  /* ---------- no GSAP / reduced motion ---------- */
  var loader = $('#loader');
  if (!hasGsap || reduce) {
    loader.style.display = 'none';
    doc.classList.add('is-loaded');
    $$('.fade-up').forEach(function(el){ el.style.opacity = 1; el.style.transform = 'none'; });
    $('.lux') && $('.lux').classList.add('in');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  var mm = gsap.matchMedia();

  /* ---------- loader ---------- */
  if (lenis) lenis.stop();
  var intro = gsap.timeline({ defaults: { ease: 'power3.out' }, onComplete: function(){ doc.classList.add('is-loaded'); if (lenis) lenis.start(); } });
  intro.to('.loader-line', { height: '100%', duration: 1.1, ease: 'power2.inOut' })
       .to('.loader-mark', { opacity: 1, y: 0, duration: .9 }, .3)
       .fromTo('.loader-word', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .9 }, .55)
       .to('.loader', { opacity: 0, duration: .9, ease: 'power2.inOut' }, 1.9)
       .set('.loader', { display: 'none' })
       .fromTo('.hero-media', { scale: 1.12, opacity: 0 }, { scale: 1, opacity: 1, duration: 2.2, ease: 'power2.out' }, 1.9)
       .fromTo('.hl1', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1.3 }, 2.3)
       .fromTo('.hdr', { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 1 }, 2.4)
       .fromTo('.hero-scroll, .rail', { opacity: 0 }, { opacity: 1, duration: 1 }, 2.7);

  /* ---------- hero scroll scrub (simulated video) ---------- */
  var heroTl = gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom bottom', scrub: 0.8 } });
  heroTl
    .to('.hm1', { scale: 1.22, xPercent: -3, duration: 3, ease: 'none' }, 0)
    .to('.hl1', { opacity: 0, y: -30, duration: .5 }, .55)
    .to('.hero-scroll', { opacity: 0, duration: .3 }, .3)
    .fromTo('.hm2', { opacity: 0, scale: 1.2 }, { opacity: 1, scale: 1.05, duration: 1.2, ease: 'none' }, .8)
    .fromTo('.hl2', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: .5 }, 1.05)
    .to('.hm2', { scale: 1.16, xPercent: 2, duration: 1.4, ease: 'none' }, 2)
    .to('.hl2', { opacity: 0, y: -30, duration: .5 }, 1.9)
    .fromTo('.hm3', { opacity: 0, scale: 1.25 }, { opacity: 1, scale: 1.08, duration: 1.2, ease: 'none' }, 2.05)
    .fromTo('.hl3', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: .5 }, 2.3)
    .to('.hm3', { scale: 1.0, duration: 1, ease: 'none' }, 3.25)
    .to('.hl3', { opacity: 0, duration: .4 }, 3.9)
    .to('.hero-media', { yPercent: -10, duration: .6, ease: 'none' }, 3.7);

  /* ---------- generic reveals ---------- */
  $$('.fade-up').forEach(function(el){
    gsap.fromTo(el, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
  });
  $$('.reveal-lines').forEach(function(h){
    var spans = $$('span', h);
    spans.forEach(function(s){ s.innerHTML = '<span style="display:block">' + s.innerHTML + '</span>'; });
    gsap.fromTo($$('span > span', h), { yPercent: 105 }, { yPercent: 0, duration: 1.2, stagger: .12, ease: 'power4.out', scrollTrigger: { trigger: h, start: 'top 85%' } });
  });

  /* ---------- walls image expand ---------- */
  mm.add('(min-width: 761px)', function(){
    gsap.fromTo('.walls-img', { clipPath: 'inset(0% 14% 0% 14% round 6px)' }, { clipPath: 'inset(0% 0% 0% 0% round 6px)', ease: 'none', scrollTrigger: { trigger: '.walls-img', start: 'top 95%', end: 'top 25%', scrub: true } });
  });
  mm.add('(max-width: 760px)', function(){
    gsap.fromTo('.walls-img', { clipPath: 'inset(0% 6% 0% 6% round 6px)' }, { clipPath: 'inset(0% 0% 0% 0% round 6px)', ease: 'none', scrollTrigger: { trigger: '.walls-img', start: 'top 95%', end: 'top 35%', scrub: true } });
  });
  gsap.fromTo('.walls-img img', { yPercent: -8 }, { yPercent: 4, ease: 'none', scrollTrigger: { trigger: '.walls-img', start: 'top bottom', end: 'bottom top', scrub: true } });

  /* ---------- lux horizontal drift + title ---------- */
  gsap.fromTo('.lux-track', { x: 0 }, { x: function(){ var t = $('.lux-track'); return -(t.scrollWidth - window.innerWidth); }, ease: 'none', scrollTrigger: { trigger: '.lux', start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true } });
  gsap.fromTo('.lux .t-script', { opacity: 0, y: 60, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.4, ease: 'power3.out', scrollTrigger: { trigger: '.lux', start: 'top 60%', onEnter: function(){ $('.lux').classList.add('in'); } } });

  /* ---------- module cards stagger ---------- */
  $$('.mods-grid').forEach(function(g){
    gsap.fromTo($$('.card', g), { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 1, stagger: .1, ease: 'power3.out', scrollTrigger: { trigger: g, start: 'top 85%' } });
  });

  /* ---------- falls: sketch -> render wipe ---------- */
  var fallsTl = gsap.timeline({ scrollTrigger: { trigger: '.falls', start: 'top top', end: 'bottom bottom', scrub: 0.6 } });
  fallsTl
    .fromTo('.falls-art', { yPercent: 12, scale: .92 }, { yPercent: 0, scale: 1, duration: 1, ease: 'none' }, 0)
    .fromTo('.falls-render', { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'none' }, .4)
    .fromTo('.falls-sketch', { opacity: .42 }, { opacity: .15, duration: 1, ease: 'none' }, .8);
  gsap.fromTo('.falls-title span', { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 1.2, stagger: .15, ease: 'power3.out', scrollTrigger: { trigger: '.falls', start: 'top 55%' } });
  gsap.fromTo('.falls-sub', { opacity: 0 }, { opacity: 1, duration: 1, scrollTrigger: { trigger: '.falls', start: 'top 40%' } });

  /* ---------- location parallax ---------- */
  gsap.fromTo('.loc-bg img', { yPercent: -10 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.loc', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.fromTo('.loc-inner > *', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1.1, stagger: .12, ease: 'power3.out', scrollTrigger: { trigger: '.loc', start: 'top 60%' } });

  /* ---------- story pinned sequence ---------- */
  var st = gsap.timeline({ scrollTrigger: { trigger: '.story', start: 'top top', end: 'bottom bottom', scrub: 0.8 } });
  st.fromTo('.story-bg img', { scale: 1.15 }, { scale: 1, duration: 10, ease: 'none' }, 0)
    .to('.s0', { opacity: 0, y: -20, duration: .8 }, 1.2);
  ['.s1', '.s2', '.s3', '.s4'].forEach(function(s, i){
    var at = 2 + i * 2;
    st.fromTo(s, { opacity: 0, y: 30, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: .8 }, at);
    if (i < 3) st.to(s, { opacity: 0, y: -20, duration: .7 }, at + 1.4);
  });

  /* ---------- customize: frame grows, strip drifts ---------- */
  gsap.fromTo('.cust-frame', { clipPath: 'inset(8% 22% 8% 22% round 400px)' }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none', scrollTrigger: { trigger: '.cust', start: 'top 85%', end: 'top 10%', scrub: true } });
  gsap.fromTo('.cust-strip', { xPercent: 6 }, { xPercent: -6, ease: 'none', scrollTrigger: { trigger: '.cust', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.fromTo('.cust-title > *', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1.2, stagger: .15, ease: 'power3.out', scrollTrigger: { trigger: '.cust-frame', start: 'top 55%' } });
  gsap.fromTo('.cust-spaced', { letterSpacing: '0.8em' }, { letterSpacing: '0.32em', ease: 'none', scrollTrigger: { trigger: '.cust-frame', start: 'top 80%', end: 'center center', scrub: true } });

  /* ---------- audiences ---------- */
  gsap.fromTo('.aud-vert', { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: '.aud', start: 'top 70%' } });
  gsap.fromTo('.acard', { opacity: 0, x: 60 }, { opacity: 1, x: 0, duration: 1, stagger: .08, ease: 'power3.out', scrollTrigger: { trigger: '.aud-track', start: 'top 85%' } });

  /* ---------- footer gold line ---------- */
  gsap.fromTo('.ftr-line', { scaleX: 0 }, { scaleX: 1, duration: 1.8, ease: 'power2.inOut', scrollTrigger: { trigger: '.ftr', start: 'top 80%' } });
  gsap.fromTo('.ftr-steps li', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .7, stagger: .05, scrollTrigger: { trigger: '.ftr-steps', start: 'top 85%' } });

  window.addEventListener('load', function(){ ScrollTrigger.refresh(); });
})();
