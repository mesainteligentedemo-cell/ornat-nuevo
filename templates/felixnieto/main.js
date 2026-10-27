(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  const body = document.body;

  // Mobile gallery clones (needed with or without GSAP)
  const track = $(".mgallery_track");
  if (track) {
    const imgs = $$(".spiral_item");
    for (let k = 0; k < 2; k++) imgs.forEach((im) => { const c = document.createElement("img"); c.src = im.getAttribute("src"); c.alt = ""; c.loading = "lazy"; track.appendChild(c); });
  }
  const mq = $(".marquee_track");
  if (mq) mq.innerHTML += mq.innerHTML;

  if (!hasGsap || reduced) {
    document.documentElement.classList.add("reduced");
    body.classList.remove("is-loading");
    const l = $(".loader"); if (l) l.remove();
    setupMenu(null);
    setupReelStatic();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  // ---------- LENIS ----------
  let lenis = null;
  if (typeof window.Lenis !== "undefined") {
    lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1 });
    window.lenis = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  history.scrollRestoration = "manual";
  window.scrollTo(0, 0);

  // ---------- SPLIT HELPERS ----------
  function splitChars(el) {
    const text = el.textContent;
    el.textContent = "";
    const chars = [];
    text.split(" ").forEach((word, wi) => {
      if (wi) el.appendChild(document.createTextNode(" "));
      const wd = document.createElement("span");
      wd.style.cssText = "display:inline-block;white-space:nowrap";
      for (const ch of word) {
        const w = document.createElement("span");
        w.style.cssText = "display:inline-block;clip-path:inset(-0.35em -0.02em -0.25em -0.02em)";
        const m = document.createElement("span");
        m.style.display = "inline-block";
        m.textContent = ch;
        w.appendChild(m); wd.appendChild(w); chars.push(m);
      }
      el.appendChild(wd);
    });
    return chars;
  }
  const h1 = $(".hero_title");
  h1.setAttribute("aria-label", "Diseño visual y software con IA para arquitectura e inmobiliarias");
  Array.from(h1.children).forEach((c) => c.setAttribute("aria-hidden", "true"));
  const heroChars = $$(".hero .split").flatMap(splitChars);

  // ---------- INITIAL STATES ----------
  gsap.set(heroChars, { xPercent: -110 });
  gsap.set(".hero_para .lines, .hero_scroll .lines", { yPercent: 110 });
  gsap.set(".hero_scroll", { overflow: "clip" });
  gsap.set(".hero_brush", { clipPath: "inset(0% 100% 0% 0%)" });
  gsap.set(".reel_media", { autoAlpha: 0 });

  // ---------- LOADER ----------
  const loader = $(".loader");
  const intro = gsap.timeline({ paused: true, onComplete: () => { body.classList.remove("is-loading"); if (lenis) lenis.start(); ScrollTrigger.refresh(); } });
  intro.to(heroChars, { xPercent: 0, duration: 1, ease: "power2.out", stagger: 0.03 }, 0)
       .to(".hero_para .lines, .hero_scroll .lines", { yPercent: 0, duration: 1, ease: "power4.out", stagger: 0.08 }, 0.5)
       .fromTo(".hero_brush", { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.1, ease: "power2.out" }, 0.7)
       .fromTo(".reel_media", { autoAlpha: 0, clipPath: "inset(100% 0% 0% 0%)" }, { autoAlpha: 1, clipPath: "inset(0% 0% 0% 0%)", duration: 1.1, ease: "power3.inOut" }, 0.55);

  const letters = $$(".loader_word > span");
  const sq = $(".loader_square");
  const lt = gsap.timeline({ delay: 0.25 });
  lt.from(letters, { yPercent: 110, duration: 0.7, ease: "power3.out", stagger: 0.045 })
    .fromTo(sq, { rotate: 180, xPercent: 110, opacity: 0 }, { rotate: 0, xPercent: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, "-=0.25")
    .add(() => {
      // Grow the square into a full-screen cream panel (FLIP-like)
      const r = sq.getBoundingClientRect();
      const fill = document.createElement("div");
      fill.style.cssText = "position:fixed;left:0;top:0;width:100vw;height:100vh;background:#f9f8f5;transform-origin:0 0;z-index:2";
      loader.appendChild(fill);
      gsap.fromTo(fill, { x: r.left, y: r.top, scaleX: r.width / innerWidth, scaleY: r.height / innerHeight },
        { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.8, ease: "power2.inOut",
          onComplete: () => {
            intro.play(0);
            gsap.to(loader, { autoAlpha: 0, duration: 0.4, onComplete: () => loader.remove() });
          } });
    }, "+=0.15");

  // ---------- REEL: slideshow (simulated video w/ Ken Burns) ----------
  const reelImgs = $$(".reel_img");
  let reelIdx = 0, z = 1, reelTimer = null, reelPaused = false, reelTweens = [];
  function showReel(i) {
    const im = reelImgs[i];
    im.style.zIndex = ++z;
    reelTweens = [
      gsap.fromTo(im, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.2, ease: "power1.inOut" }),
      gsap.fromTo(im, { scale: 1.14, xPercent: i % 2 ? 2 : -2 }, { scale: 1, xPercent: 0, duration: 6.5, ease: "none" })
    ];
  }
  function nextReel() { reelIdx = (reelIdx + 1) % reelImgs.length; showReel(reelIdx); reelTimer = gsap.delayedCall(5, nextReel); }
  gsap.set(reelImgs, { autoAlpha: 0 });
  showReel(0);
  reelTimer = gsap.delayedCall(5, nextReel);
  const playBtn = $(".reel_play");
  playBtn.addEventListener("click", () => {
    reelPaused = !reelPaused;
    playBtn.setAttribute("aria-pressed", String(reelPaused));
    playBtn.setAttribute("aria-label", reelPaused ? "Reproducir animación del reel" : "Pausar animación del reel");
    if (reelPaused) { reelTimer && reelTimer.pause(); reelTweens.forEach((t) => t.pause()); }
    else { reelTimer && reelTimer.resume(); reelTweens.forEach((t) => t.resume()); }
  });

  const mm = gsap.matchMedia();

  // ---------- REEL: scroll flip (hero card -> full width) ----------
  mm.add("(min-width: 768px)", () => {
    const comp = $(".reel_component"), media = $(".reel_media"), origin = $(".hero_origin"), target = $(".reel_target");
    const rel = (el) => { const a = el.getBoundingClientRect(), b = comp.getBoundingClientRect(); return { left: a.left - b.left, top: a.top - b.top, width: a.width, height: a.height }; };
    let o = rel(origin), t = rel(target);
    const measure = () => { gsap.set(media, { clearProps: "left,top,width,height" }); o = rel(origin); t = rel(target); };
    measure();
    gsap.set(media, { left: o.left, top: o.top, width: o.width, height: o.height });
    const tw = gsap.fromTo(media, { left: () => o.left, top: () => o.top, width: () => o.width, height: () => o.height },
      { left: () => t.left, top: () => t.top, width: () => t.width, height: () => t.height, ease: "none",
        scrollTrigger: { trigger: comp, start: "top top", end: () => "+=" + Math.max(200, t.top - (innerHeight - t.height) / 2), scrub: true, invalidateOnRefresh: true, onRefreshInit: measure } });
    return () => { tw.scrollTrigger && tw.scrollTrigger.kill(); tw.kill(); gsap.set(media, { clearProps: "left,top,width,height" }); };
  });

  // ---------- INTRO rolling words ----------
  $$(".intro_word").forEach((w) => {
    const vis = $(".intro_visible", w), hid = $(".intro_hidden", w);
    hid.style.transform = "none";
    gsap.set(hid, { yPercent: -100 });
    gsap.to([vis, hid], { yPercent: "+=100", ease: "power1.inOut", scrollTrigger: { trigger: w, start: "bottom 55%", end: "top 35%", scrub: 0.4 } });
  });
  gsap.from(".intro_cta > *", { yPercent: 40, opacity: 0, duration: 1, ease: "power3.out", stagger: 0.12, scrollTrigger: { trigger: ".intro_cta", start: "top 85%" } });

  // ---------- SPIRAL ----------
  mm.add("(min-width: 768px)", () => {
    const wraps = $$(".spiral_wrap"), items = $$(".spiral_item");
    const angle = 360 / wraps.length;
    wraps.forEach((w, i) => { gsap.set(w, { rotation: -angle * i }); gsap.set(items[i], { rotation: angle * i, xPercent: 150, x: 0, opacity: 0 }); });
    const tl = gsap.timeline({ scrollTrigger: { trigger: ".spiral_height", start: "top 50%", end: "bottom bottom", scrub: true } });
    tl.to(wraps, { rotation: "+=180", stagger: 0.04, ease: "power1.out" })
      .to(items, { xPercent: 0, rotation: "-=180", ease: "power1.out", stagger: 0.04 }, "<")
      .to(items, { opacity: 1, duration: 0.03, stagger: 0.04 }, "<");
  });

  // ---------- PROJECTS (modules) ----------
  const nav = $(".nav");
  ScrollTrigger.create({ trigger: ".projects", start: "top 48px", end: "bottom 48px", toggleClass: { targets: nav, className: "on-dark" } });

  mm.add("(min-width: 768px)", () => {
    const card = $(".pcard"), list = $(".pcard_list"), sec = $(".projects");
    const n = $$(".project").length;
    gsap.set(card, { autoAlpha: 0, scale: 0.8, rotateX: -50, transformOrigin: "50% 50%" });
    let cur = -1;
    const go = (i, immediate) => {
      if (i === cur) return; cur = i;
      gsap.to(list, { yPercent: -100 * i, duration: immediate ? 0 : 0.55, ease: "power3.out", overwrite: true });
    };
    go(0, true);
    const st = ScrollTrigger.create({
      trigger: sec, start: "top 55%", end: "bottom 45%",
      onToggle: (s) => gsap.to(card, s.isActive ? { autoAlpha: 1, scale: 1, rotateX: 0, duration: 0.9, ease: "power3.out", overwrite: true } : { autoAlpha: 0, scale: 0.8, rotateX: -50, duration: 0.5, ease: "power2.in", overwrite: true }),
      onUpdate: () => {
        const y = (lenis ? lenis.scroll : scrollY) - sec.offsetTop;
        go(Math.max(0, Math.min(n - 1, Math.round(y / innerHeight))));
      }
    });
    return () => st.kill();
  });

  // Sketch -> render wipe inside the "Del plano al render" card
  gsap.timeline({ repeat: -1, repeatDelay: 0.8, yoyo: true })
    .fromTo(".plano_art", { clipPath: "inset(0% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 100%)", duration: 2.2, ease: "power2.inOut", delay: 1 });

  // Parallax on blurred backgrounds
  $$(".project").forEach((p) => {
    gsap.fromTo($(".project_bg", p), { yPercent: -3 }, { yPercent: 3, ease: "none", scrollTrigger: { trigger: p, start: "top bottom", end: "bottom top", scrub: true } });
    gsap.from($$(".project_title, .project_meta p", p), { yPercent: 60, opacity: 0, duration: 1, ease: "power3.out", stagger: 0.06, scrollTrigger: { trigger: p, start: "top 60%" } });
  });

  // ---------- TITLES / CARDS ----------
  $$(".reveal-title").forEach((t) => {
    gsap.from($$(".dline", t), { yPercent: 60, opacity: 0, duration: 1.1, ease: "power3.out", stagger: 0.1, scrollTrigger: { trigger: t, start: "top 82%" } });
  });
  $$(".cards").forEach((c) => gsap.from($$(".card", c), { y: 60, opacity: 0, duration: 1, ease: "power3.out", stagger: 0.08, scrollTrigger: { trigger: c, start: "top 85%" } }));
  gsap.from(".steps li", { y: 20, opacity: 0, duration: 0.8, ease: "power2.out", stagger: 0.04, scrollTrigger: { trigger: ".steps", start: "top 85%" } });

  // ---------- FOOTER BRUSH (draw on scroll) ----------
  const fb = $(".fbrush");
  if (fb) {
    const len = fb.getTotalLength();
    gsap.fromTo(fb, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, ease: "none", scrollTrigger: { trigger: ".footer", start: "top 90%", end: "top 15%", scrub: 0.6 } });
  }
  gsap.from(".footer_l1, .footer_btn, .footer_l2", { yPercent: 50, opacity: 0, duration: 1.1, ease: "power3.out", stagger: 0.1, scrollTrigger: { trigger: ".footer_cta", start: "top 85%" } });

  setupMenu(lenis);

  // Anchor links via Lenis
  $$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
    const id = a.getAttribute("href"); const el = id.length > 1 ? $(id) : null;
    if (!el) return;
    e.preventDefault();
    closeMenu();
    if (lenis) lenis.scrollTo(id === "#top" ? 0 : el, { duration: 1.4 }); else el.scrollIntoView();
  }));

  window.addEventListener("load", () => ScrollTrigger.refresh());

  // ---------- helpers ----------
  function closeMenu() { if (body.classList.contains("menu-open")) toggleMenu(false); }
  function toggleMenu(open) {
    const btn = $(".nav_burger"), menu = $("#menu");
    body.classList.toggle("menu-open", open);
    btn.setAttribute("aria-expanded", String(open));
    btn.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    menu.setAttribute("aria-hidden", String(!open));
    if (window.lenis) open ? window.lenis.stop() : window.lenis.start();
  }
  function setupMenu() {
    const btn = $(".nav_burger");
    btn.addEventListener("click", () => toggleMenu(!body.classList.contains("menu-open")));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
  }
  function setupReelStatic() {
    const imgs = $$(".reel_img"); imgs.forEach((im, i) => { im.style.opacity = i ? 0 : 1; });
    const b = $(".reel_play"); if (b) b.hidden = true;
    $$(".menu_link, .menu a").forEach((a) => a.addEventListener("click", () => { body.classList.remove("menu-open"); }));
  }
})();
