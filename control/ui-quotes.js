// Cotizaciones y propuestas: lista, editor, vista imprimible, firma en pantalla y link de pago.
import {QUOTE_STATUSES,cleanQuote,validPaymentLink,dayKey,addDays,uid} from './store.js';
import {quoteTotals,fmtMoney,nextQuoteNumber,effectiveStatus,allowedTransitions,transitionQuote,isEditable,signQuote,verifySignature,quoteHTML,filterQuotes,quoteSummary} from './quotes.js';
import {setCtx,$,esc,btn,fld,sel2,leadOptions,shortDate,pill} from './ui-common.js';

let C,filters={q:'',status:'',currency:'',leadId:''};
export const init=c=>{C=c;setCtx(c);};
const S=()=>C.getState();
const leadsById=()=>new Map(S().leads.map(l=>[l.id,l]));
const statusPill=(q)=>{const s=effectiveStatus(q);return `<span class="pill q-${s}">${esc(QUOTE_STATUSES[s])}</span>`;};
const DEFAULT_TERMS='Anticipo del 50 % para iniciar y el resto contra entrega. Precios sujetos a cambio después de la vigencia. Esta cotización no es un comprobante fiscal.';

export function render(){
 const st=S(),now=new Date(),lb=leadsById(),list=filterQuotes(st.quotes,lb,filters,now),sum=quoteSummary(st.quotes,now);
 const cur=Object.keys(sum);
 const stats=cur.length?cur.map(c=>`<div class="stat"><span class="label">${esc(c)} · COTIZADO</span><strong>${fmtMoney(sum[c].quoted,c).replace(` ${c}`,'')}</strong><small>${Number(sum[c].count)} cotizaciones · abiertas ${fmtMoney(sum[c].open,c)}</small></div><div class="stat featured"><span class="label">${esc(c)} · ACEPTADO</span><strong>${fmtMoney(sum[c].accepted,c).replace(` ${c}`,'')}</strong><small>Firmado sin aceptar: ${fmtMoney(sum[c].signed,c)}</small></div>`).join(''):'';
 $('#content').innerHTML=`${stats?`<div class="stats">${stats}</div>`:''}
 <div class="crm-bar"><label class="searchbox"><span class="sr-only">Buscar cotizaciones</span><input type="search" id="qt-q" placeholder="Buscar por número, contacto o título…" value="${esc(filters.q)}"></label>
 <label class="sortbox"><span class="sr-only">Estado</span><select id="qt-status" aria-label="Estado"><option value="">Todos los estados</option>${Object.entries(QUOTE_STATUSES).map(([k,t])=>`<option value="${k}" ${filters.status===k?'selected':''}>${t}</option>`).join('')}</select></label>
 <label class="sortbox"><span class="sr-only">Moneda</span><select id="qt-cur" aria-label="Moneda"><option value="">Todas las monedas</option><option ${filters.currency==='MXN'?'selected':''}>MXN</option><option ${filters.currency==='USD'?'selected':''}>USD</option></select></label>
 ${btn('Limpiar','qt-clear','small ghost')}</div>
 <p class="crm-count" role="status" aria-live="polite"><b>${list.length}</b> de ${st.quotes.length} cotizaciones</p>
 ${list.length?`<section class="card crm-table-card"><div class="table-wrap"><table class="crm-table"><thead><tr><th>Número</th><th>Contacto</th><th>Título</th><th>Total</th><th>Estado</th><th>Vigencia</th></tr></thead><tbody>${list.map(q=>{const l=lb.get(q.leadId);return `<tr><td><button class="link-btn" data-action="open-quote" data-id="${esc(q.id)}">${esc(q.number)}</button></td><td>${l?`<button class="link-btn" data-action="edit-lead" data-id="${esc(l.id)}">${esc(l.name)}</button>`:'—'}</td><td>${esc(q.title||'—')}</td><td class="num">${fmtMoney(quoteTotals(q).total,q.currency)}</td><td>${statusPill(q)}</td><td>${q.validUntil?esc(shortDate(q.validUntil+'T12:00:00')):'—'}</td></tr>`;}).join('')}</tbody></table></div></section>`
 :`<section class="card">${C.empty(st.quotes.length?'Ninguna cotización coincide':'Aún no hay cotizaciones','Crea una desde la ficha de un contacto o aquí mismo. Se numeran en orden y se pueden imprimir como PDF.',btn('＋ Nueva cotización','new-quote','small'))}</section>`}`;
}

// ───────────── Editor ─────────────
const itemRow=(it={desc:'',qty:1,price:''},ro)=>`<div class="q-row"><input class="q-desc" name="itemDesc" type="text" maxlength="300" placeholder="Concepto" value="${esc(it.desc)}" aria-label="Concepto" ${ro?'disabled':''}><input class="q-qty" name="itemQty" type="number" min="0.001" step="any" value="${esc(it.qty)}" placeholder="Cant." aria-label="Cantidad" ${ro?'disabled':''}><input class="q-price" name="itemPrice" type="number" min="0" step="0.01" value="${esc(it.price)}" placeholder="Precio unitario" aria-label="Precio unitario" ${ro?'disabled':''}><span class="q-amt" aria-label="Importe">$0.00</span>${ro?'':`<button type="button" class="btn small danger" data-action="q-del-row" aria-label="Quitar concepto">×</button>`}</div>`;
export function quoteDialog(id='',preset={}){
 const old=id?S().quotes.find(q=>q.id===id):null;
 const q=old||{title:preset.title||'',leadId:preset.leadId||'',propertyId:preset.propertyId||'',currency:'MXN',items:[{desc:'',qty:1,price:''}],discount:{type:'percent',value:0},iva:true,validUntil:addDays(dayKey(new Date()),15),terms:DEFAULT_TERMS,notes:'',paymentLink:'',status:'draft'};
 const ro=old&&!isEditable(old),props=C.properties();
 C.openDialog('quote',old?`Cotización ${old.number}`:'Nueva cotización',`
 ${ro?`<div class="notice">Esta cotización está <b>${esc(QUOTE_STATUSES[effectiveStatus(old)].toLowerCase())}</b> y no se puede editar para que su contenido coincida con la firma o el envío. ${allowedTransitions(old.status).includes('draft')?'Regrésala a borrador si necesitas cambiarla.':''}</div>`:''}
 <fieldset class="q-fs" ${ro?'disabled':''}><div class="form-grid">
 ${sel2('Contacto','leadId',q.leadId,leadOptions(S().leads,{blank:'Elige un contacto…'}),{wide:true,id:'q-lead'})}
 ${fld('Título de la propuesta','title',q.title,{max:200,wide:true,placeholder:'Ej. Sitio web de portafolio'})}
 ${sel2('Propiedad vinculada','propertyId',q.propertyId,[['','Sin propiedad'],...props.map(p=>[p.id,p.title])])}${sel2('Moneda','currency',q.currency,[['MXN','MXN · pesos'],['USD','USD · dólares']],{id:'q-cur'})}
 ${fld('Vigencia hasta','validUntil',q.validUntil,{type:'date'})}<label class="checkbox q-iva"><input type="checkbox" name="iva" id="q-iva" ${q.iva?'checked':''}><span>Agregar IVA 16 %</span></label>
 </div>
 <div class="q-items" id="q-items"><div class="q-row q-head" aria-hidden="true"><span>Concepto</span><span>Cant.</span><span>Precio</span><span>Importe</span><span></span></div>${q.items.map(i=>itemRow(i,ro)).join('')}</div>
 ${ro?'':btn('＋ Agregar concepto','q-add-row','small')}
 <div class="form-grid q-disc">${sel2('Descuento','discType',q.discount.type,[['percent','Porcentaje (%)'],['amount','Monto fijo']],{id:'q-dtype'})}${fld('Valor del descuento','discValue',q.discount.value,{type:'number',extra:'min="0" step="0.01" id="q-dval"'})}</div>
 <div class="q-totals-live" id="q-live" aria-live="polite"></div>
 <div class="form-grid">${fld('Condiciones','terms',q.terms,{type:'textarea',max:5000,wide:true,extra:'rows="3"'})}
 ${fld('Link de pago (Stripe)','paymentLink',q.paymentLink,{type:'url',wide:true,max:500,placeholder:'https://buy.stripe.com/…',hint:'Opcional. Pega un Payment Link de Stripe: el botón «Pagar» lo abre. Esta app no cobra ni confirma pagos.'})}
 ${fld('Notas internas (no salen en el documento)','notes',q.notes,{type:'textarea',max:2000,wide:true,extra:'rows="2"'})}</div></fieldset>
 ${old?`<p class="storage-meta">Historial: ${old.history.map(h=>`${QUOTE_STATUSES[h.status]} (${shortDate(h.at)})`).join(' → ')||'borrador'}</p>`:''}`,
 `${old?btn('Eliminar','delete-quote','danger',`data-id="${esc(id)}"`):''}${old?btn('Vista previa e imprimir','quote-view','',`data-id="${esc(id)}"`):''}${btn('Cerrar','close')}${ro?'':`<button class="btn primary" type="submit">${old?'Guardar cambios':'Crear cotización'}</button>`}`,id);
 liveTotals();
}
function readForm(){
 const f=new FormData($('#dialog-shell')),v=Object.fromEntries(f);
 const d=f.getAll('itemDesc'),qt=f.getAll('itemQty'),pr=f.getAll('itemPrice');
 const items=d.map((desc,i)=>({desc:String(desc).trim(),qty:qt[i],price:pr[i]===''?0:pr[i]})).filter(it=>it.desc||Number(it.price));
 return {...v,items,iva:$('#q-iva')?.checked===true};
}
function draftFrom(v){return {items:v.items.map(i=>({desc:i.desc||'x',qty:Number(i.qty)||0,price:Number(i.price)||0})),discount:{type:v.discType==='amount'?'amount':'percent',value:Number(v.discValue)||0},iva:v.iva};}
export function liveTotals(){
 const box=$('#q-live');if(!box||$('#dialog').dataset.kind!=='quote')return;
 const v=readForm();let t;try{t=quoteTotals(draftFrom(v));}catch{return;}const cur=v.currency||'MXN';
 document.querySelectorAll('#q-items .q-row:not(.q-head)').forEach(row=>{const qty=Number(row.querySelector('.q-qty')?.value)||0,pr=Number(row.querySelector('.q-price')?.value)||0;row.querySelector('.q-amt').textContent=fmtMoney(Math.round(qty*pr*100)/100,cur).replace(` ${cur}`,'');});
 box.innerHTML=`<dl><div><dt>Subtotal</dt><dd>${fmtMoney(t.subtotal,cur)}</dd></div>${t.discount?`<div><dt>Descuento</dt><dd>− ${fmtMoney(t.discount,cur)}</dd></div>`:''}${v.iva?`<div><dt>IVA 16 %</dt><dd>${fmtMoney(t.iva,cur)}</dd></div>`:''}<div class="grand"><dt>Total</dt><dd>${fmtMoney(t.total,cur)}</dd></div></dl>`;
}
function saveQuote(values,id){
 const old=id?S().quotes.find(q=>q.id===id):null;const v=readForm();
 if(!v.leadId){C.toast('Elige el contacto de la cotización.',true);return false;}
 if(!v.items.length){C.toast('Agrega al menos un concepto con descripción.',true);return false;}
 const now=new Date().toISOString();let number=old?.number,seq=null;
 if(!old){const r=nextQuoteNumber(C.raw().settings.quoteSeq,new Date().getFullYear());number=r.number;seq=r.seq;}
 const quote=cleanQuote({...(old||{}),id:old?.id||uid(),number,leadId:v.leadId,propertyId:v.propertyId,title:v.title,currency:v.currency,items:v.items.map(i=>({id:uid(),...i})),discount:{type:v.discType,value:Number(v.discValue)||0},iva:v.iva,validUntil:v.validUntil,terms:v.terms,notes:v.notes,paymentLink:v.paymentLink,status:old?.status||'draft',createdAt:old?.createdAt||now,updatedAt:now,history:old?.history||[{at:now,status:'draft',note:'Creada'}]});
 const ok=C.commit(old?'Editar cotización':'Crear cotización',s=>{if(seq)s.settings.quoteSeq=seq;if(old)s.quotes=s.quotes.map(q=>q.id===id?quote:q);else s.quotes.push(quote);},`${quote.number} · ${fmtMoney(quoteTotals(quote).total,quote.currency)}`);
 return ok;
}

// ───────────── Vista previa, impresión y firma ─────────────
export async function viewDialog(id){
 const q=S().quotes.find(x=>x.id===id);if(!q)return;
 const lead=S().leads.find(l=>l.id===q.leadId),prop=C.properties().find(p=>p.id===q.propertyId);
 const verified=q.signature?await verifySignature(q):null;
 const html=quoteHTML(q,{lead,property:prop,issuer:S().settings.issuer,verified});
 const st=effectiveStatus(q),next=allowedTransitions(q.status).filter(s=>s!=='signed');
 const labels={sent:'Marcar como enviada',viewed:'Marcar como vista',accepted:'Marcar como aceptada',rejected:'Marcar como rechazada',draft:'Regresar a borrador'};
 C.openDialog('quote-view',`Cotización ${q.number}`,`<div class="notice">Los cambios de estado son un registro manual: la app no envía la cotización ni sabe si el cliente la abrió. Usa «Imprimir» para generar el PDF y mándalo tú.</div><div class="q-preview" id="q-preview">${html}</div>`,
 `${btn('Editar','open-quote','',`data-id="${esc(id)}"`)}${next.map(s=>btn(labels[s],'quote-status',s==='rejected'?'danger':'',`data-id="${esc(id)}" data-to="${s}"`)).join('')}${['draft','sent','viewed'].includes(q.status)&&st!=='expired'?btn('Firmar en pantalla','quote-sign','lime',`data-id="${esc(id)}"`):''}${q.paymentLink?`<a class="btn primary" id="q-pay" href="${esc(q.paymentLink)}" target="_blank" rel="noopener noreferrer">Pagar en Stripe ↗</a>`:''}${btn('Imprimir / guardar PDF','quote-print','primary',`data-id="${esc(id)}"`)}${btn('Cerrar','close')}`,id);
 const root=$('#print-root');if(root)root.innerHTML=html;
}
function signDialog(id){
 const q=S().quotes.find(x=>x.id===id);if(!q)return;
 C.openDialog('quote-sign',`Firmar ${q.number}`,`<div class="notice warn"><b>Firma simple de demostración.</b> Registra el nombre, la fecha y un sello SHA-256 del contenido de la cotización en este navegador. No es una firma electrónica avanzada ni sustituye un contrato.</div>
 <div class="form-grid">${fld('Nombre de quien firma','signer',S().leads.find(l=>l.id===q.leadId)?.name||'',{required:true,max:150,wide:true})}</div>
 <p class="q-label">Dibuja tu firma</p><canvas id="sig" width="560" height="180" class="sig" aria-label="Espacio para dibujar la firma"></canvas>
 <div class="actions">${btn('Borrar firma','sig-clear','small')}<span class="muted" id="sig-hint">Usa el dedo, el lápiz o el ratón.</span></div>
 <p class="storage-meta">Total a firmar: <b>${fmtMoney(quoteTotals(q).total,q.currency)}</b></p>`,`${btn('Cancelar','quote-view','',`data-id="${esc(id)}"`)}<button class="btn primary" type="submit">Firmar y sellar</button>`,id);
 initCanvas();
}
let drawn=false;
function initCanvas(){
 const cv=$('#sig');if(!cv)return;drawn=false;const g=cv.getContext('2d');g.lineWidth=2.6;g.lineCap='round';g.lineJoin='round';g.strokeStyle='#181a18';
 let down=false;
 const pos=e=>{const r=cv.getBoundingClientRect();return [(e.clientX-r.left)*cv.width/r.width,(e.clientY-r.top)*cv.height/r.height];};
 cv.style.touchAction='none';
 cv.addEventListener('pointerdown',e=>{down=true;cv.setPointerCapture?.(e.pointerId);const [x,y]=pos(e);g.beginPath();g.moveTo(x,y);g.lineTo(x+.01,y+.01);g.stroke();drawn=true;});
 cv.addEventListener('pointermove',e=>{if(!down)return;const [x,y]=pos(e);g.lineTo(x,y);g.stroke();});
 const up=()=>{down=false;};cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);cv.addEventListener('pointerleave',up);
}
async function doSign(values,id){
 const q=S().quotes.find(x=>x.id===id);if(!q)return false;
 if(!drawn){C.toast('Dibuja tu firma en el recuadro.',true);return false;}
 try{
  const image=$('#sig').toDataURL('image/png');
  const signed=await signQuote(q,{name:values.signer,image});
  const ok=C.commit('Firmar cotización (firma simple de demostración)',s=>{s.quotes=s.quotes.map(x=>x.id===id?signed:x);},`${q.number} · ${signed.signature.name} · ${signed.signature.hash.slice(0,12)}…`);
  if(ok)setTimeout(()=>viewDialog(id),0);return false;
 }catch(e){C.toast(e.message,true);return false;}
}

// ───────────── Pestaña de la ficha ─────────────
export function leadTab(lead){
 const mine=S().quotes.filter(q=>q.leadId===lead.id).sort((a,b)=>a.createdAt<b.createdAt?1:-1);
 return `<div class="tab-block"><h4>Cotizaciones y propuestas</h4>${mine.length?`<ul class="plain-list">${mine.map(q=>`<li><button type="button" class="link-btn" data-action="quote-view" data-id="${esc(q.id)}">${esc(q.number)}</button> ${statusPill(q)}<small class="muted">${esc(q.title||'Sin título')} · ${fmtMoney(quoteTotals(q).total,q.currency)}</small></li>`).join('')}</ul>`:'<p class="muted">Aún no hay cotizaciones para este contacto.</p>'}${btn('＋ Nueva cotización','new-quote','small primary',`data-lead="${esc(lead.id)}"`)}<p class="storage-meta">Al abrir una cotización se cierra la ficha; ahí encuentras el botón para volver.</p></div>`;
}

export function handleAction(action,el){
 const id=el.dataset.id;
 switch(action){
  case 'new-quote':quoteDialog('',{leadId:el.dataset.lead||''});return true;
  case 'open-quote':quoteDialog(id);return true;
  case 'quote-view':viewDialog(id);return true;
  case 'quote-sign':signDialog(id);return true;
  case 'sig-clear':{const cv=$('#sig');cv.getContext('2d').clearRect(0,0,cv.width,cv.height);drawn=false;return true;}
  case 'quote-print':{const root=$('#print-root');if(root&&!root.innerHTML)root.innerHTML=$('#q-preview').innerHTML;document.body.dataset.printing='quote';setTimeout(()=>{window.print();},50);return true;}
  case 'quote-status':{
   const q=S().quotes.find(x=>x.id===id);if(!q)return true;
   try{const to=el.dataset.to,next=transitionQuote(q,to);
    if(C.commit(`Cotización: ${QUOTE_STATUSES[to]}`,s=>{s.quotes=s.quotes.map(x=>x.id===id?next:x);},q.number))setTimeout(()=>viewDialog(id),0);}catch(e){C.toast(e.message,true);}return true;}
  case 'q-add-row':$('#q-items').insertAdjacentHTML('beforeend',itemRow({desc:'',qty:1,price:''}));$('#q-items .q-row:last-child .q-desc').focus();liveTotals();return true;
  case 'q-del-row':{const rows=document.querySelectorAll('#q-items .q-row:not(.q-head)');if(rows.length>1)el.closest('.q-row').remove();else C.toast('La cotización necesita al menos un concepto.',true);liveTotals();return true;}
  case 'delete-quote':{const q=S().quotes.find(x=>x.id===id);if(q&&confirm(`¿Eliminar la cotización ${q.number}? La numeración no se reutiliza.`)&&C.commit('Eliminar cotización',s=>{s.quotes=s.quotes.filter(x=>x.id!==id);},q.number))C.closeDialog();return true;}
  case 'qt-clear':filters={q:'',status:'',currency:'',leadId:''};render();return true;
 }
 return false;
}
export function handleSubmit(kind,values,id){
 if(kind==='quote'){try{return saveQuote(values,id);}catch(e){C.toast(e.message,true);return false;}}
 if(kind==='quote-sign'){doSign(values,id);return false;}
 return undefined;
}
export function handleInput(el){
 if(el.id==='qt-q'){filters={...filters,q:el.value};render();const q=$('#qt-q');q.focus();q.setSelectionRange(q.value.length,q.value.length);return true;}
 if(el.closest?.('#q-items')||el.id==='q-dval'){liveTotals();return true;}
 return false;
}
export function handleChange(el){
 if(el.id==='qt-status'){filters={...filters,status:el.value};render();return true;}
 if(el.id==='qt-cur'){filters={...filters,currency:el.value};render();return true;}
 if(['q-iva','q-dtype','q-cur'].includes(el.id)){liveTotals();return true;}
 return false;
}
