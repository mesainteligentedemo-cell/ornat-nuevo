// Cotizaciones y propuestas: totales exactos (centavos), numeración, estados, firma simple de demostración y vista imprimible.
import {QUOTE_STATUSES,cleanQuote,dayKey,inMap} from './store.js';

const cents=n=>Math.round(Number(n)*100);
export function quoteTotals(q){
 const subtotal=q.items.reduce((s,it)=>s+Math.round(Math.round(it.qty*1000)*cents(it.price)/1000),0);
 const discount=q.discount?.type==='amount'?Math.min(cents(q.discount.value||0),subtotal):Math.round(subtotal*(q.discount?.value||0)/100);
 const base=subtotal-discount,iva=q.iva?Math.round(base*0.16):0,total=base+iva;
 return {subtotal:subtotal/100,discount:discount/100,base:base/100,iva:iva/100,total:total/100,cents:{subtotal,discount,base,iva,total}};
}
export const fmtMoney=(n,currency='MXN')=>`$${new Intl.NumberFormat('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n)} ${currency}`;

/** Siguiente número consecutivo (por año). Devuelve el número y el contador actualizado. */
export function nextQuoteNumber(seq={},year=new Date().getFullYear()){
 const n=(seq[String(year)]||0)+1;
 return {number:`COT-${year}-${String(n).padStart(4,'0')}`,seq:{...seq,[String(year)]:n}};
}
export const effectiveStatus=(q,now=new Date())=>(['draft','sent','viewed'].includes(q.status)&&q.validUntil&&q.validUntil<dayKey(now))?'expired':q.status;

const NEXT={draft:['sent','signed','rejected'],sent:['viewed','signed','rejected','draft'],viewed:['signed','rejected','draft'],signed:['accepted','rejected'],accepted:[],rejected:['draft'],expired:['draft','rejected']};
export const allowedTransitions=status=>typeof status==='string'&&Object.hasOwn(NEXT,status)?NEXT[status]:[];
export const isEditable=q=>q.status==='draft'&&!q.signature;
export function transitionQuote(q,to,{at=new Date().toISOString(),note=''}={}){
 if(!inMap(QUOTE_STATUSES,to))throw new Error('Estado de cotización no válido.');
 if(!allowedTransitions(q.status).includes(to))throw new Error(`Una cotización ${QUOTE_STATUSES[q.status].toLowerCase()} no puede pasar a ${QUOTE_STATUSES[to].toLowerCase()}.`);
 if(to==='signed')throw new Error('Para firmar usa la firma en pantalla.');
 const next={...q,status:to,updatedAt:at,history:[...q.history,{at,status:to,note}].slice(-50)};
 if(to==='draft')next.signature=null;
 return cleanQuote(next);
}

// ───────────── Huella y firma ─────────────
/** Contenido canónico: solo lo que el cliente acepta (sin firma, estado ni notas internas). */
export function canonicalContent(q){
 const t=quoteTotals(q);
 return JSON.stringify({number:q.number,leadId:q.leadId,propertyId:q.propertyId,title:q.title,currency:q.currency,items:q.items.map(i=>[i.desc,i.qty,i.price]),discount:[q.discount.type,q.discount.value],iva:q.iva,validUntil:q.validUntil,terms:q.terms,total:t.cents.total});
}
export async function sha256Hex(text){
 const buf=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export const contentHash=q=>sha256Hex(canonicalContent(q));
const sealInput=(q,name,at)=>`${canonicalContent(q)}|${name}|${at}`;
/** Firma simple de demostración: nombre + fecha + dibujo, sellados con SHA-256 del contenido. No es firma electrónica avanzada. */
export async function signQuote(q,{name,image='',at=new Date().toISOString()}){
 const who=String(name??'').trim();if(!who)throw new Error('Escribe el nombre de quien firma.');
 if(!['draft','sent','viewed'].includes(q.status))throw new Error('Solo se puede firmar una cotización vigente (borrador, enviada o vista).');
 if(q.validUntil&&q.validUntil<dayKey(new Date(at)))throw new Error('La cotización está vencida. Renueva la vigencia antes de firmar.');
 const hash=await sha256Hex(sealInput(q,who,at));
 return cleanQuote({...q,status:'signed',signature:{name:who,at,hash,image},updatedAt:at,history:[...q.history,{at,status:'signed',note:`Firma simple de demostración · ${who}`}].slice(-50)});
}
export async function verifySignature(q){if(!q.signature)return false;return (await sha256Hex(sealInput(q,q.signature.name,q.signature.at)))===q.signature.hash;}

// ───────────── Listas y resumen ─────────────
export function filterQuotes(quotes,leadsById,filters={},now=new Date()){
 const f={q:'',status:'',currency:'',leadId:'',...filters},term=String(f.q||'').toLowerCase();
 return quotes.filter(q=>{
  const st=effectiveStatus(q,now);
  if(f.status&&st!==f.status)return false;if(f.currency&&q.currency!==f.currency)return false;if(f.leadId&&q.leadId!==f.leadId)return false;
  if(term){const l=leadsById.get(q.leadId);const h=`${q.number} ${q.title} ${l?.name||''} ${l?.company||''}`.toLowerCase();if(!h.includes(term))return false;}
  return true;
 }).sort((a,b)=>a.createdAt<b.createdAt?1:-1);
}
/** Por moneda (sin convertir): cotizado = todo lo emitido (no borrador); firmado; aceptado. */
export function quoteSummary(quotes,now=new Date()){
 const out={};
 for(const q of quotes){
  const st=effectiveStatus(q,now),c=out[q.currency]||(out[q.currency]={count:0,quoted:0,signed:0,accepted:0,open:0});
  const t=quoteTotals(q).total;c.count++;
  if(q.status!=='draft')c.quoted+=t;if(st==='signed')c.signed+=t;if(st==='accepted')c.accepted+=t;if(['sent','viewed'].includes(st))c.open+=t;
 }
 return out;
}

// ───────────── Vista imprimible ─────────────
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const longDate=iso=>iso?new Date(iso).toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'}):'';
export function quoteHTML(q,{lead=null,property=null,issuer={name:'ORNAT'},verified=null,now=new Date()}={}){
 const t=quoteTotals(q),st=effectiveStatus(q,now),cur=q.currency;
 const rows=q.items.map(it=>`<tr><td>${esc(it.desc)}</td><td class="n">${new Intl.NumberFormat('es-MX',{maximumFractionDigits:3}).format(it.qty)}</td><td class="n">${fmtMoney(it.price,cur)}</td><td class="n">${fmtMoney(Math.round(it.qty*1000*cents(it.price)/1000)/100,cur)}</td></tr>`).join('');
 const sig=q.signature?`<div class="q-sign"><p class="q-label">Firma simple de demostración</p>${q.signature.image?`<img src="${esc(q.signature.image)}" alt="Firma de ${esc(q.signature.name)}">`:''}<p><b>${esc(q.signature.name)}</b><br>${esc(longDate(q.signature.at))}</p><p class="q-hash">Huella SHA-256: <code>${esc(q.signature.hash)}</code>${verified===null?'':verified?' · coincide con el contenido':' · NO coincide: el contenido cambió'}</p><p class="q-fine">Es una firma simple de demostración: registra nombre, fecha y un sello del contenido en este navegador. No es una firma electrónica avanzada ni tiene validez de certificación.</p></div>`:'';
 return `<article class="q-doc" data-quote="${esc(q.number)}">
 <header class="q-head"><div class="q-brand"><strong>${esc(issuer.name||'ORNAT')}</strong>${issuer.address?`<span>${esc(issuer.address)}</span>`:''}${issuer.email||issuer.phone?`<span>${esc([issuer.email,issuer.phone].filter(Boolean).join(' · '))}</span>`:''}${issuer.taxId?`<span>RFC ${esc(issuer.taxId)}</span>`:''}</div><div class="q-meta"><p class="q-label">Cotización</p><p class="q-number">${esc(q.number)}</p><p>Emitida: ${esc(longDate(q.createdAt))}</p>${q.validUntil?`<p>Vigente hasta: ${esc(longDate(q.validUntil+'T12:00:00'))}</p>`:''}<p class="q-status">${esc(QUOTE_STATUSES[st])}</p></div></header>
 <section class="q-to"><p class="q-label">Para</p><p><b>${esc(lead?.name||'—')}</b>${lead?.company?`<br>${esc(lead.company)}`:''}${lead?.email?`<br>${esc(lead.email)}`:''}${lead?.phone?`<br>${esc(lead.phone)}`:''}</p>${property?`<p class="q-label">Propiedad</p><p><b>${esc(property.title)}</b><br>${esc([property.zone,property.city].filter(Boolean).join(', '))}</p>`:''}</section>
 ${q.title?`<h2 class="q-title">${esc(q.title)}</h2>`:''}
 <table class="q-table"><thead><tr><th>Concepto</th><th class="n">Cant.</th><th class="n">Precio</th><th class="n">Importe</th></tr></thead><tbody>${rows}</tbody></table>
 <table class="q-totals"><tbody><tr><td>Subtotal</td><td class="n">${fmtMoney(t.subtotal,cur)}</td></tr>${t.discount?`<tr><td>Descuento${q.discount.type==='percent'?` (${Number(q.discount.value)} %)`:''}</td><td class="n">− ${fmtMoney(t.discount,cur)}</td></tr>`:''}${q.iva?`<tr><td>IVA 16 %</td><td class="n">${fmtMoney(t.iva,cur)}</td></tr>`:''}<tr class="q-total"><td>Total</td><td class="n">${fmtMoney(t.total,cur)}</td></tr></tbody></table>
 ${q.terms?`<section class="q-terms"><p class="q-label">Condiciones</p><p>${esc(q.terms).replace(/\n/g,'<br>')}</p></section>`:''}
 ${q.paymentLink?`<p class="q-pay">Pago en línea: <a href="${esc(q.paymentLink)}" rel="noopener noreferrer">${esc(q.paymentLink)}</a></p>`:''}
 ${sig}</article>`;
}
