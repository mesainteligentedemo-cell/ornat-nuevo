// CRM de ORNAT Control: contactos, pipelines, filtros, tablero/tabla, ficha con pestañas, acciones masivas y resumen.
// La lógica de datos vive en módulos puros con pruebas (store.js, pipelines.js, score.js…); este módulo pinta y conecta eventos.
import {LEAD_STATUSES,CHANNELS,PRIORITIES,TIMELINE_TYPES,SORTS,FOLLOW_UPS,NONE,defaultFilters,cleanFilters,activeFilterCount,viewLeads,summarizeLeads,distinctValues,followUpState,dayKey,dayToISO,addDays,weekStart,whatsappNumber,normEmail,phoneKey,findDuplicates,mergeLeads,applyImport,planImport,addTimelineEntry,applyBulk,saveView,removeView,crmKPIs,leadsToCSV,isDemo,loadDemo,removeDemo,DEMO_COUNT,backupReminder,cleanLead,uid,baseStatusFor} from './store.js';
import {pipelineOf,resolveStage,moveToStage,movePipeline,bulkMoveStage} from './pipelines.js';
import {BAND_LABEL,RULE_HELP} from './score.js';
import {recentIntake,newFromSite} from './intake.js';
import {forecast} from './reports.js';
import {quoteSummary,fmtMoney} from './quotes.js';
import {mailtoURL} from './messaging.js';
import {mountBoardDnD} from './dnd.js';
import {taskCounts,filterTasks,hiddenTaskIds} from './tasks.js';
import * as UT from './ui-tasks.js';
import * as UM from './ui-msgs.js';
import * as UQ from './ui-quotes.js';
import * as UP from './ui-props.js';
import * as CFG from './ui-config.js';

let C;
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const S=()=>C.getState();
const PL=()=>C.raw().settings.pipelines;
const mxn=n=>'$'+new Intl.NumberFormat('es-MX').format(n||0);
const shortDate=iso=>iso?new Date(iso).toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'}):'';
const dayDiff=(a,b)=>{const p=k=>k.split('-').map(Number);const [y1,m1,d1]=p(a),[y2,m2,d2]=p(b);return Math.round((Date.UTC(y2,m2-1,d2)-Date.UTC(y1,m1-1,d1))/864e5);};
const initials=name=>name.trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'?';
const DEFAULT_DIR={recent:'descending',name:'ascending',value:'descending',followup:'ascending',activity:'descending',stage:'ascending',priority:'ascending',channel:'ascending',owner:'ascending',score:'descending'};
const REASONS=['Presupuesto: eligió otro proveedor','Sin respuesta','Proyecto pospuesto','Proyecto cancelado','Fuera de alcance'];
const SOURCE_LABEL={manual:'manual',csv:'importación CSV',demo:'ejemplo',intake:'formulario del sitio'};
const UI_KEY='ornat-control-ui-v1';

let viewsOpen=false,filters=defaultFilters(),mode='board',pageSize=25,page=1,panelOpen=false,colLimit={},pending=null,fichaTab='timeline',ovPipe='',intakeOpen=false;
const sel=new Set();
let memo={leads:null,key:'',list:[]};

export function init(ctx){C=ctx;UT.init(ctx);UM.init(ctx);UQ.init(ctx);UP.init(ctx);CFG.init(ctx);loadUI();initDrag();document.addEventListener('toggle',e=>{if(e.target.classList?.contains('views-box')){if(e.target.dataset.box==='intake')intakeOpen=e.target.open;else viewsOpen=e.target.open;}},true);}
function loadUI(){try{const raw=sessionStorage.getItem(UI_KEY);if(!raw)return;const d=JSON.parse(raw);filters=cleanFilters(d.filters);mode=d.mode==='table'?'table':'board';pageSize=[25,50,100].includes(d.pageSize)?d.pageSize:25;page=Number.isInteger(d.page)&&d.page>0?d.page:1;}catch{filters=defaultFilters();}}
function saveUI(){try{sessionStorage.setItem(UI_KEY,JSON.stringify({filters,mode,pageSize,page}));}catch{}}
const curPipe=()=>pipelineOf(PL(),filters.pipeline);
function current(){const leads=S().leads,key=JSON.stringify(filters)+dayKey(new Date())+'|'+C.scoreVersion()+'|'+curPipe().id;if(memo.leads===leads&&memo.key===key)return memo.list;memo={leads,key,list:viewLeads(leads,{...filters,pipeline:curPipe().id})};return memo.list;}

// ───────────── piezas pequeñas ─────────────
const btn=(label,action,cls='',extra='')=>`<button type="button" class="btn ${esc(cls)}" data-action="${esc(action)}" ${extra}>${esc(label)}</button>`;
function fld(label,name,value='',{type='text',max=1000,required=false,hint='',wide=false,list='',extra='',placeholder=''}={}){const control=type==='textarea'?`<textarea name="${name}" maxlength="${max}" ${required?'required':''} ${extra}>${esc(value)}</textarea>`:`<input name="${name}" type="${type}" value="${esc(value)}" maxlength="${max}" ${required?'required':''} ${list?`list="${list}"`:''} ${placeholder?`placeholder="${esc(placeholder)}"`:''} ${type==='number'?'min="0" step="1" inputmode="numeric"':''} ${extra}>`;return `<label class="field ${wide?'span-two':''}"><span>${esc(label)}</span>${control}${hint?`<small>${esc(hint)}</small>`:''}</label>`;}
function sel2(label,name,value,options,{wide=false,extra='',id=''}={}){return `<label class="field ${wide?'span-two':''}"><span>${esc(label)}</span><select name="${name}" ${id?`id="${id}"`:''} ${extra}>${options.map(([k,t,d])=>`<option value="${esc(k)}" ${d?`data-kind="${esc(d)}"`:''} ${String(value)===String(k)?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`;}
const stageOptsFor=pipe=>pipe.stages.map(s=>[s.id,s.name,s.kind]);
const pillOf=l=>{const {stage}=resolveStage(PL(),l);return `<span class="pill stage-pill" style="--c:${esc(stage.color)}">${esc(stage.name)}</span>`;};
const demoBadge=l=>isDemo(l)?'<span class="badge-demo" title="Contacto de ejemplo">Ejemplo</span>':'';
const intakeBadge=l=>l.source==='intake'&&l.status==='new'&&!l.lastContactAt?'<span class="badge-site" title="Llegó desde un formulario del sitio">Del sitio</span>':'';
const prioBadge=p=>`<span class="prio prio-${esc(p)}"><i aria-hidden="true"></i>${esc(PRIORITIES[p])}</span>`;
const scoreBadge=(l,long=false)=>{const s=C.scoreOf(l.id);return s?`<span class="score score-${esc(s.band)}" title="Puntaje ${Number(s.total)} de 100 (${esc(BAND_LABEL[s.band])})"><b>${Number(s.total)}</b>${long?` ${esc(BAND_LABEL[s.band])}`:''}</span>`:'';};
function followBadge(l,long=false){const s=followUpState(l);if(!s||s==='none'||!l.nextActionAt)return '';const diff=dayDiff(dayKey(new Date()),dayKey(l.nextActionAt));
 if(s==='overdue')return `<span class="follow overdue" title="${esc(l.nextAction||'Seguimiento')} · ${esc(shortDate(l.nextActionAt))}">Vencido · hace ${-diff} d</span>`;
 if(s==='today')return `<span class="follow today" title="${esc(l.nextAction||'Seguimiento')}">Hoy</span>`;
 return `<span class="follow later" title="${esc(l.nextAction||'Seguimiento')}">${long?esc(shortDate(l.nextActionAt)):`En ${diff} d`}</span>`;}

// ───────────── Contactos: vista principal ─────────────
export function renderCRM(){
 const st=S(),root=$('#content'),pipe=curPipe();
 if(!st.leads.length&&C.raw().leads.length&&C.access().scope==='mine'){root.innerHTML=`<section class="card">${C.empty('Aún no tienes contactos asignados',`Aquí ves solo los contactos donde eres responsable (${C.user().name}). ${C.user().role==='owner'?'Elige «Todos los contactos» arriba para ver los demás.':'Crea un contacto o pide que te asignen alguno.'}`,`<div class="actions center">${btn('＋ Nuevo contacto','new-lead','lime')}</div>`)}</section>`;return;}
 if(!st.leads.length){root.innerHTML=`${intakeBox()}<section class="card">${C.empty('Tu CRM está listo para empezar','Añade un contacto, importa tu hoja de cálculo o explora el CRM con contactos de ejemplo (siempre marcados y fáciles de quitar).',`<div class="actions center">${btn('＋ Nuevo contacto','new-lead','lime')}${btn('Importar CSV','import')}${btn(`Cargar ${DEMO_COUNT} contactos de ejemplo`,'load-demo')}</div>`)}</section>`;return;}
 const demoCount=st.leads.filter(isDemo).length;
 root.innerHTML=`${demoCount?`<div class="notice demo-notice" role="note"><b>Estás viendo ${demoCount} contactos de ejemplo.</b> Están marcados con la insignia «Ejemplo» y no son datos reales. ${btn('Quitar ejemplos','remove-demo','small')}</div>`:''}
 ${intakeBox()}
 <div class="crm-bar">
  <label class="sortbox pipebox"><span class="sr-only">Pipeline</span><select id="f-pipeline" aria-label="Pipeline">${PL().map(p=>`<option value="${esc(p.id)}" ${p.id===pipe.id?'selected':''}>Pipeline: ${esc(p.name)}</option>`).join('')}</select></label>
  <label class="searchbox"><span class="sr-only">Buscar contactos</span><input type="search" id="f-q" placeholder="Buscar nombre, empresa, correo…" title="Busca en nombre, empresa, correo, teléfono, notas y etiquetas" value="${esc(filters.q)}" maxlength="200" autocomplete="off"></label>
  <label class="sortbox"><span class="sr-only">Ordenar por</span><select id="f-sort" aria-label="Ordenar por">${sortOptions()}</select></label>
  <div class="seg" role="group" aria-label="Tipo de vista"><button type="button" data-action="set-view" data-mode="board" aria-pressed="${mode==='board'}">Tablero</button><button type="button" data-action="set-view" data-mode="table" aria-pressed="${mode==='table'}">Tabla</button></div>
  <button type="button" class="btn small filters-toggle" id="filters-toggle" data-action="toggle-panel" aria-expanded="${panelOpen}" aria-controls="filter-panel">Filtros (${activeFilterCount(filters)})</button>
  ${btn('Exportar CSV','export-view','small','id="export-view"')}
 </div>
 <div class="filter-panel" id="filter-panel" data-open="${panelOpen}">${panelHTML()}</div>
 <details class="views-box" ${viewsOpen?'open':''}><summary>Vistas guardadas (${st.settings.savedViews.length})</summary>${viewsHTML()}</details>
 <div id="crm-chips" class="chips"></div>
 <p id="crm-count" class="crm-count" role="status" aria-live="polite" aria-atomic="true"></p>
 <div id="crm-bulk"></div>
 <div id="crm-results"></div>`;
 updateResults();
}
function intakeBox(){
 const rows=recentIntake(S().leads,8);if(!rows.length)return '';const fresh=new Set(rows.filter(r=>r.fresh).map(r=>r.leadId)).size;
 return `<details class="views-box intake-box" data-box="intake" ${intakeOpen?'open':''}><summary>Entradas recientes del sitio ${fresh?`<span class="badge-site">${fresh} nuevo${fresh===1?'':'s'}</span>`:''}</summary><ul class="plain-list">${rows.map(r=>`<li><button type="button" class="link-btn" data-action="edit-lead" data-id="${esc(r.leadId)}">${esc(r.name)}</button> ${r.fresh?'<span class="follow today">Sin atender</span>':''}<small class="muted">${esc(C.stamp(r.at))}</small><p class="muted intake-text">${esc(r.text.replace(/\n/g,' · ').slice(0,220))}</p></li>`).join('')}</ul></details>`;
}
function sortOptions(){const all={...SORTS,score:'Mayor puntaje'};const base=Object.entries(all).map(([k,t])=>`<option value="${k}" ${filters.sort===k?'selected':''}>${t}</option>`);if(!all[filters.sort])base.push(`<option value="${esc(filters.sort)}" selected>Por columna de la tabla</option>`);return base.join('');}
function panelHTML(){const st=S(),pipe=curPipe(),owners=C.owners(),tags=distinctValues(st.leads,'tags'),o=(v,t,cur)=>`<option value="${esc(v)}" ${cur===v?'selected':''}>${esc(t)}</option>`;
 return `<div class="stage-chips" role="group" aria-label="Filtrar por etapa"><span class="lbl">Etapa</span>${pipe.stages.map(s=>`<button type="button" class="chip-toggle" data-action="toggle-stage" data-stage="${esc(s.id)}" aria-pressed="${filters.stageIds.includes(s.id)}"><i class="dot" style="background:${esc(s.color)}"></i>${esc(s.name)}</button>`).join('')}</div>
 <div class="filter-grid">
  <label class="field"><span>Canal</span><select id="f-channel"><option value="">Todos</option>${o(NONE,'Sin canal',filters.channel)}${CHANNELS.map(c=>o(c,c,filters.channel)).join('')}</select></label>
  <label class="field"><span>Responsable</span><select id="f-owner"><option value="">Todos</option>${o(NONE,'Sin responsable',filters.owner)}${owners.map(x=>o(x,x,filters.owner)).join('')}</select></label>
  <label class="field"><span>Prioridad</span><select id="f-priority"><option value="">Todas</option>${Object.entries(PRIORITIES).map(([k,t])=>o(k,t,filters.priority)).join('')}</select></label>
  <label class="field"><span>Etiqueta</span><select id="f-tag"><option value="">Todas</option>${tags.map(x=>o(x,x,filters.tag)).join('')}</select></label>
  <label class="field"><span>Puntaje mínimo</span><input id="f-score" type="number" min="0" max="100" step="5" inputmode="numeric" value="${esc(filters.minScore)}" placeholder="0–100"></label>
  <label class="field"><span>Valor mín. (MXN)</span><input id="f-min" type="number" min="0" step="1" inputmode="numeric" value="${esc(filters.minValue)}"></label>
  <label class="field"><span>Valor máx. (MXN)</span><input id="f-max" type="number" min="0" step="1" inputmode="numeric" value="${esc(filters.maxValue)}"></label>
  <label class="field"><span>Creado desde</span><input id="f-from" type="date" value="${esc(filters.createdFrom)}"></label>
  <label class="field"><span>Creado hasta</span><input id="f-to" type="date" value="${esc(filters.createdTo)}"></label>
  <label class="field"><span>Seguimiento</span><select id="f-follow"><option value="">Cualquiera</option>${Object.entries(FOLLOW_UPS).map(([k,t])=>o(k,t,filters.followUp)).join('')}</select></label>
 </div><p class="storage-meta">Los filtros de seguimiento consideran solo contactos abiertos. El puntaje es transparente: ábrelo en la ficha para ver su desglose.</p>`;}
function viewsHTML(){const views=S().settings.savedViews;return `<div class="views">${views.length?`<ul class="plain-list views-list">${views.map(v=>`<li><button type="button" class="link-btn" data-action="apply-view" data-id="${esc(v.id)}">${esc(v.name)}</button><span class="muted">${v.mode==='table'?'Tabla':'Tablero'} · ${activeFilterCount(v.filters)} filtros</span><button type="button" class="btn small danger" data-action="delete-view" data-id="${esc(v.id)}" aria-label="Eliminar la vista ${esc(v.name)}">Eliminar</button></li>`).join('')}</ul>`:'<p class="muted">Aún no guardas vistas. Ajusta filtros y orden, ponles nombre y guárdalos.</p>'}
 <div class="save-view"><label class="field"><span>Nombre de la vista actual</span><input id="view-name" type="text" maxlength="60" placeholder="Ej. Propuestas de alta prioridad"></label>${btn('Guardar vista','save-view','small primary')}</div></div>`;}

function updateResults(){
 const st=S(),list=current(),pid=curPipe().id,all=st.leads.filter(l=>(l.pipeline||'venta')===pid||(!PL().some(p=>p.id===l.pipeline)&&pid===PL()[0].id)),sum=summarizeLeads(list);
 page=Math.min(page,Math.max(1,Math.ceil(list.length/pageSize)));
 const ids=new Set(list.map(l=>l.id));for(const id of [...sel])if(!ids.has(id))sel.delete(id);
 const chips=$('#crm-chips'),count=$('#crm-count'),results=$('#crm-results');if(!results)return;
 chips.innerHTML=chipsHTML();
 const other=st.leads.length-all.length;
 count.innerHTML=`<b>${list.length}</b> de ${all.length} contactos en ${esc(curPipe().name)} · valor total <b>${mxn(sum.value)}</b>${other?` · ${other} en otros pipelines`:''}`;
 $('#crm-bulk').innerHTML=mode==='table'?bulkHTML(list):'';
 results.innerHTML=!list.length?(activeFilterCount(filters)>0?noResultsHTML():mode==='board'?boardHTML(list):`<section class="card">${C.empty(`Sin contactos en ${curPipe().name}`,'Crea un contacto nuevo o cámbialo de pipeline desde su ficha.',btn('＋ Nuevo contacto','new-lead','small'))}</section>`):mode==='board'?boardHTML(list):tableHTML(list);
 syncPanel();saveUI();
}
function syncPanel(){const set=(id,v)=>{const el=$(id);if(el&&document.activeElement!==el&&el.value!==String(v))el.value=v;};set('#f-q',filters.q);set('#f-sort',filters.sort);set('#f-channel',filters.channel);set('#f-owner',filters.owner);set('#f-priority',filters.priority);set('#f-tag',filters.tag);set('#f-min',filters.minValue);set('#f-max',filters.maxValue);set('#f-from',filters.createdFrom);set('#f-to',filters.createdTo);set('#f-follow',filters.followUp);set('#f-score',filters.minScore);
 const sort=$('#f-sort');if(sort&&![...sort.options].some(o=>o.value===filters.sort)){sort.insertAdjacentHTML('beforeend',`<option value="${esc(filters.sort)}">Por columna de la tabla</option>`);sort.value=filters.sort;}
 document.querySelectorAll('[data-action=toggle-stage]').forEach(b=>b.setAttribute('aria-pressed',String(filters.stageIds.includes(b.dataset.stage))));
 const t=$('#filters-toggle');if(t)t.textContent=`Filtros (${activeFilterCount(filters)})`;
 const ex=$('#export-view');if(ex)ex.textContent=`Exportar CSV (${current().length})`;}
function chipsHTML(){const chips=[],f=filters,x=(label,key,value='')=>chips.push(`<span class="chip">${esc(label)}<button type="button" data-action="clear-filter" data-key="${key}" data-value="${esc(value)}" aria-label="Quitar filtro ${esc(label)}">✕</button></span>`);
 if(f.q.trim())x(`Búsqueda: «${f.q.trim()}»`,'q');for(const s of f.stages)x(`Etapa base: ${LEAD_STATUSES[s]}`,'stages',s);
 for(const id of f.stageIds)x(`Etapa: ${curPipe().stages.find(s=>s.id===id)?.name||id}`,'stageIds',id);
 if(f.channel)x(`Canal: ${f.channel===NONE?'sin canal':f.channel}`,'channel');if(f.owner)x(`Responsable: ${f.owner===NONE?'sin responsable':f.owner}`,'owner');if(f.priority)x(`Prioridad: ${PRIORITIES[f.priority]}`,'priority');if(f.tag)x(`Etiqueta: ${f.tag}`,'tag');
 if(f.minScore!=='')x(`Puntaje ≥ ${f.minScore}`,'minScore');
 if(f.minValue!=='')x(`Valor ≥ ${mxn(f.minValue)}`,'minValue');if(f.maxValue!=='')x(`Valor ≤ ${mxn(f.maxValue)}`,'maxValue');if(f.createdFrom)x(`Creado desde ${f.createdFrom}`,'createdFrom');if(f.createdTo)x(`Creado hasta ${f.createdTo}`,'createdTo');if(f.followUp)x(`Seguimiento: ${FOLLOW_UPS[f.followUp]}`,'followUp');
 return chips.length?`${chips.join('')}<button type="button" class="btn small ghost" data-action="clear-all">Limpiar todo</button>`:'';}
function noResultsHTML(){return `<section class="card">${C.empty('Ningún contacto coincide con estos filtros','Prueba quitar algún filtro o ampliar el rango. Tus contactos siguen guardados.',btn('Limpiar filtros','clear-all','small'))}</section>`;}

// Tablero
function boardHTML(list){const pipe=curPipe(),stages=filters.stageIds.length?pipe.stages.filter(s=>filters.stageIds.includes(s.id)):pipe.stages;
 const by=new Map(pipe.stages.map(s=>[s.id,[]]));for(const l of list){const {stage}=resolveStage(PL(),l);(by.get(stage.id)||[]).push(l);}
 return `<div class="pipeline" style="--cols:${stages.length}">${stages.map(s=>{const items=by.get(s.id)||[],sum=summarizeLeads(items),limit=colLimit[s.id]||40;
  return `<section class="column" data-drop-status="${esc(s.id)}" aria-label="${esc(s.name)}: ${items.length} contactos"><div class="column-title" style="--c:${esc(s.color)}"><span class="ct-name">${esc(s.name)} <small>${Number(s.prob)}%</small></span><span class="ct-count">${items.length}</span><span class="ct-value">${items.length?mxn(sum.value):'—'}</span></div>${items.slice(0,limit).map(l=>cardHTML(l,pipe)).join('')||'<p class="muted col-empty">Sin contactos en esta etapa.</p>'}${items.length>limit?`<button type="button" class="btn small more" data-action="more-col" data-status="${esc(s.id)}">Mostrar ${Math.min(40,items.length-limit)} más</button>`:''}</section>`;}).join('')}</div>`;}
function cardHTML(l,pipe){const tags=l.tags.slice(0,3).map(t=>`<span class="tag">${esc(t)}</span>`).join('')+(l.tags.length>3?`<span class="tag more">+${l.tags.length-3}</span>`:''),cur=resolveStage(PL(),l).stage.id;
 return `<article class="lead-card" data-id="${esc(l.id)}"><button type="button" class="lead-open" data-action="edit-lead" data-id="${esc(l.id)}" aria-label="Abrir ficha de ${esc(l.name)}"><span class="lc-top"><span class="avatar">${esc(initials(l.name))}</span><strong>${esc(l.name)}</strong>${scoreBadge(l)}</span>${l.company?`<span class="lc-co">${esc(l.company)}</span>`:''}<span class="lc-row">${l.value!==null?`<b class="lc-value">${mxn(l.value)}</b>`:'<span class="muted">Sin valor</span>'}${prioBadge(l.priority)}</span><span class="lc-row">${l.channel?`<span class="chan">${esc(l.channel)}</span>`:''}${followBadge(l)}${demoBadge(l)}${intakeBadge(l)}</span>${tags?`<span class="lc-tags">${tags}</span>`:''}</button><label class="move"><span class="sr-only">Mover ${esc(l.name)} a otra etapa</span><select class="move-select" data-move="${esc(l.id)}"><option value="">Mover a…</option>${pipe.stages.filter(s=>s.id!==cur).map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select></label></article>`;}

// Tabla
const COLS=[['name','Nombre / empresa'],['stage','Etapa'],['score','Puntaje'],['value','Valor'],['priority','Prioridad'],['channel','Canal'],['owner','Responsable'],['followup','Seguimiento'],['recent','Creado']];
function tableHTML(list){const pages=Math.max(1,Math.ceil(list.length/pageSize)),from=(page-1)*pageSize,rows=list.slice(from,from+pageSize),[key,rev]=filters.sort.split(':');
 const allPage=rows.length&&rows.every(l=>sel.has(l.id));
 const head=COLS.map(([k,t])=>{let dir='none',arrow='';if(k===key){dir=(DEFAULT_DIR[k]==='ascending')!==(rev==='rev')?'ascending':'descending';arrow=dir==='ascending'?' ▲':' ▼';}return `<th aria-sort="${dir}"><button type="button" class="th-btn" data-action="sort-col" data-key="${k}">${t}${arrow}</button></th>`;}).join('');
 return `<section class="card table-wrap crm-table-card"><table class="crm-table"><thead><tr><th class="sel-col"><label class="chk"><input type="checkbox" id="sel-page" ${allPage?'checked':''} aria-label="Seleccionar los ${rows.length} contactos de esta página"></label></th>${head}</tr></thead><tbody>${rows.map(l=>`<tr class="${sel.has(l.id)?'selected':''}"><td class="sel-col"><label class="chk"><input type="checkbox" data-sel="${esc(l.id)}" ${sel.has(l.id)?'checked':''} aria-label="Seleccionar ${esc(l.name)}"></label></td><td><button class="link-btn" data-action="edit-lead" data-id="${esc(l.id)}">${esc(l.name)}</button> ${demoBadge(l)} ${intakeBadge(l)}<small>${esc([l.company,l.email,l.phone].filter(Boolean).join(' · '))}</small></td><td>${pillOf(l)}</td><td>${scoreBadge(l,true)}</td><td class="num">${l.value!==null?mxn(l.value):'<span class="muted">—</span>'}</td><td>${prioBadge(l.priority)}</td><td>${esc(l.channel||'—')}</td><td>${esc(l.owner||'—')}</td><td>${followBadge(l,true)||'<span class="muted">—</span>'}${l.nextAction&&['new','contacted','proposal'].includes(l.status)?`<small>${esc(l.nextAction)}</small>`:''}</td><td>${esc(shortDate(l.createdAt))}</td></tr>`).join('')}</tbody></table>
 <div class="pager"><span class="muted">Mostrando ${list.length?from+1:0}–${Math.min(from+pageSize,list.length)} de ${list.length}</span><label class="pager-size"><span>Por página</span><select id="page-size" aria-label="Contactos por página">${[25,50,100].map(n=>`<option ${n===pageSize?'selected':''}>${n}</option>`).join('')}</select></label><span class="pager-nav">${btn('← Anterior','page-prev','small',page<=1?'disabled':'')}<span class="muted">Página ${page} de ${pages}</span>${btn('Siguiente →','page-next','small',page>=pages?'disabled':'')}</span></div></section>`;}
function bulkHTML(list){if(!sel.size)return '';const from=(page-1)*pageSize,rows=list.slice(from,from+pageSize),allPage=rows.every(l=>sel.has(l.id));
 return `<div class="bulk" role="region" aria-label="Acciones masivas"><b>${sel.size} seleccionado${sel.size===1?'':'s'}</b>${allPage&&list.length>rows.length&&sel.size<list.length?btn(`Seleccionar los ${list.length} filtrados`,'sel-all','small'):''}${btn('Cambiar etapa','bulk-stage','small')}${btn('Asignar responsable','bulk-owner','small')}${btn('Añadir etiqueta','bulk-tag-add','small')}${btn('Quitar etiqueta','bulk-tag-remove','small')}${btn('Exportar selección','bulk-export','small')}${btn('Eliminar','bulk-delete','small danger')}${btn('Deseleccionar','sel-none','small ghost')}</div>`;}

// ───────────── Acciones sobre contactos ─────────────
function saveLeads(action,mutate,detail){return C.commit(action,s=>{mutate(s);},detail);}
function stageSummary(ids){const byId=new Map(C.raw().leads.map(l=>[l.id,l]));return ids.map(i=>byId.get(i)).filter(Boolean);}
function requestMove(ids,stageId){const pipe=curPipe(),stage=pipe.stages.find(s=>s.id===stageId);if(!stage)return;
 const leads=stageSummary(ids).filter(l=>resolveStage(PL(),l).stage.id!==stageId);if(!leads.length)return;
 const needReason=stage.kind==='lost',needValue=stage.kind==='won'&&leads.some(l=>l.value===null);
 if(needReason||needValue){stageDialog(leads.map(l=>l.id),stageId);return;}
 applyStage(leads.map(l=>l.id),stageId,{});}
function applyStage(ids,stageId,{lostReason='',value}){const names=stageSummary(ids).map(l=>l.name),name=pipelineOf(PL(),curPipe().id).stages.find(s=>s.id===stageId)?.name||stageId;
 return saveLeads(ids.length>1?'Cambiar etapa de varios contactos':'Mover contacto de etapa',s=>{s.leads=bulkMoveStage(s.leads,ids,s.settings.pipelines,stageId,{lostReason,value}).leads;},ids.length>1?`${ids.length} contactos → ${name}`:`${names[0]} → ${name}`);}
function stageDialog(ids,stageId=''){pending={ids,status:stageId};const pipe=curPipe(),leads=stageSummary(ids),single=leads.length===1?leads[0]:null,stage=pipe.stages.find(s=>s.id===stageId),needValue=stage?.kind==='won'&&leads.some(l=>l.value===null);
 const title=stage?`Mover a ${stage.name}`:`Cambiar etapa de ${ids.length} contactos`;
 C.openDialog('stage',title,`<p class="muted">${single?`<b>${esc(single.name)}</b>${single.company?` · ${esc(single.company)}`:''}`:`${ids.length} contactos seleccionados`}</p><div class="form-grid">${stage?`<input type="hidden" name="status" value="${esc(stage.id)}">`:sel2('Nueva etapa','status',pipe.stages[1]?.id||pipe.stages[0].id,stageOptsFor(pipe),{wide:true,id:'stage-pick'})}
 <div class="span-two" id="reason-wrap" ${stage?.kind==='lost'?'':'hidden'}>${fld('Motivo de pérdida','lostReason','',{type:'textarea',max:500,wide:true,required:stage?.kind==='lost',hint:`Obligatorio. Ejemplos: ${REASONS.slice(0,3).join(' · ')}`,extra:'id="reason-input" rows="3"'})}<div class="reason-quick">${REASONS.map(r=>`<button type="button" class="btn small ghost" data-action="pick-reason" data-reason="${esc(r)}">${esc(r)}</button>`).join('')}</div></div>
 <div class="span-two" id="value-wrap" ${needValue?'':'hidden'}>${fld(single?'Valor del proyecto ganado (MXN)':'Valor para los contactos que no lo tienen (MXN)','value','',{type:'number',required:needValue,extra:'id="value-input"',hint:'Obligatorio para registrar un proyecto como ganado.'})}</div></div>`,`${btn('Cancelar','close')}<button class="btn primary" type="submit">${stage?`Mover a ${esc(stage.name)}`:'Cambiar etapa'}</button>`);}
function syncStageDialog(){const pick=$('#stage-pick');if(!pick)return;const kind=pick.selectedOptions[0]?.dataset.kind,leads=stageSummary(pending.ids),needValue=kind==='won'&&leads.some(l=>l.value===null);$('#reason-wrap').hidden=kind!=='lost';$('#reason-input').required=kind==='lost';$('#value-wrap').hidden=!needValue;$('#value-input').required=needValue;}

// Ficha de contacto
const blank=()=>({name:'',company:'',email:'',phone:'',channel:'',owner:C.defaultOwner(),priority:'media',status:'',pipeline:curPipe().id,stageId:'',value:null,projectType:'',tags:[],notes:'',nextAction:'',nextActionAt:'',lostReason:'',timeline:[]});
function localInput(iso){const d=new Date(iso||Date.now());d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16);}
const TABS=[['timeline','Historial'],['tasks','Tareas'],['msgs','Mensajes'],['quotes','Cotizaciones'],['score','Puntaje'],['props','Propiedades']];
function timelineTab(l){return `<div class="tl-composer"><div class="tl-row"><label class="field"><span>Tipo</span><select id="tl-type">${['note','call','email','meeting','whatsapp'].map(k=>`<option value="${k}">${TIMELINE_TYPES[k]}</option>`).join('')}</select></label><label class="field"><span>Fecha y hora</span><input id="tl-at" type="datetime-local" value="${localInput()}"></label></div><label class="field"><span>Detalle</span><textarea id="tl-text" maxlength="2000" rows="3" placeholder="¿Qué pasó o qué acordaron?"></textarea></label>${btn('Añadir a la línea de tiempo','add-timeline','small primary')}<small class="muted">Se guarda junto con los datos del contacto.</small></div><ol class="timeline" aria-label="Historial del contacto">${[...l.timeline].sort((a,b)=>a.at<b.at?1:-1).map(e=>`<li class="tl-item tl-${esc(e.type)}"><span class="tl-type">${esc(TIMELINE_TYPES[e.type])}</span><time datetime="${esc(e.at)}">${esc(C.stamp(e.at))}</time><p>${esc(e.text)}</p></li>`).join('')||'<li class="muted">Aún no hay actividad registrada.</li>'}</ol>`;}
function scoreTab(l){const s=C.scoreOf(l.id);if(!s)return '<p class="muted">Sin puntaje.</p>';
 return `<div class="tab-block"><p class="score-big"><b>${Number(s.total)}</b><span>/ 100 · ${esc(BAND_LABEL[s.band])}</span></p><table class="score-table"><thead><tr><th>Regla</th><th>Detalle</th><th class="num">Puntos</th></tr></thead><tbody>${s.parts.map(p=>`<tr class="${p.on?'':'off'}"><td>${esc(p.label)}</td><td>${p.on?esc(p.detail):'<span class="muted">Regla apagada</span>'}<small>${p.on?`${Math.round(Number(p.fraction)*100)} % de ${Number(p.weight)} pts`:''}</small></td><td class="num">${p.on?Number(p.points):'—'}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="2">Total sobre ${Number(s.max)} puntos posibles</td><td class="num"><b>${Number(s.total)}</b></td></tr></tfoot></table>${btn('Editar reglas del puntaje','cfg-score','small')}<p class="storage-meta">El puntaje se recalcula con la actividad, así que cambia con el tiempo. No es una predicción: solo ordena tus contactos con reglas que tú ves y configuras.</p></div>`;}
function panelHTML2(lead,tab=fichaTab){
 switch(tab){case 'tasks':return UT.leadTab(lead);case 'msgs':return UM.leadTab(lead);case 'quotes':return UQ.leadTab(lead);case 'score':return scoreTab(lead);case 'props':return UP.leadTab(lead);default:return timelineTab(lead);}
}
export function refreshFicha(){const d=$('#dialog');if(!d?.open||d.dataset.kind!=='lead'||!d.dataset.id)return;const lead=S().leads.find(l=>l.id===d.dataset.id)||C.raw().leads.find(l=>l.id===d.dataset.id);const p=$('#ficha-panel');if(!lead||!p)return;p.innerHTML=panelHTML2(lead);const h=$('#ficha-head');if(h)h.innerHTML=headHTML(lead);}
const headHTML=l=>`${pillOf(l)} ${scoreBadge(l,true)} ${demoBadge(l)} ${intakeBadge(l)} ${followBadge(l,true)}`;
export function leadDialog(id='',draft=null){
 const st=S(),old=id?(C.raw().leads.find(l=>l.id===id)):null;if(id&&!old)return;
 const l=draft||old||blank(),owners=C.owners(),wa=whatsappNumber(l.phone),phoneTel=String(l.phone||'').replace(/[^\d+]/g,'');
 const pipe=pipelineOf(PL(),l.pipeline||curPipe().id),curStage=old||draft?.status?resolveStage(PL(),l).stage:pipe.stages.find(s=>s.kind==='open')||pipe.stages[0];
 const quick=old?`<div class="quick-actions" aria-label="Acciones rápidas">${wa?`<a class="btn small" href="https://wa.me/${wa}" target="_blank" rel="noopener noreferrer">WhatsApp ↗</a>`:'<span class="btn small disabled" aria-disabled="true" title="Añade un teléfono válido">WhatsApp</span>'}${l.email?`<a class="btn small" href="${esc(mailtoURL({to:l.email}))}">Correo ↗</a>`:'<span class="btn small disabled" aria-disabled="true">Correo</span>'}${phoneTel.length>=7?`<a class="btn small" href="tel:${esc(phoneTel)}">Llamar ↗</a>`:'<span class="btn small disabled" aria-disabled="true">Llamar</span>'}</div>`:'';
 const side=old?`<aside class="ficha-side"><div class="ficha-tabs" role="tablist" aria-label="Secciones de la ficha">${TABS.map(([k,t])=>`<button type="button" role="tab" class="ftab" data-action="ficha-tab" data-tab="${k}" aria-selected="${fichaTab===k}">${t}</button>`).join('')}</div><div id="ficha-panel" role="tabpanel">${panelHTML2(old)}</div></aside>`:`<aside class="ficha-side"><h3>Línea de tiempo</h3><p class="muted">Guarda el contacto para empezar a registrar notas, llamadas, tareas, mensajes y cotizaciones. Los cambios de etapa se anotan solos.</p></aside>`;
 const wonNeed=curStage.kind==='won';
 C.openDialog('lead',old?'Ficha del contacto':'Un nuevo contacto',`<div class="ficha"><div class="ficha-main">${old?`<p class="ficha-head" id="ficha-head">${headHTML(old)}</p>`:''}${quick}
 <div class="form-grid">${fld('Nombre','name',l.name,{required:true,max:150})}${fld('Empresa','company',l.company,{max:150})}${fld('Correo electrónico','email',l.email,{type:'email',max:250})}${fld('Teléfono','phone',l.phone,{type:'tel',max:80,hint:'Con 10 dígitos se asume México (+52).'})}
 ${sel2('Canal de origen','channel',l.channel,[['','Sin canal'],...CHANNELS.map(c=>[c,c])])}${fld('Responsable','owner',l.owner,{max:100,list:'owners-list',hint:'Elige a alguien del equipo o escribe un nombre.'})}<datalist id="owners-list">${owners.map(o=>`<option value="${esc(o)}">`).join('')}</datalist>
 ${sel2('Pipeline','pipeline',pipe.id,PL().map(p=>[p.id,p.name]),{id:'lead-pipeline'})}${sel2('Etapa','status',curStage.id,stageOptsFor(pipe),{id:'lead-status'})}${sel2('Prioridad','priority',l.priority,Object.entries(PRIORITIES))}
 ${fld('Valor estimado (MXN)','value',l.value??'',{type:'number',extra:`id="lead-value" ${wonNeed?'required':''}`})}${fld('Tipo de proyecto','projectType',l.projectType,{max:100})}
 ${fld('Etiquetas','tags',l.tags.join(', '),{max:400,wide:true,hint:'Separadas por comas. Hasta 12 etiquetas de 30 caracteres.'})}
 <div class="span-two" id="lost-wrap" ${curStage.kind==='lost'?'':'hidden'}>${fld('Motivo de pérdida','lostReason',l.lostReason,{type:'textarea',max:500,wide:true,required:curStage.kind==='lost',extra:'id="lost-input" rows="2"',hint:'Obligatorio cuando el contacto está en una etapa perdida.'})}</div>
 ${fld('Próxima acción','nextAction',l.nextAction,{max:300})}<div class="field"><label for="next-day"><span>Fecha de seguimiento</span></label><input id="next-day" name="nextActionDay" type="date" value="${l.nextActionAt?dayKey(l.nextActionAt):''}"><div class="shortcuts" role="group" aria-label="Atajos de fecha">${btn('Mañana','set-follow','small ghost','data-days="1"')}${btn('En 3 días','set-follow','small ghost','data-days="3"')}${btn('En 1 semana','set-follow','small ghost','data-days="7"')}${btn('Quitar fecha','set-follow','small ghost','data-days=""')}</div></div>
 ${fld('Notas','notes',l.notes,{type:'textarea',max:30000,wide:true,hint:'Contexto y acuerdos. Evita datos sensibles innecesarios.'})}</div>${old?`<p class="storage-meta">Creado ${esc(C.stamp(l.createdAt))} · Actualizado ${esc(C.stamp(l.updatedAt))}${l.lastContactAt?` · Último contacto ${esc(C.stamp(l.lastContactAt))}`:''} · Origen: ${esc(SOURCE_LABEL[l.source]||l.source)}</p>`:''}</div>${side}</div>`,
 `${old?btn('Eliminar contacto','delete-lead','danger',`data-id="${esc(id)}"`):''}${btn('Cancelar','close')}<button class="btn primary" type="submit">Guardar contacto</button>`,id||'');
}
function buildLead(values,old){const now=new Date().toISOString(),tags=String(values.tags||'').split(/[,;\n]/).map(t=>t.trim()).filter(Boolean),pipes=PL();
 const pipeId=pipes.some(p=>p.id===values.pipeline)?values.pipeline:(old?.pipeline||curPipe().id),pipe=pipelineOf(pipes,pipeId),first=pipe.stages.find(s=>s.kind==='open')||pipe.stages[0];
 const raw={...(old||{}),id:old?.id||uid(),name:values.name,company:values.company,email:values.email,phone:values.phone,channel:values.channel||'',owner:values.owner,priority:values.priority||'media',value:values.value===''||values.value===undefined?null:Number(values.value),projectType:values.projectType,tags,notes:values.notes,nextAction:values.nextAction,nextActionAt:values.nextActionDay?dayToISO(values.nextActionDay):'',createdAt:old?.createdAt||now,updatedAt:now,source:old?.source||'manual',status:old?.status||baseStatusFor(pipe.stages,first.id),pipeline:old?.pipeline||pipe.id,stageId:old?old.stageId:first.id,lostReason:old?.lostReason||'',timeline:old?.timeline||[{id:uid(),at:now,type:'stage',stage:`${pipe.id}/${first.id}`,text:`Contacto creado en la etapa ${first.name}`}]};
 if(values.nextActionDay&&!raw.nextActionAt)throw new Error('La fecha de seguimiento no es válida.');
 let lead=cleanLead(raw);
 if(old&&pipeId!==lead.pipeline)lead=movePipeline(lead,pipes,pipeId,{at:now});
 const {stage}=resolveStage(pipes,lead),target=values.status||stage.id;
 if(target!==stage.id)lead=moveToStage(lead,pipes,target,{lostReason:values.lostReason,value:values.value,at:now});
 else if(stage.kind==='lost'){const r=String(values.lostReason??lead.lostReason).trim();if(!r)throw new Error('Indica el motivo por el que se perdió este contacto.');lead={...lead,lostReason:r.slice(0,500)};}
 else if(stage.kind==='won'&&lead.value===null)throw new Error('Indica el valor del proyecto ganado.');
 return cleanLead(lead);}
function persistLead(lead,isNew){return saveLeads(isNew?'Crear contacto':'Actualizar contacto',s=>{if(isNew)s.leads.push(lead);else s.leads=s.leads.map(l=>l.id===lead.id?lead:l);},lead.name);}
function saveLeadForm(values,id){const old=id?C.raw().leads.find(l=>l.id===id):null;let lead;try{lead=buildLead(values,old);}catch(error){C.toast(error.message,true);return false;}
 const changed=!old||normEmail(old.email)!==normEmail(lead.email)||phoneKey(old.phone)!==phoneKey(lead.phone),dups=changed?findDuplicates(C.raw().leads,lead,lead.id):[];
 if(dups.length){dupDialog(lead,!old,dups);return false;}
 return persistLead(lead,!old);}
function dupDialog(lead,isNew,matches){pending={lead,isNew,matches};
 C.openDialog('dup','Posible contacto duplicado',`<div class="notice warn">Ya existe${matches.length>1?'n':''} ${matches.length} contacto${matches.length>1?'s':''} con el mismo correo o teléfono que <b>${esc(lead.name)}</b>.</div><ul class="plain-list dup-list">${matches.map(m=>`<li><b>${esc(m.name)}</b>${demoBadge(m)} ${pillOf(m)}<br><span class="muted">${esc([m.company,m.email,m.phone].filter(Boolean).join(' · '))}</span></li>`).join('')}</ul>${matches.length>1?sel2('Fusionar con','target',matches[0].id,matches.map(m=>[m.id,`${m.name}${m.email?' · '+m.email:''}`]),{wide:true}):`<input type="hidden" name="target" value="${esc(matches[0].id)}">`}<p class="muted">Al fusionar se conservan los datos del contacto existente, se completan los campos vacíos con los nuevos, se unen etiquetas e historial, y queda una nota en la línea de tiempo.</p>`,
 `${btn('Cancelar','dup-cancel')}${btn(isNew?'Crear de todos modos':'Guardar de todos modos','dup-anyway')}<button class="btn primary" type="submit">Fusionar con el existente</button>`);}
function mergeInto(targetId,lead,isNew){return saveLeads('Fusionar contactos',s=>{const t=s.leads.find(l=>l.id===targetId);if(!t)throw new Error('El contacto existente ya no está disponible.');const merged=mergeLeads(t,lead);s.leads=s.leads.filter(l=>isNew||l.id!==lead.id).map(l=>l.id===targetId?merged:l);},`${lead.name} → contacto existente`);}

// Importación con duplicados
export function importLeads(rows,name){const plan=planImport(C.raw().leads,rows);
 if(!plan.duplicates.length){return saveLeads('Importar CSV',s=>s.leads.push(...rows),`${rows.length} contactos · ${name}`);}
 pending={rows,name,plan};
 C.openDialog('import-dups','Contactos que ya existen',`<div class="notice warn">${plan.duplicates.length} de ${rows.length} filas comparten correo o teléfono con contactos existentes (o con otras filas del archivo).${plan.existingMerges.length?` Al fusionar también se reunirán ${plan.existingMerges.length} contactos existentes que estas filas vinculan entre sí; sus notas se conservan.`:''}</div><ul class="plain-list dup-list">${plan.duplicates.slice(0,5).map(d=>`<li><b>${esc(d.incoming.name)}</b> ≈ ${esc(d.match.name)}<br><span class="muted">${esc(d.incoming.email||d.incoming.phone)}</span></li>`).join('')}${plan.duplicates.length>5?`<li class="muted">… y ${plan.duplicates.length-5} más.</li>`:''}</ul><fieldset class="radios"><legend>¿Qué hacemos con ellas?</legend><label><input type="radio" name="mode" value="merge" checked> Fusionar con los existentes (${plan.fresh.length} nuevos + ${plan.duplicates.length} fusionados)</label><label><input type="radio" name="mode" value="skip"> Omitir los duplicados (solo ${plan.fresh.length} nuevos)</label><label><input type="radio" name="mode" value="all"> Importarlos todos de todos modos (${rows.length})</label></fieldset>`,`${btn('Cancelar','close')}<button class="btn primary" type="submit">Importar</button>`);
 return false;}

// Diálogos masivos
function bulkDialog(op){const ids=[...sel];if(!ids.length)return;pending={ids,op};const leads=stageSummary(ids);
 const titles={owner:'Asignar responsable','tag-add':'Añadir etiqueta','tag-remove':'Quitar etiqueta',delete:'Eliminar contactos'};
 let body='';
 if(op==='owner')body=`<p class="muted">Se asignará a ${ids.length} contactos. Deja vacío para quitar el responsable.</p><div class="form-grid">${fld('Responsable','owner','',{max:100,list:'owners-list2',wide:true})}<datalist id="owners-list2">${C.owners().map(o=>`<option value="${esc(o)}">`).join('')}</datalist></div>`;
 if(op==='tag-add')body=`<p class="muted">Se añadirá a ${ids.length} contactos.</p><div class="form-grid">${fld('Etiqueta','tag','',{max:30,required:true,wide:true})}</div>`;
 if(op==='tag-remove'){const tags=distinctValues(leads,'tags');body=tags.length?`<p class="muted">Etiquetas presentes en la selección.</p><div class="form-grid">${sel2('Etiqueta a quitar','tag',tags[0],tags.map(t=>[t,t]),{wide:true})}</div>`:'<p class="muted">Los contactos seleccionados no tienen etiquetas.</p>';}
 if(op==='delete')body=`<div class="notice warn"><b>Vas a eliminar ${ids.length} contacto${ids.length===1?'':'s'}.</b> Esta acción afecta solo a este navegador y no se puede deshacer. Descarga un respaldo antes si lo necesitas.</div>`;
 C.openDialog('bulk',titles[op],body,`${btn('Cancelar','close')}<button class="btn ${op==='delete'?'danger-solid':'primary'}" type="submit" ${op==='tag-remove'&&!distinctValues(leads,'tags').length?'disabled':''}>${op==='delete'?`Eliminar ${ids.length}`:'Aplicar'}</button>`,op);}
function exportCSV(list,name){C.download(leadsToCSV(list),name,'text/csv;charset=utf-8');C.commit('Exportar contactos CSV',()=>{},`${list.length} contactos`,true);C.toast(`CSV con ${list.length} contactos descargado.`);}

// ───────────── Eventos ─────────────
function setFilter(patch){try{filters=cleanFilters({...filters,pipeline:curPipe().id,...patch});}catch(error){C.toast(error.message,true);return;}page=1;updateResults();}
export function handleAction(action,el){
 const id=el.dataset.id;
 if(UT.handleAction(action,el)||UQ.handleAction(action,el)||UP.handleAction(action,el)||UM.handleAction(action,el)||CFG.handleAction(action,el))return true;
 switch(action){
  case 'new-lead':leadDialog();return true;
  case 'edit-lead':fichaTab=$('#dialog').open&&$('#dialog').dataset.kind==='lead'&&$('#dialog').dataset.id===id?fichaTab:(el.dataset.tab||'timeline');leadDialog(id);return true;
  case 'ficha-tab':{fichaTab=el.dataset.tab;document.querySelectorAll('.ftab').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===fichaTab)));refreshFicha();return true;}
  case 'toggle-panel':panelOpen=!panelOpen;$('#filter-panel').dataset.open=String(panelOpen);el.setAttribute('aria-expanded',String(panelOpen));return true;
  case 'toggle-stage':{const s=el.dataset.stage;setFilter({stageIds:filters.stageIds.includes(s)?filters.stageIds.filter(x=>x!==s):[...filters.stageIds,s]});return true;}
  case 'clear-filter':{const k=el.dataset.key;if(k==='stages')setFilter({stages:filters.stages.filter(x=>x!==el.dataset.value)});else if(k==='stageIds')setFilter({stageIds:filters.stageIds.filter(x=>x!==el.dataset.value)});else setFilter({[k]:''});return true;}
  case 'clear-all':{const sort=filters.sort,pipeline=curPipe().id;filters={...defaultFilters(),sort,pipeline};page=1;updateResults();return true;}
  case 'set-view':mode=el.dataset.mode==='table'?'table':'board';document.querySelectorAll('[data-action=set-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));updateResults();return true;
  case 'sort-col':{const k=el.dataset.key,[cur,rev]=filters.sort.split(':');setFilter({sort:cur===k?(rev?k:`${k}:rev`):k});return true;}
  case 'page-prev':page=Math.max(1,page-1);updateResults();return true;
  case 'page-next':page+=1;updateResults();return true;
  case 'more-col':colLimit[el.dataset.status]=(colLimit[el.dataset.status]||40)+40;updateResults();return true;
  case 'sel-all':current().forEach(l=>sel.add(l.id));updateResults();return true;
  case 'sel-none':sel.clear();updateResults();return true;
  case 'bulk-stage':if(sel.size)stageDialog([...sel],'');return true;
  case 'bulk-owner':bulkDialog('owner');return true;
  case 'bulk-tag-add':bulkDialog('tag-add');return true;
  case 'bulk-tag-remove':bulkDialog('tag-remove');return true;
  case 'bulk-delete':bulkDialog('delete');return true;
  case 'bulk-export':{const ids=new Set(sel);exportCSV(current().filter(l=>ids.has(l.id)),'ornat-contactos-seleccion.csv');return true;}
  case 'export-view':exportCSV(current(),'ornat-contactos.csv');return true;
  case 'leads-csv':exportCSV(current(),'ornat-contactos.csv');return true;
  case 'pick-reason':{const t=$('#reason-input');if(t){t.value=el.dataset.reason;t.focus();}return true;}
  case 'set-follow':{const d=el.dataset.days,input=$('#next-day');if(input)input.value=d?addDays(dayKey(new Date()),Number(d)):'';return true;}
  case 'save-view':{const input=$('#view-name');try{const settings=saveView(C.raw().settings,input?.value,{...filters,pipeline:curPipe().id},mode);C.commit('Guardar vista de contactos',s=>{s.settings.savedViews=settings.savedViews;},input.value.trim());}catch(error){C.toast(error.message,true);}return true;}
  case 'apply-view':{const v=C.raw().settings.savedViews.find(x=>x.id===id);if(v){filters=cleanFilters(v.filters);mode=v.mode;page=1;sel.clear();renderCRM();C.toast(`Vista «${v.name}» aplicada.`);}return true;}
  case 'delete-view':{const v=C.raw().settings.savedViews.find(x=>x.id===id);if(v){const settings=removeView(C.raw().settings,id);C.commit('Eliminar vista de contactos',s=>{s.settings.savedViews=settings.savedViews;},v.name);}return true;}
  case 'load-demo':C.commit('Cargar contactos de ejemplo',s=>{s.leads=loadDemo(s.leads);},`${DEMO_COUNT} contactos marcados como ejemplo`);return true;
  case 'remove-demo':{const n=C.raw().leads.filter(isDemo).length;if(n&&C.commit('Quitar contactos de ejemplo',s=>{s.leads=removeDemo(s.leads);},`${n} contactos de ejemplo`))C.toast(`Se quitaron ${n} contactos de ejemplo. Tus contactos reales no se tocaron.`);return true;}
  case 'add-timeline':{const form=Object.fromEntries(new FormData($('#dialog-shell'))),lid=$('#dialog').dataset.id,old=C.raw().leads.find(l=>l.id===lid);if(!old)return true;
   const text=$('#tl-text').value.trim();if(!text){C.toast('Escribe el detalle de la nota o actividad.',true);$('#tl-text').focus();return true;}
   try{const lead0=buildLead(form,old),at=$('#tl-at').value?new Date($('#tl-at').value).toISOString():new Date().toISOString(),lead=addTimelineEntry(lead0,{type:$('#tl-type').value,text,at});
    fichaTab='timeline';if(persistLead(lead,false))leadDialog(lid);}catch(error){C.toast(error.message,true);}return true;}
  case 'dup-cancel':leadDialog(pending.isNew?'':pending.lead.id,pending.lead);return true;
  case 'dup-anyway':if(persistLead(pending.lead,pending.isNew))C.closeDialog();return true;
  case 'go-preset':applyPreset(el.dataset.preset);return true;
 }
 return false;
}
function applyPreset(name){const base={...defaultFilters(),sort:filters.sort,pipeline:filters.pipeline};const presets={site:{stages:['new']},all:{},pipeline:{stages:['new','contacted','proposal']},won:{stages:['won']},overdue:{followUp:'overdue'},today:{followUp:'today'},week:{createdFrom:weekStart()}};filters=cleanFilters({...base,...presets[name]});page=1;sel.clear();C.goView('crm');}
export function handleSubmit(kind,values,dialogId){
 const ext=UT.handleSubmit(kind,values,dialogId);if(ext!==undefined)return ext;
 for(const m of [UQ,UM,UP,CFG]){const r=m.handleSubmit(kind,values,dialogId);if(r!==undefined)return r;}
 if(kind==='lead')return saveLeadForm(values,dialogId);
 if(kind==='stage'){const {ids}=pending,stageId=values.status;if(!stageId)return false;try{const stage=curPipe().stages.find(s=>s.id===stageId);if(stage?.kind==='lost'&&!String(values.lostReason||'').trim())throw new Error('Indica el motivo por el que se perdió este contacto.');
   if(stage?.kind==='won'&&stageSummary(ids).some(l=>l.value===null&&String(values.value??'').trim()===''))throw new Error('Indica el valor del proyecto ganado.');
   return applyStage(ids,stageId,{lostReason:values.lostReason,value:values.value});}catch(error){C.toast(error.message,true);return false;}}
 if(kind==='dup'){return mergeInto(values.target,pending.lead,pending.isNew);}
 if(kind==='import-dups'){const {rows,name}=pending,mode2=values.mode||'merge';return saveLeads('Importar CSV',s=>{s.leads=applyImport(s.leads,rows,mode2).leads;},`${name} · ${rows.length} filas · duplicados: ${{merge:'fusionados',skip:'omitidos',all:'importados igualmente'}[mode2]||mode2}`);}
 if(kind==='bulk'){const {ids,op}=pending;try{const apply=o=>saveLeads(`Acción masiva: ${op}`,s=>{s.leads=applyBulk(s.leads,ids,o).leads;},`${ids.length} contactos`);
   let ok=false;if(op==='owner')ok=apply({type:'owner',owner:values.owner||''});if(op==='tag-add')ok=apply({type:'addTag',tag:values.tag});if(op==='tag-remove')ok=apply({type:'removeTag',tag:values.tag});
   if(op==='delete'){ok=apply({type:'delete'});if(ok)sel.clear();}
   if(ok&&op!=='delete')updateResults();return ok;}catch(error){C.toast(error.message,true);return false;}}
 return undefined;
}
export function handleInput(el){
 if(UT.handleInput(el)||UQ.handleInput(el)||UM.handleInput(el)||UP.handleInput(el)||CFG.handleInput(el))return true;
 if(el.id==='f-q'){setFilter({q:el.value});return true;}
 if(el.id==='f-min'){setFilter({minValue:el.value});return true;}
 if(el.id==='f-max'){setFilter({maxValue:el.value});return true;}
 if(el.id==='f-score'){setFilter({minScore:el.value});return true;}
 return false;
}
export function handleChange(el){
 if(UT.handleChange(el)||UQ.handleChange(el)||UM.handleChange(el)||UP.handleChange(el)||CFG.handleChange(el))return true;
 const map={'f-sort':'sort','f-channel':'channel','f-owner':'owner','f-priority':'priority','f-tag':'tag','f-from':'createdFrom','f-to':'createdTo','f-follow':'followUp'};
 if(map[el.id]){setFilter({[map[el.id]]:el.value});return true;}
 if(el.id==='f-pipeline'){filters=cleanFilters({...filters,pipeline:el.value,stageIds:[]});page=1;sel.clear();colLimit={};updateResults();const p=$('#filter-panel');if(p)p.innerHTML=panelHTML();return true;}
 if(el.id==='ov-pipe'){ovPipe=el.value;C.rerender();return true;}
 if(el.id==='page-size'){pageSize=Number(el.value)||25;page=1;updateResults();return true;}
 if(el.id==='sel-page'){const from=(page-1)*pageSize,rows=current().slice(from,from+pageSize);rows.forEach(l=>el.checked?sel.add(l.id):sel.delete(l.id));updateResults();return true;}
 if(el.dataset.sel){el.checked?sel.add(el.dataset.sel):sel.delete(el.dataset.sel);updateResults();return true;}
 if(el.dataset.move){const status=el.value;el.value='';if(status)requestMove([el.dataset.move],status);return true;}
 if(el.id==='stage-pick'){syncStageDialog();return true;}
 if(el.id==='lead-pipeline'){const pipe=pipelineOf(PL(),el.value),first=pipe.stages.find(s=>s.kind==='open')||pipe.stages[0],st=$('#lead-status');st.innerHTML=stageOptsFor(pipe).map(([k,t,d])=>`<option value="${esc(k)}" data-kind="${esc(d)}" ${k===first.id?'selected':''}>${esc(t)}</option>`).join('');st.dispatchEvent(new Event('change',{bubbles:true}));return true;}
 if(el.id==='lead-status'){const kind=el.selectedOptions[0]?.dataset.kind;$('#lost-wrap').hidden=kind!=='lost';$('#lost-input').required=kind==='lost';$('#lead-value').required=kind==='won';return true;}
 return false;
}
export function handleKeydown(event){const t=event.target;
 if(event.key==='Enter'&&t.tagName==='INPUT'&&t.closest?.('.ficha-side')){event.preventDefault();return true;}
 if(event.key==='Enter'&&(t.id==='tl-type'||t.id==='tl-at'||t.id==='view-name'||t.id==='f-q')){event.preventDefault();if(t.id==='view-name')handleAction('save-view',t);return true;}
 if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)&&t.id==='tl-text'){event.preventDefault();handleAction('add-timeline',t);return true;}return false;}
function dndAnnounce(msg){let live=document.getElementById('dnd-live');if(!live){live=document.createElement('div');live.id='dnd-live';live.className='sr-only';live.setAttribute('role','status');live.setAttribute('aria-live','polite');live.setAttribute('aria-atomic','true');document.body.append(live);}live.textContent='';setTimeout(()=>{live.textContent=msg;},30);}
function initDrag(){
 mountBoardDnD(document.body,{card:'.lead-card',column:'[data-drop-status]',announce:dndAnnounce,onDrop:(id,colId)=>{
  const lead=C.raw().leads.find(l=>l.id===id),stage=curPipe().stages.find(s=>s.id===colId),kb=document.activeElement?.classList?.contains('lead-open');
  requestMove([id],colId);
  if(stage?.kind==='lost'||(stage?.kind==='won'&&lead&&lead.value===null))dndAnnounce(`Para mover a ${lead?.name||'la tarjeta'} a ${stage.name} completa los datos que pide el diálogo.`);
  else dndAnnounce(`${lead?.name||'Tarjeta'} movido a ${stage?.name||colId}.`);
  if(kb)requestAnimationFrame(()=>document.querySelector(`.lead-card[data-id="${CSS.escape(id)}"] .lead-open`)?.focus());
 }});
}

// ───────────── Resumen ─────────────
export function overviewHTML(){
 const st=S(),P=PL(),pid=ovPipe,pipe=pid?pipelineOf(P,pid):null,leads=pid?st.leads.filter(l=>(l.pipeline||'venta')===pid):st.leads;
 const k=crmKPIs(leads,new Date()),has=k.total>0,nd='Sin datos',pct=k.winRate===null?nd:`${Math.round(k.winRate*100)}%`;
 const kpi=(label,value,note,preset,featured=false)=>`<button type="button" class="stat ${featured?'featured':''}" data-action="go-preset" data-preset="${preset}" aria-label="${esc(label)}: ${esc(value)}. Ver en contactos."><span class="label">${esc(label)}</span><span class="corner">↗</span><strong>${esc(value)}</strong><small>${esc(note)}</small></button>`;
 const funnel=pipe?pipe.stages.map(s=>{const items=leads.filter(l=>resolveStage(P,l).stage.id===s.id);return {key:s.id,name:s.name,color:s.color,count:items.length,value:items.reduce((a,l)=>a+(l.value||0),0)};}):k.funnel.map(f=>({key:f.status,name:LEAD_STATUSES[f.status],color:{new:'#c3cdae',contacted:'#e1c36b',proposal:'#a99bd6',won:'#8fb04f',lost:'#d9a095'}[f.status],count:f.count,value:f.value}));
 const maxF=Math.max(1,...funnel.map(f=>f.count)),maxC=Math.max(1,...k.byChannel.map(c=>c.count));
 const trendTotal=k.weekly.reduce((s,w)=>s+w.count,0);
 const now=new Date(),tc=taskCounts(st.tasks,now,{hidden:hiddenTaskIds(st.tasks,st.enrollments)}),qs=quoteSummary(st.quotes,now),fc=forecast(st.leads,P,{pipeline:pid||P[0].id}),site=newFromSite(st.leads);
 const topTasks=filterTasks(st.tasks,{range:'overdue'},now,{hidden:hiddenTaskIds(st.tasks,st.enrollments)}).concat(filterTasks(st.tasks,{range:'today'},now)).slice(0,5);
 return `<div class="crm-bar"><label class="sortbox pipebox"><span class="sr-only">Pipeline del resumen</span><select id="ov-pipe" aria-label="Pipeline del resumen"><option value="">Todos los pipelines</option>${P.map(p=>`<option value="${esc(p.id)}" ${p.id===pid?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label>${site?`<button type="button" class="btn small" data-action="go-preset" data-preset="site"><span class="badge-site">${site} nuevo${site===1?'':'s'} del sitio</span> Ver contactos</button>`:''}</div>
 <div class="stats six">${kpi('CONTACTOS',has?String(k.total):nd,has?`${k.open} abiertos · ${k.won} ganados · ${k.lost} perdidos`:'Añade o importa tu primer contacto','all',true)}${kpi('VALOR EN PIPELINE ABIERTO',has?mxn(k.pipelineValue):nd,has?'Contactos abiertos con valor':'Sin contactos abiertos','pipeline')}${kpi('VALOR GANADO',has?mxn(k.wonValue):nd,has?`${k.won} proyecto${k.won===1?'':'s'} ganado${k.won===1?'':'s'}`:'Sin proyectos ganados','won')}${kpi('TASA DE CIERRE',pct,k.winRate===null?'Aparece al cerrar ganados o perdidos':`${k.won} ganados de ${k.won+k.lost} cerrados`,'all')}${kpi('SEGUIMIENTOS VENCIDOS',has?String(k.overdue):nd,has?`${k.dueToday} para hoy`:'Sin contactos','overdue')}${kpi('NUEVOS ESTA SEMANA',has?String(k.newThisWeek):nd,has?'Desde el lunes':'Sin contactos','week')}</div>
 ${st.leads.some(isDemo)?'<div class="notice demo-notice" role="note">Las cifras incluyen contactos de ejemplo. Puedes quitarlos en <b>Contactos y CRM</b> o <b>Ajustes y datos</b>.</div>':''}
 <div class="grid-two"><section class="card"><div class="card-head"><h2>Embudo por etapa${pipe?` · ${esc(pipe.name)}`:''}</h2><span>Contactos y valor</span></div>${has?funnel.map(f=>`<div class="funnel-row"><span>${esc(f.name)}</span><div class="bar"><i style="width:${f.count/maxF*100}%;background:${esc(f.color)}"></i></div><b>${f.count}</b><em>${f.value?mxn(f.value):'—'}</em></div>`).join(''):C.empty(nd,'El embudo se calcula con tus contactos.')}</section>
 <section class="card"><div class="card-head"><h2>Contactos por canal</h2><span>${has?k.byChannel.length+' canales':''}</span></div>${has?k.byChannel.map(c=>`<div class="bar-row"><span>${esc(c.channel)}</span><div class="bar"><i style="width:${c.count/maxC*100}%"></i></div><b>${c.count}</b></div>`).join(''):C.empty(nd,'Aquí verás de dónde llegan tus contactos.')}</section></div>
 <div class="grid-two"><section class="card"><div class="card-head"><h2>Tareas</h2>${btn('Abrir tareas ↗','go-tasks','small ghost')}</div><p class="muted"><b>${tc.overdue}</b> vencidas · <b>${tc.today}</b> para hoy · <b>${tc.week}</b> esta semana</p>${topTasks.length?`<ul class="plain-list">${topTasks.map(t=>`<li><button class="link-btn" data-action="edit-task" data-id="${esc(t.id)}">${esc(t.title)}</button> <small class="muted">${esc(C.stamp(t.dueAt))}</small></li>`).join('')}</ul>`:'<p class="muted">Nada urgente por ahora.</p>'}</section>
 <section class="card"><div class="card-head"><h2>Pronóstico ponderado</h2><span>${esc(fc.pipeline.name)}</span></div><p class="big-number"><b>${mxn(fc.total.weighted)}</b><span>de ${mxn(fc.total.value)} abiertos, según la probabilidad de cada etapa</span></p>${fc.noValue?`<p class="storage-meta">${fc.noValue} contactos abiertos no tienen valor y no suman.</p>`:''}${Object.entries(qs).map(([c,s])=>`<p class="muted">Cotizaciones ${c}: cotizado <b>${fmtMoney(s.quoted,c)}</b> · aceptado <b>${fmtMoney(s.accepted,c)}</b></p>`).join('')}</section></div>
 <div class="grid-two"><section class="card"><div class="card-head"><h2>Seguimientos de hoy y vencidos</h2><span>${has?k.followUps.length:''}</span></div>${k.followUps.length?`<ul class="plain-list followups">${k.followUps.slice(0,8).map(l=>`<li><button type="button" class="link-btn" data-action="edit-lead" data-id="${esc(l.id)}">${esc(l.name)}</button> ${followBadge(l,true)}<p class="muted">${esc(l.nextAction||'Sin descripción')}${l.company?' · '+esc(l.company):''}</p></li>`).join('')}</ul>${k.followUps.length>8?`<p class="muted">Y ${k.followUps.length-8} más. ${btn('Ver todos','go-preset','small ghost','data-preset="overdue"')}</p>`:''}`:C.empty(has?'Nada pendiente para hoy':nd,has?'No hay seguimientos vencidos ni programados para hoy.':'Los seguimientos aparecen cuando tus contactos tienen fecha.')}</section>
 <section class="card"><div class="card-head"><h2>Altas por semana</h2><span>Últimas 8 semanas</span></div>${has&&trendTotal?trendSVG(k.weekly):C.empty(nd,has?'Ningún contacto fue creado en las últimas 8 semanas.':'La tendencia se calcula con la fecha de alta de tus contactos.')}</section></div>`;
}
function trendSVG(weekly){const W=560,H=190,pl=26,pb=34,pt=22,bw=(W-pl)/weekly.length,max=Math.max(1,...weekly.map(w=>w.count)),label=w=>{const [y,m,d]=w.start.split('-');return `${d}/${m}`;};
 const desc=weekly.map(w=>`semana del ${label(w)}: ${w.count}`).join('; ');
 return `<figure class="trend"><svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="trend-t trend-d" preserveAspectRatio="xMidYMid meet"><title id="trend-t">Altas de contactos por semana</title><desc id="trend-d">${esc(desc)}</desc><line x1="${pl}" y1="${H-pb}" x2="${W}" y2="${H-pb}" class="axis"/>${weekly.map((w,i)=>{const h=Math.round((H-pb-pt)*w.count/max),x=pl+i*bw+bw*.18,y=H-pb-h;return `<g><rect x="${x.toFixed(1)}" y="${y}" width="${(bw*.64).toFixed(1)}" height="${h||1}" rx="3" class="${i===weekly.length-1?'now':''}"><title>Semana del ${label(w)}: ${w.count} contactos</title></rect><text x="${(x+bw*.32).toFixed(1)}" y="${y-6}" text-anchor="middle" class="val">${w.count}</text><text x="${(x+bw*.32).toFixed(1)}" y="${H-12}" text-anchor="middle" class="lab">${label(w)}</text></g>`;}).join('')}</svg><figcaption class="storage-meta">Semanas que comienzan el lunes indicado. Última barra: semana en curso.</figcaption></figure>`;}

// ───────────── Ajustes, respaldo y avisos ─────────────
export function bannerHTML(){const st=C.raw(),r=backupReminder(st),bytes=new Blob([JSON.stringify(st)]).size,pct=bytes/(8*1024*1024);const out=[];
 if(r.due)out.push(`<div class="notice warn banner" role="alert"><span><b>Hace ${r.days} días que no descargas un respaldo.</b> Tienes ${r.pending} cambio${r.pending===1?'':'s'} que solo viven en este navegador${r.never?' y nunca has descargado un respaldo':''}.</span>${btn('Descargar respaldo ahora','backup','small primary')}</div>`);
 if(pct>=0.8)out.push(`<div class="notice warn banner" role="alert"><span><b>El panel usa ${Math.round(pct*100)}% del límite del panel de 8 MB.</b> Descarga un respaldo y elimina eventos o registros antiguos.</span>${btn('Descargar respaldo','backup','small')}</div>`);
 return out.join('');}
export function backupStatus(){const st=C.raw(),r=backupReminder(st),last=st.settings.lastBackupAt;return {text:last?`Último respaldo: ${C.stamp(last)}`:'Aún no hay respaldo descargado',pending:r.pending,due:r.due};}
export function settingsExtras(){const st=C.raw(),bytes=new Blob([JSON.stringify(st)]).size,pct=Math.min(100,bytes/(8*1024*1024)*100),r=backupReminder(st),demo=st.leads.filter(isDemo).length,last=st.settings.lastBackupAt,pend=C.intakePending();
 return `<div class="grid-two"><section class="card" id="storage-card"><h2>Dónde viven tus datos</h2><p class="muted"><b>Solo en este navegador.</b> Todo se guarda en el almacenamiento local (localStorage) con un límite del panel de 8 MB (el espacio real depende de tu navegador). No hay nube, cuenta real ni sincronización entre dispositivos, y el navegador puede borrarlo al limpiar datos del sitio.</p><div class="meter" role="img" aria-label="Uso de almacenamiento: ${pct.toFixed(1)} por ciento de 8 MB"><i style="width:${Math.max(pct,1)}%"></i></div><p class="storage-meta">${(bytes/1024).toFixed(1)} KB de 8 MB · ${pct.toFixed(1)}%</p><p class="storage-meta">${last?`Último respaldo descargado: ${esc(C.stamp(last))}.`:'Todavía no has descargado un respaldo.'} ${r.pending?`Cambios sin respaldar: ${r.pending}.`:'No hay cambios pendientes de respaldar.'} Te avisaremos si pasan más de 7 días sin exportar.</p><div class="actions">${btn('Respaldo (JSON)','backup','lime')}${btn('Importar JSON / CSV','import')}</div></section>
 <section class="card"><h2>Formularios públicos del sitio</h2><div class="notice">Modo demo: conectado solo a este navegador.</div><p class="muted">Los formularios del sitio que se llenen <b>en este mismo navegador</b> llegan aquí al instante y se convierten en contactos${pend?` (hay ${pend} pendientes)`:''}. Para recibir envíos de otras personas y otros dispositivos se necesita un <b>backend</b> (Supabase, ver la página de cuenta). Hasta entonces no entra nada desde fuera.</p></section></div>
 <section class="card"><div class="card-head"><h2>Contactos de ejemplo</h2><span>${demo?`${demo} cargados`:'Nunca se cargan solos'}</span></div><p class="muted">Carga ${DEMO_COUNT} contactos ficticios del sector arquitectura e interiorismo para explorar filtros, tablero y resumen. Quedan marcados con la insignia «Ejemplo» y puedes quitarlos sin afectar tus contactos reales.</p><div class="actions">${btn(`Cargar ${DEMO_COUNT} contactos de ejemplo`,'load-demo','',demo?'disabled':'')}${btn(`Quitar ejemplos${demo?` (${demo})`:''}`,'remove-demo','',demo?'':'disabled')}</div></section>
 ${CFG.sectionsHTML()}`;}
