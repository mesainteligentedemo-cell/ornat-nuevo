// Estilos en el DOM (los usa bridge.js): estilo por sección (patch.sectionStyles), estilo de botones (patch.buttons),
// íconos SVG reemplazables y el inventario de efectos dibujados por código (canvas/WebGL).
// Los valores ya vienen validados por core.js (listas blancas); aquí solo se vuelven a comprobar antes de tocar el DOM.
import { createSplit } from './split-dom.js';
const attr = v => String(v).replace(/["\\]/g, '\\$&');
const hexOK = v => typeof v === 'string' && /^#(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(v);
const imgOK = v => typeof v === 'string' && (/^data:image\/(?:png|jpeg|webp|avif);base64,[A-Za-z0-9+/]*={0,2}$/i.test(v) || /^https:\/\/[^\s"'<>\\()]+$/i.test(v) || /^\/(?!\/)[^\s"'<>\\()]*$/.test(v));
const rgb = h => { let x = h.slice(1); if (x.length === 3) x = [...x].map(c => c + c).join(''); return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)]; };
const toHex = c => { const m = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,/]+([\d.]+))?/.exec(c || ''); if (!m) return '#000000'; return '#' + [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join(''); };
const CSS_ID = 'cms-secstyles';

export function createStyles(ctx) {
  const { nodes, textElement } = ctx;
  const backups = new WeakMap(); // elemento → { prop: [valor, prioridad] }
  const applied = new Map(); // clave → { el, props:Set, sig }
  const setProp = (el, prop, value) => {
    let b = backups.get(el); if (!b) backups.set(el, b = {});
    if (!(prop in b)) b[prop] = [el.style.getPropertyValue(prop), el.style.getPropertyPriority(prop)];
    el.style.setProperty(prop, value, 'important');
  };
  const restoreProp = (el, prop) => {
    const b = backups.get(el); if (!b || !(prop in b)) return;
    const [v, pr] = b[prop]; if (v) el.style.setProperty(prop, v, pr); else el.style.removeProperty(prop); delete b[prop];
  };
  function ensureCss() {
    if (document.getElementById(CSS_ID)) return;
    const st = document.createElement('style'); st.id = CSS_ID;
    st.textContent = '@media (max-width:767px){.cms-hide-m{display:none!important}}@media (min-width:768px){.cms-hide-d{display:none!important}}[data-cms-removed]{display:none!important}';
    document.head.append(st);
  }
  const sectionEl = id => document.querySelector(`[data-cms-section="${attr(id)}"]`);

  // Fondos que cubren la sección entera (portadas con foto o video como capa): la superposición los oscurece también.
  function coverMedia(sec) {
    const r = sec.getBoundingClientRect(); const out = [];
    if (r.width < 10 || r.height < 10) return out;
    for (const el of sec.querySelectorAll('img,video,picture,[class*="bg"],[class*="media"],[class*="cover"],[style*="background"]')) {
      if (out.length >= 12) break;
      const e = el.getBoundingClientRect(); if (e.width < r.width * .85 || e.height < r.height * .85) continue;
      const cs = getComputedStyle(el);
      if (/^(?:IMG|VIDEO|PICTURE)$/.test(el.tagName) || cs.backgroundImage !== 'none') out.push(el.tagName === 'PICTURE' ? el.querySelector('img') || el : el);
    }
    return out;
  }
  function sectionDesired(sec, s) {
    const d = {};
    if (Number.isInteger(s.padTop)) d['padding-top'] = s.padTop + 'px';
    if (Number.isInteger(s.padBottom)) d['padding-bottom'] = s.padBottom + 'px';
    if (['left', 'center', 'right'].includes(s.align)) d['text-align'] = s.align;
    if (hexOK(s.bg)) d['background-color'] = s.bg;
    const overlay = Number.isInteger(s.overlay) && s.overlay > 0 && s.overlay <= 90 ? s.overlay / 100 : 0;
    const img = s.bgImage && imgOK(s.bgImage.src) ? s.bgImage : null;
    if (img || overlay) {
      const cs = getComputedStyle(sec); const b = backups.get(sec);
      const origImg = b && 'background-image' in b ? b['background-image'][0] || 'none' : cs.backgroundImage;
      const layers = []; const sizes = []; const pos = []; const rep = [];
      if (overlay) { layers.push(`linear-gradient(rgba(0,0,0,${overlay}),rgba(0,0,0,${overlay}))`); sizes.push('auto'); pos.push('0 0'); rep.push('no-repeat'); }
      if (img) {
        layers.push(`url(${JSON.stringify(img.src)})`); sizes.push(img.fit === 'contain' ? 'contain' : 'cover');
        pos.push(/^\d{1,3}(?:\.\d+)?% \d{1,3}(?:\.\d+)?%$/.test(img.position || '') ? img.position : '50% 50%'); rep.push('no-repeat');
      } else if (origImg && origImg !== 'none') {
        layers.push(origImg); sizes.push(b && 'background-size' in b ? b['background-size'][0] || cs.backgroundSize : cs.backgroundSize); pos.push(cs.backgroundPosition); rep.push(cs.backgroundRepeat);
      }
      d['background-image'] = layers.join(','); d['background-size'] = sizes.join(','); d['background-position'] = pos.join(','); d['background-repeat'] = rep.join(',');
    }
    return { d, overlay };
  }
  function syncProps(key, el, desired, extraSig = '') {
    const sig = JSON.stringify(desired) + extraSig; const prev = applied.get(key);
    if (prev && prev.el === el && prev.sig === sig) return false;
    if (prev) for (const p of prev.props) if (prev.el === el && !(p in desired)) restoreProp(prev.el, p);
    if (prev && prev.el !== el && prev.el.isConnected) for (const p of prev.props) restoreProp(prev.el, p);
    for (const [p, v] of Object.entries(desired)) setProp(el, p, v);
    if (Object.keys(desired).length) applied.set(key, { el, props: new Set(Object.keys(desired)), sig }); else applied.delete(key);
    return true;
  }
  const overlayTargets = new Map(); // id de sección → elementos oscurecidos con filter
  function applySectionStyles(map) {
    let changed = false; ensureCss();
    const keys = new Set([...Object.keys(map), ...[...applied.keys()].filter(k => k.startsWith('s:')).map(k => k.slice(2))]);
    for (const id of keys) {
      const sec = sectionEl(id); const s = map[id];
      if (!sec) continue;
      const { d, overlay } = s ? sectionDesired(sec, s) : { d: {}, overlay: 0 };
      if (syncProps('s:' + id, sec, d)) changed = true;
      sec.classList.toggle('cms-hide-m', !!s?.hideMobile); sec.classList.toggle('cms-hide-d', !!s?.hideDesktop);
      // superposición sobre las capas de foto o video
      const prevT = overlayTargets.get(id) || [];
      for (const m of prevT) if (!overlay || !sec.contains(m)) restoreProp(m, 'filter');
      if (overlay) {
        const targets = prevT.length && prevT.every(m => sec.contains(m)) ? prevT : coverMedia(sec);
        for (const m of targets) { const b = backups.get(m); const base = b && 'filter' in b ? b.filter[0] : (m.style.filter || ''); setProp(m, 'filter', `${base} brightness(${(1 - overlay).toFixed(2)})`.trim()); }
        overlayTargets.set(id, targets);
      } else overlayTargets.delete(id);
    }
    return changed;
  }

  // ---------- botones ----------
  function buttonDesired(s) {
    const d = {}; const solid = s.variant !== 'outline';
    if (s.variant === 'outline') { d['background-color'] = 'transparent'; d['background-image'] = 'none'; d['border-style'] = 'solid'; d['border-width'] = '2px'; d['border-color'] = hexOK(s.border) ? s.border : hexOK(s.color) ? s.color : 'currentColor'; }
    else {
      if (hexOK(s.bg)) { d['background-color'] = s.bg; d['background-image'] = 'none'; }
      if (hexOK(s.border)) { d['border-style'] = 'solid'; d['border-width'] = '2px'; d['border-color'] = s.border; }
    }
    if (hexOK(s.color)) d.color = s.color;
    if (Number.isInteger(s.radius)) d['border-radius'] = s.radius + 'px';
    void solid;
    return d;
  }
  function applyButtons(map) {
    let changed = false;
    const keys = new Set([...Object.keys(map), ...[...applied.keys()].filter(k => k.startsWith('b:')).map(k => k.slice(2))]);
    for (const id of keys) {
      const node = nodes.get(id); const el = node && textElement(node); if (!el?.isConnected) continue;
      if (syncProps('b:' + id, el, map[id] ? buttonDesired(map[id]) : {})) changed = true;
    }
    return changed;
  }
  function ctlId(ctl) {
    let id = ctl.dataset.cmsId;
    if (!id) {
      // El id depende de la etiqueta, el texto y la sección (no del lugar en el documento): sigue igual aunque la plantilla
      // construya otras partes de la página más tarde o más temprano, y no cuenta lo que añaden las copias.
      const root = ctl.closest('[data-cms-sclone],[data-cms-iclone]');
      const cloneId = root ? (root.getAttribute('data-cms-sclone') || root.getAttribute('data-cms-iclone')) : '';
      const text = (ctl.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
      const sec = ctl.closest('[data-cms-section]')?.dataset.cmsSection || '';
      const same = [...(root || document).querySelectorAll(ctl.localName)].filter(e => (root || !e.closest('[data-cms-sclone],[data-cms-iclone],[data-cms-block]')) && ((e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) === text) && (e.closest('[data-cms-section]')?.dataset.cmsSection || '') === sec);
      id = 'ctl-' + ctx.fnv(ctl.localName + '|' + text + '|' + sec.split('~')[0] + '|' + same.indexOf(ctl)) + (cloneId ? '~' + cloneId : '');
      ctl.dataset.cmsId = id; nodes.set(id, ctl);
    } else if (!nodes.has(id)) nodes.set(id, ctl);
    return id;
  }
  // Todos los botones y enlaces tienen id desde que carga la plantilla: su estilo vuelve a aplicarse al reabrir el proyecto.
  function scanControls() {
    let n = 0;
    for (const el of document.querySelectorAll('a,button')) {
      if (n++ > 400) break;
      if (el.closest('[data-cms-editor],svg,[data-cms-removed]') || !(el.textContent || '').trim()) continue;
      ctlId(el);
    }
  }
  function controlInfo(ctl) {
    const id = ctlId(ctl);
    const cs = getComputedStyle(ctl); const r = parseFloat(cs.borderTopLeftRadius) || 0;
    const bg = /rgba?\(/.test(cs.backgroundColor) && !/rgba\(.*,\s*0\)$/.test(cs.backgroundColor) && cs.backgroundColor !== 'transparent';
    return { id, tag: ctl.localName, bg: bg ? toHex(cs.backgroundColor) : '', color: toHex(cs.color), border: parseFloat(cs.borderTopWidth) > 0 ? toHex(cs.borderTopColor) : '', radius: Math.round(r), filled: bg };
  }

  // ---------- íconos SVG ----------
  function scanIcons({ images, register, index, sectionOf }) {
    let n = 0;
    for (const el of document.querySelectorAll('svg')) {
      if (n >= 120) break;
      if (el.parentElement?.closest('svg') || el.closest('[data-cms-editor],[data-cms-block],canvas,[data-cms-removed]')) continue;
      const id0 = el.dataset.cmsId; if (id0 && /^logo-/.test(id0)) continue;
      const r = el.getBoundingClientRect(); if (r.width < 8 || r.height < 8 || r.width > 260 || r.height > 260) continue;
      if (!el.querySelector('use,path,circle,rect,line,polyline,polygon,ellipse,image')) continue;
      if (el.closest('.loader,.preloader')) continue;
      const i = index(el); const id = register(el, 'icon', i); n++;
      images.push({ id, kind: 'icon', src: '', alt: el.getAttribute('aria-label') || '', width: Math.round(r.width), height: Math.round(r.height), naturalWidth: 0, naturalHeight: 0, ratio: r.height ? r.width / r.height : 1, section: sectionOf(el) });
    }
  }

  // ---------- efectos dibujados por código ----------
  function scanEffects({ sequences, sectionOf }) {
    const out = [];
    const tex = window.ornatCmsTextures?.slots;
    const seqEditable = (sequences || []).filter(s => s.editable);
    for (const el of document.querySelectorAll('canvas')) {
      if (el.closest('[data-cms-editor],[data-cms-block]')) continue;
      const loft = seqEditable.length && el.id === 'seq';
      out.push({ id: el.dataset.cmsId || '', label: loft ? 'Recorrido por fotogramas' : (el.getAttribute('aria-label') || el.id || 'Efecto de lienzo'), section: sectionOf(el), editable: !!loft, kind: 'canvas', note: loft ? 'Puedes reemplazar los 300 fotogramas desde Imágenes → Secuencia.' : 'Dibujado por código (partículas, mapa, constelación…). Su forma y su movimiento los define la plantilla: no se editan como diseño.' });
    }
    if (Array.isArray(tex) && tex.length) out.push({ id: 'textures', label: 'Escena 3D (texturas)', section: 'general', editable: true, kind: 'webgl', note: `La geometría y el movimiento son código; sí puedes reemplazar ${tex.length} texturas desde Imágenes.` });
    return out;
  }

  function applyAll(patch, last) {
    let changed = false;
    if (patch.sectionStyles || last?.sectionStyles || [...applied.keys()].some(k => k[0] === 's')) changed = applySectionStyles(patch.sectionStyles || {}) || changed;
    if (patch.buttons || last?.buttons || [...applied.keys()].some(k => k[0] === 'b')) changed = applyButtons(patch.buttons || {}) || changed;
    return changed;
  }
  const split = createSplit();
  return { split, applyAll, controlInfo, scanControls, scanIcons, scanEffects, hexOK };
}
