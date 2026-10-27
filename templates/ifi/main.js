(() => {
  'use strict';
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const isMobile = () => window.innerWidth < 768;
  const hasGSAP = typeof window.gsap !== 'undefined';
  if (hasGSAP && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  /* ---------------- Lenis ---------------- */
  let lenis = null;
  if (!RM && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9 });
    window.lenis = lenis;
    lenis.stop();
    if (hasGSAP) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  const scrollToTarget = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.6 });
    else el.scrollIntoView({ behavior: RM ? 'auto' : 'smooth' });
  };
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const h = a.getAttribute('href');
      if (h.length < 2) return;
      e.preventDefault();
      closeMenu();
      setTimeout(() => scrollToTarget(h), 60);
    });
  });

  /* ---------------- Menu ---------------- */
  const menu = document.getElementById('menu');
  const menuBtn = document.getElementById('menuOpen');
  function openMenu() {
    menu.classList.add('is-open'); menu.setAttribute('aria-hidden', 'false');
    menuBtn.setAttribute('aria-expanded', 'true');
    if (lenis) lenis.stop();
    setTimeout(() => menu.querySelector('.menu__close').focus(), 50);
    if (hasGSAP && !RM) gsap.fromTo('.menu__list li', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: .9, stagger: .06, ease: 'expo.out', delay: .2 });
  }
  function closeMenu() {
    if (!menu.classList.contains('is-open')) return;
    menu.classList.remove('is-open'); menu.setAttribute('aria-hidden', 'true');
    menuBtn.setAttribute('aria-expanded', 'false');
    if (lenis) lenis.start();
    menuBtn.focus({ preventScroll: true });
  }
  menuBtn.addEventListener('click', openMenu);
  menu.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', e => { if (el.tagName !== 'A') e.preventDefault(); closeMenu(); }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  /* ---------------- Cookies ---------------- */
  const cookies = document.getElementById('cookies');
  function showCookies() {
    let seen = null;
    try { seen = localStorage.getItem('ornat-cookies'); } catch (e) {}
    if (seen) return;
    cookies.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => cookies.classList.add('is-in')));
  }
  cookies.querySelectorAll('[data-cookie]').forEach(b => b.addEventListener('click', () => {
    try { localStorage.setItem('ornat-cookies', b.dataset.cookie); } catch (e) {}
    cookies.classList.remove('is-in');
    setTimeout(() => { cookies.hidden = true; }, 800);
  }));

  /* ---------------- Particle engine ---------------- */
  const rand = (a, b) => a + Math.random() * (b - a);
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  class Field {
    constructor(canvas) {
      this.c = canvas; this.ctx = canvas.getContext('2d');
      this.pts = []; this.p = RM ? 1 : 0; this.visible = false; this.t = 0;
      this.resize();
      const io = new IntersectionObserver(es => es.forEach(e => { this.visible = e.isIntersecting; }), { rootMargin: '100px' });
      io.observe(canvas);
    }
    resize() {
      const r = this.c.getBoundingClientRect();
      this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
      this.c.width = Math.round(this.w * DPR); this.c.height = Math.round(this.h * DPR);
      this.ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      if (this.ready && this.reseed && this.small !== isMobile()) this.reseed();
    }
    drawPts(list) {
      const ctx=this.ctx,w=this.w,h=this.h;ctx.clearRect(0,0,w,h);
      if(this.mode!=='glow') {
        const haze=ctx.createRadialGradient(w*.5,h*.49,0,w*.5,h*.49,Math.min(w,h)*.51);
        haze.addColorStop(0,'rgba(201,183,140,0.075)');haze.addColorStop(1,'rgba(201,183,140,0)');
        ctx.fillStyle=haze;ctx.globalAlpha=1;ctx.fillRect(0,0,w,h);
        ctx.save();ctx.translate(w*.5,h*.81);ctx.scale(1,.16);
        const shadow=ctx.createRadialGradient(0,0,0,0,0,Math.min(w,h)*.36);
        shadow.addColorStop(0,'rgba(0,0,0,.72)');shadow.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=shadow;ctx.fillRect(-w/2,-h/2,w,h);ctx.restore();
      }
      // Cached spherical pearl sprites retain painter order without thousands of gradients.
      if(!this.grains&&typeof document!=='undefined') {
        const atlas=document.createElement('canvas');atlas.width=40*16;atlas.height=16;
        const ac=atlas.getContext('2d');
        for(let i=0;i<40;i++) {
          const l=i/39,r=Math.round(43+207*l),g=Math.round(40+203*l),b=Math.round(34+193*l);
          const pearl=ac.createRadialGradient(i*16+5,4,0,i*16+8,8,7);
          pearl.addColorStop(0,`rgba(${Math.min(255,r+32)},${Math.min(255,g+31)},${Math.min(255,b+26)},1)`);
          pearl.addColorStop(.38,`rgba(${r},${g},${b},1)`);
          pearl.addColorStop(.88,`rgba(${Math.round(r*.66)},${Math.round(g*.66)},${Math.round(b*.66)},1)`);
          pearl.addColorStop(1,`rgba(${r},${g},${b},0)`);
          ac.fillStyle=pearl;ac.fillRect(i*16,0,16,16);
        }
        this.grains=atlas;
      }
      for(const q of list) {
        if(q.a<.025||q.x<0||q.y<0||q.x>w||q.y>h)continue;
        ctx.globalAlpha=q.a;
        if(this.grains&&q.surface) ctx.drawImage(this.grains,q.tone*16,0,16,16,q.x-q.s*.5,q.y-q.s*.5,q.s,q.s);
        else {ctx.fillStyle=q.color||'#f2ecdd';ctx.beginPath();ctx.arc(q.x,q.y,q.s*.5,0,Math.PI*2);ctx.fill();}
      }
      ctx.globalAlpha=1;
    }
  }

  // All vertices live in world-space XYZ; the camera projects a fresh view each frame.
  class Draft {
    constructor() { this.lines = []; this.faces = []; }
    face(v,normal,material=1) { this.faces.push({v,normal,material}); }
    line(a,b,alpha=.72) { this.lines.push({a,b,alpha}); }
    path(v,alpha=.72,close=false) {
      for(let i=1;i<v.length;i++) this.line(v[i-1],v[i],alpha);
      if(close) this.line(v[v.length-1],v[0],alpha);
    }
    box(x,y,z,w,h,depth,alpha=.72) {
      const v=[[x,y,z],[x+w,y,z],[x+w,y+h,z],[x,y+h,z],[x,y,z+depth],[x+w,y,z+depth],[x+w,y+h,z+depth],[x,y+h,z+depth]];
      [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]].forEach(([a,b])=>this.line(v[a],v[b],alpha));
      [[[0,3,2,1],[0,0,-1]],[[4,5,6,7],[0,0,1]],[[0,4,7,3],[-1,0,0]],[[1,2,6,5],[1,0,0]],[[3,7,6,2],[0,1,0]],[[0,1,5,4],[0,-1,0]]].forEach(([indices,n])=>this.face(indices.map(i=>v[i]),n,alpha));
    }
    ring(r,y,tilt=0,alpha=.5) {
      const v=Array.from({length:97},(_,i)=>{const a=i/96*Math.PI*2,z=Math.sin(a)*r;return [Math.cos(a)*r,y-z*Math.sin(tilt),z*Math.cos(tilt)];});
      this.path(v,alpha);
    }
    prism(poly,depth=.25,alpha=.92) {
      const f=poly.map(([x,y])=>[x,y,depth/2]),b=poly.map(([x,y])=>[x,y,-depth/2]);
      this.path(f,alpha,true);this.path(b,alpha*.56,true);
      f.forEach((q,i)=>this.line(q,b[i],alpha*.65));
      this.face(f,[0,0,1],alpha);this.face(b,[0,0,-1],alpha);
      let area=0;poly.forEach((v,i)=>{const n=poly[(i+1)%poly.length];area+=v[0]*n[1]-n[0]*v[1];});
      f.forEach((q,i)=>{const j=(i+1)%f.length,dx=f[j][0]-q[0],dy=f[j][1]-q[1],len=Math.hypot(dx,dy),sign=area>0?1:-1;this.face([q,b[i],b[j],f[j]],[dy/len*sign,-dx/len*sign,0],alpha);});
      // Parallel contour slices illuminate the extrusion, not a flat duplicate silhouette.
      for(let j=1;j<5;j++) this.path(poly.map(([x,y])=>[x,y,-depth/2+j*depth/5]),alpha*.2,true);
    }
    points(cap) {
      const out=[],surfaceBudget=Math.floor(cap*.9),areas=this.faces.map(f=>{
        const n=f.normal,axis=Math.abs(n[0])>.5?0:Math.abs(n[1])>.5?1:2,axes=[0,1,2].filter(a=>a!==axis);
        f.axis=axis;f.axes=axes;let area=0;
        f.v.forEach((v,i)=>{const q=f.v[(i+1)%f.v.length];area+=v[axes[0]]*q[axes[1]]-q[axes[0]]*v[axes[1]];});
        // Side walls of a diagonal glyph need actual surface area, not flattened XY area.
        return Math.max(.001,Math.abs(area)*.5/Math.max(.01,Math.abs(n[axis])));
      });
      const totalArea=areas.reduce((a,b)=>a+b,0),step=Math.sqrt(totalArea/surfaceBudget);
      const hash=v=>{const n=Math.sin(v*127.1+311.7)*43758.5453123;return n-Math.floor(n);};
      this.faces.forEach((f,fi)=>{
        const [ax,ay]=f.axes,n=f.normal,lo=[Math.min(...f.v.map(v=>v[ax])),Math.min(...f.v.map(v=>v[ay]))],hi=[Math.max(...f.v.map(v=>v[ax])),Math.max(...f.v.map(v=>v[ay]))];
        const inside=(x,y)=>{let yes=false;for(let i=0,j=f.v.length-1;i<f.v.length;j=i++) {const a=f.v[i],b=f.v[j];if((a[ay]>y)!==(b[ay]>y)&&x<(b[ax]-a[ax])*(y-a[ay])/(b[ay]-a[ay])+a[ax])yes=!yes;}return yes;};
        const target=Math.max(1,Math.floor(surfaceBudget*areas[fi]/totalArea));
        const sx=step*Math.max(.4,Math.abs(n[f.axis])),candidates=[];
        let cell=0;
        for(let x=lo[0]+sx*.5;x<hi[0];x+=sx)for(let y=lo[1]+step*.5;y<hi[1];y+=step) {
          const id=fi*8171+cell++,jx=x+(hash(id)-.5)*sx*.85,jy=y+(hash(id+7)-.5)*step*.85;
          if(inside(jx,jy))candidates.push([jx,jy,id]);
        }
        // Each face has its own proportional quota; later facades cannot be starved.
        const count=Math.min(target,candidates.length);
        for(let j=0;j<count;j++) {
          const [x,y,id]=candidates[Math.floor(j*candidates.length/count)],v=[0,0,0];v[ax]=x;v[ay]=y;
          const base=f.v[0];v[f.axis]=base[f.axis]-(n[ax]*(x-base[ax])+n[ay]*(y-base[ay]))/n[f.axis];
          out.push({x:v[0],y:v[1],z:v[2],nx:n[0],ny:n[1],nz:n[2],surface:true,ph:id*2.399963,base:f.material,s:step*(1.08+hash(id+13)*.16),line:fi,u:hash(id+21),fringe:id%23===0,grain:hash(id+9)});
        }
      });
      const lengths=this.lines.map(l=>Math.hypot(...l.a.map((v,i)=>l.b[i]-v))),total=lengths.reduce((a,b)=>a+b,0),remaining=cap-out.length;
      this.lines.forEach((l,j)=>{const count=Math.max(2,Math.floor(remaining*lengths[j]/total));for(let i=0;i<count&&out.length<cap;i++){const u=i/(count-1);out.push({x:l.a[0]+(l.b[0]-l.a[0])*u,y:l.a[1]+(l.b[1]-l.a[1])*u,z:l.a[2]+(l.b[2]-l.a[2])*u,nx:0,ny:0,nz:1,surface:false,ph:j*2.399+i*.618,base:l.alpha,s:1.2,line:j,u});}});
      return out;
    }
  }

  function uxMark(d,k=1) {
    const shapes=[[[ -.9,.52],[-.71,.52],[-.71,-.22],[-.6,-.35],[-.34,-.35],[-.23,-.22],[-.23,.52],[-.04,.52],[-.04,-.28],[-.25,-.54],[-.7,-.54],[-.9,-.28]],[[.12,.52],[.34,.52],[.58,.16],[.82,.52],[1.04,.52],[.7,0],[1.06,-.54],[.83,-.54],[.58,-.16],[.33,-.54],[.1,-.54],[.46,0]]];
    shapes.forEach(poly=>d.prism(poly.map(([x,y])=>[x*k,y*k]),.32*k));
  }
  function villaDraft() {
    const d=new Draft();
    d.box(-1.02,-.66,-.65,2.04,.07,1.5,.6);
    d.box(-.88,-.59,-.57,1.72,.62,1.05,.38);
    d.box(-1.06,.03,-.69,2.08,.075,1.32,.95);
    d.box(-.82,.105,-.48,1.25,.53,.9,.42);
    d.box(-.99,.635,-.62,1.6,.06,1.22,.94);
    d.box(.48,-.59,-.5,.28,1.45,.52,.82);
    // Glazing mullions and ceiling louvers define real front, rear and side planes.
    for(let i=0;i<10;i++) {const x=-.82+i*.175;d.line([x,-.56,.499],[x,.015,.499],.66);}
    for(let i=0;i<8;i++) {const x=-.78+i*.167;d.line([x,.13,.439],[x,.62,.439],.68);}
    for(let i=0;i<12;i++) {const z=-.56+i*.1;d.line([-.98,.715,z],[.59,.715,z],.28);}
    d.box(-.97,-.65,.66,1.25,.04,.54,.78);
    for(let i=0;i<7;i++) {const z=.7+i*.066;d.line([-.9,-.59,z],[.2,-.59,z],.28);}
    // Terrace steps and two sculptural tropical palms.
    for(let i=0;i<3;i++) d.box(.45,-.64-i*.03,.58+i*.12,.48,.025,.13,.43);
    for(const [x,z,k] of [[-1.19,.52,.8],[1.13,-.22,1]]) {
      d.path([[x,-.65,z],[x+.045,.05*k,z-.03],[x+.1,.65*k,z]],.8);
      for(let i=0;i<7;i++){const a=i/7*Math.PI*2;d.path([[x+.1,.65*k,z],[x+.1+Math.cos(a)*.2,.76*k,z+Math.sin(a)*.2],[x+.1+Math.cos(a)*.43,.56*k,z+Math.sin(a)*.43]],.59);}
    }
    return d;
  }
  function networkDraft() {
    const d=new Draft();uxMark(d,.36);d.box(-.47,-.3,-.28,.99,.6,.2,.55);
    d.ring(1.1,0,.62,.36);d.ring(.88,0,-.75,.3);
    for(let i=0;i<8;i++) {
      const a=i/8*Math.PI*2,x=Math.cos(a)*1.1,y=Math.sin(a)*.94,z=Math.sin(a*2)*.44;
      d.box(x-.13,y-.11,z-.11,.26,.22,.22,.93);
      d.line([x*.4,y*.4,z*.4],[x,y,z],.38);
      if(i%2===0) for(let j=0;j<3;j++) d.line([x-.075+j*.07,y-.06,z+.12],[x-.075+j*.07,y+.02+j*.022,z+.12],.78);
      else d.path([[-.08,0],[-.04,.06],[0,-.04],[.04,.06],[.08,0]].map(([a,b])=>[x+a,y+b,z+.12]),.84);
    }
    return d;
  }
  function projectScene(field,kind,assembly=1) {
    const t=RM?0:field.t;
    const yaw=(kind==='villa' ? -.48 : kind==='hero' ? -.3 : .18)+Math.sin(t*.24)*.29+(kind==='network'&&!RM?t*.115:0);
    const pitch=(kind==='villa' ? .32 : kind==='hero' ? -.12 : .12)+Math.sin(t*.18)*.08;
    const co=Math.cos(yaw),si=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
    const scale=Math.min(field.w/(kind==='villa'?3.6:3.15),field.h/(kind==='villa'?2.5:3.15));
    const rotation=field.rot||0,cr=Math.cos(rotation),sr=Math.sin(rotation),zoom=field.zoom||1;
    const palette=Array.from({length:40},(_,i)=>{const l=i/39;return `rgb(${Math.round(43+207*l)},${Math.round(40+203*l)},${Math.round(34+193*l)})`;});
    return field.pts.map(q=>{
      const dissolve=!RM&&q.fringe?Math.pow(Math.max(0,Math.sin(t*.52+q.ph)),8)*.16:0;
      const spread=(1-assembly)*.65+dissolve;
      const wx=q.x+Math.cos(q.ph)*spread,wy=q.y+Math.sin(q.ph)*spread,wz=q.z+Math.sin(q.ph*.7)*spread;
      const rx=wx*co+wz*si,rz=-wx*si+wz*co,ry=wy*cp-rz*sp,z=wy*sp+rz*cp;
      const nx=q.nx*co+q.nz*si,nz0=-q.nx*si+q.nz*co,ny=q.ny*cp-nz0*sp,nz=q.ny*sp+nz0*cp;
      const perspective=4.6/(4.6-z),dx=rx*perspective*scale*zoom,dy=-ry*perspective*scale*zoom;
      const x=field.w/2+dx*cr-dy*sr,y=field.h/2+dx*sr+dy*cr;
      const diffuse=Math.max(0,-nx*.47+ny*.68+nz*.56),rim=Math.pow(1-Math.abs(nz),3)*.14;
      const grain=.85+.15*Math.sin(q.ph*17)+.12*(q.grain||0),light=Math.max(0,Math.min(1,(.18+diffuse*.79+rim)*grain*(q.surface?(.45+q.base*.55):1)));
      let a=q.surface?(nz>-.08?.99:0):q.base*.72;
      a*=(.16+.84*assembly)*(1-dissolve*2.5);
      return {x,y,s:q.surface?Math.max(1.3,q.s*scale*perspective*zoom):q.s*perspective,a:Math.min(1,a),depth:z,color:palette[Math.round(light*39)],tone:Math.round(light*39),surface:q.surface};
    }).sort((a,b)=>a.depth-b.depth);
  }

  class Stipple extends Field {
    constructor(canvas) {super(canvas);this.reseed();this.ready=true;if(RM)this.render();}
    reseed() {this.small=isMobile();this.kind=this.c.classList.contains('svc__particles')?'villa':'network';this.pts=(this.kind==='villa'?villaDraft():networkDraft()).points(this.small?5000:12000);}
    render() {if(!this.ready)return;const e=1-Math.pow(1-Math.max(0,Math.min(1,this.p)),3);this.drawPts(projectScene(this,this.kind,e));}
  }
  // A surface of travelling contours gives the architectural model the Waves treatment.
  class WaveVilla extends Field {
    constructor(canvas) {
      super(canvas);
      const draft = villaDraft();
      this.faces = draft.faces;
      this.lines = draft.lines;
      this.ready = true;
      if (RM) this.render();
    }
    render() {
      if (!this.ready) return;
      const ctx = this.ctx, w = this.w, h = this.h;
      ctx.clearRect(0, 0, w, h);
      const t = RM ? 0 : this.t;
      const assembly = 1 - Math.pow(1 - Math.max(0, Math.min(1, this.p)), 3);
      if (assembly < .005) return;
      const yaw = -.48 + (RM ? 0 : Math.sin(t * .18) * .11);
      const pitch = .32 + (RM ? 0 : Math.sin(t * .14) * .035);
      const co = Math.cos(yaw), si = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const scale = Math.min(w / 3.7, h / 2.65);
      const camera = v => {
        const x = v[0] * co + v[2] * si;
        const z0 = -v[0] * si + v[2] * co;
        const y = v[1] * cp - z0 * sp, z = v[1] * sp + z0 * cp;
        const depth = 4.6 / (4.6 - z);
        return { x: w * .5 + x * depth * scale, y: h * .51 - y * depth * scale, z };
      };
      const normalZ = n => n[1] * sp + (-n[0] * si + n[2] * co) * cp;
      const wave = (u, v, phase) => Math.sin(u * 20 - t * 1.25 + phase) * Math.sin(Math.PI * v) * .025
        + Math.sin(v * 31 + u * 8 + t * .68 + phase) * .011;
      const interpolate = (face, u, v) => {
        const p = face.v;
        return [0, 1, 2].map(k => (1-v) * ((1-u)*p[0][k] + u*p[1][k]) + v * ((1-u)*p[3][k] + u*p[2][k]));
      };
      // The terrace receives the same moving wave language as the building.
      ctx.lineWidth = .7;
      for (let row = 0; row < 17; row++) {
        ctx.beginPath();
        for (let col = 0; col <= 42; col++) {
          const x = -1.52 + col * 3.04 / 42, z = -.95 + row * 2.22 / 16;
          const y = -.73 + wave(col / 42, row / 16, 1.2) * .45;
          const p = camera([x, y, z]);
          if (col) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
        }
        ctx.strokeStyle = `rgba(225,221,209,${(.08 + row * .004) * assembly})`;
        ctx.stroke();
      }
      const faces = this.faces.map((face, index) => ({ face, index,
        depth: face.v.reduce((sum, v) => sum + camera(v).z, 0) / face.v.length,
        facing: normalZ(face.normal) })).sort((a, b) => a.depth - b.depth);
      for (const { face, index, facing } of faces) {
        if (facing < -.08 || face.v.length !== 4) continue;
        const lit = Math.max(0, .42 + face.normal[1] * .33 + facing * .26);
        ctx.beginPath();
        face.v.forEach((v, i) => { const p = camera(v); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
        ctx.closePath();
        ctx.fillStyle = `rgba(${Math.round(17 + lit * 31)},${Math.round(17 + lit * 30)},${Math.round(16 + lit * 27)},${.92 * assembly})`;
        ctx.fill();
        const bands = isMobile() ? 12 : 20;
        for (let row = 0; row <= bands; row++) {
          const v = row / bands;
          ctx.beginPath();
          for (let col = 0; col <= 28; col++) {
            const u = col / 28, point = interpolate(face, u, v);
            const offset = wave(u, v, index * .63);
            for (let k = 0; k < 3; k++) point[k] += face.normal[k] * offset;
            const p = camera(point);
            if (col) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
          }
          const crest = .6 + .4 * Math.sin(v * 27 - t * 1.25 + index);
          ctx.strokeStyle = `rgba(244,240,227,${(.16 + lit * .55) * crest * assembly})`;
          ctx.lineWidth = .65 + lit * .38;
          ctx.stroke();
        }
      }
      ctx.lineWidth = .9;
      for (const line of this.lines) {
        const a = camera(line.a), b = camera(line.b);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(249,245,231,${Math.min(.78, line.alpha * .68) * assembly})`;
        ctx.stroke();
      }
    }
  }
  class Beam extends Field {
    constructor(canvas,opts={}) {super(canvas);this.mode=opts.mode||'beam';this.rot=0;this.zoom=1;this.reseed();this.ready=true;}
    reseed() {
      this.small=isMobile();this.pts=[];
      if(this.mode==='beam') {const d=new Draft();uxMark(d);d.ring(1.35,0,.9,.32);d.ring(1.45,0,-.7,.24);this.pts=d.points(this.small?5000:12000);}
      else for(let i=0;i<(this.small?650:1500);i++)this.pts.push({gx:gauss(),gy:gauss(),ph:rand(0,6.28),f:rand(.8,2.6),s:1.1,base:rand(.35,.75)});
    }
    render() {
      if(this.mode==='beam'){this.drawPts(projectScene(this,'hero'));return;}
      const r=Math.min(this.w,this.h)*.28;
      this.drawPts(this.pts.map(q=>({x:this.w/2+q.gx*r*.9,y:this.h*.42+q.gy*r*.7,s:q.s,a:q.base*Math.max(0,1-Math.hypot(q.gx,q.gy)/2.4)*(RM?1:.55+.45*Math.sin(this.t*q.f+q.ph))*this.p})));
    }
  }

  const fields = [];
  const beamCanvas = document.getElementById('beam');
  const beam = beamCanvas ? new Beam(beamCanvas) : null; if (beam) fields.push(beam);
  const glowCanvas = document.getElementById('glow');
  const glow = glowCanvas ? new Beam(glowCanvas, { mode: 'glow' }) : null; if (glow) { glow.p = RM ? 1 : 0; fields.push(glow); }
  const stipples = [...document.querySelectorAll('canvas.particles')].map(c => c.classList.contains('svc__particles') ? new WaveVilla(c) : new Stipple(c));
  fields.push(...stipples);

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    for (const f of fields) { if (!f.visible) continue; f.t += dt; f.render(dt); }
    requestAnimationFrame(loop);
  }
  if (RM) { setTimeout(() => fields.forEach(f => { f.visible = true; f.render(0); }), 400); }
  else requestAnimationFrame(loop);
  let rT; window.addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => { fields.forEach(f => { f.resize(); if (RM) f.render(0); }); }, 150); });

  /* ---------------- Modules slider ---------------- */
  const vp = document.getElementById('modsViewport');
  const track = document.getElementById('modsTrack');
  const slides = [...track.children];
  const capEl = document.getElementById('modsCaption');
  const catEl = document.getElementById('modsCat'), nameEl = document.getElementById('modsName'), textEl = document.getElementById('modsText'), countEl = document.getElementById('modsCount');
  let idx = 0, x = 0, maxX = 0, offs = [];
  const pad2 = n => String(n).padStart(2, '0');
  function measure() {
    offs = slides.map(s => s.offsetLeft - slides[0].offsetLeft);
    const inner = vp.clientWidth - parseFloat(getComputedStyle(vp).paddingLeft) * 2;
    maxX = Math.max(0, track.scrollWidth - inner);
  }
  function setX(v, animate = true) {
    x = Math.max(-maxX - 60, Math.min(60, v));
    if (hasGSAP && animate && !RM) gsap.to(track, { x, duration: 1.1, ease: 'expo.out', overwrite: true });
    else track.style.transform = `translateX(${x}px)`;
  }
  function go(i, animate = true) {
    idx = (i + slides.length) % slides.length;
    setX(-Math.min(offs[idx], maxX), animate);
    slides.forEach((s, k) => s.classList.toggle('is-active', k === idx));
    const s = slides[idx];
    const swap = () => { catEl.textContent = s.dataset.cat; nameEl.textContent = s.dataset.title; textEl.textContent = s.dataset.text; countEl.textContent = `${pad2(idx + 1)} / ${pad2(slides.length)}`; };
    if (hasGSAP && !RM && animate) {
      gsap.timeline().to(capEl.children, { y: -14, opacity: 0, duration: .3, stagger: .03, ease: 'power2.in' }).add(swap).fromTo(capEl.children, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: .7, stagger: .05, ease: 'expo.out' });
    } else swap();
  }
  measure(); go(0, false);
  document.getElementById('modsPrev').addEventListener('click', () => go(idx - 1));
  document.getElementById('modsNext').addEventListener('click', () => go(idx + 1));
  slides.forEach((s, k) => s.addEventListener('click', () => { if (!moved) go(k); }));
  let down = false, sx = 0, sy = 0, startX = 0, moved = false, horiz = null;
  vp.addEventListener('pointerdown', e => { down = true; moved = false; horiz = null; sx = e.clientX; sy = e.clientY; startX = x; if (hasGSAP) gsap.killTweensOf(track); });
  window.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (horiz === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) horiz = Math.abs(dx) > Math.abs(dy);
    if (!horiz) return;
    moved = true; vp.classList.add('is-drag');
    setX(startX + dx, false);
  });
  window.addEventListener('pointerup', () => {
    if (!down) return; down = false; vp.classList.remove('is-drag');
    if (!moved) return;
    let best = 0, bd = Infinity;
    offs.forEach((o, k) => { const d = Math.abs(-Math.min(o, maxX) - x); if (d < bd) { bd = d; best = k; } });
    if (best === idx && Math.abs(x - startX) > 50) best = idx + (x < startX ? 1 : -1);
    go(Math.max(0, Math.min(slides.length - 1, best)));
    setTimeout(() => { moved = false; }, 50);
  });
  vp.addEventListener('keydown', e => { if (e.key === 'ArrowRight') go(idx + 1); if (e.key === 'ArrowLeft') go(idx - 1); });
  vp.tabIndex = 0; vp.setAttribute('aria-label', 'Carrusel de módulos, usa las flechas para navegar');
  window.addEventListener('resize', () => { measure(); go(idx, false); });

  /* ---------------- Scroll choreography ---------------- */
  function splitWords(el) {
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map(w => `<span class="w">${w}</span>`).join(' ');
    return el.querySelectorAll('.w');
  }

  function initScroll() {
    if (!hasGSAP || RM || !window.ScrollTrigger) return;

    // HERO: title dissolves, beam turns, intro appears
    const htl = gsap.timeline({ scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom bottom', scrub: 0.8 } });
    htl.fromTo('.hero__title', { opacity: 1, y: 0, filter: 'blur(0px)' }, { opacity: 0, y: -80, filter: 'blur(10px)', duration: .4, ease: 'none' }, 0)
       .fromTo(beam, { rot: 0, zoom: 1 }, { rot: -0.35, zoom: 1.35, duration: 1, ease: 'none' }, 0)
       .fromTo('.hero__intro', { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0, duration: .3, ease: 'none' }, .42)
       .to('.hero__intro', { autoAlpha: 0.0, y: -40, duration: .2, ease: 'none' }, .9)
       .fromTo('.hero__beam', { opacity: 1 }, { opacity: .45, duration: .5 }, .5);

    // Display titles: lines brighten (dim -> cream)
    document.querySelectorAll('.reveal-lines').forEach(h => {
      const lines = h.querySelectorAll(':scope > span');
      gsap.fromTo(lines, { color: '#3b3a36', y: 40 }, { color: '#f2ecdd', y: 0, stagger: .25, ease: 'none', scrollTrigger: { trigger: h, start: 'top 92%', end: 'top 40%', scrub: 0.6 } });
    });
    const qw = splitWords(document.querySelector('.reveal-words'));
    gsap.fromTo(qw, { color: '#3b3a36' }, { color: '#f2ecdd', stagger: .1, ease: 'none', scrollTrigger: { trigger: '.quote blockquote', start: 'top 80%', end: 'bottom 45%', scrub: 0.5 } });

    // Modules reveal
    gsap.fromTo('.mod figure', { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.6, stagger: .12, ease: 'expo.inOut', scrollTrigger: { trigger: '#modsViewport', start: 'top 80%' } });
    gsap.fromTo('.mod img', { scale: 1.25 }, { scale: 1.02, duration: 2.4, stagger: .12, ease: 'expo.out', scrollTrigger: { trigger: '#modsViewport', start: 'top 80%' } });
    gsap.fromTo('.mods__info', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.mods__info', start: 'top 92%' } });
    // Ken Burns on active slide (simulated footage)
    gsap.to('.mod img', { xPercent: -2.5, duration: 9, ease: 'sine.inOut', yoyo: true, repeat: -1 });

    // Stipple assembly
    stipples.forEach(s => {
      gsap.fromTo(s, { p: 0 }, { p: 1, ease: 'none', scrollTrigger: { trigger: s.c, start: 'top 95%', end: 'center 50%', scrub: 1 } });
    });
    gsap.fromTo('.svc__list li', { opacity: 0, y: 18 }, { opacity: 1, y: 0, stagger: .05, duration: .9, ease: 'expo.out', scrollTrigger: { trigger: '.svc__list', start: 'top 88%' } });
    gsap.fromTo('.svc__services article', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: { each: .08 }, scrollTrigger: { trigger: '.svc__services', start: 'top 90%' } });
    ['.meth__steps', '.prob__grid'].forEach(sel => {
      gsap.fromTo(`${sel} > *`, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1.2, stagger: .1, ease: 'expo.out', scrollTrigger: { trigger: sel, start: 'top 88%' } });
    });

    // Audience strip slides horizontally while scrolling
    const strip = document.getElementById('audStrip');
    gsap.fromTo(strip, { x: () => window.innerWidth * 0.25 }, { x: () => -(strip.scrollWidth - window.innerWidth * 0.75), ease: 'none', scrollTrigger: { trigger: '.aud__strip-wrap', start: 'top bottom', end: 'bottom top', scrub: 0.8, invalidateOnRefresh: true } });

    // Method particles drift
    gsap.fromTo('.meth__particles', { yPercent: 8 }, { yPercent: -8, ease: 'none', scrollTrigger: { trigger: '.meth', start: 'top bottom', end: 'bottom top', scrub: true } });

    // Sketch -> render wipe
    gsap.fromTo('.quote__render', { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', scrollTrigger: { trigger: '#wipe', start: 'top 70%', end: 'bottom 40%', scrub: 0.6 } });
    gsap.fromTo('#wipe', { scale: .92, opacity: .4 }, { scale: 1, opacity: 1, ease: 'none', scrollTrigger: { trigger: '#wipe', start: 'top bottom', end: 'top 50%', scrub: true } });

    // CTA glow
    gsap.fromTo(glow, { p: 0 }, { p: 1, ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top 85%', end: 'center 50%', scrub: 1 } });

    // Wordmark bars + footer band parallax
    gsap.fromTo('.mark__bars', { scaleX: .35, opacity: .2 }, { scaleX: 1, opacity: .9, ease: 'none', scrollTrigger: { trigger: '.mark', start: 'top bottom', end: 'bottom 60%', scrub: true } });
    gsap.fromTo('.ftr__band img', { yPercent: -18 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.ftr__band', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.fromTo('.ftr__left > *, .ftr__right > *', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1, stagger: .04, ease: 'expo.out', scrollTrigger: { trigger: '.ftr__grid', start: 'top 85%' } });
  }

  /* ---------------- Loader ---------------- */
  const loader = document.getElementById('loader');
  const pctEl = document.getElementById('loaderPct'), bar = document.getElementById('loaderBar');
  function finish() {
    document.body.classList.remove('is-loading');
    if (lenis) lenis.start();
    showCookies();
    if (hasGSAP) ScrollTrigger.refresh();
  }
  if (RM || !hasGSAP) {
    loader.style.display = 'none'; initScroll(); finish();
  } else {
    const imgs = ['https://ornat-ifi.vercel.app/img/m1.webp', 'https://ornat-ifi.vercel.app/img/m2.webp', 'https://ornat-ifi.vercel.app/img/m3.webp', 'https://ornat-ifi.vercel.app/img/p-17-02.webp'];
    let done = 0; const state = { v: 0 };
    const tick = () => { pctEl.textContent = Math.round(state.v) + '%'; bar.style.width = state.v + '%'; };
    gsap.to('.loader__mark', { opacity: 1, y: 0, duration: 1, ease: 'expo.out' });
    const loaded = new Promise(res => {
      imgs.forEach(src => { const i = new Image(); i.onload = i.onerror = () => { if (++done === imgs.length) res(); }; i.src = src; });
      setTimeout(res, 4000);
    });
    const minT = new Promise(r => setTimeout(r, 900));
    gsap.to(state, { v: 70, duration: 1, ease: 'power2.out', onUpdate: tick });
    Promise.all([loaded, minT, document.fonts ? document.fonts.ready : null]).then(() => {
      initScroll();
      gsap.timeline()
        .to(state, { v: 100, duration: .5, ease: 'power2.inOut', onUpdate: tick })
        .to('.loader__mark, .loader__meta', { opacity: 0, y: -20, duration: .5, ease: 'power2.in' })
        .fromTo(loader, { clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.1, ease: 'expo.inOut', onComplete: () => { loader.style.display = 'none'; } }, '-=.1')
        .fromTo('.hero__title .line > *', { yPercent: 110 }, { yPercent: 0, duration: 1.4, stagger: .12, ease: 'expo.out' }, '-=.55')
        .fromTo('.hero__sub', { opacity: 0 }, { opacity: 1, duration: 1 }, '-=.9')
        .fromTo('.hdr', { opacity: 0 }, { opacity: 1, duration: .8, onComplete: finish }, '-=1.1');
    });
  }
})();
