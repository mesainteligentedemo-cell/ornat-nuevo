// Tareas y recordatorios: filtros, calendario semanal, enlace a Google Calendar y archivo .ics (RFC 5545).
import {cleanTask,TASK_TYPES,dayKey,addDays,weekStart,uid} from './store.js';

export const TASK_RANGES={today:'Hoy',overdue:'Vencidas',week:'Esta semana',later:'Más adelante'};
export const defaultTaskFilters=()=>({range:'',type:'',owner:'',done:'open',leadId:'',q:''});
const fold=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();

/** Una tarea de una inscripción pausada o terminada no cuenta como pendiente. */
export function hiddenTaskIds(tasks,enrollments){
 const paused=new Set(enrollments.filter(e=>e.status==='paused').map(e=>e.id));
 return new Set(tasks.filter(t=>t.enrollmentId&&paused.has(t.enrollmentId)).map(t=>t.id));
}
export function taskState(task,now=new Date()){
 if(task.done)return 'done';
 const due=new Date(task.dueAt);if(due<now)return 'overdue';
 return dayKey(due)===dayKey(now)?'today':'upcoming';
}
export function filterTasks(tasks,filters={},now=new Date(),{hidden=new Set()}={}){
 const f={...defaultTaskFilters(),...filters},today=dayKey(now),end=addDays(today,6),q=fold(f.q);
 return tasks.filter(t=>{
  if(hidden.has(t.id))return false;
  if(f.done==='open'&&t.done)return false;if(f.done==='done'&&!t.done)return false;
  if(f.type&&t.type!==f.type)return false;
  if(f.leadId&&t.leadId!==f.leadId)return false;
  if(f.owner&&fold(t.owner)!==fold(f.owner))return false;
  if(q&&!fold(`${t.title} ${t.notes}`).includes(q))return false;
  const k=dayKey(t.dueAt);
  if(f.range==='today'&&k!==today)return false;
  if(f.range==='overdue'&&(t.done||new Date(t.dueAt)>=now))return false;
  if(f.range==='week'&&(k<today||k>end))return false;
  if(f.range==='later'&&k<=end)return false;
  return true;
 }).sort((a,b)=>a.dueAt<b.dueAt?-1:a.dueAt>b.dueAt?1:a.title.localeCompare(b.title,'es'));
}
export function taskCounts(tasks,now=new Date(),opts){
 const base=tasks.filter(t=>!t.done&&!(opts?.hidden?.has(t.id)));
 return {today:filterTasks(base,{range:'today'},now,opts).length,overdue:filterTasks(base,{range:'overdue'},now,opts).length,week:filterTasks(base,{range:'week'},now,opts).length,open:base.length};
}

/** Semana lunes–domingo que contiene `anchor` (o la indicada por clave AAAA-MM-DD del lunes). */
export function weekGrid(tasks,mondayKey,now=new Date(),{hidden=new Set()}={}){
 const days=[];const names=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
 for(let i=0;i<7;i++){const key=addDays(mondayKey,i);days.push({key,name:names[i],day:Number(key.slice(8)),today:key===dayKey(now),tasks:[]});}
 for(const t of tasks){if(hidden.has(t.id))continue;const k=dayKey(t.dueAt),d=days.find(x=>x.key===k);if(d)d.tasks.push(t);}
 for(const d of days)d.tasks.sort((a,b)=>a.dueAt<b.dueAt?-1:1);
 return days;
}
export {weekStart,addDays};

export function newTask(input,now=new Date()){return cleanTask({id:uid(),createdAt:now.toISOString(),...input});}
/** Combina un día (AAAA-MM-DD) y una hora (HH:MM) locales en ISO. */
export function dueFromParts(day,time='09:00'){
 const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(day||''),t=/^(\d{1,2}):(\d{2})$/.exec(time||'');
 if(!m||!t)throw new Error('Indica una fecha y una hora válidas para la tarea.');
 const d=new Date(+m[1],+m[2]-1,+m[3],+t[1],+t[2],0,0);
 if(Number.isNaN(d.getTime())||dayKey(d)!==day||+t[1]>23||+t[2]>59)throw new Error('Indica una fecha y una hora válidas para la tarea.');
 return d.toISOString();
}
export const timeOf=iso=>{const d=new Date(iso);return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;};

// ───────────── Calendario externo ─────────────
const p2=n=>String(n).padStart(2,'0');
export function icsDate(iso){const d=new Date(iso);return `${d.getUTCFullYear()}${p2(d.getUTCMonth()+1)}${p2(d.getUTCDate())}T${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}Z`;}
const endOf=t=>new Date(new Date(t.dueAt).getTime()+(t.durationMin||30)*60000).toISOString();
export function taskDescription(task,lead){
 const parts=[];if(lead)parts.push(`Contacto: ${lead.name}${lead.company?` (${lead.company})`:''}`);if(lead?.phone)parts.push(`Teléfono: ${lead.phone}`);if(lead?.email)parts.push(`Correo: ${lead.email}`);if(task.notes)parts.push(task.notes);parts.push(`Tipo: ${TASK_TYPES[task.type]} · Creada en ORNAT Control`);return parts.join('\n');
}
export function googleCalendarURL(task,lead){
 const u=new URL('https://calendar.google.com/calendar/render');
 u.searchParams.set('action','TEMPLATE');u.searchParams.set('text',`${TASK_TYPES[task.type]}: ${task.title}`);
 u.searchParams.set('dates',`${icsDate(task.dueAt)}/${icsDate(endOf(task))}`);u.searchParams.set('details',taskDescription(task,lead));
 return u.toString();
}
/** Identificador seguro para UID: solo letras, números y guiones (nunca saltos de línea ni separadores). */
export const icsUid=id=>String(id??'').replace(/[^A-Za-z0-9-]/g,'-').slice(0,200)||'tarea';
export const icsEscape=s=>String(s??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u0085\u2028\u2029]/g,' ').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r\n|\r|\n/g,'\\n');
/** Pliega líneas a 75 octetos como pide RFC 5545 §3.1 (continuación = CRLF + espacio), sin partir caracteres UTF-8. */
export function foldLine(line){
 const enc=new TextEncoder();if(enc.encode(line).length<=75)return line;
 const out=[];let cur='',bytes=0,limit=75;
 for(const ch of line){const n=enc.encode(ch).length;if(bytes+n>limit){out.push(cur);cur=' ';bytes=1;limit=75;}cur+=ch;bytes+=n;}
 out.push(cur);return out.join('\r\n');
}
export function tasksToICS(tasks,{leadsById=new Map(),now=new Date(),name='ORNAT Control'}={}){
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//ORNAT//Control CRM//ES','CALSCALE:GREGORIAN','METHOD:PUBLISH',`X-WR-CALNAME:${icsEscape(name)}`];
 for(const t of tasks){
  const lead=leadsById.get(t.leadId);
  lines.push('BEGIN:VEVENT',`UID:${icsUid(t.id)}@control.ornat`,`DTSTAMP:${icsDate(now.toISOString())}`,`DTSTART:${icsDate(t.dueAt)}`,`DTEND:${icsDate(endOf(t))}`,
   `SUMMARY:${icsEscape(`${TASK_TYPES[t.type]}: ${t.title}`)}`,`DESCRIPTION:${icsEscape(taskDescription(t,lead))}`,`STATUS:${t.done?'COMPLETED':'CONFIRMED'}`,`CATEGORIES:${icsEscape(TASK_TYPES[t.type])}`,
   'BEGIN:VALARM','ACTION:DISPLAY',`DESCRIPTION:${icsEscape(t.title)}`,'TRIGGER:-PT15M','END:VALARM','END:VEVENT');
 }
 lines.push('END:VCALENDAR');
 return lines.map(foldLine).join('\r\n')+'\r\n';
}

// ───────────── Recordatorios (solo mientras la app está abierta) ─────────────
/** Tareas cuya hora ya llegó (hasta 24 h atrás) y de las que aún no se avisó. */
export function dueReminders(tasks,now=new Date(),notified=new Set(),{hidden=new Set(),leadMinutes=0}={}){
 const t1=now.getTime()+leadMinutes*60000,t0=now.getTime()-864e5;
 return tasks.filter(t=>!t.done&&!hidden.has(t.id)&&!notified.has(`${t.id}|${t.dueAt}`)&&new Date(t.dueAt).getTime()<=t1&&new Date(t.dueAt).getTime()>=t0);
}
