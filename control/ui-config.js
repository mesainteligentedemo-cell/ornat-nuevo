// Configuración del CRM: pipelines, puntaje, plantillas, secuencias y datos para cotizaciones.
import {STAGE_KINDS,TASK_TYPES,TEMPLATE_CHANNELS,SCORE_RULE_KEYS,DEFAULT_SCORE_RULES,cleanPipelines,uid} from './store.js';
import {applyPipelineConfig,slugify,stageCounts} from './pipelines.js';
import {RULE_LABELS,RULE_HELP} from './score.js';
import {TEMPLATE_VARS,renderTemplate,templateVars} from './messaging.js';
import {setCtx,$,$$,esc,btn,fld,sel2} from './ui-common.js';

let C,draft=null,cur='';
export const init=c=>{C=c;setCtx(c);};
const S=()=>C.raw();

export function sectionsHTML(){
 const st=S(),s=st.settings,counts=Object.fromEntries(s.pipelines.map(p=>[p.id,st.leads.filter(l=>(l.pipeline||'venta')===p.id).length]));
 const ro=C.access().canEdit?'':'disabled';
 return `<section class="card" id="cfg-pipelines"><div class="card-head"><h2>Pipelines</h2>${btn('Editar pipelines','cfg-pipelines','small primary',ro)}</div><p class="muted">Cada pipeline tiene sus propias etapas, probabilidad y color. Los contactos existentes viven en «Venta».</p><ul class="plain-list">${s.pipelines.map(p=>`<li><b>${esc(p.name)}</b> <span class="muted">${Number(counts[p.id])||0} contactos</span><div class="stage-strip">${p.stages.map(x=>`<span class="stage-dot" style="--c:${esc(x.color)}">${esc(x.name)} · ${Number(x.prob)}%</span>`).join('')}</div></li>`).join('')}</ul></section>
 <div class="grid-two"><section class="card"><div class="card-head"><h2>Puntaje del contacto</h2>${btn('Editar reglas','cfg-score','small',ro)}</div><p class="muted">Un número de 0 a 100 que suma puntos por: ${SCORE_RULE_KEYS.map(k=>`${RULE_LABELS[k].toLowerCase()} (${s.scoreRules[k].on?s.scoreRules[k].weight:'apagada'})`).join(', ')}. En la ficha ves el desglose.</p></section>
 <section class="card"><div class="card-head"><h2>Datos para cotizaciones</h2>${btn('Editar','cfg-issuer','small',ro)}</div><p class="muted"><b>${esc(s.issuer.name)}</b>${s.issuer.email?` · ${esc(s.issuer.email)}`:''}${s.issuer.phone?` · ${esc(s.issuer.phone)}`:''}${s.issuer.address?`<br>${esc(s.issuer.address)}`:''}${s.issuer.taxId?`<br>RFC ${esc(s.issuer.taxId)}`:''}</p><p class="storage-meta">Aparecen en el encabezado de cada cotización impresa.</p></section></div>
 <div class="grid-two"><section class="card"><div class="card-head"><h2>Plantillas</h2>${btn('＋ Nueva plantilla','cfg-tpl-new','small',ro)}</div><ul class="plain-list">${s.templates.map(t=>`<li><b>${esc(t.name)}</b> <span class="chan">${esc(TEMPLATE_CHANNELS[t.channel])}</span> ${btn('Editar','cfg-tpl','small',`data-id="${esc(t.id)}" ${ro}`)}</li>`).join('')||'<li class="muted">Sin plantillas.</li>'}</ul></section>
 <section class="card"><div class="card-head"><h2>Secuencias</h2>${btn('＋ Nueva secuencia','cfg-seq-new','small',ro)}</div><ul class="plain-list">${s.sequences.map(q=>`<li><b>${esc(q.name)}</b> <span class="muted">${q.steps.length} pasos · ${q.steps.reduce((a,x)=>a+x.wait,0)} días</span> ${btn('Editar','cfg-seq','small',`data-id="${esc(q.id)}" ${ro}`)}</li>`).join('')||'<li class="muted">Sin secuencias.</li>'}</ul></section></div>`;
}

// ───────────── Pipelines ─────────────
function pipelinesDialog(){
 draft=structuredClone(S().settings.pipelines);cur=draft[0].id;drawPipelines();
}
function syncDraft(){
 const p=draft.find(x=>x.id===cur);if(!p)return;
 const name=$('#pl-name');if(name)p.name=name.value;
 $$('.st-row').forEach(row=>{const st=p.stages[Number(row.dataset.i)];if(!st)return;st.name=row.querySelector('[data-f=name]').value;st.kind=row.querySelector('[data-f=kind]').value;const pr=row.querySelector('[data-f=prob]');st.prob=Number(pr.value);st.color=row.querySelector('[data-f=color]').value;});
}
function drawPipelines(){
 const p=draft.find(x=>x.id===cur),counts=stageCounts(S().leads,draft,p.id);
 C.openDialog('pipelines','Pipelines y etapas',`<div class="pl-tabs" role="tablist">${draft.map(x=>`<button type="button" role="tab" class="chip-toggle" data-action="pl-tab" data-id="${esc(x.id)}" aria-pressed="${x.id===cur}">${esc(x.name)}</button>`).join('')}${btn('＋ Pipeline','pl-add','small ghost')}</div>
 <div class="form-grid">${fld('Nombre del pipeline','plname',p.name,{max:40,id:'pl-name'})}<div class="field"><span>&nbsp;</span>${btn('Eliminar este pipeline','pl-del','small danger')}</div></div>
 <div class="st-table" role="table" aria-label="Etapas"><div class="st-row st-head" role="row"><span>Etapa</span><span>Tipo</span><span>Prob. %</span><span>Color</span><span></span></div>
 ${p.stages.map((s,i)=>`<div class="st-row" data-i="${i}" role="row"><input data-f="name" type="text" maxlength="40" value="${esc(s.name)}" aria-label="Nombre de la etapa ${i+1}"><select data-f="kind" aria-label="Tipo de etapa ${i+1}">${Object.entries(STAGE_KINDS).map(([k,t])=>`<option value="${k}" ${s.kind===k?'selected':''}>${t}</option>`).join('')}</select><input data-f="prob" type="number" min="0" max="100" value="${s.prob}" ${s.kind!=='open'?'disabled':''} aria-label="Probabilidad de la etapa ${i+1}"><input data-f="color" type="color" value="${esc(s.color)}" aria-label="Color de la etapa ${i+1}"><span class="st-actions">${btn('↑','st-up','small',`data-i="${i}" aria-label="Subir"`+(i?'':' disabled'))}${btn('↓','st-down','small',`data-i="${i}" aria-label="Bajar"`+(i<p.stages.length-1?'':' disabled'))}${btn('×','st-del','small danger',`data-i="${i}" aria-label="Quitar la etapa ${esc(s.name)}"`)}<small class="muted">${counts[s.id]||0} contactos</small></span></div>`).join('')}</div>
 ${btn('＋ Agregar etapa','st-add','small')}
 <p class="storage-meta">Orden = orden del tablero. Ganado fija 100 % y Perdido 0 %. No puedes quitar una etapa con contactos: muévelos antes. Cada pipeline necesita al menos una etapa abierta, una ganada y una perdida.</p>`,
 `${btn('Cancelar','close')}<button class="btn primary" type="submit">Guardar pipelines</button>`);
}
function savePipelines(){
 syncDraft();
 try{
  const out=applyPipelineConfig(S().leads,S().settings.pipelines,draft);
  return C.commit('Configurar pipelines',s=>{s.settings.pipelines=out.pipelines;s.leads=out.leads;},out.pipelines.map(p=>`${p.name} (${p.stages.length})`).join(' · '));
 }catch(e){C.toast(e.message,true);return false;}
}

// ───────────── Puntaje ─────────────
function scoreDialog(){
 const r=S().settings.scoreRules;
 C.openDialog('score-rules','Reglas del puntaje',`<p class="muted">Cada regla aporta hasta su peso en puntos; el puntaje final es el porcentaje de los puntos posibles de las reglas activas.</p><div class="rules">${SCORE_RULE_KEYS.map(k=>`<div class="rule"><label class="checkbox"><input type="checkbox" name="on-${k}" ${r[k].on?'checked':''}><span><b>${RULE_LABELS[k]}</b><br><small class="muted">${esc(RULE_HELP[k])}</small></span></label><label class="field"><span>Peso</span><input name="w-${k}" type="number" min="0" max="50" value="${r[k].weight}"></label></div>`).join('')}</div>`,`${btn('Restaurar valores','score-reset','',)}${btn('Cancelar','close')}<button class="btn primary" type="submit">Guardar reglas</button>`);
}
function saveScore(v){
 const rules={};for(const k of SCORE_RULE_KEYS)rules[k]={on:v[`on-${k}`]==='on',weight:Number(v[`w-${k}`])};
 try{return C.commit('Configurar puntaje',s=>{s.settings.scoreRules=rules;},'Reglas actualizadas');}catch(e){C.toast(e.message,true);return false;}
}

// ───────────── Plantillas ─────────────
function tplDialog(id=''){
 const t=id?S().settings.templates.find(x=>x.id===id):null,v=t||{name:'',channel:'whatsapp',subject:'',body:''};
 C.openDialog('tpl',t?'Editar plantilla':'Nueva plantilla',`<div class="form-grid">${fld('Nombre','name',v.name,{required:true,max:80})}${sel2('Canal','channel',v.channel,Object.entries(TEMPLATE_CHANNELS),{id:'tpl-channel'})}
 <div class="span-two" id="tpl-subject-wrap" ${v.channel==='email'?'':'hidden'}>${fld('Asunto','subject',v.subject,{max:200,wide:true})}</div>
 ${fld('Mensaje','body',v.body,{type:'textarea',max:4000,wide:true,required:true,id:'tpl-body',extra:'rows="7"'})}</div>
 <p class="q-label">Variables (clic para insertar)</p><div class="var-chips">${Object.entries(TEMPLATE_VARS).map(([k,d])=>`<button type="button" class="chip-toggle" data-action="tpl-var" data-var="${k}" title="${esc(d)}">{{${k}}}</button>`).join('')}</div>
 <p class="storage-meta">Bloques condicionales: <code>{{#propiedad}}…{{/propiedad}}</code> solo aparece si la variable tiene valor.</p>
 <div class="preview" id="tpl-preview"></div>`,`${t?btn('Eliminar','cfg-tpl-del','danger',`data-id="${esc(id)}"`):''}${btn('Cancelar','close')}<button class="btn primary" type="submit">Guardar plantilla</button>`,id);
 tplPreview();
}
function tplPreview(){
 const body=$('#tpl-body');if(!body)return;
 const sample={name:'María Fernanda López',company:'Estudio Lumen',owner:C.user().name||'Tu nombre',value:250000,projectType:'',phone:'+52 998 123 4567',email:'maria@ejemplo.mx',status:'new',pipeline:'venta',stageId:'',source:'manual',timeline:[],tags:[],id:'x',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
 const r=renderTemplate(body.value,templateVars(sample,{property:{title:'Villa Tankah',slug:'villa-tankah',price:18900000,currency:'MXN'},pipelines:S().settings.pipelines,origin:location.origin}));
 $('#tpl-preview').innerHTML=`<span class="q-label">Vista previa con un contacto de muestra</span><p>${esc(r.text).replace(/\n/g,'<br>')||'<span class="muted">Escribe el mensaje…</span>'}</p>${r.unknown.length?`<p class="warn-line">Variables desconocidas: ${r.unknown.map(u=>`{{${u}}}`).join(', ')}</p>`:''}`;
}
function saveTpl(v,id){
 return C.commit(id?'Editar plantilla':'Crear plantilla',s=>{const t={id:id||uid(),name:v.name,channel:v.channel,subject:v.subject||'',body:v.body};if(id)s.settings.templates=s.settings.templates.map(x=>x.id===id?t:x);else s.settings.templates.push(t);},v.name);
}

// ───────────── Secuencias ─────────────
let seqDraft=null;
function seqDialog(id=''){
 const q=id?S().settings.sequences.find(x=>x.id===id):null;
 seqDraft=structuredClone(q||{id:'',name:'',description:'',steps:[{id:uid(),wait:0,title:'',type:'call',templateId:''}]});drawSeq(id);
}
function syncSeq(){
 const n=$('#sq-name');if(n)seqDraft.name=n.value;const d=$('#sq-desc');if(d)seqDraft.description=d.value;
 $$('.sq-row').forEach(row=>{const s=seqDraft.steps[Number(row.dataset.i)];if(!s)return;s.title=row.querySelector('[data-f=title]').value;s.type=row.querySelector('[data-f=type]').value;s.wait=Number(row.querySelector('[data-f=wait]').value)||0;s.templateId=row.querySelector('[data-f=tpl]').value;});
}
function drawSeq(id){
 const tpls=S().settings.templates;
 C.openDialog('seq',id?'Editar secuencia':'Nueva secuencia',`<div class="form-grid">${fld('Nombre','seqname',seqDraft.name,{required:true,max:80,id:'sq-name'})}${fld('Descripción','seqdesc',seqDraft.description,{max:300,id:'sq-desc'})}</div>
 <p class="muted">Cada paso crea una tarea. «Espera» son los días después del paso anterior (0 = al inscribir).</p>
 <div class="sq-list">${seqDraft.steps.map((s,i)=>`<div class="sq-row" data-i="${i}"><b>${i+1}</b><input data-f="title" type="text" maxlength="200" placeholder="¿Qué hay que hacer?" value="${esc(s.title)}" aria-label="Paso ${i+1}"><select data-f="type" aria-label="Tipo del paso ${i+1}">${Object.entries(TASK_TYPES).map(([k,t])=>`<option value="${k}" ${s.type===k?'selected':''}>${t}</option>`).join('')}</select><label class="wait"><span>Espera</span><input data-f="wait" type="number" min="0" max="90" value="${s.wait}" aria-label="Días de espera del paso ${i+1}"> d</label><select data-f="tpl" aria-label="Plantilla sugerida del paso ${i+1}"><option value="">Sin plantilla</option>${tpls.map(t=>`<option value="${esc(t.id)}" ${s.templateId===t.id?'selected':''}>${esc(t.name)} (${esc(TEMPLATE_CHANNELS[t.channel])})</option>`).join('')}</select>${btn('×','sq-del','small danger',`data-i="${i}" aria-label="Quitar el paso ${i+1}"`)}</div>`).join('')}</div>${btn('＋ Agregar paso','sq-add','small')}`,
 `${id?btn('Eliminar','cfg-seq-del','danger',`data-id="${esc(id)}"`):''}${btn('Cancelar','close')}<button class="btn primary" type="submit">Guardar secuencia</button>`,id);
}
function saveSeq(id){
 syncSeq();
 try{return C.commit(id?'Editar secuencia':'Crear secuencia',s=>{const q={id:id||uid(),name:seqDraft.name,description:seqDraft.description,steps:seqDraft.steps.map(x=>({...x,title:x.title}))};if(id)s.settings.sequences=s.settings.sequences.map(x=>x.id===id?q:x);else s.settings.sequences.push(q);},seqDraft.name);}catch(e){C.toast(e.message,true);return false;}
}

export function handleAction(action,el){
 const id=el.dataset.id,i=Number(el.dataset.i);
 switch(action){
  case 'cfg-pipelines':pipelinesDialog();return true;
  case 'pl-tab':syncDraft();cur=id;drawPipelines();return true;
  case 'pl-add':{syncDraft();const n=`Pipeline ${draft.length+1}`;if(draft.length>=8){C.toast('Máximo 8 pipelines.',true);return true;}const pid=slugify(n,draft.map(p=>p.id));draft.push({id:pid,name:n,stages:[{id:'a-'+uid().slice(0,6),name:'Nuevo',prob:10,kind:'open',color:'#b7c19f'},{id:'g-'+uid().slice(0,6),name:'Ganado',prob:100,kind:'won',color:'#8fb04f'},{id:'p-'+uid().slice(0,6),name:'Perdido',prob:0,kind:'lost',color:'#d9a095'}]});cur=pid;drawPipelines();return true;}
  case 'pl-del':{syncDraft();if(draft.length<=1){C.toast('Debe quedar al menos un pipeline.',true);return true;}const n=S().leads.filter(l=>(l.pipeline||'venta')===cur).length;if(n){C.toast(`Este pipeline tiene ${n} contactos. Muévelos antes de eliminarlo.`,true);return true;}draft=draft.filter(p=>p.id!==cur);cur=draft[0].id;drawPipelines();return true;}
  case 'st-add':{syncDraft();const p=draft.find(x=>x.id===cur);if(p.stages.length>=12){C.toast('Máximo 12 etapas.',true);return true;}const lastOpen=p.stages.map(s=>s.kind).lastIndexOf('open');p.stages.splice(lastOpen+1,0,{id:'e-'+uid().slice(0,6),name:'Nueva etapa',prob:50,kind:'open',color:'#d9c58a'});drawPipelines();return true;}
  case 'st-up':case 'st-down':{syncDraft();const p=draft.find(x=>x.id===cur),j=action==='st-up'?i-1:i+1;if(j<0||j>=p.stages.length)return true;[p.stages[i],p.stages[j]]=[p.stages[j],p.stages[i]];drawPipelines();return true;}
  case 'st-del':{syncDraft();const p=draft.find(x=>x.id===cur),st=p.stages[i],n=stageCounts(S().leads,S().settings.pipelines,p.id)[st.id]||0;if(n){C.toast(`La etapa «${st.name}» tiene ${n} contacto${n===1?'':'s'}. Muévelos antes de quitarla.`,true);return true;}if(p.stages.length<=3){C.toast('Cada pipeline necesita al menos 3 etapas.',true);return true;}p.stages.splice(i,1);drawPipelines();return true;}
  case 'cfg-score':scoreDialog();return true;
  case 'score-reset':{const d=DEFAULT_SCORE_RULES();for(const k of SCORE_RULE_KEYS){$(`[name=on-${k}]`).checked=d[k].on;$(`[name=w-${k}]`).value=d[k].weight;}return true;}
  case 'cfg-issuer':{const v=S().settings.issuer;C.openDialog('issuer','Datos para cotizaciones',`<div class="form-grid">${fld('Nombre o razón social','name',v.name,{required:true,max:120,wide:true})}${fld('Correo','email',v.email,{type:'email',max:250})}${fld('Teléfono','phone',v.phone,{max:80})}${fld('Dirección','address',v.address,{max:300,wide:true})}${fld('RFC (opcional)','taxId',v.taxId,{max:40})}</div>`,`${btn('Cancelar','close')}<button class="btn primary" type="submit">Guardar</button>`);return true;}
  case 'cfg-tpl-new':tplDialog();return true;
  case 'cfg-tpl':tplDialog(id);return true;
  case 'cfg-tpl-del':{if(confirm('¿Eliminar esta plantilla?')&&C.commit('Eliminar plantilla',s=>{s.settings.templates=s.settings.templates.filter(t=>t.id!==id);},id))C.closeDialog();return true;}
  case 'tpl-var':{const b=$('#tpl-body'),v=`{{${el.dataset.var}}}`,a=b.selectionStart??b.value.length,z=b.selectionEnd??a;b.value=b.value.slice(0,a)+v+b.value.slice(z);b.focus();b.setSelectionRange(a+v.length,a+v.length);tplPreview();return true;}
  case 'cfg-seq-new':seqDialog();return true;
  case 'cfg-seq':seqDialog(id);return true;
  case 'cfg-seq-del':{if(confirm('¿Eliminar esta secuencia? Las inscripciones activas siguen con sus tareas.')&&C.commit('Eliminar secuencia',s=>{s.settings.sequences=s.settings.sequences.filter(q=>q.id!==id);},id))C.closeDialog();return true;}
  case 'sq-add':{syncSeq();if(seqDraft.steps.length>=20){C.toast('Máximo 20 pasos.',true);return true;}seqDraft.steps.push({id:uid(),wait:1,title:'',type:'call',templateId:''});drawSeq($('#dialog').dataset.id);return true;}
  case 'sq-del':{syncSeq();if(seqDraft.steps.length<=1){C.toast('La secuencia necesita al menos un paso.',true);return true;}seqDraft.steps.splice(i,1);drawSeq($('#dialog').dataset.id);return true;}
 }
 return false;
}
export function handleSubmit(kind,v,id){
 if(kind==='pipelines')return savePipelines();
 if(kind==='score-rules')return saveScore(v);
 if(kind==='tpl')return saveTpl(v,id);
 if(kind==='seq')return saveSeq(id);
 if(kind==='issuer')return C.commit('Editar datos de cotización',s=>{s.settings.issuer={name:v.name,email:v.email,phone:v.phone,address:v.address,taxId:v.taxId};},v.name);
 return undefined;
}
export function handleInput(el){if(el.id==='tpl-body'){tplPreview();return true;}return false;}
export function handleChange(el){
 if(el.id==='tpl-channel'){$('#tpl-subject-wrap').hidden=el.value!=='email';return true;}
 if(el.dataset?.f==='kind'){const row=el.closest('.st-row');const pr=row.querySelector('[data-f=prob]');pr.disabled=el.value!=='open';if(el.value==='won')pr.value=100;if(el.value==='lost')pr.value=0;return true;}
 return false;
}
