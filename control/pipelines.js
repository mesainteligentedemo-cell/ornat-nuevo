// Pipelines configurables: etapas editables, migración sin pérdida y movimiento de contactos entre etapas.
// El contacto conserva siempre `status` (Nuevo/Contactado/Propuesta/Ganado/Perdido, "etapa base") para que
// filtros, KPIs y datos viejos sigan funcionando; `pipeline` + `stageId` dicen en qué etapa personalizada está.
import {LEAD_STATUSES,baseStatusFor,cleanLead,pushTimeline,cleanPipelines} from './store.js';

const fold=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();

export const pipelineOf=(pipelines,id)=>pipelines.find(p=>p.id===id)||pipelines[0];

/** Etapa efectiva de un contacto (con respaldo si la etapa guardada ya no existe). */
export function resolveStage(pipelines,lead){
 const pipeline=pipelineOf(pipelines,lead.pipeline||'venta');
 let stage=pipeline.stages.find(s=>s.id===(lead.stageId||lead.status));
 if(!stage)stage=pipeline.stages.find(s=>baseStatusFor(pipeline.stages,s.id)===lead.status)||pipeline.stages[0];
 return {pipeline,stage};
}
export const stageName=(pipelines,lead)=>resolveStage(pipelines,lead).stage.name;

/** Migra datos viejos: todo contacto sin pipeline queda en «Venta» con su etapa actual. Idempotente. */
export function migrateLeads(leads){return leads.map(l=>l.pipeline?l:cleanLead({...l,pipeline:'venta',stageId:''}));}

export function slugify(name,existing=[]){
 const base=fold(name).replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,28)||'etapa';
 let id=base,n=2;while(existing.includes(id))id=`${base}-${n++}`;return id;
}

function stageEntry(lead,pipeline,stage,text,at){return {type:'stage',at,stage:`${pipeline.id}/${stage.id}`,text};}

/** Mueve un contacto a otra etapa de SU pipeline. Reglas: perdido pide motivo, ganado pide valor. */
export function moveToStage(lead,pipelines,stageId,{lostReason='',value,at=new Date().toISOString(),requireValue=true}={}){
 const {pipeline,stage:from}=resolveStage(pipelines,lead);
 const to=pipeline.stages.find(s=>s.id===stageId);
 if(!to)throw new Error('Esa etapa no existe en el pipeline del contacto.');
 if(to.id===from.id)return lead;
 const next={...lead};
 if(to.kind==='lost'){const r=String(lostReason??'').trim();if(!r)throw new Error('Indica el motivo por el que se perdió este contacto.');next.lostReason=r.slice(0,500);}else next.lostReason='';
 if(to.kind==='won'){
  if(value!==undefined&&value!==null&&String(value).trim()!==''){const n=Number(value);if(!Number.isSafeInteger(n)||n<0)throw new Error('El valor debe ser un entero en MXN igual o mayor que cero.');next.value=n;}
  if(requireValue&&(next.value===null||next.value===undefined))throw new Error('Indica el valor del proyecto ganado.');
 }
 next.status=baseStatusFor(pipeline.stages,to.id);next.stageId=to.id;next.updatedAt=at;
 next.timeline=pushTimeline(lead.timeline,stageEntry(lead,pipeline,to,`${from.name} → ${to.name}${to.kind==='lost'?` · Motivo: ${next.lostReason}`:''}`,at));
 return cleanLead(next);
}

/** Cambia el contacto de pipeline y lo deja en la primera etapa del nuevo. */
export function movePipeline(lead,pipelines,pipelineId,{at=new Date().toISOString(),stageId=''}={}){
 const target=pipelines.find(p=>p.id===pipelineId);if(!target)throw new Error('Ese pipeline no existe.');
 const cur=resolveStage(pipelines,lead);
 if(cur.pipeline.id===target.id)return stageId&&stageId!==cur.stage.id?moveToStage(lead,pipelines,stageId,{at}):lead;
 const to=target.stages.find(s=>s.id===stageId)||target.stages[0];
 if(to.kind!=='open')throw new Error('Un contacto entra a un pipeline en una etapa abierta.');
 const next={...lead,pipeline:target.id,stageId:to.id,status:baseStatusFor(target.stages,to.id),lostReason:'',updatedAt:at};
 next.timeline=pushTimeline(lead.timeline,stageEntry(lead,target,to,`Pipeline: ${cur.pipeline.name} → ${target.name} · etapa ${to.name}`,at));
 return cleanLead(next);
}

/** Movimiento masivo con las mismas reglas que moveToStage. Todo o nada. */
export function bulkMoveStage(leads,ids,pipelines,stageId,opts={}){
 const set=new Set(ids);let changed=0;const out=leads.map(l=>{if(!set.has(l.id))return l;const n=moveToStage(l,pipelines,stageId,{...opts,value:l.value===null||l.value===undefined?opts.value:undefined});if(n!==l)changed++;return n;});
 return {leads:out,changed};
}

export function stageCounts(leads,pipelines,pipelineId){
 const p=pipelineOf(pipelines,pipelineId),counts=Object.fromEntries(p.stages.map(s=>[s.id,0]));
 for(const l of leads){if((l.pipeline||'venta')!==p.id)continue;const {stage}=resolveStage(pipelines,l);counts[stage.id]++;}
 return counts;
}

/** Valida y aplica una nueva configuración de pipelines. Devuelve pipelines + contactos re-basados (status coherente). */
export function applyPipelineConfig(leads,oldPipelines,nextPipelines){
 const clean=cleanPipelines(nextPipelines);
 const used=new Map();
 for(const l of leads){const {pipeline,stage}=resolveStage(oldPipelines,l);const k=`${pipeline.id}/${stage.id}`;used.set(k,(used.get(k)||0)+1);}
 for(const op of oldPipelines){
  const np=clean.find(p=>p.id===op.id);
  if(!np){const n=leads.filter(l=>(l.pipeline||'venta')===op.id).length;if(n)throw new Error(`El pipeline «${op.name}» tiene ${n} contactos. Muévelos a otro pipeline antes de eliminarlo.`);continue;}
  for(const os of op.stages){if(!np.stages.some(s=>s.id===os.id)){const n=used.get(`${op.id}/${os.id}`)||0;if(n)throw new Error(`La etapa «${os.name}» de ${op.name} tiene ${n} contacto${n===1?'':'s'}. Muévelos a otra etapa antes de eliminarla.`);}}
 }
 const rebased=leads.map(l=>{
  const p=clean.find(x=>x.id===(l.pipeline||'venta'));if(!p)return l;
  const sid=l.stageId||l.status;
  const stage=p.stages.find(s=>s.id===sid)||p.stages.find(s=>baseStatusFor(p.stages,s.id)===l.status)||p.stages[0];
  const status=baseStatusFor(p.stages,stage.id);
  if(status===l.status&&(l.stageId===stage.id||(!l.stageId&&stage.id===l.status)))return l;
  return cleanLead({...l,status,stageId:stage.id});
 });
 return {pipelines:clean,leads:rebased};
}

/** Historial de etapas de un contacto: [{pipeline,stageId,from,to}] a partir de la línea de tiempo. */
export function stageHistory(lead,pipelines,now=new Date().toISOString()){
 const events=[...(lead.timeline||[])].filter(e=>e.type==='stage').sort((a,b)=>a.at<b.at?-1:a.at>b.at?1:0);
 const byName=Object.fromEntries(Object.entries(LEAD_STATUSES).map(([k,v])=>[fold(v),k]));
 const pipe=id=>pipelines.find(p=>p.id===id);
 const parse=(e)=>{
  if(e.stage){const [a,b]=e.stage.includes('/')?e.stage.split('/'):['venta',e.stage];const p=pipe(a)||pipelines[0];const st=p.stages.find(s=>s.id===b)||p.stages.find(s=>baseStatusFor(p.stages,s.id)===b);return st?{pipeline:p.id,stageId:st.id}:null;}
  const m=/→\s*([^·]+?)\s*(?:·|$)/.exec(e.text||'');if(m){const k=byName[fold(m[1])];if(k){const p=pipe('venta')||pipelines[0];const st=p.stages.find(s=>s.id===k);return st?{pipeline:p.id,stageId:st.id}:null;}}
  return null;};
 const parsed=events.map(e=>({at:e.at,to:parse(e)})).filter(e=>e.to);
 // Etapa inicial: la de la primera transición registrada ("de"), si no se conoce, la primera etapa abierta del pipeline.
 const first=events.length?events[0]:null;let initial=null;
 const cp=pipe(parsed.length?parsed[0].to.pipeline:(lead.pipeline||'venta'))||pipelines[0];
 if(first){const m=/^\s*([^→]+?)\s*→/.exec(first.text||'');if(m){const st=cp.stages.find(s=>fold(s.name)===fold(m[1]));if(st)initial={pipeline:cp.id,stageId:st.id};}}
 if(!initial){const p=parsed.length?cp:pipe(lead.pipeline||'venta')||pipelines[0];const st=parsed.length?p.stages.find(s=>s.kind==='open')||p.stages[0]:resolveStage(pipelines,lead).stage;initial={pipeline:p.id,stageId:st.id};}
 const segs=[];let cur={...initial,from:lead.createdAt};
 for(const e of parsed){if(e.to.pipeline===cur.pipeline&&e.to.stageId===cur.stageId)continue;cur.to=e.at<cur.from?cur.from:e.at;segs.push(cur);cur={...e.to,from:e.at};}
 cur.to=null;segs.push(cur);
 return segs.map(s=>({...s,end:s.to||now}));
}
