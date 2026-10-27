import {activity,consent,heatEvent} from './control-link.js';
import {openStore,listProjects,saveProject,loadProject,deleteProject,assessImage,assessContrast,buildImagePrompts,readMedia,readIcon,parseProjectFile,isSafeLink,storageEstimate,readVideo,MAX_PROJECT_BYTES,projectByteSize} from './core.js';
import {filterTexts,textFiltersActive,TEXT_TYPES,textType,textEdited,isHidden,filterMedia,mediaFiltersActive,MEDIA_TYPES,mediaType,mediaModified,effectiveAlt,filterTemplates,TEMPLATE_CHIPS,TEMPLATE_SORTS,filterProjects,PROJECT_SORTS,templateTags,TAG_LABELS} from './filters.js';
import {carryOver,describeCarry,hasContent} from './carry.js';
import {applyKit} from './kits.js';
import {createToolbar} from './toolbar.js';
import {createExt} from './ext.js';
import {aiStatus} from './ai.js';
import {structureEdits} from './layout.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const frame=$('#preview'), panel=$('#panel');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=(name,cls='')=>`<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const tabs={
  design:['TU ESPACIO DE TRABAJO','Diseño','Una plantilla. Tu identidad.'],
  text:['PALABRAS QUE IMPORTAN','Texto','Busca, filtra y edita cada texto del sitio.'],
  media:['DIRECCIÓN VISUAL','Imágenes','Fotos, fondos, logos y video, con su encuadre.'],
  style:['TU LENGUAJE VISUAL','Colores y fuentes','Paleta y tipografía, con la UX protegida.'],
  sections:['ESTRUCTURA DE LA PÁGINA','Secciones','Ve a cada módulo y muéstralo u ocúltalo.'],
  brand:['TU IDENTIDAD','Marca','Tu nombre y tu logo, en su lugar.'],
  site:['CONFIGURACIÓN DEL SITIO','Sitio y legal','Buscadores, imagen al compartir y documentos legales.'],
  export:['LISTO PARA COMPARTIR','Entregar','Guarda una copia o exporta tu sitio.']
};
const TYPE_LABEL={title:'Título',text:'Texto',button:'Botón',tag:'Etiqueta'};
const MEDIA_LABEL={photo:'Foto',background:'Fondo',logo:'Logo',icon:'Ícono',video:'Video',sequence:'Secuencia'};
const ZOOMS=[25,33,50,67,75,90,100,110,125,150,175,200];
const NATIVE={desktop:1440,tablet:768,mobile:390};
const DEVICE_LABEL={desktop:'Escritorio',tablet:'Tablet',mobile:'Móvil'};
const emptyInventory=()=>({texts:[],images:[],colors:[],links:[],sections:[],logos:[],videos:[],sequences:[],warnings:[],seo:{}});
let legalModes={},templates=[],project=null,inventory=emptyInventory(),currentTab='design',ready=false,selecting=true,history=[],future=[],saveTimer,applyTimer,loadTimer,toastTimer,lastEdit={key:null,time:0},uploadTarget=null,videoTarget=null,promptSlot=null,promptAnimation=false,revision=0,savedRevision=-1,storageAvailable=true;
let navPick=null,sel=null,selRect=null,selVp=null,openText=null,openMedia=null,currentSection=null,device='desktop',zoom='fit',scale=1,lastViewScale=0,textLimit=80;
const filters={text:{q:'',section:'',type:'',edited:false,hidden:false},media:{q:'',section:'',type:'',modified:false,noAlt:false,lowQuality:false,hidden:false}};
const tplFilter={q:'',chip:'all',tags:[],sort:'az'};let viewerSlug=null,viewerDevice='desktop',carryKit=null;
let projectsCache=[];const prjFilter={q:'',template:'',sort:'recent'};
const uid=()=>globalThis.crypto?.randomUUID?.()||`project-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const template=()=>templates.find(t=>t.slug===project?.template)||templates[0];
const send=(type,extra={})=>{if(frame.contentWindow)frame.contentWindow.postMessage({channel:'ornat-cms',type,...extra},location.origin);};

/* ---------- layout, device and zoom ---------- */
function layoutPreview(){
  const area=$('#canvas-scroll'),shell=$('#preview-shell');
  if(!area.clientWidth||!area.clientHeight)return;
  const css=getComputedStyle(area),padX=parseFloat(css.paddingLeft)+parseFloat(css.paddingRight),padY=parseFloat(css.paddingTop)+parseFloat(css.paddingBottom);
  const native=NATIVE[device],availW=area.clientWidth-padX,fit=Math.min(1,availW/native);
  scale=zoom==='fit'?fit:zoom/100;
  const width=Math.round(native*scale),overflowX=width>availW+1;
  const height=Math.max(160,area.clientHeight-padY-$('#device-ruler').offsetHeight-(overflowX?16:0)-(device==='mobile'?10:0));
  $('#stage').style.width=width+'px';shell.style.width=width+'px';shell.style.height=height+'px';shell.dataset.device=device;
  frame.style.width=native+'px';frame.style.height=(height/scale)+'px';frame.style.transform=`scale(${scale})`;
  const pct=Math.round(scale*100);
  $('#zoom-label').textContent=pct+'%';$('#zoom-label').setAttribute('aria-label',`Zoom ${pct}%. Clic para ajustar`);
  $('#zoom-fit').setAttribute('aria-pressed',String(zoom==='fit'));
  $('#ruler-label').textContent=`${DEVICE_LABEL[device]} · ${native} px`;
  $('#zoom-out').disabled=pct<=ZOOMS[0];$('#zoom-in').disabled=pct>=ZOOMS.at(-1);
  if(Math.abs(scale-lastViewScale)>.0005){lastViewScale=scale;send('view',{scale});}
  positionToolbar();
}
function setZoom(next){zoom=next;layoutPreview();}
function setDevice(next){
  device=next;
  $$('button[data-device]').forEach(x=>{const active=x.dataset.device===device;x.classList.toggle('active',active);x.setAttribute('aria-pressed',String(active));});
  zoom='fit';layoutPreview();setTimeout(()=>send('request-inventory'),450);
}
function positionToolbar(){toolbar.position({area:$('#canvas-area'),shell:$('#preview-shell'),scale,rect:selRect,vh:selVp?.vh||frame.clientHeight/scale});}

/* ---------- toast ---------- */
function toast(text,error=false,action=null){
  clearTimeout(toastTimer);const el=$('#toast');el.dataset.error=String(error);el.textContent=text;
  if(action){const b=document.createElement('button');b.type='button';b.textContent=action.label;b.onclick=()=>{el.hidden=true;action.run();};el.append(b);}
  el.hidden=false;toastTimer=setTimeout(()=>el.hidden=true,error?9000:action?7000:4500);
}
function button(text,action,kind=''){return `<button type="button" class="button ${kind}" data-action="${esc(action)}">${text}</button>`;}
function notice(text,level=''){return `<div class="notice ${level}">${esc(text)}</div>`;}
function field(label,id,value,{type='text',hint='',max=5000}={}){return `<label class="field"><span>${esc(label)}</span>${type==='textarea'?`<textarea id="${id}" maxlength="${max}">${esc(value)}</textarea>`:`<input id="${id}" type="${type}" value="${esc(value)}" maxlength="${max}">`}${hint?`<small>${esc(hint)}</small>`:''}</label>`;}

/* ---------- section helpers ---------- */
function sectionLabel(id){
  const s=inventory.sections.find(x=>String(x.id)===String(id));
  if(!s)return String(id||'General').replace(/[-_]/g,' ');
  if(s.tag==='nav')return 'Menú';
  if(s.tag==='footer')return 'Pie de página';
  if(s.label&&!/^(section|header|footer|main|nav)$/i.test(s.label))return s.label;
  const names={header:'Encabezado',footer:'Pie de página',nav:'Menú',main:'Contenido',section:'Sección'};
  return `${names[s.tag]||'Sección'} ${inventory.sections.indexOf(s)+1}`;
}
const sectionName=sectionLabel;
const navSections=()=>inventory.sections.filter(s=>s.leaf!==false&&s.visible!==false);

/* ---------- project mutations and history ---------- */
function changed(key){
  activity(key);revision++;$('#save-state').textContent='Cambios sin guardar…';
  clearTimeout(applyTimer);applyTimer=setTimeout(()=>ready&&send('apply',{patch:project.patch}),100);
  clearTimeout(saveTimer);saveTimer=setTimeout(persist,550);
  $('#undo').disabled=!history.length;$('#redo').disabled=!future.length;lastEdit={key,time:Date.now()};
  toolbar.render();ext.onChange(key);
}
function pushHistory(){history.push(project.patch);if(history.length>60)history.shift();future=[];}
function update(area,key,value){
  if(!project)return;if(!ext.canEdit()){ext.denied();return;}const group=`${area}.${key}`;
  if(lastEdit.key!==group||Date.now()-lastEdit.time>850)pushHistory();
  project.patch={...project.patch,[area]:{...(project.patch[area]||{}),[key]:value}};changed(group);
}
// Tope único de tamaño para todo cambio que reemplaza el patch (replacePatch y commit).
function guardSize(next){if(projectByteSize({...project,patch:next})<=MAX_PROJECT_BYTES)return true;toast('El proyecto supera el límite del demo (72 MB). Usa archivos más ligeros.',true);return false;}
function replacePatch(patch){
  if(!ext.canEdit()){ext.denied();return false;}
  if(!guardSize(patch))return false;
  pushHistory();project.patch=patch;changed('replace');renderPanel();return true;
}
function removeKey(area,key){
  const next={...(project.patch[area]||{})};delete next[key];const patch={...project.patch};
  if(Object.keys(next).length)patch[area]=next;else delete patch[area];
  return replacePatch(patch);
}
async function persist(){
  if(!project)return true;const projectId=project.id,version=revision;
  try{const saved=await saveProject(project);if(project?.id===projectId&&version===revision){project.updatedAt=saved.updatedAt;savedRevision=version;$('#save-state').textContent='Guardado en este navegador';}try{localStorage.setItem('ornat-cms-last',projectId);}catch{}return true;}
  catch(error){$('#save-state').textContent='No se pudo guardar · exporta una copia';toast(error.message,true);return false;}
}
/* ---------- text being typed on the canvas ---------- */
// Lo que se escribe en el lienzo vive en el iframe hasta confirmarse. Antes de guardar copia, exportar, publicar o cambiar de
// plantilla se pide confirmarlo: resuelve al llegar «edit-committed» (el bridge lo manda después de «text-edit») o a los 400 ms.
const FLUSH_TIMEOUT_MS=400;const pendingFlush=new Map();let flushSeq=0;
function flushEdit(){if(!ready)return Promise.resolve();const requestId=`flush-${++flushSeq}`;return new Promise(resolve=>{let timer=0;const done=()=>{clearTimeout(timer);pendingFlush.delete(requestId);resolve();};timer=setTimeout(done,FLUSH_TIMEOUT_MS);pendingFlush.set(requestId,done);send('commit-edit',{requestId});});}
function editCommitted(m){pendingFlush.get(m.requestId)?.();}
async function saveNow(){await flushEdit();return persist();}
function undo(){if(!ext.canEdit()||!history.length)return;future.push(project.patch);project.patch=history.pop();lastEdit={key:null,time:0};changed('undo');renderPanel();}
function redo(){if(!ext.canEdit()||!future.length)return;history.push(project.patch);project.patch=future.pop();lastEdit={key:null,time:0};changed('redo');renderPanel();}

/* ---------- media helpers ---------- */
function allImages(){const images=[...inventory.images];for(const logo of inventory.logos)if(!images.some(i=>i.id===logo.id))images.push(logo);return images;}
function imageSlot(item){const ratio=Number(item.ratio)>0?Number(item.ratio):16/9;const width=item.kind==='logo'?Math.max(160,item.width||0):Math.max(400,Math.min(1920,item.width||item.naturalWidth||960));return {...item,width,height:width/ratio};}
function mediaValue(item){const edit=project.patch.images?.[item.id];return {...item,...edit,src:edit?.src||(item.kind==='logo'&&project.patch.brand?.logo)||item.src};}
// Only what the bridge needs is stored for an image edit (not the whole inventory entry).
function imageEdit(item,props={}){const base=mediaValue(item),own=project.patch.images?.[item.id]||{};return {src:base.src,alt:own.alt??item.alt??'',fit:own.fit??(item.kind==='logo'?'contain':'cover'),position:own.position??'50% 50%',...props};}
function guidanceHTML(item){const meta=project.patch.mediaMeta?.[item.id];if(!meta)return '';const report=assessImage(meta,imageSlot(item));return notice(report.messages.join(' '),report.level==='good'?'':report.level);}
// "Calidad baja": the file is smaller than the space it fills (uses assessImage with the uploaded or natural size).
function lowQuality(item){
  if(!['photo','background','logo'].includes(mediaType(item)))return false;
  const meta=project.patch.mediaMeta?.[item.id]||(item.naturalWidth>0?{width:item.naturalWidth,height:item.naturalHeight}:null);
  if(!meta)return false;const slot=imageSlot(item),report=assessImage(meta,slot);
  return report.level==='error'||(report.level==='warning'&&meta.width<slot.width*.99);
}
function mediaItems(){
  const images=allImages().map(i=>({...i,type:i.kind==='logo'?'logo':i.kind==='background'?'background':i.kind==='icon'?'icon':'photo'}));
  return [...images,...(inventory.videos||[]).map(v=>({...v,type:'video',kind:'video'})),...(inventory.sequences||[]).map(s=>({...s,type:'sequence',kind:'sequence',section:'general'}))];
}
function mediaCard(item){
  const val=mediaValue(item),slot=imageSlot(item),report=assessImage({width:item.naturalWidth||slot.width*2,height:item.naturalHeight||slot.height*2},slot),xy=String(val.position||'50% 50%').match(/[\d.]+/g)||['50','50'],hidden=isHidden(project.patch,item.id,item.section);
  return `<article class="card media-card selected-card" data-logo="${item.kind==='logo'}" data-media="${esc(item.id)}"><div class="media-picture">${val.src?`<img src="${esc(val.src)}" alt="${esc(val.alt||'Vista previa de imagen')}" loading="lazy" style="object-fit:${val.fit==='contain'?'contain':'cover'};object-position:${esc(val.position||'50% 50%')}">`:`<span class="hint">${item.kind==='icon'?'Ícono original de la plantilla':'Logo vectorial original'}</span>`}</div><div class="media-detail"><h3>${esc(item.alt||sectionName(item.section)||'Imagen')}</h3><div class="meta">${esc(item.kind==='logo'?'LOGO':item.kind==='background'?'FONDO':item.kind==='icon'?'ÍCONO':'IMAGEN')} · Recomendado ${report.recommended.width} × ${report.recommended.height} px</div><div class="actions-row"><button class="button lime" data-upload="${esc(item.id)}">Subir ${item.kind==='logo'?'logo':item.kind==='icon'?'ícono (PNG, WebP o SVG)':'imagen'}</button><button class="button" data-prompt="${esc(item.id)}">Prompt</button></div>${guidanceHTML(item)}<label class="field"><span>Descripción de la imagen (accesibilidad)</span><input data-media-alt="${esc(item.id)}" value="${esc(val.alt)}" maxlength="300"></label><label class="field"><span>Ajuste</span><select data-fit="${esc(item.id)}"><option value="cover" ${val.fit!=='contain'?'selected':''}>Llenar sin deformar</option><option value="contain" ${val.fit==='contain'?'selected':''}>Mostrar completa</option></select></label><label class="field"><span>Encuadre horizontal <output>${Number(xy[0]??50)}%</output></span><input type="range" min="0" max="100" value="${Number(xy[0]??50)}" data-position="${esc(item.id)}" data-axis="0"></label><label class="field"><span>Encuadre vertical <output>${Number(xy[1]??50)}%</output></span><input type="range" min="0" max="100" value="${Number(xy[1]??50)}" data-position="${esc(item.id)}" data-axis="1"></label><div class="actions-row">${project.patch.images?.[item.id]?`<button class="button" data-reset-image="${esc(item.id)}">Restaurar original</button>`:''}<button class="button" data-toggle-hide="${esc(item.id)}">${hidden?'Mostrar':'Ocultar'}</button></div></div></article>`;
}
function videoCard(v){
  const value={...v,...project.patch.videos?.[v.id]},hidden=isHidden(project.patch,v.id,v.section);
  return `<article class="card selected-card"><h3>Video · ${esc(sectionName(v.section))}</h3>${value.poster?`<div class="media-picture" style="margin-bottom:12px"><img src="${esc(value.poster)}" alt="Portada del video" loading="lazy"></div>`:''}<p>Reemplaza el video conservando su comportamiento y el scroll. MP4 o WebM · máximo 32 MB por archivo.</p><div class="stack"><button class="button lime" data-video-upload="${esc(v.id)}">Subir mi video</button><button class="button" data-video-poster="${esc(v.id)}">Cambiar imagen de portada</button></div><label class="field" style="margin-top:14px"><span>O usa una URL de video</span><input data-video-url="${esc(v.id)}" value="${esc(value.src?.startsWith('data:')?'':value.src||'')}" placeholder="https://…/mi-video.mp4"></label><p class="hint">Recomendado: ${v.width||1920} × ${v.height||1080} px, mismo encuadre. Prepara la portada con la misma proporción.</p><div class="actions-row">${project.patch.videos?.[v.id]?`<button class="button" data-video-reset="${esc(v.id)}">Restaurar video original</button>`:''}<button class="button" data-toggle-hide="${esc(v.id)}">${hidden?'Mostrar':'Ocultar'}</button></div></article>`;
}
function sequenceCard(s){
  return `<div class="card selected-card"><h3>${esc(s.label)}</h3><p>${s.editable?`Esta animación utiliza ${s.count} fotogramas. Sube una secuencia ordenada, con el mismo encuadre, para mantener el recorrido.`:'Esta animación usa un lienzo o efecto especial. Su textura necesita una integración específica; una foto normal no reemplaza este efecto.'}</p>${s.width?`<p class="hint">Referencia: ${s.width} × ${s.height} px por cuadro. Nombres sugeridos: 001.webp, 002.webp…</p>`:''}${s.editable?`${button('Subir fotogramas ordenados','sequence','full')}${project.patch.sequences?.[s.id]?.frames?.length?`<p class="sequence-count">${project.patch.sequences[s.id].frames.length} fotogramas propios cargados</p>${button('Restaurar secuencia original','reset-sequence','full')}`:''}`:''}${s.editable?button('Ver guía y prompts','sequence-prompt','full'):''}</div>`;
}

/* ---------- panels ---------- */
function chipsHTML(items,current,attr,{allLabel='Todo'}={}){return [['',allLabel],...items].map(([v,l])=>`<button type="button" class="chip" ${attr}="${esc(v)}" data-f="${attr}-${esc(v)}" aria-pressed="${current===v}">${esc(l)}</button>`).join('');}
function toggleChip(attr,label,on){return `<button type="button" class="chip" ${attr} data-f="${attr}" aria-pressed="${on}">${esc(label)}</button>`;}
function sectionSelect(attr,items,value,label){
  const ids=[...new Set(items.map(i=>String(i.section)))];
  return `<label class="sr" for="${attr}">${esc(label)}</label><select id="${attr}" data-f="${attr}" ${attr==='text-section'?'data-text-section':'data-media-section'} class="full-input"><option value="">Todas las secciones</option>${ids.map(id=>`<option value="${esc(id)}" ${value===id?'selected':''}>${esc(sectionLabel(id))}</option>`).join('')}</select>`;
}
function searchField(id,attr,value,placeholder){return `<div class="search-field">${icon('search')}<label class="sr" for="${id}">${esc(placeholder)}</label><input id="${id}" type="search" ${attr} data-f="${id}" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off"></div>`;}
function textRow(t){
  const p=project.patch,val=p.texts?.[t.id]??t.text,edited=textEdited(p,t.id,t.block),hid=isHidden(p,t.id,t.section,t.block),open=openText?openText===t.id:sel?.id===t.id||sel?.textIds?.[0]===t.id,link=inventory.links.find(l=>l.id===t.id);
  return `<div class="text-row ${open?'is-selected':''} ${hid?'is-hidden-row':''}" data-row="${esc(t.id)}"><div class="row-head"><button type="button" class="row-main" data-pick-text="${esc(t.id)}" aria-expanded="${open}"><span class="row-text">${esc(val)}</span><span class="row-meta"><span class="tag">${TYPE_LABEL[textType(t)]}</span>${esc(sectionLabel(t.section))}${edited?'<span class="dot-edited" title="Editado"></span><span class="sr">Editado</span>':''}</span></button><button type="button" class="row-eye" data-toggle-hide="${esc(t.id)}" aria-pressed="${hid}" aria-label="${hid?'Mostrar':'Ocultar'} este texto" title="${hid?'Mostrar':'Ocultar'}">${icon(hid?'eye-off':'eye')}</button></div>${open&&t.dynamic?`<div class="row-body"><div class="notice warning">Este texto lo controla la animación de la plantilla: se reescribe solo, así que no se puede editar aquí.</div></div>`:''}${open&&!t.dynamic?`<div class="row-body"><label class="field"><span>Texto</span><textarea data-text="${esc(t.id)}" maxlength="3000">${esc(val)}</textarea></label>${link?`<label class="field"><span>Destino del enlace</span><input data-link="${esc(link.id)}" value="${esc(p.links?.[link.id]??link.href)}" placeholder="https://…"></label>`:''}<div class="actions-row"><button type="button" class="button" data-locate="${esc(t.id)}">Ver en mi sitio</button>${edited?`<button type="button" class="button" data-reset-text="${esc(t.id)}">Restablecer</button>`:''}</div></div>`:''}</div>`;
}
function textPanel(){
  const p=project.patch,f=filters.text,all=inventory.texts,list=filterTexts(all,p,f),shown=list.slice(0,textLimit),active=textFiltersActive(f);
  return `<div class="filters">${searchField('text-search','data-text-search',f.q,'Buscar un texto…')}${sectionSelect('text-section',all,f.section,'Filtrar por sección')}<div class="chips-row wrap" role="group" aria-label="Tipo de texto">${chipsHTML(TEXT_TYPES,f.type,'data-text-type',{allLabel:'Todos'})}</div><div class="chips-row wrap" role="group" aria-label="Estado">${toggleChip('data-text-edited','Solo editados',f.edited)}${toggleChip('data-text-hidden','Solo ocultos',f.hidden)}</div></div><div class="filter-meta"><span role="status" aria-live="polite">${list.length} de ${all.length} textos</span>${active?'<button type="button" class="text-btn" data-clear-text>Limpiar filtros</button>':''}</div><div class="row-list">${shown.map(textRow).join('')||`<div class="empty-state">${all.length?'Ningún texto coincide con estos filtros.':'No se detectaron textos. Abre el menú o módulo de la plantilla y usa «Actualizar elementos».'}${active?'<br><button type="button" class="text-btn" data-clear-text>Limpiar filtros</button>':''}${all.length?'':'<br>'+button('Actualizar elementos','rescan')}</div>`}</div>${list.length>shown.length?`<div style="margin-top:10px">${button(`Mostrar más (${list.length-shown.length})`,'more-texts','full')}</div>`:''}`;
}
function mediaTile(item){
  const p=project.patch,type=mediaType(item),val=type==='video'?{...item,...p.videos?.[item.id]}:type==='sequence'?item:mediaValue(item),thumb=type==='video'?val.poster:val.src,open=sel?.id===item.id||openMedia===item.id,mod=mediaModified(p,item),low=lowQuality(item),hid=isHidden(p,item.id,item.section),noAlt=['photo','logo'].includes(type)&&!effectiveAlt(p,item).trim();
  const title=type==='sequence'?item.label:type==='video'?(item.label||'Video'):(effectiveAlt(p,item)||sectionLabel(item.section));
  return `<button type="button" class="media-tile ${open?'is-selected':''}" data-pick-media="${esc(item.id)}" data-logo="${type==='logo'}" aria-pressed="${open}" aria-label="${esc(MEDIA_LABEL[type]+': '+title)}"><div class="thumb">${thumb?`<img src="${esc(thumb)}" alt="" loading="lazy">`:`<span class="hint">${type==='sequence'?'Secuencia':type==='logo'?'Logo vectorial':'Sin vista previa'}</span>`}<span class="flags"><span class="tag">${MEDIA_LABEL[type]}</span>${mod?'<span class="tag">Editada</span>':''}${low?'<span class="tag warn">Calidad baja</span>':''}${hid?'<span class="tag warn">Oculta</span>':''}${noAlt?'<span class="tag warn">Sin alt</span>':''}</span></div><div class="cap"><b>${esc(title)}</b><span class="row-meta">${esc(sectionLabel(item.section))}</span></div></button>`;
}
function mediaDetail(item){const type=mediaType(item);return type==='video'?videoCard(item):type==='sequence'?sequenceCard(item):mediaCard(item);}
function mediaPanel(){
  const p=project.patch,f=filters.media,all=mediaItems(),list=filterMedia(all,p,f,{lowQuality}),active=mediaFiltersActive(f);
  const tiles=list.map(item=>mediaTile(item)+((sel?.id===item.id||openMedia===item.id)?`<div class="media-detail-wrap">${mediaDetail(item)}</div>`:'')).join('');
  return `<div class="filters">${searchField('media-search','data-media-search',f.q,'Buscar por descripción…')}${sectionSelect('media-section',all,f.section,'Filtrar por sección')}<div class="chips-row wrap" role="group" aria-label="Tipo de archivo">${chipsHTML(MEDIA_TYPES,f.type,'data-media-type',{allLabel:'Todo'})}</div><div class="chips-row wrap" role="group" aria-label="Estado">${toggleChip('data-media-modified','Modificadas',f.modified)}${toggleChip('data-media-noalt','Sin descripción (alt)',f.noAlt)}${toggleChip('data-media-low','Calidad baja',f.lowQuality)}${toggleChip('data-media-hidden','Ocultas',f.hidden)}</div></div><div class="filter-meta"><span role="status" aria-live="polite">${list.length} de ${all.length} elementos</span>${active?'<button type="button" class="text-btn" data-clear-media>Limpiar filtros</button>':''}</div>${list.length?`<div class="media-grid">${tiles}</div>`:`<div class="empty-state">${all.length?'Ningún elemento coincide con estos filtros.':'No se detectaron imágenes todavía.'}${active?'<br><button type="button" class="text-btn" data-clear-media>Limpiar filtros</button>':''}</div>`}<details class="card" style="margin-top:16px"><summary><b>Prompts y animaciones</b></summary><p class="muted" style="margin-top:10px">Medidas, proporciones y prompts para tu herramienta de imágenes. El demo no genera imágenes ni consume una API.</p><label class="field"><span>¿Qué espacio quieres preparar?</span><select id="guide-slot">${allImages().map(i=>`<option value="${esc(i.id)}">${esc((i.alt||sectionName(i.section)||'Imagen').slice(0,60))}</option>`).join('')}</select></label>${button('Obtener medidas y prompt','guide-prompt','full lime')}<hr class="divider"><h3>Antes / después sin saltos</h3><p>Conserva cámara, encuadre y geometría entre ambas imágenes; cambia el acabado, no la posición del edificio.</p>${button('Crear prompts inicial y final','pair-prompt','full')}${inventory.warnings.map(w=>notice(w,'warning')).join('')}</details>`;
}
function sectionsPanel(){
  const list=navSections(),p=project.patch;
  return `<p class="muted" style="margin-bottom:12px">Toca una sección para ir a ella. El ojo la muestra u oculta sin borrar su contenido. Para duplicar, quitar o reordenar secciones, y para dar estilo a una sección, usa la pestaña <button type="button" class="text-btn" data-tab="structure">Estructura</button>: las que la animación protege muestran un candado con el motivo.</p><div class="row-list">${list.map((s,i)=>{const hid=!!p.hidden?.['section:'+s.id],count=inventory.texts.filter(t=>String(t.section)===String(s.id)).length;return `<div class="section-row ${currentSection===s.id?'is-current':''} ${hid?'is-hidden-row':''}" data-section-row="${esc(s.id)}"><div class="row-head"><span class="section-index" aria-hidden="true">${i+1}</span><button type="button" class="row-main" data-goto-section="${esc(s.id)}" ${currentSection===s.id?'aria-current="true"':''}><span class="row-text">${esc(sectionLabel(s.id))}</span><span class="row-meta"><span class="tag">${esc({header:'Encabezado',footer:'Pie',nav:'Menú',main:'Contenido'}[s.tag]||'Sección')}</span>${count} textos${currentSection===s.id?' · estás aquí':''}</span></button><button type="button" class="row-eye" data-edit-section-texts="${esc(s.id)}" aria-label="Editar los textos de ${esc(sectionLabel(s.id))}" title="Editar sus textos">${icon('text')}</button><button type="button" class="row-eye" data-toggle-section="${esc(s.id)}" aria-pressed="${hid}" aria-label="${hid?'Mostrar':'Ocultar'} la sección ${esc(sectionLabel(s.id))}" title="${hid?'Mostrar':'Ocultar'}">${icon(hid?'eye-off':'eye')}</button></div></div>`;}).join('')||'<div class="empty-state">No se detectaron secciones todavía.</div>'}</div>`;
}
function designPanel(){
  const t=template(),p=project.patch,edits=Object.keys(p.texts||{}).length+Object.keys(p.images||{}).length+Object.keys(p.styles||{}).length+Object.keys(p.hidden||{}).length+(p.blocks?.length||0)+structureEdits(p);
  return `<button type="button" class="button lime tpl-cta" data-action="templates">${icon('templates')}<span><b>Plantillas</b><small>${templates.length} estilos · vista previa, etiquetas y filtros</small></span></button><div class="card"><div class="template-current"><img src="${esc(t.thumbnail)}" alt=""><div><b>${esc(t.name)}</b><span>Tu diseño de partida · ${edits} cambios</span><span class="tpl-tags">${templateTags(t).slice(0,3).map(x=>`<i>${esc(TAG_LABELS[x])}</i>`).join('')}</span></div></div></div><h3 class="section-title">Otros puntos de partida</h3><div class="media-grid tpl-strip">${templates.filter(x=>x.slug!==t.slug).slice(0,6).map(x=>`<button type="button" class="media-tile" data-choose-template="${esc(x.slug)}" aria-label="Cambiar a la plantilla ${esc(x.name)}"><div class="thumb"><img src="${esc(x.thumbnail)}" alt="" loading="lazy"></div><div class="cap"><b>${esc(x.name)}</b><span class="row-meta">${esc(templateTags(x).slice(0,2).map(y=>TAG_LABELS[y]).join(' · '))}</span></div></button>`).join('')}</div><p class="hint" style="margin-bottom:14px">Al elegir otra plantilla puedes empezar de cero o llevar tu contenido (módulos, marca, colores, tipografía, SEO y legales). El proyecto actual se conserva en «Mis proyectos».</p><div class="actions-row">${button('Mis proyectos','projects')}${button('Importar','import')}</div>`;
}
function brandPanel(){
  const p=project.patch;
  return field('Nombre de tu marca','brand-name',p.brand?.name||'',{hint:'Se aplica a los nombres de marca que la plantilla permite detectar.',max:80})+`<span class="field-label">Tu logotipo</span><div class="logo-preview">${p.brand?.logo?`<img src="${esc(p.brand.logo)}" alt="Tu logo">`:'<span class="muted">Conservas el logo original</span>'}</div>${button('Subir logo PNG transparente','logo','full lime')}<p class="hint">PNG transparente recomendado. También JPEG, WebP y AVIF · máximo 12 MB. Lo ajustamos sin estirarlo.</p>${p.brand?.logo?button('Restaurar logo original','reset-logo','full'):''}${p.mediaMeta?.brandLogo?notice(assessImage(p.mediaMeta.brandLogo,{kind:'logo',width:200,height:200}).messages.join(' '),'warning'):''}<hr class="divider">${notice(inventory.logos.length?`Se detectaron ${inventory.logos.length} posiciones de logo. Revisa sus versiones sobre fondos claros y oscuros.`:'Esta plantilla usa una marca tipográfica. Edita su nombre sobre el lienzo; las imágenes y fondos siguen disponibles.','')}<h3 class="section-title">Enlaces de contacto</h3><p class="muted">Edita todos los botones y enlaces desde el panel Texto. Los formularios del demo solo guardan el contacto en el CRM de este navegador.</p><button class="button full" data-tab-filter="button">Editar botones y enlaces →</button>`;
}
function stylePanel(){
  const p=project.patch;
  return notice('El diseño y el movimiento se conservan. Estos son los colores que expone esta plantilla. La fuente, el tamaño y el color de un texto concreto se cambian con la barra flotante sobre el lienzo.')+`<h3 class="section-title">Paleta de la plantilla <span class="badge">EN VIVO</span></h3>${inventory.colors.map(c=>{const value=p.colors?.[c.key]||c.value,hex=toHex(value);return `<div class="color-row"><input type="color" value="${hex}" data-color="${esc(c.key)}" aria-label="Color ${esc(colorLabel(c.key))}"><label>${esc(colorLabel(c.key))}<small class="color-name">${esc(c.value)}</small></label><input class="hex" data-color-text="${esc(c.key)}" value="${esc(hex)}" aria-label="Código de color ${esc(colorLabel(c.key))}"></div>`;}).join('')||'<p class="muted">Esta plantilla no expone colores globales editables.</p>'}<div id="contrast-notice">${contrastHTML()}</div><hr class="divider"><h3 class="section-title">Tipografía global</h3>${fontSelect('body','Texto general',p.typography?.body)}${fontSelect('heading','Títulos',p.typography?.heading)}<p class="hint">Al cambiar la fuente, revisa textos largos y el resultado móvil. El tamaño y los ritmos del diseño se mantienen.</p>${button('Restaurar colores y tipografía','reset-style','full')}`;
}
function sitePanel(){
  const p=project.patch;
  return `<h3 class="section-title">Buscadores y dirección</h3>${field('Título de la página','seo-title',p.seo?.title??inventory.seo.title??'',{hint:'Recomendado: 30–60 caracteres.',max:200})}${field('Descripción','seo-description',p.seo?.description??inventory.seo.description??'',{type:'textarea',hint:'Describe tu proyecto y ubicación en unas 150–160 letras.',max:1000})}${field('URL principal del sitio (canónica)','seo-canonical',p.seo?.canonical??inventory.seo.canonical??'',{type:'url',hint:'La dirección pública definitiva, por ejemplo https://miestudio.com/. No publica el sitio.',max:2048})}<hr class="divider"><h3 class="section-title">Ícono de la pestaña</h3>${seoMediaCard('favicon','Favicon','512 × 512 px · PNG cuadrado, diseño simple y legible.',p.seo?.favicon??inventory.seo.favicon)}<hr class="divider"><h3 class="section-title">Imagen al compartir</h3>${seoMediaCard('ogImage','Imagen social','1200 × 630 px · evita texto pequeño y deja margen alrededor del logo.',p.seo?.ogImage??inventory.seo.ogImage)}<hr class="divider"><h3 class="section-title">Documentos legales</h3><p class="muted">Añade tus documentos aprobados: enlaza una página existente o pega su texto completo. El editor no redacta ni inventa políticas.</p>${[['privacy','Aviso de privacidad'],['terms','Términos y condiciones'],['cookies','Política de cookies']].map(([key,title])=>legalFields(key,title)).join('')}<p class="hint">Estos documentos no configuran consentimiento, analítica ni el envío de formularios.</p>`;
}
function exportPanel(){
  return notice('Guarda tu proyecto para seguir editándolo. Exportar no publica un sitio ni envía tus archivos a un servidor.')+`<div class="card"><h3>Proyecto editable</h3><p>Incluye tus cambios e imágenes subidas. Impórtalo en otro navegador para continuar.</p>${button('Descargar proyecto .json','export-json','full lime')}</div><div class="card"><h3>Tu sitio en HTML</h3><p>Una copia personalizada que conserva el código de la plantilla, tus textos, estilos y elementos ocultos. Requiere conexión para sus recursos originales.</p>${button('Exportar sitio .html','export-html','full')}</div><hr class="divider"><h3 class="section-title">Configuración del sitio</h3><p class="muted">Título, descripción, favicon, imagen al compartir y documentos legales se editan en Sitio.</p><button class="button full" data-tab="site">Abrir Sitio y legal →</button><div class="notice warning" style="margin-top:14px">Los formularios son una demostración: guardan el contacto en el CRM de este navegador. Para recibir prospectos reales, conecta el backend y publica con tu dominio.</div>`;
}
const PANELS={design:designPanel,text:textPanel,media:mediaPanel,style:stylePanel,sections:sectionsPanel,brand:brandPanel,site:sitePanel,export:exportPanel};
function setTab(tab,{open=true}={}){
  if(!tabs[tab])return;currentTab=tab;
  $$('.rail [data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  const [eyebrow,title,desc]=tabs[tab];$('#panel-eyebrow').textContent=eyebrow;$('#panel-title').textContent=title;$('#panel-description').textContent=desc;
  if(open)setDrawer(true);else syncRailAria();
  renderPanel();$('.drawer-inner').scrollTop=0;
}
function syncRailAria(){const open=$('#workspace').dataset.drawer==='open';$$('.rail [data-tab]').forEach(b=>b.setAttribute('aria-expanded',String(open&&b.dataset.tab===currentTab)));ext?.syncRail?.();$('#drawer-open').setAttribute('aria-expanded',String(open));}
function setDrawer(open){
  $('#workspace').dataset.drawer=open?'open':'closed';syncRailAria();
  setTimeout(layoutPreview,320);requestAnimationFrame(layoutPreview);
}
function renderPanel(){
  if(!project)return;
  const inner=$('.drawer-inner'),top=inner.scrollTop,active=document.activeElement,focusKey=panel.contains(active)?active.dataset?.f:null,caret=focusKey&&active.selectionStart!=null?[active.selectionStart,active.selectionEnd]:null;
  panel.innerHTML=PANELS[currentTab]();
  inner.scrollTop=top;bindPanel();
  if(focusKey){const next=panel.querySelector(`[data-f="${CSS.escape(focusKey)}"]`);if(next){next.focus({preventScroll:true});if(caret&&next.setSelectionRange)try{next.setSelectionRange(...caret);}catch{}}}
}
function bindPanel(){
  if(currentTab==='brand')$('#brand-name').addEventListener('input',e=>update('brand','name',e.target.value));
  if(currentTab==='site')for(const key of ['title','description','canonical'])$('#seo-'+key).addEventListener('input',e=>{if(key==='canonical'&&!validSiteURL(e.target.value)){e.target.setCustomValidity('Usa una URL completa HTTP o HTTPS.');return;}e.target.setCustomValidity('');update('seo',key,e.target.value);});
}
function revealSelectedRow(){panel.querySelector('.is-selected')?.scrollIntoView({block:'nearest'});}
function validSiteURL(value,fragment=false){if(!value.trim())return true;if(fragment&&/^#[A-Za-z][\w-]*$/.test(value))return true;try{return ['http:','https:'].includes(new URL(value).protocol);}catch{return false;}}
function seoMediaCard(key,title,hint,src){return `<div class="card seo-media"><div class="seo-media-preview ${key==='favicon'?'favicon-preview':''}">${src?`<img src="${esc(src)}" alt="${esc(title)}">`:'<span class="muted">Sin imagen personalizada</span>'}</div><p class="hint">${esc(hint)} Máximo 12 MB; se optimiza en tu navegador.</p><button class="button full lime" data-upload="seo:${key}">Subir ${esc(title.toLowerCase())}</button>${project.patch.seo?.[key]?`<button class="text-btn" data-action="reset-seo:${key}">Restaurar original</button>`:''}</div>`;}
function legalFields(key,title){const legal=project.patch.legal||{},mode=legalModes[key]||(legal[key+'Text']?'text':'url');return `<details class="legal-document" open><summary>${esc(title)}</summary><label class="field"><span>Cómo quieres mostrarlo</span><select data-legal-mode="${key}"><option value="url" ${mode==='url'?'selected':''}>Enlace a mi documento</option><option value="text" ${mode==='text'?'selected':''}>Pegar texto completo</option></select></label>${mode==='url'?`<label class="field"><span>URL del documento</span><input data-legal="${key}Url" value="${esc(legal[key+'Url']||'')}" maxlength="2048" placeholder="https://misitio.com/${key}"><small>También puedes usar un ancla interna. Déjalo vacío para conservar la plantilla.</small></label>`:`<label class="field"><span>Texto aprobado de ${esc(title.toLowerCase())}</span><textarea data-legal="${key}Text" maxlength="30000" rows="10" placeholder="Pega aquí tu documento…">${esc(legal[key+'Text']||'')}</textarea><small>Hasta 30 000 caracteres. Pega únicamente el contenido que quieres publicar.</small></label>`}</details>`;}
function fontSelect(key,label,value){return `<label class="field"><span>${label}</span><select data-font="${key}"><option value="">Fuente original</option>${[['Inter','Moderna · Inter'],['Arial','Neutra · Arial'],['Georgia','Editorial · Georgia'],['Times New Roman','Clásica · Times'],['system-ui','Sistema · Sans']].map(([v,l])=>`<option value="${v}" ${value===v?'selected':''}>${l}</option>`).join('')}</select></label>`;}
function colorLabel(key){const labels={or:'Acento naranja',bk:'Fondo oscuro',wh:'Tono claro',ivory:'Marfil',sand:'Arena',mute:'Texto secundario',stone:'Piedra',linen:'Lino',navy:'Azul noche',base:'Fondo base',bg2:'Fondo secundario',ink2:'Texto secundario',goldD:'Dorado profundo','content--brand':'Color de marca','content--primary':'Texto principal','content--secondary':'Texto secundario',bg:'Fondo principal',background:'Fondo principal',ink:'Texto principal',text:'Texto principal',fg:'Primer plano',accent:'Acento',lime:'Acento lima',cream:'Fondo crema',paper:'Fondo papel',white:'Blanco',black:'Negro',line:'Líneas y bordes',muted:'Texto secundario',soft:'Tono suave',gold:'Acento dorado'};return labels[key.replace(/^--/,'')]||key.replace(/^--/,'').replaceAll('-',' ');}
function toHex(color){try{const c=document.createElement('canvas').getContext('2d');c.fillStyle='#000000';c.fillStyle=color;const v=c.fillStyle;if(/^#[0-9a-f]{6}$/i.test(v))return v;if(/^#[0-9a-f]{3}$/i.test(v))return '#'+[...v.slice(1)].map(c=>c+c).join('');const m=v.match(/[\d.]+/g);if(m?.length>=3)return '#'+m.slice(0,3).map(x=>Math.round(Number(x)).toString(16).padStart(2,'0')).join('');}catch{}return '#000000';}
function contrastHTML(){const colors=inventory.colors.map(c=>({key:c.key,value:project.patch.colors?.[c.key]||c.value}));const bg=colors.find(c=>/^--(bg|background|paper|cream)$/.test(c.key)),fg=colors.find(c=>/^--(text|ink|fg|soft)$/.test(c.key));if(!bg||!fg)return '<p class="hint">Revisa cada fondo con sus textos en la vista previa.</p>';const r=assessContrast(toHex(fg.value),toHex(bg.value));return notice(`Contraste orientativo del texto y fondo principal: ${r.ratio.toFixed(1)}:1. ${r.messages.join(' ')}`,r.level==='good'?'':r.level);}
const MEDIA_ACCEPT=$('#media-file').accept;
function pickUpload(id){uploadTarget=id;$('#media-file').value='';$('#media-file').accept=String(id).startsWith('icon-')?MEDIA_ACCEPT+',image/svg+xml':MEDIA_ACCEPT;$('#media-file').click();}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);}
async function exportProject(){if(!project)return;await flushEdit();download(new Blob([JSON.stringify({format:'ornat-cms',version:1,project},null,2)],{type:'application/json'}),`${project.name.replace(/[^\p{L}\p{N}\- ]/gu,'').replace(/\s+/g,' ').trim()||'mi-proyecto'}-ornat.json`);toast('Copia descargada. Incluye tus imágenes y cambios.');}
function showPrompts(item,{animation=false,reference='',initial='',final=''}={}){promptAnimation=animation;promptSlot=item||allImages()[0]||{width:1920,height:1080,section:'Portada',kind:'image'};const slot=imageSlot(promptSlot),dims=assessImage({width:slot.width*2,height:slot.height*2},slot).recommended;const style=`fotografía arquitectónica editorial hiperrealista, luz natural y materiales físicamente creíbles; coherencia con ${template().name} y su paleta ${inventory.colors.slice(0,3).map(c=>c.value).join(', ')}`;const prompts=buildImagePrompts({section:sectionName(promptSlot.section),brand:project.patch.brand?.name||project.name,style,ratio:slot.width/slot.height,width:dims.width,height:dims.height,animation,referenceDescription:reference||promptSlot.alt||'el proyecto aportado por el usuario',initialDescription:initial||undefined,finalDescription:final||undefined});$('#prompt-content').innerHTML=`${field('Describe tu imagen o proyecto de referencia','prompt-reference',reference||promptSlot.alt||'',{hint:'Adjunta esa imagen al usar el prompt. Puedes cambiar esta descripción.'})}${animation?field('Aspecto de la imagen inicial','prompt-initial-state',initial||'Bosquejo arquitectónico de línea fina, misma perspectiva y geometría')+field('Aspecto de la imagen final','prompt-final-state',final||'Fotografía hiperrealista del proyecto construido, materiales naturales y luz real'):''}${button('Actualizar prompts con mi referencia','update-prompts','full')}<hr class="divider">${notice(`Medida recomendada: ${dims.width} × ${dims.height} px. Adjunta tu imagen de referencia junto al prompt para conservar tu proyecto.`)}${(prompts.requirements||[]).map(x=>`<p class="hint">• ${esc(x)}</p>`).join('')}${[['single','Imagen del módulo'],...(animation?[['initial','Imagen inicial'],['final','Imagen final']]:[])].map(([key,title])=>`<div class="prompt-block"><h3>${title}<button class="text-btn" data-copy-prompt="${key}">Copiar prompt</button></h3><textarea class="prompt-text" id="prompt-${key}" readonly>${esc(prompts[key])}</textarea></div>`).join('')}<p class="legal-note">Los prompts no generan imágenes aquí. Para una secuencia continua, necesitas un video o fotogramas intermedios coherentes; dos imágenes por sí solas no crean un recorrido fluido.</p>`;$('#prompt-dialog').showModal();}

/* ---------- dialogs: projects and templates ---------- */
const templateName=slug=>templates.find(t=>t.slug===slug)?.name||slug;
async function showProjects(){
  try{projectsCache=await listProjects();}catch(e){toast(e.message,true);return;}
  $('#project-template').innerHTML='<option value="">Todas las plantillas</option>'+[...new Set(projectsCache.map(p=>p.template))].map(s=>`<option value="${esc(s)}" ${prjFilter.template===s?'selected':''}>${esc(templateName(s))}</option>`).join('');
  $('#project-sort').innerHTML=PROJECT_SORTS.map(([v,l])=>`<option value="${v}" ${prjFilter.sort===v?'selected':''}>${l}</option>`).join('');
  $('#project-search').value=prjFilter.q;renderProjects();$('#projects-dialog').showModal();
}
function renderProjects(){
  const list=filterProjects(projectsCache,prjFilter,templateName);
  $('#project-count').textContent=`${list.length} de ${projectsCache.length} proyectos`;
  $('#project-clear').hidden=!(prjFilter.q||prjFilter.template||prjFilter.sort!=='recent');
  $('#project-list').innerHTML=list.map(p=>`<div class="project-row"><img src="${esc(templates.find(t=>t.slug===p.template)?.thumbnail||'')}" alt="" loading="lazy"><div><b>${esc(p.name)}</b><small>${esc(templateName(p.template))} · ${new Date(p.updatedAt).toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'})}</small></div><button class="button" data-open-project="${esc(p.id)}">Abrir</button><button class="icon-btn" data-delete-project="${esc(p.id)}" aria-label="Eliminar ${esc(p.name)}">${icon('close')}</button></div>`).join('')||`<p class="muted">${projectsCache.length?'Ningún proyecto coincide con estos filtros.':'Todavía no hay proyectos guardados.'}</p>`;
}
async function showTemplates(){
  await flushEdit();
  $('[data-close="templates-dialog"]').hidden=!project;$('#template-search').value=tplFilter.q;
  $('#template-sort').innerHTML=TEMPLATE_SORTS.map(([v,l])=>`<option value="${v}" ${tplFilter.sort===v?'selected':''}>${l}</option>`).join('');
  renderTemplates();$('#templates-dialog').showModal();$('#template-search').focus();
}
const chipOn=v=>v==='all'?!tplFilter.tags.length:tplFilter.tags.includes(v);
function renderTemplates(){
  $('#template-chips').innerHTML=TEMPLATE_CHIPS.map(([v,l])=>`<button type="button" class="chip" data-tpl-chip="${v}" aria-pressed="${chipOn(v)}">${l} <small>${filterTemplates(templates,{tags:v==='all'?[]:[v]}).length}</small></button>`).join('');
  const list=filterTemplates(templates,tplFilter);
  $('#template-count').textContent=`${list.length} de ${templates.length} plantillas${tplFilter.tags.length?' · filtros: '+tplFilter.tags.map(t=>TEMPLATE_CHIPS.find(c=>c[0]===t)?.[1]||t).join(' + '):''}`;
  $('#template-options').innerHTML=list.map(t=>`<article class="tpl-card ${project?.template===t.slug?'is-current':''}" data-tpl="${esc(t.slug)}"><button type="button" class="tpl-thumb" data-preview-template="${esc(t.slug)}" aria-label="Vista previa de la plantilla ${esc(t.name)}"><img src="${esc(t.thumbnail)}" alt="" loading="lazy"><span class="tpl-peek">Ver plantilla real</span></button><div class="tpl-meta"><b>${esc(t.name)}</b>${project?.template===t.slug?'<em class="tpl-now">En uso</em>':''}<span class="tpl-tags">${templateTags(t).map(x=>`<i>${esc(TAG_LABELS[x])}</i>`).join('')}</span><small>${t.images?.length??0} imágenes · ${t.sections?.length??0} secciones</small><div class="tpl-actions"><button type="button" class="button" data-preview-template="${esc(t.slug)}">Vista previa</button><button type="button" class="button lime" data-choose-template="${esc(t.slug)}" ${project?.template===t.slug?'disabled':''}>Usar</button></div></div></article>`).join('')||'<p class="muted">Ninguna plantilla coincide. Quita algún filtro.</p>';
}
/* hover grande de la galería (solo con ratón) */
const tplHover=document.createElement('div');tplHover.id='tpl-hover';tplHover.hidden=true;tplHover.setAttribute('aria-hidden','true');$('#templates-dialog').append(tplHover);
$('#template-options').addEventListener('pointerover',e=>{
  if(e.pointerType!=='mouse')return;const card=e.target.closest('.tpl-card');if(!card){tplHover.hidden=true;return;}
  const t=templates.find(x=>x.slug===card.dataset.tpl);if(!t)return;
  if(tplHover.dataset.slug!==t.slug){tplHover.dataset.slug=t.slug;tplHover.innerHTML=`<img src="${esc(t.thumbnail)}" alt=""><b>${esc(t.name)}</b><span>${esc(templateTags(t).map(x=>TAG_LABELS[x]).join(' · '))}</span>`;}
  const r=card.getBoundingClientRect(),w=440,h=Math.round(w*.64)+54;let x=r.right+14;if(x+w>innerWidth-10)x=Math.max(10,r.left-w-14);
  tplHover.style.left=x+'px';tplHover.style.top=Math.max(10,Math.min(innerHeight-h-10,r.top))+'px';tplHover.hidden=false;
});
$('#template-options').addEventListener('pointerleave',()=>{tplHover.hidden=true;});
$('#templates-dialog').addEventListener('close',()=>{tplHover.hidden=true;});
/* visor: la plantilla real, antes de elegirla */
const visibleTemplates=()=>filterTemplates(templates,tplFilter);
function layoutViewer(){
  const stage=$('#tpl-viewer-stage'),fr=$('#tpl-viewer-frame');if(!stage||!stage.clientWidth)return;
  const native=viewerDevice==='mobile'?390:1440,scaleV=Math.min(1,(stage.clientWidth-(viewerDevice==='mobile'?0:0))/native),H=stage.clientHeight;
  fr.style.width=native+'px';fr.style.height=(H/scaleV)+'px';fr.style.transform=`scale(${scaleV})`;
  const w=Math.round(native*scaleV);$('#tpl-viewer-shell').style.width=w+'px';$('#tpl-viewer-shell').style.height=H+'px';
}
function openViewer(slug){
  const t=templates.find(x=>x.slug===slug);if(!t)return;viewerSlug=slug;
  $('#tpl-viewer-title').textContent=t.name;
  $('#tpl-viewer-tags').innerHTML=templateTags(t).map(x=>`<i>${esc(TAG_LABELS[x])}</i>`).join('')+`<small>${t.images?.length??0} imágenes · ${t.sections?.length??0} secciones</small>`;
  $('#tpl-viewer-use').dataset.chooseTemplate=slug;$('#tpl-viewer-use').disabled=project?.template===slug;
  $$('#tpl-viewer [data-viewer-device]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.viewerDevice===viewerDevice)));
  const list=visibleTemplates(),i=list.findIndex(x=>x.slug===slug);$('#tpl-viewer-prev').disabled=$('#tpl-viewer-next').disabled=list.length<2;
  $('#tpl-viewer-load').hidden=false;
  const dlg=$('#tpl-viewer');if(!dlg.open)dlg.showModal();
  const fr=$('#tpl-viewer-frame');fr.onload=()=>{$('#tpl-viewer-load').hidden=true;};fr.src=t.src;layoutViewer();setTimeout(layoutViewer,60);
}
function stepViewer(dir){const list=visibleTemplates();if(list.length<2)return;const i=list.findIndex(x=>x.slug===viewerSlug);openViewer(list[(i+dir+list.length)%list.length].slug);}
$('#tpl-viewer').addEventListener('close',()=>{$('#tpl-viewer-frame').src='about:blank';viewerSlug=null;});
new ResizeObserver(()=>layoutViewer()).observe($('#tpl-viewer-stage'));
/* cambiar de plantilla: de cero o llevando el contenido */
async function chooseTemplate(slug){
  const close=()=>{for(const id of ['tpl-viewer','templates-dialog'])if($('#'+id).open)$('#'+id).close();};
  if(!project||!hasContent(project.patch)){close();await newProject(slug);return;}
  if(slug===project.template){close();toast('Ya estás usando esta plantilla.');return;}
  const target=templates.find(t=>t.slug===slug);if(!target)return;
  const {summary}=carryOver(project.patch,inventory.colors||[]),d=describeCarry(summary);
  $('#carry-title').textContent=`Cambiar a «${target.name}»`;
  $('#carry-body').innerHTML=`<p class="muted">Tu proyecto actual se conserva tal cual en «Mis proyectos». ¿Cómo quieres empezar con la nueva plantilla?</p><div class="carry-options"><button type="button" class="carry-option" data-carry="keep" data-carry-slug="${esc(slug)}"><b>Llevar mi contenido</b><span>Pasa a la nueva plantilla lo que no depende de su diseño.</span></button><button type="button" class="carry-option" data-carry="fresh" data-carry-slug="${esc(slug)}"><b>Empezar de cero</b><span>La plantilla nueva, tal como viene.</span></button></div><div class="carry-lists"><div><h3>Se lleva</h3>${d.brought.length?`<ul>${d.brought.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p class="muted">Nada que llevar todavía: solo tienes ediciones propias de esta plantilla.</p>'}</div><div><h3>No se puede llevar</h3><ul>${d.left.map(x=>`<li>${esc(x)}</li>`).join('')||'<li>Nada más.</li>'}</ul><p class="muted">Los textos, fotos y ajustes que editaste directamente en la plantilla anterior no se pueden mapear: cada plantilla tiene su propia estructura. Los módulos insertados se colocan antes del pie de página; arrástralos a su lugar.</p></div></div>`;
  $('#carry-dialog').showModal();$('#carry-body [data-carry="keep"]').focus();
}
async function runCarry(mode,slug){
  $('#carry-dialog').close();for(const id of ['tpl-viewer','templates-dialog'])if($('#'+id).open)$('#'+id).close();
  if(mode==='fresh'){await newProject(slug);return;}
  const out=carryOver(project.patch,inventory.colors||[]);
  await newProject(slug,{...out,from:project.name});
  const brought=describeCarry(out.summary).brought;
  toast(`Contenido llevado a «${templateName(slug)}»${brought.length?': '+brought.slice(0,3).join(', ')+(brought.length>3?'…':''):''}. Los textos de la plantilla anterior no se pueden pasar.`);
}

/* ---------- project lifecycle ---------- */
async function activate(p){
  if(project)await flushEdit();
  if(project&&project.id!==p.id&&revision!==savedRevision&&!(await persist()))return;
  clearTimeout(saveTimer);clearTimeout(applyTimer);project=p;legalModes={};revision=0;savedRevision=-1;history=[];future=[];sel=null;selRect=null;openText=null;openMedia=null;currentSection=null;ready=false;inventory=emptyInventory();
  filters.text={q:'',section:'',type:'',edited:false,hidden:false};filters.media={q:'',section:'',type:'',modified:false,noAlt:false,lowQuality:false,hidden:false};
  $('#project-name').value=project.name;$('#template-label').textContent=template().name;$('#loading').hidden=false;
  $('#loading').innerHTML='<span class="spinner"></span><b>Preparando tu plantilla</b><p>Conservamos su diseño, scroll y animaciones.</p>';
  $('#save-state').textContent='Cargando proyecto…';frame.src=template().src+'?cms=1';
  clearTimeout(loadTimer);loadTimer=setTimeout(()=>{if(ready)return;$('#loading').innerHTML='<div class="loading-error"><b>La plantilla tarda más de lo esperado</b><p>Comprueba tu conexión. El contenido original usa recursos en línea.</p><button class="button" id="retry-template">Reintentar</button></div>';$('#retry-template').onclick=()=>activate(project);},18000);
  toolbar.render();renderSectionNav();setTab(currentTab,{open:false});await persist();ext.onProject();
}
async function newProject(slug,carry=null){const now=new Date().toISOString(),id=uid();const base=carry?.from&&!/^Mi proyecto · /.test(carry.from)?carry.from.replace(/\s·\s[^·]+$/,''):'Mi proyecto';carryKit=carry?.kit?{id,kit:carry.kit}:null;await activate({id,name:base+' · '+templateName(slug),template:slug,patch:carry?.patch||{},createdAt:now,updatedAt:now});}

/* ---------- section navigator ---------- */
function renderSectionNav(){
  const list=navSections(),p=project?.patch||{};
  $('#section-chips').innerHTML=list.map((s,i)=>{const hid=!!p.hidden?.['section:'+s.id];return `<button type="button" class="chip ${hid?'is-off':''}" data-goto-section="${esc(s.id)}" data-chip-section="${esc(s.id)}" ${currentSection===s.id?'aria-current="true"':''} title="${esc(sectionLabel(s.id))}"><small>${i+1}</small>${esc(sectionLabel(s.id).slice(0,26))}</button>`;}).join('')||'<span class="muted">Las secciones aparecerán cuando cargue la plantilla.</span>';
}
function markCurrentSection(){
  $$('[data-chip-section]').forEach(c=>{const on=c.dataset.chipSection===currentSection;if(on)c.setAttribute('aria-current','true');else c.removeAttribute('aria-current');if(on){const nav=$('#section-nav');nav.scrollTo({left:Math.max(0,c.offsetLeft-nav.clientWidth/2+c.offsetWidth/2),behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});}});
  $$('[data-section-row]').forEach(r=>{const on=r.dataset.sectionRow===currentSection;r.classList.toggle('is-current',on);const m=r.querySelector('.row-main');if(on)m.setAttribute('aria-current','true');else m.removeAttribute('aria-current');});
}

/* ---------- actions used by toolbar and panels ---------- */
const hideKey=s=>s.kind==='section'?'section:'+s.section:s.id;
function setHidden(key,on,label=''){
  if(on){update('hidden',key,true);if(label)toast(`Ocultaste «${label}».`,false,{label:'Deshacer',run:undo});}
  else removeKey('hidden',key);
}
function hideSelection(){
  if(!sel?.id)return;
  if(sel.kind==='item'&&sel.item){const it=sel.item;sel=null;selRect=null;toolbar.render();ext.mods.str.delItem(it.listId,it.itemId);return;}
  if(sel.kind==='section'&&sel.blockId){const id=sel.blockId;sel=null;selRect=null;toolbar.render();ext.mods.blk.remove(id);return;}
  const key=hideKey(sel),label=sel.kind==='section'?sectionLabel(sel.section):sel.label;
  setHidden(key,true,label);sel=null;selRect=null;toolbar.render();renderSectionNav();if(['text','media','sections'].includes(currentTab))renderPanel();
}
function mediaItemFor(id){return allImages().find(i=>i.id===id)||{id,kind:sel?.kind==='background'?'background':'image',src:'',alt:sel?.alt||''};}
const ctx={
  getSel:()=>sel,getPatch:()=>project?.patch||{},isTesting:()=>!selecting,reposition:positionToolbar,
  palette:()=>inventory.colors.map(c=>toHex(c.value)).filter(Boolean),
  sectionLabel,validLink:isSafeLink,
  setStyle:(id,props)=>update('styles',id,{...(project.patch.styles?.[id]||{}),...props}),
  unsetStyle:(id,prop)=>{const cur={...(project.patch.styles?.[id]||{})};delete cur[prop];if(Object.keys(cur).length)update('styles',id,cur);else removeKey('styles',id);},
  resetStyle:id=>{const patch={...project.patch};for(const area of ['styles','texts']){if(patch[area]?.[id]!==undefined){patch[area]={...patch[area]};delete patch[area][id];if(!Object.keys(patch[area]).length)delete patch[area];}}replacePatch(patch);},
  hide:hideSelection,
  selectSection:()=>sel&&send('select',{id:'section:'+sel.section}),
  editSection:section=>{filters.text={q:'',section:String(section),type:'',edited:false,hidden:false};openText=null;setTab('text');},
  replace:id=>pickUpload(id),replaceVideo:id=>{videoTarget=id;$('#video-file').value='';$('#video-file').click();},videoPoster:id=>pickUpload('poster:'+id),
  setImage:(id,props)=>{const item=mediaItemFor(id);const base=mediaValue(item);if(!base.src){toast('Esta imagen aún no se puede editar. Espera a que termine de cargar.',true);return;}update('images',id,imageEdit(item,props));},
  setLink:(id,value)=>update('links',id,value),
  itemAction:(act,s)=>{const m=ext.mods.str,it=s?.item;if(!it)return;if(act==='prev'||act==='next')m.moveItem(it.listId,it.itemId,act==='prev'?-1:1);else if(act==='dup')m.dupItem(it.listId,it.itemId);else if(act==='del'){sel=null;selRect=null;toolbar.render();m.delItem(it.listId,it.itemId);}else if(act==='select')send('select',{id:'item:'+it.itemId});},
  sectionAction:(act,s)=>{const m=ext.mods.str,id=s?.layout?.id||s?.section;if(!id)return;if(act==='up'||act==='down')m.moveSection(id,act==='up'?-1:1);else if(act==='dup')m.dupSection(id);else if(act==='del'){sel=null;selRect=null;toolbar.render();m.delSection(id);}else if(act==='style'){m.openFor(id);setTab('structure');send('goto-section',{id});}},
  setButton:(id,props)=>{const cur={...(project.patch.buttons?.[id]||{}),...props};for(const k of Object.keys(cur))if(cur[k]===undefined||cur[k]===null||cur[k]==='')delete cur[k];const map={...(project.patch.buttons||{})};if(Object.keys(cur).length)map[id]=cur;else delete map[id];const next={...project.patch};if(Object.keys(map).length)next.buttons=map;else delete next.buttons;commit(next,'btn:'+id);},
  replaceIcon:id=>pickUpload(id),
  aiStatus,pickLibrary:id=>ext.mods.lib.pick(id),blockAction:(act,id)=>ext.mods.blk.click(act,{dataset:{xid:id}}),
  resetMedia:s=>{if(s.kind==='video'){removeKey('videos',s.id);return;}if(s.kind==='logo'&&project.patch.brand?.logo){const patch={...project.patch,brand:{...project.patch.brand}};delete patch.brand.logo;if(project.patch.images?.[s.id]){patch.images={...patch.images};delete patch.images[s.id];}replacePatch(patch);return;}removeKey('images',s.id);}
};
const toolbar=createToolbar($('#float-toolbar'),ctx);
let blockIssuesCache=[];
function sendMode(){const m=ext.mode();send('mode',{selecting:m.selecting,commenting:m.commenting});}
function touch(){if(!project)return;revision++;$('#save-state').textContent='Cambios sin guardar…';clearTimeout(saveTimer);saveTimer=setTimeout(persist,400);}
function commit(next,group){if(!project)return false;if(!ext.canEdit()){ext.denied();return false;}if(!guardSize(next))return false;if(lastEdit.key!==group||Date.now()-lastEdit.time>850)pushHistory();project.patch=next;changed(group);return true;}
// Aplica una imagen (de la biblioteca o de otro hueco) a un hueco del sitio, a un bloque, al logo o a una imagen SEO.
function applyImage(target,src,alt='',meta=null){
  const p={...project.patch};
  const entry=meta?{width:meta.width,height:meta.height,bytes:meta.bytes||0,type:meta.type||'',name:meta.name||'',hasAlpha:meta.hasAlpha}:null;
  if(target==='brandLogo'||inventory.logos.some(l=>l.id===target)){p.brand={...p.brand,logo:src};if(entry)p.mediaMeta={...p.mediaMeta,brandLogo:entry};}
  else if(target.startsWith('seo:')){p.seo={...p.seo,[target.slice(4)]:src};}
  else if(target.startsWith('secbg:')){const sid=target.slice(6);p.sectionStyles={...p.sectionStyles,[sid]:{...p.sectionStyles?.[sid],bgImage:{src,position:'50% 50%',fit:'cover'}}};}
  else{const item=mediaItemFor(target);p.images={...p.images,[target]:{src,alt:alt||item.alt||'',fit:item.kind==='logo'?'contain':'cover',position:'50% 50%'}};if(entry)p.mediaMeta={...p.mediaMeta,[target]:entry};}
  return replacePatch(p);
}
const host={
  $,$$,esc,icon,toast,tabs,panels:PANELS,
  get project(){return project;},get patch(){return project?.patch||{};},get inventory(){return inventory;},get sel(){return sel;},get ready(){return ready;},
  get currentTab(){return currentTab;},get currentSection(){return currentSection;},get selecting(){return selecting;},get template(){return template();},get templates(){return templates;},
  update,replacePatch,removeKey,send,renderPanel,setTab,setDrawer,undo,sectionLabel,persist:saveNow,flushEdit,touch,commit,sendMode,applyImage,allImages,lowQuality,
  setImage:(id,props)=>ctx.setImage(id,props),pickUpload:id=>pickUpload(id),blockIssues:()=>blockIssuesCache
};
const ext=createExt(host);
const basePanels={...PANELS};
PANELS.design=()=>ext.canEdit()?basePanels.design():ext.readOnlyIntro();
PANELS.text=()=>ext.lang==='en'?ext.mods.lang.translationsHTML():basePanels.text();
PANELS.brand=()=>basePanels.brand()+ext.extra('brand');
PANELS.site=()=>'<h3 class="section-title">Vista previa y páginas</h3>'+ext.extra('site')+'<hr class="divider">'+basePanels.site();
PANELS.export=()=>basePanels.export()+ext.extra('export');

async function action(name){
  if(name==='more-texts'){textLimit+=120;renderPanel();}
  if(name.startsWith('reset-seo:')){const key=name.slice(10),patch={...project.patch,seo:{...project.patch.seo}};delete patch.seo[key];replacePatch(patch);}
  if(name==='templates')showTemplates();if(name==='projects')await showProjects();if(name==='new')showTemplates();
  if(name==='import'){$('#import-file').value='';$('#import-file').click();}
  if(name==='export-json')await exportProject();
  if(name==='export-html'){if(!ready){toast('Espera a que cargue la plantilla.',true);return;}await flushEdit();send('mode',{selecting:false});send('export');}
  if(name==='logo')pickUpload('brandLogo');
  if(name==='reset-logo'){const p={...project.patch,brand:{...project.patch.brand}};delete p.brand.logo;replacePatch(p);}
  if(name==='rescan')send('request-inventory');
  if(name==='reset-style'){const p={...project.patch};delete p.colors;delete p.typography;replacePatch(p);}
  if(name==='sequence'){$('#sequence-files').value='';$('#sequence-files').click();}
  if(name==='reset-sequence'){const p={...project.patch};delete p.sequences;replacePatch(p);}
  if(name==='guide-prompt')showPrompts(allImages().find(i=>i.id===$('#guide-slot').value));
  if(name==='pair-prompt')showPrompts(allImages()[0],{animation:true});
  if(name==='sequence-prompt')showPrompts({width:1920,height:1080,ratio:16/9,section:'Recorrido arquitectónico',alt:'Mismo proyecto, cámara continua y materiales constantes'},{animation:true});
}

/* ---------- panel events ---------- */
panel.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;const d=b.dataset;
  if('textType' in d){filters.text.type=d.textType;textLimit=80;renderPanel();return;}
  if('textEdited' in d){filters.text.edited=!filters.text.edited;renderPanel();return;}
  if('textHidden' in d){filters.text.hidden=!filters.text.hidden;renderPanel();return;}
  if('clearText' in d){filters.text={q:'',section:'',type:'',edited:false,hidden:false};textLimit=80;renderPanel();return;}
  if('mediaType' in d){filters.media.type=d.mediaType;renderPanel();return;}
  if('mediaModified' in d){filters.media.modified=!filters.media.modified;renderPanel();return;}
  if('mediaNoalt' in d){filters.media.noAlt=!filters.media.noAlt;renderPanel();return;}
  if('mediaLow' in d){filters.media.lowQuality=!filters.media.lowQuality;renderPanel();return;}
  if('mediaHidden' in d){filters.media.hidden=!filters.media.hidden;renderPanel();return;}
  if('clearMedia' in d){filters.media={q:'',section:'',type:'',modified:false,noAlt:false,lowQuality:false,hidden:false};renderPanel();return;}
  if(d.pickText){openText=openText===d.pickText&&sel?.id!==d.pickText?null:d.pickText;navPick=openText?{id:openText,at:Date.now()}:null;send('navigate',{id:d.pickText});renderPanel();revealSelectedRow();return;}
  if(d.pickMedia){openMedia=openMedia===d.pickMedia&&sel?.id!==d.pickMedia?null:d.pickMedia;send('navigate',{id:d.pickMedia});renderPanel();revealSelectedRow();return;}
  if(d.toggleHide){const key=d.toggleHide,hid=!!project.patch.hidden?.[key];setHidden(key,!hid,hid?'':(inventory.texts.find(t=>t.id===key)?.text||'elemento').slice(0,30));renderPanel();return;}
  if(d.toggleSection){const key='section:'+d.toggleSection,hid=!!project.patch.hidden?.[key];setHidden(key,!hid,hid?'':sectionLabel(d.toggleSection));renderSectionNav();renderPanel();return;}
  if(d.editSectionTexts){ctx.editSection(d.editSectionTexts);return;}
  if(d.gotoSection){gotoSection(d.gotoSection);return;}
  if(d.resetText){const id=d.resetText,patch={...project.patch};for(const area of ['texts','styles','links']){if(patch[area]?.[id]!==undefined){patch[area]={...patch[area]};delete patch[area][id];if(!Object.keys(patch[area]).length)delete patch[area];}}replacePatch(patch);return;}
  if(d.chooseTemplate){chooseTemplate(d.chooseTemplate);return;}
  if(d.tabFilter){filters.text={q:'',section:'',type:d.tabFilter,edited:false,hidden:false};setTab('text');return;}
  if(d.tab){setTab(d.tab);return;}
  if(d.action)action(d.action);
  if(d.upload)pickUpload(d.upload);
  if(d.videoUpload){videoTarget=d.videoUpload;$('#video-file').value='';$('#video-file').click();}
  if(d.videoPoster)pickUpload('poster:'+d.videoPoster);
  if(d.videoReset)removeKey('videos',d.videoReset);
  if(d.prompt)showPrompts(allImages().find(i=>i.id===d.prompt));
  if(d.locate)send('navigate',{id:d.locate});
  if(d.resetImage)removeKey('images',d.resetImage);
});
function gotoSection(id){
  if(project.patch.hidden?.['section:'+id]){toast('Esa sección está oculta. Muéstrala con el ojo del panel Secciones.');return;}
  send('goto-section',{id});if(matchMedia('(max-width:800px)').matches)setDrawer(false);
}
panel.addEventListener('input',e=>{
  const el=e.target;
  if(el.matches('[data-text-search]')){filters.text.q=el.value;textLimit=80;renderPanel();return;}
  if(el.matches('[data-media-search]')){filters.media.q=el.value;renderPanel();return;}
  if(el.dataset.legal){const key=el.dataset.legal;if(key.endsWith('Url')&&!validSiteURL(el.value,true)){el.setCustomValidity('Usa una URL HTTP/HTTPS o un ancla como #privacidad.');return;}el.setCustomValidity('');update('legal',key,el.value);}
  if(el.dataset.videoUrl){if(isSafeLink(el.value))update('videos',el.dataset.videoUrl,{...project.patch.videos?.[el.dataset.videoUrl],src:el.value});}
  if(el.dataset.text)update('texts',el.dataset.text,el.value);
  if(el.dataset.link){if(!isSafeLink(el.value)){el.setCustomValidity('Usa https://, correo, teléfono o un ancla válida.');return;}el.setCustomValidity('');update('links',el.dataset.link,el.value);}
  if(el.dataset.mediaAlt){const id=el.dataset.mediaAlt;update('images',id,imageEdit(mediaItemFor(id),{alt:el.value}));}
  if(el.dataset.position){const id=el.dataset.position,val=imageEdit(mediaItemFor(id)),xy=(val.position||'50% 50%').match(/[\d.]+/g)||['50','50'];xy[Number(el.dataset.axis)]=el.value;el.closest('label').querySelector('output').textContent=el.value+'%';const pos=xy.map(n=>n+'%').join(' ');update('images',id,{...val,position:pos});const img=el.closest('.media-card').querySelector('.media-picture img');if(img)img.style.objectPosition=pos;}
  if(el.dataset.color||el.dataset.colorText){const key=el.dataset.color||el.dataset.colorText,value=el.value;if(!/^#[0-9a-f]{6}$/i.test(value))return;update('colors',key,value);$$('[data-color],[data-color-text]').filter(x=>(x.dataset.color||x.dataset.colorText)===key&&x!==el).forEach(x=>x.value=value);$('#contrast-notice').innerHTML=contrastHTML();}
});
panel.addEventListener('change',e=>{
  const el=e.target;
  if(el.matches('[data-text-section]')){filters.text.section=el.value;textLimit=80;renderPanel();return;}
  if(el.matches('[data-media-section]')){filters.media.section=el.value;renderPanel();return;}
  if(el.dataset.fit){const id=el.dataset.fit;update('images',id,imageEdit(mediaItemFor(id),{fit:el.value}));const img=el.closest('.media-card').querySelector('.media-picture img');if(img)img.style.objectFit=el.value;}
  if(el.dataset.font)update('typography',el.dataset.font,el.value);
  if(el.dataset.legalMode){const key=el.dataset.legalMode,mode=el.value;legalModes[key]=mode;const patch={...project.patch,legal:{...project.patch.legal}};if(mode==='text')patch.legal[key+'Url']='';else patch.legal[key+'Text']='';replacePatch(patch);}
});

/* ---------- uploads ---------- */
$('#media-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{toast('Preparando tu imagen…');const posterId=uploadTarget?.startsWith('poster:')?uploadTarget.slice(7):null;const seoKey=uploadTarget?.startsWith('seo:')?uploadTarget.slice(4):null;const item=allImages().find(i=>i.id===uploadTarget),isLogo=uploadTarget==='brandLogo'||item?.kind==='logo'||(sel?.id===uploadTarget&&sel.kind==='logo'),isIcon=item?.kind==='icon'||String(uploadTarget).startsWith('icon-'),secId=uploadTarget?.startsWith('secbg:')?uploadTarget.slice(6):null,media=isIcon?await readIcon(file):await readMedia(file,{logo:isLogo||seoKey==='favicon',maxDimension:seoKey==='favicon'?512:seoKey==='ogImage'?1200:3840});if(!seoKey)ext.mods.lib.add(media,{logo:isLogo});const {src,...meta}=media;const patch={...project.patch,mediaMeta:{...project.patch.mediaMeta,[uploadTarget]:meta}};if(seoKey)patch.seo={...project.patch.seo,[seoKey]:src};else if(posterId)patch.videos={...project.patch.videos,[posterId]:{...project.patch.videos?.[posterId],poster:src}};else if(uploadTarget==='brandLogo')patch.brand={...project.patch.brand,logo:src};else if(secId)patch.sectionStyles={...project.patch.sectionStyles,[secId]:{...project.patch.sectionStyles?.[secId],bgImage:{src,position:'50% 50%',fit:'cover'}}};else patch.images={...project.patch.images,[uploadTarget]:{src,alt:item?.alt||sel?.alt||file.name,fit:isLogo||isIcon?'contain':'cover',position:'50% 50%'}};if(replacePatch(patch)){if(seoKey){const ratio=media.width/media.height;if(seoKey==='favicon'&&Math.abs(ratio-1)>.05)toast('Favicon aplicado. Usa una imagen cuadrada de 512 × 512 px para que se lea mejor.',true);else if(seoKey==='ogImage'&&Math.abs(ratio-1200/630)>.12)toast('Imagen social aplicada. Recomendamos proporción 1200 × 630 px para evitar recortes.',true);else toast('Imagen del sitio actualizada.');}else toast('Imagen aplicada. Revisa el encuadre en escritorio y móvil.');}}catch(error){toast(error.message,true);}});
$('#sequence-files').addEventListener('change',async e=>{const files=[...e.target.files].sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));if(!files.length)return;if(files.length>300){toast('Selecciona hasta 300 fotogramas por secuencia.',true);return;}try{const estimate=await storageEstimate();if(estimate.available!==null&&files.reduce((s,f)=>s+f.size,0)*1.5>estimate.available)throw new Error('Puede faltar espacio para esta secuencia. Usa WebP más ligeros o exporta tus proyectos antes.');const frames=[];let usedBytes=projectByteSize({...project,patch:{...project.patch,sequences:{}}});for(let i=0;i<files.length;i++){const media=await readMedia(files[i],{maxDimension:1920,quality:.78});usedBytes+=media.src.length;if(usedBytes>MAX_PROJECT_BYTES-100000)throw new Error('La secuencia supera 72 MB. Reduce el peso de los fotogramas y vuelve a intentarlo.');frames.push(media.src);if(i%5===0)toast(`Preparando fotogramas ${i+1} / ${files.length}…`);}if(replacePatch({...project.patch,sequences:{...project.patch.sequences,'canvas-frames':{frames}}}))toast(`${frames.length} fotogramas aplicados en orden. ${frames.length<300?'Una secuencia de 300 da mayor continuidad.':''}`);}catch(error){toast(error.message,true);}});
$('#import-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>80*1024*1024)throw new Error('El proyecto supera 80 MB.');const p=parseProjectFile(await file.text());if(!templates.some(t=>t.slug===p.template))throw new Error('La plantilla de este proyecto no está disponible.');p.id=uid();await activate(p);toast('Proyecto importado en este navegador.');}catch(error){toast(error.message,true);}});
$('#video-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{toast('Preparando tu video…');const media=await readVideo(file);const {src,...meta}=media;if(replacePatch({...project.patch,videos:{...project.patch.videos,[videoTarget]:{...project.patch.videos?.[videoTarget],src}},mediaMeta:{...project.patch.mediaMeta,[videoTarget]:meta}}))toast('Video aplicado. Comprueba su reproducción y portada.');}catch(error){toast(error.message,true);}});

/* ---------- messages from the canvas ---------- */
// La og:image de muchas plantillas es relativa a su sitio original (template.remote): el archivo no está en /templates/<id>/
// ni en /cms/, donde el panel la mostraría. Se resuelve contra ese origen; sin él, contra la carpeta de la plantilla.
function templateAsset(url){const t=template();if(!url||!t)return url;try{return new URL(url,t.remote||new URL(t.src,location.origin)).href;}catch{return url;}}
function selectionHint(){
  if(!sel?.id){$('#selection-hint').textContent='Haz clic en cualquier elemento para editarlo. Doble clic para escribir.';return;}
  const hints={section:'Sección seleccionada · Supr la oculta · «Editar todos sus textos» en la barra.',image:'Foto seleccionada · arrástrala para reencuadrar.',background:'Fondo seleccionado · arrástralo para reencuadrar.',logo:'Logo seleccionado · reemplázalo desde la barra.',video:'Video seleccionado · reemplázalo desde la barra.',icon:'Ícono seleccionado · reemplázalo desde la barra.',item:'Elemento repetido seleccionado · duplícalo, muévelo o quítalo desde la barra.'};
  $('#selection-hint').textContent=sel.editable?`${sel.label} seleccionado · doble clic o Enter para escribir · Supr oculta.`:hints[sel.kind]||`${sel.label} seleccionado.`;
}
function onSelected(m){
  const had=sel?.id;
  // Al abrir una fila, el lienzo puede seleccionar el bloque que contiene ese texto: la fila elegida sigue abierta.
  const picked=navPick&&Date.now()-navPick.at<1500?navPick.id:null;navPick=null;
  sel=m.id?m:null;if(!sel)selRect=null;else{openText=picked;openMedia=null;}
  selectionHint();toolbar.closePop();toolbar.render();positionToolbar();
  if(['text','media'].includes(currentTab)&&(sel?.id||had))renderPanel();
  if(sel?.id)revealSelectedRow();
}
window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==frame.contentWindow||e.data?.channel!=='ornat-cms')return;const m=e.data;
  if(m.type==='applied')blockIssuesCache=m.issues||[];
  ext.message(m);
  if(m.type==='ready'||m.type==='inventory'){
    inventory={...inventory,...m.inventory};if(inventory.seo?.ogImage)inventory.seo={...inventory.seo,ogImage:templateAsset(inventory.seo.ogImage)};
    if(!ready){ready=true;clearTimeout(loadTimer);$('#loading').hidden=true;send('apply',{patch:project.patch});sendMode();send('analytics-mode',{enabled:consent()});lastViewScale=0;layoutPreview();
      if(carryKit&&carryKit.id===project.id){const kit=carryKit.kit;carryKit=null;try{const r=applyKit(project.patch,kit,{logo:false,name:false,fonts:false,colors:true},(m.inventory?.colors||[]).map(c=>c.key));if(r.changed.length){project.patch=r.patch;changed('carry-colors');}}catch{}}
    }
    else send('apply',{patch:project.patch});
    renderSectionNav();markCurrentSection();renderPanel();
  }
  if(m.type==='analytics-event')heatEvent(m.event);
  if(m.type==='selected')onSelected(m);
  if(m.type==='info'&&sel?.id===m.id){sel={...sel,...m};toolbar.render();}
  if(m.type==='rect'){selRect=m.rect;selVp={vw:m.vw,vh:m.vh};positionToolbar();}
  if(m.type==='current-section'){currentSection=m.id;markCurrentSection();}
  if(m.type==='edit-state'){if(m.editing)$('#selection-hint').textContent='Escribiendo · Enter confirma · Esc cancela.';else selectionHint();}
  if(m.type==='text-edit'){if(ext.lang==='en')ext.mods.lang.saveEnglishEdits(m.edits);else{const texts={...project.patch.texts,...m.edits};replacePatch({...project.patch,texts});}}
  if(m.type==='edit-committed')editCommitted(m);
  if(m.type==='image-position'){const item=mediaItemFor(m.id);if(mediaValue(item).src)update('images',m.id,imageEdit(item,{position:m.position,fit:'cover'}));}
  if(m.type==='key')shortcut(m.key);
  if(m.type==='notification')toast(m.message,m.level==='error');
  if(m.type==='export'){download(new Blob([m.html],{type:'text/html;charset=utf-8'}),`ornat-${project.template}-personalizado.html`);sendMode();toast('HTML descargado. Sus recursos originales requieren conexión.');}
});
function shortcut(key){
  if(key==='undo')undo();else if(key==='redo')redo();else if(key==='save'){saveNow();toast('Guardado en este navegador.');}else if(key==='hide')hideSelection();
}

/* ---------- top bar, dialogs and global events ---------- */
document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b||b.closest('#panel')||b.closest('#float-toolbar'))return;const d=b.dataset;
  if(d.tab){const same=currentTab===d.tab&&$('#workspace').dataset.drawer==='open';if(same){setDrawer(false);return;}setTab(d.tab);return;}
  if(d.close&&!(d.close==='templates-dialog'&&!project))$('#'+d.close).close();
  if(d.chooseTemplate){await chooseTemplate(d.chooseTemplate);return;}
  if(d.previewTemplate){openViewer(d.previewTemplate);return;}
  if(d.viewerDevice){viewerDevice=d.viewerDevice;$$('#tpl-viewer [data-viewer-device]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.viewerDevice===viewerDevice)));layoutViewer();return;}
  if(d.viewerStep){stepViewer(Number(d.viewerStep));return;}
  if(d.carry){await runCarry(d.carry,d.carrySlug);return;}
  if(d.tplChip){const v=d.tplChip;if(v==='all')tplFilter.tags=[];else tplFilter.tags=tplFilter.tags.includes(v)?tplFilter.tags.filter(x=>x!==v):[...tplFilter.tags,v];renderTemplates();}
  if(d.openProject){const p=await loadProject(d.openProject);if(p){$('#projects-dialog').close();await activate(p);}}
  if(d.deleteProject&&confirm('¿Eliminar este proyecto de este navegador? Descarga una copia antes si quieres conservarlo.')){await deleteProject(d.deleteProject);projectsCache=await listProjects();renderProjects();}
  if(d.action==='update-prompts'){const config={animation:promptAnimation,reference:$('#prompt-reference').value,initial:$('#prompt-initial-state')?.value||'',final:$('#prompt-final-state')?.value||''};$('#prompt-dialog').close();showPrompts(promptSlot,config);}
  if(d.copyPrompt){const el=$('#prompt-'+d.copyPrompt);try{await navigator.clipboard.writeText(el.value);toast('Prompt copiado. Adjunta también tu referencia.');}catch{el.select();toast('Selecciona y copia el texto del prompt.');}}
  if(d.device)setDevice(d.device);
  if(d.gotoSection&&b.closest('#section-nav'))gotoSection(d.gotoSection);
});
$('#prompt-dialog').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;if(d.action==='update-prompts'||d.copyPrompt)return;});
$('#template-search').addEventListener('input',e=>{tplFilter.q=e.target.value;renderTemplates();});
$('#template-sort').addEventListener('change',e=>{tplFilter.sort=e.target.value;renderTemplates();});
$('#project-search').addEventListener('input',e=>{prjFilter.q=e.target.value;renderProjects();});
$('#project-template').addEventListener('change',e=>{prjFilter.template=e.target.value;renderProjects();});
$('#project-sort').addEventListener('change',e=>{prjFilter.sort=e.target.value;renderProjects();});
$('#project-clear').addEventListener('click',()=>{prjFilter.q='';prjFilter.template='';prjFilter.sort='recent';$('#project-search').value='';$('#project-template').value='';$('#project-sort').value='recent';renderProjects();});
$('#select-mode').addEventListener('click',()=>{
  selecting=!selecting;const b=$('#select-mode');b.setAttribute('aria-pressed',String(!selecting));b.setAttribute('aria-label',selecting?'Probar el sitio':'Seguir editando');b.querySelector('span').textContent=selecting?'Probar':'Seguir editando';b.querySelector('use').setAttribute('href',selecting?'#i-play':'#i-pencil');
  $('#selection-hint').textContent=selecting?'Haz clic en cualquier elemento para editarlo. Doble clic para escribir.':'Modo prueba: recorre el sitio y abre sus menús. Los formularios no envían datos.';
  if(!selecting){sel=null;selRect=null;if(ext.commenting)ext.setCommenting(false);}
  sendMode();send('analytics-mode',{enabled:consent()});if(!selecting)send('request-inventory');toolbar.render();
});
$('#change-template').onclick=showTemplates;$('#export-project').onclick=exportProject;$('#undo').onclick=undo;$('#redo').onclick=redo;
$('#privacy-note').onclick=()=>toast('Las imágenes subidas y los proyectos se quedan en este navegador. Las fotos originales de las plantillas se cargan desde sus sitios públicos.');
$('#project-name').addEventListener('input',e=>{if(!project)return;project.name=e.target.value.trim()||'Mi proyecto';changed('project.name');});
$('#zoom-in').onclick=()=>{const cur=Math.round(scale*100);setZoom(ZOOMS.find(z=>z>cur+.5)||ZOOMS.at(-1));};
$('#zoom-out').onclick=()=>{const cur=Math.round(scale*100);setZoom([...ZOOMS].reverse().find(z=>z<cur-.5)||ZOOMS[0]);};
$('#zoom-fit').onclick=()=>setZoom('fit');$('#zoom-label').onclick=()=>setZoom('fit');
$('#drawer-close').onclick=()=>setDrawer(false);$('#drawer-open').onclick=()=>setDrawer(true);
document.addEventListener('keydown',e=>{
  const field=e.target instanceof Element&&e.target.closest('input,textarea,select,[contenteditable="true"]'),mod=e.ctrlKey||e.metaKey,k=e.key.toLowerCase();
  if(document.querySelector('dialog[open]')&&!(mod&&k==='s'))return;
  if(mod&&k==='s'){e.preventDefault();shortcut('save');return;}
  if(field)return;
  if(mod&&k==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}
  if(mod&&k==='y'){e.preventDefault();redo();return;}
  if(!sel?.id||!selecting||mod||e.altKey)return;
  const onButton=e.target instanceof Element&&e.target.closest('button,a,summary');
  if((e.key==='Delete'||e.key==='Backspace')&&!onButton){e.preventDefault();hideSelection();}
  else if(e.key==='Escape'){if(toolbar.popOpen)toolbar.closePop();else send('deselect');}
  else if(e.key==='Enter'&&sel.editable&&!onButton){e.preventDefault();send('edit-selected');}
  else if((e.key==='ArrowDown'||e.key==='ArrowUp')&&!onButton){e.preventDefault();send('step',{dir:e.key==='ArrowDown'?1:-1});}
});
window.addEventListener('beforeunload',e=>{if(project&&revision!==savedRevision){persist();e.preventDefault();e.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&project&&revision!==savedRevision)persist();});
new ResizeObserver(()=>requestAnimationFrame(layoutPreview)).observe($('#canvas-scroll'));
$('#canvas-scroll').addEventListener('scroll',positionToolbar,{passive:true});
$('#templates-dialog').addEventListener('cancel',e=>{if(!project)e.preventDefault();});
async function init(){
  try{
    await ext.init();
    const response=await fetch('templates-manifest.json');if(!response.ok)throw new Error('No se pudo cargar el catálogo de plantillas.');templates=(await response.json()).templates;
    try{await openStore();}catch(e){storageAvailable=false;toast(e.message,true);}
    const params=new URLSearchParams(location.search),slug=params.get('template');
    if(!templates.some(t=>t.slug===slug)){$('#save-state').textContent='Elige una plantilla para empezar';$('#loading').hidden=true;
      if(storageAvailable&&!slug){const list=await listProjects();let last;try{last=localStorage.getItem('ornat-cms-last');}catch{}const existing=list.find(p=>p.id===last&&templates.some(t=>t.slug===p.template))||list.find(p=>templates.some(t=>t.slug===p.template));if(existing){await activate(existing);return;}}
      showTemplates();return;}
    let existing=null;
    if(storageAvailable){const list=await listProjects();existing=list.find(p=>p.template===slug&&templates.some(t=>t.slug===p.template))||null;}
    if(existing)await activate(existing);else await newProject(slug);
  }catch(error){$('#save-state').textContent='No se pudo iniciar';$('#loading').innerHTML='<b>No se pudo abrir el editor</b><p>Recarga la página o comprueba tu conexión.</p>';toast(error.message,true);}
}
if(matchMedia('(max-width:800px)').matches){device='mobile';$$('button[data-device]').forEach(b=>{const active=b.dataset.device==='mobile';b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});$('#workspace').dataset.drawer='closed';}
init();
window.addEventListener('storage',()=>send('analytics-mode',{enabled:consent()}));
// Read-only handle for automated checks of the editor state.
window.__ornatCms={get ext(){return ext;},get project(){return project;},get sel(){return sel;},get inventory(){return inventory;},get scale(){return scale;}};
