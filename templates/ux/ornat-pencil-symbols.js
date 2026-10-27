/* One static native SVG filter, applied only to small interface symbols. */
(() => {
  const NS='http://www.w3.org/2000/svg';
  const candidates='.embed-ic svg,.header-ham svg,.home-hero-img-deco-ic svg,.home-usecase-faq-item-ic svg';
  const excluded='.loading,.ink-mask,.header-logo,.footer-logo,.home-map-main-img,.home-hero-img-inner';
  function ensureFilter() {
    if(document.getElementById('ornat-pencil-symbol-grain')) return;
    const holder=document.createElementNS(NS,'svg');
    holder.setAttribute('width','0');holder.setAttribute('height','0');
    holder.setAttribute('aria-hidden','true');holder.setAttribute('focusable','false');
    holder.style.cssText='position:fixed;pointer-events:none;overflow:hidden';
    const defs=document.createElementNS(NS,'defs');
    const filter=document.createElementNS(NS,'filter');
    filter.id='ornat-pencil-symbol-grain';
    for(const [name,value] of Object.entries({x:'-6%',y:'-6%',width:'112%',height:'112%','color-interpolation-filters':'sRGB'}))filter.setAttribute(name,value);
    const noise=document.createElementNS(NS,'feTurbulence');
    for(const [name,value] of Object.entries({type:'fractalNoise',baseFrequency:'.72',numOctaves:'1',seed:'12',result:'pencilNoise'}))noise.setAttribute(name,value);
    const displacement=document.createElementNS(NS,'feDisplacementMap');
    for(const [name,value] of Object.entries({in:'SourceGraphic',in2:'pencilNoise',scale:'.22',xChannelSelector:'R',yChannelSelector:'G'}))displacement.setAttribute(name,value);
    filter.append(noise,displacement);defs.append(filter);holder.append(defs);document.body.append(holder);
  }
  function init() {
    ensureFilter();
    let count=0;
    document.querySelectorAll(candidates).forEach(svg=>{
      if(svg.closest(excluded)||svg.querySelector('mask,clipPath,image,filter'))return;
      const vb=svg.viewBox?.baseVal;
      if(!vb||vb.width>96||vb.height>96)return;
      if(count++<32)svg.setAttribute('data-pencil-symbol','');
      else svg.removeAttribute('data-pencil-symbol');
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
  let queued=false;
  new MutationObserver(records=>{
    if(queued||!records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches?.(candidates)||n.querySelector?.(candidates)))))return;
    queued=true;requestAnimationFrame(()=>{queued=false;init();});
  }).observe(document.documentElement,{childList:true,subtree:true});
})();
