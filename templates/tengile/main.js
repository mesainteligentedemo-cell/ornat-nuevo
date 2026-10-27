(function () {
  "use strict";
  var root = document.documentElement;
  var body = document.body;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasGsap = !!(window.gsap && window.ScrollTrigger);
  if (!hasGsap || reduce) root.classList.remove("js");

  /* ---------- Lenis ---------- */
  var lenis = null;
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);
  if (window.Lenis && !reduce) {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    if (hasGsap) {
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }

  /* ---------- Menú ---------- */
  var btn = document.getElementById("menuBtn");
  var menu = document.getElementById("menu");
  function openMenu() {
    menu.hidden = false;
    requestAnimationFrame(function () { body.classList.add("menu-on"); });
    btn.setAttribute("aria-expanded", "true");
    if (lenis) lenis.stop();
    var first = menu.querySelector("a");
    if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 350);
  }
  function closeMenu() {
    if (!body.classList.contains("menu-on")) return;
    body.classList.remove("menu-on");
    btn.setAttribute("aria-expanded", "false");
    if (lenis) lenis.start();
    setTimeout(function () { if (!body.classList.contains("menu-on")) menu.hidden = true; }, 800);
  }
  btn.addEventListener("click", function () {
    body.classList.contains("menu-on") ? closeMenu() : openMenu();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && body.classList.contains("menu-on")) { closeMenu(); btn.focus(); }
  });

  /* ---------- Anclas ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href");
      if (id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var wasOpen = body.classList.contains("menu-on");
      closeMenu();
      var go = function () {
        if (lenis) lenis.scrollTo(target, { duration: 1.4 });
        else target.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
      };
      wasOpen ? setTimeout(go, 120) : go();
    });
  });

  /* ---------- Header ---------- */
  var hdr = document.getElementById("hdr");
  var hero = document.querySelector(".hero");
  var lastY = 0;
  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    var heroEnd = hero.offsetHeight - 60;
    hdr.classList.toggle("is-solid", y > heroEnd);
    if (y > 120 && y > lastY + 4) hdr.classList.add("is-hidden");
    else if (y < lastY - 4 || y <= 120) hdr.classList.remove("is-hidden");
    lastY = y;
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Reel: reproducir solo en pantalla ---------- */
  var reel = document.getElementById("reel");
  if (reel) {
    reel.muted = true;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { var p = reel.play(); if (p && p.catch) p.catch(function () {}); }
          else reel.pause();
        });
      }, { threshold: 0.15 }).observe(reel);
    }
  }

  /* ---------- Tarjeta boceto→render en táctil ---------- */
  var touch = window.matchMedia("(hover: none)").matches;

  if (!hasGsap || reduce) {
    document.querySelectorAll(".wipe-top").forEach(function (el) { el.style.clipPath = "inset(0 0 0 0)"; });
    return;
  }

  /* ---------- Hero ---------- */
  var tl = gsap.timeline({ defaults: { ease: "expo.out" } });
  tl.fromTo(".hero-media img", { scale: 1.14 }, { scale: 1, duration: 2.6, ease: "power2.out" }, 0)
    .fromTo(".ln > span", { yPercent: 105, y: 0 }, { yPercent: 0, y: 0, duration: 1.6, stagger: 0.14 }, 0.25)
    .fromTo(".hero-copy", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1.2 }, 0.9);

  gsap.fromTo(".hero-media", { yPercent: 0 }, {
    yPercent: 22, ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
  });
  gsap.to(".hero-title", {
    y: -120, ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
  });

  /* ---------- Revelado de imágenes ---------- */
  gsap.utils.toArray(".reveal").forEach(function (el) {
    var media = el.querySelectorAll("img, video");
    var st = { trigger: el, start: "top 90%", once: true };
    gsap.fromTo(el, { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.5, ease: "expo.out", scrollTrigger: st });
    gsap.fromTo(media, { scale: 1.18 }, { scale: 1, duration: 2, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 90%", once: true } });
  });

  /* ---------- Texto ---------- */
  gsap.utils.toArray(".reveal-t").forEach(function (el) {
    gsap.fromTo(el, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 1.3, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 88%", once: true } });
  });
  gsap.utils.toArray(".card, .step, .ter, .mani-item").forEach(function (el) {
    var txt = el.querySelectorAll(".card-n, h3, h2, p, ul, .lbl");
    gsap.from(txt, { opacity: 0, y: 14, duration: 1, stagger: 0.06, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 85%", once: true } });
  });

  /* ---------- Parallax lento ---------- */
  gsap.utils.toArray("[data-par]").forEach(function (img) {
    gsap.fromTo(img, { yPercent: -9 }, {
      yPercent: 9, ease: "none",
      scrollTrigger: { trigger: img.parentElement, start: "top bottom", end: "bottom top", scrub: true }
    });
  });
  var mm = gsap.matchMedia();
  mm.add("(min-width: 821px)", function () {
    gsap.utils.toArray("[data-speed]").forEach(function (el) {
      var s = parseFloat(el.getAttribute("data-speed")) || 0;
      gsap.fromTo(el, { y: s * 6 }, {
        y: -s * 6, ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true }
      });
    });
  });

  /* ---------- Boceto → render (barrido con scroll) ---------- */
  var wipe = document.querySelector("#wipe .wipe-top");
  if (wipe) {
    gsap.fromTo(wipe, { clipPath: "inset(0% 0% 0% 100%)" }, {
      clipPath: "inset(0% 0% 0% 0%)", ease: "none",
      scrollTrigger: { trigger: "#wipe", start: "top 75%", end: "bottom 35%", scrub: true }
    });
  }
  if (touch) {
    document.querySelectorAll(".swap").forEach(function (el) {
      ScrollTrigger.create({ trigger: el, start: "top 60%", end: "bottom 20%", toggleClass: "is-on" });
    });
  }

  window.addEventListener("load", function () { ScrollTrigger.refresh(); });
})();
