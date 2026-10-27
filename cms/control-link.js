import {createStore,normalizeHeatEvent} from '../control/store.js';

// The control panel and editor share this origin and this browser only.
let store;
try { store=createStore(); store.get(); } catch {}
let pending=new Set(),timer;
export function activity(action){
  pending.add(action); clearTimeout(timer);
  timer=setTimeout(()=>{try{if(store&&pending.size){store.commit('Editar sitio',()=>{},[...pending].join(', '),'frontend');pending.clear();}}catch{pending.clear();}},1200);
}
export function consent(){try{return store?.get().settings.analyticsConsent===true;}catch{return false;}}
export function heatEvent(event){try{if(!store||!consent())return;const safe=normalizeHeatEvent(event,true);store.commit('Interacción de prueba',state=>{state.events.push(safe);state.events=state.events.slice(-10000);},`${safe.template} · ${safe.viewportWidth} × ${safe.viewportHeight}`,'frontend');}catch{}}
