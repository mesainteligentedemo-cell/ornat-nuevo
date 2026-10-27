(() => {
  'use strict';
  const canvas = document.getElementById('heroWhorl');
  if (!canvas) return;
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, preserveDrawingBuffer: false });
  if (!gl) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const vertex = `attribute vec2 a; void main(){gl_Position=vec4(a,0.,1.);}`;
  const fragment = `precision highp float;
  uniform vec2 u_resolution;
  uniform vec2 u_pointer;
  uniform float u_time;
  uniform float u_stir;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
  float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=noise(p)*a;p=mat2(1.6,-1.2,1.2,1.6)*p+2.4;a*=.5;}return v;}
  void main(){
    vec2 uv=gl_FragCoord.xy/u_resolution;
    vec2 p=(gl_FragCoord.xy-.5*u_resolution)/min(u_resolution.x,u_resolution.y);
    float t=u_time*.115;
    vec2 mouse=(u_pointer-.5)*vec2(u_resolution.x/u_resolution.y,1.);
    vec2 d=p-mouse;
    float stir=u_stir*exp(-dot(d,d)*5.);
    vec2 q=p;
    q.x+=.28*sin(q.y*3.8+t*1.9)+.14*cos(q.y*7.1-t)+stir*d.y*.42;
    q.y+=.22*cos(q.x*4.3-t*1.4)+stir*d.x*.42;
    vec2 warp=vec2(fbm(q*2.1+vec2(t,-t*.7)),fbm(q*2.1+vec2(8.1,-t*.9)));
    q+=.65*(warp-.5);
    float plumes=0.;
    for(int i=0;i<5;i++){
      float fi=float(i);
      vec2 center=vec2((fi-2.)*.28+.05*sin(t*.7+fi*2.1),.05+.23*sin(t*.6+fi*1.7));
      vec2 r=q-center;
      float len=length(r*vec2(.87,1.25));
      float tendril=fbm(q*5.5+vec2(fi*3.1,t*2.4));
      float body=smoothstep(.47,.04,len+.23*(tendril-.5));
      plumes=max(plumes,body*(.62+.38*tendril));
    }
    float thread=fbm(q*8.+vec2(t*1.7,-t*1.2));
    float density=clamp(pow(plumes,1.25)*( .72+.5*thread),0.,1.);
    float veil=smoothstep(.53,.78,fbm(q*3.6+vec2(t*.9,-t*.5)))*.11;
    float vignette=1.-smoothstep(.42,1.2,length(p));
    float ink=(density*.6+veil)*vignette;
    vec3 color=mix(vec3(.24,.23,.22),vec3(.9,.87,.78),clamp(density*.86+.15,0.,1.));
    float edge=pow(max(0.,density-fbm(q*8.+.02)),2.)*.9;
    color+=vec3(.12,.11,.08)*edge;
    float typeClearance=mix(.34,1.,smoothstep(.12,.57,length(p)));
    gl_FragColor=vec4(color,ink*.25*typeClearance);
  }`;
  const compile = (type, source) => {
    const shader=gl.createShader(type); gl.shaderSource(shader,source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) { console.warn('ORNAT ink effect:',gl.getShaderInfoLog(shader)); return null; }
    return shader;
  };
  const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);
  if (!vs || !fs) return;
  const program=gl.createProgram(); gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
  if (!gl.getProgramParameter(program,gl.LINK_STATUS)) return;
  gl.useProgram(program);
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  const attr=gl.getAttribLocation(program,'a');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
  const resolution=gl.getUniformLocation(program,'u_resolution'),pointer=gl.getUniformLocation(program,'u_pointer'),time=gl.getUniformLocation(program,'u_time'),stir=gl.getUniformLocation(program,'u_stir');
  let w=0,h=0,visible=true,active=false,energy=0,last=0,raf=0;
  const pos={x:.5,y:.5};
  function resize(){
    const bounds=canvas.getBoundingClientRect();
    const ratio=Math.min(devicePixelRatio||1,1.25),scale=innerWidth<768?.55:.72;
    const width=Math.max(1,Math.round(bounds.width*ratio*scale)),height=Math.max(1,Math.round(bounds.height*ratio*scale));
    if(width===w&&height===h)return;
    w=canvas.width=width;h=canvas.height=height;gl.viewport(0,0,w,h);
  }
  function draw(now){
    resize();
    energy=Math.max(0,energy-.018);
    gl.uniform2f(resolution,w,h);gl.uniform2f(pointer,pos.x,pos.y);
    gl.uniform1f(time,reduced?8:now*.001);gl.uniform1f(stir,energy);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    if(!reduced&&visible)raf=requestAnimationFrame(draw);
  }
  function move(event){
    const r=canvas.getBoundingClientRect();pos.x=(event.clientX-r.left)/r.width;pos.y=1-(event.clientY-r.top)/r.height;
    energy=Math.min(1,energy+(event.buttons?.22:.08));
  }
  canvas.addEventListener('pointermove',move,{passive:true});
  canvas.addEventListener('pointerdown',event=>{move(event);energy=1;},{passive:true});
  const observer=new IntersectionObserver(entries=>{
    visible=entries[0].isIntersecting;
    if(visible&&!active){active=true;raf=requestAnimationFrame(draw);}
    if(!visible){cancelAnimationFrame(raf);active=false;}
  },{rootMargin:'100px'});
  observer.observe(canvas);
  addEventListener('resize',()=>{resize();if(reduced)draw(8000);},{passive:true});
})();
