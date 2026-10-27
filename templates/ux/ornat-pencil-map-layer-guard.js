/* Keep exactly one overlapping map sheet visible; never mutate GSAP values. */
(() => {
  const mounted = new WeakSet();
  const start = () => {
    document.querySelectorAll('.about-hero-list').forEach(stack => {
      if (mounted.has(stack)) return;
      mounted.add(stack);
      const sheets = [...stack.children].filter(el => el.matches('.about-hero-item'));
      const reconcile = () => {
        let winner = null, best = 0.015;
        // The logo's container stays at opacity 1 while its paths animate.
        // It must not hide the introductory photographs before they fade out.
        const pictures = sheets.filter(sheet => sheet.querySelector(':scope > img'));
        pictures.forEach(sheet => {
          const style = getComputedStyle(sheet);
          const alpha = Number(style.opacity);
          // Visibility is managed separately; only original opacity selects
          // the winner, so a suppressed sheet can become visible again.
          if (style.display !== 'none' && alpha >= best) { best = alpha; winner = sheet; }
        });
        if (!winner) winner = sheets.find(sheet => !pictures.includes(sheet)) || null;
        sheets.forEach(sheet => {
          const hide = !!winner && sheet !== winner;
          if (hide !== sheet.hasAttribute('data-ornat-layer-suppressed')) {
            sheet.toggleAttribute('data-ornat-layer-suppressed', hide);
          }
        });
      };
      let queued = false;
      const schedule = () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; reconcile(); });
      };
      const observer = new MutationObserver(schedule);
      sheets.forEach(sheet => observer.observe(sheet, {attributes:true, attributeFilter:['style','class']}));
      reconcile();
    });
    document.querySelectorAll('.home-map-main-inner').forEach(stack => {
      if (mounted.has(stack)) return;
      mounted.add(stack);
      const layers = [...stack.children].filter(el => el.matches('.home-map-main-img'));
      const sheets = layers.filter(layer => layer.querySelector('img[data-art-id]'));
      const section = stack.closest('.home-map-main');
      if (!sheets.length || !section) return;
      // Decorative SVG/label layers have no architectural sheet. The former
      // opacity fallback picked them and hid every real image. Select from the
      // actual sheets using the sticky section's travel, without reading back
      // opacity that our fallback itself overrides.
      let queued = false;
      const reconcile = () => {
        queued = false;
        if (!stack.isConnected) {
          document.removeEventListener('scroll',schedule,true);
          removeEventListener('resize',schedule);
          return;
        }
        const bounds = section.getBoundingClientRect();
        const travel = Math.max(1,bounds.height-stack.getBoundingClientRect().height);
        const progress = Math.max(0,Math.min(.999999,-bounds.top/travel));
        const winner = sheets[Math.floor(progress*sheets.length)];
        layers.forEach(layer => {
          layer.toggleAttribute('data-ornat-map-sheet',layer === winner);
          layer.toggleAttribute('data-ornat-layer-suppressed',layer !== winner);
        });
      };
      const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(reconcile); } };
      document.addEventListener('scroll',schedule,{capture:true,passive:true});
      addEventListener('resize',schedule,{passive:true});
      stack.querySelectorAll('img').forEach(img => img.addEventListener('load',schedule,{once:true}));
      schedule();
    });
  };
  new MutationObserver(records => {
    if (records.some(record => [...record.addedNodes].some(node =>
      node.nodeType === 1 && (node.matches?.('.about-hero-list,.home-map-main-inner') ||
      node.querySelector?.('.about-hero-list,.home-map-main-inner'))))) start();
  }).observe(document.documentElement,{childList:true,subtree:true});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
