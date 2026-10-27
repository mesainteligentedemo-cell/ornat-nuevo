// Estructura de la plantilla en el DOM (la usa bridge.js): secciones propias y elementos repetidos.
// - Detecta listas de elementos equivalentes (tarjetas, menús, galerías…) y les da ids estables (data-cms-list / data-cms-item).
// - Aplica patch.layout (duplicar, quitar, reordenar secciones) y patch.items (lo mismo para elementos repetidos).
// - Las copias son nodos reales con ids propios (texto, imagen, enlace… se editan por separado) y nunca tocan los scripts de la plantilla.
// Todo es idempotente: aplicar dos veces el mismo patch no cambia nada la segunda vez.
import { baseId, rebaseId, sectionCloneId, itemCloneId, defaultSequence, resolveSequence, sameSequence } from './layout.js';

const SECTION_SEL = 'section,header,footer,main,nav';
const STATE_CLASS = /^(?:is-|has-|js-|swiper-slide-|splide__slide--|slick-|active$|current$|open$|on$|in$|show$|visible$|selected$|hover$|focus$|loaded$|ready$|animate$|animated$|revealed$|inview$|in-view$|aos-|gsap|mounted$|lenis|cms-)/i;
const ITEM_TAGS = new Set(['li', 'a', 'div', 'article', 'figure', 'details', 'blockquote', 'button', 'span', 'img', 'picture', 'dl', 'section']);
const NO_CONTAINER = new Set(['html', 'body', 'head', 'svg', 'select', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'label', 'button', 'a', 'span', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'picture', 'canvas', 'video', 'iframe', 'form', 'textarea']);
const attr = v => String(v).replace(/["\\]/g, '\\$&');
const GSAP_PROPS = ['opacity', 'visibility', 'filter', 'clip-path', 'transform', 'translate', 'scale', 'rotate'];

export function createStructure(ctx) {
  const { nodes, originals, fragmentIds, blockIds, logoIds } = ctx;
  const bySection = id => document.querySelector(`[data-cms-section="${attr(id)}"]`);
  const byList = id => document.querySelector(`[data-cms-list="${attr(id)}"]`);
  const byItem = id => document.querySelector(`[data-cms-item="${attr(id)}"]`);
  const watchers = new Map(); // copia → MutationObserver que le pasa las clases de «aparecer» de su original
  const listCache = new Map();
  const groupIds = new Map();
  const touched = new Set(); // ids de secciones y elementos que ya recolocamos nosotros

  // ---------- bloqueos (por qué algo no se puede mover o duplicar) ----------
  function pins() { try { return (window.ScrollTrigger?.getAll?.() || []).map(st => st.pin).filter(Boolean); } catch { return []; } }
  function positionOf(el) {
    for (let a = el; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      const p = getComputedStyle(a).position;
      if (p === 'fixed' || p === 'sticky') return 'sticky';
      if (a === el && p === 'absolute') return 'abs';
    }
    return '';
  }
  const REASON = {
    pin: 'Está anclada (pin) al scroll: su animación depende de su posición exacta.',
    sticky: 'Se queda fija al desplazarse (sticky o fixed): moverla o copiarla rompería el efecto.',
    abs: 'Está colocada de forma absoluta sobre otras capas, así que su posición no depende del orden.',
    virtual: 'Esta plantilla desplaza todo el contenido con un scroll virtual: mover secciones lo descuadraría.',
    gsap: 'Una animación de la plantilla controla el movimiento de esta sección.',
    neg: 'Se superpone a propósito con la sección vecina (margen negativo).',
    scroll: 'Una librería de scroll de la plantilla (data-scroll) depende de su posición.',
    canvas: 'Contiene un efecto dibujado por código (canvas o WebGL) que no se puede copiar.',
    nav: 'El menú principal es único: edita sus enlaces desde «Menú».',
    single: 'Es la única sección de su grupo: no hay con quién cambiarla de lugar.',
    marquee: 'Es una cinta en movimiento continuo: copiar o mover sus elementos rompería el bucle.',
    stacked: 'Los elementos están apilados en el mismo lugar (capas o carrusel): copiarlos o moverlos no cambiaría lo que se ve.'
  };
  function moveLock(el, groupSize) {
    const vs = ctx.findVirtualScroller(); if (vs && (vs === el || vs.contains(el))) return 'virtual';
    if (groupSize < 2) return 'single';
    if (el.closest('.pin-spacer')) return 'pin';
    const ps = pins(); if (ps.some(p => p === el || el.contains(p) || p.contains(el))) return 'pin';
    const pos = positionOf(el); if (pos) return pos;
    if (el.closest('[data-scroll-container],[data-scroll-section],[data-scroll]')) return 'scroll';
    const g = el._gsap; if (g && (Math.abs(g.x || 0) > 1 || Math.abs(g.y || 0) > 1 || Math.abs(g.xPercent || 0) > 1 || Math.abs(g.yPercent || 0) > 1 || Math.abs(g.rotation || 0) > .5)) return 'gsap';
    const cs = getComputedStyle(el); const nx = el.nextElementSibling; const nxs = nx ? getComputedStyle(nx) : null;
    if (parseFloat(cs.marginTop) < -1 || parseFloat(cs.marginBottom) < -1 || (nxs && parseFloat(nxs.marginTop) < -1)) return 'neg';
    return '';
  }
  function dupLock(el) {
    if (el.localName === 'nav') return 'nav';
    if (el.closest('.pin-spacer')) return 'pin';
    const ps = pins(); if (ps.some(p => p === el || el.contains(p) || p.contains(el))) return 'pin';
    const pos = positionOf(el); if (pos) return pos;
    if (el.querySelector('canvas')) return 'canvas';
    return '';
  }
  const text = key => (key ? REASON[key] : '');

  // ---------- secciones ----------
  const isEligible = el => el.hasAttribute('data-cms-section') && !el.closest('[data-cms-block],[data-cms-editor]') && !el.querySelector(SECTION_SEL);
  function groupOf(parent) { let id = groupIds.get(parent); if (!id) { id = 'g' + (groupIds.size + 1); groupIds.set(parent, id); } return id; }
  function idsIn(root) {
    const out = [];
    for (const e of [root, ...root.querySelectorAll('*')]) { const id = e.dataset?.cmsId; if (id) out.push(id); const b = blockIds.get(e); if (b) out.push(b); }
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) { const f = fragmentIds.get(n); if (f) out.push(f); }
    return [...new Set(out)].slice(0, 400);
  }
  function sectionMembers(parent) { return [...parent.children].filter(c => c.nodeType === 1 && isEligible(c)); }
  function scanSections(sections) {
    const byParent = new Map();
    for (const s of sections) {
      const el = bySection(s.id); if (!el || !isEligible(el) || !el.parentElement) continue;
      if (!byParent.has(el.parentElement)) byParent.set(el.parentElement, []);
    }
    for (const parent of byParent.keys()) {
      const members = sectionMembers(parent);
      let max = -1; for (const m of members) { const v = m.getAttribute('data-cms-oi'); if (v !== null && Number(v) > max) max = Number(v); }
      for (const m of members) if (!m.hasAttribute('data-cms-oi') && !m.hasAttribute('data-cms-sclone')) m.setAttribute('data-cms-oi', String(++max));
    }
    for (const s of sections) {
      const el = bySection(s.id); const parent = el?.parentElement;
      if (!el || !isEligible(el) || !parent) { s.layout = { eligible: false }; continue; }
      const members = sectionMembers(parent); const move = text(moveLock(el, members.length)); const dup = text(dupLock(el));
      const cloneId = el.getAttribute('data-cms-sclone');
      const cs = getComputedStyle(el); const look = { pt: Math.round(parseFloat(cs.paddingTop) || 0), pb: Math.round(parseFloat(cs.paddingBottom) || 0), bg: /rgba?\(/.test(cs.backgroundColor) ? '#' + (cs.backgroundColor.match(/\d+/g) || [255, 255, 255]).slice(0, 3).map(n => Number(n).toString(16).padStart(2, '0')).join('') : '#ffffff' };
      s.layout = { eligible: true, look, group: groupOf(parent), pos: members.indexOf(el), size: members.length, canMove: !move, moveReason: move, canDup: !dup, dupReason: dup, clone: cloneId || null, of: cloneId ? baseId(s.id) : null, removed: el.hasAttribute('data-cms-removed'), ids: idsIn(el) };
    }
  }

  // ---------- listas de elementos repetidos ----------
  const classKey = el => {
    const cls = [...el.classList].filter(c => !STATE_CLASS.test(c)).sort().slice(0, 4).join('.');
    return el.localName + '.' + cls + (cls ? '' : '>' + [...el.children].slice(0, 6).map(c => c.localName).join(','));
  };
  const meaningful = el => !!(el.textContent || '').trim() || !!el.querySelector('img,picture,video,svg,canvas') || /^(?:img|picture)$/.test(el.localName);
  function candidate(el) {
    if (el.nodeType !== 1 || !ITEM_TAGS.has(el.localName)) return false;
    if (el.hasAttribute('data-cms-block') || el.hasAttribute('aria-hidden') && el.getAttribute('aria-hidden') === 'true') return false;
    if (el.hasAttribute('data-cms-section') || el.querySelector(SECTION_SEL) || el.querySelector('[data-cms-block]')) return false;
    if (el.localName === 'span' && !el.querySelector('a,img,picture')) return false;
    return meaningful(el);
  }
  function pathKey(el) {
    const parts = [];
    for (let cur = el; cur && cur !== document.body && cur.parentElement; cur = cur.parentElement) {
      if (cur !== el && cur.dataset?.cmsSection) { parts.push('#' + baseId(cur.dataset.cmsSection)); break; }
      const sibs = [...cur.parentElement.children].filter(c => !c.hasAttribute('data-cms-block') && !c.hasAttribute('data-cms-sclone') && !c.hasAttribute('data-cms-iclone'));
      parts.push(cur.localName + sibs.indexOf(cur));
      if (parts.length > 14) break;
    }
    return parts.reverse().join('>');
  }
  function labelKind(container, items) {
    if (container.closest('footer')) return ['footer', 'Pie de página'];
    if (container.closest('nav,header')) return ['menu', 'Menú'];
    const first = items[0];
    const onlyImg = items.every(i => /^(?:img|picture|figure)$/.test(i.localName) || (!(i.textContent || '').trim() && i.querySelector('img,picture')));
    if (onlyImg) return ['gallery', 'Galería'];
    const sig = (container.className + ' ' + first.className).toLowerCase();
    if (first.localName === 'details' || /faq|accordion|pregunta/.test(sig)) return ['faq', 'Preguntas'];
    if (first.querySelector('blockquote') || first.localName === 'blockquote' || /testimon|quote|review|opini/.test(sig)) return ['testimonials', 'Testimonios'];
    if (items.every(i => !(i.textContent || '').trim() && i.querySelector('svg,img'))) return ['logos', 'Logos'];
    if (first.localName === 'a' && !first.querySelector('img,picture') && items.every(i => (i.textContent || '').trim().length < 40)) return ['links', 'Enlaces'];
    if (/step|paso|process|proceso/.test(sig)) return ['steps', 'Pasos'];
    return ['cards', 'Tarjetas'];
  }
  function itemLabel(el, i) {
    const h = el.querySelector('h1,h2,h3,h4,h5,h6,strong,b,figcaption,summary') || el;
    let t = (h.textContent || '').replace(/\s+/g, ' ').trim();
    if (!t) { const img = el.matches('img') ? el : el.querySelector('img'); t = img?.alt || (img ? `Imagen ${i + 1}` : `Elemento ${i + 1}`); }
    return t.slice(0, 44);
  }
  function listCaps(container, items) {
    const caps = { add: true, remove: true, move: true, reason: '' };
    const lock = key => { caps.add = caps.remove = caps.move = false; caps.reason = text(key); };
    for (let a = container; a && a !== document.body; a = a.parentElement) {
      try { const cs = getComputedStyle(a); if (cs.animationName !== 'none' && cs.animationIterationCount === 'infinite') { lock('marquee'); return caps; } } catch { /* sin estilos */ }
    }
    if (container.querySelector(':scope > [aria-hidden="true"]') && container.children.length > items.length * 1.5) { lock('marquee'); return caps; }
    const first = items.find(i => !i.hasAttribute('data-cms-removed')) || items[0];
    if (first) {
      const pos = getComputedStyle(first).position;
      if (pos === 'absolute' || pos === 'fixed') { caps.add = false; caps.move = false; caps.reason = text('stacked'); }
      else if (pos === 'sticky') { caps.move = false; caps.reason = text('sticky'); }
    }
    return caps;
  }
  function scanLists() {
    listCache.clear();
    const found = [];
    if (!document.body) return found;
    const all = document.body.querySelectorAll('*');
    for (const container of all) {
      if (found.length >= 80) break;
      if (container.childElementCount < 2 || NO_CONTAINER.has(container.localName)) continue;
      if (container.closest('[data-cms-block],[data-cms-editor],svg,canvas,[aria-hidden="true"],[data-ornat-form],form,ornat-catalog')) continue;
      const kids = [...container.children];
      let key = ''; let members;
      const own = container.dataset.cmsList;
      if (own) {
        const ref = kids.find(k => k.dataset.cmsItem); if (!ref) continue;
        key = classKey(ref);
        members = kids.filter(k => k.dataset.cmsItem || (candidate(k) && classKey(k) === key));
      } else {
        const groups = new Map();
        for (const k of kids) { if (!candidate(k)) continue; const kk = classKey(k); (groups.get(kk) || groups.set(kk, []).get(kk)).push(k); }
        let best = null; for (const [kk, arr] of groups) if (arr.length >= 2 && (!best || arr.length > best[1].length)) best = [kk, arr];
        if (!best) continue;
        [key, members] = best;
        if (members.length > 60) continue;
      }
      let id = own;
      if (!id) {
        id = 'li-' + ctx.fnv(pathKey(container) + '|' + key).slice(0, 7);
        while (byList(id) && byList(id) !== container) id += 'x';
        container.dataset.cmsList = id;
      }
      let max = -1; for (const m of members) { if (!m.dataset.cmsItem) continue; const n = Number(m.dataset.cmsItem.split(':').pop()); if (Number.isInteger(n) && n > max) max = n; }
      for (const m of members) if (!m.dataset.cmsItem) m.dataset.cmsItem = `${id}:${++max}`;
      found.push({ id, container, items: members });
    }
    return found;
  }
  function describeLists(found, sectionName) {
    const out = [];
    for (const { id, container, items } of found) {
      const caps = listCaps(container, items);
      const [kind, kindLabel] = labelKind(container, items.filter(i => !i.hasAttribute('data-cms-removed')).length ? items.filter(i => !i.hasAttribute('data-cms-removed')) : items);
      let axis = 'y';
      const vis = items.filter(i => i.getClientRects().length);
      if (vis.length > 1) { const a = vis[0].getBoundingClientRect(), b = vis[1].getBoundingClientRect(); axis = Math.abs(a.top - b.top) < Math.min(a.height, b.height) * .5 ? 'x' : 'y'; }
      const secEl = container.closest('[data-cms-section]'); const sec = secEl?.dataset.cmsSection || 'general';
      const entry = { id, kind, label: `${kindLabel}`, section: sec, sectionLabel: sectionName(sec), axis, caps, count: items.length, items: items.map((el, i) => ({ id: el.dataset.cmsItem, index: i, clone: el.getAttribute('data-cms-iclone') || null, removed: el.hasAttribute('data-cms-removed'), label: itemLabel(el, i), ids: idsIn(el), thumb: (el.matches('img') ? el : el.querySelector('img'))?.currentSrc || '' })) };
      listCache.set(id, entry); out.push(entry);
    }
    return out;
  }

  // ---------- copiar ----------
  function cloneTree(src, cloneId) {
    const copy = src.cloneNode(true);
    const s = [src, ...src.querySelectorAll('*')]; const d = [copy, ...copy.querySelectorAll('*')];
    const domIds = new Map(); const drop = [];
    for (let i = 0; i < s.length && i < d.length; i++) {
      const a = s[i], b = d[i];
      if (i && (b.hasAttribute('data-cms-sclone') || b.hasAttribute('data-cms-iclone'))) { drop.push(b); continue; }
      for (const name of ['data-cms-selected', 'data-cms-editing', 'data-cms-hidden', 'data-cms-removed', 'data-cms-dragging-block', 'data-cms-oi']) b.removeAttribute(name);
      if (a.hasAttribute('data-cms-editing')) b.removeAttribute('contenteditable');
      const id = a.dataset?.cmsId;
      if (id) {
        const nid = rebaseId(id, cloneId); b.dataset.cmsId = nid; nodes.set(nid, b);
        if (originals.has(id)) originals.set(nid, originals.get(id));
        if (logoIds.has(id)) logoIds.add(nid);
      }
      if (a.dataset?.cmsSection) b.dataset.cmsSection = rebaseId(a.dataset.cmsSection, cloneId);
      if (a.dataset?.cmsList) b.dataset.cmsList = rebaseId(a.dataset.cmsList, cloneId);
      if (a.dataset?.cmsItem) { const v = a.dataset.cmsItem; const k = v.lastIndexOf(':'); b.dataset.cmsItem = rebaseId(v.slice(0, k), cloneId) + ':' + v.slice(k + 1); }
      const bid = blockIds.get(a); if (bid) { const nb = rebaseId(bid, cloneId); blockIds.set(b, nb); nodes.set(nb, b); }
      if (a.id) { const nid = `${a.id}-${cloneId}`; domIds.set(a.id, nid); b.id = nid; }
    }
    for (const b of drop) b.remove();
    const ws = document.createTreeWalker(src, NodeFilter.SHOW_TEXT); const wd = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
    let sn; let dn;
    while ((sn = ws.nextNode()) && (dn = wd.nextNode())) {
      const f = fragmentIds.get(sn); if (!f) continue;
      const nf = rebaseId(f, cloneId); fragmentIds.set(dn, nf); nodes.set(nf, dn); originals.set(nf, { text: originals.get(f)?.text ?? dn.nodeValue });
    }
    if (domIds.size) {
      for (const b of [copy, ...copy.querySelectorAll('*')]) {
        for (const name of ['for', 'aria-labelledby', 'aria-controls', 'aria-describedby', 'aria-owns', 'aria-activedescendant', 'headers', 'list']) {
          const v = b.getAttribute(name); if (v) b.setAttribute(name, v.split(/\s+/).map(t => domIds.get(t) || t).join(' '));
        }
        for (const name of ['href', 'xlink:href']) { const v = b.getAttribute(name); if (v && v[0] === '#' && domIds.has(v.slice(1))) b.setAttribute(name, '#' + domIds.get(v.slice(1))); }
        for (const name of b.getAttributeNames()) {
          const v = b.getAttribute(name);
          if (v && v.includes('url(#')) b.setAttribute(name, v.replace(/url\(#([^)\s'"]+)\)/g, (m, id) => (domIds.has(id) ? `url(#${domIds.get(id)})` : m)));
        }
      }
    }
    return copy;
  }
  // La copia se ve como se verá ya terminada su entrada: sin el estado «aún no ha aparecido» que dejó la plantilla en su original.
  function settleClone(src, copy) {
    const s = [src, ...src.querySelectorAll('*')]; const d = [copy, ...copy.querySelectorAll('*')];
    for (let i = 0; i < s.length && i < d.length; i++) {
      const a = s[i], b = d[i]; if (!b.style) continue;
      const inline = b.getAttribute('style') || '';
      if (a._gsap || /opacity\s*:\s*0(?![.\d])|visibility\s*:\s*hidden/.test(inline)) {
        const op = parseFloat(b.style.opacity);
        if (b.style.visibility === 'hidden' || (Number.isFinite(op) && op < .05)) for (const p of GSAP_PROPS) b.style.removeProperty(p);
      }
    }
    const map = new Map(); s.forEach((e, i) => { if (d[i]) map.set(e, d[i]); });
    const obs = new MutationObserver(records => {
      for (const r of records) {
        const mine = map.get(r.target); if (!mine?.isConnected) continue;
        const old = new Set((r.oldValue || '').split(/\s+/).filter(Boolean));
        const added = [...r.target.classList].filter(c => !old.has(c) && !mine.classList.contains(c)); if (!added.length) continue;
        const before = parseFloat(getComputedStyle(mine).opacity); if (!(before < .02)) continue;
        mine.classList.add(...added);
        if (!(parseFloat(getComputedStyle(mine).opacity) > before + .02)) mine.classList.remove(...added);
      }
    });
    obs.observe(src, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
    watchers.set(copy, obs);
  }
  function dropTree(el) {
    for (const e of [el, ...el.querySelectorAll('*')]) { watchers.get(e)?.disconnect(); watchers.delete(e); }
    for (const [id, node] of [...nodes]) { const e = node?.nodeType === 3 ? node.parentElement : node; if (e && (e === el || el.contains(e))) nodes.delete(id); }
    el.remove();
  }
  // Coloca `want` (ids, en el orden deseado) en los lugares que ocupan hoy los elementos de `cur`.
  function placeSequence(cur, want) {
    const diff = []; cur.forEach((e, i) => { if (want[i] !== e) diff.push(i); });
    if (!diff.length) return false;
    const holders = diff.map(i => { const c = document.createComment('cms'); cur[i].before(c); return c; });
    diff.forEach(i => cur[i].remove());
    diff.forEach((i, k) => holders[k].replaceWith(want[i]));
    return true;
  }

  // ---------- aplicar patch.layout y patch.items ----------
  function applyStructure(patch) {
    const layout = patch.layout || {}; const items = patch.items || {};
    let changed = false;
    if (!ctx.settled()) return false; // las ids de lo que la plantilla construye tarde se asignan al terminar de cargar: igual que al editar
    if (!listCache.size && Object.keys(items).length) ctx.scan();
    const missingClone = (layout.clones || []).some(c => !bySection(sectionCloneId(c))) || Object.entries(items).some(([lid, spec]) => (spec.clones || []).some(c => !byItem(itemCloneId(lid, c))));
    if (missingClone) ctx.scan();
    // 1. copias de sección
    const wantedS = new Set();
    for (const c of layout.clones || []) {
      const full = sectionCloneId(c); wantedS.add(full);
      if (bySection(full)) continue;
      const src = bySection(c.of); if (!src || !isEligible(src) || dupLock(src)) continue;
      const copy = cloneTree(src, c.id); copy.setAttribute('data-cms-sclone', c.id); copy.dataset.cmsSection = full;
      const anchor = (c.after && c.after !== c.of && bySection(c.after)) || src; anchor.after(copy);
      settleClone(src, copy); changed = true;
    }
    for (const e of [...document.querySelectorAll('[data-cms-sclone]')]) if (!wantedS.has(e.dataset.cmsSection)) { dropTree(e); changed = true; }
    // 2. copias de elementos repetidos
    if (missingClone) ctx.scan();
    const wantedI = new Set();
    for (const [lid, spec] of Object.entries(items)) {
      const container = byList(lid); if (!container) { for (const c of spec.clones || []) wantedI.add(itemCloneId(lid, c)); continue; }
      for (const c of spec.clones || []) {
        const full = itemCloneId(lid, c); wantedI.add(full);
        if (byItem(full)) continue;
        const src = byItem(c.of); if (!src || src.parentElement !== container) continue;
        const info = listCache.get(lid); if (info && !info.caps.add) continue;
        const copy = cloneTree(src, c.id); copy.setAttribute('data-cms-iclone', c.id); copy.dataset.cmsItem = full;
        src.after(copy); settleClone(src, copy); changed = true;
      }
    }
    for (const e of [...document.querySelectorAll('[data-cms-iclone]')]) if (!wantedI.has(e.dataset.cmsItem)) { dropTree(e); changed = true; }
    // 3. quitadas
    const removedS = new Set(layout.removed || []); const removedI = new Set(); for (const spec of Object.values(items)) for (const id of spec.removed || []) removedI.add(id);
    for (const e of [...document.querySelectorAll('[data-cms-removed]')]) {
      const keep = (e.dataset.cmsSection && isEligible(e) && removedS.has(e.dataset.cmsSection)) || (e.dataset.cmsItem && removedI.has(e.dataset.cmsItem));
      if (!keep) { e.removeAttribute('data-cms-removed'); changed = true; }
    }
    for (const id of removedS) { const e = bySection(id); if (e && isEligible(e) && !e.hasAttribute('data-cms-removed')) { e.setAttribute('data-cms-removed', ''); changed = true; } }
    for (const id of removedI) { const e = byItem(id); if (e && !e.hasAttribute('data-cms-removed') && (listCache.get(id.slice(0, id.lastIndexOf(':')))?.caps.remove ?? true)) { e.setAttribute('data-cms-removed', ''); changed = true; } }
    // 4. orden de secciones: solo se recolocan las que el patch menciona (o que ya movimos antes); lo demás lo organiza la plantilla.
    const parents = new Set(); for (const e of document.querySelectorAll('[data-cms-section]')) if (isEligible(e) && e.parentElement) parents.add(e.parentElement);
    for (const parent of parents) {
      const members = sectionMembers(parent); if (members.length < 2) continue;
      const byId = new Map(members.map(m => [m.dataset.cmsSection, m]));
      const locked = new Set(members.filter(m => moveLock(m, members.length)).map(m => m.dataset.cmsSection));
      const listed = (layout.order || []).filter(id => byId.has(id) && !locked.has(id));
      const touchedHere = [...touched].filter(id => byId.has(id) && !locked.has(id));
      const A = new Set([...listed, ...touchedHere]); if (A.size < 2) continue;
      const originalsList = members.filter(m => !m.hasAttribute('data-cms-sclone')).sort((x, y) => Number(x.getAttribute('data-cms-oi') ?? 1e9) - Number(y.getAttribute('data-cms-oi') ?? 1e9)).map(m => m.dataset.cmsSection);
      const def = defaultSequence(originalsList, (layout.clones || []).map(c => ({ id: sectionCloneId(c), of: c.of })).filter(c => byId.has(c.id)));
      for (const m of members) if (!def.includes(m.dataset.cmsSection)) def.push(m.dataset.cmsSection);
      const resolved = resolveSequence(def.filter(id => A.has(id)), listed);
      const curA = members.filter(m => A.has(m.dataset.cmsSection));
      if (!sameSequence(curA.map(m => m.dataset.cmsSection), resolved) && placeSequence(curA, resolved.map(id => byId.get(id)))) changed = true;
      for (const id of resolved) touched.add(id);
    }
    // 5. orden de elementos repetidos
    for (const info of [...listCache.values()]) {
      const container = byList(info.id); if (!container) continue;
      const spec = items[info.id] || {};
      if (info.caps && !info.caps.move) continue;
      const members = [...container.children].filter(k => k.dataset?.cmsItem);
      if (members.length < 2) continue;
      const byId = new Map(members.map(m => [m.dataset.cmsItem, m]));
      const listed = (spec.order || []).filter(id => byId.has(id));
      const A = new Set([...listed, ...[...touched].filter(id => byId.has(id))]); if (A.size < 2) continue;
      const originalsList = members.filter(m => !m.hasAttribute('data-cms-iclone')).sort((x, y) => Number(x.dataset.cmsItem.split(':').pop()) - Number(y.dataset.cmsItem.split(':').pop())).map(m => m.dataset.cmsItem);
      const def = defaultSequence(originalsList, (spec.clones || []).map(c => ({ id: itemCloneId(info.id, c), of: c.of })).filter(c => byId.has(c.id)));
      for (const m of members) if (!def.includes(m.dataset.cmsItem)) def.push(m.dataset.cmsItem);
      const resolved = resolveSequence(def.filter(id => A.has(id)), listed);
      const curA = members.filter(m => A.has(m.dataset.cmsItem));
      if (!sameSequence(curA.map(m => m.dataset.cmsItem), resolved) && placeSequence(curA, resolved.map(id => byId.get(id)))) changed = true;
      for (const id of resolved) touched.add(id);
    }
    return changed;
  }

  // Para la barra flotante: el elemento repetido que contiene `el`.
  function itemFor(el) {
    const item = el?.closest?.('[data-cms-item]'); const container = item?.parentElement;
    if (!item || !container?.dataset.cmsList) return null;
    const info = listCache.get(container.dataset.cmsList); if (!info) return null;
    const members = info.items; const idx = members.findIndex(m => m.id === item.dataset.cmsItem);
    return { listId: info.id, itemId: item.dataset.cmsItem, index: idx, count: members.length, label: info.label, kind: info.kind, axis: info.axis, caps: info.caps, clone: item.getAttribute('data-cms-iclone') || null };
  }
  function sectionFor(el) {
    const sec = el?.closest?.('[data-cms-section]'); if (!sec || !isEligible(sec) || !sec.parentElement) return null;
    const members = sectionMembers(sec.parentElement); const lock = text(moveLock(sec, members.length)); const dup = text(dupLock(sec));
    return { id: sec.dataset.cmsSection, group: groupOf(sec.parentElement), canMove: !lock, moveReason: lock, canDup: !dup, dupReason: dup, clone: sec.getAttribute('data-cms-sclone') || null };
  }

  return { scanSections, scanLists, describeLists, applyStructure, itemFor, sectionFor, idsIn, isEligible, bySection, byItem, byList, cloneTree, settleClone, dropTree, REASON };
}
