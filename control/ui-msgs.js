// Conversaciones (registro manual), plantillas, envío por mailto:/wa.me y vista «Bandejas».
import {CONV_CHANNELS,cleanConversation,addTimelineEntry,uid} from './store.js';
import {renderTemplate,templateVars,mailtoURL,waURL,SENT_NOTE} from './messaging.js';
import {recentIntake} from './intake.js';
import {setCtx,$,esc,btn,fld,sel2,dateTime,leadOptions,openExternal,pill} from './ui-common.js';

let C,filters={channel:'',direction:'',q:''};
export const init=c=>{C=c;setCtx(c);};
const S=()=>C.getState();
const SRC={manual:'Registro manual','wa.me':'Enviado por wa.me — no verificado',mailto:'Enviado por correo — no verificado'};
const NOTICE='Registro manual — la bandeja automática se activa al conectar la API oficial de Meta. Lo que registres aquí lo escribes tú; la app no lee tus mensajes.';
const CH_CLASS={WhatsApp:'won',Instagram:'proposal',Correo:'contacted',Llamada:''};
const draft={}; // por contacto: lo que se está escribiendo en la pestaña

function vars(lead){
 const prop=C.properties().find(p=>(p.leadIds||[]).includes(lead.id));
 return templateVars(lead,{property:prop,user:C.user().name,pipelines:C.pipelines(),origin:location.origin});
}

// ───────────── Vista «Bandejas» ─────────────
export function render(){
 const st=S(),lb=new Map(st.leads.map(l=>[l.id,l])),q=filters.q.toLowerCase();
 const list=st.conversations.filter(c=>(!filters.channel||c.channel===filters.channel)&&(!filters.direction||c.direction===filters.direction)&&(!q||`${c.text} ${c.subject} ${lb.get(c.leadId)?.name||''}`.toLowerCase().includes(q))).sort((a,b)=>a.at<b.at?1:-1);
 const intake=recentIntake(st.leads,8);
 $('#content').innerHTML=`<div class="notice">${esc(NOTICE)}</div>
 <section class="card"><div class="card-head"><h2>Entradas recientes del sitio</h2><span>${intake.length?`${new Set(intake.filter(r=>r.fresh).map(r=>r.leadId)).size} sin atender`:''}</span></div>${intake.length?`<ul class="plain-list">${intake.map(r=>`<li><button class="link-btn" data-action="edit-lead" data-id="${esc(r.leadId)}">${esc(r.name)}</button> ${r.fresh?'<span class="follow today">Nuevo</span>':''}<small class="muted">${esc(dateTime(r.at))}</small><p class="muted intake-text">${esc(r.text.replace(/\n/g,' · ').slice(0,220))}</p></li>`).join('')}</ul>`:C.empty('Aún no llegan formularios','Cuando alguien llene un formulario del sitio público, aparecerá aquí y se creará su contacto.')}</section>
 <div class="crm-bar"><label class="searchbox"><span class="sr-only">Buscar conversaciones</span><input type="search" id="cv-q" placeholder="Buscar en conversaciones…" value="${esc(filters.q)}"></label>
 <label class="sortbox"><span class="sr-only">Canal</span><select id="cv-channel" aria-label="Canal"><option value="">Todos los canales</option>${CONV_CHANNELS.map(c=>`<option ${filters.channel===c?'selected':''}>${c}</option>`).join('')}</select></label>
 <label class="sortbox"><span class="sr-only">Dirección</span><select id="cv-dir" aria-label="Dirección"><option value="">Enviados y recibidos</option><option value="out" ${filters.direction==='out'?'selected':''}>Enviados</option><option value="in" ${filters.direction==='in'?'selected':''}>Recibidos</option></select></label>
 ${btn('＋ Registrar conversación','new-conv','small primary')}</div>
 <p class="crm-count" role="status" aria-live="polite"><b>${list.length}</b> de ${st.conversations.length} conversaciones registradas</p>
 ${list.length?`<section class="card crm-table-card"><div class="table-wrap"><table class="crm-table"><thead><tr><th>Fecha</th><th>Canal</th><th>Contacto</th><th>Mensaje</th><th>Origen</th></tr></thead><tbody>${list.slice(0,200).map(c=>{const l=lb.get(c.leadId);return `<tr><td>${esc(dateTime(c.at))}</td><td>${pill(c.channel,CH_CLASS[c.channel])}<small>${c.direction==='in'?'Recibido':'Enviado'}</small></td><td>${l?`<button class="link-btn" data-action="edit-lead" data-id="${esc(l.id)}">${esc(l.name)}</button>`:'—'}</td><td>${c.subject?`<b>${esc(c.subject)}</b><br>`:''}${esc(c.text.slice(0,200))}${c.text.length>200?'…':''}</td><td><span class="source-label">${esc(SRC[c.source])}</span></td></tr>`;}).join('')}</tbody></table></div></section>`:`<section class="card">${C.empty('Sin conversaciones registradas','Registra llamadas, mensajes de WhatsApp o Instagram y correos desde la ficha del contacto o con el botón de arriba. No mostramos chats inventados.')}</section>`}
 <div class="connections">${[['◎','Instagram','Mensajes directos y comentarios'],['◉','WhatsApp Business','Conversaciones con tus prospectos'],['✉','Correo electrónico','Consultas y seguimiento']].map(([icon,name,description])=>`<section class="card connection"><span class="network">${icon}</span><h3>${name}</h3><p class="muted">${description}</p><span class="network-status">○ Sin conectar</span>${btn('Ver requisitos de conexión','connection','small',`data-network="${name}"`)}</section>`).join('')}</div>`;
}
function convDialog(leadId=''){
 C.openDialog('conv','Registrar conversación',`<div class="notice">${esc(NOTICE)}</div><div class="form-grid">${sel2('Contacto','leadId',leadId,leadOptions(S().leads,{blank:'Elige un contacto…'}),{wide:true})}${sel2('Canal','channel','WhatsApp',CONV_CHANNELS.map(c=>[c,c]))}${sel2('Dirección','direction','in',[['in','Recibido (me escribió)'],['out','Enviado (le escribí)']])}${fld('Asunto (solo correo)','subject','',{max:200,wide:true})}${fld('Mensaje o resumen','text','',{type:'textarea',max:5000,wide:true,required:true,extra:'rows="4"'})}${fld('Fecha y hora','at',new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,16),{type:'datetime-local'})}</div>`,`${btn('Cancelar','close')}<button class="btn primary" type="submit">Registrar</button>`);
}
function logConversation(conv,{note=null}={}){
 const c=cleanConversation({id:uid(),...conv});
 return C.commit(`Conversación: ${c.channel} ${c.direction==='in'?'recibida':'enviada'}`,s=>{
  s.conversations.push(c);
  s.leads=s.leads.map(l=>{
   if(l.id!==c.leadId)return l;
   let n=l;const text=note||`${c.channel} ${c.direction==='in'?'recibido':'registrado'}: ${c.text.slice(0,160)}`;
   const type={WhatsApp:'whatsapp',Correo:'email',Llamada:'call',Instagram:'note'}[c.channel]||'note';
   n=addTimelineEntry(n,{type,text,at:c.at});
   if(c.direction==='in')n={...n,lastReplyAt:c.at};
   return n;});
 },`${c.channel} · ${c.leadId}`);
}

// ───────────── Pestaña «Mensajes» de la ficha ─────────────
export function leadTab(lead){
 const d=draft[lead.id]||{channel:'WhatsApp',tpl:'',text:'',subject:'',dir:'out'};
 const tpls=C.raw().settings.templates.filter(t=>d.channel==='Correo'?t.channel==='email':d.channel==='WhatsApp'?t.channel==='whatsapp':false);
 const conv=S().conversations.filter(c=>c.leadId===lead.id).sort((a,b)=>a.at<b.at?1:-1);
 const prev=previewInfo(lead,d);
 const canWA=d.channel==='WhatsApp',canMail=d.channel==='Correo';
 return `<div class="tab-block"><div class="notice small-notice">${esc(NOTICE)}</div>
 <div class="tl-row"><label class="field"><span>Canal</span><select id="cm-channel">${CONV_CHANNELS.map(c=>`<option ${d.channel===c?'selected':''}>${c}</option>`).join('')}</select></label><label class="field"><span>Dirección</span><select id="cm-dir"><option value="out" ${d.dir==='out'?'selected':''}>Enviado</option><option value="in" ${d.dir==='in'?'selected':''}>Recibido</option></select></label></div>
 ${tpls.length?`<label class="field"><span>Plantilla</span><select id="cm-tpl"><option value="">Sin plantilla</option>${tpls.map(t=>`<option value="${esc(t.id)}" ${d.tpl===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label>`:''}
 ${canMail?`<label class="field"><span>Asunto</span><input id="cm-subject" type="text" maxlength="200" value="${esc(d.subject)}"></label>`:''}
 <label class="field"><span>Mensaje</span><textarea id="cm-text" maxlength="5000" rows="5" placeholder="Escribe o elige una plantilla…">${esc(d.text)}</textarea></label>
 <div id="cm-warn">${prev}</div>
 <div class="actions">${btn('Registrar','cm-log','small primary',`data-id="${esc(lead.id)}"`)}${canWA?btn('Enviar por WhatsApp ↗','cm-send-wa','small',`data-id="${esc(lead.id)}"`):''}${canMail?btn('Enviar por correo ↗','cm-send-mail','small',`data-id="${esc(lead.id)}"`):''}${btn('Copiar','cm-copy','small',`data-id="${esc(lead.id)}"`)}</div>
 <small class="muted">«Enviar» abre tu WhatsApp o tu correo con el texto listo; tú lo mandas desde ahí y aquí queda anotado como «no verificado». «Registrar» solo guarda el texto.</small></div>
 <div class="tab-block"><h4>Conversaciones registradas</h4>${conv.length?`<ol class="chat">${conv.map(c=>`<li class="${c.direction}"><span class="chat-meta">${pill(c.channel,CH_CLASS[c.channel])} ${c.direction==='in'?'Recibido':'Enviado'} · ${esc(dateTime(c.at))}</span>${c.subject?`<b>${esc(c.subject)}</b>`:''}<p>${esc(c.text)}</p><small class="muted">${esc(SRC[c.source])}</small></li>`).join('')}</ol>`:'<p class="muted">Aún no hay conversaciones registradas con este contacto.</p>'}</div>`;
}
function previewInfo(lead,d){
 const r=renderTemplate(d.text,vars(lead));const w=[];
 if(r.missing.length)w.push(`Faltan datos para: ${r.missing.map(m=>`{{${m}}}`).join(', ')}. Se enviarán vacíos.`);
 if(r.unknown.length)w.push(`Variables desconocidas: ${r.unknown.map(m=>`{{${m}}}`).join(', ')}.`);
 if(d.channel==='WhatsApp'&&!lead.phone)w.push('Este contacto no tiene teléfono: WhatsApp no podrá abrirse.');
 if(d.channel==='Correo'&&!lead.email)w.push('Este contacto no tiene correo: el mensaje se abrirá sin destinatario.');
 const showPreview=d.text&&/\{\{/.test(d.text);
 return `${showPreview?`<div class="preview"><span class="q-label">Vista previa</span><p>${esc(r.text).replace(/\n/g,'<br>')}</p></div>`:''}${w.map(x=>`<p class="warn-line">${esc(x)}</p>`).join('')}`;
}
function readDraft(lead){
 const d=draft[lead.id]||(draft[lead.id]={channel:'WhatsApp',tpl:'',text:'',subject:'',dir:'out'});
 const g=id=>$(id);if(g('#cm-channel'))d.channel=g('#cm-channel').value;if(g('#cm-dir'))d.dir=g('#cm-dir').value;if(g('#cm-tpl'))d.tpl=g('#cm-tpl').value;if(g('#cm-subject'))d.subject=g('#cm-subject').value;if(g('#cm-text'))d.text=g('#cm-text').value;
 return d;
}
function finalText(lead,d){return renderTemplate(d.text,vars(lead));}
function sendFlow(lead,kind){
 const d=readDraft(lead);if(!d.text.trim()){C.toast('Escribe el mensaje o elige una plantilla.',true);return;}
 const r=finalText(lead,d),subj=kind==='wa'?'':renderTemplate(d.subject,vars(lead)).text;
 try{
  const url=kind==='wa'?waURL(lead.phone,r.text):mailtoURL({to:lead.email,subject:subj,body:r.text});
  const ok=logConversation({leadId:lead.id,channel:kind==='wa'?'WhatsApp':'Correo',direction:'out',text:r.text,subject:subj,source:kind==='wa'?'wa.me':'mailto'},{note:`${kind==='wa'?SENT_NOTE.whatsapp:SENT_NOTE.email}: ${r.text.slice(0,140)}`});
  if(ok){draft[lead.id]={...d,text:'',tpl:'',subject:''};openExternal(url,kind!=='wa');C.refreshFicha();}
 }catch(e){C.toast(e.message,true);}
}

export function handleAction(action,el){
 const lead=el.dataset.id?C.raw().leads.find(l=>l.id===el.dataset.id):null;
 switch(action){
  case 'new-conv':convDialog();return true;
  case 'cm-log':{if(!lead)return true;const d=readDraft(lead);if(!d.text.trim()){C.toast('Escribe el mensaje o resumen a registrar.',true);return true;}const r=finalText(lead,d);
   try{const subj=d.channel==='Correo'?renderTemplate(d.subject,vars(lead)).text:'';if(logConversation({leadId:lead.id,channel:d.channel,direction:d.dir,text:r.text,subject:subj,source:'manual'})){draft[lead.id]={...d,text:'',tpl:'',subject:''};C.refreshFicha();}}catch(e){C.toast(e.message,true);}return true;}
  case 'cm-send-wa':if(lead)sendFlow(lead,'wa');return true;
  case 'cm-send-mail':if(lead)sendFlow(lead,'mail');return true;
  case 'cm-copy':{if(!lead)return true;const d=readDraft(lead),r=finalText(lead,d);(navigator.clipboard?.writeText(r.text)||Promise.reject()).then(()=>C.toast('Mensaje copiado.'),()=>C.toast('No se pudo copiar. Selecciona el texto manualmente.',true));return true;}
 }
 return false;
}
export function handleSubmit(kind,values){
 if(kind==='conv'){try{return logConversation({leadId:values.leadId,channel:values.channel,direction:values.direction,text:values.text,subject:values.subject,at:values.at?new Date(values.at).toISOString():undefined,source:'manual'});}catch(e){C.toast(e.message,true);return false;}}
 return undefined;
}
export function handleInput(el){
 if(el.id==='cv-q'){filters={...filters,q:el.value};render();const q=$('#cv-q');q.focus();q.setSelectionRange(q.value.length,q.value.length);return true;}
 if(el.id==='cm-text'||el.id==='cm-subject'){const lead=C.raw().leads.find(l=>l.id===$('#dialog').dataset.id);if(lead){const d=readDraft(lead);$('#cm-warn').innerHTML=previewInfo(lead,d);}return true;}
 return false;
}
export function handleChange(el){
 if(el.id==='cv-channel'){filters={...filters,channel:el.value};render();return true;}
 if(el.id==='cv-dir'){filters={...filters,direction:el.value};render();return true;}
 if(['cm-channel','cm-dir','cm-tpl'].includes(el.id)){
  const lead=C.raw().leads.find(l=>l.id===$('#dialog').dataset.id);if(!lead)return true;
  if(el.id==='cm-tpl'&&el.value){const t=C.raw().settings.templates.find(x=>x.id===el.value);if(t){const d=draft[lead.id]||(draft[lead.id]={channel:'WhatsApp',tpl:'',text:'',subject:'',dir:'out'});d.tpl=t.id;d.text=t.body;d.subject=t.subject||'';}}
  else readDraft(lead);
  if(el.id==='cm-channel'){const d=draft[lead.id];d.tpl='';}
  C.refreshFicha();return true;}
 return false;
}
