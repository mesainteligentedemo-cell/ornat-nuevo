// Extensiones del editor: acceso por roles, barra superior, registro de paneles nuevos y delegación de eventos.
// editor.js le da un `host` (estado y acciones del proyecto) y ext.js se encarga de que cada módulo (bloques, propiedades,
// versiones, biblioteca, kits, comentarios, idiomas, publicar) enchufe su panel sin tocar el resto del editor.
import { STATUS_LABEL, emptyReview, applyTransition, afterEdit, personOf, availableTransitions } from './comments.js';
import * as elements from './x-elements.js';
import * as props from './x-props.js';
import * as versions from './x-versions.js';
import * as library from './x-library.js';
import * as kits from './x-kits.js';
import * as comments from './x-comments.js';
import * as lang from './x-lang.js';
import * as publish from './x-publish.js';
import * as structure from './x-structure.js';

const SYMBOLS = {
  blocks: '<rect x="3.500" y="3.500" width="9" height="9" rx="1.500"/><path d="M17 3.500v7M13.500 7h7"/><rect x="3.500" y="15" width="17" height="5.500" rx="1.500"/>',
  library: '<rect x="3.5" y="5.5" width="14" height="14" rx="2"/><path d="M7 3.5h12.5a1.500 1.500 0 0 1 1.500 1.500V17"/><circle cx="8.500" cy="10" r="1.300"/><path d="m4 17 4.500-4.500 3.500 3.500 2-2 3.500 3.500"/>',
  home: '<path d="m3.500 11 8.500-7 8.500 7"/><path d="M5.500 9.500V20h13V9.500M10 20v-5.500h4V20"/>',
  chat: '<path d="M4 5.500h16v10.500H9.500L5.500 20v-4H4z"/>',
  clock: '<circle cx="12" cy="12" r="8.500"/><path d="M12 7v5l3.500 2"/>',
  lang: '<path d="M4 6h9M8.500 4v2M6 6c0 3.500 2.500 6 6 7M12 6c0 3.500-3 6.500-7.500 7.500"/><path d="m13 20 3.500-9 3.500 9M14.200 17.500h4.600"/>',
  lock: '<rect x="5.500" y="10.500" width="13" height="9.500" rx="2"/><path d="M8.500 10.500V8a3.500 3.500 0 0 1 7 0v2.500"/>',
  tree: '<rect x="3.500" y="4" width="7" height="4.500" rx="1.200"/><rect x="10" y="10" width="10.500" height="4" rx="1.200"/><rect x="10" y="16" width="10.500" height="4" rx="1.200"/><path d="M7 8.500V18h3M7 12h3"/>',
  grip: '<circle cx="9" cy="6" r="1.400"/><circle cx="15" cy="6" r="1.400"/><circle cx="9" cy="12" r="1.400"/><circle cx="15" cy="12" r="1.400"/><circle cx="9" cy="18" r="1.400"/><circle cx="15" cy="18" r="1.400"/>',
  more: '<circle cx="5" cy="12" r="1.800"/><circle cx="12" cy="12" r="1.800"/><circle cx="19" cy="12" r="1.800"/>',
  templates: '<rect x="3.500" y="4.500" width="17" height="15" rx="2"/><path d="M3.500 9h17M9 9v10.500"/>',
  up: '<path d="M12 19V6M6.500 11.500 12 6l5.500 5.500"/>',
  down: '<path d="M12 5v13M6.500 12.500 12 18l5.500-5.500"/>',
  copy: '<rect x="8.500" y="8.500" width="11" height="11" rx="2"/><path d="M15.500 8.500V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.500a2 2 0 0 0 2 2h2.500"/>',
  trash: '<path d="M5 7h14M9.500 7V4.500h5V7M7 7l1 12.500h8L17 7M10 11v5M14 11v5"/>',
  check: '<path d="m5 12.500 4.500 4.500L19 7.500"/>',
  send: '<path d="M4 12 20 4l-4.500 16-3.500-6.500z"/>',
  warn: '<path d="M12 4 3 19.500h18z"/><path d="M12 10v4.500M12 17.500v.01"/>',
  spark: '<path d="m12 3 1.800 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800zM18 15l.8 2.200L21 18l-2.200.8L18 21l-.8-2.200L15 18l2.200-.8z"/>',
  publish: '<path d="M12 16V4M7.500 8.500 12 4l4.500 4.500M5 14v4.500A1.500 1.500 0 0 0 6.500 20h11a1.500 1.500 0 0 0 1.500-1.500V14"/>'
};

export function createExt(host) {
  const ext = { lang: 'es', commenting: false, data: null, degraded: false, guest: false, access: null, tabs: {}, panels: {}, mods: {} };
  const { $, $$, esc, toast } = host;

  // ----- iconos extra en el sprite existente -----
  const defs = document.querySelector('svg defs');
  if (defs) defs.insertAdjacentHTML('beforeend', Object.entries(SYMBOLS).map(([id, body]) => `<symbol id="i-${id}" viewBox="0 0 24 24">${body}</symbol>`).join(''));
  ext.icon = (name, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

  // ----- acceso y roles -----
  function computeAccess() {
    const d = ext.data; const session = d?.getSession?.() || null;
    if (ext.degraded) return { session: null, user: { id: 'local', name: 'Modo local', email: 'local', role: 'owner' }, role: 'owner', guest: false, canEdit: true, canPublish: true, canComment: true, canApprove: true, canEditProps: true, can: () => true };
    const can = a => !!d && !!session && d.can(a);
    return { session, user: session?.user || null, role: session?.user?.role || null, guest: !session, canEdit: can('cms.edit'), canPublish: can('cms.publish'), canComment: can('cms.comment'), canApprove: can('cms.approve'), canEditProps: can('properties.edit'), can };
  }
  ext.refreshAccess = () => { ext.access = computeAccess(); return ext.access; };
  ext.refreshAccess();
  ext.canEdit = () => ext.access.canEdit;
  ext.actor = () => personOf(ext.access.user);
  ext.actorLabel = () => ext.access.user?.email || 'invitado';
  ext.denied = () => toast(ext.access.guest ? 'Entra con tu cuenta para editar. Como invitado solo puedes ver.' : `Tu rol (${ext.roleLabel()}) solo puede ver, comentar o aprobar.`, true);
  ext.roleLabel = () => ({ owner: 'Dueño', editor: 'Editor', sales: 'Vendedor', client: 'Cliente' }[ext.access.role] || 'Invitado');
  ext.audit = (action, detail = '') => { try { ext.data?.audit.log(action, String(detail).slice(0, 300), 'cms'); } catch { /* auditoría opcional */ } };
  const READONLY_TABS = new Set(['design', 'comments', 'versions']);
  ext.tabAllowed = id => ext.access.canEdit || READONLY_TABS.has(id);

  // ----- estado de revisión -----
  ext.review = () => host.project?.review || emptyReview();
  ext.setReview = review => { host.project.review = review; host.touch(); renderPill(); };
  ext.transition = (to, note = '') => {
    const review = applyTransition(ext.review(), to, { by: ext.access.user, note, can: ext.access.can });
    ext.setReview(review); ext.audit(`Estado del proyecto: ${STATUS_LABEL[to]}`, `${host.project.name}${note ? ' · ' + note : ''}`);
    return review;
  };
  function renderPill() {
    const pill = $('#status-pill'); if (!pill || !host.project) return;
    const status = ext.review().status;
    pill.textContent = STATUS_LABEL[status]; pill.dataset.status = status;
    pill.setAttribute('aria-label', `Estado del proyecto: ${STATUS_LABEL[status]}. Abrir el flujo de aprobación`);
  }

  // ----- modo del lienzo -----
  ext.mode = () => {
    const commenting = ext.commenting && ext.access.canComment && host.selecting;
    return { selecting: host.selecting && ext.access.canEdit && !commenting, commenting };
  };
  ext.setCommenting = on => {
    ext.commenting = !!on && ext.access.canComment;
    const b = $('#comment-mode'); if (b) { b.setAttribute('aria-pressed', String(ext.commenting)); b.querySelector('span').textContent = ext.commenting ? 'Dejar de comentar' : 'Comentar'; }
    $('#selection-hint').textContent = ext.commenting ? 'Modo comentar: haz clic en cualquier parte para dejar un comentario anclado.' : '';
    host.sendMode();
  };

  // ----- barra superior -----
  function buildTopbar() {
    const actions = $('.header-actions'); const view = $('.view-controls');
    view.insertAdjacentHTML('beforeend', `<div class="lang-toggle" role="group" aria-label="Idioma que estás editando"><button type="button" data-x="lang:set" data-xv="es" aria-pressed="true" title="Editar en español">ES</button><button type="button" data-x="lang:set" data-xv="en" aria-pressed="false" title="Editar las traducciones al inglés">EN</button></div>`);
    $('#select-mode').insertAdjacentHTML('beforebegin', `<button type="button" class="button" id="comment-mode" data-x="cm:toggle" aria-pressed="false" title="Comentar: deja un pin anclado a un elemento">${ext.icon('chat')}<span>Comentar</span></button><button type="button" class="status-pill" id="status-pill" data-x="cm:flow" data-status="draft">Borrador</button>`);
    $('#export-project').insertAdjacentHTML('afterend', `<button type="button" class="button lime" id="publish-btn" data-x="pub:open" title="Publicar (demo)">${ext.icon('publish')}<span>Publicar</span></button>`);
    $('.topbar').append(Object.assign(document.createElement('span'), { id: 'x-session', className: 'x-session' }));
    mountSession();
    $('.canvas-area').insertAdjacentHTML('afterbegin', '<div class="access-bar" id="access-bar" role="status" hidden></div>');
  }
  async function mountSession() {
    const slot = $('#x-session'); if (!slot) return;
    try { await import('/shared/session-bar.js'); slot.innerHTML = '<ornat-session current="cms"></ornat-session>'; }
    catch { slot.innerHTML = '<span class="demo-pill" id="x-session-fallback"></span>'; renderSessionFallback(); }
  }
  function renderSessionFallback() { const el = $('#x-session-fallback'); if (!el) return; const a = ext.access; el.innerHTML = a.user ? `${esc(a.user.name)} · ${esc(ext.roleLabel())}` : '<a href="/cuenta/?next=/cms/">Entrar</a>'; }

  function renderAccessBar() {
    const bar = $('#access-bar'); if (!bar) return;
    const a = ext.access;
    if (ext.degraded) { bar.hidden = false; bar.dataset.level = 'warn'; bar.innerHTML = 'No se pudo cargar la capa de datos compartida. Trabajas en modo local, sin roles ni aprobaciones.'; return; }
    if (a.guest) {
      bar.hidden = false; bar.dataset.level = ext.guest ? 'info' : 'warn';
      bar.innerHTML = ext.guest
        ? `<span>Invitado · solo lectura. No puedes editar, comentar ni aprobar.</span><a class="button" href="/cuenta/?next=/cms/">Entrar</a>`
        : `<span><b>No has iniciado sesión.</b> Entra para editar, comentar o aprobar según tu rol.</span><span class="access-actions"><a class="button lime" href="/cuenta/?next=/cms/">Entrar</a><button type="button" class="button" data-x="ui:guest">Seguir como invitado</button></span>`;
      return;
    }
    if (!a.canEdit) { bar.hidden = false; bar.dataset.level = 'info'; bar.innerHTML = `<span>Rol ${esc(ext.roleLabel())}: ${a.canApprove ? 'puedes ver, comentar y aprobar. No puedes editar.' : a.canComment ? 'puedes ver y comentar. No puedes editar.' : 'solo lectura.'}</span>`; return; }
    bar.hidden = true;
  }
  ext.applyAccess = () => {
    const a = ext.refreshAccess();
    document.body.dataset.readonly = String(!a.canEdit);
    $$('.rail [data-tab]').forEach(b => { b.hidden = !ext.tabAllowed(b.dataset.tab); });
    const pb = $('#publish-btn'); if (pb) pb.hidden = !a.canPublish;
    const cm = $('#comment-mode'); if (cm) cm.hidden = !a.canComment;
    $('#project-name').disabled = !a.canEdit; $('#export-project').hidden = !a.canEdit; $('#undo').hidden = $('#redo').hidden = !a.canEdit; $('#select-mode').hidden = false;
    $('.lang-toggle').hidden = false;
    if (!a.canComment && ext.commenting) ext.setCommenting(false);
    renderAccessBar(); renderPill(); renderSessionFallback();
    if (host.project && !ext.tabAllowed(host.currentTab)) host.setTab(a.canComment ? 'comments' : 'design');
    host.sendMode(); ext.syncRail();
    if (host.project) host.renderPanel();
  };

  // ----- registro de módulos -----
  const factories = { blk: elements, str: structure, props, ver: versions, lib: library, kit: kits, cm: comments, lang, pub: publish };
  for (const [key, mod] of Object.entries(factories)) {
    const m = mod.create(host, ext); ext.mods[key] = m;
    if (m.tab) {
      ext.tabs[m.tab.id] = [m.tab.eyebrow, m.tab.title, m.tab.desc];
      ext.panels[m.tab.id] = () => (ext.tabAllowed(m.tab.id) ? m.render() : '<div class="empty-state">Tu rol no puede abrir este panel.</div>');
    }
  }
  function buildRail() {
    for (const m of Object.values(ext.mods)) {
      if (!m.tab) continue;
      const b = document.createElement('button'); b.type = 'button'; b.dataset.tab = m.tab.id; b.setAttribute('aria-label', m.tab.label); b.setAttribute('aria-expanded', 'false');
      b.innerHTML = `${ext.icon(m.tab.icon)}${esc(m.tab.short || m.tab.label)}`;
      const ref = m.tab.before ? $(`.rail [data-tab="${m.tab.before}"]`) : $('.rail .control-link');
      (ref || $('.rail')).before(b);
    }
  }
  // ----- riel: herramientas principales visibles y el resto en el menú «Más» -----
  const MAIN_TABS = ['design', 'elements', 'text', 'media', 'style', 'structure', 'sections', 'props', 'export'];
  function buildMore() {
    const rail = $('.rail'); if (!rail || $('#rail-more')) return;
    const byTab = Object.fromEntries($$('.rail [data-tab]').map(b => [b.dataset.tab, b]));
    const links = $$('.rail a.control-link');
    for (const id of MAIN_TABS) if (byTab[id]) rail.append(byTab[id]);
    const more = document.createElement('button'); more.type = 'button'; more.id = 'rail-more'; more.className = 'rail-more';
    more.setAttribute('aria-haspopup', 'menu'); more.setAttribute('aria-expanded', 'false'); more.setAttribute('aria-controls', 'rail-more-menu'); more.setAttribute('aria-label', 'Más herramientas'); more.title = 'Más herramientas';
    more.innerHTML = `${ext.icon('more')}Más`;
    const menu = document.createElement('div'); menu.id = 'rail-more-menu'; menu.className = 'rail-menu'; menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', 'Más herramientas'); menu.hidden = true;
    rail.append(more, menu);
    const rest = Object.keys(byTab).filter(id => !MAIN_TABS.includes(id));
    const order = ['library', 'brand', 'site', 'lang', 'comments', 'versions'];
    rest.sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
    for (const id of rest) { const b = byTab[id]; b.setAttribute('role', 'menuitem'); b.classList.add('rail-item'); menu.append(b); }
    for (const a of links) { a.setAttribute('role', 'menuitem'); a.classList.add('rail-item'); a.classList.remove('rail-extra'); menu.append(a); }
    const items = () => [...menu.querySelectorAll('[role="menuitem"]')].filter(x => !x.hidden);
    const place = () => {
      const r = more.getBoundingClientRect(); const w = menu.offsetWidth; const h = menu.offsetHeight;
      if (matchMedia('(max-width:800px)').matches) { menu.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left)) + 'px'; menu.style.top = Math.max(8, r.top - h - 8) + 'px'; }
      else { menu.style.left = (r.right + 8) + 'px'; menu.style.top = Math.max(8, Math.min(innerHeight - h - 8, r.bottom - h)) + 'px'; }
    };
    const voice = () => document.querySelector('ornat-voice');
    const close = (focus = false) => { if (menu.hidden) return; menu.hidden = true; more.setAttribute('aria-expanded', 'false'); voice()?.style.removeProperty('visibility'); if (focus) more.focus(); };
    const open = (focusFirst = true) => { menu.hidden = false; more.setAttribute('aria-expanded', 'true'); voice()?.style.setProperty('visibility', 'hidden'); place(); if (focusFirst) items()[0]?.focus(); };
    more.addEventListener('click', () => (menu.hidden ? open(false) : close()));
    more.addEventListener('keydown', e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); open(); if (e.key === 'ArrowUp') items().at(-1)?.focus(); } });
    menu.addEventListener('keydown', e => {
      const list = items(); const i = list.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); close(true); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length]?.focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus(); }
      else if (e.key === 'Home') { e.preventDefault(); list[0]?.focus(); }
      else if (e.key === 'End') { e.preventDefault(); list.at(-1)?.focus(); }
      else if (e.key === 'Tab') close();
    });
    menu.addEventListener('click', () => close());
    document.addEventListener('pointerdown', e => { if (!menu.hidden && !menu.contains(e.target) && !more.contains(e.target)) close(); }, true);
    // Abierto con el ratón, el foco sigue en «Más»: Escape también lo cierra desde ahí.
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { e.preventDefault(); close(document.activeElement === more || menu.contains(document.activeElement)); } });
    addEventListener('resize', () => { if (!menu.hidden) place(); });
    ext.syncRail = () => {
      const active = [...menu.querySelectorAll('[data-tab]')].some(b => b.classList.contains('active'));
      more.classList.toggle('active', active); more.toggleAttribute('data-has-active', active);
      more.hidden = !items().length;
    };
    ext.syncRail();
  }
  ext.syncRail = () => {};
  ext.extra = (where) => Object.values(ext.mods).map(m => (m.extra?.[where] ? m.extra[where]() : '')).join('');

  // ----- delegación de eventos -----
  function route(prefix, handler) {
    return e => {
      const el = e.target instanceof Element ? e.target.closest(`[data-${prefix}]`) : null; if (!el) return;
      const raw = el.dataset[prefix]; const i = raw.indexOf(':'); const mod = ext.mods[raw.slice(0, i)];
      if (!mod || !mod[handler]) return;
      mod[handler](raw.slice(i + 1), el, e);
    };
  }
  document.addEventListener('click', e => {
    const el = e.target instanceof Element ? e.target.closest('[data-x]') : null; if (!el || el.disabled) return;
    const raw = el.dataset.x;
    if (raw === 'ui:close') { el.closest('dialog')?.close(); return; }
    if (raw === 'ui:guest') { ext.guest = true; try { sessionStorage.setItem('ornat-cms-guest', '1'); } catch { /* opcional */ } ext.applyAccess(); return; }
    route('x', 'click')(e);
  });
  document.addEventListener('input', route('xi', 'input'));
  document.addEventListener('change', e => { route('xi', 'change')(e); route('xc', 'change')(e); });
  document.addEventListener('submit', e => { const f = e.target.closest?.('form[data-xs]'); if (!f) return; e.preventDefault(); const raw = f.dataset.xs; const i = raw.indexOf(':'); ext.mods[raw.slice(0, i)]?.submit?.(raw.slice(i + 1), f, e); });

  // ----- ganchos que usa editor.js -----
  ext.onChange = key => {
    if (key !== 'project.name' && host.project) {
      const review = ext.review();
      if ((review.status === 'review' || review.status === 'approved') && ext.access.canEdit) {
        const status = review.status; ext.setReview(afterEdit(review, ext.access.user));
        ext.audit('La aprobación se reinició por una edición', `${host.project.name} · estaba ${STATUS_LABEL[status]}`);
        toast(status === 'approved' ? 'Editaste después de la aprobación: el proyecto volvió a Borrador y hay que aprobarlo de nuevo.' : 'Editaste mientras estaba en revisión: el proyecto volvió a Borrador.');
      }
    }
    for (const m of Object.values(ext.mods)) m.onChange?.(key);
  };
  ext.onProject = () => { ext.lang = 'en' === ext.lang ? 'es' : ext.lang; setLangButtons(); renderPill(); for (const m of Object.values(ext.mods)) m.onProject?.(); if (ext.commenting) ext.setCommenting(false); };
  ext.message = m => { for (const mod of Object.values(ext.mods)) mod.message?.(m); };
  ext.setLang = next => {
    ext.lang = next === 'en' ? 'en' : 'es'; setLangButtons(); host.send('lang', { lang: ext.lang });
    $('#selection-hint').textContent = ext.lang === 'en' ? 'Editando en inglés: lo que escribes se guarda como traducción. Tu texto en español no cambia.' : '';
    host.renderPanel();
  };
  function setLangButtons() { $$('.lang-toggle [data-xv]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.xv === ext.lang))); document.body.dataset.lang = ext.lang; }
  ext.sendLang = () => { if (ext.lang !== 'es') host.send('lang', { lang: ext.lang }); };
  ext.readOnlyIntro = () => `<div class="notice">${ext.access.guest ? 'Estás como invitado: solo puedes ver el proyecto.' : `Tu rol (${esc(ext.roleLabel())}) no edita el sitio.`}</div><div class="card"><h3>${esc(host.template.name)}</h3><p>${ext.access.canComment ? 'Usa «Comentar» arriba para dejar un pin en cualquier elemento. Desde «Comentarios» puedes responder, resolver y' + (ext.access.canApprove ? ' aprobar o pedir cambios.' : ' seguir el estado.') : 'Entra con una cuenta con permiso para comentar o aprobar.'}</p></div>`;

  ext.init = async () => {
    try { ext.guest = sessionStorage.getItem('ornat-cms-guest') === '1'; } catch { /* opcional */ }
    try { const m = await import('/shared/data.js'); ext.data = m.data(); ext.dataApi = m; ext.data.subscribe(topic => { if (['session', 'all', 'users'].includes(topic)) ext.applyAccess(); }); }
    catch { ext.degraded = true; }
    buildTopbar(); buildRail(); buildMore();
    for (const m of Object.values(ext.mods)) await m.init?.();
    ext.applyAccess(); setLangButtons();
    for (const k of Object.keys(ext.tabs)) host.tabs[k] = ext.tabs[k];
    Object.assign(host.panels, ext.panels);
  };
  ext.availableTransitions = () => availableTransitions(ext.review().status, ext.access.can).filter(t => !t.publish);
  return ext;
}
