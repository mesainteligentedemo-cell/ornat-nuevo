(() => {
  'use strict';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const clamp=n=>Math.min(1,Math.max(0,n));
  let content,scroller,opening,art=[],frame=0,observer;
  const eligible='img[data-ornat-service3d]';
  const update=()=>{
    frame=0;
    if(!content?.isConnected)return;
    const vh=innerHeight;
    for(const item of art){
      const rect=item.image.getBoundingClientRect();
      if(!rect.width || !rect.height)continue;
      // Use the stationary parent to avoid feeding the image translation back into progress.
      const box=item.anchor.getBoundingClientRect();
      const p=reduced.matches ? 1 : clamp((vh*.96-box.top)/(vh*.52));
      const ease=1-Math.pow(1-p,3);
      const amount=innerWidth<768?16:32;
      item.image.style.setProperty('--ornat-art-y',`${((1-ease)*amount).toFixed(2)}px`);
      item.image.style.setProperty('--ornat-art-opacity',`${(.18+.82*ease).toFixed(3)}`);
    }
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
  const geometry=()=>{
    if(opening){
      const height=opening.getBoundingClientRect().height;
      opening.style.setProperty('--ornat-opening-top',`${-Math.max(0,height-innerHeight)}px`);
    }
    schedule();
  };
  const configure=()=>{
    const lenis=window.ornatPageLenis || window.lenis;
    if(lenis?.options){
      // Reuse the original controller/ticker. Touch keeps native-sized gestures.
      lenis.options.lerp=reduced.matches?1:.085;
      lenis.options.wheelMultiplier=1;
      lenis.options.syncTouch=false;
    }
    const triggers=window.ScrollTrigger?.getAll?.() || [];
    for(const trigger of triggers){
      if(opening && trigger.pin && opening.contains(trigger.pin))trigger.kill(true);
    }
    geometry();
  };
  const mount=()=>{
    const candidates=[...document.querySelectorAll('.main-inner .main-content')];
    const next=candidates.at(-1) || document.querySelector('.main-content');
    if(!next || next===content)return;
    if(scroller)scroller.removeEventListener('scroll',schedule);
    observer?.disconnect();
    content=next;scroller=content.closest('.main-inner') || document.scrollingElement;
    content.classList.add('ornat-editorial-flow');
    const first=content.firstElementChild;
    opening=first && /^(HOME|PRODUCT)-HERO-WRAP$/.test(first.tagName)?first:null;
    opening?.classList.add('ornat-editorial-opening');
    art=[...content.querySelectorAll(eligible)].filter(image=>
      !image.closest('.loading,.footer-logo-wrap,.home-usecase-img-list,.about-hero-list,.home-map-main-inner')
    ).map(image=>{
      image.classList.add('ornat-editorial-art');
      image.addEventListener('load',geometry,{once:true});
      return {image,anchor:image.closest('.ink-mask') || image.parentElement};
    });
    scroller.addEventListener('scroll',schedule,{passive:true});
    observer=new ResizeObserver(geometry);observer.observe(content);
    configure();
    window.__HERON_APP_LOADER__?.then?.(configure);
    // Refresh after the existing loader and responsive module timelines settle.
    setTimeout(configure,1200);
  };
  addEventListener('resize',geometry,{passive:true});
  addEventListener('scroll',schedule,{passive:true});
  reduced.addEventListener('change',configure);
  const start=()=>{
    mount();
    // Barba replaces the page container; never observe animation style mutations.
    new MutationObserver(records=>{
      if(!content?.isConnected || records.some(record=>[...record.addedNodes].some(node=>node.nodeType===1 &&
        (node.matches?.('.main-inner,.main-content') || node.querySelector?.('.main-content')))))mount();
    }).observe(document.body,{childList:true,subtree:true});
    window.barba?.hooks?.afterEnter?.(mount);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
