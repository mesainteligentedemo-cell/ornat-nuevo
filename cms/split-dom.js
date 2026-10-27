// Títulos animados partidos en letras o palabras (split de la plantilla): reescribir el texto completo sin perder la división.
// En vez de juntar todo el texto en una sola pieza, se reconstruyen las piezas con la misma estructura (mismas etiquetas, clases
// y estilos que las originales) y se reasignan a las animaciones de GSAP que apuntaban a las piezas viejas.
// Si la estructura no es una división regular (texto suelto en elementos mixtos, varios niveles raros…) devuelve null y el
// bridge conserva el comportamiento anterior (una sola pieza, con aviso).
const SAFE_ATTR = /^data-cms-/;
const strip = el => { for (const e of [el, ...el.querySelectorAll('*')]) for (const a of e.getAttributeNames()) if (SAFE_ATTR.test(a)) e.removeAttribute(a); return el; };
const HIDDEN_PROPS = ['opacity', 'visibility', 'filter', 'clip-path', 'transform', 'translate', 'scale', 'rotate'];
const settle = el => {
  for (const e of [el, ...el.querySelectorAll('*')]) {
    if (!e.style) continue;
    const op = parseFloat(e.style.opacity);
    if (e.style.visibility === 'hidden' || (Number.isFinite(op) && op < .05)) for (const p of HIDDEN_PROPS) e.style.removeProperty(p);
  }
  return el;
};
// Las piezas que anima GSAP no copian su desplazamiento de animación (puede venir a medias de un scrub); la opacidad ya terminada sí se conserva.
const GSAP_STATE = ['transform', 'translate', 'scale', 'rotate'];
const unstate = (src, copy) => {
  const a = [src, ...src.querySelectorAll('*')]; const b = [copy, ...copy.querySelectorAll('*')];
  a.forEach((e, i) => { if (e._gsap && b[i]?.style) for (const p of GSAP_STATE) b[i].style.removeProperty(p); });
  return copy;
};
const len = s => [...s].length;
const leafIn = (c, u) => (u.unit === u.leaf ? c : (c.querySelector(':scope *:not(:has(*))') || c));
const isLeaf = e => !e.childElementCount && e.childNodes.length === 1 && e.firstChild.nodeType === 3;

// Analiza la estructura. Devuelve { mode, words:[{wrapper, units:[...]}], flat:[...], hasSep } o null si no es una división regular.
export function analyze(root) {
  if (!(root instanceof Element)) return null;
  // texto suelto fuera de hojas: solo se admiten separadores en blanco directamente en la raíz
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; const leaves = []; let hasSep = false;
  while ((n = w.nextNode())) {
    const p = n.parentElement;
    if (!n.nodeValue.trim()) { if (p === root) hasSep = true; else if (!isLeaf(p)) { /* espacio entre piezas */ } continue; }
    if (!isLeaf(p) || p === root) return null;
    leaves.push(p);
  }
  if (leaves.length < 2) return null;
  const avg = leaves.reduce((s, l) => s + len(l.textContent), 0) / leaves.length;
  const mode = avg <= 1.6 ? 'chars' : 'words';
  const chain = leaf => { const out = []; for (let c = leaf; c && c !== root; c = c.parentElement) out.push(c); return out; };
  const depths = new Set(leaves.map(l => chain(l).length));
  if (depths.size > 1 || [...depths][0] > 3) return null;
  const depth = [...depths][0];
  if (mode === 'words') {
    // unidad = hijo directo de la raíz que contiene la palabra
    const units = leaves.map(l => chain(l).at(-1));
    if (new Set(units).size !== units.length || units.some(u => u.querySelectorAll('*').length > 4)) return null;
    return { mode, depth, hasSep, units: units.map(u => ({ unit: u, leaf: leaves.find(l => u.contains(l)) })), root };
  }
  if (depth === 1) return { mode, depth, flat: leaves.map(l => ({ unit: l, leaf: l })), hasSep, root };
  // chars con envoltorio por palabra: el hijo de la raíz agrupa varias piezas
  const wrappers = []; for (const l of leaves) { const top = chain(l).at(-1); if (!wrappers.includes(top)) wrappers.push(top); }
  const out = [];
  for (const wr of wrappers) {
    const units = []; for (const l of leaves) { const c = chain(l); if (c.at(-1) === wr) units.push({ unit: c.length > 1 ? c.at(-2) : c[0], leaf: l }); }
    if (units.some(u => u.unit.querySelectorAll('*').length > 3)) return null;
    out.push({ wrapper: wr, units });
  }
  return { mode, depth, words: out, hasSep, root };
}

// Reconstruye `root` con `text`. `saved` conserva los nodos originales para restaurar; `info` se calcula una sola vez de la estructura original.
export function createSplit() {
  const state = new WeakMap(); // root → { saved:[nodes], info, text }
  const unitClone = (u, text) => {
    const c = unstate(u.unit, strip(u.unit.cloneNode(true)));
    leafIn(c, u).textContent = text; return settle(c);
  };
  function build(info, text) {
    const frag = document.createDocumentFragment(); const created = { leaves: [], units: [], wrappers: [] };
    let tokens = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    // Los envoltorios de la plantilla suelen ser líneas con posición propia: no se inventan más; las palabras de sobra se agrupan en el último.
    const slots = info.mode === 'words' ? info.units?.length : info.words?.length;
    if (slots && tokens.length > slots) tokens = [...tokens.slice(0, slots - 1), tokens.slice(slots - 1).join(' ')];
    if (info.mode === 'words') {
      tokens.forEach((word, i) => {
        if (i && info.hasSep) frag.append(document.createTextNode(' '));
        const tpl = info.units[Math.min(i, info.units.length - 1)];
        const c = unitClone(tpl, word); frag.append(c); created.units.push(c); created.leaves.push(leafIn(c, tpl));
      });
    } else if (info.flat) {
      const space = info.flat.find(u => !u.leaf.textContent.trim());
      const chars = [...tokens.join(' ')];
      chars.forEach((ch, i) => {
        if (ch === ' ') { const sp = space ? unitClone(space, space.leaf.textContent) : document.createTextNode(' '); frag.append(sp); if (sp.nodeType === 1) { created.units.push(sp); created.leaves.push(sp); } return; }
        const tpl = info.flat.filter(u => u.leaf.textContent.trim())[Math.min(i, info.flat.length - 1)] || info.flat[0];
        const c = unitClone(tpl, ch); frag.append(c); created.units.push(c); created.leaves.push(c);
      });
    } else {
      tokens.forEach((word, wi) => {
        if (wi && info.hasSep) frag.append(document.createTextNode(' '));
        const tpl = info.words[Math.min(wi, info.words.length - 1)];
        const wr = unstate(tpl.wrapper, strip(tpl.wrapper.cloneNode(false))); settle(wr); created.wrappers.push(wr);
        [...word].forEach((ch, ci) => {
          if (ch === ' ') { wr.append(document.createTextNode(' ')); return; }
          const u = tpl.units[Math.min(ci, tpl.units.length - 1)]; const c = unitClone(u, ch); wr.append(c); created.units.push(c);
          created.leaves.push(leafIn(c, u));
        });
        frag.append(wr);
      });
    }
    return { frag, created };
  }
  // Las animaciones de GSAP que apuntaban a las piezas viejas pasan a apuntar a las nuevas (mismo orden).
  function retarget(info, created) {
    const g = window.gsap; if (!g?.getTweensOf) return 0;
    const old = { leaves: [], units: [], wrappers: [] };
    if (info.words) for (const wd of info.words) { old.wrappers.push(wd.wrapper); for (const u of wd.units) { old.units.push(u.unit); old.leaves.push(u.leaf); } }
    else for (const u of info.units || info.flat || []) { old.units.push(u.unit); old.leaves.push(u.leaf); }
    let moved = 0;
    for (const role of ['leaves', 'units', 'wrappers']) {
      old[role].forEach((o, i) => {
        const nw = created[role][i]; if (!nw || nw === o) return;
        let tweens = []; try { tweens = g.getTweensOf(o); } catch { /* sin gsap */ }
        for (const t of tweens) { try { const targets = t.targets(); const k = targets.indexOf(o); if (k >= 0) { targets[k] = nw; t.invalidate(); moved++; } } catch { /* sin acceso a los targets */ } }
      });
    }
    return moved;
  }
  return {
    can(root) { return state.has(root) || !!analyze(root); },
    isRebuilt: root => state.has(root),
    rebuild(root, text) {
      let st = state.get(root);
      if (!st) { const info = analyze(root); if (!info) return false; st = { saved: [...root.childNodes], info, text: null }; state.set(root, st); }
      if (st.text === text) return false;
      const { frag, created } = build(st.info, text);
      root.replaceChildren(frag); retarget(st.info, created); st.text = text;
      return true;
    },
    restore(root) {
      const st = state.get(root); if (!st) return false;
      root.replaceChildren(...st.saved); state.delete(root); return true;
    }
  };
}
