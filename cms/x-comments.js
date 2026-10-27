// Comentarios anclados al lienzo y flujo de aprobación (Borrador → En revisión → Aprobado → Publicado).
import { STATUS_LABEL, COMMENT_FILTERS, addComment, addReply, setResolved, removeComment, filterComments, numberOf, mentionsIn, peopleFrom, lastEntry } from './comments.js';

export function create(host, ext) {
  const { esc } = host;
  let filter = 'open'; let active = null; let draft = null;
  const list = () => host.project?.comments || [];
  const me = () => ext.access.user?.email || '';
  const fmt = iso => new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const people = () => { let users = []; try { users = ext.data?.users.list() || []; } catch { /* sin usuarios */ } return peopleFrom(list(), users); };
  const body = text => esc(text).replace(/@([\p{L}\d._@-]+)/gu, '<mark>@$1</mark>');

  function save(next) { host.project.comments = next; host.touch(); syncPins(); if (host.currentTab === 'comments') host.renderPanel(); }
  function syncPins() {
    if (!host.project) return;
    const shown = filterComments(list(), { filter, me: me() });
    const pins = shown.map(c => ({ id: c.id, anchorId: c.anchor.id, ox: c.anchor.ox, oy: c.anchor.oy, n: numberOf(list(), c.id), resolved: c.resolved, active: c.id === active }));
    if (draft) pins.push({ id: 'draft', anchorId: draft.anchor.id, ox: draft.anchor.ox, oy: draft.anchor.oy, n: '+', resolved: false, active: true });
    host.send('pins', { pins });
  }

  function workflow() {
    const review = ext.review(); const trans = ext.availableTransitions(); const needsNote = trans.some(t => t.needsNote);
    const sent = lastEntry(review, 'review'); const approved = review.status === 'approved' ? lastEntry(review, 'approved') : null; const last = review.history.at(-1);
    return `<div class="x-flow card" data-status="${esc(review.status)}"><div class="x-flow-head"><span class="status-pill" data-status="${esc(review.status)}">${esc(STATUS_LABEL[review.status])}</span><small class="muted">${last ? `${esc(last.by.name)} · ${fmt(last.at)}` : 'Sin movimientos todavía'}</small></div>
      <ol class="x-steps" aria-label="Flujo de aprobación">${['draft', 'review', 'approved', 'published'].map(s => `<li ${s === review.status ? 'aria-current="step"' : ''} data-done="${['draft', 'review', 'approved', 'published'].indexOf(s) < ['draft', 'review', 'approved', 'published'].indexOf(review.status)}">${STATUS_LABEL[s]}</li>`).join('')}</ol>
      ${approved ? `<p class="muted">Aprobado por <b>${esc(approved.by.name)}</b> el ${fmt(approved.at)}.</p>` : ''}${review.status === 'draft' && last?.note ? `<p class="notice warning"><b>${esc(last.by.name)}:</b> ${esc(last.note)}</p>` : ''}${sent && review.status === 'review' ? `<p class="muted">Enviado a revisión por <b>${esc(sent.by.name)}</b> el ${fmt(sent.at)}.</p>` : ''}
      ${needsNote ? '<label class="field" style="margin-top:8px"><span>Nota para pedir cambios</span><textarea id="cm-note" data-f="cm-note" maxlength="2000" placeholder="Explica qué debe cambiar"></textarea></label>' : ''}
      ${trans.length ? `<div class="actions-row">${trans.map(t => `<button type="button" class="button ${t.to === 'approved' ? 'lime' : ''}" data-x="cm:transition" data-xv="${t.to}">${esc(t.label)}</button>`).join('')}</div>` : '<p class="muted">Tu rol no puede mover el estado desde aquí.</p>'}
      ${review.history.length > 1 ? `<details class="x-hist"><summary>Historial (${review.history.length})</summary><ul>${[...review.history].reverse().map(h => `<li><b>${STATUS_LABEL[h.status]}</b> · ${esc(h.by.name)} · ${fmt(h.at)}${h.note ? `<br><span class="muted">${esc(h.note)}</span>` : ''}</li>`).join('')}</ul></details>` : ''}</div>`;
  }
  function composer() {
    return `<form class="x-compose card" data-xs="cm:add"><h3>Nuevo comentario en «${esc(draft.anchor.label || 'elemento')}»</h3><label class="sr" for="cm-new">Comentario</label><textarea id="cm-new" data-f="cm-new" maxlength="2000" required placeholder="Escribe tu comentario. Usa @nombre para mencionar."></textarea>${mentionSelect('cm-new')}<div class="actions-row"><button type="submit" class="button lime">Comentar</button><button type="button" class="button" data-x="cm:cancel">Cancelar</button></div></form>`;
  }
  const mentionSelect = target => { const p = people(); target = esc(target); return p.length ? `<label class="sr" for="mn-${target}">Mencionar a alguien</label><select id="mn-${target}" class="x-mention" data-xi="cm:mention" data-xv="${target}"><option value="">Mencionar…</option>${p.map(x => `<option value="${esc(x.name.split(/\s+/)[0])}">@${esc(x.name)}</option>`).join('')}</select>` : ''; };
  function thread(c) {
    const n = numberOf(list(), c.id); const mine = c.author.email === me();
    return `<article class="x-thread ${c.id === active ? 'is-active' : ''}" id="cm-${esc(c.id)}" data-resolved="${c.resolved === true}"><header><button type="button" class="x-pinno" data-x="cm:go" data-xid="${esc(c.id)}" aria-label="Ir al comentario ${n} en el sitio">${n}</button><div><b>${esc(c.author.name)}</b> <small class="muted">${fmt(c.at)}</small><div class="x-anchor">En «${esc(c.anchor.label || 'elemento')}»${c.resolved ? ' · <span class="tag">Resuelto</span>' : ''}</div></div></header>
      <p class="x-body">${body(c.text)}</p>
      ${c.replies.map(r => `<div class="x-reply"><b>${esc(r.author.name)}</b> <small class="muted">${fmt(r.at)}</small><p>${body(r.text)}</p></div>`).join('')}
      ${ext.access.canComment ? `<form class="x-replyform" data-xs="cm:reply" data-xid="${esc(c.id)}"><label class="sr" for="rp-${esc(c.id)}">Responder</label><textarea id="rp-${esc(c.id)}" data-f="rp-${esc(c.id)}" maxlength="2000" rows="2" placeholder="Responder…"></textarea>${mentionSelect('rp-' + c.id)}<div class="actions-row"><button type="submit" class="button">Responder</button><button type="button" class="button" data-x="cm:resolve" data-xid="${esc(c.id)}">${c.resolved ? 'Reabrir' : 'Marcar resuelto'}</button>${mine || ext.access.canEdit ? `<button type="button" class="icon-btn" data-x="cm:del" data-xid="${esc(c.id)}" aria-label="Eliminar el comentario ${n}">${ext.icon('trash')}</button>` : ''}</div></form>` : ''}</article>`;
  }

  return {
    tab: { id: 'comments', label: 'Comentarios y aprobación', short: 'Comentarios', icon: 'chat', eyebrow: 'REVISIÓN', title: 'Comentarios', desc: 'Pines en el lienzo y aprobación del cliente.', before: 'versions' },
    onProject() { active = null; draft = null; filter = 'open'; },
    message(m) {
      if (m.type === 'ready') setTimeout(syncPins, 200);
      if (m.type === 'comment-click') {
        if (!ext.access.canComment) return;
        draft = { anchor: m.anchor }; host.setTab('comments'); host.setDrawer(true); syncPins();
        setTimeout(() => document.getElementById('cm-new')?.focus(), 80);
      }
      if (m.type === 'comment-open') {
        const c = list().find(x => x.id === m.id); if (!c) return;
        active = c.id; if (filter === 'open' && c.resolved) filter = 'all'; if (filter === 'resolved' && !c.resolved) filter = 'all';
        host.setTab('comments'); host.setDrawer(true); syncPins();
        setTimeout(() => document.getElementById('cm-' + c.id)?.scrollIntoView({ block: 'nearest' }), 60);
      }
    },
    syncPins,
    render() {
      const shown = filterComments(list(), { filter, me: me() });
      return `${workflow()}${ext.access.canComment ? `<button type="button" class="button full ${ext.commenting ? 'dark' : ''}" data-x="cm:toggle" aria-pressed="${ext.commenting}">${ext.icon('chat')}<span>${ext.commenting ? 'Dejar de comentar' : 'Comentar en el sitio'}</span></button><p class="hint">Activa el modo comentar y haz clic en cualquier elemento para dejar un pin.</p>` : '<div class="notice">Entra con un rol que pueda comentar para dejar pines.</div>'}
      ${draft ? composer() : ''}
      <div class="chips-row wrap" role="group" aria-label="Filtrar comentarios" style="margin:12px 0">${COMMENT_FILTERS.map(([v, l]) => `<button type="button" class="chip" data-x="cm:filter" data-xv="${v}" aria-pressed="${filter === v}">${l} <small>${filterComments(list(), { filter: v, me: me() }).length}</small></button>`).join('')}</div>
      <div class="x-threads">${shown.map(thread).join('') || `<div class="empty-state">${list().length ? 'No hay comentarios con este filtro.' : 'Aún no hay comentarios.'}</div>`}</div>`;
    },
    click(act, b) {
      const id = b.dataset.xid;
      if (act === 'toggle') { if (!ext.access.canComment) { toastDenied(); return; } ext.setCommenting(!ext.commenting); if (host.currentTab === 'comments') host.renderPanel(); return; }
      if (act === 'flow') { host.setTab('comments'); host.setDrawer(true); return; }
      if (act === 'filter') { filter = b.dataset.xv; syncPins(); host.renderPanel(); return; }
      if (act === 'cancel') { draft = null; syncPins(); host.renderPanel(); return; }
      if (act === 'go') { const c = list().find(x => x.id === id); if (c) { active = id; syncPins(); host.send('navigate', { id: c.anchor.id }); host.renderPanel(); } return; }
      if (act === 'transition') {
        const to = b.dataset.xv; const note = document.getElementById('cm-note')?.value || '';
        try {
          const review = ext.transition(to, note);
          host.toast(`Estado: ${STATUS_LABEL[review.status]}.`);
          if (to === 'draft' && note.trim() && ext.access.canComment) { const anchor = { id: 'section:' + (host.currentSection || ''), ox: .05, oy: .05, label: 'Cambios solicitados' }; if (anchor.id !== 'section:') save(addComment(list(), { anchor, text: `Cambios solicitados: ${note.trim()}`, author: ext.access.user })); }
          host.renderPanel();
        } catch (error) { host.toast(error.message, true); }
        return;
      }
      if (!ext.access.canComment) { toastDenied(); return; }
      if (act === 'resolve') { const c = list().find(x => x.id === id); if (!c) return; save(setResolved(list(), id, !c.resolved, ext.access.user)); ext.audit(c.resolved ? 'Comentario reabierto' : 'Comentario resuelto', `${host.project.name} · ${c.text.slice(0, 60)}`); return; }
      if (act === 'del') { const c = list().find(x => x.id === id); if (!c || !confirm('¿Eliminar este comentario y sus respuestas?')) return; save(removeComment(list(), id)); ext.audit('Comentario eliminado', host.project.name); }
    },
    input(act, el) {
      if (act !== 'mention' || !el.value) return;
      const ta = document.getElementById(el.dataset.xv); if (ta) { ta.value = (ta.value + (ta.value && !/\s$/.test(ta.value) ? ' ' : '') + '@' + el.value + ' '); ta.focus(); }
      el.value = '';
    },
    change(act, el) { this.input(act, el); },
    submit(act, form) {
      if (!ext.access.canComment) { toastDenied(); return; }
      try {
        if (act === 'add') {
          const text = form.querySelector('textarea').value; const next = addComment(list(), { anchor: draft.anchor, text, author: ext.access.user });
          draft = null; active = next.at(-1).id; save(next); ext.audit('Comentario creado', `${host.project.name} · ${text.slice(0, 80)}`); logMentions(text);
        } else if (act === 'reply') {
          const text = form.querySelector('textarea').value; save(addReply(list(), form.dataset.xid, { text, author: ext.access.user })); ext.audit('Respuesta a comentario', `${host.project.name} · ${text.slice(0, 80)}`); logMentions(text);
        }
      } catch (error) { host.toast(error.message, true); }
    }
  };
  function logMentions(text) { for (const p of mentionsIn(text, people())) ext.audit('Mención en comentario', `${p.email} · ${host.project.name}`); }
  function toastDenied() { host.toast(ext.access.guest ? 'Entra con tu cuenta para comentar.' : `Tu rol (${ext.roleLabel()}) no puede comentar.`, true); }
}
