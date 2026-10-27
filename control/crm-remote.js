// Espejo del CRM en Supabase: cada lista del estado es una tabla (una fila por elemento) y los ajustes van en crm_settings.
// Puro y sin efectos: lo usan shared/remote-mirror.js (navegador) y las pruebas de Node.
import {emptyState,validateState} from './store.js';

const KEY='ornat-control-v1';
const LISTS={leads:'crm_leads',tasks:'crm_tasks',quotes:'crm_quotes',conversations:'crm_conversations',enrollments:'crm_enrollments',publications:'crm_publications',usage:'crm_usage',events:'crm_events',activity:'crm_activity'};
const PREFS=['analyticsConsent','sheetUrl','lastBackupAt','calendarSource'];
const SETTING_ROWS=['pipelines','templates','sequences','scoreRules','quoteSeq','issuer','savedViews'];

const txt=v=>{if(v===undefined||v===null)return null;const s=String(v).trim();return s?s:null;};
const num=v=>{if(v===undefined||v===null||v==='')return null;const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:null;};
const when=v=>{if(typeof v!=='string'||!v)return null;const t=Date.parse(v);return Number.isNaN(t)?null:new Date(t).toISOString();};
const mail=v=>{const s=txt(v);return s?s.toLowerCase():null;};

// Columnas extraídas por tabla (nombres exactos del esquema).
const COLS={
 crm_leads:l=>({name:txt(l.name),email:mail(l.email),phone:txt(l.phone),status:txt(l.status),pipeline:txt(l.pipeline),stage_id:txt(l.stageId),owner:txt(l.owner),value:num(l.value)}),
 crm_tasks:t=>({lead_id:txt(t.leadId),due_at:when(t.dueAt),done:t.done===true}),
 crm_quotes:q=>({lead_id:txt(q.leadId),number:txt(q.number),status:txt(q.status)}),
 crm_conversations:c=>({lead_id:txt(c.leadId),at:when(c.at)}),
 crm_enrollments:e=>({lead_id:txt(e.leadId),sequence_id:txt(e.sequenceId),status:txt(e.status)}),
};

// Las filas no guardan posición; el orden se reconstruye con el mismo criterio con el que la app agrega cada lista.
const cmp=(...keys)=>(a,b)=>{for(const [k,dir] of keys){const x=String(a[k]??''),y=String(b[k]??'');if(x!==y)return (x<y?-1:1)*dir;}return a.id<b.id?-1:a.id>b.id?1:0;};
const ORDER={
 leads:cmp(['createdAt',1]),
 tasks:cmp(['createdAt',1],['dueAt',1]),
 quotes:cmp(['createdAt',1]),
 conversations:cmp(['at',1]),
 enrollments:cmp(['startedAt',1]),
 publications:cmp(['createdAt',1]),
 usage:cmp(['date',-1]),
 events:cmp(['timestamp',1]),
 activity:cmp(['timestamp',-1]),
};

export function toRows(state){
 const out={};
 for(const [list,table] of Object.entries(LISTS)){const cols=COLS[table];out[table]=(state?.[list]||[]).map(item=>({id:String(item.id),data:item,cols:cols?cols(item):{}}));}
 const s=state?.settings||{},prefs={};
 for(const k of PREFS)if(s[k]!==undefined)prefs[k]=s[k];
 out.crm_settings=[{id:'prefs',data:prefs,cols:{}},...SETTING_ROWS.filter(k=>s[k]!==undefined).map(k=>({id:k,data:{value:s[k]},cols:{}}))];
 return out;
}

function rawState(rowsByTable){
 const state=emptyState();
 for(const [list,table] of Object.entries(LISTS)){
  const items=(rowsByTable?.[table]||[]).filter(r=>r&&r.data&&typeof r.data==='object'&&!Array.isArray(r.data)).map(r=>({...r.data,id:String(r.data.id??r.id)}));
  state[list]=items.sort(ORDER[list]);
 }
 const rows=new Map((rowsByTable?.crm_settings||[]).filter(r=>r&&r.data&&typeof r.data==='object').map(r=>[r.id,r.data]));
 const prefs=rows.get('prefs');
 if(prefs)for(const k of PREFS)if(prefs[k]!==undefined)state.settings[k]=prefs[k];
 for(const k of SETTING_ROWS){const row=rows.get(k);if(row&&row.value!==undefined)state.settings[k]=row.value;}
 return state;
}

// Un elemento dañado en la nube no debe dejar el panel inservible para todo el equipo: se descarta solo ese elemento o ese ajuste.
function salvage(state){
 const out=emptyState();let dropped=0;
 for(const list of Object.keys(LISTS))out[list]=state[list].filter(item=>{try{validateState({[list]:[item]},{lenient:true});return true;}catch{dropped++;return false;}});
 for(const [k,v] of Object.entries(state.settings)){try{validateState({settings:{[k]:v}},{lenient:true});out.settings[k]=v;}catch{dropped++;}}
 if(dropped)console.warn(`ORNAT CRM: ${dropped} registro(s) de la nube no son válidos y se omitieron.`);
 return out;
}

export function fromRows(rowsByTable){
 const state=rawState(rowsByTable);
 try{validateState(state,{lenient:true});return state;}catch{return salvage(state);}
}

export const CRM_SPEC={key:KEY,tables:[...Object.values(LISTS),'crm_settings'],toRows,fromRows};
