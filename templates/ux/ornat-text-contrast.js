/* Resolve ink against the actual surface, including transparent nested labels. */
(() => {
  const ink = [37,35,31], paper = [246,243,234];
  const luminance = rgb => rgb.map(v => { v /= 255; return v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4; }).reduce((sum,v,i) => sum+v*[.2126,.7152,.0722][i],0);
  const ratio = (a,b) => (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  const parse = value => {
    const parts = value.match(/[\d.]+/g)?.map(Number);
    return parts?.length >= 3 ? [...parts.slice(0,3),parts[3] ?? 1] : [0,0,0,0];
  };
  const surface = element => {
    const layers = [];
    for (let host=element;host;host=host.parentElement) {
      const color = parse(getComputedStyle(host).backgroundColor);
      if (color[3]) layers.push(color);
      if (color[3] >= 1) break;
    }
    return layers.reverse().reduce((bg,c) => bg.map((v,i) => c[i]*c[3]+v*(1-c[3])),paper);
  };
  let timer;
  const update = () => {
    document.querySelectorAll('body *:not(svg):not(svg *)').forEach(element => {
      if (element.matches('script,style,template,.ornat-render-layer,.ornat-render-image')) return;
      const text = [...element.childNodes].some(node => node.nodeType === 3 && node.textContent.trim());
      if (!text && !element.matches('input,textarea,select,button')) return;
      const background = luminance(surface(element));
      const tone = ratio(luminance(paper),background) > ratio(luminance(ink),background) ? 'light' : 'dark';
      if (element.dataset.ornatInk !== tone) element.dataset.ornatInk = tone;
    });
  };
  const schedule = () => { if (timer) return; timer=setTimeout(() => { timer=null; update(); },120); };
  const start = () => {
    update();
    // Transform/opacity animation ticks do not change the surface contrast.
    const background = value => (value || '').match(/background(?:-color)?\s*:[^;]*/g)?.join(';') || '';
    new MutationObserver(records => {
      if (records.some(r => r.type === 'childList' || r.attributeName === 'class' ||
          background(r.oldValue) !== background(r.target.getAttribute('style')))) schedule();
    }).observe(document.body,{subtree:true,childList:true,attributes:true,attributeOldValue:true,attributeFilter:['class','style']});
    document.addEventListener('pointerover',schedule,{passive:true});
    document.addEventListener('focusin',schedule);
    addEventListener('resize',schedule,{passive:true});
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
