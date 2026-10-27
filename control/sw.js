// Service worker de ORNAT Control (alcance /control/). Solo guarda el «cascarón» de la app para que abra sin conexión.
// No guarda datos del CRM (viven en localStorage o en Supabase) ni respuestas de terceros ni de /api: solo archivos propios del mismo origen.
const CACHE='ornat-control-shell-v4';
const SHELL=['./','./index.html','./style.css','./app.js','./crm.js','./store.js','./crm-remote.js','./dnd.js','./pipelines.js','./intake.js','./score.js','./tasks.js','./messaging.js','./quotes.js','./reports.js','./ui-common.js','./ui-tasks.js','./ui-quotes.js','./ui-props.js','./ui-msgs.js','./ui-reports.js','./ui-config.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png','../shared/data.js','../shared/config.js','../shared/remote-boot.js','../shared/remote-mirror.js','../shared/session-bar.js','../shared/voice-widget.js','../shared/voice-config.js','../img/brand/ornat-planta-cuadrada-favicon.svg','/fonts/barlow-condensed-medium.woff2','/fonts/barlow-condensed-semibold.woff2','/fonts/barlow-condensed-bold.woff2','/fonts/instrument-serif-regular.woff2','/fonts/instrument-serif-italic.woff2','/fonts/inter-variable.woff2'];
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{const cache=await caches.open(CACHE);await Promise.all(SHELL.map(async url=>{try{await cache.add(url);}catch{}}));await self.skipWaiting();})());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('ornat-control-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})());
});
const allowed=url=>url.origin===self.location.origin&&!url.pathname.startsWith('/api/')&&!/supabase/i.test(url.hostname)&&(url.pathname.includes('/control/')||url.pathname.includes('/shared/')||url.pathname.includes('/img/brand/')||url.pathname.startsWith('/fonts/'));
self.addEventListener('fetch',event=>{
 const req=event.request;if(req.method!=='GET')return;
 const url=new URL(req.url);if(!allowed(url))return;
 event.respondWith((async()=>{
  try{const res=await fetch(req);if(res.ok&&res.type==='basic'){const cache=await caches.open(CACHE);cache.put(req,res.clone());}return res;}
  catch{const hit=await caches.match(req,{ignoreSearch:true});if(hit)return hit;if(req.mode==='navigate'){const home=await caches.match('./index.html');if(home)return home;}return new Response('Sin conexión',{status:503,statusText:'Sin conexión'});}
 })());
});
