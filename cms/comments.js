// Comentarios anclados y flujo de aprobación (Borrador → En revisión → Aprobado → Publicado). Funciones puras;
// el editor guarda el resultado en project.comments / project.review y registra cada acción en data().audit.
export const STATUS_LABEL = { draft: 'Borrador', review: 'En revisión', approved: 'Aprobado', published: 'Publicado' };
export const emptyReview = () => ({ status: 'draft', history: [] });

export function personOf(user) {
  if (!user) return { id: 'invitado', name: 'Invitado', email: 'invitado', role: 'guest' };
  return { id: String(user.id || user.email || 'usuario').slice(0, 100), name: String(user.name || user.email || 'Usuario').slice(0, 250), email: String(user.email || '').slice(0, 250), role: String(user.role || 'guest').slice(0, 250) };
}
const rid = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const clamp01 = n => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));

export function addComment(list = [], { anchor, text, author, now = new Date(), id } = {}) {
  const body = String(text ?? '').trim();
  if (!body) throw new Error('Escribe un comentario antes de enviarlo.');
  if (body.length > 2000) throw new Error('Un comentario admite hasta 2000 caracteres.');
  if (!anchor?.id) throw new Error('El comentario necesita un elemento donde anclarse.');
  if (list.length >= 500) throw new Error('Se alcanzó el máximo de 500 comentarios en este proyecto.');
  const comment = { id: id || rid(), anchor: { id: String(anchor.id).slice(0, 300), ox: clamp01(anchor.ox), oy: clamp01(anchor.oy), label: String(anchor.label || '').slice(0, 200) }, author: personOf(author), text: body, at: now.toISOString(), resolved: false, replies: [] };
  return [...list, comment];
}
export function addReply(list = [], id, { text, author, now = new Date() } = {}) {
  const body = String(text ?? '').trim();
  if (!body) throw new Error('Escribe una respuesta antes de enviarla.');
  if (body.length > 2000) throw new Error('Una respuesta admite hasta 2000 caracteres.');
  if (!list.some(c => c.id === id)) throw new Error('Ese comentario ya no existe.');
  return list.map(c => (c.id === id ? { ...c, replies: [...c.replies, { id: rid(), author: personOf(author), text: body, at: now.toISOString() }] } : c));
}
export function setResolved(list = [], id, resolved, author, now = new Date()) {
  if (!list.some(c => c.id === id)) throw new Error('Ese comentario ya no existe.');
  return list.map(c => {
    if (c.id !== id) return c;
    const next = { ...c, resolved: !!resolved };
    if (resolved) { next.resolvedBy = personOf(author); next.resolvedAt = now.toISOString(); } else { delete next.resolvedBy; delete next.resolvedAt; }
    return next;
  });
}
export function removeComment(list = [], id) { return list.filter(c => c.id !== id); }
export function numberOf(list = [], id) { return [...list].sort((a, b) => String(a.at).localeCompare(String(b.at))).findIndex(c => c.id === id) + 1; }

export const COMMENT_FILTERS = [['open', 'Abiertos'], ['resolved', 'Resueltos'], ['mine', 'Míos'], ['all', 'Todos']];
export function filterComments(list = [], { filter = 'open', me = '' } = {}) {
  const mine = String(me || '').toLowerCase();
  return list.filter(c => {
    if (filter === 'open') return !c.resolved;
    if (filter === 'resolved') return c.resolved;
    if (filter === 'mine') return c.author.email.toLowerCase() === mine || c.replies.some(r => r.author.email.toLowerCase() === mine);
    return true;
  });
}
// @nombre o @correo de una persona conocida (autores previos y usuarios de data().users).
export function mentionsIn(text, people = []) {
  const found = new Map();
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const body = norm(text);
  for (const p of people) {
    const first = norm(p.name || '').split(/\s+/)[0];
    const email = norm(p.email || '');
    if ((email && body.includes('@' + email)) || (first.length >= 2 && new RegExp(`@${first.replace(/[^a-z0-9]/g, '')}(?![a-z0-9])`).test(body))) found.set(p.email || p.name, p);
  }
  return [...found.values()];
}
export function peopleFrom(list = [], users = []) {
  const map = new Map();
  for (const u of users) if (u?.email) map.set(u.email, { name: u.name, email: u.email });
  for (const c of list) { map.set(c.author.email, { name: c.author.name, email: c.author.email }); for (const r of c.replies) map.set(r.author.email, { name: r.author.name, email: r.author.email }); }
  return [...map.values()];
}

// ---------- Flujo de estado ----------
const TRANSITIONS = [
  { from: 'draft', to: 'review', label: 'Enviar a revisión', perm: 'cms.edit' },
  { from: 'review', to: 'approved', label: 'Aprobar', perm: 'cms.approve' },
  { from: 'review', to: 'draft', label: 'Pedir cambios', perm: 'cms.approve', needsNote: true },
  { from: 'approved', to: 'draft', label: 'Reabrir para editar', perm: 'cms.edit' },
  { from: 'published', to: 'draft', label: 'Volver a borrador', perm: 'cms.edit' },
  { from: 'draft', to: 'published', label: 'Publicar', perm: 'cms.publish', publish: true },
  { from: 'review', to: 'published', label: 'Publicar', perm: 'cms.publish', publish: true },
  { from: 'approved', to: 'published', label: 'Publicar', perm: 'cms.publish', publish: true },
  { from: 'published', to: 'published', label: 'Publicar de nuevo', perm: 'cms.publish', publish: true }
];
export function availableTransitions(status, can = () => false) {
  return TRANSITIONS.filter(t => t.from === status && can(t.perm));
}
export function applyTransition(review = emptyReview(), to, { by, note = '', can = () => true, now = new Date() } = {}) {
  const t = TRANSITIONS.find(x => x.from === review.status && x.to === to);
  if (!t) throw new Error(`No se puede pasar de «${STATUS_LABEL[review.status]}» a «${STATUS_LABEL[to] || to}».`);
  if (!can(t.perm)) throw new Error('Tu rol no puede hacer este cambio de estado.');
  const text = String(note || '').trim();
  if (t.needsNote && !text) throw new Error('Explica qué cambios necesitas: escribe una nota.');
  const entry = { status: to, by: personOf(by), at: now.toISOString() };
  if (text) entry.note = text.slice(0, 2000);
  return { status: to, history: [...review.history, entry].slice(-200) };
}
// Editar después de enviar a revisión o aprobar invalida la aprobación: vuelve a borrador y lo deja anotado.
export function afterEdit(review = emptyReview(), by, now = new Date()) {
  if (review.status !== 'review' && review.status !== 'approved') return review;
  return { status: 'draft', history: [...review.history, { status: 'draft', by: personOf(by), at: now.toISOString(), note: 'Se editó el proyecto después de enviarlo a revisión.' }].slice(-200) };
}
export const flowEngaged = review => !!review?.history?.some(h => h.status === 'review');
export function publishWarning(review) {
  if (!flowEngaged(review)) return '';
  if (review.status === 'approved' || review.status === 'published') return '';
  return review.status === 'review' ? 'Este proyecto está en revisión y todavía no lo aprobó el cliente.' : 'Este proyecto tuvo cambios después de la revisión y no está aprobado.';
}
export function lastEntry(review, status) { return [...(review?.history || [])].reverse().find(h => h.status === status) || null; }
