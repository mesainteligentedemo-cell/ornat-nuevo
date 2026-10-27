// Puntaje del contacto 0–100: transparente (cada regla muestra sus puntos) y configurable (peso y activación).
import {SCORE_RULE_KEYS,lastActivityAt} from './store.js';
import {resolveStage} from './pipelines.js';

export const RULE_LABELS={channel:'Canal de origen',value:'Valor estimado',priority:'Prioridad',recency:'Actividad reciente',response:'Respuesta del contacto',property:'Propiedad vinculada',stage:'Etapa del pipeline'};
export const RULE_HELP={
 channel:'Referido 100 % · Evento 80 % · Sitio web y WhatsApp 70 % · Google 60 % · Instagram y LinkedIn 55 % · Facebook 40 % · Otro 25 %.',
 value:'≥ $500,000 100 % · ≥ $200,000 80 % · ≥ $100,000 60 % · ≥ $50,000 40 % · cualquier valor 20 % · sin valor 0 %.',
 priority:'Alta 100 % · Media 50 % · Baja 15 %.',
 recency:'Última actividad en 2 días 100 % · 7 días 75 % · 14 días 50 % · 30 días 25 % · más antigua 0 %.',
 response:'Respondió en los últimos 7 días 100 % · en 30 días 50 % · alguna vez 20 % · nunca 0 %.',
 property:'Tiene al menos una propiedad vinculada 100 %.',
 stage:'Probabilidad de la etapa actual del pipeline (por ejemplo, Propuesta 60 %).',
};
const CHANNEL_FRAC={'Referido':1,'Evento':.8,'Sitio web':.7,'WhatsApp':.7,'Google':.6,'Instagram':.55,'LinkedIn':.55,'Facebook':.4,'Otro':.25};
const DAY=864e5;
const days=(from,now)=>Math.max(0,(now-new Date(from))/DAY);

function fraction(key,lead,ctx){
 const now=ctx.now.getTime();
 switch(key){
  case 'channel':{const f=Object.hasOwn(CHANNEL_FRAC,lead.channel)?CHANNEL_FRAC[lead.channel]:0;return {f,detail:lead.channel||'Sin canal'};}
  case 'value':{const v=lead.value;const f=v===null||v===undefined||v<=0?0:v>=500000?1:v>=200000?.8:v>=100000?.6:v>=50000?.4:.2;return {f,detail:v?`$${new Intl.NumberFormat('es-MX').format(v)}`:'Sin valor'};}
  case 'priority':return {f:{alta:1,media:.5,baja:.15}[lead.priority]??.5,detail:{alta:'Alta',media:'Media',baja:'Baja'}[lead.priority]};
  case 'recency':{const d=days(lastActivityAt(lead),now);const f=d<=2?1:d<=7?.75:d<=14?.5:d<=30?.25:0;return {f,detail:`Última actividad hace ${Math.floor(d)} d`};}
  case 'response':{const r=[lead.lastReplyAt,ctx.lastInboundAt?.get?.(lead.id)].filter(Boolean).sort().pop();if(!r)return {f:0,detail:'Sin respuestas registradas'};const d=days(r,now);return {f:d<=7?1:d<=30?.5:.2,detail:`Respondió hace ${Math.floor(d)} d`};}
  case 'property':{const n=ctx.propertyCount?.get?.(lead.id)||0;return {f:n>0?1:0,detail:n?`${n} propiedad${n===1?'':'es'} vinculada${n===1?'':'s'}`:'Sin propiedad vinculada'};}
  case 'stage':{const {stage}=resolveStage(ctx.pipelines,lead);return {f:stage.prob/100,detail:`${stage.name} (${stage.prob} %)`};}
 }
 return {f:0,detail:''};
}

/** ctx: {now:Date, pipelines, propertyCount:Map(leadId→n), lastInboundAt:Map(leadId→iso)} */
export function scoreLead(lead,rules,ctx){
 const parts=[];let got=0,max=0;
 for(const key of SCORE_RULE_KEYS){
  const r=rules[key]||{on:true,weight:0},{f,detail}=fraction(key,lead,ctx);
  const points=r.on?Math.round(r.weight*f*10)/10:0;
  parts.push({key,label:RULE_LABELS[key],on:r.on,weight:r.weight,fraction:f,points,detail});
  if(r.on){got+=r.weight*f;max+=r.weight;}
 }
 const total=max>0?Math.max(0,Math.min(100,Math.round(got/max*100))):0;
 return {total,parts,band:total>=70?'alto':total>=40?'medio':'bajo',max};
}
export const BAND_LABEL={alto:'Alto',medio:'Medio',bajo:'Bajo'};

export function scoreAll(leads,rules,ctx){const m=new Map();for(const l of leads)m.set(l.id,scoreLead(l,rules,ctx));return m;}

/** Mapas de apoyo a partir de las propiedades (capa de datos) y las conversaciones. */
export function scoreContext({pipelines,properties=[],conversations=[],now=new Date()}){
 const propertyCount=new Map(),lastInboundAt=new Map();
 for(const p of properties)for(const id of p.leadIds||[])propertyCount.set(id,(propertyCount.get(id)||0)+1);
 for(const c of conversations)if(c.direction==='in'&&(!lastInboundAt.get(c.leadId)||c.at>lastInboundAt.get(c.leadId)))lastInboundAt.set(c.leadId,c.at);
 return {now,pipelines,propertyCount,lastInboundAt};
}
