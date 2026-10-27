// Inventario de propiedades: CRUD sobre la capa de datos compartida, respetando permisos.
import {PROPERTY_TYPES,OPERATIONS,PROPERTY_STATUSES} from '../shared/data.js';
import {setCtx,$,esc,btn,fld,sel2,mxn,num,pill,leadOptions} from './ui-common.js';

let C,f={q:'',operation:'',type:'',status:'',city:'',min:'',max:'',beds:'',sort:'recent'},mode='cards';
export const init=c=>{C=c;setCtx(c);};
const S=()=>C.getState();
const SORTS={recent:'Más recientes',priceAsc:'Precio: menor a mayor',priceDesc:'Precio: mayor a menor',title:'Nombre A–Z'};
const fold=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const price=p=>p.price===null?'Precio a consultar':`$${num(p.price)} ${p.currency}${p.operation==='renta'?' / mes':''}`;
const interested=p=>(p.leadIds||[]).map(id=>S().leads.find(l=>l.id===id)).filter(Boolean);
const STATUS_CLS={disponible:'won',apartado:'contacted',vendido:'proposal',rentado:'proposal'};

export function filterProps(list,flt=f){
 const q=fold(flt.q).split(/\s+/).filter(Boolean),min=flt.min===''?null:Number(flt.min),max=flt.max===''?null:Number(flt.max),beds=flt.beds===''?null:Number(flt.beds);
 const out=list.filter(p=>{
  if(flt.operation&&p.operation!==flt.operation)return false;if(flt.type&&p.type!==flt.type)return false;if(flt.status&&p.status!==flt.status)return false;
  if(flt.city&&fold(p.city)!==fold(flt.city))return false;
  if(min!==null&&(p.price===null||p.price<min))return false;if(max!==null&&(p.price===null||p.price>max))return false;
  if(beds!==null&&(p.bedrooms===null||p.bedrooms<beds))return false;
  if(q.length){const h=fold(`${p.title} ${p.zone} ${p.city} ${p.development} ${p.description} ${(p.features||[]).join(' ')}`);for(const t of q)if(!h.includes(t))return false;}
  return true;});
 const by={recent:(a,b)=>b.createdAt.localeCompare(a.createdAt),priceAsc:(a,b)=>(a.price??Infinity)-(b.price??Infinity),priceDesc:(a,b)=>(b.price??-1)-(a.price??-1),title:(a,b)=>a.title.localeCompare(b.title,'es')};
 return out.sort(by[flt.sort]||by.recent);
}

export function render(){
 const all=C.properties(),list=filterProps(all),edit=C.canProp('edit'),status=C.canProp('status'),cities=[...new Set(all.map(p=>p.city).filter(Boolean))].sort();
 const demo=all.filter(p=>p.source==='demo').length;
 $('#content').innerHTML=`${!C.data()?'<div class="notice warn">La capa de datos compartida no está disponible: no se pueden leer las propiedades.</div>':''}
 ${demo?`<div class="notice demo-notice" role="note"><b>Hay ${demo} propiedades de ejemplo.</b> Están marcadas y puedes quitarlas sin tocar las reales. ${edit?btn('Quitar ejemplos','prop-clear-demo','small'):''}</div>`:''}
 ${!edit&&C.data()?`<div class="notice">Tu rol puede ${status?'cambiar el estado de las propiedades':'ver el inventario'}, pero no crear ni editar fichas.</div>`:''}
 <div class="crm-bar"><label class="searchbox"><span class="sr-only">Buscar propiedades</span><input type="search" id="pr-q" placeholder="Buscar nombre, zona, ciudad, amenidad…" value="${esc(f.q)}"></label>
 <label class="sortbox"><span class="sr-only">Ordenar</span><select id="pr-sort" aria-label="Ordenar">${Object.entries(SORTS).map(([k,t])=>`<option value="${k}" ${f.sort===k?'selected':''}>${t}</option>`).join('')}</select></label>
 <div class="seg" role="group" aria-label="Tipo de vista"><button type="button" data-action="prop-mode" data-mode="cards" aria-pressed="${mode==='cards'}">Tarjetas</button><button type="button" data-action="prop-mode" data-mode="table" aria-pressed="${mode==='table'}">Tabla</button></div></div>
 <div class="filter-panel" style="display:block"><div class="filter-grid">
  <label class="field"><span>Operación</span><select id="pr-op"><option value="">Todas</option>${Object.entries(OPERATIONS).map(([k,t])=>`<option value="${k}" ${f.operation===k?'selected':''}>${t}</option>`).join('')}</select></label>
  <label class="field"><span>Tipo</span><select id="pr-type"><option value="">Todos</option>${Object.entries(PROPERTY_TYPES).map(([k,t])=>`<option value="${k}" ${f.type===k?'selected':''}>${t}</option>`).join('')}</select></label>
  <label class="field"><span>Estado</span><select id="pr-status"><option value="">Todos</option>${Object.entries(PROPERTY_STATUSES).map(([k,t])=>`<option value="${k}" ${f.status===k?'selected':''}>${t}</option>`).join('')}</select></label>
  <label class="field"><span>Ciudad</span><select id="pr-city"><option value="">Todas</option>${cities.map(c=>`<option ${f.city===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label>
  <label class="field"><span>Precio mín.</span><input id="pr-min" type="number" min="0" value="${esc(f.min)}"></label>
  <label class="field"><span>Precio máx.</span><input id="pr-max" type="number" min="0" value="${esc(f.max)}"></label>
  <label class="field"><span>Recámaras (mín.)</span><input id="pr-beds" type="number" min="0" value="${esc(f.beds)}"></label>
  <div class="field"><span>&nbsp;</span>${btn('Limpiar filtros','prop-clear','small')}</div></div></div>
 <div class="crm-bar">${edit?btn(`Cargar propiedades de ejemplo`,'prop-seed','small'):''}<a class="btn small" href="../propiedades/" target="_blank" rel="noopener noreferrer">Abrir catálogo público ↗</a></div>
 <p class="crm-count" role="status" aria-live="polite"><b>${list.length}</b> de ${all.length} propiedades</p>
 ${!list.length?`<section class="card">${C.empty(all.length?'Ninguna propiedad coincide':'Tu inventario está vacío',all.length?'Prueba quitar algún filtro.':'Crea tu primera propiedad o carga fichas de ejemplo para explorar.',edit?btn('＋ Nueva propiedad','new-prop','small'):'')}</section>`:mode==='cards'?`<div class="prop-grid">${list.map(card).join('')}</div>`:tableHTML(list)}`;
}
function statusControl(p){
 if(!C.canProp('status'))return pill(PROPERTY_STATUSES[p.status],STATUS_CLS[p.status]);
 return `<label class="move prop-status"><span class="sr-only">Estado de ${esc(p.title)}</span><select data-prop-status="${esc(p.id)}">${Object.entries(PROPERTY_STATUSES).map(([k,t])=>`<option value="${esc(k)}" ${p.status===k?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`;
}
function card(p){
 const n=interested(p).length;
 return `<article class="prop-card"><div class="prop-img">${/^(https:|\/(?!\/)|data:image\/(png|jpe?g|webp|gif|avif);base64,)/i.test(p.images[0]||'')?`<img src="${esc(p.images[0])}" alt="${esc(p.title)}" loading="lazy" decoding="async">`:''}${p.source==='demo'?'<span class="badge-demo">Ejemplo</span>':''}</div>
 <div class="prop-body"><div class="lc-row"><span class="chan">${esc(OPERATIONS[p.operation])}</span><span class="chan">${esc(PROPERTY_TYPES[p.type])}</span></div><h3>${esc(p.title)}</h3><p class="muted">${esc([p.zone,p.city].filter(Boolean).join(', '))}</p>
 <p class="prop-price">${esc(price(p))}</p><p class="muted">${[p.bedrooms!==null?`${Number(p.bedrooms)} rec.`:'',p.bathrooms!==null?`${Number(p.bathrooms)} baños`:'',p.areaM2?`${Number(p.areaM2)} m²`:''].filter(Boolean).join(' · ')}</p>
 <div class="prop-actions">${statusControl(p)}${btn(`Interesados (${n})`,'prop-leads','small',`data-id="${esc(p.id)}"`)}${C.canProp('edit')?btn('Editar','edit-prop','small',`data-id="${esc(p.id)}"`):''}<a class="btn small" href="../propiedades/?p=${encodeURIComponent(p.slug)}" target="_blank" rel="noopener noreferrer">Ver en el catálogo ↗</a></div></div></article>`;
}
function tableHTML(list){
 return `<section class="card crm-table-card"><div class="table-wrap"><table class="crm-table"><thead><tr><th>Propiedad</th><th>Operación</th><th>Precio</th><th>Estado</th><th>Zona</th><th>Interesados</th><th></th></tr></thead><tbody>${list.map(p=>`<tr><td><b>${esc(p.title)}</b> ${p.source==='demo'?'<span class="badge-demo">Ejemplo</span>':''}<small>${esc(PROPERTY_TYPES[p.type])}${p.bedrooms!==null?` · ${Number(p.bedrooms)} rec.`:''}</small></td><td>${esc(OPERATIONS[p.operation])}</td><td class="num">${esc(price(p))}</td><td>${statusControl(p)}</td><td>${esc([p.zone,p.city].filter(Boolean).join(', '))}</td><td>${btn(String(interested(p).length),'prop-leads','small',`data-id="${esc(p.id)}" aria-label="Interesados en ${esc(p.title)}"`)}</td><td>${C.canProp('edit')?btn('Editar','edit-prop','small',`data-id="${esc(p.id)}"`):''} <a class="btn small" href="../propiedades/?p=${encodeURIComponent(p.slug)}" target="_blank" rel="noopener noreferrer">Catálogo ↗</a></td></tr>`).join('')}</tbody></table></div></section>`;
}

function propDialog(id=''){
 if(!C.canProp('edit')){C.toast('Tu rol no puede crear ni editar propiedades.',true);return;}
 const p=id?C.properties().find(x=>x.id===id):null;if(id&&!p)return;
 const v=p||{title:'',slug:'',operation:'venta',type:'casa',status:'disponible',price:'',currency:'MXN',areaM2:'',lotM2:'',bedrooms:'',bathrooms:'',parking:'',development:'',zone:'',city:'',description:'',features:[],images:[],featured:false};
 const o=(x)=>Object.entries(x);
 C.openDialog('prop',p?'Editar propiedad':'Nueva propiedad',`<div class="form-grid">
 ${fld('Nombre','title',v.title,{required:true,max:160,wide:true})}${sel2('Operación','operation',v.operation,o(OPERATIONS))}${sel2('Tipo','type',v.type,o(PROPERTY_TYPES))}${sel2('Estado','status',v.status,o(PROPERTY_STATUSES))}
 ${fld('Precio','price',v.price??'',{type:'number'})}${sel2('Moneda','currency',v.currency,[['MXN','MXN'],['USD','USD']])}${fld('Construcción (m²)','areaM2',v.areaM2??'',{type:'number'})}${fld('Terreno (m²)','lotM2',v.lotM2??'',{type:'number'})}
 ${fld('Recámaras','bedrooms',v.bedrooms??'',{type:'number'})}${fld('Baños','bathrooms',v.bathrooms??'',{type:'number',extra:'step="0.5"'})}${fld('Estacionamientos','parking',v.parking??'',{type:'number'})}${fld('Desarrollo','development',v.development,{max:120})}
 ${fld('Zona','zone',v.zone,{max:120})}${fld('Ciudad','city',v.city,{max:120})}
 ${fld('Descripción','description',v.description,{type:'textarea',max:8000,wide:true,extra:'rows="4"'})}${fld('Características (separadas por comas)','features',v.features.join(', '),{wide:true,max:1500})}
 ${fld('Imágenes (una URL https o ruta /img/… por línea)','images',v.images.filter(i=>!i.startsWith('data:')).join('\n'),{type:'textarea',max:4000,wide:true,extra:'rows="3"'})}
 <label class="checkbox span-two"><input type="checkbox" name="featured" ${v.featured?'checked':''}><span>Destacada en el catálogo</span></label></div>`,
 `${p?btn('Eliminar','delete-prop','danger',`data-id="${esc(id)}"`):''}${btn('Cancelar','close')}<button class="btn primary" type="submit">Guardar propiedad</button>`,id);
}
function savePropForm(values,id){
 const old=id?C.properties().find(p=>p.id===id):null;
 const keep=(old?.images||[]).filter(i=>i.startsWith('data:'));
 const input={...(old||{}),...values,id:old?.id,images:[...String(values.images||'').split('\n').map(x=>x.trim()).filter(Boolean),...keep],features:String(values.features||'').split(','),featured:values.featured==='on',leadIds:old?.leadIds||[]};
 if(!old)delete input.id;
 try{const saved=C.data().properties.save(input);C.audit(old?'Editar propiedad':'Crear propiedad',saved.title);C.reloadProps();C.rerender();C.toast(old?'Propiedad actualizada.':'Propiedad creada.');return true;}catch(e){C.toast(e.message,true);return false;}
}
function leadsDialog(id){
 const p=C.properties().find(x=>x.id===id);if(!p)return;const linked=interested(p),edit=C.canProp('edit')||C.canProp('status');
 const rest=S().leads.filter(l=>!(p.leadIds||[]).includes(l.id));
 C.openDialog('prop-leads',`Interesados en ${p.title}`,`${linked.length?`<ul class="plain-list">${linked.map(l=>`<li><button class="link-btn" data-action="edit-lead" data-id="${esc(l.id)}">${esc(l.name)}</button> <span class="muted">${esc([l.company,l.phone,l.email].filter(Boolean).join(' · '))}</span> ${edit?btn('Desvincular','prop-unlink','small danger',`data-id="${esc(p.id)}" data-lead="${esc(l.id)}"`):''}</li>`).join('')}</ul>`:'<p class="muted">Ningún contacto vinculado todavía.</p>'}
 ${edit&&C.access().canEdit?`<div class="mini-form"><label class="field"><span>Vincular un contacto</span><select id="pl-pick">${leadOptions(rest,{blank:'Elige un contacto…'}).map(([k,t])=>`<option value="${esc(k)}">${esc(t)}</option>`).join('')}</select></label>${btn('Vincular','prop-link','small primary',`data-id="${esc(p.id)}"`)}</div>`:''}`,btn('Cerrar','close'),id);
}
function link(propertyId,leadId,linked){
 if(!C.access().canEdit||!(C.canProp('edit')||C.canProp('status'))){C.toast('Tu rol no puede vincular contactos.',true);return false;}
 try{const p=C.properties().find(x=>x.id===propertyId),l=C.raw().leads.find(x=>x.id===leadId);C.data().properties.linkLead(propertyId,leadId,linked);
  C.audit(linked?'Vincular contacto a propiedad':'Desvincular contacto',`${l?.name||leadId} · ${p?.title||propertyId}`);C.reloadProps();C.rerender();C.refreshFicha();return true;}catch(e){C.toast(e.message,true);return false;}
}

// ───────────── Pestaña de la ficha ─────────────
export function leadTab(lead){
 const mine=C.properties().filter(p=>(p.leadIds||[]).includes(lead.id)),rest=C.properties().filter(p=>!(p.leadIds||[]).includes(lead.id));
 const can=C.access().canEdit&&(C.canProp('edit')||C.canProp('status'));
 return `<div class="tab-block"><h4>Propiedades de interés</h4>${mine.length?`<ul class="plain-list">${mine.map(p=>`<li><b>${esc(p.title)}</b> ${pill(PROPERTY_STATUSES[p.status],STATUS_CLS[p.status])}<small class="muted">${esc(price(p))} · ${esc([p.zone,p.city].filter(Boolean).join(', '))}</small><span class="row-actions"><a class="btn small" href="../propiedades/?p=${encodeURIComponent(p.slug)}" target="_blank" rel="noopener noreferrer">Catálogo ↗</a>${can?btn('Desvincular','prop-unlink','small danger',`data-id="${esc(p.id)}" data-lead="${esc(lead.id)}"`):''}</span></li>`).join('')}</ul>`:'<p class="muted">Sin propiedades vinculadas.</p>'}
 ${can?(rest.length?`<div class="mini-form"><label class="field"><span>Vincular una propiedad</span><select id="lp-pick">${rest.map(p=>`<option value="${esc(p.id)}">${esc(p.title)}</option>`).join('')}</select></label>${btn('Vincular','prop-link-lead','small primary',`data-lead="${esc(lead.id)}"`)}</div>`:'<p class="muted">No hay más propiedades para vincular. Crea fichas en la vista Propiedades.</p>'):''}</div>`;
}

export function handleAction(action,el){
 const id=el.dataset.id;
 switch(action){
  case 'new-prop':propDialog();return true;
  case 'edit-prop':propDialog(id);return true;
  case 'prop-leads':leadsDialog(id);return true;
  case 'prop-mode':mode=el.dataset.mode;render();return true;
  case 'prop-clear':f={q:'',operation:'',type:'',status:'',city:'',min:'',max:'',beds:'',sort:f.sort};render();return true;
  case 'prop-seed':{if(!C.canProp('edit'))return true;try{const n=C.data().properties.seedDemo();C.audit('Cargar propiedades de ejemplo',`${n} propiedades`);C.reloadProps();render();C.toast(`${n} propiedades de ejemplo cargadas. Están marcadas como ejemplo.`);}catch(e){C.toast(e.message,true);}return true;}
  case 'prop-clear-demo':{if(!C.canProp('edit'))return true;try{C.data().properties.clearDemo();C.audit('Quitar propiedades de ejemplo','');C.reloadProps();render();C.toast('Se quitaron las propiedades de ejemplo.');}catch(e){C.toast(e.message,true);}return true;}
  case 'delete-prop':{const p=C.properties().find(x=>x.id===id);if(p&&confirm(`¿Eliminar «${p.title}»? También desaparece del catálogo público.`)){try{C.data().properties.remove(id);C.audit('Eliminar propiedad',p.title);C.reloadProps();C.closeDialog();render();}catch(e){C.toast(e.message,true);}}return true;}
  case 'prop-link':{const lid=$('#pl-pick')?.value;if(!lid){C.toast('Elige un contacto.',true);return true;}if(link(id,lid,true))leadsDialog(id);return true;}
  case 'prop-link-lead':{const pid=$('#lp-pick')?.value;if(pid)link(pid,el.dataset.lead,true);return true;}
  case 'prop-unlink':{if(link(id,el.dataset.lead,false)&&$('#dialog').dataset.kind==='prop-leads')leadsDialog(id);return true;}
 }
 return false;
}
export function handleSubmit(kind,values,id){if(kind==='prop')return savePropForm(values,id);return undefined;}
export function handleInput(el){if(el.id==='pr-q'){f={...f,q:el.value};render();const q=$('#pr-q');q.focus();q.setSelectionRange(q.value.length,q.value.length);return true;}
 const m={'pr-min':'min','pr-max':'max','pr-beds':'beds'};if(m[el.id]){f={...f,[m[el.id]]:el.value};const pos=el.id;render();const n=$('#'+pos);n.focus();return true;}return false;}
export function handleChange(el){
 const m={'pr-op':'operation','pr-type':'type','pr-status':'status','pr-city':'city','pr-sort':'sort'};if(m[el.id]){f={...f,[m[el.id]]:el.value};render();return true;}
 if(el.dataset.propStatus){
  if(!C.access().canEdit&&!C.canProp('status')){C.toast('Tu rol no puede cambiar el estado.',true);render();return true;}
  try{const p=C.properties().find(x=>x.id===el.dataset.propStatus);C.data().properties.setStatus(el.dataset.propStatus,el.value);C.audit('Cambiar estado de propiedad',`${p?.title} → ${PROPERTY_STATUSES[el.value]}`);C.reloadProps();render();C.toast(`${p?.title}: ${PROPERTY_STATUSES[el.value]}.`);}catch(e){C.toast(e.message,true);render();}
  return true;}
 return false;
}
