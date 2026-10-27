(() => {
  'use strict';
  const entries = new Map();
  const renders = new Map();
  let availableRenders;
  const pendingLoads = new Map();
  let loadObserver;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const excluded = '.loading, .loading-wrap, .loading-img, .loading-img-inner, .loader, [data-loader]';
  let frame = 0;
  let heldEntry = null;
  let pausedController = null;
  let touchY = null;
  let gesture = 0;
  let heldGesture = -1;
  let bypassGesture = -1;
  let lastWheelAt = 0;
  let wheelEndTimer;
  const release = () => { heldEntry = null; resumePage(); clearScene(); };
  const clamp = n => Math.max(0, Math.min(1, n));
  const uiHostFor = base => base.closest('.home-why-item,.home-platform-content-inner,section,footer') || base.parentElement;
  const applyUIProgress = (entry,progress) => {
    const host = uiHostFor(entry.base);
    const targets = [host,document.querySelector('header')].filter(Boolean);
    targets.forEach(target => {
      target.setAttribute('data-ornat-ui-stage','');
      target.style.setProperty('--ornat-ui-progress','0');
      target.style.setProperty('--ornat-ui-ink','0%');
      target.style.setProperty('--ornat-interface-font','"ORNAT Manrope"');
      target.removeAttribute('data-ornat-ui-clean');
    });
  };
  const loadWhenNear = (base,load) => {
    if (!('IntersectionObserver' in window)) { load(); return; }
    if (!loadObserver) loadObserver = new IntersectionObserver(items => {
      for (const item of items) if (item.isIntersecting) {
        const task = pendingLoads.get(item.target);
        pendingLoads.delete(item.target);
        loadObserver.unobserve(item.target);
        task?.();
      }
    }, {rootMargin:'100% 0px'});
    pendingLoads.set(base,load);
    loadObserver.observe(base);
  };
  const scrollPosition = base => {
    // The original site scrolls .main-inner through Lenis, while window.scrollY
    // stays zero. Use the actual nearest page scroller, then public fallbacks.
    const scroller = base?.closest('.main-inner');
    return Math.max(Number(scroller?.scrollTop) || 0,
      Number(window.scrollY) || 0, Number(document.documentElement.scrollTop) || 0,
      Number(window.lenis?.animatedScroll) || 0);
  };
  const originFor = base => base.getBoundingClientRect().top + scrollPosition(base);
  const isOpeningArt = base => {
    if (base.dataset.artReveal === 'hero') return true;
    const vh = innerHeight || document.documentElement.clientHeight;
    const documentTop = originFor(base);
    return documentTop >= -vh*.25 && documentTop < vh*.4;
  };
  const progressFor = (entry, rect, vh) => {
    // Scroll-linked reveal (Apple-style): the page never stops. Progress is a pure
    // function of where the image sits in the viewport, so it also reverses on the way up.
    if (reduced.matches) return entry.revealProgress = 1;
    const opening = entry.opening || entry.base.dataset.artReveal === 'hero';
    const progress = opening
      ? clamp(scrollPosition(entry.base) / (vh*.55))
      : clamp((vh*.92 - rect.top) / (vh*.5));
    return entry.revealProgress = progress;
  };
  const sceneFor = base => base.closest('.home-map-main-inner,.home-why-item,.home-platform-content-inner,.home-platform-img-item,.about-hero-list,.home-usecase-img-list') || base.parentElement;
  const clearScene = () => {
    document.querySelectorAll('[data-ornat-scene-secondary]').forEach(el => el.removeAttribute('data-ornat-scene-secondary'));
  };
  const resumePage = () => {
    if (pausedController && pausedController === (window.ornatPageLenis || window.lenis)) pausedController.start();
    pausedController = null;
  };
  const selectScene = entry => {
    clearScene();
    if (entry.uiOnly) return;
    const scene = sceneFor(entry.base);
    scene.querySelectorAll('img[data-art-id]').forEach(base => {
      if (base === entry.base || base.dataset.artId === entry.base.dataset.artId) return;
      const a = entry.base.getBoundingClientRect(), b = base.getBoundingClientRect();
      const overlapWidth = Math.min(a.right,b.right)-Math.max(a.left,b.left);
      const overlapHeight = Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
      // Separate drawings in normal flow must remain visible. Suppress only
      // genuinely overlapping visuals during the active image's reveal.
      if (overlapWidth <= 0 || overlapHeight <= 0) return;
      (base.closest('.ink-mask') || base).setAttribute('data-ornat-scene-secondary','');
      entries.get(base)?.layer?.setAttribute('data-ornat-scene-secondary','');
    });
  };
  const visibleEntry = direction => {
    const vh = innerHeight || document.documentElement.clientHeight;
    let winner = null, best = -Infinity;
    entries.forEach(entry => {
      if (!entry.ready || !entry.base.isConnected) return;
      const p = entry.revealProgress || 0;
      if (direction > 0 ? p >= 1 : p <= 0) return;
      const rect = entry.base.getBoundingClientRect();
      if (rect.width < 100 || rect.height < 100 || rect.bottom < vh*.3 || rect.top > vh*.55) return;
      let alpha = 1;
      for (let host = entry.base; host && host !== document.body; host = host.parentElement) {
        const style = getComputedStyle(host);
        if (style.display === 'none' || style.visibility === 'hidden') { alpha = 0; break; }
        alpha *= Number(style.opacity);
      }
      if (alpha < .5) return;
      const visibleHeight = Math.max(0, Math.min(rect.bottom,vh)-Math.max(rect.top,0));
      const score = visibleHeight * Math.min(rect.width,innerWidth) - Math.abs((rect.top+rect.bottom)/2-vh/2)*50;
      if (score > best) { best = score; winner = entry; }
    });
    return winner;
  };
  const consumeReveal = (delta, event) => {
    return false; // scroll-linked mode: input is never swallowed and Lenis is never stopped.
    if (!delta || reduced.matches || !event.cancelable || bypassGesture === gesture) return false;
    const target = event.target;
    if (target instanceof Element && target.closest('input,textarea,select,button,[contenteditable]:not([contenteditable="false"]),dialog,[role="dialog"],.header-menu,[data-lenis-prevent]')) return false;
    const direction = Math.sign(delta);
    if (heldEntry) {
      const rect = heldEntry.base.getBoundingClientRect();
      if (!heldEntry.base.isConnected || rect.bottom <= 0 || rect.top >= innerHeight) {
        heldEntry = null;
        resumePage();
        clearScene();
      }
    }
    // A completed gesture releases the page; do not start another image on
    // the same wheel tick, even when two modules touch the viewport.
    if (heldEntry && (direction > 0 ? heldEntry.revealProgress >= 1 : heldEntry.revealProgress <= 0)) {
      if (heldGesture === gesture) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return true;
      }
      // The next distinct gesture belongs wholly to page navigation; do not
      // capture another image halfway through the same trackpad momentum.
      bypassGesture = gesture;
      release();
      return false;
    }
    const entry = heldEntry || visibleEntry(direction);
    if (!entry) { clearScene(); return false; }
    heldEntry = entry;
    heldGesture = gesture;
    const controller = window.ornatPageLenis || window.lenis;
    if (!pausedController && controller?.stop && !controller.isStopped) {
      pausedController = controller;
      controller.stop(); // Also cancels momentum from the previous scene.
    }
    selectScene(entry);
    event.preventDefault();
    event.stopImmediatePropagation();
    const distance = Math.max(420,(innerHeight || 720)*.9);
    entry.revealProgress = clamp((entry.revealProgress || 0)+delta/distance);
    applyUIProgress(entry,entry.revealProgress);
    entry.base.dataset.revealPhase = entry.revealProgress >= 1 ? 'complete' : 'revealing';
    schedule();
    return true;
  };
  // Capture input before the site's Lenis handler: it must not move the page
  // during the reveal. Native scrolling resumes without changing scrollTop.
  window.addEventListener('wheel',event => {
    if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    const now = performance.now();
    if (now-lastWheelAt > 180) gesture++;
    lastWheelAt = now;
    clearTimeout(wheelEndTimer);
    wheelEndTimer = setTimeout(resumePage,190);
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
    consumeReveal(delta,event);
  },{capture:true,passive:false});
  window.addEventListener('touchstart',event => {
    gesture++;
    touchY = event.touches.length === 1 ? event.touches[0].clientY : null;
  },{capture:true,passive:true});
  window.addEventListener('touchmove',event => {
    if (touchY === null || event.touches.length !== 1) return;
    const next = event.touches[0].clientY;
    consumeReveal(touchY-next,event);
    touchY = next;
  },{capture:true,passive:false});
  const endTouch = () => { touchY = null; resumePage(); };
  window.addEventListener('touchend',endTouch,{passive:true});
  window.addEventListener('touchcancel',endTouch,{passive:true});
  window.addEventListener('keydown',event => {
    if (event.key === 'Escape') { release(); return; }
    if (event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return;
    const t = event.target;
    if (t instanceof Element && t.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),a,button,[role="button"],[role="tab"],dialog,[role="dialog"],.header-menu,[data-lenis-prevent]')) return;
    const lenis = window.ornatPageLenis || window.lenis;
    if (!lenis || typeof lenis.scrollTo !== 'function') return;
    const vh = innerHeight || 800;
    const now = Number(lenis.targetScroll ?? lenis.animatedScroll ?? lenis.scroll) || 0;
    const page = vh*.85;
    const steps = {ArrowDown:90,ArrowUp:-90,PageDown:page,PageUp:-page,' ':(event.shiftKey?-page:page)};
    let target;
    if (event.key in steps) target = now + steps[event.key];
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = lenis.limit;
    else return;
    event.preventDefault();
    target = Math.max(0,Math.min(lenis.limit,target));
    lenis.scrollTo(target,{duration:Math.abs(target-now) > 400 ? 1.1 : .55,easing:x => 1 - Math.pow(1-x,4)});
  },{capture:true});
  window.addEventListener('keyup',resumePage,{capture:true});
  window.addEventListener('blur',release);
  document.addEventListener('click',event => {
    if (event.target instanceof Element && event.target.closest('a,button,[role="button"]')) release();
  },{capture:true});
  const renderFor = img => {
    if (img.hasAttribute('data-ornat-abstract')) return null;
    const id = img.dataset.artId;
    if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return null;
    if (availableRenders && !availableRenders.has(id)) return null;
    return img.dataset.renderSrc || `https://ornat-ux.vercel.app/assets/ornat-render-${encodeURIComponent(id)}-web.webp`;
  };
  const preload = src => {
    if (!renders.has(src)) {
      renders.set(src, new Promise(resolve => {
        const probe = new Image();
        probe.onload = () => resolve(probe.naturalWidth > 0);
        probe.onerror = () => resolve(false);
        probe.src = src;
      }));
    }
    return renders.get(src);
  };
  // People who ask for reduced motion keep exact, unsmoothed scrolling (no easing, no inertia).
  const calmScroll = () => {
    const lenis = window.ornatPageLenis || window.lenis;
    // Lenis must stay in charge (the wrapper has overflow:hidden, so native scroll is unavailable);
    // lerp 1 means every wheel/touch delta lands immediately, with no easing or momentum.
    if (lenis?.options && reduced.matches) { lenis.options.lerp = 1; lenis.options.syncTouchLerp = 1; lenis.options.touchInertiaMultiplier = 0; }
  };
  const update = () => {
    frame = 0;
    calmScroll();
    const vh = innerHeight || document.documentElement.clientHeight;
    let activeEntry = null, activeMid = Infinity;
    entries.forEach((entry, base) => {
      if (!base.isConnected) {
        if (heldEntry === entry) { heldEntry = null; resumePage(); clearScene(); }
        entry.layer?.remove();
        pendingLoads.delete(base);
        loadObserver?.unobserve(base);
        entries.delete(base);
        return;
      }
      if (!entry.ready) return;
      const rect = base.getBoundingClientRect();
      const style = getComputedStyle(base);
      if (reduced.matches && rect.top <= vh*.8) {
        entry.revealProgress = 1;
        applyUIProgress(entry,1);
      }
      if (entry.uiOnly) return;
      const progress = progressFor(entry,rect,vh);
      if (progress > 0 && !entry.uiApplied) { entry.uiApplied = true; applyUIProgress(entry,progress); }
      base.dataset.revealPhase = progress >= 1 ? 'complete' : progress > 0 ? 'revealing' : 'idle';
      if (progress > 0 && progress < 1) {
        const mid = Math.abs((rect.top+rect.bottom)/2 - vh/2);
        if (!activeEntry || mid < activeMid) { activeEntry = entry; activeMid = mid; }
      }
      if (entry.svgImage) {
        // Compose the scroll gate with the existing organic SVG mask. Its path,
        // data-start/data-end and GSAP timeline remain completely untouched.
        entry.svgImage.style.opacity = String(progress);
        entry.svgImage.style.visibility = progress > 0 ? entry.priorVisibility : 'hidden';
        return;
      }
      const layer = entry.layer;
      // Same offset parent as the base: no reparenting, no host changes.
      layer.style.left = `${base.offsetLeft}px`;
      layer.style.top = `${base.offsetTop}px`;
      layer.style.width = `${base.offsetWidth}px`;
      layer.style.height = `${base.offsetHeight}px`;
      // Copy the visual transform, never write to the GSAP-controlled base.
      layer.style.transform = style.transform;
      if (base.dataset.artTransition === 'isometric-3d') {
        base.style.setProperty('--ornat-plan-reveal',`${progress*100}%`);
        layer.setAttribute('data-isometric','');
      }
      layer.style.transformOrigin = style.transformOrigin;
      layer.style.borderRadius = style.borderRadius;
      layer.style.visibility = style.visibility;
      layer.style.opacity = progress > 0 && style.display !== 'none' ? style.opacity : '0';
      layer.style.setProperty('--ornat-reveal', `${progress*100}%`);
      const complete = progress >= 1;
      if (complete !== layer.hasAttribute('data-render-complete')) layer.toggleAttribute('data-render-complete',complete);
      entry.image.style.objectFit = style.objectFit || 'contain';
      entry.image.style.objectPosition = style.objectPosition || '50% 50%';
    });
    if (activeEntry) selectScene(activeEntry); else clearScene();
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  const register = base => {
    if (entries.has(base) || base.closest(excluded)) return;
    const src = renderFor(base);
    if (!src) return;
    const mask = base.closest('.ink-mask');
    const layer = document.createElement('span');
    layer.className = 'ornat-render-layer';
    layer.setAttribute('aria-hidden','true');
    const image = document.createElement('img');
    image.className = 'ornat-render-image';
    image.alt = '';
    image.decoding = 'async';
    layer.append(image);
    // A sibling inherits map guard visibility and the original host transforms.
    base.insertAdjacentElement('afterend',layer);
    const entry = {base,initialTop:originFor(base),layer,image,ready:false,opening:isOpeningArt(base)};
    entries.set(base,entry);
    image.onload = () => {
      entry.ready = image.naturalWidth > 0;
      if (entry.ready && mask) mask.setAttribute('data-ornat-render-pair',base.dataset.artId);
      schedule();
    };
    image.onerror = () => { entry.ready = false; layer.style.opacity = '0'; };
    loadWhenNear(base,()=>{image.src = src;});
    base.addEventListener('load',schedule,{once:true});
    schedule();
  };
  const scan = root => {
    if (root instanceof Element && root.matches('img[data-art-id]')) register(root);
    if (root.querySelectorAll) root.querySelectorAll('img[data-art-id]').forEach(register);
    // Handwritten UI stays fixed. Only real pencil/render image pairs consume
    // a reveal gesture; text-only sections scroll normally.
  };
  const start = async () => {
    try {
      const response = await fetch('/templates/ux/ornat-render-availability.json');
      if (!response.ok) throw new Error('Render manifest unavailable');
      availableRenders = new Set(await response.json());
    } catch { availableRenders = new Set(); }
    scan(document);
    // Barba adds fresh page containers. Ignore every style/class mutation
    // generated by GSAP and ignore our own overlay nodes.
    const observer = new MutationObserver(records => {
      records.forEach(record => {
        if (record.type === 'attributes') register(record.target);
        else record.addedNodes.forEach(node => {
          if (node.nodeType === 1 && !node.matches('.ornat-render-layer, .ornat-render-image')) scan(node);
        });
      });
      if (records.some(record => record.removedNodes.length)) schedule();
    });
    observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-art-id']});
    addEventListener('scroll',schedule,{passive:true});
    // Native element scroll events do not bubble. Capture the original Lenis
    // wrapper's scroll and any replacement wrapper after Barba navigation.
    document.addEventListener('scroll',schedule,{capture:true,passive:true});
    if (window.lenis?.on) window.lenis.on('scroll',schedule);
    addEventListener('resize',schedule,{passive:true});
    reduced.addEventListener('change',() => { release(); schedule(); });
    // Refresh and scroll-end are finite events, not an extra animation loop.
    // Wrappers transformed by GSAP already move the sibling pair together.
    if (window.ScrollTrigger?.addEventListener) {
      window.ScrollTrigger.addEventListener('refresh',schedule);
      window.ScrollTrigger.addEventListener('scrollEnd',schedule);
    }
    schedule();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
