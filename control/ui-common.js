// Piezas de interfaz compartidas por las vistas del CRM.
let C;
export const setCtx=c=>{C=c;};
export const ctx=()=>C;
export const $=s=>document.querySelector(s);
export const $$=s=>[...document.querySelectorAll(s)];
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const mxn=n=>'$'+new Intl.NumberFormat('es-MX').format(n||0);
export const num=n=>new Intl.NumberFormat('es-MX').format(n||0);
export const shortDate=iso=>iso?new Date(iso).toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'}):'';
export const dateTime=iso=>iso?new Date(iso).toLocaleString('es-MX',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
export const localInput=iso=>{const d=new Date(iso||Date.now());d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16);};
export const btn=(label,action,cls='',extra='')=>`<button type="button" class="btn ${esc(cls)}" data-action="${esc(action)}" ${extra}>${esc(label)}</button>`;
export function fld(label,name,value='',{type='text',max=1000,required=false,hint='',wide=false,list='',extra='',placeholder='',id=''}={}){
 const idAttr=id?`id="${id}"`:'';
 const control=type==='textarea'?`<textarea ${idAttr} name="${name}" maxlength="${max}" ${required?'required':''} ${extra}>${esc(value)}</textarea>`
  :`<input ${idAttr} name="${name}" type="${type}" value="${esc(value)}" ${type==='number'?'':`maxlength="${max}"`} ${required?'required':''} ${list?`list="${list}"`:''} ${placeholder?`placeholder="${esc(placeholder)}"`:''} ${type==='number'&&!/step=/.test(extra)?'min="0" step="1" inputmode="numeric"':''} ${extra}>`;
 return `<label class="field ${wide?'span-two':''}"><span>${esc(label)}</span>${control}${hint?`<small>${esc(hint)}</small>`:''}</label>`;
}
export function sel2(label,name,value,options,{wide=false,extra='',id=''}={}){
 return `<label class="field ${wide?'span-two':''}"><span>${esc(label)}</span><select name="${name}" ${id?`id="${id}"`:''} ${extra}>${options.map(([k,t])=>`<option value="${esc(k)}" ${String(value)===String(k)?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`;
}
export const opts=(obj)=>Object.entries(obj);
export const pill=(label,cls='')=>`<span class="pill ${esc(cls)}">${esc(label)}</span>`;
export const initials=name=>String(name||'').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'?';
export const dayDiff=(a,b)=>{const p=k=>k.split('-').map(Number);const [y1,m1,d1]=p(a),[y2,m2,d2]=p(b);return Math.round((Date.UTC(y2,m2-1,d2)-Date.UTC(y1,m1-1,d1))/864e5);};
export function leadOptions(leads,{blank='Sin contacto'}={}){
 const sorted=[...leads].sort((a,b)=>a.name.localeCompare(b.name,'es'));
 return [['',blank],...sorted.map(l=>[l.id,`${l.name}${l.company?` · ${l.company}`:''}`])];
}
/** Abre un enlace externo (mailto:, wa.me, Stripe…) de forma que se pueda interceptar en pruebas. */
export function openExternal(url,self=false){window.open(url,self?'_self':'_blank','noopener');}
/** Gráfica de barras horizontales accesible: etiquetas directas, un solo tono, tabla alternativa aparte. */
export function hbars({title,desc,rows,max,format=v=>String(v),color='#8fa84a',accent='#566d1f',labelW=150}){
 const H=26,gap=10,W=620,pad=8,valW=230,barX=labelW+pad,barW=W-barX-valW-pad,total=rows.length*(H+gap)+gap;
 const m=max||Math.max(1,...rows.map(r=>r.value));
 const id='c'+Math.random().toString(36).slice(2,8);
 const body=rows.map((r,i)=>{const y=gap+i*(H+gap),w=Math.max(r.value>0?2:0,Math.round(barW*r.value/m)),w2=r.part?Math.round(barW*r.part/m):0;
  return `<g><text x="${labelW}" y="${y+H/2+4}" text-anchor="end" class="cl">${esc(r.label.length>22?r.label.slice(0,21)+'…':r.label)}</text><rect x="${barX}" y="${y}" width="${w}" height="${H}" rx="4" fill="${color}"><title>${esc(r.label)}: ${esc(format(r.value))}</title></rect>${w2?`<rect x="${barX}" y="${y}" width="${Math.min(w2,w)}" height="${H}" rx="4" fill="${accent}"><title>${esc(r.partLabel||'')}: ${esc(format(r.part))}</title></rect>`:''}<text x="${barX+w+8}" y="${y+H/2+4}" class="cv">${esc(r.text??format(r.value))}</text></g>`;}).join('');
 return `<figure class="chart"><svg viewBox="0 0 ${W} ${total}" role="img" aria-labelledby="${id}t ${id}d"><title id="${id}t">${esc(title)}</title><desc id="${id}d">${esc(desc)}</desc><line x1="${barX}" y1="0" x2="${barX}" y2="${total}" class="cax"/>${body}</svg></figure>`;
}
