// Entrada desde el sitio: convierte formularios públicos pendientes en contactos (con deduplicación).
import {cleanLead,cleanEmail,isValidEmail,dayToISO,dayKey,findDuplicates,normEmail,phoneKey,pushTimeline,MAX_TIMELINE} from './store.js';
import {pipelineOf} from './pipelines.js';

const fold=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
const UTM_CHANNELS={instagram:'Instagram',ig:'Instagram',facebook:'Facebook',fb:'Facebook',meta:'Facebook',google:'Google',whatsapp:'WhatsApp',wa:'WhatsApp',linkedin:'LinkedIn'};

export function channelFromIntake(item){const k=fold(item?.utm?.source);return Object.hasOwn(UTM_CHANNELS,k)?UTM_CHANNELS[k]:'Sitio web';}
export const intakeEntryId=item=>`intake-${item.id}`;
export const isIntakeEntry=e=>String(e.id||'').startsWith('intake-');

function describe(item,channel){
 const parts=[];
 if(item.form)parts.push(`Formulario: ${item.form}`);
 if(item.page)parts.push(`Página: ${item.page}`);
 const utm=Object.entries(item.utm||{}).map(([k,v])=>`${k}=${v}`).join(', ');
 if(utm)parts.push(`UTM: ${utm}`);
 parts.push(`Canal: ${channel}`);
 if(item.message)parts.push(`Mensaje: ${item.message}`);
 return parts.join('\n');
}

/**
 * Aplica formularios pendientes a la lista de contactos. Devuelve la lista nueva y un resumen.
 * - Deduplica por correo/teléfono normalizados (contra los existentes y entre los propios formularios).
 * - Idempotente: un formulario ya aplicado (misma entrada en la línea de tiempo) se omite.
 */
export function applyIntake(leads,items,{pipelines,properties=[],now=new Date()}={}){
 const at=now.toISOString(),today=dayKey(now);
 const done=new Set();for(const l of leads)for(const e of l.timeline||[])if(isIntakeEntry(e))done.add(e.id);
 let list=[...leads];const created=[],merged=[],links=[];let skipped=0;
 for(const item of [...items].sort((a,b)=>a.receivedAt<b.receivedAt?-1:1)){
  const eid=intakeEntryId(item);if(done.has(eid)){skipped++;continue;}done.add(eid);
  const prop=item.propertyId?properties.find(p=>p.id===item.propertyId||p.slug===item.propertyId):null;
  const channel=channelFromIntake(item),when=item.receivedAt||at,email=isValidEmail(item.email)?cleanEmail(item.email):'';
  const dups=findDuplicates(list,{email,phone:item.phone});
  if(dups.length){
   const target=dups[0],i=list.findIndex(l=>l.id===target.id);
   const note={id:eid,at:when,type:'note',text:`Nuevo formulario\n${describe(item,channel)}`};
   const upd=cleanLead({...target,email:target.email||email,phone:target.phone||item.phone,projectType:target.projectType||(prop?.title||''),updatedAt:at,timeline:[...target.timeline,note].slice(-MAX_TIMELINE)});
   list[i]=upd;merged.push(upd.id);if(prop)links.push({propertyId:prop.id,leadId:upd.id});continue;
  }
  const pipeId=prop?.operation==='renta'&&pipelines.some(p=>p.id==='renta')?'renta':'venta';
  const pipe=pipelineOf(pipelines,pipeId),first=pipe.stages.find(s=>s.kind==='open')||pipe.stages[0];
  const name=String(item.name||'').trim()||(email?email.split('@')[0]:item.phone);
  const lead=cleanLead({
   name,email,phone:item.phone,status:'new',source:'intake',channel,pipeline:pipe.id,stageId:first.id,
   projectType:prop?.title||'',createdAt:when,updatedAt:at,priority:'media',
   nextAction:'Responder al formulario del sitio',nextActionAt:dayToISO(today),
   timeline:[{id:`${eid}-created`,at:when,type:'stage',stage:`${pipe.id}/${first.id}`,text:`Contacto creado desde el sitio en la etapa ${first.name}`},{id:eid,at:when,type:'note',text:describe(item,channel)}],
  });
  list.push(lead);created.push(lead.id);if(prop)links.push({propertyId:prop.id,leadId:lead.id});
 }
 return {leads:list,created,merged,links,skipped};
}

/** Entradas recientes del sitio, derivadas de la línea de tiempo (no requiere estado extra). */
export function recentIntake(leads,limit=12){
 const rows=[];
 for(const l of leads)for(const e of l.timeline||[])if(isIntakeEntry(e)&&!e.id.endsWith('-created'))rows.push({leadId:l.id,name:l.name,at:e.at,text:e.text,fresh:l.status==='new'&&!l.lastContactAt});
 return rows.sort((a,b)=>a.at<b.at?1:-1).slice(0,limit);
}
export const newFromSite=leads=>leads.filter(l=>l.source==='intake'&&l.status==='new'&&!l.lastContactAt).length;
export {normEmail,phoneKey};
