// Plantillas con variables, enlaces mailto:/wa.me reales y secuencias que generan tareas.
import {whatsappNumber,cleanTask,cleanEnrollment,uid,LEAD_STATUSES} from './store.js';
import {resolveStage} from './pipelines.js';

export const TEMPLATE_VARS={
 nombre:'Primer nombre del contacto',nombre_completo:'Nombre completo',empresa:'Empresa del contacto',propiedad:'Propiedad vinculada (o tipo de proyecto)',
 precio_propiedad:'Precio de la propiedad',link_propiedad:'Enlace público a la propiedad',responsable:'Responsable del contacto o tu nombre',etapa:'Etapa actual',valor:'Valor estimado',fecha:'Fecha de hoy',telefono:'Teléfono',correo:'Correo',
};
const money=(n,cur='MXN')=>n===null||n===undefined?'':`$${new Intl.NumberFormat('es-MX').format(n)} ${cur}`;

export function templateVars(lead,{property=null,user='',pipelines=[],origin='',now=new Date()}={}){
 const first=String(lead.name||'').trim().split(/\s+/)[0]||'';
 return {
  nombre:first,nombre_completo:lead.name||'',empresa:lead.company||'',propiedad:property?.title||lead.projectType||'',
  precio_propiedad:property?.price?money(property.price,property.currency):'',link_propiedad:property&&origin?`${origin}/propiedades/?p=${property.slug}`:'',
  responsable:lead.owner||user||'',etapa:pipelines.length?resolveStage(pipelines,lead).stage.name:(LEAD_STATUSES[lead.status]||''),valor:money(lead.value),
  fecha:now.toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'}),telefono:lead.phone||'',correo:lead.email||'',
 };
}
/**
 * Sustituye {{variable}} y bloques condicionales {{#variable}}…{{/variable}} (solo aparecen si la variable tiene valor).
 * Devuelve el texto y la lista de variables vacías o desconocidas para avisar antes de enviar.
 */
export function renderTemplate(text,vars){
 const missing=new Set(),unknown=new Set();
 let out=String(text??'').replace(/\{\{#([a-z_]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,(_,k,inner)=>{if(!Object.hasOwn(TEMPLATE_VARS,k)){unknown.add(k);return '';}return vars[k]?inner:'';});
 out=out.replace(/\{\{\s*([a-z_]+)\s*\}\}/g,(m,k)=>{if(!Object.hasOwn(TEMPLATE_VARS,k)){unknown.add(k);return m;}if(!vars[k]){missing.add(k);return '';}return vars[k];});
 out=out.replace(/[ \t]+\n/g,'\n').replace(/ {2,}/g,' ');
 return {text:out.trim(),missing:[...missing],unknown:[...unknown]};
}
export function mailtoURL({to='',subject='',body=''}){
 const q=[];if(subject)q.push(`subject=${encodeURIComponent(subject)}`);if(body)q.push(`body=${encodeURIComponent(body)}`);
 return `mailto:${encodeURIComponent(to).replace(/%40/g,'@')}${q.length?'?'+q.join('&'):''}`;
}
export function waURL(phone,text=''){
 const n=whatsappNumber(phone);if(!n)throw new Error('El contacto necesita un teléfono válido para abrir WhatsApp.');
 return `https://wa.me/${n}${text?`?text=${encodeURIComponent(text)}`:''}`;
}
export const SENT_NOTE={email:'Enviado desde tu correo — no verificado',whatsapp:'Enviado desde tu WhatsApp — no verificado'};

// ───────────── Secuencias ─────────────
const atHour=(d,h)=>{const x=new Date(d);x.setHours(h,0,0,0);return x;};
export function stepDueDates(sequence,now=new Date(),hour=10){
 let cum=0;
 return sequence.steps.map((s,i)=>{
  cum+=s.wait;
  if(cum===0){const t=new Date(now.getTime()+15*60000);t.setSeconds(0,0);return t.toISOString();}
  const base=new Date(now);base.setDate(base.getDate()+cum);return atHour(base,hour).toISOString();
 });
}
/** Inscribe un contacto: crea la inscripción y una tarea por paso (con fecha). */
export function enrollInSequence({lead,sequence,templates=[],existing=[],owner='',now=new Date()}){
 if(existing.some(e=>e.leadId===lead.id&&e.sequenceId===sequence.id&&['active','paused'].includes(e.status)))throw new Error('Este contacto ya está inscrito en esa secuencia.');
 const enrollment=cleanEnrollment({id:uid(),leadId:lead.id,sequenceId:sequence.id,startedAt:now.toISOString(),status:'active'});
 const due=stepDueDates(sequence,now);
 const tasks=sequence.steps.map((s,i)=>{
  const tpl=templates.find(t=>t.id===s.templateId);
  return cleanTask({id:uid(),title:s.title,type:s.type,dueAt:due[i],leadId:lead.id,owner:lead.owner||owner,priority:'media',source:'sequence',enrollmentId:enrollment.id,stepId:s.id,
   notes:`Secuencia: ${sequence.name}${tpl?`\nPlantilla sugerida: ${tpl.name}`:''}`,createdAt:now.toISOString()});
 });
 return {enrollment,tasks};
}
const isOpen=e=>e.status==='active'||e.status==='paused';
/** Termina inscripciones del contacto y borra sus tareas pendientes. Devuelve cuántas terminó. */
export function exitEnrollments(state,leadId,reason,now=new Date()){
 let n=0;const ids=new Set();
 for(const e of state.enrollments)if(e.leadId===leadId&&isOpen(e)){e.status='exited';e.reason=reason;e.endedAt=now.toISOString();e.pausedAt='';ids.add(e.id);n++;}
 if(ids.size)state.tasks=state.tasks.filter(t=>t.done||!ids.has(t.enrollmentId));
 return n;
}
export function pauseEnrollment(state,id,now=new Date()){const e=state.enrollments.find(x=>x.id===id);if(!e||e.status!=='active')throw new Error('Solo se puede pausar una secuencia activa.');e.status='paused';e.pausedAt=now.toISOString();}
export function resumeEnrollment(state,id,now=new Date()){
 const e=state.enrollments.find(x=>x.id===id);if(!e||e.status!=='paused')throw new Error('Esta secuencia no está pausada.');
 const shift=Math.max(0,now.getTime()-new Date(e.pausedAt).getTime());
 for(const t of state.tasks)if(t.enrollmentId===id&&!t.done)t.dueAt=new Date(new Date(t.dueAt).getTime()+shift).toISOString();
 e.status='active';e.pausedAt='';
}
/** Foto previa a una mutación para detectar cambios de etapa y respuestas. */
export function snapshot(state){
 const stages=new Map();for(const l of state.leads)stages.set(l.id,`${l.pipeline||'venta'}/${l.stageId||l.status}/${l.status}`);
 const inbound=new Set(state.conversations.filter(c=>c.direction==='in').map(c=>c.id));
 const replies=new Map(state.leads.map(l=>[l.id,l.lastReplyAt||'']));
 return {stages,inbound,replies};
}
/** Tras una mutación: sale de secuencias si el contacto cambió de etapa o respondió; completa las terminadas. */
export function reconcileEnrollments(state,snap,now=new Date()){
 if(!state.enrollments.some(isOpen))return 0;
 const byLead=new Map(state.leads.map(l=>[l.id,l]));let changes=0;
 const replied=new Set(state.conversations.filter(c=>c.direction==='in'&&!snap.inbound.has(c.id)).map(c=>c.leadId));
 for(const e of state.enrollments){
  if(!isOpen(e))continue;const l=byLead.get(e.leadId);
  if(!l){changes+=exitEnrollments(state,e.leadId,'Se eliminó el contacto',now);continue;}
  const key=`${l.pipeline||'venta'}/${l.stageId||l.status}/${l.status}`;
  if(snap.stages.has(l.id)&&snap.stages.get(l.id)!==key){changes+=exitEnrollments(state,e.leadId,'Cambió de etapa',now);continue;}
  if(replied.has(l.id)||(l.lastReplyAt||'')!==(snap.replies.get(l.id)||'')&&l.lastReplyAt){changes+=exitEnrollments(state,e.leadId,'El contacto respondió',now);continue;}
  const mine=state.tasks.filter(t=>t.enrollmentId===e.id);
  if(e.status==='active'&&mine.length&&mine.every(t=>t.done)){e.status='completed';e.endedAt=now.toISOString();changes++;}
 }
 return changes;
}
