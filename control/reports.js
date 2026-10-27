// Reportes: funciones puras que calculan cada tabla a partir de los datos (la pantalla solo las dibuja).
import {csvCell,dayKey,QUOTE_STATUSES} from './store.js';
import {resolveStage,stageHistory,pipelineOf} from './pipelines.js';
import {quoteTotals,effectiveStatus} from './quotes.js';

const fold=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
export const defaultReportFilters=()=>({from:'',to:'',pipeline:'',owner:''});
const DAY=864e5;

/** Contactos dentro del periodo (por fecha de alta), pipeline y responsable. */
export function reportLeads(leads,f={}){
 return leads.filter(l=>{
  const k=dayKey(l.createdAt);
  if(f.from&&k<f.from)return false;if(f.to&&k>f.to)return false;
  if(f.pipeline&&(l.pipeline||'venta')!==f.pipeline)return false;
  if(f.owner&&(f.owner==='__none'?l.owner!=='':fold(l.owner)!==fold(f.owner)))return false;
  return true;
 });
}

export function conversionByChannel(leads,f={}){
 const m=new Map();
 for(const l of reportLeads(leads,f)){const k=l.channel||'Sin canal',r=m.get(k)||{channel:k,total:0,won:0,lost:0,open:0,wonValue:0};r.total++;if(l.status==='won'){r.won++;r.wonValue+=l.value||0;}else if(l.status==='lost')r.lost++;else r.open++;m.set(k,r);}
 return [...m.values()].map(r=>({...r,conversion:r.total?r.won/r.total:null,winRate:r.won+r.lost?r.won/(r.won+r.lost):null})).sort((a,b)=>b.total-a.total||a.channel.localeCompare(b.channel,'es'));
}

/** Días promedio que los contactos pasaron en cada etapa del pipeline (usa la línea de tiempo de etapas). */
export function timeInStage(leads,pipelines,f={},now=new Date()){
 const pipe=pipelineOf(pipelines,f.pipeline||'venta'),acc=new Map(pipe.stages.map(s=>[s.id,{sum:0,n:0,leads:new Set()}]));
 for(const l of reportLeads(leads,{...f,pipeline:pipe.id})){
  for(const seg of stageHistory(l,pipelines,now.toISOString())){
   if(seg.pipeline!==pipe.id)continue;const a=acc.get(seg.stageId);if(!a)continue;
   const st=pipe.stages.find(s=>s.id===seg.stageId);if(st.kind!=='open')continue;
   a.sum+=Math.max(0,(new Date(seg.end)-new Date(seg.from))/DAY);a.n++;a.leads.add(l.id);
  }
 }
 return pipe.stages.map(s=>{const a=acc.get(s.id);return {stageId:s.id,stage:s.name,kind:s.kind,leads:a.leads.size,samples:a.n,avgDays:s.kind==='open'&&a.n?a.sum/a.n:null};});
}

/** Pronóstico: valor de contactos abiertos × probabilidad de su etapa. Los contactos sin valor no suman (se cuentan aparte). */
export function forecast(leads,pipelines,f={}){
 const pipe=pipelineOf(pipelines,f.pipeline||'venta'),rows=pipe.stages.filter(s=>s.kind==='open').map(s=>({stageId:s.id,stage:s.name,prob:s.prob,count:0,value:0,weighted:0}));
 let noValue=0;
 for(const l of reportLeads(leads,{...f,pipeline:pipe.id})){
  if(l.status==='won'||l.status==='lost')continue;
  const {stage}=resolveStage(pipelines,l),r=rows.find(x=>x.stageId===stage.id);if(!r)continue;
  r.count++;if(l.value===null||l.value===undefined){noValue++;continue;}r.value+=l.value;r.weighted+=l.value*stage.prob/100;
 }
 for(const r of rows)r.weighted=Math.round(r.weighted);
 return {pipeline:pipe,rows,total:{count:rows.reduce((s,r)=>s+r.count,0),value:rows.reduce((s,r)=>s+r.value,0),weighted:rows.reduce((s,r)=>s+r.weighted,0)},noValue};
}

export function ownerPerformance(leads,tasks,f={}){
 const rows=new Map(),key=o=>o||'Sin responsable',get=o=>{const k=key(o);if(!rows.has(k))rows.set(k,{owner:k,contacts:0,won:0,lost:0,wonValue:0,openValue:0,tasksTotal:0,tasksDone:0});return rows.get(k);};
 const ls=reportLeads(leads,f),ids=new Set(ls.map(l=>l.id));
 for(const l of ls){const r=get(l.owner);r.contacts++;if(l.status==='won'){r.won++;r.wonValue+=l.value||0;}else if(l.status==='lost')r.lost++;else r.openValue+=l.value||0;}
 for(const t of tasks){
  const k=dayKey(t.dueAt);if(f.from&&k<f.from)continue;if(f.to&&k>f.to)continue;
  if(f.owner&&f.owner!=='__none'&&fold(t.owner)!==fold(f.owner))continue;
  if(f.pipeline&&t.leadId&&!ids.has(t.leadId))continue;
  const r=get(t.owner);r.tasksTotal++;if(t.done)r.tasksDone++;
 }
 return [...rows.values()].map(r=>({...r,taskRate:r.tasksTotal?r.tasksDone/r.tasksTotal:null})).sort((a,b)=>b.wonValue-a.wonValue||b.contacts-a.contacts||a.owner.localeCompare(b.owner,'es'));
}

export function lostReasons(leads,f={}){
 const m=new Map();
 for(const l of reportLeads(leads,f)){if(l.status!=='lost')continue;const label=(l.lostReason||'').trim()||'Sin motivo registrado',k=fold(label),r=m.get(k)||{reason:label,count:0,value:0};r.count++;r.value+=l.value||0;m.set(k,r);}
 return [...m.values()].sort((a,b)=>b.count-a.count||a.reason.localeCompare(b.reason,'es'));
}

export function quotesReport(quotes,f={},now=new Date()){
 const inRange=q=>{const k=dayKey(q.createdAt);return !(f.from&&k<f.from)&&!(f.to&&k>f.to);};
 const m=new Map();
 for(const q of quotes){if(!inRange(q))continue;const st=effectiveStatus(q,now),key=`${st}|${q.currency}`,r=m.get(key)||{status:st,statusLabel:QUOTE_STATUSES[st],currency:q.currency,count:0,total:0};r.count++;r.total+=quoteTotals(q).total;m.set(key,r);}
 const order=Object.keys(QUOTE_STATUSES);
 return [...m.values()].sort((a,b)=>a.currency.localeCompare(b.currency)||order.indexOf(a.status)-order.indexOf(b.status));
}

// ───────────── CSV ─────────────
export function toCSV(columns,rows){
 const fmt=(v)=>v===null||v===undefined?'':typeof v==='number'&&!Number.isInteger(v)?String(Math.round(v*100)/100):String(v);
 return '﻿'+[columns.map(c=>c[1]),...rows.map(r=>columns.map(([k])=>fmt(r[k])))].map(r=>r.map(csvCell).join(',')).join('\r\n');
}
export const REPORT_COLUMNS={
 channel:[['channel','Canal'],['total','Contactos'],['won','Ganados'],['lost','Perdidos'],['open','Abiertos'],['conversion','Conversión (ganados/contactos)'],['winRate','Tasa de cierre (ganados/cerrados)'],['wonValue','Valor ganado MXN']],
 stage:[['stage','Etapa'],['leads','Contactos que pasaron'],['samples','Tramos medidos'],['avgDays','Días promedio']],
 forecast:[['stage','Etapa'],['prob','Probabilidad %'],['count','Contactos'],['value','Valor MXN'],['weighted','Valor ponderado MXN']],
 owner:[['owner','Responsable'],['contacts','Contactos'],['won','Ganados'],['lost','Perdidos'],['wonValue','Valor ganado MXN'],['openValue','Valor abierto MXN'],['tasksTotal','Tareas'],['tasksDone','Tareas cumplidas'],['taskRate','Cumplimiento de tareas']],
 lost:[['reason','Motivo'],['count','Contactos'],['value','Valor MXN']],
 quotes:[['statusLabel','Estado'],['currency','Moneda'],['count','Cotizaciones'],['total','Total']],
};
