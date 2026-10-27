// ORNAT · pantalla de Capacitación (LMS interno, modo demo). La lógica vive en shared/training.js.
import { data, ROLES } from '../shared/data.js';
import { createTraining, AREAS, LEVELS, LESSON_TYPES, ASSIGN_ROLES, renderMarkdown, embedURL, isHttps, lessonsOf, courseMinutes, courseProgress, lessonDone, cleanCourse, publishProblems, gradeQuiz } from '../shared/training.js';
import { esc, toCSV, downloadText, fmtDate, fmtDateLong, fmtMinutes, todayISO, rid } from '../shared/ui.js';
import '../shared/session-bar.js';
import '../shared/voice-widget.js';

const d = data();
const T = createTraining({ getSession: () => d.getSession(), listUsers: () => d.users.list(), audit: (a, det, area) => { try { d.audit.log(a, det, area); } catch {} } });
const $main = document.getElementById('main'); const $nav = document.getElementById('nav');
const ui = { filters: { area: '', level: '', req: '', mine: '', q: '', sort: 'titulo' }, quiz: null, draft: null, teamFilter: { status: '', course: '' } };
let timer = null;

const STATUS_CLASS = { completado: 'good', vencido: 'bad', 'por vencer': 'warn', 'en curso': 'lime', pendiente: 'soft' };
const tagFor = s => `<span class="tag ${STATUS_CLASS[s] || 'soft'}">${esc(s)}</span>`;
const initial = u => esc((u?.name || '?')[0].toUpperCase());

function toast(msg, kind = 'ok') {
  const el = document.createElement('div'); el.className = `toast ${kind === 'error' ? 'error' : ''}`; el.textContent = msg;
  document.getElementById('toasts').append(el); setTimeout(() => el.remove(), kind === 'error' ? 6000 : 3200);
}
const guard = fn => (...a) => { try { return fn(...a); } catch (e) { toast(e.message || 'No se pudo completar la acción.', 'error'); } };

/* ---------- ruteo ---------- */
const route = () => { const parts = (location.hash.replace(/^#\/?/, '') || 'catalogo').split('/').map(decodeURIComponent); return { name: parts[0], a: parts[1] || '', b: parts[2] || '' }; };
const go = hash => { if (location.hash === hash) render(); else location.hash = hash; };

function navHTML(user, r) {
  const manage = T.canManage(user); const overdue = T.myCourses(user).filter(c => c.status === 'vencido').length;
  const items = [['catalogo', 'Catálogo'], ['mis', 'Mis cursos', overdue], ['constancias', 'Constancias']];
  if (manage) items.push(['equipo', 'Equipo'], ['editor', 'Editor de cursos']);
  const cur = r.name === 'curso' ? 'catalogo' : r.name === 'constancia' ? 'constancias' : r.name;
  return items.map(([k, l, n]) => `<a href="#/${k}"${cur === k ? ' aria-current="page"' : ''}>${l}${n ? `<span class="count" aria-label="${n} vencidos">${n}</span>` : ''}</a>`).join('');
}

function render() {
  clearInterval(timer); timer = null;
  const session = d.getSession(); const r = route();
  if (!session) { $nav.innerHTML = ''; $main.innerHTML = loginHTML('Entra con tu cuenta ORNAT para ver los cursos.'); return; }
  const user = session.user;
  if (user.role === 'client') { $nav.innerHTML = ''; $main.innerHTML = `<div class="login"><p class="eyebrow">( Capacitación )</p><h1>Sin acceso</h1><p class="lead">Tu rol (${esc(ROLES[user.role])}) no incluye la capacitación interna. Si crees que es un error, pide acceso al Dueño.</p><a class="btn" href="/cuenta/">Ir a Cuenta</a></div>`; return; }
  $nav.innerHTML = navHTML(user, r);
  const scroll = window.scrollY;
  let html = '';
  try {
    const manage = T.canManage(user);
    if (r.name === 'mis') html = misHTML(user);
    else if (r.name === 'constancias') html = constanciasHTML(user);
    else if (r.name === 'constancia') html = certHTML(r.a, r.b || user.id);
    else if (r.name === 'curso') html = playerHTML(user, r.a, r.b);
    else if (r.name === 'equipo' && manage) html = equipoHTML();
    else if (r.name === 'editor' && manage) html = r.a ? editorFormHTML(r.a) : editorListHTML();
    else html = catalogoHTML(user);
  } catch (e) { html = `<div class="card"><h2>No se pudo mostrar esta pantalla</h2><p class="msg" data-state="error">${esc(e.message)}</p><a class="btn" href="#/catalogo">Volver al catálogo</a></div>`; }
  $main.innerHTML = html;
  if (r.name === 'curso') startTimer(r.a, currentLessonId);
  if (document.getElementById('grid')) fillGrid();
  document.title = `${({ catalogo: 'Catálogo', mis: 'Mis cursos', curso: 'Curso', equipo: 'Equipo', editor: 'Editor de cursos', constancias: 'Constancias', constancia: 'Constancia' }[r.name] || 'Capacitación')} | ORNAT`;
  if (ui.keepScroll) { window.scrollTo(0, scroll); ui.keepScroll = false; }
}

function loginHTML(msg) {
  const next = encodeURIComponent(location.pathname + location.search);
  return `<div class="login"><div class="brand-mark">ORNAT</div><p class="eyebrow">( Capacitación )</p><h1>Entra para continuar</h1><p class="lead">${esc(msg)}</p><a class="btn" href="/cuenta/?next=${next}">Entrar</a></div>`;
}

/* ---------- catálogo ---------- */
function myStatus(courseId) {
  let rec = null; try { rec = T.progress.get(courseId); } catch {}
  return { rec, p: courseProgress(T.courses.get(courseId) || { modules: [] }, rec) };
}
function catalogoHTML(user) {
  const manage = T.canManage(user); const f = ui.filters; const all = T.courses.list(); const hasDemo = all.some(c => c.source === 'demo');
  return `<p class="eyebrow">( Capacitación )</p><h1>Catálogo de cursos</h1>
  <p class="lead">Aprende a tu ritmo: cada curso tiene módulos, lecciones y una evaluación al final. Al aprobar recibes una constancia con folio verificable.</p>
  ${manage ? `<div class="banner"><p><strong>Dueño / Editor:</strong> ${hasDemo ? 'hay cursos de ejemplo cargados; puedes quitarlos cuando tengas los tuyos.' : 'carga 3 cursos de ejemplo para probar el flujo completo, o crea uno propio.'}</p><span class="row">${hasDemo ? '<button class="btn ghost sm" data-act="clear-demo" type="button">Quitar cursos de ejemplo</button>' : '<button class="btn sm" data-act="seed-demo" type="button">Cargar cursos de ejemplo</button>'}<a class="btn dark sm" href="#/editor">Editor de cursos</a></span></div>` : ''}
  <form class="filters card" id="filters" role="search" aria-label="Filtrar cursos">
    <label class="f search">Buscar<input type="search" name="q" value="${esc(f.q)}" placeholder="Título o tema" autocomplete="off"></label>
    <label class="f">Área<select name="area"><option value="">Todas</option>${AREAS.map(a => `<option${f.area === a ? ' selected' : ''}>${esc(a)}</option>`).join('')}</select></label>
    <label class="f">Nivel<select name="level"><option value="">Todos</option>${Object.entries(LEVELS).map(([k, v]) => `<option value="${k}"${f.level === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
    <label class="f">Tipo<select name="req"><option value="">Todos</option><option value="obligatorio"${f.req === 'obligatorio' ? ' selected' : ''}>Obligatorio</option><option value="opcional"${f.req === 'opcional' ? ' selected' : ''}>Opcional</option></select></label>
    <label class="f">Mi estado<select name="mine"><option value="">Todos</option><option value="sin"${f.mine === 'sin' ? ' selected' : ''}>Sin empezar</option><option value="curso"${f.mine === 'curso' ? ' selected' : ''}>En curso</option><option value="done"${f.mine === 'done' ? ' selected' : ''}>Completado</option></select></label>
    <label class="f">Ordenar por<select name="sort"><option value="titulo"${f.sort === 'titulo' ? ' selected' : ''}>Título</option><option value="duracion"${f.sort === 'duracion' ? ' selected' : ''}>Duración</option><option value="nivel"${f.sort === 'nivel' ? ' selected' : ''}>Nivel</option><option value="avance"${f.sort === 'avance' ? ' selected' : ''}>Mi avance</option></select></label>
  </form>
  <p class="hint" id="count" aria-live="polite"></p>
  <div class="cards" id="grid"></div>`;
}
function fillGrid() {
  const grid = document.getElementById('grid'); if (!grid) return; const f = ui.filters; const q = f.q.trim().toLowerCase();
  const order = { basico: 0, intermedio: 1, avanzado: 2 };
  let rows = T.courses.list().map(c => ({ c, ...myStatus(c.id) }));
  rows = rows.filter(({ c, p, rec }) => (!f.area || c.area === f.area) && (!f.level || c.level === f.level) && (!f.req || (f.req === 'obligatorio') === c.required)
    && (!q || `${c.title} ${c.summary} ${c.area}`.toLowerCase().includes(q))
    && (!f.mine || (f.mine === 'done' ? p.completed : f.mine === 'curso' ? (!p.completed && (p.pct > 0 || !!rec)) : (p.pct === 0 && !rec))));
  rows.sort((a, b) => f.sort === 'duracion' ? courseMinutes(a.c) - courseMinutes(b.c) : f.sort === 'nivel' ? order[a.c.level] - order[b.c.level] : f.sort === 'avance' ? b.p.pct - a.p.pct : a.c.title.localeCompare(b.c.title, 'es'));
  document.getElementById('count').textContent = `${rows.length} ${rows.length === 1 ? 'curso' : 'cursos'}`;
  if (!rows.length) { grid.innerHTML = `<div class="card empty" style="grid-column:1/-1"><h3>No hay cursos con estos filtros</h3><p>${T.courses.list().length ? 'Prueba quitando algún filtro.' : T.canManage() ? 'Aún no hay cursos. Carga los de ejemplo o crea uno nuevo.' : 'Aún no hay cursos publicados.'}</p></div>`; return; }
  grid.innerHTML = rows.map(({ c, p, rec }) => {
    const lbl = p.completed ? 'Repasar' : rec ? 'Continuar' : 'Empezar';
    return `<article class="course" aria-labelledby="t-${esc(c.id)}">
      <div class="meta"><span class="tag soft">${esc(c.area)}</span><span class="tag soft">${esc(LEVELS[c.level])}</span>${c.required ? '<span class="tag lime">Obligatorio</span>' : ''}${c.status === 'borrador' ? '<span class="tag warn">Borrador</span>' : ''}${c.source === 'demo' ? '<span class="tag demo">Ejemplo</span>' : ''}</div>
      <h3 id="t-${esc(c.id)}">${esc(c.title)}</h3><p>${esc(c.summary)}</p>
      <p class="hint">${lessonsOf(c).length} lecciones · ${fmtMinutes(courseMinutes(c) * 60)}</p>
      ${p.pct || rec ? `<div><div class="bar" role="progressbar" aria-label="Avance de ${esc(c.title)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p.pct}"><i style="width:${p.pct}%"></i></div><p class="hint">${p.pct} % · ${p.done}/${p.total} lecciones${p.completed ? ' · Completado' : ''}</p></div>` : ''}
      <div class="actions"><a class="btn sm" href="#/curso/${esc(c.id)}${rec?.lastLessonId && !p.completed ? `/${esc(rec.lastLessonId)}` : ''}">${lbl}<span class="sr"> ${esc(c.title)}</span></a>${p.completed ? `<a class="btn ghost sm" href="#/constancia/${esc(c.id)}">Constancia</a>` : ''}</div></article>`;
  }).join('');
}

/* ---------- mis cursos ---------- */
function misHTML(user) {
  const rows = T.myCourses(user); const groups = [['vencido', 'Vencidos'], ['por vencer', 'Por vencer (7 días)'], ['en curso', 'En curso'], ['pendiente', 'Pendientes'], ['completado', 'Completados']];
  const body = groups.map(([s, label]) => { const list = rows.filter(r => r.status === s); if (!list.length) return ''; return `<section class="card tight"><h2 style="padding:18px 18px 0;margin:0">${label} <span class="tag soft">${list.length}</span></h2><div class="table-wrap"><table><thead><tr><th scope="col">Curso</th><th scope="col">Avance</th><th scope="col">Límite</th><th scope="col">Estado</th><th scope="col"><span class="sr">Acción</span></th></tr></thead><tbody>${list.map(r => `<tr><td><strong>${esc(r.course.title)}</strong><br><span class="hint">${esc(r.course.area)}${r.assigned ? ' · asignado' : ' · por mi cuenta'}</span></td><td style="min-width:150px"><div class="bar" role="progressbar" aria-label="Avance" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${r.progress.pct}"><i style="width:${r.progress.pct}%"></i></div><span class="hint">${r.progress.pct} %</span></td><td>${r.due ? fmtDate(r.due) : '—'}</td><td>${tagFor(r.status)}</td><td><a class="btn sm${r.status === 'completado' ? ' ghost' : ''}" href="#/curso/${esc(r.course.id)}${r.lastLessonId && r.status !== 'completado' ? `/${esc(r.lastLessonId)}` : ''}">${r.status === 'completado' ? 'Repasar' : r.progress.pct ? 'Continuar' : 'Empezar'}</a></td></tr>`).join('')}</tbody></table></div></section>`; }).join('');
  return `<p class="eyebrow">( Capacitación )</p><h1>Mis cursos</h1><p class="lead">Lo que te asignaron y lo que has empezado. Los vencidos aparecen primero.</p>${body || '<div class="card empty"><h3>Aún no tienes cursos</h3><p>Cuando te asignen uno o empieces uno del catálogo, aparecerá aquí.</p><a class="btn" href="#/catalogo">Ver catálogo</a></div>'}`;
}

/* ---------- reproductor ---------- */
let currentLessonId = '';
function playerHTML(user, courseId, lessonId) {
  const course = T.courses.get(courseId); if (!course) return `<div class="card empty"><h3>Ese curso no existe o no está publicado</h3><a class="btn" href="#/catalogo">Volver al catálogo</a></div>`;
  const rec = T.progress.get(courseId); const prog = courseProgress(course, rec); const lessons = lessonsOf(course);
  if (!lessons.length) return `<div class="card empty"><h3>Este curso aún no tiene lecciones</h3><a class="btn" href="#/catalogo">Volver</a></div>`;
  const lesson = lessons.find(l => l.id === lessonId) || lessons.find(l => l.id === (rec?.lastLessonId)) || lessons.find(l => l.id === prog.nextLessonId) || lessons[0];
  currentLessonId = lesson.id; try { T.progress.open(courseId, lesson.id); } catch {}
  const idx = lessons.findIndex(l => l.id === lesson.id); const prev = lessons[idx - 1]; const next = lessons[idx + 1];
  const done = lessonDone(lesson, T.progress.get(courseId));
  const syll = course.modules.map((m, mi) => `<h4>${mi + 1}. ${esc(m.title)}</h4><ol>${m.lessons.map(l => `<li><a href="#/curso/${esc(course.id)}/${esc(l.id)}"${l.id === lesson.id ? ' aria-current="true"' : ''}><span class="check${lessonDone(l, rec) ? ' on' : ''}" aria-hidden="true">${lessonDone(l, rec) ? '✓' : ''}</span><span>${esc(l.title)}<br><small class="hint">${esc(LESSON_TYPES[l.type])} · ${l.minutes} min${lessonDone(l, rec) ? '<span class="sr">, completada</span>' : ''}</small></span></a></li>`).join('')}</ol>`).join('');
  const links = lesson.links.filter(l => isHttps(l.url)).map(l => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)}</a></li>`).join('');
  let content = '';
  if (lesson.type === 'video') {
    const src = embedURL(lesson.url);
    content = (src ? `<iframe class="video" src="${esc(src)}" title="${esc(lesson.title)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe>` : `<div class="video-empty"><div><strong>Video pendiente</strong><p>Todavía no se ha cargado el video de esta lección.${T.canManage(user) ? ' Agrega la URL en el Editor de cursos.' : ''}</p></div></div>`) + `<div class="lesson-body">${renderMarkdown(lesson.body)}</div>`;
  } else if (lesson.type === 'enlace') {
    content = `<div class="lesson-body">${renderMarkdown(lesson.body)}</div>${isHttps(lesson.url) ? `<p><a class="btn" href="${esc(lesson.url)}" target="_blank" rel="noopener noreferrer">Abrir recurso (se abre en otra pestaña)</a></p>` : '<p class="hint">El enlace de esta lección aún no está configurado.</p>'}`;
  } else if (lesson.type === 'evaluacion') content = quizHTML(course, lesson, rec);
  else content = `<div class="lesson-body">${renderMarkdown(lesson.body)}</div>`;
  const banner = prog.completed ? `<div class="banner"><p><strong>¡Curso completado!</strong> Tu constancia ya está lista${rec?.certificate ? ` (folio ${esc(rec.certificate.folio)})` : ''}.</p><a class="btn sm" href="#/constancia/${esc(course.id)}">Ver constancia</a></div>` : '';
  const finishBtn = lesson.type === 'evaluacion' ? '' : done ? '' : `<button class="btn" type="button" data-act="complete" data-course="${esc(course.id)}" data-lesson="${esc(lesson.id)}" data-next="${esc(next?.id || '')}">${next ? 'Marcar como vista y continuar' : 'Marcar como vista y terminar'}</button>`;
  return `<p class="eyebrow"><a href="#/catalogo">Catálogo</a> / ${esc(course.area)}</p><h1>${esc(course.title)}</h1>
  <div class="row" style="margin:12px 0 20px"><div class="bar" style="flex:1;min-width:160px" role="progressbar" aria-label="Avance del curso" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${prog.pct}"><i style="width:${prog.pct}%"></i></div><span class="hint">${prog.pct} % · ${prog.done}/${prog.total}${rec?.lessons ? ` · ${fmtMinutes(prog.seconds)} dedicados` : ''}</span></div>
  ${banner}
  <div class="player"><nav class="card tight syllabus" aria-label="Contenido del curso">${syll}</nav>
  <article class="card" aria-labelledby="lt"><p class="eyebrow">${esc(LESSON_TYPES[lesson.type])} · ${lesson.minutes} min · lección ${idx + 1} de ${lessons.length}${done ? ' · completada' : ''}</p><h2 id="lt">${esc(lesson.title)}</h2>${content}
  ${links ? `<h3 style="margin-top:20px">Enlaces de apoyo</h3><ul>${links}</ul>` : ''}
  <div class="row between" style="margin-top:26px"><span>${prev ? `<a class="btn ghost" href="#/curso/${esc(course.id)}/${esc(prev.id)}">← Anterior</a>` : ''}</span><span class="row">${finishBtn}${done && next ? `<a class="btn" href="#/curso/${esc(course.id)}/${esc(next.id)}">Siguiente →</a>` : ''}</span></div></article></div>`;
}
function quizHTML(course, lesson, rec) {
  const L = rec?.lessons?.[lesson.id]; const quiz = lesson.quiz; const max = quiz.maxAttempts; const attempts = L?.attempts || 0; const left = max ? Math.max(0, max - attempts) : null;
  const shown = ui.quiz && ui.quiz.lessonId === lesson.id ? ui.quiz.result : null;
  const intro = `<div class="lesson-body">${renderMarkdown(lesson.body)}</div><p class="hint">Calificación mínima: <strong>${quiz.minScore} %</strong> · ${max ? `Intentos: ${attempts}/${max}` : 'Intentos ilimitados'}${L?.score != null ? ` · Mejor calificación: ${L.score} %` : ''}</p>`;
  if (shown) {
    const res = shown; const reveal = res.passed || res.attemptsLeft === 0;
    const items = quiz.questions.map((q, i) => { const r = res.results.find(x => x.id === q.id); const chosen = q.options.find(o => o.id === r.chosen); const right = q.options.find(o => o.id === r.correctId);
      return `<div class="question ${r.correct ? 'right' : 'wrong'}"><strong>${i + 1}. ${esc(q.text)}</strong><p class="fb">${r.correct ? '<span class="tag good">Correcta</span>' : '<span class="tag bad">Incorrecta</span>'} Tu respuesta: ${chosen ? esc(chosen.text) : '<em>sin responder</em>'}${!r.correct && reveal ? `<br>Respuesta correcta: <strong>${esc(right?.text || '')}</strong>` : ''}</p>${q.feedback ? `<p class="fb">${esc(q.feedback)}</p>` : ''}</div>`; }).join('');
    return `${intro}<div class="card" style="background:${res.passed ? '#f1f7d9' : '#fdf3f3'}" role="status"><h3>${res.passed ? 'Aprobaste' : 'No alcanzaste la calificación mínima'}</h3><p>Obtuviste <strong>${res.score} %</strong> (${res.correctCount}/${res.total}).${res.passed ? '' : left === null ? ' Puedes intentarlo de nuevo.' : left > 0 ? ` Te quedan ${left} intento(s).` : ' Agotaste tus intentos; pide a Dirección que los reinicie.'}</p></div>${items}
      <div class="row">${res.passed ? '<button class="btn" type="button" data-act="quiz-continue">Continuar</button>' : (left === null || left > 0) ? '<button class="btn" type="button" data-act="quiz-retry">Intentar de nuevo</button>' : ''}</div>`;
  }
  if (L?.passed) return `${intro}<div class="card" style="background:#f1f7d9" role="status"><h3>Evaluación aprobada</h3><p>Tu mejor calificación fue ${L.score} %.</p></div>`;
  if (max && attempts >= max) return `${intro}<div class="card" style="background:#fdf3f3" role="status"><h3>Sin intentos disponibles</h3><p>Agotaste los ${max} intentos. Pide a Dirección que los reinicie desde el panel de Equipo.</p></div>`;
  return `${intro}<form id="quiz" data-course="${esc(course.id)}" data-lesson="${esc(lesson.id)}" class="stack">${quiz.questions.map((q, i) => `<fieldset class="question"><legend>${i + 1}. ${esc(q.text)}</legend>${q.options.map(o => `<label class="opt"><input type="radio" name="${esc(q.id)}" value="${esc(o.id)}"> <span>${esc(o.text)}</span></label>`).join('')}</fieldset>`).join('')}<p class="msg" id="quiz-msg" data-state="error"></p><div><button class="btn" type="submit">Enviar respuestas</button></div></form>`;
}
function startTimer(courseId, lessonId) {
  clearInterval(timer);
  timer = setInterval(() => { if (!document.hidden && currentLessonId) { try { T.progress.addTime(courseId, currentLessonId, 10); } catch {} } }, 10000);
}

/* ---------- constancias ---------- */
function constanciasHTML(user) {
  const mine = T.myCourses(user).filter(r => r.certificate); const v = ui.verify;
  return `<p class="eyebrow">( Capacitación )</p><h1>Constancias</h1><p class="lead">Se emiten automáticamente al completar un curso. Cada una lleva un folio que se puede verificar aquí.</p>
  <div class="grid wide"><section class="card"><h2>Mis constancias</h2>${mine.length ? `<ul class="checklist">${mine.map(r => `<li><span style="flex:1"><strong>${esc(r.course.title)}</strong><br><span class="hint">Folio ${esc(r.certificate.folio)} · ${fmtDate(r.certificate.issuedAt.slice(0, 10))}</span></span><a class="btn sm" href="#/constancia/${esc(r.course.id)}">Ver</a></li>`).join('')}</ul>` : '<p class="hint">Aún no tienes constancias. Completa un curso para obtener la primera.</p>'}</section>
  <section class="card"><h2>Verificar un folio</h2><form id="verify" class="stack"><label class="f">Folio<input name="folio" placeholder="ORN-XXXXX-XXXXX-XX" autocomplete="off" required></label><button class="btn" type="submit">Verificar</button></form>
  <div id="verify-out" role="status" aria-live="polite">${v === undefined ? '' : v ? `<p class="msg" data-state="ok">Folio válido: ${esc(v.name)} · ${esc(v.title)} · ${fmtDate(v.completedAt.slice(0, 10))}</p>` : '<p class="msg" data-state="error">No encontramos ese folio en este navegador (demo).</p>'}</div>
  <p class="hint">Demo: solo se verifican folios emitidos en este navegador. En producción el backend firma y valida el folio.</p></section></div>`;
}
function certHTML(courseId, userId) {
  const c = T.certificate(courseId, userId);
  if (!c) return `<div class="card empty"><h3>Aún no hay constancia</h3><p>Completa todas las lecciones y aprueba la evaluación para obtenerla.</p><a class="btn" href="#/curso/${esc(courseId)}">Ir al curso</a></div>`;
  return `<div class="row no-print" style="margin-bottom:16px"><a class="btn ghost sm" href="#/constancias">← Constancias</a><span class="spacer"></span><button class="btn" type="button" data-act="print">Imprimir o guardar PDF</button></div>
  <section class="cert print-only-cert" aria-label="Constancia de finalización"><div class="logo">ORNAT</div><p class="eyebrow" style="margin:0">Constancia de finalización</p><p>Se otorga a</p><div class="name">${esc(c.name)}</div><p>por haber completado y aprobado el curso</p><h1>${esc(c.title)}</h1>
  <p>${esc(c.area)} · ${fmtMinutes(c.minutes * 60)}${c.score != null ? ` · calificación ${c.score} %` : ''}<br>Fecha de finalización: ${esc(fmtDateLong(c.completedAt.slice(0, 10)))}</p>
  <p class="folio">Folio ${esc(c.folio)}</p><div class="sign"><div>Firma ORNAT<br><small>Dirección</small></div><div>Verificación<br><small>/capacitacion/#/constancias</small></div></div></section>`;
}

/* ---------- equipo ---------- */
function equipoHTML() {
  const rows = T.teamReport(); const courses = T.courses.list().filter(c => c.status === 'publicado'); const users = d.users.list().filter(u => u.role !== 'client'); const assigns = T.assignments.list();
  const tf = ui.teamFilter; const view = rows.filter(r => (!tf.status || r.status === tf.status) && (!tf.course || r.course.id === tf.course));
  const byCourse = courses.map(c => { const rs = rows.filter(r => r.course.id === c.id); return { c, n: rs.length, done: rs.filter(r => r.status === 'completado').length }; }).filter(x => x.n);
  const byUser = users.map(u => { const rs = rows.filter(r => r.user.id === u.id); return { u, n: rs.length, done: rs.filter(r => r.status === 'completado').length, over: rs.filter(r => r.status === 'vencido').length, avg: rs.length ? Math.round(rs.reduce((s, r) => s + r.progress.pct, 0) / rs.length) : null }; }).filter(x => x.n);
  const chart = byCourse.length ? chartSVG(byCourse) : '';
  return `<p class="eyebrow">( Capacitación )</p><h1>Equipo</h1><p class="lead">Asigna cursos a personas o roles, revisa quién va al día y exporta el avance.</p>
  <div class="stats"><div class="card stat"><b>${rows.length}</b><span>Asignaciones activas</span></div><div class="card stat"><b>${rows.filter(r => r.status === 'completado').length}</b><span>Completadas</span></div><div class="card stat"><b>${rows.filter(r => r.status === 'vencido').length}</b><span>Vencidas</span></div><div class="card stat"><b>${rows.filter(r => r.status === 'por vencer').length}</b><span>Por vencer</span></div></div>
  <section class="card"><h2>Asignar un curso</h2>${courses.length ? `<form id="assign" class="stack"><div class="fields"><label class="f">Curso<select name="courseId" required>${courses.map(c => `<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('')}</select></label>
  <label class="f">A quién<select name="target" required><optgroup label="Por rol">${Object.entries({ owner: 'dueños', editor: 'editores', sales: 'vendedores' }).map(([k, v]) => `<option value="role:${k}">Todos los ${v}</option>`).join('')}</optgroup><optgroup label="Persona">${users.map(u => `<option value="user:${esc(u.id)}">${esc(u.name)} (${esc(ROLES[u.role])})</option>`).join('')}</optgroup></select></label>
  <label class="f">Fecha límite<input type="date" name="due" min="${todayISO()}"></label></div><div><button class="btn" type="submit">Asignar</button></div></form>` : '<p class="hint">Publica al menos un curso para poder asignarlo.</p>'}
  ${assigns.length ? `<h3 style="margin-top:22px">Asignaciones</h3><ul class="checklist">${assigns.map(a => { const c = T.courses.list().find(x => x.id === a.courseId); const who = a.target.type === 'role' ? `Rol: ${ROLES[a.target.value]}` : users.find(u => u.id === a.target.value)?.name || '(persona eliminada)'; return `<li><span style="flex:1"><strong>${esc(c?.title || a.courseId)}</strong> → ${esc(who)}${a.due ? ` · límite ${fmtDate(a.due)}` : ''}</span><button class="btn danger sm" type="button" data-act="unassign" data-id="${esc(a.id)}">Quitar</button></li>`; }).join('')}</ul>` : ''}</section>
  ${chart ? `<section class="card"><h2>Finalización por curso</h2>${chart}</section>` : ''}
  <section class="card tight"><div class="row between" style="padding:18px"><h2 style="margin:0">Avance por persona y curso</h2><span class="row">
  <label class="f" style="min-width:150px">Estado<select data-tf="status"><option value="">Todos</option>${['completado', 'en curso', 'pendiente', 'por vencer', 'vencido'].map(s => `<option${tf.status === s ? ' selected' : ''}>${s}</option>`).join('')}</select></label>
  <label class="f" style="min-width:180px">Curso<select data-tf="course"><option value="">Todos</option>${courses.map(c => `<option value="${esc(c.id)}"${tf.course === c.id ? ' selected' : ''}>${esc(c.title)}</option>`).join('')}</select></label>
  <button class="btn ghost sm" type="button" data-act="csv">Exportar CSV</button></span></div>
  <div class="table-wrap"><table><caption class="sr">Avance del equipo por curso</caption><thead><tr><th scope="col">Persona</th><th scope="col">Curso</th><th scope="col">Avance</th><th scope="col">Estado</th><th scope="col">Límite</th><th scope="col">Calif.</th><th scope="col">Acciones</th></tr></thead><tbody>
  ${view.map(r => `<tr><td><strong>${esc(r.user.name)}</strong><br><span class="hint">${esc(ROLES[r.user.role])}</span></td><td>${esc(r.course.title)}</td><td style="min-width:130px"><div class="bar" role="progressbar" aria-label="Avance de ${esc(r.user.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${r.progress.pct}"><i style="width:${r.progress.pct}%"></i></div><span class="hint">${r.progress.pct} %</span></td><td>${tagFor(r.status)}</td><td>${r.due ? fmtDate(r.due) : '—'}</td><td>${r.progress.avgScore != null ? `${r.progress.avgScore} %` : '—'}</td><td><div class="row">${r.certificate ? `<a class="btn ghost sm" href="#/constancia/${esc(r.course.id)}/${esc(r.user.id)}">Constancia</a>` : ''}<button class="btn ghost sm" type="button" data-act="reset-attempts" data-user="${esc(r.user.id)}" data-course="${esc(r.course.id)}">Reiniciar intentos</button></div></td></tr>`).join('') || '<tr><td colspan="7" class="hint">Sin resultados. Asigna un curso para ver el avance.</td></tr>'}</tbody></table></div></section>
  ${byUser.length ? `<section class="card tight"><h2 style="padding:18px 18px 0;margin:0">Resumen por persona</h2><div class="table-wrap"><table><thead><tr><th scope="col">Persona</th><th scope="col">Asignados</th><th scope="col">Completados</th><th scope="col">Vencidos</th><th scope="col">Avance promedio</th></tr></thead><tbody>${byUser.map(x => `<tr><td>${esc(x.u.name)}</td><td>${x.n}</td><td>${x.done}</td><td>${x.over ? `<span class="tag bad">${x.over}</span>` : '0'}</td><td>${x.avg} %</td></tr>`).join('')}</tbody></table></div></section>` : ''}`;
}
function chartSVG(items) {
  const W = 640, row = 40, H = items.length * row + 16; const trunc = s => (s.length > 34 ? `${s.slice(0, 33)}…` : s);
  const desc = items.map(x => `${x.c.title}: ${x.done} de ${x.n} completaron (${Math.round(x.done / x.n * 100)} %)`).join('. ');
  return `<figure class="chart-fig"><svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="ch-t ch-d"><title id="ch-t">Porcentaje de finalización por curso</title><desc id="ch-d">${esc(desc)}</desc>
  ${items.map((x, i) => { const y = 8 + i * row; const pct = Math.round(x.done / x.n * 100); return `<text x="0" y="${y + 14}" font-size="13" fill="#181a18">${esc(trunc(x.c.title))}</text><rect x="0" y="${y + 20}" width="${W - 90}" height="10" rx="5" fill="#e6e4da"/><rect x="0" y="${y + 20}" width="${Math.max(pct ? 6 : 0, (W - 90) * pct / 100)}" height="10" rx="5" fill="#66871d"/><text x="${W - 80}" y="${y + 30}" font-size="13" font-weight="700" fill="#181a18">${pct} % (${x.done}/${x.n})</text>`; }).join('')}</svg><figcaption class="hint">Los mismos datos están en la tabla de abajo.</figcaption></figure>`;
}

/* ---------- editor de cursos ---------- */
function editorListHTML() {
  const list = T.courses.list();
  return `<p class="eyebrow">( Capacitación )</p><h1>Editor de cursos</h1><p class="lead">Crea, edita, duplica y publica cursos. Solo los cursos publicados se pueden asignar y ver por el equipo.</p>
  <div class="row" style="margin-bottom:18px"><button class="btn" type="button" data-act="new-course">Nuevo curso</button>${list.some(c => c.source === 'demo') ? '<button class="btn ghost" type="button" data-act="clear-demo">Quitar cursos de ejemplo</button>' : '<button class="btn ghost" type="button" data-act="seed-demo">Cargar cursos de ejemplo</button>'}</div>
  <div class="card tight"><div class="table-wrap"><table><caption class="sr">Cursos</caption><thead><tr><th scope="col">Curso</th><th scope="col">Área</th><th scope="col">Lecciones</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead><tbody>${list.map(c => `<tr><td><strong>${esc(c.title)}</strong> ${c.source === 'demo' ? '<span class="tag demo">Ejemplo</span>' : ''}</td><td>${esc(c.area)}</td><td>${lessonsOf(c).length}</td><td><span class="tag ${c.status === 'publicado' ? 'good' : 'warn'}">${c.status === 'publicado' ? 'Publicado' : 'Borrador'}</span></td><td><div class="row"><a class="btn sm" href="#/editor/${esc(c.id)}">Editar</a><button class="btn ghost sm" type="button" data-act="duplicate" data-id="${esc(c.id)}">Duplicar</button><button class="btn ghost sm" type="button" data-act="toggle-status" data-id="${esc(c.id)}">${c.status === 'publicado' ? 'Pasar a borrador' : 'Publicar'}</button><button class="btn danger sm" type="button" data-act="delete-course" data-id="${esc(c.id)}">Eliminar</button></div></td></tr>`).join('') || '<tr><td colspan="5" class="hint">Aún no hay cursos.</td></tr>'}</tbody></table></div></div>`;
}
const newId = () => rid().slice(0, 12);
const blankLesson = () => ({ id: newId(), type: 'texto', title: 'Nueva lección', minutes: 5, body: '', url: '', links: [], quiz: null });
const blankQuestion = () => ({ id: newId(), type: 'opcion', text: '', options: [{ id: 'o1', text: '' }, { id: 'o2', text: '' }], correct: 'o1', feedback: '' });
function editorFormHTML(id) {
  if (!ui.draft || (id === 'nuevo' ? !ui.draft.isNew : ui.draft.id !== id)) {
    if (id === 'nuevo') ui.draft = { id: newId(), title: '', summary: '', area: AREAS[0], level: 'basico', required: false, status: 'borrador', source: 'manual', modules: [{ id: newId(), title: 'Módulo 1', lessons: [blankLesson()] }], isNew: true };
    else { const c = T.courses.list().find(x => x.id === id); if (!c) return '<div class="card empty"><h3>Ese curso no existe</h3><a class="btn" href="#/editor">Volver</a></div>'; ui.draft = JSON.parse(JSON.stringify(c)); }
  }
  const c = ui.draft; const b = (path, extra = '') => `data-b="${path}" ${extra}`;
  const mods = c.modules.map((m, mi) => `<div class="edit-mod"><div class="row"><label class="f" style="flex:1;min-width:200px">Módulo ${mi + 1}<input ${b(`modules.${mi}.title`)} value="${esc(m.title)}" maxlength="140"></label>
  <button class="iconbtn" type="button" data-act="mv-module" data-m="${mi}" data-dir="-1" aria-label="Subir módulo ${mi + 1}"${mi === 0 ? ' disabled' : ''}>↑</button><button class="iconbtn" type="button" data-act="mv-module" data-m="${mi}" data-dir="1" aria-label="Bajar módulo ${mi + 1}"${mi === c.modules.length - 1 ? ' disabled' : ''}>↓</button><button class="btn danger sm" type="button" data-act="del-module" data-m="${mi}">Eliminar módulo</button></div>
  ${m.lessons.map((l, li) => lessonEditHTML(l, mi, li, m.lessons.length)).join('')}<button class="btn ghost sm" type="button" data-act="add-lesson" data-m="${mi}">+ Lección</button></div>`).join('');
  const problems = publishProblems(cleanCourse({ ...c, title: c.title || 'x' }));
  return `<p class="eyebrow"><a href="#/editor">Editor de cursos</a> / ${c.isNew ? 'Nuevo' : 'Editar'}</p><h1>${esc(c.title || 'Curso sin título')}</h1>
  <form id="course-form" class="stack" novalidate><section class="card"><h2>Datos del curso</h2><div class="fields"><label class="f">Título<input ${b('title')} value="${esc(c.title)}" maxlength="140" required></label>
  <label class="f">Área<select ${b('area')}>${AREAS.map(a => `<option${c.area === a ? ' selected' : ''}>${esc(a)}</option>`).join('')}</select></label>
  <label class="f">Nivel<select ${b('level')}>${Object.entries(LEVELS).map(([k, v]) => `<option value="${k}"${c.level === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
  <label class="f">Estado<select ${b('status')}><option value="borrador"${c.status === 'borrador' ? ' selected' : ''}>Borrador</option><option value="publicado"${c.status === 'publicado' ? ' selected' : ''}>Publicado</option></select></label></div>
  <label class="f">Resumen<textarea ${b('summary')} maxlength="600" style="min-height:70px">${esc(c.summary)}</textarea></label><label class="f chk"><input type="checkbox" ${b('required')}${c.required ? ' checked' : ''}> Curso obligatorio</label>
  ${problems.length ? `<p class="hint">Pendiente para publicar: ${esc(problems.slice(0, 3).join(' '))}${problems.length > 3 ? ` (+${problems.length - 3})` : ''}</p>` : ''}</section>
  <section class="card"><h2>Módulos y lecciones</h2>${mods}<button class="btn ghost" type="button" data-act="add-module">+ Módulo</button></section>
  <p class="msg" id="course-msg" role="alert"></p><div class="row"><button class="btn" type="submit">Guardar curso</button><a class="btn ghost" href="#/editor" data-act="discard">Cancelar</a></div></form>`;
}
function lessonEditHTML(l, mi, li, n) {
  const p = `modules.${mi}.lessons.${li}`; const b = path => `data-b="${p}.${path}"`;
  let extra = '';
  if (l.type === 'video') extra = `<label class="f">URL del video (YouTube o Vimeo, https)<input ${b('url')} value="${esc(l.url)}" placeholder="https://www.youtube.com/watch?v=..." inputmode="url"></label>${l.url && !embedURL(l.url) ? '<p class="msg" data-state="error">URL no reconocida: se guardará vacía. Usa un enlace de YouTube o Vimeo.</p>' : '<p class="hint">Déjalo vacío si el video aún no está grabado; la lección mostrará «Video pendiente».</p>'}`;
  if (l.type === 'enlace') extra = `<label class="f">URL del recurso o archivo (https)<input ${b('url')} value="${esc(l.url)}" placeholder="https://..." inputmode="url"></label>`;
  const links = `<div><strong style="margin-right:10px">Enlaces de apoyo</strong>${l.links.map((k, ki) => `<div class="row" style="margin:6px 0"><input class="inline-input" style="flex:1;min-width:120px" ${b(`links.${ki}.label`)} value="${esc(k.label)}" aria-label="Texto del enlace ${ki + 1}" placeholder="Texto"><input class="inline-input" style="flex:2;min-width:160px" ${b(`links.${ki}.url`)} value="${esc(k.url)}" aria-label="URL del enlace ${ki + 1}" placeholder="https://..."><button class="iconbtn" type="button" data-act="del-link" data-m="${mi}" data-l="${li}" data-k="${ki}" aria-label="Quitar enlace ${ki + 1}">×</button></div>`).join('')}${l.links.length < 10 ? `<button class="btn ghost sm" type="button" data-act="add-link" data-m="${mi}" data-l="${li}">+ Enlace</button>` : ''}</div>`;
  const quiz = l.type === 'evaluacion' ? quizEditHTML(l, mi, li) : '';
  return `<div class="edit-les"><div class="row"><label class="f" style="flex:1;min-width:200px">Lección ${li + 1}<input ${b('title')} value="${esc(l.title)}" maxlength="140"></label>
  <label class="f" style="width:170px">Tipo<select ${b('type')}>${Object.entries(LESSON_TYPES).map(([k, v]) => `<option value="${k}"${l.type === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
  <label class="f" style="width:100px">Minutos<input type="number" min="0" max="600" ${b('minutes')} value="${l.minutes}"></label>
  <button class="iconbtn" type="button" data-act="mv-lesson" data-m="${mi}" data-l="${li}" data-dir="-1" aria-label="Subir lección ${li + 1} del módulo ${mi + 1}"${li === 0 ? ' disabled' : ''}>↑</button><button class="iconbtn" type="button" data-act="mv-lesson" data-m="${mi}" data-l="${li}" data-dir="1" aria-label="Bajar lección ${li + 1} del módulo ${mi + 1}"${li === n - 1 ? ' disabled' : ''}>↓</button><button class="btn danger sm" type="button" data-act="del-lesson" data-m="${mi}" data-l="${li}">Eliminar</button></div>
  ${extra}<label class="f">${l.type === 'evaluacion' ? 'Instrucciones' : 'Contenido'} (markdown básico: # títulos, **negritas**, *cursiva*, listas, &gt; citas, [texto](https://...))<textarea ${b('body')} maxlength="20000">${esc(l.body)}</textarea></label>${links}${quiz}</div>`;
}
function quizEditHTML(l, mi, li) {
  const p = `modules.${mi}.lessons.${li}.quiz`; l.quiz ||= { minScore: 80, maxAttempts: 3, questions: [] };
  return `<fieldset class="edit-q" style="border-style:solid"><legend>Evaluación</legend><div class="fields"><label class="f">Calificación mínima (50–100)<input type="number" min="50" max="100" data-b="${p}.minScore" value="${l.quiz.minScore}"></label><label class="f">Intentos (0 = ilimitados)<input type="number" min="0" max="10" data-b="${p}.maxAttempts" value="${l.quiz.maxAttempts}"></label></div>
  ${l.quiz.questions.map((q, qi) => { const qp = `${p}.questions.${qi}`; return `<div class="edit-q"><div class="row"><label class="f" style="flex:1;min-width:200px">Pregunta ${qi + 1}<input data-b="${qp}.text" value="${esc(q.text)}" maxlength="500"></label><label class="f" style="width:190px">Tipo<select data-b="${qp}.type"><option value="opcion"${q.type === 'opcion' ? ' selected' : ''}>Opción múltiple</option><option value="vf"${q.type === 'vf' ? ' selected' : ''}>Verdadero / falso</option></select></label><button class="btn danger sm" type="button" data-act="del-q" data-m="${mi}" data-l="${li}" data-q="${qi}">Quitar</button></div>
  ${q.type === 'vf' ? `<label class="f">Respuesta correcta<select data-b="${qp}.correct"><option value="v"${q.correct === 'v' ? ' selected' : ''}>Verdadero</option><option value="f"${q.correct === 'f' ? ' selected' : ''}>Falso</option></select></label>` : `<div role="radiogroup" aria-label="Opciones de la pregunta ${qi + 1}">${q.options.map((o, oi) => `<div class="row" style="margin:6px 0"><input type="radio" name="c-${mi}-${li}-${qi}" data-b="${qp}.correct" value="${esc(o.id)}"${q.correct === o.id ? ' checked' : ''} aria-label="Marcar opción ${oi + 1} como correcta" style="width:20px;height:20px;accent-color:#66871d"><input class="inline-input" style="flex:1;min-width:160px" data-b="${qp}.options.${oi}.text" value="${esc(o.text)}" aria-label="Opción ${oi + 1}" placeholder="Opción ${oi + 1}"><button class="iconbtn" type="button" data-act="del-opt" data-m="${mi}" data-l="${li}" data-q="${qi}" data-o="${oi}" aria-label="Quitar opción ${oi + 1}"${q.options.length <= 2 ? ' disabled' : ''}>×</button></div>`).join('')}${q.options.length < 6 ? `<button class="btn ghost sm" type="button" data-act="add-opt" data-m="${mi}" data-l="${li}" data-q="${qi}">+ Opción</button>` : ''}</div>`}
  <label class="f">Retroalimentación (se muestra tras responder)<input data-b="${qp}.feedback" value="${esc(q.feedback)}" maxlength="500"></label></div>`; }).join('')}
  <button class="btn ghost sm" type="button" data-act="add-q" data-m="${mi}" data-l="${li}">+ Pregunta</button></fieldset>`;
}
const BAD = new Set(['__proto__', 'prototype', 'constructor']);
function setPath(obj, path, value) {
  const keys = path.split('.'); if (keys.some(k => BAD.has(k) || !/^[A-Za-z0-9]+$/.test(k))) return;
  let cur = obj; for (let i = 0; i < keys.length - 1; i++) { cur = cur?.[keys[i]]; if (cur == null || typeof cur !== 'object') return; }
  cur[keys.at(-1)] = value;
}

/* ---------- eventos ---------- */
const act = {
  'seed-demo': () => { const n = T.courses.seedDemo(); toast(`${n} cursos de ejemplo cargados.`); render(); },
  'clear-demo': () => { if (!confirm('¿Quitar los cursos de ejemplo y su progreso?')) return; T.courses.clearDemo(); toast('Cursos de ejemplo quitados.'); render(); },
  complete: el => { const issued = T.progress.complete(el.dataset.course, el.dataset.lesson); if (issued) toast(`¡Curso completado! Folio ${issued.folio}`); go(el.dataset.next ? `#/curso/${el.dataset.course}/${el.dataset.next}` : `#/curso/${el.dataset.course}/${el.dataset.lesson}`); },
  'quiz-retry': () => { ui.quiz = null; ui.keepScroll = true; render(); },
  'quiz-continue': () => { const course = route().a; const c = T.courses.get(course); const ls = lessonsOf(c); const i = ls.findIndex(l => l.id === ui.quiz.lessonId); ui.quiz = null; const nx = ls[i + 1]; go(nx ? `#/curso/${course}/${nx.id}` : `#/curso/${course}/${ls[i].id}`); },
  print: () => window.print(),
  unassign: el => { T.assignments.remove(el.dataset.id); toast('Asignación quitada.'); render(); },
  'reset-attempts': el => { const c = T.courses.list().find(x => x.id === el.dataset.course); for (const l of lessonsOf(c).filter(x => x.type === 'evaluacion')) T.progress.resetAttempts(el.dataset.user, c.id, l.id); toast('Intentos reiniciados.'); render(); },
  csv: () => {
    const rows = [['Persona', 'Correo', 'Rol', 'Curso', 'Área', 'Avance %', 'Estado', 'Fecha límite', 'Calificación promedio %', 'Tiempo (min)', 'Folio constancia']];
    for (const r of T.teamReport()) rows.push([r.user.name, r.user.email, ROLES[r.user.role], r.course.title, r.course.area, r.progress.pct, r.status, r.due, r.progress.avgScore ?? '', Math.round(r.progress.seconds / 60), r.certificate?.folio || '']);
    downloadText(`capacitacion-equipo-${todayISO()}.csv`, toCSV(rows)); toast('CSV exportado.');
  },
  'new-course': () => { ui.draft = null; go('#/editor/nuevo'); },
  duplicate: el => { T.courses.duplicate(el.dataset.id); toast('Curso duplicado como borrador.'); render(); },
  'toggle-status': el => { const c = T.courses.list().find(x => x.id === el.dataset.id); T.courses.setStatus(c.id, c.status === 'publicado' ? 'borrador' : 'publicado'); toast(c.status === 'publicado' ? 'Curso en borrador.' : 'Curso publicado.'); render(); },
  'delete-course': el => { const c = T.courses.list().find(x => x.id === el.dataset.id); if (!confirm(`¿Eliminar «${c.title}»? Se borran sus asignaciones y el progreso.`)) return; T.courses.remove(c.id); toast('Curso eliminado.'); render(); },
  discard: () => { ui.draft = null; },
};
const structural = {
  'add-module': () => ui.draft.modules.push({ id: newId(), title: `Módulo ${ui.draft.modules.length + 1}`, lessons: [blankLesson()] }),
  'del-module': el => ui.draft.modules.splice(+el.dataset.m, 1),
  'mv-module': el => move(ui.draft.modules, +el.dataset.m, +el.dataset.dir),
  'add-lesson': el => ui.draft.modules[+el.dataset.m].lessons.push(blankLesson()),
  'del-lesson': el => ui.draft.modules[+el.dataset.m].lessons.splice(+el.dataset.l, 1),
  'mv-lesson': el => move(ui.draft.modules[+el.dataset.m].lessons, +el.dataset.l, +el.dataset.dir),
  'add-link': el => ui.draft.modules[+el.dataset.m].lessons[+el.dataset.l].links.push({ label: '', url: '' }),
  'del-link': el => ui.draft.modules[+el.dataset.m].lessons[+el.dataset.l].links.splice(+el.dataset.k, 1),
  'add-q': el => { const l = ui.draft.modules[+el.dataset.m].lessons[+el.dataset.l]; l.quiz ||= { minScore: 80, maxAttempts: 3, questions: [] }; l.quiz.questions.push(blankQuestion()); },
  'del-q': el => ui.draft.modules[+el.dataset.m].lessons[+el.dataset.l].quiz.questions.splice(+el.dataset.q, 1),
  'add-opt': el => { const q = ui.draft.modules[+el.dataset.m].lessons[+el.dataset.l].quiz.questions[+el.dataset.q]; q.options.push({ id: `o${newId()}`.slice(0, 14), text: '' }); },
  'del-opt': el => { const q = ui.draft.modules[+el.dataset.m].lessons[+el.dataset.l].quiz.questions[+el.dataset.q]; const [gone] = q.options.splice(+el.dataset.o, 1); if (q.correct === gone.id) q.correct = q.options[0].id; },
};
function move(arr, i, dir) { const j = i + dir; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; }

$main.addEventListener('click', guard(e => {
  const el = e.target.closest('[data-act]'); if (!el) return; const name = el.dataset.act;
  if (structural[name] && ui.draft) { e.preventDefault(); structural[name](el); ui.keepScroll = true; render(); return; }
  if (act[name]) { if (el.tagName === 'A' && name !== 'discard') e.preventDefault(); act[name](el); }
}));
$main.addEventListener('input', e => {
  const el = e.target;
  if (el.closest('#filters')) { const f = new FormData(el.closest('form')); ui.filters = { ...ui.filters, ...Object.fromEntries(f) }; fillGrid(); return; }
  if (el.dataset.b && ui.draft && el.type !== 'radio' && el.tagName !== 'SELECT' && el.type !== 'checkbox') setPath(ui.draft, el.dataset.b, el.type === 'number' ? Number(el.value) : el.value);
});
$main.addEventListener('change', e => {
  const el = e.target;
  if (el.closest('#filters')) { ui.filters = { ...ui.filters, ...Object.fromEntries(new FormData(el.closest('form'))) }; fillGrid(); return; }
  if (el.dataset.tf) { ui.teamFilter[el.dataset.tf] = el.value; ui.keepScroll = true; render(); return; }
  if (el.dataset.b && ui.draft) {
    if (el.type === 'radio' && !el.checked) return;
    setPath(ui.draft, el.dataset.b, el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value);
    if (/\.(type|status)$/.test(el.dataset.b) && !el.dataset.b.startsWith('status')) { if (/questions\.\d+\.type$/.test(el.dataset.b)) { const q = el.dataset.b.split('.').slice(0, -1).reduce((o, k) => o[k], ui.draft); if (q.type === 'vf') q.correct = 'v'; else { q.options = q.options.length >= 2 ? q.options : [{ id: 'o1', text: '' }, { id: 'o2', text: '' }]; q.correct = q.options[0].id; } } ui.keepScroll = true; render(); }
  }
});
$main.addEventListener('submit', guard(e => {
  e.preventDefault(); const f = e.target;
  if (f.id === 'quiz') {
    const answers = {}; for (const [k, v] of new FormData(f)) answers[k] = v;
    const msg = document.getElementById('quiz-msg'); const course = T.courses.get(f.dataset.course); const lesson = lessonsOf(course).find(l => l.id === f.dataset.lesson);
    if (lesson.quiz.questions.some(q => !answers[q.id])) { msg.textContent = 'Responde todas las preguntas antes de enviar.'; return; }
    const result = T.progress.submitQuiz(f.dataset.course, f.dataset.lesson, answers);
    ui.quiz = { lessonId: f.dataset.lesson, result }; if (result.certificate) toast(`¡Curso completado! Folio ${result.certificate.folio}`); ui.keepScroll = false; render(); window.scrollTo(0, 0);
  } else if (f.id === 'assign') {
    const fd = new FormData(f); const [type, value] = String(fd.get('target')).split(':');
    T.assignments.assign({ courseId: fd.get('courseId'), target: { type, value }, due: fd.get('due') || '' }); toast('Curso asignado.'); ui.keepScroll = true; render();
  } else if (f.id === 'verify') {
    ui.verify = T.verifyFolio(new FormData(f).get('folio')); render();
  } else if (f.id === 'course-form') {
    const msg = document.getElementById('course-msg');
    try { const saved = T.courses.save(ui.draft); toast(saved.status === 'publicado' ? 'Curso guardado y publicado.' : 'Borrador guardado.'); ui.draft = null; go('#/editor'); }
    catch (err) { msg.textContent = err.message; msg.dataset.state = 'error'; msg.focus?.(); }
  }
}));

window.addEventListener('hashchange', () => { ui.quiz = null; if (!route().name.startsWith('editor')) ui.draft = null; ui.verify = undefined; render(); window.scrollTo(0, 0); $main.focus({ preventScroll: true }); });
d.subscribe(topic => { if (['session', 'users', 'all'].includes(topic)) render(); });
render();
