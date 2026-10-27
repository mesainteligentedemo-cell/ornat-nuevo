// Vista «Reportes»: gráficas SVG accesibles (un solo tono, etiquetas directas) con tabla alternativa y exportación CSV.
import {dayKey,addDays} from './store.js';
import {defaultReportFilters,conversionByChannel,timeInStage,forecast,ownerPerformance,lostReasons,quotesReport,toCSV,REPORT_COLUMNS} from './reports.js';
import {quoteSummary,fmtMoney} from './quotes.js';
import {setCtx,$,esc,btn,mxn,num,hbars} from './ui-common.js';

let C,f=defaultReportFilters();
export const init=c=>{C=c;setCtx(c);};
const S=()=>C.getState();
const pct=v=>v===null||v===undefined?'—':`${Math.round(v*100)}%`;
const days=v=>v===null||v===undefined?'—':`${(Math.round(v*10)/10).toLocaleString('es-MX')} d`;

function data(){
 const st=S(),P=st.settings.pipelines,now=new Date();
 const pf={...f},pipe=f.pipeline||P[0].id;
 return {
  channel:conversionByChannel(st.leads,pf),
  stage:timeInStage(st.leads,P,{...pf,pipeline:pipe},now),
  forecast:forecast(st.leads,P,{...pf,pipeline:pipe}),
  owner:ownerPerformance(st.leads,st.tasks,pf),
  lost:lostReasons(st.leads,pf),
  quotes:quotesReport(st.quotes,pf,now),pipe,
 };
}
const tbl=(cols,rows,fmt)=>`<details class="alt-table"><summary>Ver tabla de datos</summary><div class="table-wrap"><table><thead><tr>${cols.map(c=>`<th scope="col">${esc(c[1])}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(([k],i)=>`<${i?'td':'th scope="row"'}${i?' class="num"':''}>${esc(fmt(k,r[k],r))}</${i?'td':'th'}>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
const card=(id,title,sub,body,csvKey,rowsLen)=>`<section class="card report" id="rep-${id}"><div class="card-head"><div><h2>${esc(title)}</h2><p class="muted">${esc(sub)}</p></div>${btn('Exportar CSV ↓','report-csv','small',`data-report="${id}" ${rowsLen?'':'disabled'}`)}</div>${body}</section>`;
const noData=(t='Sin datos en este periodo.')=>`<p class="muted nodata">${esc(t)}</p>`;

export function render(){
 const st=S(),P=st.settings.pipelines,d=data(),owners=[...new Set([...st.leads.map(l=>l.owner),...C.owners()].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
 const money=(k,v)=>['value','weighted','wonValue','openValue'].includes(k)?mxn(v):['avgDays'].includes(k)?days(v):['conversion','winRate','taskRate'].includes(k)?pct(v):v??'—';
 const ch=d.channel,fc=d.forecast,tm=d.stage.filter(s=>s.kind==='open'),ow=d.owner,lo=d.lost,qr=d.quotes;
 const sum=quoteSummary(S().quotes);
 $('#content').innerHTML=`<div class="notice">Todas las cifras salen de los contactos, tareas y cotizaciones guardados en este navegador. «Conversión» = ganados ÷ contactos del periodo; «tasa de cierre» = ganados ÷ (ganados + perdidos).</div>
 <section class="card"><form class="rep-filters" id="rep-filters">
  <label class="field"><span>Desde</span><input id="rf-from" type="date" value="${esc(f.from)}"></label><label class="field"><span>Hasta</span><input id="rf-to" type="date" value="${esc(f.to)}"></label>
  <label class="field"><span>Pipeline</span><select id="rf-pipe"><option value="">Todos (los reportes por etapa usan ${esc(P[0].name)})</option>${P.map(p=>`<option value="${esc(p.id)}" ${f.pipeline===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label>
  <label class="field"><span>Responsable</span><select id="rf-owner"><option value="">Todos</option><option value="__none" ${f.owner==='__none'?'selected':''}>Sin responsable</option>${owners.map(o=>`<option ${f.owner===o?'selected':''}>${esc(o)}</option>`).join('')}</select></label>
  <div class="rep-presets" role="group" aria-label="Periodos rápidos">${btn('30 días','rep-preset','small',`data-days="30"`)}${btn('90 días','rep-preset','small',`data-days="90"`)}${btn('Este año','rep-preset','small',`data-days="year"`)}${btn('Todo','rep-preset','small',`data-days=""`)}</div></form></section>
 <div class="grid-two">
 ${card('channel','Conversión por canal','Contactos del periodo y cuántos terminaron ganados',ch.length?hbars({title:'Contactos por canal',desc:ch.map(r=>`${r.channel}: ${r.total} contactos, ${r.won} ganados`).join('; '),rows:ch.map(r=>({label:r.channel,value:r.total,part:r.won,partLabel:'Ganados',text:`${r.total} · ${r.won} ganados (${pct(r.conversion)})`})),format:num})+`<p class="legend"><i class="sw light"></i>Contactos <i class="sw dark"></i>Ganados</p>`+tbl(REPORT_COLUMNS.channel,ch,money):noData(),'channel',ch.length)}
 ${card('forecast',`Pronóstico ponderado · ${P.find(p=>p.id===d.pipe).name}`,`Valor de contactos abiertos × probabilidad de su etapa${fc.noValue?` · ${fc.noValue} sin valor no suman`:''}`,fc.rows.some(r=>r.count)?`<p class="big-number"><b>${mxn(fc.total.weighted)}</b><span>ponderado de ${mxn(fc.total.value)} abiertos</span></p>`+hbars({title:'Valor ponderado por etapa',desc:fc.rows.map(r=>`${r.stage}: ${mxn(r.weighted)} ponderado de ${mxn(r.value)}`).join('; '),rows:fc.rows.map(r=>({label:`${r.stage} (${r.prob}%)`,value:r.weighted,text:`${mxn(r.weighted)} de ${mxn(r.value)}`})),format:mxn})+tbl(REPORT_COLUMNS.forecast,fc.rows,money):noData('No hay contactos abiertos con valor.'),'forecast',fc.rows.length)}
 </div><div class="grid-two">
 ${card('stage','Tiempo promedio por etapa','Días que los contactos pasaron en cada etapa abierta, según su línea de tiempo',tm.some(r=>r.avgDays!==null)?hbars({title:'Días promedio por etapa',desc:tm.map(r=>`${r.stage}: ${days(r.avgDays)}`).join('; '),rows:tm.map(r=>({label:r.stage,value:r.avgDays||0,text:`${days(r.avgDays)} · ${r.leads} contactos`})),format:v=>days(v)})+tbl(REPORT_COLUMNS.stage,tm,money):noData(),'stage',tm.length)}
 ${card('lost','Motivos de pérdida','Contactos perdidos agrupados por el motivo registrado',lo.length?hbars({title:'Contactos perdidos por motivo',desc:lo.map(r=>`${r.reason}: ${r.count}`).join('; '),rows:lo.map(r=>({label:r.reason,value:r.count,text:`${r.count} · ${mxn(r.value)}`})),format:num})+tbl(REPORT_COLUMNS.lost,lo,money):noData('No hay contactos perdidos en el periodo.'),'lost',lo.length)}
 </div>
 ${card('owner','Desempeño por responsable','Contactos, ganados, valor y tareas cumplidas (por fecha de vencimiento en el periodo)',ow.length?hbars({title:'Valor ganado por responsable',desc:ow.map(r=>`${r.owner}: ${mxn(r.wonValue)} ganado`).join('; '),rows:ow.map(r=>({label:r.owner,value:r.wonValue,text:`${mxn(r.wonValue)} · ${r.won} ganados`})),format:mxn})+tbl(REPORT_COLUMNS.owner,ow,money):noData(),'owner',ow.length)}
 ${card('quotes','Cotizaciones','Número y total por estado y moneda (sin convertir entre monedas)',qr.length?`<div class="mini-stats">${Object.entries(sum).map(([c,s])=>`<div><span class="q-label">${c} cotizado</span><b>${fmtMoney(s.quoted,c)}</b></div><div><span class="q-label">${c} aceptado</span><b>${fmtMoney(s.accepted,c)}</b></div>`).join('')}</div>`+tbl(REPORT_COLUMNS.quotes,qr,(k,v)=>k==='total'?fmtMoney(v,'MXN').replace(' MXN',''):v):noData('Aún no hay cotizaciones.'),'quotes',qr.length)}`;
}

function csvFor(id){const d=data();const map={channel:[REPORT_COLUMNS.channel,d.channel],forecast:[REPORT_COLUMNS.forecast,d.forecast.rows],stage:[REPORT_COLUMNS.stage,d.stage.filter(s=>s.kind==='open')],owner:[REPORT_COLUMNS.owner,d.owner],lost:[REPORT_COLUMNS.lost,d.lost],quotes:[REPORT_COLUMNS.quotes,d.quotes]};const [cols,rows]=map[id]||[];return cols?toCSV(cols,rows):'';}
export function handleAction(action,el){
 if(action==='report-csv'){const id=el.dataset.report;C.download(csvFor(id),`ornat-reporte-${id}.csv`,'text/csv;charset=utf-8');C.toast('CSV descargado.');return true;}
 if(action==='rep-preset'){const v=el.dataset.days,today=dayKey(new Date());f={...f,from:v===''?'':v==='year'?`${today.slice(0,4)}-01-01`:addDays(today,-Number(v)),to:v===''?'':today};render();return true;}
 return false;
}
export function handleChange(el){
 const m={'rf-from':'from','rf-to':'to','rf-pipe':'pipeline','rf-owner':'owner'};
 if(m[el.id]){f={...f,[m[el.id]]:el.value};render();return true;}
 return false;
}
export const handleInput=()=>false;
// El formulario de filtros no se envía nunca (antes lo hacía un onsubmit en línea).
document.addEventListener('submit',e=>{if(e.target?.id==='rep-filters')e.preventDefault();});
export const handleSubmit=()=>undefined;
