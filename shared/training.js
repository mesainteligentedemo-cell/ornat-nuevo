// ORNAT · módulo de CAPACITACIÓN (LMS interno). Modo demo: todo vive en localStorage ('ornat-training-v1').
// Contrato pensado para sustituir el almacenamiento por backend sin tocar las pantallas:
//   createTraining({ storage, getSession, listUsers, audit }) -> API (courses, assignments, progress, reports).
//   training() -> instancia compartida conectada a data() (sesión, usuarios y auditoría de shared/data.js).
// Las funciones puras (renderMarkdown, embedURL, gradeQuiz, courseProgress, certificateFolio, ...) se prueban en training.test.mjs.
import { esc, text, isObject, checkKeys, clampInt, rid, todayISO, diffDays, isISODate, hash53, memoryStorage } from './ui.js';
import { sampleCourses } from './training-samples.js';

export const KEY = 'ornat-training-v1';
const MAX_BYTES = 3 * 1024 * 1024;
export const AREAS = ['Ventas', 'Diseño', 'Producto ORNAT', 'Atención a clientes', 'Cumplimiento'];
export const LEVELS = { basico: 'Básico', intermedio: 'Intermedio', avanzado: 'Avanzado' };
export const LESSON_TYPES = { texto: 'Texto', video: 'Video', enlace: 'Enlace o archivo', evaluacion: 'Evaluación' };
export const ASSIGN_ROLES = { owner: 'Dueño', editor: 'Editor', sales: 'Vendedor' };

// ---------- URLs y markdown seguros ----------
export const isHttps = v => { try { const u = new URL(String(v)); return u.protocol === 'https:' && !/[\s"'<>\\]/.test(String(v)) && String(v).length <= 600; } catch { return false; } };

// Devuelve la URL de embed con privacidad, o '' si no es YouTube/Vimeo https válido.
export function embedURL(raw) {
  const v = String(raw ?? '').trim();
  if (!isHttps(v)) return '';
  const u = new URL(v); const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '');
  let id = '';
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v') || '';
    else { const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/); id = m ? m[1] : ''; }
  } else if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = u.pathname.match(/(?:^\/|\/video\/)(\d{5,12})(?:\/|$)/);
    return m ? `https://player.vimeo.com/video/${m[1]}?dnt=1` : '';
  }
  return /^[\w-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : '';
}

// Markdown básico → HTML. Todo se escapa primero: jamás se interpreta HTML crudo. Enlaces solo https.
export function renderMarkdown(src) {
  const lines = String(src ?? '').slice(0, 30000).replace(/\r/g, '').split('\n');
  const inline = raw => esc(raw)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  const out = []; let para = []; let list = null; let quote = [];
  const flush = () => {
    if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; }
    if (list) { out.push(`<${list.tag}>${list.items.map(i => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`); list = null; }
    if (quote.length) { out.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`); quote = []; }
  };
  for (const line of lines) {
    let m;
    if (!line.trim()) { flush(); continue; }
    if ((m = line.match(/^(#{1,3})\s+(.+)$/))) { flush(); const lvl = m[1].length + 2; out.push(`<h${lvl}>${inline(m[2])}</h${lvl}>`); continue; }
    if ((m = line.match(/^\s*[-*]\s+(.+)$/))) { if (list?.tag !== 'ul') { flush(); list = { tag: 'ul', items: [] }; } list.items.push(m[1]); continue; }
    if ((m = line.match(/^\s*\d+[.)]\s+(.+)$/))) { if (list?.tag !== 'ol') { flush(); list = { tag: 'ol', items: [] }; } list.items.push(m[1]); continue; }
    if ((m = line.match(/^>\s?(.*)$/))) { if (!quote.length) flush(); quote.push(m[1]); continue; }
    if (list || quote.length) flush();
    para.push(line.trim());
  }
  flush();
  return out.join('\n');
}

// ---------- validación ----------
const cleanLink = l => (isObject(l) && isHttps(l.url) ? { label: text(l.label, 80) || 'Enlace', url: String(l.url).trim() } : null);

export function cleanQuestion(q) {
  if (!isObject(q)) throw new Error('Pregunta no válida.');
  const type = q.type === 'vf' ? 'vf' : 'opcion';
  const stem = text(q.text, 500);
  let options;
  if (type === 'vf') options = [{ id: 'v', text: 'Verdadero' }, { id: 'f', text: 'Falso' }];
  else {
    options = (Array.isArray(q.options) ? q.options : []).slice(0, 6).map((o, i) => ({ id: text(o?.id, 20).replace(/[^\w-]/g, '') || `o${i + 1}`, text: text(o?.text, 200) })).filter(o => o.text);
    const seen = new Set(); options.forEach((o, i) => { if (seen.has(o.id)) o.id = `o${i + 1}x`; seen.add(o.id); });
  }
  const correct = options.some(o => o.id === q.correct) ? q.correct : (options[0]?.id || '');
  return { id: text(q.id, 40).replace(/[^\w-]/g, '') || rid().slice(0, 12), type, text: stem, options, correct, feedback: text(q.feedback, 500) };
}

export function cleanLesson(l) {
  if (!isObject(l)) throw new Error('Lección no válida.');
  const type = LESSON_TYPES[l.type] ? l.type : 'texto';
  const out = {
    id: text(l.id, 40).replace(/[^\w-]/g, '') || rid().slice(0, 12), type, title: text(l.title, 140) || 'Lección sin título',
    minutes: clampInt(l.minutes, { min: 0, max: 600, fallback: 5 }), body: text(l.body, 20000), url: '', links: [], quiz: null,
  };
  const url = String(l.url ?? '').trim();
  if (type === 'video') out.url = url && embedURL(url) ? url : '';
  else if (type === 'enlace') out.url = isHttps(url) ? url : '';
  out.links = (Array.isArray(l.links) ? l.links : []).map(cleanLink).filter(Boolean).slice(0, 10);
  if (type === 'evaluacion') {
    const quiz = isObject(l.quiz) ? l.quiz : {};
    out.quiz = {
      minScore: clampInt(quiz.minScore, { min: 50, max: 100, fallback: 80 }),
      maxAttempts: clampInt(quiz.maxAttempts, { min: 0, max: 10, fallback: 3 }),
      questions: (Array.isArray(quiz.questions) ? quiz.questions : []).slice(0, 30).map(cleanQuestion),
    };
  }
  return out;
}

export function cleanCourse(input) {
  checkKeys(input);
  if (!isObject(input)) throw new Error('Curso no válido.');
  const title = text(input.title, 140);
  if (!title) throw new Error('El curso necesita un título.');
  const now = new Date().toISOString();
  return {
    id: text(input.id, 60).replace(/[^\w-]/g, '') || rid(), title, summary: text(input.summary, 600),
    area: AREAS.includes(input.area) ? input.area : AREAS[0], level: LEVELS[input.level] ? input.level : 'basico',
    required: input.required === true, status: input.status === 'publicado' ? 'publicado' : 'borrador',
    source: input.source === 'demo' ? 'demo' : 'manual',
    modules: (Array.isArray(input.modules) ? input.modules : []).slice(0, 30).map(m => ({
      id: text(m?.id, 40).replace(/[^\w-]/g, '') || rid().slice(0, 12), title: text(m?.title, 140) || 'Módulo sin título',
      lessons: (Array.isArray(m?.lessons) ? m.lessons : []).slice(0, 50).map(cleanLesson),
    })),
    createdAt: isISOStamp(input.createdAt) || now, updatedAt: isISOStamp(input.updatedAt) || now,
  };
}
const isISOStamp = v => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : '');

// Problemas que impiden publicar un curso (lista vacía = listo).
export function publishProblems(course) {
  const problems = []; const lessons = lessonsOf(course);
  if (!lessons.length) problems.push('Agrega al menos una lección.');
  for (const m of course.modules) if (!m.lessons.length) problems.push(`El módulo «${m.title}» no tiene lecciones.`);
  for (const l of lessons) {
    if (l.type === 'evaluacion') {
      const qs = l.quiz?.questions || [];
      if (!qs.length) problems.push(`La evaluación «${l.title}» no tiene preguntas.`);
      qs.forEach((q, i) => { if (!q.text) problems.push(`«${l.title}», pregunta ${i + 1}: falta el enunciado.`); if (q.type === 'opcion' && q.options.length < 2) problems.push(`«${l.title}», pregunta ${i + 1}: necesita al menos 2 opciones.`); });
    }
    if (l.type === 'texto' && !l.body.trim()) problems.push(`La lección «${l.title}» no tiene contenido.`);
    if (l.type === 'enlace' && !l.url) problems.push(`La lección «${l.title}» necesita una URL https.`);
  }
  return problems;
}

export const lessonsOf = course => course.modules.flatMap(m => m.lessons);
export const courseMinutes = course => lessonsOf(course).reduce((s, l) => s + (l.minutes || 0), 0);

// ---------- evaluación y progreso (puro) ----------
export function gradeQuiz(quiz, answers = {}) {
  const qs = quiz?.questions || [];
  const results = qs.map(q => {
    const chosen = answers?.[q.id] ?? null; const correct = chosen !== null && chosen === q.correct;
    return { id: q.id, chosen, correct, correctId: q.correct, feedback: q.feedback };
  });
  const correctCount = results.filter(r => r.correct).length;
  const score = qs.length ? Math.round((correctCount / qs.length) * 100) : 0;
  return { score, correctCount, total: qs.length, passed: qs.length > 0 && score >= (quiz.minScore ?? 80), results };
}

export function lessonDone(lesson, rec) { const r = rec?.lessons?.[lesson.id]; return !!r && (lesson.type === 'evaluacion' ? r.passed === true : r.done === true); }

export function courseProgress(course, rec) {
  const lessons = lessonsOf(course); const done = lessons.filter(l => lessonDone(l, rec)).length;
  const next = lessons.find(l => !lessonDone(l, rec));
  const scores = lessons.filter(l => l.type === 'evaluacion' && rec?.lessons?.[l.id]?.score != null).map(l => rec.lessons[l.id].score);
  const seconds = Object.values(rec?.lessons || {}).reduce((s, r) => s + (r.seconds || 0), 0);
  return {
    total: lessons.length, done, pct: lessons.length ? Math.round((done / lessons.length) * 100) : 0,
    completed: lessons.length > 0 && done === lessons.length, nextLessonId: next?.id || null,
    avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null, seconds,
  };
}

// Folio de constancia: derivado de usuario + curso + fecha. Demo: el hash no es una firma; en producción lo emite y verifica el backend.
export function certificateFolio({ userId, courseId, title, completedAt }) {
  const base = [userId, courseId, title, String(completedAt).slice(0, 10)].join('|');
  const h = hash53(base).toString(36).toUpperCase().padStart(10, '0').slice(-10);
  const c = (hash53(base, 7) % 1296).toString(36).toUpperCase().padStart(2, '0');
  return `ORN-${h.slice(0, 5)}-${h.slice(5)}-${c}`;
}
export const verifyCertificate = cert => !!cert && cert.folio === certificateFolio(cert);

// Estado de una asignación para un usuario.
export function assignmentStatus({ due, completed, pct, today = todayISO() }) {
  if (completed) return 'completado';
  if (isISODate(due)) { const d = diffDays(today, due); if (d < 0) return 'vencido'; if (d <= 7) return 'por vencer'; }
  return pct > 0 ? 'en curso' : 'pendiente';
}
export const usersForTarget = (target, users) => users.filter(u => u.role !== 'client' && (target.type === 'role' ? u.role === target.value : u.id === target.value));

// ---------- almacén ----------
const emptyState = () => ({ version: 1, courses: [], assignments: [], progress: {} });
const progKey = (userId, courseId) => `${userId}|${courseId}`;

function cleanProgressRecord(r) {
  const lessons = {};
  for (const [lid, v] of Object.entries(isObject(r?.lessons) ? r.lessons : {}).slice(0, 2000)) {
    if (!/^[\w-]{1,40}$/.test(lid) || !isObject(v)) continue;
    lessons[lid] = { done: v.done === true, passed: v.passed === true, seconds: clampInt(v.seconds, { max: 86400 * 3 }), score: v.score == null ? null : clampInt(v.score, { max: 100 }), attempts: clampInt(v.attempts, { max: 1000 }), lastAt: isISOStamp(v.lastAt) };
  }
  const cert = isObject(r?.certificate) && typeof r.certificate.folio === 'string' ? { folio: text(r.certificate.folio, 40), issuedAt: isISOStamp(r.certificate.issuedAt), score: r.certificate.score == null ? null : clampInt(r.certificate.score, { max: 100 }) } : null;
  return { userId: text(r?.userId, 100), courseId: text(r?.courseId, 60), lessons, startedAt: isISOStamp(r?.startedAt), completedAt: isISOStamp(r?.completedAt), lastLessonId: text(r?.lastLessonId, 40), certificate: cert };
}

function validate(input) {
  checkKeys(input);
  if (!isObject(input)) throw new Error('Datos de capacitación dañados.');
  const progress = {};
  for (const [k, v] of Object.entries(isObject(input.progress) ? input.progress : {}).slice(0, 5000)) { const r = cleanProgressRecord(v); if (r.userId && r.courseId) progress[progKey(r.userId, r.courseId)] = r; }
  return {
    version: 1,
    courses: (input.courses || []).slice(0, 200).map(cleanCourse),
    assignments: (input.assignments || []).slice(0, 3000).map(cleanAssignment),
    progress,
  };
}
function cleanAssignment(a) {
  const target = isObject(a?.target) && ['user', 'role'].includes(a.target.type) ? { type: a.target.type, value: text(a.target.value, 100) } : null;
  if (!target || !target.value) throw new Error('Asignación no válida.');
  if (target.type === 'role' && !ASSIGN_ROLES[target.value]) throw new Error('Rol de asignación no válido.');
  return { id: text(a.id, 60) || rid(), courseId: text(a.courseId, 60), target, due: isISODate(a.due) ? a.due : '', assignedBy: text(a.assignedBy, 250), at: isISOStamp(a.at) || new Date().toISOString() };
}

export function createTraining({ storage = globalThis.localStorage || memoryStorage(), getSession = () => null, listUsers = () => [], audit = () => {}, now = () => new Date() } = {}) {
  const listeners = new Set();
  const emit = () => { for (const fn of listeners) { try { fn(); } catch {} } };
  globalThis.addEventListener?.('storage', e => { if (e.key === KEY) emit(); });
  const read = () => { const raw = storage.getItem(KEY); if (!raw) return emptyState(); try { return validate(JSON.parse(raw)); } catch (e) { throw new Error(`No se pudieron leer los datos de capacitación: ${e.message}`); } };
  const write = state => {
    const json = JSON.stringify(validate(state));
    if (new TextEncoder().encode(json).byteLength > MAX_BYTES) throw new Error('Los datos de capacitación superan 3 MB en este navegador.');
    try { storage.setItem(KEY, json); } catch { throw new Error('El navegador no permitió guardar (espacio lleno o bloqueado).'); }
  };
  const mutate = (fn, action, detail = '') => { const s = read(); const r = fn(s); write(s); if (action) audit(action, detail, 'capacitacion'); emit(); return r; };
  const me = () => { const s = getSession(); if (!s?.user) throw new Error('Inicia sesión para continuar.'); return s.user; };
  const canManage = (user = getSession()?.user) => !!user && ['owner', 'editor'].includes(user.role);
  const needManage = () => { const u = me(); if (!canManage(u)) throw new Error('Solo Dueño o Editor pueden hacer esto.'); return u; };
  const noClient = () => { const u = me(); if (u.role === 'client') throw new Error('Tu rol no tiene acceso a Capacitación.'); return u; };
  const stamp = () => now().toISOString();

  const courses = {
    list({ drafts = canManage() } = {}) { return read().courses.filter(c => drafts || c.status === 'publicado'); },
    get(id) { const c = read().courses.find(x => x.id === id) || null; return c && (c.status === 'publicado' || canManage()) ? c : null; },
    save(input) {
      needManage(); const prev = read().courses.find(c => c.id === input.id);
      const course = cleanCourse({ ...input, createdAt: prev?.createdAt, updatedAt: stamp() });
      if (course.status === 'publicado') { const p = publishProblems(course); if (p.length) throw new Error(`No se puede publicar: ${p[0]}`); }
      mutate(s => { const i = s.courses.findIndex(c => c.id === course.id); if (i >= 0) s.courses[i] = course; else s.courses.push(course); }, prev ? 'Editar curso' : 'Crear curso', course.title);
      return course;
    },
    setStatus(id, status) { const c = read().courses.find(x => x.id === id); if (!c) throw new Error('El curso no existe.'); return courses.save({ ...c, status: status === 'publicado' ? 'publicado' : 'borrador' }); },
    duplicate(id) {
      needManage(); const c = read().courses.find(x => x.id === id); if (!c) throw new Error('El curso no existe.');
      const copy = JSON.parse(JSON.stringify(c)); copy.id = rid(); copy.title = `${c.title} (copia)`.slice(0, 140); copy.status = 'borrador'; copy.source = 'manual';
      for (const m of copy.modules) { m.id = rid().slice(0, 12); for (const l of m.lessons) { l.id = rid().slice(0, 12); for (const q of l.quiz?.questions || []) q.id = rid().slice(0, 12); } }
      return courses.save(copy);
    },
    remove(id) { needManage(); mutate(s => { s.courses = s.courses.filter(c => c.id !== id); s.assignments = s.assignments.filter(a => a.courseId !== id); for (const k of Object.keys(s.progress)) if (s.progress[k].courseId === id) delete s.progress[k]; }, 'Eliminar curso', id); },
    seedDemo() {
      needManage(); const items = sampleCourses().map(c => cleanCourse({ ...c, source: 'demo', status: 'publicado' }));
      mutate(s => { s.courses = s.courses.filter(c => c.source !== 'demo').concat(items); }, 'Cargar cursos de ejemplo', `${items.length} cursos`);
      return items.length;
    },
    clearDemo() { needManage(); mutate(s => { const ids = new Set(s.courses.filter(c => c.source === 'demo').map(c => c.id)); s.courses = s.courses.filter(c => c.source !== 'demo'); s.assignments = s.assignments.filter(a => !ids.has(a.courseId)); for (const k of Object.keys(s.progress)) if (ids.has(s.progress[k].courseId)) delete s.progress[k]; }, 'Quitar cursos de ejemplo'); },
  };

  const assignments = {
    list() { return read().assignments; },
    assign({ courseId, target, due }) {
      const u = needManage(); const c = read().courses.find(x => x.id === courseId);
      if (!c) throw new Error('El curso no existe.'); if (c.status !== 'publicado') throw new Error('Publica el curso antes de asignarlo.');
      const a = cleanAssignment({ courseId, target, due, assignedBy: u.email });
      if (due && !isISODate(due)) throw new Error('La fecha límite no es válida.');
      if (a.target.type === 'user' && !listUsers().some(x => x.id === a.target.value)) throw new Error('La persona no existe.');
      mutate(s => { const i = s.assignments.findIndex(x => x.courseId === courseId && x.target.type === a.target.type && x.target.value === a.target.value); if (i >= 0) s.assignments[i] = { ...a, id: s.assignments[i].id }; else s.assignments.push(a); }, 'Asignar curso', `${c.title} → ${a.target.type === 'role' ? ASSIGN_ROLES[a.target.value] : a.target.value}${a.due ? ` · límite ${a.due}` : ''}`);
      return a;
    },
    remove(id) { needManage(); mutate(s => { s.assignments = s.assignments.filter(a => a.id !== id); }, 'Quitar asignación', id); },
  };

  const recFor = (state, userId, courseId) => state.progress[progKey(userId, courseId)] || null;
  const touch = (state, user, courseId) => { const k = progKey(user.id, courseId); return (state.progress[k] ||= { userId: user.id, courseId, lessons: {}, startedAt: stamp(), completedAt: '', lastLessonId: '', certificate: null }); };
  const finish = (state, user, course, rec) => {
    const p = courseProgress(course, rec);
    if (p.completed && !rec.certificate) {
      rec.completedAt = stamp();
      rec.certificate = { folio: certificateFolio({ userId: user.id, courseId: course.id, title: course.title, completedAt: rec.completedAt }), issuedAt: rec.completedAt, score: p.avgScore };
      return true;
    }
    return false;
  };
  const lessonCtx = (state, courseId, lessonId) => {
    const user = noClient(); const course = state.courses.find(c => c.id === courseId && (c.status === 'publicado' || canManage(user)));
    const lesson = course && lessonsOf(course).find(l => l.id === lessonId);
    if (!lesson) throw new Error('La lección no existe.');
    return { user, course, lesson };
  };

  const progress = {
    get(courseId, userId = me().id) { const u = me(); if (userId !== u.id && !canManage(u)) throw new Error('Sin permiso.'); return recFor(read(), userId, courseId); },
    all() { needManage(); return Object.values(read().progress); },
    open(courseId, lessonId) { mutate(s => { const { user } = lessonCtx(s, courseId, lessonId); touch(s, user, courseId).lastLessonId = lessonId; }); },
    addTime(courseId, lessonId, seconds) { const add = clampInt(seconds, { min: 0, max: 600 }); if (!add) return; mutate(s => { const { user } = lessonCtx(s, courseId, lessonId); const r = touch(s, user, courseId); const l = (r.lessons[lessonId] ||= { done: false, passed: false, seconds: 0, score: null, attempts: 0, lastAt: '' }); l.seconds += add; l.lastAt = stamp(); }); },
    complete(courseId, lessonId) {
      let issued = null;
      mutate(s => {
        const { user, course, lesson } = lessonCtx(s, courseId, lessonId);
        if (lesson.type === 'evaluacion') throw new Error('La evaluación se completa aprobándola.');
        const r = touch(s, user, courseId); const l = (r.lessons[lessonId] ||= { done: false, passed: false, seconds: 0, score: null, attempts: 0, lastAt: '' });
        l.done = true; l.lastAt = stamp(); r.lastLessonId = lessonId;
        if (finish(s, user, course, r)) issued = r.certificate;
      }, null);
      if (issued) audit('Curso completado', `${courseId} · folio ${issued.folio}`, 'capacitacion');
      return issued;
    },
    submitQuiz(courseId, lessonId, answers) {
      let result; let issued = null; let title = '';
      mutate(s => {
        const { user, course, lesson } = lessonCtx(s, courseId, lessonId); title = course.title;
        if (lesson.type !== 'evaluacion') throw new Error('Esta lección no es una evaluación.');
        const r = touch(s, user, courseId); const l = (r.lessons[lessonId] ||= { done: false, passed: false, seconds: 0, score: null, attempts: 0, lastAt: '' });
        const max = lesson.quiz.maxAttempts;
        if (l.passed) throw new Error('Ya aprobaste esta evaluación.');
        if (max && l.attempts >= max) throw new Error('Agotaste tus intentos. Pide a Dirección que los reinicie.');
        const clean = {}; for (const q of lesson.quiz.questions) if (typeof answers?.[q.id] === 'string') clean[q.id] = answers[q.id].slice(0, 20);
        result = gradeQuiz(lesson.quiz, clean);
        l.attempts += 1; l.score = Math.max(l.score ?? 0, result.score); l.lastAt = stamp();
        if (result.passed) { l.passed = true; l.done = true; }
        r.lastLessonId = lessonId;
        result.attempts = l.attempts; result.attemptsLeft = max ? Math.max(0, max - l.attempts) : null;
        if (finish(s, user, course, r)) issued = r.certificate;
      }, null);
      audit(result.passed ? 'Evaluación aprobada' : 'Evaluación no aprobada', `${title} · ${result.score}%`, 'capacitacion');
      if (issued) audit('Curso completado', `${courseId} · folio ${issued.folio}`, 'capacitacion');
      result.certificate = issued; return result;
    },
    resetAttempts(userId, courseId, lessonId) { needManage(); mutate(s => { const r = recFor(s, userId, courseId); if (r?.lessons[lessonId]) { r.lessons[lessonId].attempts = 0; } }, 'Reiniciar intentos de evaluación', `${userId} · ${courseId}`); },
    reset(courseId) { mutate(s => { delete s.progress[progKey(me().id, courseId)]; }, 'Reiniciar mi avance', courseId); },
  };

  // Cursos de una persona: asignados (con fecha límite) + los que empezó por su cuenta.
  function myCourses(user = me()) {
    const s = read(); const today = todayISO(now()); const out = new Map();
    for (const c of s.courses.filter(x => x.status === 'publicado')) {
      const rec = recFor(s, user.id, c.id); const mine = s.assignments.filter(a => a.courseId === c.id && usersForTarget(a.target, [user]).length);
      if (!mine.length && !rec) continue;
      const due = mine.map(a => a.due).filter(Boolean).sort()[0] || '';
      const p = courseProgress(c, rec);
      out.set(c.id, { course: c, assigned: mine.length > 0, due, progress: p, certificate: rec?.certificate || null, status: assignmentStatus({ due, completed: p.completed, pct: p.pct, today }), lastLessonId: rec?.lastLessonId || '' });
    }
    return [...out.values()];
  }

  // Estado de un curso para cada persona a la que se asignó (panel de equipo). Solo Dueño/Editor.
  function teamReport() {
    needManage(); const s = read(); const users = listUsers().filter(u => u.role !== 'client'); const today = todayISO(now()); const rows = [];
    for (const c of s.courses.filter(x => x.status === 'publicado')) {
      const who = new Map();
      for (const a of s.assignments.filter(x => x.courseId === c.id)) for (const u of usersForTarget(a.target, users)) { const prev = who.get(u.id); if (!prev || (a.due && (!prev || !prev.due || a.due < prev.due))) who.set(u.id, { user: u, due: a.due }); }
      for (const [k, rec] of Object.entries(s.progress)) if (rec.courseId === c.id && !who.has(rec.userId)) { const u = users.find(x => x.id === rec.userId); if (u) who.set(u.id, { user: u, due: '', voluntary: true }); }
      for (const { user, due, voluntary } of who.values()) {
        const rec = recFor(s, user.id, c.id); const p = courseProgress(c, rec);
        rows.push({ user, course: c, due, voluntary: !!voluntary, progress: p, certificate: rec?.certificate || null, status: assignmentStatus({ due, completed: p.completed, pct: p.pct, today }) });
      }
    }
    return rows;
  }

  function certificate(courseId, userId = me().id) {
    const viewer = me(); if (userId !== viewer.id && !canManage(viewer)) throw new Error('Sin permiso.');
    const s = read(); const rec = recFor(s, userId, courseId); const course = s.courses.find(c => c.id === courseId); const user = listUsers().find(u => u.id === userId);
    if (!rec?.certificate || !course) return null;
    const cert = { folio: rec.certificate.folio, userId, courseId, title: course.title, completedAt: rec.completedAt, name: user?.name || userId, score: rec.certificate.score, minutes: courseMinutes(course), area: course.area };
    return { ...cert, valid: verifyCertificate(cert) };
  }
  // Busca un folio entre las constancias emitidas en este navegador (demo).
  function verifyFolio(folio) {
    noClient(); const f = String(folio || '').trim().toUpperCase(); if (!f) return null; const s = read();
    for (const rec of Object.values(s.progress)) if (rec.certificate?.folio === f) { const c = s.courses.find(x => x.id === rec.courseId); const u = listUsers().find(x => x.id === rec.userId); if (!c) return null; const cert = { folio: f, userId: rec.userId, courseId: rec.courseId, title: c.title, completedAt: rec.completedAt, name: u?.name || '(persona eliminada)' }; return { ...cert, valid: verifyCertificate(cert) }; }
    return null;
  }

  return { courses, assignments, progress, myCourses, teamReport, certificate, verifyFolio, canManage, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }, exportAll: () => JSON.stringify(read()) };
}

let shared;
export async function trainingShared() { return (shared ||= await makeShared()); }
async function makeShared() {
  const { data } = await import('./data.js'); const d = data();
  return createTraining({ getSession: () => d.getSession(), listUsers: () => d.users.list(), audit: (a, det, area) => { try { d.audit.log(a, det, area); } catch {} } });
}
