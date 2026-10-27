// Vista «Tareas»: lista, calendario semanal, recordatorios y exportación a calendario.
import {TASK_TYPES,PRIORITIES,dayKey,addDays,weekStart,cleanTask,uid} from './store.js';
import {filterTasks,taskCounts,weekGrid,hiddenTaskIds,defaultTaskFilters,dueFromParts,timeOf,googleCalendarURL,tasksToICS,dueReminders,taskState,TASK_RANGES} from './tasks.js';
import {enrollInSequence,pauseEnrollment,resumeEnrollment,exitEnrollments} from './messaging.js';
import {ctx,setCtx,$,esc,btn,fld,sel2,leadOptions,dateTime,localInput,pill,openExternal} from './ui-common.js';

let C,filters={...defaultTaskFilters()},mode='list',weekKey=weekStart(),notified=new Set(),timer;
const NKEY='ornat-notified-v1';
try{notified=new Set(JSON.parse(sessionStorage.getItem(NKEY)||'[]'));}catch{}

export function init(c){C=c;setCtx(c);clearInterval(timer);timer=setInterval(checkReminders,30000);setTimeout(checkReminders,1500);}
const S=()=>C.getState();
const leadsById=()=>new Map(S().leads.map(l=>[l.id,l]));
const hidden=()=>hiddenTaskIds(S().tasks,S().enrollments);
const notifSupported=()=>typeof Notification!=='undefined';

export function checkReminders(){
 try{
  const due=dueReminders(S().tasks,new Date(),notified,{hidden:hidden()});if(!due.length)return;
  const lb=leadsById();
  for(const t of due){
   notified.add(`${t.id}|${t.dueAt}`);const l=lb.get(t.leadId);
   C.toast(`Recordatorio: ${t.title}${l?` · ${l.name}`:''}`);
   if(notifSupported()&&Notification.permission==='granted'){try{new Notification('ORNAT · '+TASK_TYPES[t.type],{body:`${t.title}${l?` · ${l.name}`:''}`,tag:t.id});}catch{}}
  }
  try{sessionStorage.setItem(NKEY,JSON.stringify([...notified].slice(-500)));}catch{}
  C.refreshBadges?.();
 }catch{}
}
async function askPermission(){
 if(!notifSupported()){C.toast('Tu navegador no admite notificaciones. Verás los avisos dentro de la app.',true);return;}
 const r=await Notification.requestPermission();C.toast(r==='granted'?'Avisos del navegador activados mientras tengas esta pestaña abierta.':'Sin permiso: verás los recordatorios dentro de la app.');render();
}
const permLabel=()=>!notifSupported()?'Avisos no disponibles':Notification.permission==='granted'?'Avisos del navegador: activos':Notification.permission==='denied'?'Avisos bloqueados en el navegador':'Activar avisos del navegador';

// ───────────── Vista ─────────────
export function render(){
 const st=S(),now=new Date(),h=hidden(),counts=taskCounts(st.tasks,now,{hidden:h});
 const list=filterTasks(st.tasks,filters,now,{hidden:h});
 const chip=(r,label,n)=>`<button type="button" class="chip-toggle" data-action="task-range" data-range="${r}" aria-pressed="${filters.range===r}">${label}${n!==undefined?` · ${n}`:''}</button>`;
 const owners=[...new Set([...C.owners(),...st.tasks.map(t=>t.owner)].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
 const me=C.user().name;
 $('#content').innerHTML=`
 <div class="stats">${stat('HOY',counts.today,'tareas para hoy')}${stat('VENCIDAS',counts.overdue,'sin completar',counts.overdue>0)}${stat('ESTA SEMANA',counts.week,'próximos 7 días')}${stat('ABIERTAS',counts.open,'en total')}</div>
 <div class="crm-bar">
  <div class="stage-chips" role="group" aria-label="Rango"><span class="lbl">Ver</span>${chip('', 'Todas')}${chip('today','Hoy',counts.today)}${chip('overdue','Vencidas',counts.overdue)}${chip('week','Semana',counts.week)}${chip('later','Más adelante')}</div>
 </div>
 <div class="crm-bar">
  <label class="searchbox"><span class="sr-only">Buscar tareas</span><input type="search" id="tk-q" placeholder="Buscar tareas…" value="${esc(filters.q)}"></label>
  <label class="sortbox"><span class="sr-only">Tipo</span><select id="tk-type" aria-label="Tipo de tarea"><option value="">Todos los tipos</option>${Object.entries(TASK_TYPES).map(([k,t])=>`<option value="${k}" ${filters.type===k?'selected':''}>${t}</option>`).join('')}</select></label>
  <label class="sortbox"><span class="sr-only">Responsable</span><select id="tk-owner" aria-label="Responsable"><option value="">Todos los responsables</option>${owners.map(o=>`<option ${filters.owner===o?'selected':''}>${esc(o)}</option>`).join('')}</select></label>
  <label class="sortbox"><span class="sr-only">Estado</span><select id="tk-done" aria-label="Estado"><option value="open" ${filters.done==='open'?'selected':''}>Pendientes</option><option value="done" ${filters.done==='done'?'selected':''}>Hechas</option><option value="all" ${filters.done==='all'?'selected':''}>Todas</option></select></label>
  ${btn('Mías','task-mine','small',`aria-pressed="${filters.owner===me&&!!me}"`)}
  <div class="seg" role="group" aria-label="Tipo de vista"><button type="button" data-action="task-mode" data-mode="list" aria-pressed="${mode==='list'}">Lista</button><button type="button" data-action="task-mode" data-mode="week" aria-pressed="${mode==='week'}">Semana</button></div>
 </div>
 <div class="crm-bar">${btn(permLabel(),'task-notify','small',Notification_disabled())}${btn(`Descargar .ics (${list.length})`,'task-ics-all','small',list.length?'':'disabled')}<span class="muted">Los avisos funcionan mientras esta pestaña esté abierta. Para recordatorios con la app cerrada, añade la tarea a tu calendario.</span></div>
 <p id="tk-count" class="crm-count" role="status" aria-live="polite"><b>${list.length}</b> tarea${list.length===1?'':'s'}</p>
 ${mode==='week'?weekHTML(list,now):listHTML(list,now)}`;
}
const Notification_disabled=()=>(!notifSupported()||Notification.permission!=='default')?'disabled':'';
function stat(label,value,note,warn=false){return `<div class="stat ${warn?'featured':''}"><span class="label">${esc(label)}</span><strong>${value}</strong><small>${esc(note)}</small></div>`;}
function chipTask(t,lb){const l=lb.get(t.leadId),s=taskState(t);return `<button type="button" class="task-chip ${s}" data-action="edit-task" data-id="${esc(t.id)}" title="${esc(t.title)}"><b>${esc(timeOf(t.dueAt))}</b> ${esc(t.title)}${l?`<small>${esc(l.name)}</small>`:''}</button>`;}
function weekHTML(list,now){
 const lb=leadsById(),days=weekGrid(list,weekKey,now,{hidden:hidden()}),end=addDays(weekKey,6);
 return `<section class="card"><div class="card-head"><h2>Semana del ${esc(weekKey.slice(8))}/${esc(weekKey.slice(5,7))} al ${esc(end.slice(8))}/${esc(end.slice(5,7))}</h2><div class="actions">${btn('←','task-week','small',`data-dir="-1" aria-label="Semana anterior"`)}${btn('Hoy','task-week','small','data-dir="0"')}${btn('→','task-week','small',`data-dir="1" aria-label="Semana siguiente"`)}</div></div><div class="table-wrap"><div class="weekgrid" role="list">${days.map(d=>`<section class="wk-day ${d.today?'today':''}" role="listitem" aria-label="${d.name} ${d.day}: ${d.tasks.length} tareas"><h3><span>${d.name}</span> <b>${d.day}</b></h3>${d.tasks.map(t=>chipTask(t,lb)).join('')||'<p class="muted wk-empty">—</p>'}</section>`).join('')}</div></div>
 <p class="storage-meta">Se muestran las tareas que cumplen los filtros de arriba.</p></section>`;
}
function listHTML(list,now){
 if(!list.length)return `<section class="card">${C.empty('Sin tareas en esta vista','Crea una tarea o cambia los filtros. Las secuencias también generan tareas al inscribir un contacto.',btn('＋ Nueva tarea','new-task','small'))}</section>`;
 const lb=leadsById();
 return `<section class="card crm-table-card"><div class="table-wrap"><table class="crm-table"><thead><tr><th class="sel-col"><span class="sr-only">Hecha</span></th><th>Tarea</th><th>Tipo</th><th>Contacto</th><th>Cuándo</th><th>Responsable</th><th>Calendario</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>${list.slice(0,300).map(t=>{const l=lb.get(t.leadId),s=taskState(t,now);
  return `<tr class="${t.done?'is-done':''}"><td class="sel-col"><label class="chk"><input type="checkbox" data-task-done="${esc(t.id)}" ${t.done?'checked':''} aria-label="Marcar «${esc(t.title)}» como hecha"></label></td>
  <td><button class="link-btn" data-action="edit-task" data-id="${esc(t.id)}">${esc(t.title)}</button>${t.source==='sequence'?' <span class="tag">Secuencia</span>':''}${t.priority==='alta'?' <span class="follow overdue">Alta</span>':''}</td>
  <td>${esc(TASK_TYPES[t.type])}</td><td>${l?`<button class="link-btn" data-action="edit-lead" data-id="${esc(l.id)}">${esc(l.name)}</button>`:'<span class="muted">General</span>'}</td>
  <td>${esc(dateTime(t.dueAt))} ${s==='overdue'?'<span class="follow overdue">Vencida</span>':s==='today'?'<span class="follow today">Hoy</span>':''}</td><td>${esc(t.owner||'—')}</td>
  <td class="cal-links"><a class="btn small" href="${esc(googleCalendarURL(t,l))}" target="_blank" rel="noopener noreferrer" data-gcal="${esc(t.id)}">Google Calendar ↗</a> ${btn('.ics','task-ics','small',`data-id="${esc(t.id)}"`)}</td>
  <td>${btn('×','delete-task','small danger',`data-id="${esc(t.id)}" aria-label="Eliminar ${esc(t.title)}"`)}</td></tr>`;}).join('')}</tbody></table></div>${list.length>300?`<p class="storage-meta" style="padding:12px 16px">Mostrando 300 de ${list.length}. Usa los filtros para acotar.</p>`:''}</section>`;
}

// ───────────── Diálogo de tarea ─────────────
export function taskDialog(id='',preset={}){
 const old=id?S().tasks.find(t=>t.id===id):null,t=old||{title:'',type:'call',dueAt:'',leadId:preset.leadId||'',owner:preset.owner??C.user().name,priority:'media',durationMin:30,notes:''};
 const due=t.dueAt?new Date(t.dueAt):new Date(Date.now()+3600e3);
 C.openDialog('task',old?'Editar tarea':'Nueva tarea',`<div class="form-grid">
  ${fld('Título','title',t.title,{required:true,max:200,wide:true})}
  ${sel2('Tipo','type',t.type,Object.entries(TASK_TYPES))}${sel2('Prioridad','priority',t.priority,Object.entries(PRIORITIES))}
  ${fld('Día','day',dayKey(due),{type:'date',required:true})}${fld('Hora','time',timeOf(due.toISOString()),{type:'time',required:true})}
  ${fld('Duración (min)','durationMin',t.durationMin,{type:'number',extra:'min="5" max="1440"'})}${fld('Responsable','owner',t.owner,{list:'owners-list-t',max:100})}<datalist id="owners-list-t">${C.owners().map(o=>`<option value="${esc(o)}">`).join('')}</datalist>
  ${sel2('Contacto','leadId',t.leadId,leadOptions(S().leads,{blank:'Sin contacto (tarea general)'}),{wide:true})}
  ${fld('Notas','notes',t.notes,{type:'textarea',max:2000,wide:true,extra:'rows="3"'})}</div>
  ${old?`<div class="quick-actions"><a class="btn small" href="${esc(googleCalendarURL(old,S().leads.find(l=>l.id===old.leadId)))}" target="_blank" rel="noopener noreferrer">Añadir a Google Calendar ↗</a>${btn('Descargar .ics','task-ics','small',`data-id="${esc(old.id)}"`)}</div>`:''}`,
  `${old?btn('Eliminar','delete-task','danger',`data-id="${esc(old.id)}"`):''}${btn('Cancelar','close')}<button class="btn primary" type="submit">Guardar tarea</button>`,id);
}
function saveTask(values,id){
 const old=id?S().tasks.find(t=>t.id===id):null;
 const task=cleanTask({...(old||{}),id:old?.id||uid(),title:values.title,type:values.type,priority:values.priority,dueAt:dueFromParts(values.day,values.time),durationMin:values.durationMin||30,owner:values.owner,leadId:values.leadId,notes:values.notes,createdAt:old?.createdAt});
 return C.commit(old?'Editar tarea':'Crear tarea',s=>{if(old)s.tasks=s.tasks.map(t=>t.id===id?task:t);else s.tasks.push(task);},task.title);
}
function downloadICS(tasks,name){C.download(tasksToICS(tasks,{leadsById:leadsById()}),name,'text/calendar;charset=utf-8');C.toast(`Archivo .ics con ${tasks.length} tarea${tasks.length===1?'':'s'} descargado. Ábrelo con tu calendario.`);}

// ───────────── Pestaña «Tareas» de la ficha ─────────────
export function leadTab(lead){
 const st=S(),mine=st.tasks.filter(t=>t.leadId===lead.id).sort((a,b)=>a.dueAt<b.dueAt?-1:1),lb=new Map([[lead.id,lead]]);
 const enr=st.enrollments.filter(e=>e.leadId===lead.id);
 const seqs=st.settings.sequences;
 return `<div class="tab-block"><h4>Tareas de este contacto</h4>${mine.length?`<ul class="plain-list task-list">${mine.map(t=>`<li class="${t.done?'is-done':''}"><label class="chk-inline"><input type="checkbox" data-task-done="${esc(t.id)}" ${t.done?'checked':''} aria-label="Hecha: ${esc(t.title)}"><span><b>${esc(t.title)}</b><small>${esc(TASK_TYPES[t.type])} · ${esc(dateTime(t.dueAt))}${t.owner?' · '+esc(t.owner):''}${taskState(t)==='overdue'?' · <em class="over">vencida</em>':''}</small></span></label><span class="row-actions"><a class="btn small" href="${esc(googleCalendarURL(t,lead))}" target="_blank" rel="noopener noreferrer">Google Calendar ↗</a>${btn('.ics','task-ics','small',`data-id="${esc(t.id)}"`)}${btn('×','delete-task','small danger',`data-id="${esc(t.id)}" aria-label="Eliminar ${esc(t.title)}"`)}</span></li>`).join('')}</ul>`:'<p class="muted">Sin tareas. Crea la primera abajo.</p>'}
 <div class="mini-form"><label class="field"><span>Nueva tarea</span><input id="lt-title" type="text" maxlength="200" placeholder="Ej. Llamar para confirmar la visita"></label>
  <div class="tl-row"><label class="field"><span>Tipo</span><select id="lt-type">${Object.entries(TASK_TYPES).map(([k,t])=>`<option value="${k}">${t}</option>`).join('')}</select></label><label class="field"><span>Día</span><input id="lt-day" type="date" value="${addDays(dayKey(new Date()),1)}"></label></div>
  <div class="tl-row"><label class="field"><span>Hora</span><input id="lt-time" type="time" value="10:00"></label><label class="field"><span>Responsable</span><input id="lt-owner" type="text" list="owners-list-t" value="${esc(lead.owner||C.user().name)}"></label></div>
  ${btn('Añadir tarea','lead-add-task','small primary',`data-id="${esc(lead.id)}"`)}</div></div>
 <div class="tab-block"><h4>Secuencias</h4>${enr.length?`<ul class="plain-list">${enr.map(e=>{const sq=seqs.find(x=>x.id===e.sequenceId);return `<li><b>${esc(sq?.name||'Secuencia eliminada')}</b> ${pill({active:'Activa',paused:'Pausada',completed:'Completada',exited:'Terminada'}[e.status],e.status==='active'?'won':e.status==='paused'?'contacted':'')}<small class="muted">${e.status==='exited'?esc(e.reason)+' · ':''}desde ${esc(dateTime(e.startedAt))}</small><span class="row-actions">${e.status==='active'?btn('Pausar','seq-pause','small',`data-id="${esc(e.id)}"`):''}${e.status==='paused'?btn('Reanudar','seq-resume','small',`data-id="${esc(e.id)}"`):''}${['active','paused'].includes(e.status)?btn('Salir','seq-exit','small danger',`data-id="${esc(e.id)}" data-lead="${esc(lead.id)}"`):''}</span></li>`;}).join('')}</ul>`:'<p class="muted">Sin secuencias.</p>'}
 <div class="mini-form"><label class="field"><span>Inscribir en una secuencia</span><select id="lt-seq">${seqs.map(q=>`<option value="${esc(q.id)}">${esc(q.name)} (${q.steps.length} pasos)</option>`).join('')}</select></label>${btn('Inscribir y crear tareas','seq-enroll','small',`data-id="${esc(lead.id)}" ${seqs.length?'':'disabled'}`)}<small class="muted">Crea una tarea por paso con su fecha. Sale sola cuando el contacto responde o cambia de etapa.</small></div></div>`;
}

// ───────────── Eventos ─────────────
export function handleAction(action,el){
 const id=el.dataset.id;
 switch(action){
  case 'new-task':taskDialog('',{});return true;
  case 'edit-task':taskDialog(id);return true;
  case 'task-range':filters={...filters,range:filters.range===el.dataset.range?'':el.dataset.range};render();return true;
  case 'task-mode':mode=el.dataset.mode;render();return true;
  case 'task-mine':filters={...filters,owner:filters.owner===C.user().name?'':C.user().name};render();return true;
  case 'task-notify':askPermission();return true;
  case 'task-week':{const d=Number(el.dataset.dir);weekKey=d===0?weekStart():addDays(weekKey,7*d);render();return true;}
  case 'task-ics':{const t=S().tasks.find(x=>x.id===id);if(t)downloadICS([t],`ornat-tarea-${t.id.slice(0,8)}.ics`);return true;}
  case 'task-ics-all':downloadICS(filterTasks(S().tasks,filters,new Date(),{hidden:hidden()}),'ornat-tareas.ics');return true;
  case 'delete-task':{const t=S().tasks.find(x=>x.id===id);if(!t)return true;if(!confirm(`¿Eliminar la tarea «${t.title}»?`))return true;if(C.commit('Eliminar tarea',s=>{s.tasks=s.tasks.filter(x=>x.id!==id);},t.title)&&$('#dialog').dataset.kind==='task')C.closeDialog();return true;}
  case 'lead-add-task':{
   const title=$('#lt-title')?.value.trim();if(!title){C.toast('Escribe qué hay que hacer.',true);$('#lt-title')?.focus();return true;}
   try{const lead=S().leads.find(l=>l.id===id);const task=cleanTask({id:uid(),title,type:$('#lt-type').value,dueAt:dueFromParts($('#lt-day').value,$('#lt-time').value),leadId:id,owner:$('#lt-owner').value,priority:'media'});
    C.commit('Crear tarea',s=>{s.tasks.push(task);},`${task.title} · ${lead?.name||''}`);}catch(e){C.toast(e.message,true);}return true;}
  case 'seq-enroll':{
   try{const lead=C.raw().leads.find(l=>l.id===id),sq=C.raw().settings.sequences.find(x=>x.id===$('#lt-seq').value);if(!lead||!sq)return true;
    const r=enrollInSequence({lead,sequence:sq,templates:C.raw().settings.templates,existing:C.raw().enrollments,owner:C.user().name});
    C.commit('Inscribir en secuencia',s=>{s.enrollments.push(r.enrollment);s.tasks.push(...r.tasks);},`${lead.name} → ${sq.name} · ${r.tasks.length} tareas`);}catch(e){C.toast(e.message,true);}return true;}
  case 'seq-pause':try{C.commit('Pausar secuencia',s=>pauseEnrollment(s,id),id);}catch(e){C.toast(e.message,true);}return true;
  case 'seq-resume':try{C.commit('Reanudar secuencia',s=>resumeEnrollment(s,id),id);}catch(e){C.toast(e.message,true);}return true;
  case 'seq-exit':C.commit('Salir de la secuencia',s=>{exitEnrollments(s,el.dataset.lead,'Salida manual');},id);return true;
 }
 return false;
}
export function handleSubmit(kind,values,id){if(kind==='task'){try{return saveTask(values,id);}catch(e){C.toast(e.message,true);return false;}}return undefined;}
export function handleInput(el){if(el.id==='tk-q'){filters={...filters,q:el.value};render();const q=$('#tk-q');if(q){q.focus();q.setSelectionRange(q.value.length,q.value.length);}return true;}return false;}
export function handleChange(el){
 if(el.id==='tk-type'){filters={...filters,type:el.value};render();return true;}
 if(el.id==='tk-owner'){filters={...filters,owner:el.value};render();return true;}
 if(el.id==='tk-done'){filters={...filters,done:el.value};render();return true;}
 if(el.dataset.taskDone){const id=el.dataset.taskDone,done=el.checked;C.commit(done?'Completar tarea':'Reabrir tarea',s=>{s.tasks=s.tasks.map(t=>t.id===id?cleanTask({...t,done,doneAt:done?new Date().toISOString():''}):t);},S().tasks.find(t=>t.id===id)?.title||'')||(el.checked=!done);return true;}
 return false;
}
