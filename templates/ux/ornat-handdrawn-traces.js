/* Static pencil irregularity for vector UI; photographic reveal layers are excluded. */
(() => {
  const install = () => {
    if (!document.getElementById('ornat-pencil-trace-filters')) {
      const defs = document.createElementNS('http://www.w3.org/2000/svg','svg');
      defs.id='ornat-pencil-trace-filters';
      defs.setAttribute('aria-hidden','true');
      defs.style.cssText='position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
      defs.innerHTML='<defs><filter id="ornat-pencil-trace" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".18" numOctaves="2" seed="23" result="grain"/><feDisplacementMap in="SourceGraphic" in2="grain" scale=".7" xChannelSelector="R" yChannelSelector="G"/></filter></defs>';
      document.body.prepend(defs);
    }
    document.querySelectorAll('svg').forEach(svg => {
      if (svg.closest('#ornat-pencil-trace-filters,.header-logo-item,.footer-logo,.loading,.ornat-render-layer')) return;
      if (svg.querySelector('image,mask,clipPath,filter,foreignObject') || /ORNAT|OUX/i.test(svg.getAttribute('aria-label') || '')) return;
      if (svg.querySelector('path,line,polyline,polygon,rect,circle,ellipse')) svg.setAttribute('data-ornat-handdrawn','');
    });
  };
  const start = () => {
    install();
    new MutationObserver(records => {
      if (records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1 && !n.closest?.('#ornat-pencil-trace-filters') && (n.matches?.('svg') || n.querySelector?.('svg'))))) install();
    }).observe(document.body,{subtree:true,childList:true});
  };
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
