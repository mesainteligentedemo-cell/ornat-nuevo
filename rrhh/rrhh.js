// ORNAT · pantalla de Recursos Humanos (modo demo). La lógica y los permisos viven en shared/people.js.
import { data, ROLES } from '../shared/data.js';
import { createPeople, AREAS, CONTRACTS, DOC_TYPES, REQUEST_TYPES, REQUEST_STATUS, WORKWEEKS, SENSITIVE_FIELDS, docState, vacationDaysForYear, completedYears, reviewResult, holidaysMX, maskValue, DEFAULT_ONBOARDING } from '../shared/people.js';
import { createTraining } from '../shared/training.js';
import { putFile, getFile, deleteFile, clearFiles, MAX_FILE_BYTES } from '../shared/people-files.js';
import { esc, toCSV, downloadText, fmtDate, fmtDateLong, todayISO, addDays, diffDays, isISODate, toUTC, MESES_LARGO, rid } from '../shared/ui.js';
import '../shared/session-bar.js';
import '../shared/voice-widget.js';

const d = data();
const sess = () => d.getSession();
const audit = (a, det, area) => { try { d.audit.log(a, det, area); } catch {} };
const P = createPeople({ getSession: sess, listUsers: () => d.users.list(), audit });
const TR = createTraining({ getSession: sess, listUsers: () => d.users.list(), audit });
const $main = document.getElementById('main'); const $nav = document.getElementById('nav');
const ui = { f: { q: '', area: '', position: '', status: 'activo', tenure: '', contract: '' }, cal: todayISO().slice(0, 7), calYear: new Date().getFullYear() };

const DEMO_DOMAIN = '@ejemplo.ornat.mx';
const DOC_CLASS = { entregado: 'good', pendiente: 'soft', vencido: 'bad', 'por vencer': 'warn' };
const REQ_CLASS = { pendiente: 'warn', aprobada: 'good', rechazada: 'bad', cancelada: 'soft' };
const tag = (txt, cls = 'soft') => `<span class="tag ${cls}">${esc(txt)}</span>`;

function toast(msg, kind = 'ok') { const el = document.createElement('div'); el.className = `toast ${kind === 'error' ? 'error' : ''}`; el.textContent = msg; document.getElementById('toasts').append(el); setTimeout(() => el.remove(), kind === 'error' ? 6500 : 3200); }
const guard = fn => async (...a) => { try { return await fn(...a); } catch (e) { toast(e.message || 'No se pudo completar la acción.', 'error'); } };
const route = () => { const p = (location.hash.replace(/^#\/?/, '') || '').split('/').map(decodeURIComponent); return { name: p[0], a: p[1] || '', b: p[2] || '' }; };
const go = h => { if (location.hash === h) render(); else location.hash = h; };
const tenureText = hire => { if (!isISODate(hire)) return '—'; const t = todayISO(); const y = completedYears(hire, t); const months = Math.max(0, (Number(t.slice(0, 4)) - Number(hire.slice(0, 4))) * 12 + Number(t.slice(5, 7)) - Number(hire.slice(5, 7)) - (t.slice(8) < hire.slice(8) ? 1 : 0)) - y * 12; return y ? `${y} a ${months} m` : `${months} m`; };
const sel = (name, opts, cur, extra = '') => `<select name="${name}" ${extra}>${opts.map(([v, l]) => `<option value="${esc(v)}"${String(cur) === String(v) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;

/* ---------- contexto ---------- */
function ctx() {
  const user = sess().user; const owner = user.role === 'owner'; const mine = P.me(); const emps = P.employees.list({ status: '' }); const byId = Object.fromEntries(emps.map(e => [e.id, e]));
  const reports = mine ? emps.filter(e => e.managerId === mine.id).map(e => e.id) : [];
  const pending = P.requests.list({ scope: 'team' }).filter(r => r.status === 'pendiente' && (owner || reports.includes(r.employeeId)) && r.employeeId !== mine?.id);
  return { user, owner, mine, emps, byId, reports, pending };
}
function navHTML(c, r) {
  const items = [];
  if (c.owner) items.push(['panel', 'Panel']);
  items.push(['directorio', 'Directorio'], ['organigrama', 'Organigrama'], ['mi', 'Mi expediente'], ['vacaciones', 'Vacaciones y permisos', c.pending.length], ['evaluaciones', 'Evaluaciones']);
  if (c.owner) items.push(['ingreso', 'Ingreso y baja'], ['config', 'Configuración']);
  const cur = { persona: 'directorio', alta: 'directorio', editar: 'directorio', evaluacion: 'evaluaciones' }[r.name] || r.name;
  return items.map(([k, l, n]) => `<a href="#/${k}"${cur === k ? ' aria-current="page"' : ''}>${l}${n ? `<span class="count" aria-label="${n} por aprobar">${n}</span>` : ''}</a>`).join('');
}

function render() {
  const session = sess(); const r = route();
  if (!session) { $nav.innerHTML = ''; $main.innerHTML = `<div class="login"><div class="brand-mark">ORNAT</div><p class="eyebrow">( Recursos Humanos )</p><h1>Entra para continuar</h1><p class="lead">Inicia sesión con tu cuenta ORNAT.</p><a class="btn" href="/cuenta/?next=${encodeURIComponent(location.pathname + location.search)}">Entrar</a></div>`; return; }
  if (session.user.role === 'client') { $nav.innerHTML = ''; $main.innerHTML = `<div class="login"><p class="eyebrow">( Recursos Humanos )</p><h1>Sin acceso</h1><p class="lead">Tu rol (${esc(ROLES.client)}) no tiene acceso a Recursos Humanos.</p><a class="btn" href="/cuenta/">Ir a Cuenta</a></div>`; return; }
  const c = ctx(); $nav.innerHTML = navHTML(c, r);
  const scroll = window.scrollY; let html = '';
  try {
    const name = r.name || (c.owner ? 'panel' : 'directorio');
    const needOwner = () => { if (!c.owner) throw new Error('Esta sección es solo para el Dueño.'); };
    if (name === 'panel') { needOwner(); html = panelHTML(c); }
    else if (name === 'directorio') html = directorioHTML(c);
    else if (name === 'organigrama') html = orgHTML(c);
    else if (name === 'mi') { if (!c.mine) html = emptyExpediente(c); else { location.replace(`#/persona/${c.mine.id}`); return; } }
    else if (name === 'persona') html = personaHTML(c, r.a, r.b || 'resumen');
    else if (name === 'alta') { needOwner(); html = altaHTML(c, null); }
    else if (name === 'editar') { needOwner(); html = altaHTML(c, c.byId[r.a]); }
    else if (name === 'vacaciones') html = vacacionesHTML(c);
    else if (name === 'evaluaciones') html = evaluacionesHTML(c);
    else if (name === 'evaluacion') html = evaluacionFormHTML(c, r.a);
    else if (name === 'ingreso') { needOwner(); html = ingresoHTML(c); }
    else if (name === 'config') { needOwner(); html = configHTML(); }
    else html = c.owner ? panelHTML(c) : directorioHTML(c);
  } catch (e) { html = `<div class="card"><h2>No se pudo mostrar esta pantalla</h2><p class="msg" data-state="error">${esc(e.message)}</p><a class="btn" href="#/directorio">Ir al directorio</a></div>`; }
  $main.innerHTML = html;
  if (document.getElementById('dir-body')) fillDirectory(c);
  document.title = 'Recursos Humanos | ORNAT';
  if (ui.keepScroll) { window.scrollTo(0, scroll); ui.keepScroll = false; }
}
const emptyExpediente = c => `<p class="eyebrow">( RRHH )</p><h1>Mi expediente</h1><div class="card empty"><h3>Aún no tienes expediente</h3><p>Tu usuario (${esc(c.user.email)}) no está vinculado a un colaborador. ${c.owner ? 'Da de alta a una persona con tu correo desde el Directorio para vincularla.' : 'Pide al Dueño que te dé de alta en RRHH.'}</p>${c.owner ? '<a class="btn" href="#/alta">Nueva alta</a>' : ''}</div>`;

/* ---------- panel ---------- */
function overdueMap() { const m = {}; try { for (const row of TR.teamReport()) if (row.status === 'vencido') m[row.user.id] = (m[row.user.id] || 0) + 1; } catch {} return m; }
function panelHTML(c) {
  const ov = overdueMap(); const p = P.panel(ov); const userEmp = Object.fromEntries(c.emps.filter(e => e.userId).map(e => [e.userId, e]));
  const uname = id => userEmp[id]?.name || d.users.list().find(u => u.id === id)?.name || id;
  return `<p class="eyebrow">( Recursos Humanos )</p><h1>Panel RRHH</h1><p class="lead">Resumen de la plantilla al ${fmtDateLong(todayISO())}.</p>
  <div class="row" style="margin-bottom:18px"><button class="btn ghost sm" type="button" data-act="csv-panel">Exportar resumen (CSV)</button><a class="btn sm" href="#/alta">Nueva alta</a></div>
  ${!c.emps.length ? '<div class="banner"><p>Aún no hay colaboradores. Carga un equipo de ejemplo de 8 personas ficticias para probar todo el módulo.</p><button class="btn sm" type="button" data-act="seed">Cargar equipo de ejemplo</button></div>' : ''}
  <div class="stats"><div class="card stat"><b>${p.headcount}</b><span>Plantilla activa</span></div><div class="card stat"><b>${p.altas}</b><span>Altas este año</span></div><div class="card stat"><b>${p.bajas}</b><span>Bajas este año</span></div><div class="card stat"><b>${p.pendingRequests.length}</b><span>Por aprobar</span></div><div class="card stat"><b>${p.missingDocs.length}</b><span>Con documentos faltantes</span></div></div>
  <div class="grid wide">
  <section class="card"><h2>Vacaciones y permisos por aprobar</h2>${p.pendingRequests.length ? `<ul class="checklist">${p.pendingRequests.map(r => `<li><span style="flex:1"><strong>${esc(r.name)}</strong> · ${esc(REQUEST_TYPES[r.type])}<br><span class="hint">${fmtDate(r.from)} al ${fmtDate(r.to)} · ${r.days} día(s)</span></span></li>`).join('')}</ul><p><a class="btn sm" href="#/vacaciones">Resolver</a></p>` : '<p class="hint">Nada pendiente.</p>'}</section>
  <section class="card"><h2>Documentos faltantes</h2>${p.missingDocs.length ? `<ul class="checklist">${p.missingDocs.slice(0, 8).map(x => `<li><span style="flex:1"><a href="#/persona/${esc(x.e.id)}/documentos"><strong>${esc(x.e.name)}</strong></a><br><span class="hint">${x.missing.map(k => esc(DOC_TYPES[k])).join(', ')}</span></span>${tag(`${x.missing.length}`, 'warn')}</li>`).join('')}</ul>${p.missingDocs.length > 8 ? `<p class="hint">y ${p.missingDocs.length - 8} personas más</p>` : ''}` : '<p class="hint">Todos los expedientes están completos.</p>'}</section>
  <section class="card"><h2>Próximos aniversarios (30 días)</h2>${p.anniversaries.length ? `<ul class="checklist">${p.anniversaries.map(x => `<li><span style="flex:1"><strong>${esc(x.e.name)}</strong><br><span class="hint">${x.years} año(s) · ${fmtDate(x.date)}</span></span>${tag(x.in === 0 ? 'hoy' : `en ${x.in} d`, 'lime')}</li>`).join('')}</ul>` : '<p class="hint">Sin aniversarios próximos.</p>'}</section>
  <section class="card"><h2>Próximos cumpleaños (30 días)</h2>${p.birthdays.length ? `<ul class="checklist">${p.birthdays.map(x => `<li><span style="flex:1"><strong>${esc(x.e.name)}</strong><br><span class="hint">${fmtDate(x.date).replace(/ \d{4}$/, '')}</span></span>${tag(x.in === 0 ? 'hoy' : `en ${x.in} d`, 'lime')}</li>`).join('')}</ul>` : '<p class="hint">Sin cumpleaños próximos.</p>'}</section>
  <section class="card"><h2>Cursos vencidos</h2>${p.overdue.length ? `<ul class="checklist">${p.overdue.map(x => `<li><span style="flex:1"><strong>${esc(uname(x.id))}</strong></span>${tag(`${x.n} vencido(s)`, 'bad')}</li>`).join('')}</ul><p><a class="btn sm ghost" href="/capacitacion/#/equipo">Ver en Capacitación</a></p>` : '<p class="hint">Nadie tiene cursos vencidos.</p>'}</section>
  <section class="card"><h2>Plantilla por área</h2>${p.byArea.length ? `<ul class="checklist">${p.byArea.map(([a, n]) => `<li><span style="flex:1">${esc(a)}</span><strong>${n}</strong></li>`).join('')}</ul>` : '<p class="hint">Sin datos.</p>'}</section></div>`;
}

/* ---------- directorio ---------- */
function directorioHTML(c) {
  const f = ui.f; const positions = [...new Set(c.emps.map(e => e.position).filter(Boolean))].sort();
  return `<p class="eyebrow">( Recursos Humanos )</p><h1>Directorio</h1><p class="lead">Quién es quién en ORNAT. ${c.owner ? 'Como Dueño ves y editas todo.' : 'Aquí no se muestran datos sensibles como salario, CURP, RFC, NSS ni cuentas.'}</p>
  ${c.owner ? `<div class="row" style="margin-bottom:18px"><a class="btn" href="#/alta">Nueva alta</a><button class="btn ghost" type="button" data-act="csv-dir">Exportar CSV</button>${c.emps.some(e => e.source === 'demo') ? '<button class="btn ghost" type="button" data-act="clear-seed">Quitar equipo de ejemplo</button>' : '<button class="btn ghost" type="button" data-act="seed">Cargar equipo de ejemplo</button>'}</div>` : ''}
  <form class="filters card" id="dir-filters" role="search" aria-label="Filtrar colaboradores"><label class="f search">Buscar<input type="search" name="q" value="${esc(f.q)}" placeholder="Nombre, puesto, correo" autocomplete="off"></label>
  <label class="f">Área${sel('area', [['', 'Todas'], ...AREAS.map(a => [a, a])], f.area)}</label><label class="f">Puesto${sel('position', [['', 'Todos'], ...positions.map(p => [p, p])], f.position)}</label>
  <label class="f">Estado${sel('status', [['', 'Todos'], ['activo', 'Activo'], ['baja', 'Baja']], f.status)}</label><label class="f">Antigüedad${sel('tenure', [['', 'Cualquiera'], ['<1', 'Menos de 1 año'], ['1-3', '1 a 3 años'], ['3-5', '3 a 5 años'], ['5+', '5 años o más']], f.tenure)}</label>
  <label class="f">Contrato${sel('contract', [['', 'Todos'], ...Object.entries(CONTRACTS)], f.contract)}</label></form>
  <p class="hint" id="dir-count" aria-live="polite"></p>
  <div class="card tight"><div class="table-wrap"><table><caption class="sr">Colaboradores</caption><thead><tr><th scope="col">Nombre</th><th scope="col">Puesto</th><th scope="col">Área</th><th scope="col">Jefe directo</th><th scope="col">Ingreso</th><th scope="col">Antigüedad</th><th scope="col">Contrato</th><th scope="col">Ubicación</th><th scope="col">Contacto</th><th scope="col">Estado</th></tr></thead><tbody id="dir-body"></tbody></table></div></div>`;
}
function fillDirectory(c) {
  const list = P.employees.list(ui.f); const body = document.getElementById('dir-body'); document.getElementById('dir-count').textContent = `${list.length} ${list.length === 1 ? 'persona' : 'personas'}`;
  body.innerHTML = list.map(e => { const link = c.owner || e.id === c.mine?.id; return `<tr><td>${link ? `<a href="#/persona/${esc(e.id)}"><strong>${esc(e.name)}</strong></a>` : `<strong>${esc(e.name)}</strong>`} ${e.source === 'demo' ? tag('ejemplo', 'demo') : ''}</td><td>${esc(e.position)}</td><td>${esc(e.area)}</td><td>${esc(c.byId[e.managerId]?.name || '—')}</td><td>${fmtDate(e.hireDate) || '—'}</td><td>${tenureText(e.hireDate)}</td><td>${esc(CONTRACTS[e.contract])}</td><td>${esc(e.location)}</td><td>${e.email ? `<a href="mailto:${esc(e.email)}">${esc(e.email)}</a>` : ''}${e.phone ? `<br><span class="hint">${esc(e.phone)}</span>` : ''}</td><td>${tag(e.status === 'activo' ? 'Activo' : 'Baja', e.status === 'activo' ? 'good' : 'soft')}</td></tr>`; }).join('') || '<tr><td colspan="10" class="hint">Sin resultados.</td></tr>';
}
function orgHTML(c) {
  const active = c.emps.filter(e => e.status === 'activo'); const ids = new Set(active.map(e => e.id));
  const roots = active.filter(e => !e.managerId || !ids.has(e.managerId));
  const node = (e, depth = 0) => { const kids = active.filter(k => k.managerId === e.id); const link = c.owner || e.id === c.mine?.id;
    return `<li><${link ? `a href="#/persona/${esc(e.id)}"` : 'div'} class="node"><strong>${esc(e.name)}</strong><small>${esc(e.position)} · ${esc(e.area)}</small></${link ? 'a' : 'div'}>${kids.length && depth < 12 ? `<ul>${kids.map(k => node(k, depth + 1)).join('')}</ul>` : ''}</li>`; };
  return `<p class="eyebrow">( Recursos Humanos )</p><h1>Organigrama</h1><p class="lead">Estructura por jefe directo. Solo personas activas.</p>${roots.length ? `<div class="card"><ul class="org" aria-label="Organigrama">${roots.map(r => node(r)).join('')}</ul></div>` : '<div class="card empty"><h3>Sin colaboradores</h3><p>Da de alta a alguien o carga el equipo de ejemplo.</p></div>'}`;
}

/* ---------- alta / edición ---------- */
function altaHTML(c, e) {
  const edit = !!e; const s = e?.sensitive || {}; const pubCourses = (() => { try { return TR.courses.list().filter(x => x.status === 'publicado'); } catch { return []; } })();
  const mgrs = c.emps.filter(m => m.id !== e?.id && m.status === 'activo');
  const unlinked = d.users.list().filter(u => u.role !== 'client' && !c.emps.some(x => x.userId === u.id && x.id !== e?.id));
  return `<p class="eyebrow"><a href="#/directorio">Directorio</a> / ${edit ? 'Editar' : 'Nueva alta'}</p><h1>${edit ? esc(e.name) : 'Nueva alta'}</h1>
  <form id="emp-form" class="stack" data-id="${esc(e?.id || '')}" novalidate><section class="card"><h2>Datos generales</h2><div class="fields">
  <label class="f">Nombre completo<input name="name" value="${esc(e?.name || '')}" required maxlength="120"></label><label class="f">Puesto<input name="position" value="${esc(e?.position || '')}" maxlength="100"></label>
  <label class="f">Área${sel('area', AREAS.map(a => [a, a]), e?.area || AREAS[1])}</label><label class="f">Jefe directo${sel('managerId', [['', '— Sin jefe —'], ...mgrs.map(m => [m.id, m.name])], e?.managerId || '')}</label>
  <label class="f">Fecha de ingreso<input type="date" name="hireDate" value="${esc(e?.hireDate || todayISO())}"></label><label class="f">Fecha de nacimiento<input type="date" name="birthDate" value="${esc(e?.birthDate || '')}"></label>
  <label class="f">Tipo de contrato${sel('contract', Object.entries(CONTRACTS), e?.contract || 'indeterminado')}</label><label class="f">Ubicación<input name="location" value="${esc(e?.location || '')}" maxlength="100"></label>
  <label class="f">Correo laboral<input type="email" name="email" value="${esc(e?.email || '')}" maxlength="250" autocomplete="off"></label><label class="f">Teléfono<input type="tel" name="phone" value="${esc(e?.phone || '')}" maxlength="30"></label>
  ${edit ? `<label class="f">Estado${sel('status', [['activo', 'Activo'], ['baja', 'Baja']], e.status)}</label><label class="f">Fecha de baja<input type="date" name="endDate" value="${esc(e.endDate || '')}"></label>` : ''}
  <label class="f">Usuario de la plataforma${sel('userId', [['', '— Sin vincular —'], ...unlinked.map(u => [u.id, `${u.name} (${ROLES[u.role]})`])], e?.userId || '')}</label></div></section>
  <section class="card"><h2>Datos sensibles <span class="tag lime">Solo Dueño</span></h2><p class="hint">Demo local: en producción estos datos solo viven en un backend cifrado.</p><div class="fields">
  <label class="f">Salario mensual (MXN)<input type="number" name="salary" min="0" step="0.01" value="${esc(s.salary ?? '')}" inputmode="decimal"></label><label class="f">CURP<input name="curp" value="${esc(s.curp || '')}" maxlength="18" autocomplete="off" style="text-transform:uppercase"></label>
  <label class="f">RFC<input name="rfc" value="${esc(s.rfc || '')}" maxlength="13" autocomplete="off" style="text-transform:uppercase"></label><label class="f">NSS (11 dígitos)<input name="nss" value="${esc(s.nss || '')}" maxlength="11" inputmode="numeric" autocomplete="off"></label>
  <label class="f">Cuenta bancaria / CLABE<input name="bank" value="${esc(s.bank || '')}" maxlength="22" inputmode="numeric" autocomplete="off"></label></div></section>
  ${edit ? '' : `<section class="card"><h2>Acceso y onboarding</h2><label class="f chk"><input type="checkbox" name="makeUser"${unlinked.length ? '' : ' checked'}> Crear acceso a la plataforma con este correo</label><label class="f" style="max-width:260px">Rol del acceso${sel('role', [['editor', ROLES.editor], ['sales', ROLES.sales]], 'sales')}</label>
  <label class="f chk"><input type="checkbox" name="onboarding" checked> Iniciar checklist de onboarding (asigna los cursos de la plantilla${pubCourses.length ? '' : '; publica cursos en Capacitación para que se asignen'})</label></section>`}
  <p class="msg" id="emp-msg" role="alert"></p><div class="row"><button class="btn" type="submit">${edit ? 'Guardar cambios' : 'Dar de alta'}</button><a class="btn ghost" href="${edit ? `#/persona/${esc(e.id)}` : '#/directorio'}">Cancelar</a></div></form>`;
}

/* ---------- expediente ---------- */
function personaHTML(c, id, tab) {
  const e = c.byId[id]; if (!e) throw new Error('Ese colaborador no existe.');
  if (!c.owner && c.mine?.id !== e.id) throw new Error('Solo puedes ver tu propio expediente.');
  const self = c.mine?.id === e.id; const tabs = [['resumen', 'Resumen'], ['documentos', 'Documentos'], ['ingreso', 'Ingreso y baja'], ['ausencias', 'Ausencias'], ['desempeno', 'Desempeño'], ['capacitacion', 'Capacitación']];
  const body = { resumen: tabResumen, documentos: tabDocs, ingreso: tabChecklists, ausencias: tabAusencias, desempeno: tabDesempeno, capacitacion: tabCapacitacion }[tab] || tabResumen;
  return `<p class="eyebrow"><a href="#/directorio">Directorio</a> / ${self ? 'Mi expediente' : 'Expediente'}</p><div class="row between"><h1>${esc(e.name)}</h1><span class="row">${c.owner ? `<a class="btn ghost sm" href="#/editar/${esc(e.id)}">Editar</a>` : ''}</span></div>
  <p class="lead" style="margin-bottom:14px">${esc(e.position)}${e.position ? ' · ' : ''}${esc(e.area)} ${tag(e.status === 'activo' ? 'Activo' : 'Baja', e.status === 'activo' ? 'good' : 'soft')} ${e.source === 'demo' ? tag('ejemplo', 'demo') : ''}</p>
  <div class="tabs" role="navigation" aria-label="Secciones del expediente">${tabs.map(([k, l]) => `<a href="#/persona/${esc(e.id)}/${k}"${tab === k ? ' aria-current="true"' : ''}>${l}</a>`).join('')}</div>${body(c, e, self)}`;
}
function tabResumen(c, e) {
  const s = e.sensitive;
  return `<div class="grid wide"><section class="card"><h2>Datos generales</h2><dl class="kv"><dt>Correo laboral</dt><dd>${esc(e.email) || '—'}</dd><dt>Teléfono</dt><dd>${esc(e.phone) || '—'}</dd><dt>Jefe directo</dt><dd>${esc(c.byId[e.managerId]?.name || '—')}</dd><dt>Ingreso</dt><dd>${fmtDateLong(e.hireDate) || '—'} (${tenureText(e.hireDate)})</dd><dt>Contrato</dt><dd>${esc(CONTRACTS[e.contract])}</dd><dt>Ubicación</dt><dd>${esc(e.location) || '—'}</dd><dt>Cumpleaños</dt><dd>${e.birthDate ? fmtDate(e.birthDate).replace(/ \d{4}$/, '') : '—'}</dd>${e.status === 'baja' ? `<dt>Baja</dt><dd>${fmtDateLong(e.endDate) || '—'}</dd>` : ''}</dl></section>
  <section class="card"><h2>Datos sensibles</h2>${e.sensitiveHidden ? `<p class="hint"><strong>Información reservada para Dirección.</strong> Salario, CURP, RFC, NSS y cuenta bancaria solo los ve el Dueño.</p><dl class="kv">${['Salario', 'CURP', 'RFC', 'NSS', 'Cuenta'].map(k => `<dt>${k}</dt><dd class="masked" aria-label="Oculto">••••••••</dd>`).join('')}</dl>` : `<dl class="kv"><dt>Salario mensual</dt><dd>${s.salary === '' ? '—' : `$${Number(s.salary).toLocaleString('es-MX')} MXN`}</dd><dt>CURP</dt><dd>${esc(s.curp) || '—'}</dd><dt>RFC</dt><dd>${esc(s.rfc) || '—'}</dd><dt>NSS</dt><dd>${esc(s.nss) || '—'}</dd><dt>Cuenta</dt><dd>${esc(s.bank) || '—'}</dd></dl><p class="hint">Demo local: en producción, solo backend cifrado.</p>`}</section></div>
  ${c.owner ? `<section class="card"><h2>Acciones del Dueño</h2><div class="row">${e.status === 'activo' ? `<form id="offboard-form" class="row" data-id="${esc(e.id)}"><label class="f" style="min-width:170px">Fecha de baja<input type="date" name="endDate" value="${todayISO()}"></label><button class="btn danger" type="submit">Dar de baja e iniciar offboarding</button></form>` : ''}<button class="btn danger" type="button" data-act="delete-emp" data-id="${esc(e.id)}">Eliminar expediente</button></div></section>` : ''}`;
}
function tabDocs(c, e, self) {
  const t = todayISO(); const can = c.owner;
  return `<div class="banner warn"><p><strong>Demo local.</strong> Los archivos se guardan en IndexedDB de este navegador (PDF, PNG, JPG o WebP, máx. ${MAX_FILE_BYTES / 1024 / 1024} MB). Los datos personales sensibles, en producción, solo en backend cifrado.</p></div>
  <div class="card tight"><div class="table-wrap"><table><caption class="sr">Documentos del expediente</caption><thead><tr><th scope="col">Documento</th><th scope="col">Estado</th><th scope="col">Vence</th><th scope="col">Archivo</th></tr></thead><tbody>${Object.entries(DOC_TYPES).map(([k, label]) => { const doc = e.docs[k]; const st = docState(doc, t);
    return `<tr data-doc="${k}" data-emp="${esc(e.id)}"><th scope="row" style="background:none;text-transform:none;letter-spacing:0;font-size:14px;color:var(--ink)">${esc(label)}</th><td>${can ? `<select data-doc-status aria-label="Estado de ${esc(label)}"><option value="pendiente"${doc.status === 'pendiente' ? ' selected' : ''}>Pendiente</option><option value="entregado"${doc.status === 'entregado' ? ' selected' : ''}>Entregado</option></select> ` : ''}${tag(st, DOC_CLASS[st])}</td>
    <td>${can ? `<input type="date" data-doc-expires value="${esc(doc.expires)}" aria-label="Vencimiento de ${esc(label)}" class="inline-input" style="min-height:38px;width:auto">` : doc.expires ? fmtDate(doc.expires) : '—'}</td>
    <td>${doc.fileName ? `<button class="btn ghost sm" type="button" data-act="view-file" data-doc="${k}" data-emp="${esc(e.id)}">Ver ${esc(doc.fileName.slice(0, 22))}</button> ` : ''}${can || self ? `<label class="btn sm ghost" style="cursor:pointer">${doc.fileName ? 'Reemplazar' : 'Subir archivo'}<input type="file" data-doc-file accept="application/pdf,image/png,image/jpeg,image/webp" class="sr"></label>` : ''}${doc.fileName && can ? ` <button class="btn danger sm" type="button" data-act="del-file" data-doc="${k}" data-emp="${esc(e.id)}">Quitar</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div></div>`;
}
function checklistHTML(e, kind, title, owner) {
  const list = e[kind]; const done = list.filter(i => i.done).length;
  const groupName = { accesos: 'Accesos', equipo: 'Equipo', cursos: 'Cursos', documentos: 'Documentos', otros: 'Otros' };
  return `<section class="card"><div class="row between"><h2>${title}</h2>${list.length ? tag(`${done}/${list.length}`, done === list.length ? 'good' : 'warn') : ''}</div>${list.length ? `<div class="bar" role="progressbar" aria-label="Avance de ${title}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(done / list.length * 100)}" style="margin-bottom:14px"><i style="width:${Math.round(done / list.length * 100)}%"></i></div><ul class="checklist">${list.map(i => `<li><label style="display:flex;gap:10px;align-items:center;flex:1;cursor:${owner ? 'pointer' : 'default'}"><input type="checkbox" data-check="${kind}" data-id="${esc(i.id)}" data-emp="${esc(e.id)}"${i.done ? ' checked' : ''}${owner ? '' : ' disabled'}> <span>${esc(i.label)}</span></label>${tag(groupName[i.group])}</li>`).join('')}</ul>` : `<p class="hint">No hay checklist iniciado.</p>${owner && kind === 'onboarding' ? `<button class="btn" type="button" data-act="start-onboarding" data-id="${esc(e.id)}">Iniciar onboarding</button>` : ''}`}</section>`;
}
const tabChecklists = (c, e) => checklistHTML(e, 'onboarding', 'Onboarding (ingreso)', c.owner) + checklistHTML(e, 'offboarding', 'Offboarding (baja)', c.owner);
function tabAusencias(c, e) {
  const b = P.requests.balance(e.id); const mine = P.requests.list({ scope: 'team' }).filter(r => r.employeeId === e.id);
  return `<div class="stats"><div class="card stat"><b>${b.balance}</b><span>Saldo de vacaciones (días)</span></div><div class="card stat"><b>${b.available}</b><span>Disponibles (menos pendientes)</span></div><div class="card stat"><b>${b.currentEntitlement}</b><span>Días que corresponden hoy</span></div><div class="card stat"><b>${b.primaDays}</b><span>Días de prima vacacional (25 %)</span></div></div>
  <p class="hint">Antigüedad: ${b.years} año(s). Próximo derecho: ${b.nextEntitlement} días el ${fmtDate(b.nextAnniversary)}. Cálculo según LFT (reforma de vacaciones dignas 2023).</p>
  <div class="card tight"><div class="table-wrap"><table><caption class="sr">Solicitudes</caption><thead><tr><th scope="col">Tipo</th><th scope="col">Fechas</th><th scope="col">Días</th><th scope="col">Estado</th></tr></thead><tbody>${mine.map(r => `<tr><td>${esc(REQUEST_TYPES[r.type])}</td><td>${fmtDate(r.from)} al ${fmtDate(r.to)}</td><td>${r.days}</td><td>${tag(REQUEST_STATUS[r.status], REQ_CLASS[r.status])}</td></tr>`).join('') || '<tr><td colspan="4" class="hint">Sin solicitudes.</td></tr>'}</tbody></table></div></div>`;
}
function tabDesempeno(c, e) {
  const cycles = P.performance.cycles(); const rs = P.performance.list().filter(r => r.employeeId === e.id);
  return rs.length ? rs.map(r => { const cy = cycles.find(x => x.id === r.cycleId); const res = reviewResult(r); const show = c.owner || res.complete || c.mine?.id !== e.id;
    return `<section class="card"><div class="row between"><h2>${esc(cy?.name || 'Ciclo')}</h2><a class="btn sm" href="#/evaluacion/${esc(r.id)}">Abrir</a></div><p>Autoevaluación: ${res.self ?? '—'} · Evaluación del jefe: ${show ? (res.manager ?? '—') : 'visible al cerrar ambas'} ${res.band && show ? tag(res.band, 'lime') : ''}</p></section>`; }).join('') : '<div class="card empty"><h3>Sin evaluaciones</h3><p>Aún no hay ciclos de evaluación para esta persona.</p></div>';
}
function tabCapacitacion(c, e) {
  const user = d.users.list().find(u => u.id === e.userId || u.email === e.email);
  if (!user) return '<div class="card empty"><h3>Sin usuario vinculado</h3><p>Vincula un usuario de la plataforma para ver su capacitación.</p></div>';
  let rows = []; try { rows = TR.myCourses(user); } catch {}
  return `<div class="card tight"><div class="table-wrap"><table><caption class="sr">Cursos</caption><thead><tr><th scope="col">Curso</th><th scope="col">Avance</th><th scope="col">Límite</th><th scope="col">Estado</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.course.title)}</td><td>${r.progress.pct} %</td><td>${r.due ? fmtDate(r.due) : '—'}</td><td>${tag(r.status, { completado: 'good', vencido: 'bad', 'por vencer': 'warn' }[r.status] || 'soft')}</td></tr>`).join('') || '<tr><td colspan="4" class="hint">Sin cursos asignados.</td></tr>'}</tbody></table></div></div><p><a class="btn ghost sm" href="/capacitacion/#/equipo">Gestionar en Capacitación</a></p>`;
}

/* ---------- vacaciones ---------- */
function calendarHTML(c) {
  const [Y, M] = ui.cal.split('-').map(Number); const first = `${ui.cal}-01`; const dow = (toUTC(first).getUTCDay() + 6) % 7; const days = new Date(Date.UTC(Y, M, 0)).getUTCDate(); const last = `${ui.cal}-${String(days).padStart(2, '0')}`;
  const ev = P.requests.calendar(first, last); const st = P.settings.get(); const hol = new Set(P.settings.holidays(Y)); const wk = WORKWEEKS[st.workweek];
  let cells = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(n => `<div class="dow" aria-hidden="true">${n}</div>`).join('') + '<div></div>'.repeat(dow);
  for (let i = 1; i <= days; i++) { const ds = `${ui.cal}-${String(i).padStart(2, '0')}`; const wd = toUTC(ds).getUTCDay(); const off = !wk.includes(wd); const es = ev.filter(x => x.from <= ds && x.to >= ds);
    cells += `<div class="day${off ? ' off' : ''}${hol.has(ds) ? ' hol' : ''}"><b>${i}${hol.has(ds) ? ' <span class="sr">festivo</span>' : ''}</b>${es.slice(0, 3).map(x => `<span class="ev ${x.type === 'vacaciones' ? '' : x.type === 'home_office' ? 'ho' : 'perm'}" title="${esc(x.name)} · ${esc(REQUEST_TYPES[x.type])}">${esc(x.name.split(' ')[0])}</span>`).join('')}${es.length > 3 ? `<span class="hint">+${es.length - 3}</span>` : ''}</div>`; }
  return `<section class="card"><div class="row between"><h2>Calendario del equipo</h2><span class="row"><button class="iconbtn" type="button" data-act="cal-prev" aria-label="Mes anterior">←</button><strong aria-live="polite">${MESES_LARGO[M - 1]} ${Y}</strong><button class="iconbtn" type="button" data-act="cal-next" aria-label="Mes siguiente">→</button></span></div><div class="cal" role="group" aria-label="Ausencias aprobadas de ${MESES_LARGO[M - 1]} ${Y}">${cells}</div><p class="hint">Verde claro: festivo oficial. Gris: día no laborable. Solo se muestran ausencias aprobadas.</p></section>`;
}
function vacacionesHTML(c) {
  const mineEmp = c.mine; const b = mineEmp ? P.requests.balance(mineEmp.id) : null; const my = P.requests.list({ scope: 'mine' }); const team = P.requests.list({ scope: 'team' }).filter(r => r.employeeId !== mineEmp?.id || c.owner);
  return `<p class="eyebrow">( Recursos Humanos )</p><h1>Vacaciones y permisos</h1><p class="lead">Solicita ausencias, consulta tu saldo y revisa el calendario del equipo.</p>
  ${c.pending.length ? `<section class="card"><h2>Por aprobar <span class="tag bad">${c.pending.length}</span></h2><ul class="checklist">${c.pending.map(r => `<li style="flex-wrap:wrap"><span style="flex:1;min-width:220px"><strong>${esc(c.byId[r.employeeId]?.name || '')}</strong> · ${esc(REQUEST_TYPES[r.type])}<br><span class="hint">${fmtDate(r.from)} al ${fmtDate(r.to)} · ${r.days} día(s)${r.comment ? ` · «${esc(r.comment)}»` : ''}</span></span><input class="inline-input" style="flex:1;min-width:160px" data-dec-comment="${esc(r.id)}" placeholder="Comentario (opcional)" aria-label="Comentario para ${esc(c.byId[r.employeeId]?.name || '')}"><button class="btn sm" type="button" data-act="approve" data-id="${esc(r.id)}">Aprobar</button><button class="btn danger sm" type="button" data-act="reject" data-id="${esc(r.id)}">Rechazar</button></li>`).join('')}</ul></section>` : ''}
  <div class="grid wide">${mineEmp ? `<section class="card"><h2>Mi saldo</h2><div class="stats" style="margin:0"><div class="stat"><b>${b.balance}</b><span>Días de saldo</span></div><div class="stat"><b>${b.available}</b><span>Disponibles</span></div></div><p class="hint">${b.years} año(s) de antigüedad · hoy te corresponden ${b.currentEntitlement} días al año · prima vacacional 25 % (${b.primaDays} días). Próximo derecho: ${b.nextEntitlement} días el ${fmtDate(b.nextAnniversary)}.</p></section>
  <section class="card"><h2>Nueva solicitud</h2><form id="req-form" class="stack"><div class="fields"><label class="f">Tipo${sel('type', Object.entries(REQUEST_TYPES), 'vacaciones')}</label><label class="f">Desde<input type="date" name="from" required min="${todayISO()}"></label><label class="f">Hasta<input type="date" name="to" required min="${todayISO()}"></label></div><label class="f">Comentario<input name="comment" maxlength="500"></label><p class="hint" id="req-days" aria-live="polite">Elige las fechas para ver los días hábiles.</p><p class="msg" id="req-msg" role="alert"></p><div><button class="btn" type="submit">Enviar solicitud</button></div></form></section>` : `<section class="card"><h2>Sin expediente</h2><p class="hint">Tu usuario no está vinculado a un colaborador, así que no puedes solicitar ausencias. ${c.owner ? 'Da de alta a una persona con tu correo desde el Directorio.' : 'Pide al Dueño que te dé de alta.'}</p></section>`}</div>
  ${mineEmp ? `<section class="card tight"><h2 style="padding:18px 18px 0;margin:0">Mis solicitudes</h2><div class="table-wrap"><table><caption class="sr">Mis solicitudes</caption><thead><tr><th scope="col">Tipo</th><th scope="col">Fechas</th><th scope="col">Días</th><th scope="col">Estado</th><th scope="col">Comentario</th><th scope="col"><span class="sr">Acción</span></th></tr></thead><tbody>${my.map(r => `<tr><td>${esc(REQUEST_TYPES[r.type])}</td><td>${fmtDate(r.from)} al ${fmtDate(r.to)}</td><td>${r.days}</td><td>${tag(REQUEST_STATUS[r.status], REQ_CLASS[r.status])}</td><td>${esc(r.decisionComment)}</td><td>${r.status === 'pendiente' ? `<button class="btn ghost sm" type="button" data-act="cancel-req" data-id="${esc(r.id)}">Cancelar</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="hint">Aún no has solicitado nada.</td></tr>'}</tbody></table></div></section>` : ''}
  ${calendarHTML(c)}
  ${(c.owner || c.reports.length) ? `<section class="card tight"><h2 style="padding:18px 18px 0;margin:0">${c.owner ? 'Todas las solicitudes' : 'Solicitudes de mi equipo'}</h2><div class="table-wrap"><table><caption class="sr">Solicitudes del equipo</caption><thead><tr><th scope="col">Persona</th><th scope="col">Tipo</th><th scope="col">Fechas</th><th scope="col">Días</th><th scope="col">Estado</th><th scope="col">Resuelto por</th></tr></thead><tbody>${team.map(r => `<tr><td>${esc(c.byId[r.employeeId]?.name || '')}</td><td>${esc(REQUEST_TYPES[r.type])}</td><td>${fmtDate(r.from)} al ${fmtDate(r.to)}</td><td>${r.days}</td><td>${tag(REQUEST_STATUS[r.status], REQ_CLASS[r.status])}</td><td>${esc(r.decidedBy)}</td></tr>`).join('') || '<tr><td colspan="6" class="hint">Sin solicitudes.</td></tr>'}</tbody></table></div></section>` : ''}`;
}

/* ---------- evaluaciones ---------- */
function evaluacionesHTML(c) {
  const cycles = P.performance.cycles(); const reviews = P.performance.list();
  return `<p class="eyebrow">( Recursos Humanos )</p><h1>Evaluaciones de desempeño</h1><p class="lead">Cada ciclo tiene objetivos; la persona se autoevalúa y su jefe directo evalúa del 1 al 5.</p>
  ${c.owner ? `<section class="card"><h2>Nuevo ciclo</h2><form id="cycle-form" class="stack"><div class="fields"><label class="f">Nombre<input name="name" required maxlength="100" placeholder="Evaluación 2026 · 2.º semestre"></label><label class="f">Inicio<input type="date" name="from"></label><label class="f">Fin<input type="date" name="to"></label></div>
  <label class="f">Objetivos (uno por línea; opcional «texto | peso»)<textarea name="objectives" required placeholder="Cerrar 12 operaciones | 3&#10;Registrar todo prospecto en el CRM | 2&#10;Completar los cursos asignados | 1"></textarea></label><p class="msg" id="cycle-msg" role="alert"></p><div><button class="btn" type="submit">Crear ciclo y lanzar evaluaciones</button></div></form></section>` : ''}
  ${cycles.length ? cycles.map(cy => { const rs = reviews.filter(r => r.cycleId === cy.id); return `<section class="card tight"><div class="row between" style="padding:18px"><h2 style="margin:0">${esc(cy.name)} ${tag(cy.status === 'abierto' ? 'Abierto' : 'Cerrado', cy.status === 'abierto' ? 'good' : 'soft')}</h2>${c.owner ? `<button class="btn ghost sm" type="button" data-act="toggle-cycle" data-id="${esc(cy.id)}">${cy.status === 'abierto' ? 'Cerrar ciclo' : 'Reabrir'}</button>` : ''}</div><div class="table-wrap"><table><caption class="sr">${esc(cy.name)}</caption><thead><tr><th scope="col">Persona</th><th scope="col">Autoevaluación</th><th scope="col">Jefe</th><th scope="col">Resultado</th><th scope="col"><span class="sr">Acción</span></th></tr></thead><tbody>${rs.map(r => { const res = reviewResult(r); const own = c.mine?.id === r.employeeId; const showMgr = !own || res.complete || c.owner;
    return `<tr><td>${esc(c.byId[r.employeeId]?.name || '')}</td><td>${r.self ? `${res.self} ✓` : tag('pendiente', 'warn')}</td><td>${r.manager ? (showMgr ? `${res.manager} ✓` : 'enviada') : tag('pendiente', 'warn')}</td><td>${res.complete && showMgr ? `${res.manager} · ${esc(res.band)}` : '—'}</td><td><a class="btn sm" href="#/evaluacion/${esc(r.id)}">Abrir</a></td></tr>`; }).join('') || '<tr><td colspan="5" class="hint">Sin evaluaciones visibles para ti en este ciclo.</td></tr>'}</tbody></table></div></section>`; }).join('') : '<div class="card empty"><h3>Aún no hay ciclos</h3><p>El Dueño puede crear el primero.</p></div>'}`;
}
function evaluacionFormHTML(c, id) {
  const r = P.performance.list().find(x => x.id === id); if (!r) throw new Error('Esa evaluación no existe o no tienes acceso.');
  const cy = P.performance.cycles().find(x => x.id === r.cycleId); const emp = c.byId[r.employeeId]; const res = reviewResult(r);
  const own = c.mine?.id === r.employeeId; const isMgr = c.owner || (c.mine && emp?.managerId === c.mine.id);
  const role = own ? 'self' : isMgr ? 'manager' : ''; const closed = cy?.status === 'cerrado'; const done = role && r[role];
  const showMgr = !own || res.complete || c.owner;
  const part = (who, label) => { const p = r[who]; if (who === 'manager' && !showMgr) return `<p class="hint">La evaluación de tu jefe estará visible cuando ambas partes estén completas.</p>`; if (!p) return `<p class="hint">${label}: pendiente.</p>`; return `<h3>${label}</h3><ul class="checklist">${r.objectives.map(o => `<li><span style="flex:1">${esc(o.text)}</span><strong>${p.ratings[o.id]}/5</strong></li>`).join('')}</ul>${p.comment ? `<p>«${esc(p.comment)}»</p>` : ''}`; };
  return `<p class="eyebrow"><a href="#/evaluaciones">Evaluaciones</a> / ${esc(cy?.name || '')}</p><h1>${esc(emp?.name || '')}</h1>
  ${res.complete && showMgr ? `<div class="banner"><p><strong>Resultado: ${res.manager} / 5 · ${esc(res.band)}</strong>. Autoevaluación ${res.self} (diferencia ${res.gap > 0 ? '+' : ''}${res.gap}).</p></div>` : ''}
  ${role && !done && !closed ? `<form id="review-form" class="card stack" data-id="${esc(r.id)}" data-role="${role}"><h2>${role === 'self' ? 'Mi autoevaluación' : 'Evaluación del jefe directo'}</h2>${r.objectives.map(o => `<fieldset class="question"><legend>${esc(o.text)} <span class="hint">(peso ${o.weight})</span></legend><div class="row" role="radiogroup">${[1, 2, 3, 4, 5].map(n => `<label class="opt"><input type="radio" name="${esc(o.id)}" value="${n}"> ${n}</label>`).join('')}</div></fieldset>`).join('')}<p class="hint">1 = muy por debajo · 3 = cumple · 5 = sobresaliente.</p><label class="f">Comentarios<textarea name="comment" maxlength="1500"></textarea></label><p class="msg" id="review-msg" role="alert"></p><div><button class="btn" type="submit">Enviar</button></div></form>` : closed && role && !done ? '<div class="banner"><p>El ciclo está cerrado.</p></div>' : ''}
  <section class="card">${part('self', 'Autoevaluación')}</section><section class="card">${part('manager', 'Evaluación del jefe directo')}</section>`;
}

/* ---------- ingreso/baja y configuración ---------- */
function ingresoHTML(c) {
  const tpl = P.settings.templates(); const courses = (() => { try { return TR.courses.list().filter(x => x.status === 'publicado'); } catch { return []; } })();
  const groups = [['accesos', 'Accesos'], ['equipo', 'Equipo'], ['cursos', 'Cursos'], ['documentos', 'Documentos'], ['otros', 'Otros']];
  const form = (kind, title) => `<form class="card stack tpl-form" data-kind="${kind}"><h2>${title}</h2><div id="tpl-${kind}" class="stack">${tpl[kind].map(i => tplRow(i, groups, courses)).join('')}</div><div class="row"><button class="btn ghost sm" type="button" data-act="tpl-add" data-kind="${kind}">+ Paso</button><button class="btn" type="submit">Guardar plantilla</button></div></form>`;
  const act = c.emps.filter(e => e.status === 'activo' || e.offboarding.length);
  return `<p class="eyebrow">( Recursos Humanos )</p><h1>Ingreso y baja</h1><p class="lead">Plantillas de checklist. Al dar de alta se copian al expediente y los pasos de tipo «Cursos» con un curso elegido se asignan en Capacitación.</p>
  <div class="grid wide">${form('onboarding', 'Plantilla de onboarding')}${form('offboarding', 'Plantilla de offboarding')}</div>
  <section class="card tight"><h2 style="padding:18px 18px 0;margin:0">Estado por persona</h2><div class="table-wrap"><table><caption class="sr">Estado de ingreso y baja</caption><thead><tr><th scope="col">Persona</th><th scope="col">Onboarding</th><th scope="col">Offboarding</th></tr></thead><tbody>${act.map(e => `<tr><td><a href="#/persona/${esc(e.id)}/ingreso">${esc(e.name)}</a></td><td>${e.onboarding.length ? `${e.onboarding.filter(i => i.done).length}/${e.onboarding.length}` : '—'}</td><td>${e.offboarding.length ? `${e.offboarding.filter(i => i.done).length}/${e.offboarding.length}` : '—'}</td></tr>`).join('') || '<tr><td colspan="3" class="hint">Sin colaboradores.</td></tr>'}</tbody></table></div></section>`;
}
const tplRow = (i, groups, courses) => `<div class="row tpl-row" data-id="${esc(i.id)}"><input class="inline-input" style="flex:2;min-width:180px" name="label" value="${esc(i.label)}" aria-label="Descripción del paso" maxlength="160"><select class="inline-input" style="flex:1;min-width:130px" name="group" aria-label="Grupo">${groups.map(([k, l]) => `<option value="${k}"${i.group === k ? ' selected' : ''}>${l}</option>`).join('')}</select><select class="inline-input" style="flex:1;min-width:150px" name="courseId" aria-label="Curso a asignar"><option value="">Sin curso</option>${courses.map(x => `<option value="${esc(x.id)}"${i.courseId === x.id ? ' selected' : ''}>${esc(x.title.slice(0, 40))}</option>`).join('')}${i.courseId && !courses.some(x => x.id === i.courseId) ? `<option value="${esc(i.courseId)}" selected>${esc(i.courseId)} (no publicado)</option>` : ''}</select><button class="iconbtn" type="button" data-act="tpl-del" aria-label="Quitar paso">×</button></div>`;
function configHTML() {
  const st = P.settings.get(); const y = ui.calYear; const hol = P.settings.holidays(y); const defaults = holidaysMX(y); const custom = !!st.holidays[String(y)];
  return `<p class="eyebrow">( Recursos Humanos )</p><h1>Configuración</h1><p class="lead">Parámetros que usa el cálculo de días hábiles y vacaciones.</p>
  <div class="grid wide"><section class="card"><h2>Semana laboral</h2><form id="week-form" class="stack"><label class="f">Días hábiles${sel('workweek', [['L-V', 'Lunes a viernes'], ['L-S', 'Lunes a sábado']], st.workweek)}</label><div><button class="btn" type="submit">Guardar</button></div></form><p class="hint">Los días no laborables no cuentan en solicitudes de vacaciones ni permisos.</p></section>
  <section class="card"><h2>Reglas de vacaciones (LFT)</h2><table><thead><tr><th scope="col">Año de servicio</th><th scope="col">Días</th></tr></thead><tbody>${[1, 2, 3, 4, 5].map(n => `<tr><td>${n}</td><td>${vacationDaysForYear(n)}</td></tr>`).join('')}${[[6, '6 a 10'], [11, '11 a 15'], [16, '16 a 20'], [21, '21 a 25'], [26, '26 a 30'], [31, '31 a 35']].map(([n, l]) => `<tr><td>${l}</td><td>${vacationDaysForYear(n)}</td></tr>`).join('')}</tbody></table><p class="hint">Prima vacacional mínima: 25 % del salario de los días de vacaciones.</p></section></div>
  <section class="card"><div class="row between"><h2>Días festivos ${y}</h2><span class="row"><label class="f" style="min-width:120px">Año<input type="number" id="hol-year" value="${y}" min="2020" max="2100"></label></span></div>
  <p class="hint">${custom ? 'Lista personalizada para este año.' : 'Descansos obligatorios del art. 74 de la LFT (1 ene, 1.er lunes de feb, 3.er lunes de mar, 1 may, 16 sep, 3.er lunes de nov, 1 oct cada 6 años, 25 dic).'}</p>
  <ul class="checklist">${hol.map(dt => `<li><span style="flex:1"><strong>${fmtDate(dt)}</strong> ${esc(defaults.find(x => x.date === dt)?.name || 'Día adicional')}</span><button class="btn danger sm" type="button" data-act="hol-del" data-date="${dt}">Quitar</button></li>`).join('') || '<li class="hint">Sin festivos.</li>'}</ul>
  <form id="hol-form" class="row" style="margin-top:14px"><label class="f">Agregar día<input type="date" name="date" required min="${y}-01-01" max="${y}-12-31"></label><button class="btn" type="submit">Agregar</button>${custom ? '<button class="btn ghost" type="button" data-act="hol-reset">Restablecer a LFT</button>' : ''}</form></section>`;
}

/* ---------- acciones ---------- */
const empFromForm = (f, base = {}) => { const fd = Object.fromEntries(new FormData(f)); return { ...base, name: fd.name, position: fd.position, area: fd.area, managerId: fd.managerId, hireDate: fd.hireDate, birthDate: fd.birthDate, contract: fd.contract, location: fd.location, email: fd.email, phone: fd.phone, userId: fd.userId || '', status: fd.status || base.status || 'activo', endDate: fd.endDate || '', sensitive: { salary: fd.salary, curp: fd.curp, rfc: fd.rfc, nss: fd.nss, bank: fd.bank } }; };
function applyOnboardingCourses(emp, userId) {
  const out = []; if (!userId) return out;
  for (const it of emp.onboarding.filter(i => i.courseId)) { try { TR.assignments.assign({ courseId: it.courseId, target: { type: 'user', value: userId }, due: addDays(emp.hireDate || todayISO(), 14) }); out.push(it.courseId); } catch {} }
  return out;
}
const actions = {
  seed: () => { const n = P.employees.seedDemo(u => d.users.list().find(x => x.email === u.email) || d.users.save({ name: u.name, email: u.email, role: u.role })); toast(`${n} personas de ejemplo cargadas.`); render(); },
  'clear-seed': async () => { if (!confirm('¿Quitar el equipo de ejemplo, sus usuarios y archivos?')) return; const gone = P.employees.clearDemo(); const me = sess().user; for (const e of gone) { const u = d.users.list().find(x => x.email === e.email && x.email.endsWith(DEMO_DOMAIN) && x.id !== me.id); if (u) d.users.remove(u.id); } try { await clearFiles(); } catch {} toast('Equipo de ejemplo quitado.'); render(); },
  'csv-dir': () => { const rows = [['Nombre', 'Puesto', 'Área', 'Jefe directo', 'Ingreso', 'Contrato', 'Ubicación', 'Correo', 'Teléfono', 'Estado']]; const all = P.employees.list({}); const by = Object.fromEntries(all.map(e => [e.id, e.name])); for (const e of P.employees.list({ status: ui.f.status ? ui.f.status : '' })) rows.push([e.name, e.position, e.area, by[e.managerId] || '', e.hireDate, CONTRACTS[e.contract], e.location, e.email, e.phone, e.status]); downloadText(`rrhh-directorio-${todayISO()}.csv`, toCSV(rows)); toast('CSV exportado (sin datos sensibles).'); },
  'csv-panel': () => { const p = P.panel(overdueMap()); const rows = [['Indicador', 'Valor'], ['Plantilla activa', p.headcount], ['Altas del año', p.altas], ['Bajas del año', p.bajas], ['Solicitudes por aprobar', p.pendingRequests.length], ['Personas con documentos faltantes', p.missingDocs.length], ['Aniversarios próximos', p.anniversaries.length], ['Cumpleaños próximos', p.birthdays.length], ['Personas con cursos vencidos', p.overdue.length], [], ['Área', 'Personas'], ...p.byArea, [], ['Persona', 'Documentos faltantes'], ...p.missingDocs.map(x => [x.e.name, x.missing.map(k => DOC_TYPES[k]).join('; ')])]; downloadText(`rrhh-panel-${todayISO()}.csv`, toCSV(rows)); toast('CSV exportado.'); },
  'delete-emp': el => { if (!confirm('¿Eliminar este expediente? Se borran también sus solicitudes y evaluaciones.')) return; P.employees.remove(el.dataset.id); deleteFilesFor(el.dataset.id); toast('Expediente eliminado.'); go('#/directorio'); },
  'start-onboarding': el => { const items = P.employees.startOnboarding(el.dataset.id); const e = P.employees.get(el.dataset.id); const n = applyOnboardingCourses({ ...e, onboarding: items }, e.userId).length; toast(`Onboarding iniciado${n ? ` y ${n} curso(s) asignado(s)` : ''}.`); render(); },
  approve: el => { P.requests.decide(el.dataset.id, 'aprobada', document.querySelector(`[data-dec-comment="${el.dataset.id}"]`)?.value || ''); toast('Solicitud aprobada.'); render(); },
  reject: el => { P.requests.decide(el.dataset.id, 'rechazada', document.querySelector(`[data-dec-comment="${el.dataset.id}"]`)?.value || ''); toast('Solicitud rechazada.'); render(); },
  'cancel-req': el => { P.requests.cancel(el.dataset.id); toast('Solicitud cancelada.'); render(); },
  'cal-prev': () => { ui.cal = shiftMonth(ui.cal, -1); ui.keepScroll = true; render(); }, 'cal-next': () => { ui.cal = shiftMonth(ui.cal, 1); ui.keepScroll = true; render(); },
  'toggle-cycle': el => { const cy = P.performance.cycles().find(x => x.id === el.dataset.id); P.performance.saveCycle({ ...cy, status: cy.status === 'abierto' ? 'cerrado' : 'abierto' }); render(); },
  'view-file': async el => { const f = await getFile(el.dataset.emp, el.dataset.doc); if (!f) { toast('El archivo ya no está en este navegador.', 'error'); return; } const url = URL.createObjectURL(f.blob); window.open(url, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(url), 60000); },
  'del-file': async el => { await deleteFile(el.dataset.emp, el.dataset.doc); P.employees.setDoc(el.dataset.emp, el.dataset.doc, { fileName: '' }); toast('Archivo quitado.'); render(); },
  'tpl-add': el => { const box = document.getElementById(`tpl-${el.dataset.kind}`); const tmp = document.createElement('div'); const courses = (() => { try { return TR.courses.list().filter(x => x.status === 'publicado'); } catch { return []; } })(); tmp.innerHTML = tplRow({ id: rid().slice(0, 12), label: '', group: 'otros', courseId: '' }, [['accesos', 'Accesos'], ['equipo', 'Equipo'], ['cursos', 'Cursos'], ['documentos', 'Documentos'], ['otros', 'Otros']], courses); box.append(tmp.firstElementChild); box.lastElementChild.querySelector('input').focus(); },
  'tpl-del': el => el.closest('.tpl-row').remove(),
  'hol-del': el => { const y = ui.calYear; const list = P.settings.holidays(y).filter(x => x !== el.dataset.date); P.settings.save({ holidays: { ...P.settings.get().holidays, [y]: list } }); render(); },
  'hol-reset': () => { P.settings.resetHolidays(ui.calYear); render(); },
};
const shiftMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number); const dt = new Date(Date.UTC(y, m - 1 + n, 1)); return dt.toISOString().slice(0, 7); };
async function deleteFilesFor(id) { for (const k of Object.keys(DOC_TYPES)) { try { await deleteFile(id, k); } catch {} } }

$main.addEventListener('click', guard(async e => { const el = e.target.closest('[data-act]'); if (el && actions[el.dataset.act]) { if (el.tagName === 'A') e.preventDefault(); await actions[el.dataset.act](el); } }));
$main.addEventListener('input', e => {
  if (e.target.closest('#dir-filters')) { ui.f = Object.fromEntries(new FormData(e.target.closest('form'))); fillDirectory(ctx()); }
  if (e.target.closest('#req-form') && ['from', 'to', 'type'].includes(e.target.name)) updateDays();
});
function updateDays() {
  const f = document.getElementById('req-form'); const out = document.getElementById('req-days'); if (!f) return; const fd = Object.fromEntries(new FormData(f));
  if (!isISODate(fd.from) || !isISODate(fd.to) || fd.to < fd.from) { out.textContent = 'Elige las fechas para ver los días hábiles.'; return; }
  const n = P.requests.days(fd.from, fd.to); const b = c0().mine ? P.requests.balance(c0().mine.id) : null;
  out.textContent = `${n} día(s) hábil(es).${fd.type === 'vacaciones' && b ? ` Saldo disponible: ${b.available}. Quedarían ${b.available - n}.` : ''}`;
}
const c0 = () => ctx();
$main.addEventListener('change', guard(async e => {
  const el = e.target;
  if (el.closest('#dir-filters')) return;
  if (el.id === 'hol-year') { ui.calYear = Math.min(2100, Math.max(2020, Number(el.value) || ui.calYear)); render(); return; }
  if (el.dataset.check) { P.employees.toggleChecklist(el.dataset.emp, el.dataset.check, el.dataset.id, el.checked); ui.keepScroll = true; render(); return; }
  const row = el.closest('[data-doc]');
  if (row && el.hasAttribute('data-doc-status')) { P.employees.setDoc(row.dataset.emp, row.dataset.doc, { status: el.value }); ui.keepScroll = true; render(); }
  else if (row && el.hasAttribute('data-doc-expires')) { P.employees.setDoc(row.dataset.emp, row.dataset.doc, { expires: el.value }); ui.keepScroll = true; render(); }
  else if (row && el.hasAttribute('data-doc-file')) { const file = el.files[0]; if (!file) return; const name = await putFile(row.dataset.emp, row.dataset.doc, file); P.employees.setDoc(row.dataset.emp, row.dataset.doc, { fileName: name }); toast('Archivo guardado en este navegador (demo).'); ui.keepScroll = true; render(); }
}));
$main.addEventListener('submit', guard(async e => {
  e.preventDefault(); const f = e.target;
  if (f.id === 'emp-form') {
    const msg = document.getElementById('emp-msg'); const fd = Object.fromEntries(new FormData(f)); const edit = !!f.dataset.id; msg.textContent = '';
    try {
      let input = empFromForm(f, edit ? { id: f.dataset.id } : {});
      if (!edit && fd.makeUser) { if (!input.email) throw new Error('Para crear acceso escribe el correo laboral.'); const u = d.users.list().find(x => x.email === input.email.toLowerCase()) || d.users.save({ name: input.name, email: input.email, role: fd.role || 'sales' }); input.userId = u.id; }
      const saved = P.employees.save(input);
      if (!edit && fd.onboarding) { const items = P.employees.startOnboarding(saved.id); const n = applyOnboardingCourses({ ...saved, onboarding: items }, saved.userId).length; toast(`Alta registrada${n ? ` · ${n} curso(s) asignado(s)` : ''}.`); } else toast(edit ? 'Cambios guardados.' : 'Alta registrada.');
      go(`#/persona/${saved.id}`);
    } catch (err) { msg.textContent = err.message; msg.dataset.state = 'error'; }
  } else if (f.id === 'offboard-form') {
    if (!confirm('¿Dar de baja a esta persona e iniciar el offboarding?')) return; P.employees.startOffboarding(f.dataset.id, new FormData(f).get('endDate')); toast('Baja registrada.'); render();
  } else if (f.id === 'req-form') {
    const msg = document.getElementById('req-msg'); try { P.requests.create(Object.fromEntries(new FormData(f))); toast('Solicitud enviada.'); render(); } catch (err) { msg.textContent = err.message; msg.dataset.state = 'error'; }
  } else if (f.id === 'cycle-form') {
    const msg = document.getElementById('cycle-msg'); const fd = Object.fromEntries(new FormData(f));
    try { const objectives = fd.objectives.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const [t, w] = l.split('|'); return { text: t.trim(), weight: Number(w) || 1 }; }); const cy = P.performance.saveCycle({ name: fd.name, from: fd.from, to: fd.to }); const n = P.performance.launch(cy.id, objectives); toast(`Ciclo creado con ${n} evaluación(es).`); render(); } catch (err) { msg.textContent = err.message; msg.dataset.state = 'error'; }
  } else if (f.id === 'review-form') {
    const msg = document.getElementById('review-msg'); const fd = Object.fromEntries(new FormData(f)); const { comment, ...ratings } = fd;
    try { P.performance.submit(f.dataset.id, f.dataset.role, ratings, comment); toast('Evaluación enviada.'); render(); } catch (err) { msg.textContent = err.message; msg.dataset.state = 'error'; }
  } else if (f.classList.contains('tpl-form')) {
    const items = [...f.querySelectorAll('.tpl-row')].map(r => ({ id: r.dataset.id, label: r.querySelector('[name=label]').value, group: r.querySelector('[name=group]').value, courseId: r.querySelector('[name=courseId]').value })); P.settings.saveTemplate(f.dataset.kind, items); toast('Plantilla guardada.'); render();
  } else if (f.id === 'week-form') { P.settings.save({ workweek: new FormData(f).get('workweek') }); toast('Semana laboral guardada.'); render(); }
  else if (f.id === 'hol-form') { const y = ui.calYear; const date = new FormData(f).get('date'); P.settings.save({ holidays: { ...P.settings.get().holidays, [y]: [...P.settings.holidays(y), date] } }); render(); }
}));

window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); $main.focus({ preventScroll: true }); });
d.subscribe(topic => { if (['session', 'users', 'all'].includes(topic)) render(); });
render();
