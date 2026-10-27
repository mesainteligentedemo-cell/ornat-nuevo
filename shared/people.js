// ORNAT · módulo de RECURSOS HUMANOS. Modo demo: localStorage ('ornat-people-v1'); archivos de expediente en IndexedDB (people-files.js).
// AVISO: datos personales sensibles (salario, CURP, RFC, NSS, cuenta) en el navegador son solo para demostración.
// En producción deben vivir únicamente en un backend cifrado con control de acceso; esta capa ya los oculta a quien no sea Dueño.
import { text, isObject, checkKeys, clampInt, rid, isISODate, addDays, diffDays, todayISO, toUTC, fmtISO, memoryStorage } from './ui.js';

export const KEY = 'ornat-people-v1';
const MAX_BYTES = 3 * 1024 * 1024;
export const AREAS = ['Dirección', 'Ventas', 'Diseño', 'Desarrollo', 'Operaciones', 'Administración'];
export const CONTRACTS = { indeterminado: 'Indeterminado', determinado: 'Tiempo determinado', obra: 'Obra determinada', honorarios: 'Honorarios', practicas: 'Prácticas profesionales' };
export const DOC_TYPES = { ine: 'INE', curp: 'CURP', rfc: 'RFC / Constancia de situación fiscal', nss: 'NSS (IMSS)', domicilio: 'Comprobante de domicilio', contrato: 'Contrato firmado', privacidad: 'Aviso de privacidad firmado', banco: 'Cuenta bancaria (carátula)' };
export const REQUEST_TYPES = { vacaciones: 'Vacaciones', permiso_con_goce: 'Permiso con goce', permiso_sin_goce: 'Permiso sin goce', incapacidad: 'Incapacidad', home_office: 'Home office' };
export const REQUEST_STATUS = { pendiente: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada', cancelada: 'Cancelada' };
export const WORKWEEKS = { 'L-V': [1, 2, 3, 4, 5], 'L-S': [1, 2, 3, 4, 5, 6] };
export const SENSITIVE_FIELDS = ['salary', 'curp', 'rfc', 'nss', 'bank'];
const MAX_REQUEST_DAYS = 90;

// ---------- vacaciones LFT (reforma «vacaciones dignas», vigente desde 2023) ----------
// 1.º: 12 · 2.º: 14 · 3.º: 16 · 4.º: 18 · 5.º: 20 · 6–10: 22 · y +2 cada 5 años (11–15: 24, 16–20: 26, 21–25: 28, 26–30: 30, 31–35: 32, ...).
export function vacationDaysForYear(year) {
  const y = Math.floor(Number(year));
  if (!Number.isFinite(y) || y < 1) return 0;
  if (y <= 5) return 10 + 2 * y;
  return 22 + 2 * Math.floor((y - 6) / 5);
}
export const PRIMA_VACACIONAL = 0.25; // mínimo legal

// Años completos de servicio a la fecha `asOf` (el derecho nace al cumplir cada año).
export function completedYears(hireDate, asOf) {
  if (!isISODate(hireDate) || !isISODate(asOf) || asOf < hireDate) return 0;
  let years = Number(asOf.slice(0, 4)) - Number(hireDate.slice(0, 4));
  if (asOf.slice(5) < hireDate.slice(5)) years -= 1;
  return Math.max(0, years);
}
export function nextAnniversary(hireDate, asOf) {
  const n = completedYears(hireDate, asOf) + 1; const y = Number(hireDate.slice(0, 4)) + n;
  const md = hireDate.slice(5) === '02-29' && !(y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? '02-28' : hireDate.slice(5);
  return `${y}-${md}`;
}
// Saldo = días devengados por años cumplidos − días de vacaciones aprobados/tomados. `taken` en días hábiles.
export function vacationBalance({ hireDate, asOf = todayISO(), taken = 0 }) {
  const years = completedYears(hireDate, asOf); let accrued = 0;
  for (let y = 1; y <= years; y++) accrued += vacationDaysForYear(y);
  const next = isISODate(hireDate) ? nextAnniversary(hireDate, asOf) : '';
  const entitlement = vacationDaysForYear(years);
  return { years, accrued, taken, balance: accrued - taken, currentEntitlement: entitlement, primaDays: entitlement * PRIMA_VACACIONAL, nextAnniversary: next, nextEntitlement: vacationDaysForYear(years + 1) };
}

// ---------- calendario laboral México ----------
const nthWeekday = (year, month, weekday, n) => { // month 1-12, weekday 0=dom
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); const day = 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
  return fmtISO(new Date(Date.UTC(year, month - 1, day)));
};
// Descansos obligatorios, art. 74 LFT: 1 ene; 1.er lunes de feb; 3.er lunes de mar; 1 may; 16 sep; 3.er lunes de nov;
// 1 oct cada 6 años (transmisión del Poder Ejecutivo Federal: 2024, 2030, ...); 25 dic.
export function holidaysMX(year) {
  const y = Math.floor(Number(year)); const p = n => String(n).padStart(2, '0');
  const list = [[`${y}-01-01`, 'Año Nuevo'], [nthWeekday(y, 2, 1, 1), 'Día de la Constitución'], [nthWeekday(y, 3, 1, 3), 'Natalicio de Benito Juárez'], [`${y}-05-01`, 'Día del Trabajo'], [`${y}-09-16`, 'Independencia de México'], [nthWeekday(y, 11, 1, 3), 'Revolución Mexicana']];
  if (y >= 2024 && (y - 2024) % 6 === 0) list.push([`${y}-10-01`, 'Transmisión del Poder Ejecutivo Federal']);
  list.push([`${y}-12-25`, 'Navidad']);
  return list.sort((a, b) => a[0].localeCompare(b[0])).map(([date, name]) => ({ date, name }));
}
// Días hábiles entre dos fechas (inclusive), con semana laboral y festivos configurables.
export function businessDays(from, to, { workweek = 'L-V', holidays = [] } = {}) {
  if (!isISODate(from) || !isISODate(to) || to < from) return 0;
  const days = WORKWEEKS[workweek] || WORKWEEKS['L-V']; const hol = new Set(holidays); let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) { if (days.includes(toUTC(d).getUTCDay()) && !hol.has(d)) n += 1; }
  return n;
}

// ---------- documentos ----------
export function docState(doc, today = todayISO()) {
  if (!doc || doc.status !== 'entregado') return 'pendiente';
  if (isISODate(doc.expires)) { const d = diffDays(today, doc.expires); if (d < 0) return 'vencido'; if (d <= 30) return 'por vencer'; }
  return 'entregado';
}

// ---------- visibilidad de datos sensibles ----------
// Solo el Dueño ve salario, CURP, RFC, NSS y cuenta. Para los demás (incluida la propia persona) se omiten del todo.
export function redactEmployee(emp, viewer) {
  if (viewer?.role === 'owner') return { ...emp, sensitiveHidden: false };
  const { sensitive, ...rest } = emp; return { ...rest, sensitive: Object.fromEntries(SENSITIVE_FIELDS.map(k => [k, ''])), sensitiveHidden: true };
}
export const maskValue = v => (v ? '••••••••' : '—');

// ---------- evaluaciones ----------
export const RATING_BANDS = [[1, 'Por debajo de lo esperado'], [2, 'En desarrollo'], [3, 'Cumple'], [4, 'Supera lo esperado'], [4.5, 'Sobresaliente']];
export function bandFor(score) { if (score == null) return ''; return score < 2 ? RATING_BANDS[0][1] : score < 3 ? RATING_BANDS[1][1] : score < 4 ? RATING_BANDS[2][1] : score < 4.5 ? RATING_BANDS[3][1] : RATING_BANDS[4][1]; }
// Promedio ponderado por objetivo (1–5). Devuelve null si no hay calificaciones válidas.
export function weightedScore(objectives, ratings) {
  let sum = 0, w = 0;
  for (const o of objectives || []) { const r = Number(ratings?.[o.id]); if (r >= 1 && r <= 5) { const weight = o.weight > 0 ? o.weight : 1; sum += r * weight; w += weight; } }
  return w ? Math.round((sum / w) * 100) / 100 : null;
}
export function reviewResult(review) {
  const self = weightedScore(review.objectives, review.self?.ratings); const manager = weightedScore(review.objectives, review.manager?.ratings);
  return { self, manager, final: manager, band: bandFor(manager), gap: self != null && manager != null ? Math.round((self - manager) * 100) / 100 : null, complete: !!(review.self?.at && review.manager?.at) };
}

// ---------- validación ----------
const stamp = v => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : '');
const dateOr = (v, fb = '') => (isISODate(v) ? v : fb);
const cleanChecklist = list => (Array.isArray(list) ? list : []).slice(0, 60).map(i => ({ id: text(i?.id, 40).replace(/[^\w-]/g, '') || rid().slice(0, 12), label: text(i?.label, 160), group: ['accesos', 'equipo', 'cursos', 'documentos', 'otros'].includes(i?.group) ? i.group : 'otros', courseId: text(i?.courseId, 60), done: i?.done === true, doneAt: stamp(i?.doneAt) })).filter(i => i.label);

export function cleanEmployee(input) {
  checkKeys(input); if (!isObject(input)) throw new Error('Colaborador no válido.');
  const name = text(input.name, 120); if (!name) throw new Error('El colaborador necesita un nombre.');
  const email = text(input.email, 250).toLowerCase(); if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Escribe un correo laboral válido.');
  const phone = text(input.phone, 30); if (phone && !/^[\d\s()+\-.ext]{6,30}$/i.test(phone)) throw new Error('El teléfono no es válido.');
  if (input.hireDate && !isISODate(input.hireDate)) throw new Error('La fecha de ingreso no es válida.');
  const s = isObject(input.sensitive) ? input.sensitive : {};
  const salary = s.salary === '' || s.salary == null ? '' : Number(s.salary);
  if (salary !== '' && (!Number.isFinite(salary) || salary < 0 || salary > 1e7)) throw new Error('El salario no es válido.');
  const curp = text(s.curp, 18).toUpperCase(); if (curp && !/^[A-Z0-9]{18}$/.test(curp)) throw new Error('La CURP debe tener 18 caracteres.');
  const rfc = text(s.rfc, 13).toUpperCase(); if (rfc && !/^[A-ZÑ&0-9]{12,13}$/.test(rfc)) throw new Error('El RFC debe tener 12 o 13 caracteres.');
  const nss = text(s.nss, 11); if (nss && !/^\d{11}$/.test(nss)) throw new Error('El NSS debe tener 11 dígitos.');
  const bank = text(s.bank, 22).replace(/\s/g, ''); if (bank && !/^\d{10,18}$/.test(bank)) throw new Error('La cuenta debe tener entre 10 y 18 dígitos.');
  const docs = {}; for (const k of Object.keys(DOC_TYPES)) { const d = isObject(input.docs?.[k]) ? input.docs[k] : {}; docs[k] = { status: d.status === 'entregado' ? 'entregado' : 'pendiente', expires: dateOr(d.expires), fileName: text(d.fileName, 120), updatedAt: stamp(d.updatedAt) }; }
  const status = input.status === 'baja' ? 'baja' : 'activo';
  return {
    id: text(input.id, 60).replace(/[^\w-]/g, '') || rid(), userId: text(input.userId, 100), name, email, phone,
    position: text(input.position, 100), area: AREAS.includes(input.area) ? input.area : 'Operaciones', managerId: text(input.managerId, 60),
    hireDate: dateOr(input.hireDate), endDate: status === 'baja' ? dateOr(input.endDate) : '', birthDate: dateOr(input.birthDate),
    contract: CONTRACTS[input.contract] ? input.contract : 'indeterminado', location: text(input.location, 100), status,
    sensitive: { salary, curp, rfc, nss, bank }, docs,
    onboarding: cleanChecklist(input.onboarding), offboarding: cleanChecklist(input.offboarding),
    source: input.source === 'demo' ? 'demo' : 'manual', createdAt: stamp(input.createdAt) || new Date().toISOString(),
  };
}
export function cleanRequest(input) {
  checkKeys(input); if (!isObject(input)) throw new Error('Solicitud no válida.');
  if (!REQUEST_TYPES[input.type]) throw new Error('Tipo de solicitud no válido.');
  if (!isISODate(input.from) || !isISODate(input.to)) throw new Error('Escribe fechas válidas.');
  if (input.to < input.from) throw new Error('La fecha final no puede ser anterior a la inicial.');
  if (diffDays(input.from, input.to) + 1 > MAX_REQUEST_DAYS) throw new Error(`Una solicitud no puede pasar de ${MAX_REQUEST_DAYS} días naturales.`);
  return {
    id: text(input.id, 60).replace(/[^\w-]/g, '') || rid(), employeeId: text(input.employeeId, 60), type: input.type, from: input.from, to: input.to,
    days: clampInt(input.days, { max: MAX_REQUEST_DAYS }), comment: text(input.comment, 500), status: REQUEST_STATUS[input.status] ? input.status : 'pendiente',
    decidedBy: text(input.decidedBy, 250), decidedAt: stamp(input.decidedAt), decisionComment: text(input.decisionComment, 500), createdAt: stamp(input.createdAt) || new Date().toISOString(),
  };
}
const cleanObjectives = list => (Array.isArray(list) ? list : []).slice(0, 12).map(o => ({ id: text(o?.id, 40).replace(/[^\w-]/g, '') || rid().slice(0, 12), text: text(o?.text, 200), weight: clampInt(o?.weight, { min: 1, max: 100, fallback: 1 }) })).filter(o => o.text);
const cleanRatings = r => { const out = {}; for (const [k, v] of Object.entries(isObject(r) ? r : {}).slice(0, 12)) { if (/^[\w-]{1,40}$/.test(k) && Number(v) >= 1 && Number(v) <= 5) out[k] = Math.round(Number(v)); } return out; };
const cleanPart = p => (isObject(p) && p.at ? { ratings: cleanRatings(p.ratings), comment: text(p.comment, 1500), at: stamp(p.at), by: text(p.by, 250) } : null);
export function cleanReview(input) {
  checkKeys(input); if (!isObject(input)) throw new Error('Evaluación no válida.');
  return { id: text(input.id, 60).replace(/[^\w-]/g, '') || rid(), cycleId: text(input.cycleId, 60), employeeId: text(input.employeeId, 60), objectives: cleanObjectives(input.objectives), self: cleanPart(input.self), manager: cleanPart(input.manager) };
}
const cleanCycle = c => { if (!text(c?.name, 100)) throw new Error('El ciclo necesita un nombre.'); return { id: text(c.id, 60).replace(/[^\w-]/g, '') || rid(), name: text(c.name, 100), from: dateOr(c.from), to: dateOr(c.to), status: c.status === 'cerrado' ? 'cerrado' : 'abierto' }; };

export const DEFAULT_ONBOARDING = [
  { label: 'Correo y acceso a la plataforma ORNAT (Cuenta)', group: 'accesos' }, { label: 'Acceso al Editor y/o CRM según su rol', group: 'accesos' }, { label: 'Grupo de WhatsApp del equipo', group: 'accesos' },
  { label: 'Equipo de cómputo entregado y registrado', group: 'equipo' }, { label: 'Curso «Inducción ORNAT» asignado', group: 'cursos', courseId: 'demo-induccion-ornat' },
  { label: 'Contrato firmado', group: 'documentos' }, { label: 'Aviso de privacidad firmado', group: 'documentos' }, { label: 'Documentos del expediente completos', group: 'documentos' },
];
export const DEFAULT_OFFBOARDING = [
  { label: 'Retirar accesos (plataforma, correo, WhatsApp)', group: 'accesos' }, { label: 'Recuperar equipo de cómputo', group: 'equipo' }, { label: 'Traspaso de prospectos y pendientes', group: 'otros' },
  { label: 'Cálculo de finiquito / liquidación revisado por Dirección', group: 'documentos' }, { label: 'Carta de terminación o renuncia firmada', group: 'documentos' },
];

const emptyState = () => ({ version: 1, employees: [], requests: [], cycles: [], reviews: [], settings: { workweek: 'L-V', holidays: {} }, templates: { onboarding: DEFAULT_ONBOARDING.map(cleanTpl), offboarding: DEFAULT_OFFBOARDING.map(cleanTpl) } });
function cleanTpl(i) { return { id: text(i?.id, 40).replace(/[^\w-]/g, '') || rid().slice(0, 12), label: text(i?.label, 160), group: ['accesos', 'equipo', 'cursos', 'documentos', 'otros'].includes(i?.group) ? i.group : 'otros', courseId: text(i?.courseId, 60) }; }
function cleanSettings(s) {
  const holidays = {};
  for (const [y, list] of Object.entries(isObject(s?.holidays) ? s.holidays : {}).slice(0, 20)) if (/^\d{4}$/.test(y)) holidays[y] = [...new Set((Array.isArray(list) ? list : []).filter(d => isISODate(d) && d.startsWith(y)))].sort().slice(0, 40);
  return { workweek: WORKWEEKS[s?.workweek] ? s.workweek : 'L-V', holidays };
}
function validate(input) {
  checkKeys(input); if (!isObject(input)) throw new Error('Datos de RRHH dañados.');
  const base = emptyState();
  return {
    version: 1, employees: (input.employees || []).slice(0, 500).map(cleanEmployee), requests: (input.requests || []).slice(0, 5000).map(cleanRequest),
    cycles: (input.cycles || []).slice(0, 50).map(cleanCycle), reviews: (input.reviews || []).slice(0, 5000).map(cleanReview), settings: cleanSettings(input.settings),
    templates: { onboarding: (input.templates?.onboarding || base.templates.onboarding).slice(0, 40).map(cleanTpl).filter(i => i.label), offboarding: (input.templates?.offboarding || base.templates.offboarding).slice(0, 40).map(cleanTpl).filter(i => i.label) },
  };
}

export function holidaysFor(settings, year) { const custom = settings.holidays?.[String(year)]; return custom ? custom : holidaysMX(year).map(h => h.date); }

export function createPeople({ storage = globalThis.localStorage || memoryStorage(), getSession = () => null, listUsers = () => [], audit = () => {}, now = () => new Date() } = {}) {
  const listeners = new Set(); const emit = () => { for (const fn of listeners) { try { fn(); } catch {} } };
  globalThis.addEventListener?.('storage', e => { if (e.key === KEY) emit(); });
  const read = () => { const raw = storage.getItem(KEY); if (!raw) return emptyState(); try { return validate(JSON.parse(raw)); } catch (e) { throw new Error(`No se pudieron leer los datos de RRHH: ${e.message}`); } };
  const write = s => { const json = JSON.stringify(validate(s)); if (new TextEncoder().encode(json).byteLength > MAX_BYTES) throw new Error('Los datos de RRHH superan 3 MB en este navegador.'); try { storage.setItem(KEY, json); } catch { throw new Error('El navegador no permitió guardar.'); } };
  const mutate = (fn, action, detail = '') => { const s = read(); const r = fn(s); write(s); if (action) audit(action, detail, 'rrhh'); emit(); return r; };
  const me = () => { const u = getSession()?.user; if (!u) throw new Error('Inicia sesión para continuar.'); if (u.role === 'client') throw new Error('Tu rol no tiene acceso a RRHH.'); return u; };
  const isOwner = () => me().role === 'owner';
  const needOwner = () => { if (!isOwner()) throw new Error('Solo el Dueño puede hacer esto.'); return me(); };
  const todayStr = () => todayISO(now());
  const empOf = (s, user) => s.employees.find(e => (e.userId && e.userId === user.id) || (e.email && e.email === user.email)) || null;
  const reportsOf = (s, empId) => s.employees.filter(e => e.managerId === empId).map(e => e.id);
  const canSeeEmployeeRequests = (s, user, employeeId) => user.role === 'owner' || empOf(s, user)?.id === employeeId || reportsOf(s, empOf(s, user)?.id).includes(employeeId);
  const view = (s, e) => redactEmployee(e, me());

  const employees = {
    list(filters = {}) {
      const s = read(); const u = me(); const q = (filters.q || '').toLowerCase(); const t = todayStr();
      return s.employees.filter(e => (!filters.area || e.area === filters.area) && (!filters.position || e.position === filters.position) && (!filters.status || e.status === filters.status) && (!filters.contract || e.contract === filters.contract)
        && (!q || `${e.name} ${e.position} ${e.email} ${e.location}`.toLowerCase().includes(q))
        && (!filters.tenure || (() => { const y = completedYears(e.hireDate, t); return filters.tenure === '<1' ? y < 1 : filters.tenure === '1-3' ? y >= 1 && y < 3 : filters.tenure === '3-5' ? y >= 3 && y < 5 : y >= 5; })()))
        .map(e => redactEmployee(e, u));
    },
    get(id) { const s = read(); const e = s.employees.find(x => x.id === id); return e ? view(s, e) : null; },
    mine() { const s = read(); const e = empOf(s, me()); return e ? view(s, e) : null; },
    save(input) {
      needOwner(); const prev = read().employees.find(e => e.id === input.id);
      const emp = cleanEmployee({ ...input, onboarding: input.onboarding ?? prev?.onboarding, offboarding: input.offboarding ?? prev?.offboarding, docs: input.docs ?? prev?.docs, createdAt: prev?.createdAt });
      if (emp.managerId === emp.id) throw new Error('Una persona no puede ser su propio jefe directo.');
      mutate(s => {
        // evita ciclos en el organigrama
        let cur = emp.managerId; const seen = new Set([emp.id]);
        while (cur) { if (seen.has(cur)) throw new Error('El jefe directo crearía un ciclo en el organigrama.'); seen.add(cur); cur = s.employees.find(e => e.id === cur)?.managerId; }
        const i = s.employees.findIndex(e => e.id === emp.id); if (i >= 0) s.employees[i] = emp; else s.employees.push(emp);
      }, prev ? 'Editar colaborador' : 'Alta de colaborador', emp.name);
      return emp;
    },
    startOnboarding(id) { needOwner(); return mutate(s => { const e = s.employees.find(x => x.id === id); if (!e) throw new Error('El colaborador no existe.'); e.onboarding = s.templates.onboarding.map(t => ({ ...t, id: rid().slice(0, 12), done: false, doneAt: '' })); return e.onboarding; }, 'Iniciar onboarding', id); },
    startOffboarding(id, endDate) { needOwner(); return mutate(s => { const e = s.employees.find(x => x.id === id); if (!e) throw new Error('El colaborador no existe.'); e.offboarding = s.templates.offboarding.map(t => ({ ...t, id: rid().slice(0, 12), done: false, doneAt: '' })); e.status = 'baja'; e.endDate = dateOr(endDate, todayStr()); return e.offboarding; }, 'Baja de colaborador', id); },
    toggleChecklist(id, kind, itemId, done) {
      const u = me(); if (!['onboarding', 'offboarding'].includes(kind)) throw new Error('Lista no válida.');
      return mutate(s => { const e = s.employees.find(x => x.id === id); if (!e) throw new Error('El colaborador no existe.'); if (u.role !== 'owner') throw new Error('Solo el Dueño marca los pasos de ingreso y baja.'); const it = e[kind].find(x => x.id === itemId); if (!it) throw new Error('El paso no existe.'); it.done = !!done; it.doneAt = done ? now().toISOString() : ''; }, `Checklist de ${kind}`, `${id} · ${itemId}`);
    },
    setDoc(id, key, patch) {
      const u = me(); if (!DOC_TYPES[key]) throw new Error('Documento no válido.');
      return mutate(s => { const e = s.employees.find(x => x.id === id); if (!e) throw new Error('El colaborador no existe.'); const self = empOf(s, u)?.id === id; if (u.role !== 'owner' && !(self && 'fileName' in patch && Object.keys(patch).length === 1)) throw new Error('Solo el Dueño actualiza el estado de los documentos.'); const d = e.docs[key]; if (patch.status) d.status = patch.status === 'entregado' ? 'entregado' : 'pendiente'; if ('expires' in patch) d.expires = dateOr(patch.expires); if ('fileName' in patch) d.fileName = text(patch.fileName, 120); d.updatedAt = now().toISOString(); }, 'Documento de expediente', `${id} · ${key}`);
    },
    remove(id) { needOwner(); mutate(s => { s.employees = s.employees.filter(e => e.id !== id); for (const e of s.employees) if (e.managerId === id) e.managerId = ''; s.requests = s.requests.filter(r => r.employeeId !== id); s.reviews = s.reviews.filter(r => r.employeeId !== id); }, 'Eliminar colaborador', id); },
    seedDemo(ensureUser) {
      needOwner(); const items = sampleTeam(todayStr(), ensureUser);
      mutate(s => { s.employees = s.employees.filter(e => e.source !== 'demo').concat(items.map(cleanEmployee)); }, 'Cargar equipo de ejemplo', `${items.length} personas`); return items.length;
    },
    clearDemo() { needOwner(); const ids = []; mutate(s => { const d = new Set(s.employees.filter(e => e.source === 'demo').map(e => e.id)); s.employees.filter(e => d.has(e.id)).forEach(e => ids.push(e)); s.employees = s.employees.filter(e => !d.has(e.id)); s.requests = s.requests.filter(r => !d.has(r.employeeId)); s.reviews = s.reviews.filter(r => !d.has(r.employeeId)); }, 'Quitar equipo de ejemplo'); return ids; },
  };

  const settings = {
    get() { return read().settings; },
    save(patch) { needOwner(); mutate(s => { s.settings = cleanSettings({ ...s.settings, ...patch }); }, 'Configuración de RRHH', patch.workweek || 'festivos'); },
    holidays(year) { return holidaysFor(read().settings, year); },
    resetHolidays(year) { needOwner(); mutate(s => { delete s.settings.holidays[String(year)]; }, 'Festivos por defecto', String(year)); },
    saveTemplate(kind, items) { needOwner(); if (!['onboarding', 'offboarding'].includes(kind)) throw new Error('Plantilla no válida.'); mutate(s => { s.templates[kind] = items.map(cleanTpl).filter(i => i.label); }, 'Plantilla de RRHH', kind); },
    templates: () => read().templates,
  };

  function takenDays(s, employeeId, upTo) { return s.requests.filter(r => r.employeeId === employeeId && r.type === 'vacaciones' && r.status === 'aprobada' && (!upTo || r.from <= upTo)).reduce((n, r) => n + r.days, 0); }
  function pendingDays(s, employeeId) { return s.requests.filter(r => r.employeeId === employeeId && r.type === 'vacaciones' && r.status === 'pendiente').reduce((n, r) => n + r.days, 0); }
  const balance = employeeId => { const s = read(); const e = s.employees.find(x => x.id === employeeId); if (!e) return null; if (!canSeeEmployeeRequests(s, me(), employeeId) && !isOwner()) { const mine = empOf(s, me()); if (mine?.id !== employeeId) throw new Error('Sin permiso.'); } const b = vacationBalance({ hireDate: e.hireDate, asOf: todayStr(), taken: takenDays(s, employeeId) }); return { ...b, pending: pendingDays(s, employeeId), available: b.balance - pendingDays(s, employeeId) }; };

  const requests = {
    list({ scope = 'mine' } = {}) {
      const s = read(); const u = me(); const mine = empOf(s, u);
      return s.requests.filter(r => u.role === 'owner' ? (scope !== 'mine' || r.employeeId === mine?.id) : scope === 'mine' ? r.employeeId === mine?.id : canSeeEmployeeRequests(s, u, r.employeeId)).sort((a, b) => b.from.localeCompare(a.from));
    },
    // Calendario del equipo: solo ausencias aprobadas; sin comentarios ni tipo de incapacidad.
    calendar(from, to) {
      const s = read(); me();
      return s.requests.filter(r => r.status === 'aprobada' && r.from <= to && r.to >= from).map(r => ({ id: r.id, employeeId: r.employeeId, name: s.employees.find(e => e.id === r.employeeId)?.name || '', type: r.type === 'incapacidad' ? 'permiso_con_goce' : r.type, from: r.from, to: r.to }));
    },
    balance,
    days(from, to) { const s = read(); const y = Number(from.slice(0, 4)); const hol = [...new Set([...holidaysFor(s.settings, y), ...(to.slice(0, 4) !== from.slice(0, 4) ? holidaysFor(s.settings, Number(to.slice(0, 4))) : [])])]; return businessDays(from, to, { workweek: s.settings.workweek, holidays: hol }); },
    create(input) {
      const u = me(); const s0 = read(); const mine = empOf(s0, u);
      const employeeId = u.role === 'owner' && input.employeeId ? input.employeeId : mine?.id;
      if (!employeeId) throw new Error('Tu usuario no tiene expediente en RRHH. Pide al Dueño que te dé de alta.');
      const emp = s0.employees.find(e => e.id === employeeId); if (!emp || emp.status !== 'activo') throw new Error('El colaborador no está activo.');
      const days = requests.days(input.from, input.to); const req = cleanRequest({ ...input, employeeId, days, status: 'pendiente', decidedBy: '', decidedAt: '', decisionComment: '' });
      if (['vacaciones', 'permiso_con_goce', 'permiso_sin_goce', 'incapacidad'].includes(req.type) && days < 1) throw new Error('El periodo no tiene días hábiles.');
      if (req.type === 'vacaciones') { const b = balance(employeeId); if (days > b.available) throw new Error(`Solo tienes ${Math.max(0, b.available)} día(s) de vacaciones disponibles (saldo ${b.balance}, ${b.pending} en solicitudes pendientes).`); }
      if (s0.requests.some(r => r.employeeId === employeeId && ['pendiente', 'aprobada'].includes(r.status) && r.from <= req.to && r.to >= req.from)) throw new Error('Ya hay una solicitud pendiente o aprobada en esas fechas.');
      mutate(s => { s.requests.push(req); }, 'Solicitud de ausencia', `${emp.name} · ${REQUEST_TYPES[req.type]} · ${req.from} a ${req.to}`); return req;
    },
    decide(id, decision, comment = '') {
      const u = me(); if (!['aprobada', 'rechazada'].includes(decision)) throw new Error('Decisión no válida.');
      return mutate(s => {
        const r = s.requests.find(x => x.id === id); if (!r) throw new Error('La solicitud no existe.'); if (r.status !== 'pendiente') throw new Error('La solicitud ya fue resuelta.');
        const mine = empOf(s, u); const emp = s.employees.find(e => e.id === r.employeeId);
        const isMgr = !!mine && emp?.managerId === mine.id;
        if (u.role !== 'owner' && !isMgr) throw new Error('Solo el jefe directo o el Dueño pueden resolver esta solicitud.');
        if (u.role !== 'owner' && mine?.id === r.employeeId) throw new Error('No puedes resolver tu propia solicitud.');
        if (decision === 'aprobada' && r.type === 'vacaciones') { const b = vacationBalance({ hireDate: emp.hireDate, asOf: todayStr(), taken: takenDays(s, r.employeeId) }); if (r.days > b.balance) throw new Error('El saldo de vacaciones ya no alcanza.'); }
        r.status = decision; r.decidedBy = u.email; r.decidedAt = now().toISOString(); r.decisionComment = text(comment, 500); return r;
      }, decision === 'aprobada' ? 'Aprobar solicitud' : 'Rechazar solicitud', id);
    },
    cancel(id) { const u = me(); mutate(s => { const r = s.requests.find(x => x.id === id); if (!r) throw new Error('La solicitud no existe.'); if (u.role !== 'owner' && empOf(s, u)?.id !== r.employeeId) throw new Error('Sin permiso.'); if (r.status !== 'pendiente') throw new Error('Solo se cancelan solicitudes pendientes.'); r.status = 'cancelada'; }, 'Cancelar solicitud', id); },
  };

  const performance = {
    cycles: () => read().cycles,
    saveCycle(c) { needOwner(); const cy = cleanCycle(c); mutate(s => { const i = s.cycles.findIndex(x => x.id === cy.id); if (i >= 0) s.cycles[i] = cy; else s.cycles.push(cy); }, 'Ciclo de evaluación', cy.name); return cy; },
    // Crea una evaluación por colaborador activo con los objetivos dados.
    launch(cycleId, objectives) { needOwner(); const objs = cleanObjectives(objectives); if (!objs.length) throw new Error('Agrega al menos un objetivo.'); let n = 0; mutate(s => { if (!s.cycles.some(c => c.id === cycleId)) throw new Error('El ciclo no existe.'); for (const e of s.employees.filter(x => x.status === 'activo')) { if (s.reviews.some(r => r.cycleId === cycleId && r.employeeId === e.id)) continue; s.reviews.push(cleanReview({ cycleId, employeeId: e.id, objectives: objs.map(o => ({ ...o, id: rid().slice(0, 12) })) })); n++; } }, 'Lanzar evaluaciones', `${cycleId} · ${n}`); return n; },
    list() { const s = read(); const u = me(); const mine = empOf(s, u); return s.reviews.filter(r => u.role === 'owner' || r.employeeId === mine?.id || reportsOf(s, mine?.id).includes(r.employeeId)); },
    submit(id, role, ratings, comment) {
      const u = me();
      return mutate(s => {
        const r = s.reviews.find(x => x.id === id); if (!r) throw new Error('La evaluación no existe.'); const cy = s.cycles.find(c => c.id === r.cycleId); if (cy?.status === 'cerrado') throw new Error('El ciclo está cerrado.');
        const mine = empOf(s, u); const emp = s.employees.find(e => e.id === r.employeeId);
        if (role === 'self') { if (mine?.id !== r.employeeId) throw new Error('Solo la propia persona hace su autoevaluación.'); }
        else if (role === 'manager') { if (!(u.role === 'owner' || (mine && emp?.managerId === mine.id))) throw new Error('Solo el jefe directo o el Dueño evalúan.'); if (mine?.id === r.employeeId && u.role !== 'owner') throw new Error('No puedes evaluarte a ti mismo.'); }
        else throw new Error('Rol de evaluación no válido.');
        const clean = cleanRatings(ratings); if (r.objectives.some(o => !clean[o.id])) throw new Error('Califica todos los objetivos del 1 al 5.');
        r[role] = { ratings: clean, comment: text(comment, 1500), at: now().toISOString(), by: u.email }; return r;
      }, role === 'self' ? 'Autoevaluación' : 'Evaluación del jefe', id);
    },
  };

  // Cursos vencidos por persona vienen de training; aquí solo se arman cifras de plantilla.
  function panel(overdueByUser = {}) {
    needOwner(); const s = read(); const t = todayStr(); const active = s.employees.filter(e => e.status === 'activo'); const y0 = `${t.slice(0, 4)}-01-01`;
    const md = d => (d || '').slice(5);
    const soon = (field, days = 30) => active.filter(e => isISODate(e[field])).map(e => { const y = Number(t.slice(0, 4)); let next = `${y}-${md(e[field])}`; if (!isISODate(next) || next < t) next = `${y + 1}-${md(e[field])}`; if (!isISODate(next)) next = `${y + 1}-02-28`; return { e, date: next, in: diffDays(t, next), years: Number(next.slice(0, 4)) - Number(e[field].slice(0, 4)) }; }).filter(x => x.in <= days).sort((a, b) => a.in - b.in);
    return {
      headcount: active.length, byArea: AREAS.map(a => [a, active.filter(e => e.area === a).length]).filter(([, n]) => n),
      altas: s.employees.filter(e => e.hireDate >= y0).length, bajas: s.employees.filter(e => e.status === 'baja' && e.endDate >= y0).length,
      pendingRequests: s.requests.filter(r => r.status === 'pendiente').map(r => ({ ...r, name: s.employees.find(e => e.id === r.employeeId)?.name || '' })),
      missingDocs: active.map(e => ({ e, missing: Object.keys(DOC_TYPES).filter(k => ['pendiente', 'vencido'].includes(docState(e.docs[k], t))) })).filter(x => x.missing.length),
      anniversaries: soon('hireDate').filter(x => x.years >= 1), birthdays: soon('birthDate'),
      overdue: Object.entries(overdueByUser).map(([id, n]) => ({ id, n })).filter(x => x.n > 0),
    };
  }

  return { employees, settings, requests, performance, panel, me: () => { const s = read(); const e = empOf(s, me()); return e ? view(s, e) : null; }, isOwner, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); } };
}

function sampleTeam(today, ensureUser) {
  const y = Number(today.slice(0, 4)); const d = (back, m, day) => `${y - back}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const people = [
    ['demo-p1', 'Valeria Montoya (ejemplo)', 'Directora de operaciones', 'Dirección', '', d(6, 3, 14), 'indeterminado', 'Playa del Carmen', 'editor', '1988-05-21'],
    ['demo-p2', 'Rodrigo Salinas (ejemplo)', 'Jefe de ventas', 'Ventas', 'demo-p1', d(4, 8, 1), 'indeterminado', 'Playa del Carmen', 'sales', '1991-11-02'],
    ['demo-p3', 'Camila Herrera (ejemplo)', 'Ejecutiva de ventas', 'Ventas', 'demo-p2', d(2, 1, 10), 'indeterminado', 'Cancún', 'sales', '1995-02-17'],
    ['demo-p4', 'Emilio Duarte (ejemplo)', 'Ejecutivo de ventas', 'Ventas', 'demo-p2', addDays(today, -120), 'determinado', 'Cancún', 'sales', '1997-09-30'],
    ['demo-p5', 'Ximena Paredes (ejemplo)', 'Directora de diseño', 'Diseño', 'demo-p1', d(8, 2, 20), 'indeterminado', 'Mérida', 'editor', '1986-07-09'],
    ['demo-p6', 'Tadeo Lozano (ejemplo)', 'Diseñador visual', 'Diseño', 'demo-p5', d(3, 10, 3), 'indeterminado', 'Mérida', 'editor', '1993-12-12'],
    ['demo-p7', 'Renata Ibarra (ejemplo)', 'Desarrolladora web', 'Desarrollo', 'demo-p1', d(1, 4, 15), 'honorarios', 'Remoto', 'editor', '1994-04-25'],
    ['demo-p8', 'Mauricio Ferrer (ejemplo)', 'Administración y finanzas', 'Administración', 'demo-p1', d(11, 5, 9), 'indeterminado', 'Playa del Carmen', 'editor', '1982-01-28'],
  ];
  return people.map(([id, name, position, area, managerId, hireDate, contract, location, role, birthDate], i) => {
    const email = `${id.replace('demo-', '')}@ejemplo.ornat.mx`; const user = ensureUser ? ensureUser({ name: name.replace(' (ejemplo)', ''), email, role }) : null;
    const docs = {}; Object.keys(DOC_TYPES).forEach((k, j) => { docs[k] = { status: (i + j) % 4 === 0 ? 'pendiente' : 'entregado', expires: k === 'ine' && i % 3 === 0 ? addDays(today, 20 + i) : '', fileName: '' }; });
    return { id, userId: user?.id || '', name, email, phone: `+52 984 000 00${10 + i}`, position, area, managerId, hireDate, birthDate, contract, location, status: 'activo', source: 'demo', docs,
      sensitive: { salary: 18000 + i * 3500, curp: `EJEM${900101 + i}HQRXXX0${i}`.slice(0, 18).padEnd(18, 'X'), rfc: `EJE${900101 + i}AB${i}`.slice(0, 13), nss: String(12345678900 + i), bank: String(1234567890123456 + i) } };
  });
}

let shared;
export async function peopleShared() { return (shared ||= await makeShared()); }
async function makeShared() {
  const { data } = await import('./data.js'); const d = data();
  return createPeople({ getSession: () => d.getSession(), listUsers: () => d.users.list(), audit: (a, det, area) => { try { d.audit.log(a, det, area); } catch {} } });
}
