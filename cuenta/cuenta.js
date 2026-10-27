import { data, ROLES } from '/shared/data.js';
import { config, supabaseReady } from '/shared/config.js';
import { safeNext, nextLabel } from '/shared/nav.js';
import { remote } from '/shared/remote-boot.js';

const d = data();
const main = document.getElementById('main');
const rail = document.getElementById('rail');
const nav = document.getElementById('nav');
const app = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const when = iso => new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
const ymd = iso => new Date(iso).toLocaleDateString('en-CA');
const next = safeNext(new URLSearchParams(location.search).get('next'));

const SECTIONS = [['sesion', 'Sesión'], ['equipo', 'Equipo'], ['auditoria', 'Auditoría'], ['respaldo', 'Respaldo'], ['conexiones', 'Conexiones']];
const AREAS = { auth: 'Cuentas', properties: 'Propiedades', intake: 'Formularios', backup: 'Respaldo', general: 'General' };
const PERMS = [
  ['cms.view', 'Ver el Editor'], ['cms.edit', 'Editar páginas en el Editor'], ['cms.publish', 'Publicar páginas'], ['cms.comment', 'Comentar'], ['cms.approve', 'Aprobar (cliente)'],
  ['crm.view', 'Ver el CRM'], ['crm.edit', 'Editar contactos y tareas'],
  ['properties.view', 'Ver propiedades'], ['properties.edit', 'Crear y editar propiedades'], ['properties.status', 'Cambiar el estado de una propiedad'],
  ['users.manage', 'Administrar el equipo'], ['audit.view', 'Ver la auditoría'], ['backup.manage', 'Exportar e importar respaldos'],
];
const ROLE_NOTES = {
  owner: 'Todo, incluido equipo, auditoría y respaldos.',
  editor: 'Diseña y publica en el Editor, gestiona propiedades y consulta el CRM.',
  sales: 'Trabaja el CRM, cambia el estado de propiedades y comenta en el Editor.',
  client: 'Ve el Editor, comenta y aprueba. No toca datos del negocio.',
};

let flash = null;          // mensaje que sobrevive al siguiente render
let audit = { q: '', area: '', actor: '', from: '', to: '', shown: 100 };
let pendingImport = null;

const notify = (text, state = 'ok') => { flash = { text, state }; render(); };
const takeFlash = () => { const f = flash; flash = null; return f ? `<p class="msg" role="status" data-state="${f.state}">${esc(f.text)}</p>` : '<p class="msg" role="status"></p>'; };
const currentSection = () => { const h = location.hash.slice(1); return SECTIONS.some(([k]) => k === h) ? h : 'sesion'; };
// Tras entrar se conserva la sección pedida (p. ej. /cuenta/#conexiones) solo si es una de SECTIONS; lo demás va a «Sesión».
const landingSection = hash => { const h = String(hash ?? '').replace(/^#/, ''); return SECTIONS.some(([k]) => k === h) ? h : 'sesion'; };
const tag = role => `<span class="tag ${esc(role)}">${esc(Object.hasOwn(ROLES, role) ? ROLES[role] : role)}</span>`;
const options = (entries, value) => entries.map(([v, t]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(t)}</option>`).join('');

/* ---------- entrada ---------- */
function loginHTML() {
  const users = d.users.list();
  const first = !users.length;
  return `<div class="login">
    <div class="brand-mark">ORNAT</div>
    <p class="eyebrow">( Cuenta )</p>
    <h1>Entrar</h1>
    <p class="lead"><strong>Demo: sin contraseña, datos en este navegador.</strong> Sirve para probar roles y permisos. Cuando se conecte Supabase, el acceso será con enlace por correo.${next ? ` Después te llevamos a ${esc(nextLabel(next))}.` : ''}</p>
    <form class="card stack" id="login" novalidate>
      <label class="f">Nombre<input name="name" autocomplete="name" maxlength="120" placeholder="Ana Pérez"></label>
      <label class="f">Correo<input name="email" type="email" autocomplete="email" maxlength="250" required placeholder="ana@ornat.mx"></label>
      <label class="f">Rol<select name="role" id="role-select">${options(Object.entries(ROLES), 'editor')}</select></label>
      <p class="hint" id="role-hint">${first ? 'Eres el primer usuario de este navegador: quedarás como Dueño.' : 'Si el correo ya existe se usa su rol guardado.'}</p>
      <button class="btn" type="submit">Entrar</button>
      <p class="msg" id="login-msg" role="status" aria-live="polite"></p>
    </form>
    ${users.length ? `<div class="card"><h2>O entra como alguien del equipo</h2><p class="hint" style="margin-bottom:12px">Atajo de demo para probar cada rol.</p><div class="picks">${users.map(u => `<button class="btn ghost sm" type="button" data-pick="${esc(u.email)}">${esc(u.name)} · ${esc(ROLES[u.role])}</button>`).join('')}</div></div>` : ''}
  </div>`;
}

function afterSignIn() {
  if (next) { location.assign(next); return; }
  location.hash = '#' + landingSection(location.hash);
  render();
}

function bindLogin() {
  const form = main.querySelector('#login');
  const msg = main.querySelector('#login-msg');
  const hint = main.querySelector('#role-hint');
  const roleSel = main.querySelector('#role-select');
  form.elements.email.addEventListener('input', () => {
    const existing = d.users.list().find(u => u.email === form.elements.email.value.trim().toLowerCase());
    roleSel.disabled = !!existing;
    if (existing) { roleSel.value = existing.role; hint.textContent = `Ese correo ya existe: entrarás como ${ROLES[existing.role]}.`; }
    else hint.textContent = d.users.list().length ? 'Usuario nuevo: se guarda con el rol que elijas.' : 'Eres el primer usuario de este navegador: quedarás como Dueño.';
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    try { d.signIn({ name: form.elements.name.value, email: form.elements.email.value, role: roleSel.value }); afterSignIn(); }
    catch (err) { msg.textContent = err.message; msg.dataset.state = 'error'; form.elements.email.focus(); }
  });
  main.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => { d.signIn({ email: b.dataset.pick }); afterSignIn(); }));
}

/* ---------- sesión ---------- */
function sesionHTML(session) {
  const u = session.user; const users = d.users.list();
  const links = [['/cms/', 'Editor', 'cms.view'], ['/control/', 'CRM', 'crm.view'], ['/propiedades/', 'Catálogo público', null]].filter(([, , p]) => !p || d.can(p));
  return `<p class="eyebrow">( Sesión )</p><h1>Hola, ${esc(u.name)}</h1>
  <p class="lead">Modo demo: la sesión y los datos viven en este navegador y no se comparten con nadie.</p>
  ${takeFlash()}
  ${next ? `<div class="banner"><p>Venías de <strong>${esc(nextLabel(next))}</strong>.</p><a class="btn" href="${esc(next)}">Continuar</a></div>` : ''}
  <div class="grid2">
    <section class="card"><h2>Tu cuenta</h2>
      <dl class="who-grid"><dt>Nombre</dt><dd>${esc(u.name)}</dd><dt>Correo</dt><dd>${esc(u.email)}</dd><dt>Rol</dt><dd>${tag(u.role)}</dd><dt>Desde</dt><dd>${esc(when(session.since))}</dd></dl>
      <p class="hint" style="margin:14px 0 18px">${esc(ROLE_NOTES[u.role])}</p>
      <button class="btn dark" type="button" id="signout">Cerrar sesión</button>
    </section>
    <section class="card"><h2>Ir a</h2>
      <div class="picks">${links.map(([href, label]) => `<a class="btn ghost" href="${href}">${label}</a>`).join('')}</div>
      ${users.length > 1 ? `<h2 style="margin-top:26px">Cambiar de usuario</h2><p class="hint" style="margin-bottom:10px">Para probar cómo se ve cada rol.</p>
      <label class="f">Usuario<select id="switch">${options(users.map(x => [x.email, `${x.name} · ${ROLES[x.role]}`]), u.email)}</select></label>` : '<p class="hint" style="margin-top:20px">Cuando haya más usuarios podrás cambiar entre ellos aquí. Invítalos en Equipo.</p>'}
    </section>
  </div>`;
}
function bindSesion() {
  main.querySelector('#signout').addEventListener('click', () => { d.signOut(); location.hash = ''; render(); });
  main.querySelector('#switch')?.addEventListener('change', e => { d.signIn({ email: e.target.value }); notify(`Ahora eres ${d.getSession().user.name}.`); });
}

/* ---------- equipo ---------- */
function deny(title, text) { return `<p class="eyebrow">( ${esc(title)} )</p><h1>${esc(title)}</h1><div class="card"><p>${esc(text)}</p><p class="hint">Cambia a un usuario Dueño desde Sesión para continuar.</p></div>`; }

function equipoHTML(session) {
  if (!d.can('users.manage')) return deny('Equipo', 'Solo el Dueño puede administrar el equipo.');
  const users = d.users.list(); const owners = users.filter(u => u.role === 'owner').length;
  const me = session.user.email;
  const rows = users.map(u => {
    const isMe = u.email === me; const lastOwner = u.role === 'owner' && owners === 1;
    return `<tr><td><strong>${esc(u.name)}</strong>${isMe ? ' <span class="hint">(tú)</span>' : ''}</td><td>${esc(u.email)}</td>
      <td><select data-role="${esc(u.id)}" aria-label="Rol de ${esc(u.name)}"${isMe || lastOwner ? ' disabled title="No puedes cambiar tu propio rol ni el del único Dueño."' : ''}>${options(Object.entries(ROLES), u.role)}</select></td>
      <td>${esc(when(u.createdAt))}</td>
      <td><button class="btn danger sm" type="button" data-del="${esc(u.id)}" data-name="${esc(u.name)}"${isMe || lastOwner ? ' disabled' : ''}>Eliminar</button></td></tr>`;
  }).join('');
  const matrix = PERMS.map(([a, label]) => `<tr><td>${esc(label)}</td>${Object.keys(ROLES).map(r => `<td>${d.can(a, { user: { role: r } }) ? '<span class="yes" aria-label="Sí">Sí</span>' : '<span class="no" aria-label="No">—</span>'}</td>`).join('')}</tr>`).join('');
  return `<p class="eyebrow">( Equipo )</p><h1>Equipo y permisos</h1>
  <p class="lead">Quién entra y qué puede hacer. Los permisos salen del rol; el primer usuario es siempre Dueño.</p>
  ${takeFlash()}
  <section class="card tight"><div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Alta</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>${rows}</tbody></table></div></section>
  <section class="card"><h2>Invitar o actualizar a alguien</h2>
    <p class="hint" style="margin-bottom:14px">Demo: se crea el usuario en este navegador; no se envía ningún correo. Si el correo ya existe, se actualiza su nombre y rol.</p>
    <form class="stack" id="invite" novalidate style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));align-items:end">
      <label class="f">Nombre<input name="name" maxlength="120" placeholder="Leo Vendedor"></label>
      <label class="f">Correo<input name="email" type="email" maxlength="250" required placeholder="leo@ornat.mx"></label>
      <label class="f">Rol<select name="role">${options(Object.entries(ROLES), 'editor')}</select></label>
      <button class="btn" type="submit">Guardar usuario</button>
    </form><p class="msg" id="invite-msg" role="status" aria-live="polite"></p></section>
  <section class="card tight"><div style="padding:24px 24px 4px"><h2>Qué puede hacer cada rol</h2></div><div class="table-wrap"><table class="perm"><thead><tr><th>Permiso</th>${Object.values(ROLES).map(r => `<th>${esc(r)}</th>`).join('')}</tr></thead><tbody>${matrix}</tbody></table></div>
    <ul class="hint" style="padding:16px 24px 20px 42px;margin:0">${Object.entries(ROLE_NOTES).map(([r, t]) => `<li><strong>${esc(ROLES[r])}:</strong> ${esc(t)}</li>`).join('')}</ul></section>`;
}
function bindEquipo() {
  const invite = main.querySelector('#invite'); if (!invite) return;
  invite.addEventListener('submit', e => {
    e.preventDefault();
    try { const u = d.users.save({ name: invite.elements.name.value, email: invite.elements.email.value, role: invite.elements.role.value }); notify(`Guardado: ${u.name} · ${ROLES[u.role]}.`); }
    catch (err) { const m = main.querySelector('#invite-msg'); m.textContent = err.message; m.dataset.state = 'error'; }
  });
  main.querySelectorAll('[data-role]').forEach(sel => sel.addEventListener('change', () => {
    const u = d.users.list().find(x => x.id === sel.dataset.role);
    try { d.users.save({ ...u, role: sel.value }); notify(`${u.name} ahora es ${ROLES[sel.value]}.`); } catch (err) { notify(err.message, 'error'); }
  }));
  main.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => {
    if (!confirm(`¿Eliminar a ${btn.dataset.name}? Perderá el acceso en este navegador.`)) return;
    try { d.users.remove(btn.dataset.del); notify(`${btn.dataset.name} fue eliminado.`); } catch (err) { notify(err.message, 'error'); }
  }));
}

/* ---------- auditoría ---------- */
function auditRows() {
  const q = audit.q.trim().toLowerCase();
  return d.audit.list().filter(a => {
    if (audit.area && a.area !== audit.area) return false;
    if (audit.actor && a.actor !== audit.actor) return false;
    if (audit.from && ymd(a.at) < audit.from) return false;
    if (audit.to && ymd(a.at) > audit.to) return false;
    if (q && !`${a.action} ${a.detail} ${a.actor}`.toLowerCase().includes(q)) return false;
    return true;
  });
}
function auditTable() {
  const rows = auditRows(); const shown = rows.slice(0, audit.shown);
  const body = shown.length ? shown.map(a => `<tr><td style="white-space:nowrap">${esc(when(a.at))}</td><td>${esc(a.actor)}</td><td>${esc(a.action)}</td><td>${esc(a.detail)}</td><td>${esc(AREAS[a.area] || a.area)}</td></tr>`).join('') : '<tr><td colspan="5" class="hint" style="padding:28px">Ningún registro cumple esos filtros.</td></tr>';
  return `<div class="count" role="status" aria-live="polite"><strong>${rows.length}</strong> ${rows.length === 1 ? 'registro' : 'registros'}${rows.length > shown.length ? ` · mostrando ${shown.length}` : ''}</div>
    <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th><th>Área</th></tr></thead><tbody>${body}</tbody></table></div>
    ${rows.length > shown.length ? `<div style="padding:16px;text-align:center"><button class="btn ghost sm" type="button" id="audit-more">Mostrar más</button></div>` : ''}`;
}
function auditoriaHTML() {
  if (!d.can('audit.view')) return deny('Auditoría', 'Solo el Dueño puede ver el registro de auditoría.');
  const all = d.audit.list();
  const areas = [...new Set(all.map(a => a.area))]; const actors = [...new Set(all.map(a => a.actor))].sort();
  return `<p class="eyebrow">( Auditoría )</p><h1>Registro de auditoría</h1>
  <p class="lead">Quién hizo qué y cuándo en las áreas que usan la capa compartida (cuentas, propiedades, formularios, respaldos). Guarda hasta 3,000 movimientos.</p>
  <section class="card tight"><form class="filters" id="audit-filters" novalidate>
    <label class="f wide">Buscar<input type="search" name="q" value="${esc(audit.q)}" placeholder="Acción, detalle o usuario"></label>
    <label class="f">Área<select name="area">${options([['', 'Todas'], ...areas.map(a => [a, AREAS[a] || a])], audit.area)}</select></label>
    <label class="f">Usuario<select name="actor">${options([['', 'Todos'], ...actors.map(a => [a, a])], audit.actor)}</select></label>
    <label class="f">Desde<input type="date" name="from" value="${esc(audit.from)}"></label>
    <label class="f">Hasta<input type="date" name="to" value="${esc(audit.to)}"></label>
  </form><div id="audit-table">${auditTable()}</div></section>`;
}
function bindAuditoria() {
  const form = main.querySelector('#audit-filters'); if (!form) return;
  const redraw = () => { main.querySelector('#audit-table').innerHTML = auditTable(); bindMore(); };
  const bindMore = () => main.querySelector('#audit-more')?.addEventListener('click', () => { audit.shown += 100; redraw(); });
  let t;
  form.addEventListener('input', e => { clearTimeout(t); const apply = () => { audit[e.target.name] = e.target.value; audit.shown = 100; redraw(); }; if (e.target.type === 'search') t = setTimeout(apply, 150); else apply(); });
  form.addEventListener('submit', e => e.preventDefault());
  bindMore();
}

/* ---------- respaldo ---------- */
// El archivo importado es no confiable: solo se cuentan listas reales (nunca una cadena u objeto que traiga su propia «length»).
const countOf = list => (Array.isArray(list) ? list.length : 0);
const countsOf = state => { const s = state && typeof state === 'object' ? state : {}; return { users: countOf(s.users), properties: countOf(s.properties), intake: countOf(s.intake), audit: countOf(s.audit) }; };
function respaldoHTML() {
  if (!d.can('backup.manage')) return deny('Respaldo', 'Solo el Dueño puede exportar e importar respaldos.');
  const c = countsOf(JSON.parse(d.exportAll()).state);
  const p = pendingImport;
  return `<p class="eyebrow">( Respaldo )</p><h1>Respaldo</h1>
  <p class="lead">Un archivo JSON con lo que gestiona la capa compartida: usuarios, propiedades, formularios pendientes y auditoría. El contenido propio del CRM y del Editor se respalda desde sus pantallas.</p>
  ${takeFlash()}
  <div class="grid2">
    <section class="card"><h2>Exportar</h2><p class="hint" style="margin-bottom:14px">Hoy: ${Number(c.users) || 0} usuarios · ${Number(c.properties) || 0} propiedades · ${Number(c.intake) || 0} formularios · ${Number(c.audit) || 0} registros.</p><button class="btn" type="button" id="export">Descargar respaldo</button></section>
    <section class="card"><h2>Importar</h2><p class="hint" style="margin-bottom:14px"><strong>Reemplaza</strong> todo lo anterior en este navegador. Descarga un respaldo primero si dudas. Si tu usuario no viene en el archivo, tendrás que entrar de nuevo.</p>
      <label class="f">Archivo de respaldo (.json)<input type="file" id="import-file" accept="application/json,.json"></label>
      ${p ? `<div class="banner" style="margin-top:16px"><p><strong>${esc(p.name)}</strong><br>Contiene ${Number(p.counts.users) || 0} usuarios, ${Number(p.counts.properties) || 0} propiedades, ${Number(p.counts.intake) || 0} formularios y ${Number(p.counts.audit) || 0} registros.</p><button class="btn dark" type="button" id="import-go">Reemplazar datos</button></div>` : ''}
    </section>
  </div>`;
}
function bindRespaldo() {
  main.querySelector('#export')?.addEventListener('click', () => {
    const blob = new Blob([d.exportAll()], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `ornat-respaldo-${new Date().toLocaleDateString('en-CA')}.json`;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    d.audit.log('Exportar respaldo', a.download, 'backup'); notify('Respaldo descargado.');
  });
  main.querySelector('#import-file')?.addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('El archivo es demasiado grande (máximo 8 MB).');
      const raw = await file.text(); const parsed = JSON.parse(raw);
      if (parsed?.format !== 'ornat-data' || !parsed.state) throw new Error('Ese archivo no es un respaldo de ORNAT.');
      pendingImport = { raw, name: file.name, counts: countsOf(parsed.state) }; render();
    } catch (err) { pendingImport = null; notify(err instanceof SyntaxError ? 'El archivo no es un JSON válido.' : err.message, 'error'); }
  });
  main.querySelector('#import-go')?.addEventListener('click', () => {
    try {
      d.importAll(pendingImport.raw); const c = pendingImport.counts; pendingImport = null;
      d.audit.log('Importar respaldo', `${c.users} usuarios · ${c.properties} propiedades · ${c.intake} formularios`, 'backup');
      notify('Respaldo importado. Los datos de este navegador fueron reemplazados.');
    } catch (err) { notify(`No se importó: ${err.message}`, 'error'); }
  });
}

/* ---------- conexiones ---------- */
function connections() {
  const pendingForms = d.intake.size();
  const sb = supabaseReady(config);
  const live = !!remote && d.backend().connected;
  const sync = live ? d.sync?.() : null;
  return [
    { id: 'supabase', mono: 'Sb', name: 'Supabase', sub: 'Cuentas, base de datos y archivos', status: live ? 'live' : 'pending', label: live ? 'Conectado' : 'Pendiente de conectar',
      what: 'Inicio de sesión con correo y contraseña, datos compartidos en vivo entre el equipo y dispositivos, permisos por rol aplicados en la base de datos (RLS) y almacenamiento de imágenes.',
      state: live ? `Sesión de ${d.getSession()?.user.email || ''}. ${sync?.pending ? `${sync.pending} cambios por enviar.` : 'Todo guardado.'}${sync?.lastError ? ` Último error: ${sync.lastError}` : ''}`
        : remote ? 'Hay URL y clave en shared/config.js, pero no se pudo conectar.' : sb ? 'Hay claves en shared/config.js, pero esta página no ha verificado la conexión.' : 'Modo local: shared/config.js no tiene URL ni clave publicable.',
      steps: ['Crea un proyecto en supabase.com (elige una región cercana a México).', 'En SQL Editor ejecuta <code>backend/supabase/schema-v2.sql</code> (tablas, RLS por rol, Realtime y buckets).', 'En Authentication → Users crea tu usuario con correo y contraseña.', 'En <code>shared/config.js</code> llena <code>supabaseUrl</code> y la clave publicable (<code>sb_publishable_…</code>). Con ambos valores el sitio pasa solo a modo conectado.', 'En Vercel agrega <code>NEXT_PUBLIC_SUPABASE_URL</code> y <code>SUPABASE_SERVICE_ROLE_KEY</code> (la clave secreta nunca va en el sitio) y vuelve a desplegar.', 'Entra en <a href="/cuenta/">/cuenta/</a>: la primera vez te pide el nombre de la organización y quedas como Dueño.'],
      need: ['URL del proyecto y clave publicable.', 'Correo del Dueño.', 'Región de datos y quién administra la cuenta de Supabase.'] },
    { id: 'forms', mono: 'Fm', name: 'Formularios públicos', sub: 'Sitio y fichas de propiedades → CRM', status: live ? 'live' : 'demo', label: live ? 'Conectado' : 'Disponible en demo',
      what: 'Los formularios del sitio y de cada propiedad llegan a una cola; el CRM la vacía y crea los contactos.',
      state: live ? `Los envíos llegan a Supabase (máximo 5 por visitante cada 10 minutos). ${d.can('crm.edit') ? `${pendingForms} ${pendingForms === 1 ? 'pendiente' : 'pendientes'} de pasar al CRM.` : ''}`
        : `Demo: ${pendingForms} ${pendingForms === 1 ? 'envío pendiente' : 'envíos pendientes'} en la cola de este navegador. Solo lo ve quien use este mismo navegador; los visitantes reales aún no llegan al equipo.`,
      steps: ['Conecta Supabase (tarjeta anterior).', '<code>shared/forms.js</code> envía cada formulario a la función <code>submit_intake</code> de la base de datos: valida campos y limita envíos por IP.', 'Abre el CRM con un usuario que pueda editar contactos: los formularios pendientes se convierten en contactos.'],
      need: ['Dominios desde los que se aceptarán formularios.', 'Correo o canal donde quieres enterarte de cada contacto nuevo.'] },
    { id: 'calendar', mono: 'Ca', name: 'Google Calendar', sub: 'Visitas y citas', status: 'demo', label: 'Disponible en demo',
      what: 'Agendar visitas y llamadas desde el CRM.',
      state: 'Demo: los enlaces «Agregar a Google Calendar» y los archivos .ics no necesitan conexión. La sincronización automática con tu calendario sigue pendiente de conectar.',
      steps: ['Sincronía manual: <code>integrations/ornat-calendar-apps-script.txt</code> está preparado, pero no instalado.', 'Sincronía en vivo: crea un proyecto en Google Cloud, activa Calendar API y configura OAuth.', 'Guarda el token como secreto de una Edge Function; nunca en el navegador.'],
      need: ['Cuenta de Google y calendario del equipo.', 'Quién podrá ver y crear eventos.'] },
    { id: 'whatsapp', mono: 'Wa', name: 'WhatsApp Business', sub: 'API oficial de Meta', status: 'demo', label: 'Disponible en demo',
      what: 'Hablar con contactos desde el CRM y registrar la conversación.',
      state: 'Demo: los enlaces wa.me con mensaje prellenado funcionan (botón de cada propiedad). Envío y recepción automáticos con la API oficial: pendiente de conectar.',
      steps: ['Cuenta de Meta Business verificada.', 'App en developers.facebook.com con el producto WhatsApp y un número dedicado.', 'Plantillas de mensaje aprobadas por Meta.', 'Webhook (Edge Function) para recibir mensajes y llevarlos al CRM.'],
      need: ['Número de teléfono exclusivo para la API.', 'Acceso de administrador a Meta Business.', 'Textos de las plantillas.'] },
    { id: 'instagram', mono: 'Ig', name: 'Instagram', sub: 'Publicaciones y mensajes', status: 'pending', label: 'Pendiente de conectar',
      what: 'Programar publicaciones desde el calendario de contenido y llevar mensajes y comentarios al CRM.',
      state: 'No hay ninguna cuenta conectada.',
      steps: ['Cuenta profesional de Instagram vinculada a una Página de Facebook.', 'App de Meta con Instagram Graph API.', 'Revisión de permisos de publicación y mensajes por Meta.', 'Token de larga duración guardado como secreto en el servidor.'],
      need: ['Usuario de Instagram y acceso a la Página.', 'Aprobación de quién publicará.'] },
    { id: 'stripe', mono: 'St', name: 'Stripe', sub: 'Pagos y enlaces de pago', status: 'pending', label: 'Pendiente de conectar',
      what: 'Cobrar apartados, anticipos o servicios con enlaces de pago, y marcar el pago en el CRM.',
      state: 'No hay cuenta de Stripe conectada; no se cobra nada desde esta demo.',
      steps: ['Cuenta de Stripe verificada para México.', 'Empieza con claves de prueba y productos o precios de prueba.', 'Crea enlaces de pago o Checkout desde una Edge Function.', 'Webhook firmado para confirmar el pago antes de marcarlo.'],
      need: ['Datos fiscales y cuenta bancaria del negocio.', 'Monedas (MXN/USD) y política de reembolsos.'] },
    { id: 'sign', mono: 'Fe', name: 'Firma electrónica', sub: 'Cotizaciones y contratos', status: 'pending', label: 'Pendiente de conectar',
      what: 'Que el cliente firme cotizaciones y contratos con evidencia guardada (tabla <code>signatures</code>).',
      state: 'Sin proveedor elegido. Esta demo no genera firmas con validez legal.',
      steps: ['Elige proveedor según la validez legal que necesites en México.', 'Crea las plantillas de contrato.', 'Integra el envío y el webhook de «firmado» en una Edge Function.'],
      need: ['Proveedor elegido.', 'Plantilla de contrato aprobada por tu abogado.'] },
    { id: 'ai', mono: 'IA', name: 'IA · Claude (Anthropic)', sub: 'Análisis de fotos, copy y ficha de propiedad', status: 'pending', label: 'Pendiente de conectar',
      what: 'En <a href="/propiedades/subir/">Subir propiedad</a>: analizar cada foto (espacio, materiales, estilo, calidad), redactar el copy y ajustarlo con un prompt. Usa el modelo <code>claude-opus-5-5</code> desde las funciones <code>/api/property-ai/*</code> del servidor.',
      state: 'Sin clave de API. Mientras tanto corre solo el análisis local de las fotos y un borrador de plantilla marcado «sin IA»; ninguna foto sale de tu navegador.',
      steps: ['Crea una clave en console.anthropic.com (idealmente un workspace solo para ORNAT con tope de gasto).', 'En Vercel → proyecto ornat-nuevo → Settings → Environment Variables agrega <code>ANTHROPIC_API_KEY</code> (Production y Preview).', 'Vuelve a desplegar. La clave vive solo en el servidor, nunca en el navegador.', 'Antes de abrirlo al público, exige sesión del backend (Supabase) en esas funciones.'],
      need: ['La clave de API (la pegas tú directo en Vercel).', 'Tope de gasto mensual.', 'Política de privacidad sobre fotos y datos de clientes.'] },
    { id: 'voice', mono: '11', name: 'Asistente de voz · ElevenLabs', sub: 'Widget conversacional en todas las pantallas', status: 'pending', label: 'Pendiente de conectar',
      what: 'Un asistente de voz (ElevenLabs Conversational AI) en el sitio, el Editor, el CRM, Capacitación y RRHH, que sabe en qué pantalla y con qué rol estás.',
      state: 'Sin Agent ID. Se ve un botón «Asistente de voz» con estas instrucciones y no se carga nada externo.',
      steps: ['Crea el agente en ElevenLabs y copia su Agent ID (empieza con <code>agent_</code>).', 'Pégalo en <code>shared/voice-config.js</code> (campo <code>agentId</code>).', 'En ElevenLabs agrega el dominio del sitio a la lista de dominios permitidos del agente.', 'Declara las variables dinámicas <code>ornat_context</code> y <code>ornat_role</code>. El asistente no recibe nombre ni correo, solo la pantalla y el rol.'],
      need: ['Agent ID de ElevenLabs.', 'Dominio final del sitio.'] },
    { id: 'domain', mono: 'Dn', name: 'Dominio propio y publicación', sub: 'Tu dirección en internet', status: 'pending', label: 'Pendiente de conectar',
      what: 'Que el sitio, el catálogo y el CRM vivan en tu dominio con certificado seguro.',
      state: 'Hoy el sitio se publica en una dirección de Vercel; el dominio propio no está conectado desde aquí.',
      steps: ['Confirma el dominio (por ejemplo ornat.com.mx).', 'En Vercel → Domains agrégalo y copia los registros DNS.', 'Configura los registros en tu registrador; el certificado SSL es automático.', 'Actualiza las URL canónicas y la lista de orígenes permitidos de la función <code>intake</code>.'],
      need: ['Acceso al registrador del dominio.', 'Dominio principal y redirecciones deseadas.'] },
  ];
}
function conexionesHTML() {
  const b = d.backend();
  return `<p class="eyebrow">( Conexiones )</p><h1>Conexiones</h1>
  <p class="lead">Qué servicios externos usa la plataforma y en qué punto está cada uno. Modo actual: <strong>${esc(b.label)}</strong>. Aquí nada aparece como «conectado» si no lo está.</p>
  <div class="grid2">${connections().map(c => `<article class="card conn" id="c-${c.id}">
    <header><div style="display:flex;gap:14px;align-items:flex-start"><span class="mono-badge" aria-hidden="true">${esc(c.mono)}</span><div><h3>${esc(c.name)}</h3><span class="hint">${esc(c.sub)}</span></div></div><span class="status ${c.status}">${esc(c.label)}</span></header>
    <p><strong>Qué habilita.</strong> ${c.what}</p>
    <p><strong>Estado real.</strong> ${esc(c.state)}</p>
    <details><summary>Pasos para conectar</summary><ol>${c.steps.map(s => `<li>${s}</li>`).join('')}</ol></details>
    <details><summary>Qué necesitamos de ti</summary><ul>${c.need.map(s => `<li>${esc(s)}</li>`).join('')}</ul></details>
  </article>`).join('')}</div>`;
}

/* ---------- modo conectado (Supabase) ---------- */
const sb = remote?.client || null;
const PASS = { min: 12, max: 72 };
let gate = '';               // '' | 'forgot'
const noAccessKey = () => `ornat-noaccess:${remote?.session?.user?.id || ''}`;
const noAccess = () => { try { return sessionStorage.getItem(noAccessKey()) === '1'; } catch { return false; } };
const setMsg = (el, text, state = 'error') => { el.textContent = text; el.dataset.state = state; };
const busy = (form, on) => form.querySelectorAll('button,input,select').forEach(el => { el.disabled = on; });

function goAfterSignIn() {
  if (next) { location.assign(next); return; }
  location.hash = '#' + landingSection(location.hash); location.reload();   // recarga para hidratar los datos del equipo
}
async function remoteSignOut() { await remote.signOut(); location.assign(`/cuenta/${location.search}`); }

function soloHTML(eyebrow, title, body) {
  return `<div class="login"><div class="brand-mark">ORNAT</div><p class="eyebrow">( ${esc(eyebrow)} )</p><h1>${esc(title)}</h1>${body}</div>`;
}
function soloView(title, html, bind) { app.classList.add('solo'); rail.hidden = true; main.innerHTML = html; document.title = `${title} | ORNAT`; bind?.(); }
const signOutCard = text => `<div class="card stack"><p>${text}</p><div class="picks"><button class="btn dark" type="button" id="solo-out">Salir</button><a class="btn ghost" href="/">Ir al sitio</a></div></div>`;
const bindSoloOut = () => main.querySelector('#solo-out')?.addEventListener('click', remoteSignOut);

function offlineHTML() {
  return soloHTML('Cuenta', 'Sin conexión', `<p class="lead">No se pudo conectar con el servidor de cuentas. Revisa tu conexión a internet y vuelve a intentarlo.</p><div class="card"><button class="btn" type="button" id="retry">Reintentar</button></div>`);
}
function remoteLoginHTML() {
  return soloHTML('Cuenta', 'Entrar', `<p class="lead">Usa el correo y la contraseña que te dio el Dueño de la cuenta.${next ? ` Después te llevamos a ${esc(nextLabel(next))}.` : ''}</p>
    <form class="card stack" id="r-login" novalidate>
      <label class="f">Correo<input name="email" type="email" autocomplete="username" maxlength="250" required></label>
      <label class="f">Contraseña<input name="password" type="password" autocomplete="current-password" maxlength="${PASS.max}" required></label>
      <button class="btn" type="submit">Entrar</button>
      <button class="link" type="button" id="r-forgot">¿Olvidaste tu contraseña?</button>
      <p class="msg" id="r-msg" role="status" aria-live="polite"></p>
    </form>`);
}
function bindRemoteLogin() {
  const form = main.querySelector('#r-login'); const msg = main.querySelector('#r-msg');
  form.elements.email.focus();
  main.querySelector('#r-forgot').addEventListener('click', () => { gate = 'forgot'; render(); });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email = form.elements.email.value.trim(); const password = form.elements.password.value;
    if (!email || !password) { setMsg(msg, 'Escribe tu correo y tu contraseña.'); return; }
    busy(form, true); setMsg(msg, 'Entrando…', '');
    const res = await remote.signIn(email, password);
    busy(form, false);
    if (res.error) { setMsg(msg, res.error); form.elements.password.select(); return; }
    if (res.profile) goAfterSignIn(); else render();
  });
}
function forgotHTML() {
  return soloHTML('Cuenta', 'Recuperar contraseña', `<p class="lead">Te enviamos un enlace para crear una contraseña nueva.</p>
    <form class="card stack" id="r-reset" novalidate>
      <label class="f">Correo<input name="email" type="email" autocomplete="username" maxlength="250" required></label>
      <button class="btn" type="submit">Enviar enlace</button>
      <button class="link" type="button" id="r-back">Volver a entrar</button>
      <p class="msg" id="r-msg" role="status" aria-live="polite"></p>
    </form>`);
}
function bindForgot() {
  const form = main.querySelector('#r-reset'); const msg = main.querySelector('#r-msg');
  form.elements.email.focus();
  main.querySelector('#r-back').addEventListener('click', () => { gate = ''; render(); });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email = form.elements.email.value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setMsg(msg, 'Escribe un correo válido.'); return; }
    busy(form, true);
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/cuenta/` });
    busy(form, false);
    if (error) setMsg(msg, /rate limit|too many/i.test(error.message) ? 'Ya enviamos un enlace hace poco. Espera unos minutos.' : 'No se pudo enviar el enlace. Inténtalo de nuevo.');
    else setMsg(msg, 'Si el correo tiene cuenta, en unos minutos te llega el enlace.', 'ok');
  });
}
const passwordFields = (label = 'Nueva contraseña') => `<label class="f">${label}<input name="password" type="password" autocomplete="new-password" minlength="${PASS.min}" maxlength="${PASS.max}" required></label>
  <label class="f">Repítela<input name="confirm" type="password" autocomplete="new-password" minlength="${PASS.min}" maxlength="${PASS.max}" required></label>`;
function checkNewPassword(form) {
  const p = form.elements.password.value;
  if (p.length < PASS.min) return `Usa al menos ${PASS.min} caracteres.`;
  if (p.length > PASS.max) return `Usa como máximo ${PASS.max} caracteres.`;
  if (p !== form.elements.confirm.value) return 'Las contraseñas no coinciden.';
  return '';
}
async function savePassword(form, msg) {
  const problem = checkNewPassword(form); if (problem) { setMsg(msg, problem); return false; }
  busy(form, true);
  const { error } = await sb.auth.updateUser({ password: form.elements.password.value });
  busy(form, false);
  if (error) { setMsg(msg, /different from the old|same/i.test(error.message) ? 'La contraseña nueva debe ser distinta de la anterior.' : 'No se pudo guardar la contraseña.'); return false; }
  form.reset(); return true;
}
function recoveryHTML() {
  return soloHTML('Cuenta', 'Nueva contraseña', `<p class="lead">Elige una contraseña de al menos ${PASS.min} caracteres.</p>
    <form class="card stack" id="r-recover" novalidate>${passwordFields()}<button class="btn" type="submit">Guardar y entrar</button><p class="msg" id="r-msg" role="status" aria-live="polite"></p></form>`);
}
function bindRecovery() {
  const form = main.querySelector('#r-recover'); const msg = main.querySelector('#r-msg');
  form.elements.password.focus();
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!(await savePassword(form, msg))) return;
    remote.recovery = false; history.replaceState(null, '', location.pathname + location.search);
    if (remote.profile) goAfterSignIn(); else render();
  });
}
function firstRunHTML() {
  return soloHTML('Primer arranque', 'Crear organización', `<p class="lead">Entraste como <strong>${esc(remote.session.user.email)}</strong>. Si eres la primera persona en usar ORNAT, crea la organización y quedarás como Dueño.</p>
    <form class="card stack" id="r-org" novalidate>
      <label class="f">Nombre de la organización<input name="name" maxlength="120" required autocomplete="organization"></label>
      <button class="btn" type="submit">Crear organización</button>
      <p class="msg" id="r-msg" role="status" aria-live="polite"></p>
    </form>${signOutCard('¿Te invitó alguien del equipo? Entonces no crees una organización: sal y pide al Dueño que te dé de alta.')}`);
}
function bindFirstRun() {
  const form = main.querySelector('#r-org'); const msg = main.querySelector('#r-msg');
  bindSoloOut(); form.elements.name.focus();
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const name = form.elements.name.value.trim();
    if (name.length < 2) { setMsg(msg, 'Escribe un nombre de 2 a 120 caracteres.'); return; }
    busy(form, true);
    const { error } = await sb.rpc('bootstrap_owner', { p_org_name: name });
    busy(form, false);
    if (error) {
      if (/ya existe/i.test(error.message)) { try { sessionStorage.setItem(noAccessKey(), '1'); } catch {} render(); return; }
      setMsg(msg, error.message || 'No se pudo crear la organización.'); return;
    }
    await remote.refreshProfile();
    if (remote.profile) goAfterSignIn(); else setMsg(msg, remote.profileError || 'La organización se creó, pero no se pudo cargar tu perfil. Recarga la página.');
  });
}
const noAccessHTML = () => soloHTML('Cuenta', 'Sin acceso todavía', `<p class="lead">Entraste como <strong>${esc(remote.session.user.email)}</strong>.</p>${signOutCard('Tu cuenta aún no tiene acceso; pide al dueño que te dé de alta.')}`);
const profileErrorHTML = text => soloHTML('Cuenta', 'No se pudo cargar tu cuenta', `<p class="lead">${esc(text)}</p><div class="card picks"><button class="btn" type="button" id="retry">Reintentar</button><button class="btn dark" type="button" id="solo-out">Salir</button></div>`);
const bindRetry = () => { main.querySelector('#retry')?.addEventListener('click', () => location.reload()); bindSoloOut(); };

function sesionRemoteHTML(session) {
  const u = session.user;
  const links = [['/cms/', 'Editor', 'cms.view'], ['/control/', 'CRM', 'crm.view'], ['/propiedades/', 'Catálogo público', null]].filter(([, , p]) => !p || d.can(p));
  return `<p class="eyebrow">( Sesión )</p><h1>Hola, ${esc(u.name)}</h1>
  <p class="lead">Tus cambios se guardan en la base de datos del equipo y los demás los ven al momento.</p>
  ${takeFlash()}
  ${next ? `<div class="banner"><p>Venías de <strong>${esc(nextLabel(next))}</strong>.</p><a class="btn" href="${esc(next)}">Continuar</a></div>` : ''}
  <div class="grid2">
    <section class="card"><h2>Tu cuenta</h2>
      <dl class="who-grid"><dt>Nombre</dt><dd>${esc(u.name)}</dd><dt>Correo</dt><dd>${esc(u.email)}</dd><dt>Rol</dt><dd>${tag(u.role)}</dd><dt>Último acceso</dt><dd>${esc(when(session.since))}</dd></dl>
      <p class="hint" style="margin:14px 0 18px">${esc(ROLE_NOTES[u.role])}</p>
      <button class="btn dark" type="button" id="signout">Salir</button>
    </section>
    <section class="card"><h2>Cambiar contraseña</h2>
      <form class="stack" id="r-pass" novalidate>${passwordFields()}<button class="btn" type="submit">Guardar contraseña</button><p class="msg" id="pass-msg" role="status" aria-live="polite"></p></form>
    </section>
    <section class="card"><h2>Ir a</h2><div class="picks">${links.map(([href, label]) => `<a class="btn ghost" href="${href}">${label}</a>`).join('')}</div></section>
  </div>`;
}
function bindSesionRemote() {
  main.querySelector('#signout').addEventListener('click', remoteSignOut);
  const form = main.querySelector('#r-pass');
  form.addEventListener('submit', async e => { e.preventDefault(); const msg = main.querySelector('#pass-msg'); if (await savePassword(form, msg)) setMsg(msg, 'Contraseña actualizada.', 'ok'); });
}

const tempPassword = () => { const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; const v = crypto.getRandomValues(new Uint32Array(16)); return [...v].map(n => abc[n % abc.length]).join(''); };
async function teamCall(body) {
  const res = await fetch('/api/team', { method: 'POST', headers: { 'content-type': 'application/json', ...remote.authHeader() }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.message || `El servidor respondió ${res.status}.`);
  return json;
}
async function updateProfile(id, patch) {
  const { error } = await sb.from('profiles').update(patch).eq('id', id);
  if (error) throw new Error(error.message || 'No se pudo guardar.');
  await d.refresh();
}
function equipoRemoteHTML(session) {
  if (!d.can('users.manage')) return `<p class="eyebrow">( Equipo )</p><h1>Equipo</h1><div class="card"><p>Solo el Dueño puede administrar el equipo.</p></div>`;
  const users = d.users.list(); const me = session.user.id;
  const rows = users.map(u => {
    const isMe = u.id === me;
    return `<tr><td><input class="cell" data-rename="${esc(u.id)}" value="${esc(u.name)}" maxlength="120" aria-label="Nombre de ${esc(u.email)}">${isMe ? ' <span class="hint">(tú)</span>' : ''}</td><td>${esc(u.email)}</td>
      <td><select data-role="${esc(u.id)}" aria-label="Rol de ${esc(u.name)}"${isMe ? ' disabled title="No puedes cambiar tu propio rol."' : ''}>${options(Object.entries(ROLES), u.role)}</select></td>
      <td>${esc(when(u.createdAt))}</td>
      <td><button class="btn danger sm" type="button" data-del="${esc(u.id)}" data-name="${esc(u.name)}"${isMe ? ' disabled' : ''}>Eliminar</button></td></tr>`;
  }).join('');
  const matrix = PERMS.map(([a, label]) => `<tr><td>${esc(label)}</td>${Object.keys(ROLES).map(r => `<td>${d.can(a, { user: { role: r } }) ? '<span class="yes" aria-label="Sí">Sí</span>' : '<span class="no" aria-label="No">—</span>'}</td>`).join('')}</tr>`).join('');
  return `<p class="eyebrow">( Equipo )</p><h1>Equipo y permisos</h1>
  <p class="lead">Quién entra y qué puede hacer. Los permisos salen del rol y la base de datos los hace cumplir.</p>
  ${takeFlash()}
  <section class="card tight"><div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Alta</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>${rows}</tbody></table></div></section>
  <section class="card"><h2>Dar de alta</h2>
    <p class="hint" style="margin-bottom:14px">Crea la cuenta con una contraseña temporal y compártela por un canal privado; la persona la cambia en Sesión.</p>
    <form class="stack" id="r-invite" novalidate style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));align-items:end">
      <label class="f">Nombre<input name="name" maxlength="120" autocomplete="off"></label>
      <label class="f">Correo<input name="email" type="email" maxlength="250" required autocomplete="off"></label>
      <label class="f">Rol<select name="role">${options(Object.entries(ROLES).filter(([r]) => r !== 'owner'), 'editor')}</select></label>
      <label class="f">Contraseña temporal<span class="pass-row"><input name="password" type="text" minlength="${PASS.min}" maxlength="${PASS.max}" required autocomplete="off" spellcheck="false"><button class="btn ghost sm" type="button" id="gen">Generar</button></span></label>
      <button class="btn" type="submit">Crear cuenta</button>
    </form><p class="msg" id="invite-msg" role="status" aria-live="polite"></p></section>
  <section class="card tight"><div style="padding:24px 24px 4px"><h2>Qué puede hacer cada rol</h2></div><div class="table-wrap"><table class="perm"><thead><tr><th>Permiso</th>${Object.values(ROLES).map(r => `<th>${esc(r)}</th>`).join('')}</tr></thead><tbody>${matrix}</tbody></table></div>
    <ul class="hint" style="padding:16px 24px 20px 42px;margin:0">${Object.entries(ROLE_NOTES).map(([r, t]) => `<li><strong>${esc(ROLES[r])}:</strong> ${esc(t)}</li>`).join('')}</ul></section>`;
}
function bindEquipoRemote() {
  const form = main.querySelector('#r-invite'); if (!form) return;
  const msg = main.querySelector('#invite-msg');
  main.querySelector('#gen').addEventListener('click', () => { form.elements.password.value = tempPassword(); form.elements.password.select(); });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const body = { action: 'create', name: form.elements.name.value.trim(), email: form.elements.email.value.trim().toLowerCase(), role: form.elements.role.value, password: form.elements.password.value };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) { setMsg(msg, 'Escribe un correo válido.'); return; }
    if (body.password.length < PASS.min) { setMsg(msg, `La contraseña temporal necesita al menos ${PASS.min} caracteres.`); return; }
    busy(form, true); setMsg(msg, 'Creando cuenta…', '');
    try {
      const { profile } = await teamCall(body);
      d.audit.log('Alta de usuario', `${body.email} · ${ROLES[body.role]}`, 'auth');
      await d.refresh();
      notify(`Cuenta creada: ${profile?.name || body.email} · ${ROLES[body.role]}. Comparte la contraseña temporal por un canal privado.`);
    } catch (err) { busy(form, false); setMsg(msg, err.message); }
  });
  main.querySelectorAll('[data-rename]').forEach(input => input.addEventListener('change', async () => {
    const name = input.value.trim(); const u = d.users.list().find(x => x.id === input.dataset.rename);
    if (!u || name === u.name) return;
    if (!name) { input.value = u.name; notify('El nombre no puede quedar vacío.', 'error'); return; }
    try { await updateProfile(u.id, { name }); d.audit.log('Cambiar nombre de usuario', `${u.email} → ${name}`, 'auth'); notify(`Nombre actualizado: ${name}.`); }
    catch (err) { notify(err.message, 'error'); }
  }));
  main.querySelectorAll('[data-role]').forEach(sel => sel.addEventListener('change', async () => {
    const u = d.users.list().find(x => x.id === sel.dataset.role); if (!u) return;
    sel.disabled = true;
    try { await updateProfile(u.id, { role: sel.value }); d.audit.log('Cambiar rol', `${u.email} · ${ROLES[sel.value]}`, 'auth'); notify(`${u.name} ahora es ${ROLES[sel.value]}.`); }
    catch (err) { notify(err.message, 'error'); }
  }));
  main.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm(`¿Eliminar a ${btn.dataset.name}? Pierde el acceso de inmediato.`)) return;
    const u = d.users.list().find(x => x.id === btn.dataset.del);
    btn.disabled = true;
    try { await teamCall({ action: 'delete', userId: btn.dataset.del }); d.audit.log('Eliminar usuario', u?.email || btn.dataset.del, 'auth'); await d.refresh(); notify(`${btn.dataset.name} fue eliminado.`); }
    catch (err) { btn.disabled = false; notify(err.message, 'error'); }
  }));
}

function respaldoRemoteHTML() {
  if (!d.can('backup.manage')) return deny('Respaldo', 'Solo el Dueño puede exportar respaldos.');
  const c = countsOf(JSON.parse(d.exportAll()).state);
  return `<p class="eyebrow">( Respaldo )</p><h1>Respaldo</h1>
  <p class="lead">Descarga una copia JSON de usuarios, propiedades, formularios pendientes y auditoría. Importar está desactivado con Supabase conectado para no sobrescribir los datos del equipo.</p>
  ${takeFlash()}
  <section class="card"><h2>Exportar</h2><p class="hint" style="margin-bottom:14px">Hoy: ${Number(c.users) || 0} usuarios · ${Number(c.properties) || 0} propiedades · ${Number(c.intake) || 0} formularios · ${Number(c.audit) || 0} registros.</p><button class="btn" type="button" id="export">Descargar respaldo</button></section>`;
}

const REMOTE_VIEWS = { sesion: [sesionRemoteHTML, bindSesionRemote], equipo: [equipoRemoteHTML, bindEquipoRemote], auditoria: [auditoriaHTML, bindAuditoria], respaldo: [respaldoRemoteHTML, bindRespaldo], conexiones: [conexionesHTML, () => {}] };
let deferred = false;
const editing = () => { const a = document.activeElement; return !!a && main.contains(a) && a.matches('input,select,textarea'); };
main.addEventListener('focusout', () => setTimeout(() => { if (deferred && !editing()) { deferred = false; render(); } }, 0));

function renderRemote() {
  if (!sb) return soloView('Sin conexión', offlineHTML(), bindRetry);
  if (remote.recovery && remote.session) return soloView('Nueva contraseña', recoveryHTML(), bindRecovery);
  if (!remote.session) return gate === 'forgot' ? soloView('Recuperar contraseña', forgotHTML(), bindForgot) : soloView('Entrar', remoteLoginHTML(), bindRemoteLogin);
  if (!remote.profile) {
    if (remote.profileError) return soloView('Cuenta', profileErrorHTML(remote.profileError), bindRetry);
    return noAccess() ? soloView('Sin acceso', noAccessHTML(), bindSoloOut) : soloView('Crear organización', firstRunHTML(), bindFirstRun);
  }
  const session = d.getSession();
  if (!session) return soloView('Cuenta', profileErrorHTML('Tu perfil no tiene un correo válido. Pide al Dueño que lo revise.'), bindRetry);
  app.classList.remove('solo'); rail.hidden = false;
  const note = document.querySelector('.demo-note'); if (note) note.lastChild.textContent = d.backend().label;
  const sec = currentSection(); const [html, bind] = REMOTE_VIEWS[sec];
  nav.innerHTML = `<p class="nav-label">( ${esc(session.user.name)} · ${esc(ROLES[session.user.role])} )</p>` + SECTIONS.map(([k, label]) => `<a href="#${k}"${k === sec ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  main.innerHTML = html(session); document.title = `${SECTIONS.find(([k]) => k === sec)[1]} · Cuenta | ORNAT`;
  bind();
}

/* ---------- render ---------- */
const VIEWS = { sesion: [sesionHTML, bindSesion], equipo: [equipoHTML, bindEquipo], auditoria: [auditoriaHTML, bindAuditoria], respaldo: [respaldoHTML, bindRespaldo], conexiones: [conexionesHTML, () => {}] };
function render() {
  if (remote) { renderRemote(); return; }
  const session = d.getSession();
  if (!session) {
    app.classList.add('solo'); rail.hidden = true; main.innerHTML = loginHTML(); document.title = 'Entrar | ORNAT'; bindLogin(); return;
  }
  app.classList.remove('solo'); rail.hidden = false;
  const sec = currentSection(); const [html, bind] = VIEWS[sec];
  nav.innerHTML = `<p class="nav-label">( ${esc(session.user.name)} · ${esc(ROLES[session.user.role])} )</p>` + SECTIONS.map(([k, label]) => `<a href="#${k}"${k === sec ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  main.innerHTML = html(session); document.title = `${SECTIONS.find(([k]) => k === sec)[1]} · Cuenta | ORNAT`;
  bind();
}
window.addEventListener('hashchange', () => { render(); main.focus({ preventScroll: true }); window.scrollTo(0, 0); });
d.subscribe(topic => { if (remote && editing()) { deferred = true; return; } if (topic === 'session' || topic === 'all') render(); else if (topic === 'users' && currentSection() === 'equipo') render(); else if (topic === 'intake' && currentSection() === 'conexiones') render(); });
render();
