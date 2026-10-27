// ORNAT · Plano a render — mobiliario procedural (three.js) y colocación automática por uso.
//
// Unidades: metros, Y arriba. Mundo: plano x -> x, plano y -> z (ver modelo.js).
// Solo MeshStandard/MeshPhysical (three-gpu-pathtracer): no se crean materiales, se usan los de `mats`.
// Cada constructor (dims, mats, estilo, rng) -> THREE.Group con origen en el centro de la base y frente hacia +z.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const PI = Math.PI;
const V2 = (x, y) => new THREE.Vector2(x, y);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ======================= estilo, rng, materiales ======================= */

const FORMAS = ['recta', 'redondeada', 'organica', 'clasica'];
const PATAS = ['madera', 'metal', 'ocultas', 'torneadas'];

export function normalizarEstilo(e) {
  if (e && e.__norm) return e;
  const s = e && typeof e === 'object' ? e : {};
  const n = v => (Number.isFinite(+v) ? +v : null);
  return {
    __norm: true,
    forma: FORMAS.includes(s.forma) ? s.forma : 'recta',
    patas: PATAS.includes(s.patas) ? s.patas : 'madera',
    altura: s.altura === 'baja' ? 'baja' : 'media',
    densidad: clamp(n(s.densidad) ?? 1, 0.6, 1.3),
    plantas: clamp(Math.round(n(s.plantas) ?? 1), 0, 3),
  };
}

function rngDe(rng) {
  if (typeof rng === 'function') return rng;
  let a = 0x2f6b9e31;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const entre = (R, a, b) => a + (b - a) * R();
const elegir = (R, arr) => arr[Math.min(arr.length - 1, Math.floor(R() * arr.length))];

let MAT_RESPALDO = null;
const CADENA = {
  carpinteria: ['carpinteria2', 'cubierta', 'textil'], carpinteria2: ['carpinteria'], textil: ['textil2', 'colchon', 'carpinteria'],
  textil2: ['textil'], metal: ['carpinteria2', 'carpinteria'], cubierta: ['ceramica', 'carpinteria'], ceramica: ['cubierta', 'colchon'],
  vidrio: ['espejo', 'metal'], espejo: ['metal', 'vidrio'], emisivo: ['foco', 'textil'], foco: ['emisivo'], hoja: ['textil2', 'textil'],
  maceta: ['ceramica', 'carpinteria2'], tapete: ['textil2', 'textil'], colchon: ['textil', 'ceramica'],
};
function resolverMats(m) {
  if (m && m.__resuelto) return m;
  const src = m && typeof m === 'object' ? m : {};
  const ok = v => !!(v && v.isMaterial);
  const cualquiera = Object.values(src).find(ok) || (MAT_RESPALDO ||= new THREE.MeshStandardMaterial({ color: 0xbdb6aa, roughness: 0.7 }));
  const out = { __resuelto: true };
  for (const k of Object.keys(CADENA)) {
    let v = src[k];
    if (!ok(v)) for (const alt of CADENA[k]) if (ok(src[alt])) { v = src[alt]; break; }
    out[k] = ok(v) ? v : cualquiera;
  }
  const lib = Array.isArray(src.libro) ? src.libro.filter(ok) : ok(src.libro) ? [src.libro] : [];
  out.libro = lib.length ? lib : [out.carpinteria2, out.textil, out.textil2];
  return out;
}
function prep(mats, estilo, rng) { return [resolverMats(mats), normalizarEstilo(estilo), rngDe(rng)]; }

const rM = E => ({ recta: 0, redondeada: 0.02, organica: 0.04, clasica: 0.006 })[E.forma];
const rT = E => ({ recta: 0.018, redondeada: 0.045, organica: 0.065, clasica: 0.03 })[E.forma];
const tipoPatas = E => (E.forma === 'clasica' && E.patas === 'madera' ? 'torneadas' : E.patas);

/* ======================= geometría base ======================= */

function malla(geo, mat, nombre) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true; m.receiveShadow = true;
  if (nombre) m.name = nombre;
  return m;
}
function nuevoGrupo(nombre, tipo) { const g = new THREE.Group(); g.name = nombre; g.userData.tipo = tipo; return g; }
function caja(w, h, d, mat, r = 0) {
  w = Math.max(w, 0.003); h = Math.max(h, 0.003); d = Math.max(d, 0.003);
  const rr = Math.min(r, Math.min(w, h, d) / 2 - 0.0005);
  const geo = rr > 0.003 ? new RoundedBoxGeometry(w, h, d, Math.max(w, h, d) > 0.35 ? 2 : 1, rr) : new THREE.BoxGeometry(w, h, d);
  return malla(geo, mat);
}
function poner(g, o, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); g.add(o); return o; }
function cajaB(g, w, h, d, mat, x, y0, z, r = 0) { return poner(g, caja(w, h, d, mat, r), x, y0 + Math.max(h, 0.003) / 2, z); }
function cil(rt, rb, h, mat, seg = 12, abierto = false) { return malla(new THREE.CylinderGeometry(rt, rb, Math.max(h, 0.002), seg, 1, abierto), mat); }
function cilB(g, rt, rb, h, mat, x, y0, z, seg = 12) { return poner(g, cil(rt, rb, h, mat, seg), x, y0 + h / 2, z); }
// LatheGeometry promedia normales sin normalizarlas y las hojas deformadas dejan normales nulas en los polos:
// se dejan unitarias para que el sombreado y la exportación .glb sean correctos (GLTFExporter avisa si no lo son).
function normalesUnitarias(geo) {
  const n = geo.attributes.normal; if (!n) return geo;
  for (let i = 0; i < n.count; i++) { const x = n.getX(i), y = n.getY(i), z = n.getZ(i), l = Math.hypot(x, y, z); if (l < 1e-6) n.setXYZ(i, 0, 1, 0); else n.setXYZ(i, x / l, y / l, z / l); }
  n.needsUpdate = true; return geo;
}
function torno(perfil, mat, seg = 16) { return malla(normalesUnitarias(new THREE.LatheGeometry(perfil.map(([r, y]) => V2(Math.max(0, r), y)), seg)), mat); }
function tubo(pts, radio, mat, segs = 12, rad = 6) {
  const c = new THREE.CatmullRomCurve3(pts.map(p => V3(p[0], p[1], p[2])));
  return malla(new THREE.TubeGeometry(c, segs, radio, rad, false), mat);
}
// forma 2D (XY) extruida en z, centrada en z
function extruir(shape, prof, mat, bisel = 0.004) {
  const dd = Math.max(0.002, prof - 2 * bisel);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: dd, bevelEnabled: bisel > 0, bevelThickness: bisel, bevelSize: bisel, bevelSegments: 2, curveSegments: 12 });
  geo.translate(0, 0, -dd / 2);
  return malla(geo, mat);
}
// forma 2D en planta (x, -z) extruida hacia arriba, centrada en y; grosor total t
function losa(shape, t, mat, bisel = 0.004) {
  const dd = Math.max(0.002, t - 2 * bisel);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: dd, bevelEnabled: bisel > 0, bevelThickness: bisel, bevelSize: bisel, bevelSegments: 2, curveSegments: 14 });
  geo.translate(0, 0, -dd / 2); geo.rotateX(-PI / 2);
  return malla(geo, mat);
}
function rectRedondeado(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  r = Math.max(0.001, Math.min(r, w / 2 - 0.001, h / 2 - 0.001));
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -PI / 2, 0, false);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, PI / 2, PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, PI, 1.5 * PI, false);
  return s;
}
function elipse(rx, ry) { const s = new THREE.Shape(); s.absellipse(0, 0, rx, ry, 0, 2 * PI, false, 0); return s; }
function formaOrganica(rx, ry, R) {
  const n = 9, pts = [], f = [];
  for (let i = 0; i < n; i++) f.push(0.9 + 0.1 * R());
  for (let i = 0; i < n; i++) { const a = (i / n) * 2 * PI; pts.push(V2(Math.cos(a) * rx * f[i], Math.sin(a) * ry * f[i])); }
  const s = new THREE.Shape(); s.moveTo(pts[0].x, pts[0].y); s.splineThru([...pts.slice(1), pts[0]]);
  return s;
}
function formaPlano(E, w, d, R) {
  if (E.forma === 'organica') return formaOrganica(w / 2, d / 2, R);
  if (E.forma === 'redondeada') return rectRedondeado(w, d, Math.min(w, d) * 0.3);
  return rectRedondeado(w, d, E.forma === 'clasica' ? 0.02 : 0.004);
}
// banda en arco (respaldo curvo): cóncava hacia +z; borde trasero en z = zAtras
function arcoBanda(g, R, t, ang, h, mat, y0, zAtras) {
  const s = new THREE.Shape();
  s.absarc(0, 0, R, PI / 2 - ang / 2, PI / 2 + ang / 2, false);
  s.absarc(0, 0, R - t, PI / 2 + ang / 2, PI / 2 - ang / 2, true);
  const geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 14 });
  geo.rotateX(-PI / 2);
  return poner(g, malla(geo, mat), 0, y0, zAtras + R);
}
function perfilTorneado(h, k = 1) {
  return [[0, 0], [0.013, 0], [0.016, 0.03], [0.012, 0.08], [0.018, 0.2], [0.024, 0.32], [0.017, 0.45], [0.014, 0.6], [0.02, 0.75], [0.016, 0.88], [0.022, 0.94], [0.022, 1], [0, 1]]
    .map(([r, y]) => [r * k, y * h]);
}
function pantalla(rb, rt, h, mat, seg = 24) { const t = 0.004; return torno([[rb, 0], [rt, h], [rt - t, h], [rb - t, 0], [rb, 0]], mat, seg); }
function domo(R, h, mat, seg = 24) {
  const p = [], t = 0.004;
  for (let i = 0; i <= 8; i++) { const a = (i / 8) * PI / 2; p.push([R * Math.sin(a) + 0.0001, h * Math.cos(a)]); }
  for (let i = 8; i >= 0; i--) { const a = (i / 8) * PI / 2; p.push([(R - t) * Math.sin(a) + 0.0001, (h - t) * Math.cos(a)]); }
  return torno(p, mat, seg);
}
function geoHoja(ancho = 0.5, caida = 0.2, copa = 0.1, sw = 10, sh = 4) {
  const g = new THREE.SphereGeometry(1, sw, sh), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = (z + 1) / 2;
    const X = x * (ancho / 2) * (1 - 0.3 * t);
    const Y = y * 0.006 - caida * t * t + copa * Math.pow(Math.abs(X) / (ancho / 2), 2) * ancho * 0.5;
    p.setXYZ(i, X, Y, t);
  }
  g.computeVertexNormals();
  return normalesUnitarias(g);
}

function patas(g, M, E, { w, d, h, grosor = 1, ox = 0, oz = 0, tipo } = {}) {
  if (h <= 0.004) return;
  const tp = tipo || tipoPatas(E);
  if (tp === 'ocultas') { cajaB(g, Math.max(0.04, w), h, Math.max(0.04, d), M.carpinteria2, ox, 0, oz); return; }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = ox + (sx * w) / 2, z = oz + (sz * d) / 2;
    if (tp === 'metal') {
      if (E.forma === 'recta') cajaB(g, 0.022 * grosor, h, 0.022 * grosor, M.metal, x, 0, z);
      else cilB(g, 0.011 * grosor, 0.011 * grosor, h, M.metal, x, 0, z, 8);
    } else if (tp === 'torneadas') poner(g, torno(perfilTorneado(h, grosor), M.carpinteria, 10), x, 0, z);
    else if (E.forma === 'recta') cajaB(g, 0.034 * grosor, h, 0.034 * grosor, M.carpinteria, x, 0, z);
    else cilB(g, 0.021 * grosor, 0.014 * grosor, h, M.carpinteria, x, 0, z, 10);
  }
}

// jaladera; z = cara frontal donde se monta
function jaladera(g, M, E, x, y, z, { largo = 0.14, vertical = false } = {}) {
  const f = E.forma;
  if (f === 'clasica') { poner(g, torno([[0, 0], [0.005, 0], [0.005, 0.012], [0.013, 0.019], [0.011, 0.027], [0, 0.029]], M.metal, 10), x, y, z, PI / 2); return; }
  if (f === 'organica') { poner(g, cil(0.014, 0.016, 0.012, M.metal, 14), x, y, z + 0.006, PI / 2); return; }
  const dx = vertical ? 0 : largo * 0.4, dy = vertical ? largo * 0.4 : 0;
  if (f === 'recta') {
    poner(g, vertical ? caja(0.012, largo, 0.012, M.metal) : caja(largo, 0.012, 0.012, M.metal), x, y, z + 0.028);
    for (const s of [-1, 1]) poner(g, caja(0.008, 0.008, 0.024, M.metal), x + s * dx, y + s * dy, z + 0.012);
    return;
  }
  poner(g, cil(0.007, 0.007, largo, M.metal, 8), x, y, z + 0.028, 0, 0, vertical ? 0 : PI / 2);
  for (const s of [-1, 1]) poner(g, cil(0.005, 0.005, 0.024, M.metal, 6), x + s * dx, y + s * dy, z + 0.012, PI / 2);
}
// frente de puerta/cajón sobre la cara z (sale hacia +z)
const FT = 0.018;
function frente(g, M, E, x, y0, z, w, h, { mat, jal = 'cajon' } = {}) {
  const m = mat || M.carpinteria;
  cajaB(g, w, h, FT, m, x, y0, z + FT / 2, E.forma === 'recta' ? 0 : Math.min(0.006, rM(E) + 0.002));
  let zf = z + FT;
  if (E.forma === 'clasica' && w > 0.22 && h > 0.22) { cajaB(g, w - 0.12, h - 0.12, 0.008, m, x, y0 + 0.06, zf + 0.004, 0.003); }
  if (!jal) return;
  if (jal === 'cajon') jaladera(g, M, E, x, y0 + (h < 0.3 ? h / 2 : h - 0.07), zf, { largo: Math.min(0.2, w * 0.45) });
  else if (jal === 'der' || jal === 'izq') jaladera(g, M, E, x + (jal === 'der' ? 1 : -1) * (w / 2 - 0.05), y0 + h - Math.min(0.16, h * 0.25), zf, { largo: 0.14, vertical: true });
  else if (jal === 'der-abajo' || jal === 'izq-abajo') jaladera(g, M, E, x + (jal === 'der-abajo' ? 1 : -1) * (w / 2 - 0.05), y0 + 0.1, zf, { largo: 0.14, vertical: true });
}

function jarron(M, R, h = 0.28) {
  const r = h * 0.32;
  const perfil = elegir(R, [
    [[0, 0], [r * 0.6, 0], [r, h * 0.35], [r * 0.9, h * 0.65], [r * 0.4, h * 0.88], [r * 0.45, h], [r * 0.38, h], [r * 0.3, h * 0.9], [0, h * 0.88]],
    [[0, 0], [r * 0.7, 0], [r * 0.75, h * 0.5], [r * 0.6, h], [r * 0.52, h], [0, h * 0.95]],
    [[0, 0], [r * 0.5, 0], [r * 1.05, h * 0.5], [r * 0.5, h * 0.95], [r * 0.42, h], [0, h * 0.97]],
  ]);
  return torno(perfil, M.ceramica, 18);
}
function cuenco(M, r = 0.12) { return torno([[0, 0], [r * 0.45, 0], [r * 0.9, r * 0.35], [r, r * 0.5], [r - 0.006, r * 0.5], [r * 0.85, r * 0.36], [r * 0.4, 0.008], [0, 0.008]], M.ceramica, 20); }
function pilaLibros(g, M, R, x, y, z, n = 3) {
  let yy = y;
  for (let i = 0; i < n; i++) {
    const w = entre(R, 0.17, 0.26), h = entre(R, 0.022, 0.04), d = entre(R, 0.13, 0.19);
    const m = caja(w, h, d, elegir(R, M.libro), 0.002); poner(g, m, x, yy + h / 2, z, 0, (R() - 0.5) * 0.35, 0); yy += h;
  }
  return yy;
}
function decorarSuperficie(g, M, E, R, { w, y, z = 0 }) {
  const usar = [];
  if (w > 0.5) usar.push(-w * 0.3);
  usar.push(w * 0.05);
  if (w > 0.9) usar.push(w * 0.32);
  usar.forEach((x, i) => {
    const k = (i + Math.floor(R() * 3)) % 3;
    if (k === 0) poner(g, jarron(M, R, entre(R, 0.22, 0.34)), x, y, z);
    else if (k === 1) pilaLibros(g, M, R, x, y, z, 2 + Math.floor(R() * 2));
    else poner(g, cuenco(M, entre(R, 0.09, 0.14)), x, y, z);
  });
}
function filaLibros(g, M, R, x0, x1, y, zAtras, profMax, hMax) {
  let x = x0 + 0.01;
  while (x < x1 - 0.03) {
    if (R() < 0.1 && x1 - x > 0.3) {
      if (R() < 0.55 && hMax > 0.2) { const h = Math.min(hMax - 0.02, entre(R, 0.16, 0.26)); poner(g, jarron(M, R, h), x + 0.08, y, zAtras + profMax / 2); x += 0.18; }
      else x += entre(R, 0.06, 0.16);
      continue;
    }
    const w = entre(R, 0.018, 0.045), h = Math.min(hMax, entre(R, 0.17, 0.29)), d = Math.min(profMax, entre(R, 0.14, 0.22));
    if (x + w > x1) break;
    cajaB(g, w, h, d, elegir(R, M.libro), x + w / 2, y, zAtras + d / 2, 0.002);
    x += w + 0.002;
  }
}

/* ======================= constructores ======================= */

export function crearSofa(dims = {}, mats, estilo, rng) {
  const [M, E, R] = prep(mats, estilo, rng);
  const baja = E.altura === 'baja', f = E.forma;
  const W = dims.ancho ?? 2.1, D = dims.prof ?? (baja ? 0.95 : 0.9);
  const plazas = dims.plazas ?? (W >= 1.9 ? 3 : W >= 1.3 ? 2 : 1);
  const g = nuevoGrupo(dims.nombre || (plazas === 1 ? 'Sillón' : `Sofá ${plazas} plazas`), dims.tipo || (plazas === 1 ? 'sillon' : 'sofa'));
  const tp = tipoPatas(E), hp = tp === 'ocultas' ? 0.05 : baja ? 0.09 : 0.14;
  const hb = 0.14, yb = hp + hb, seatTop = baja ? 0.4 : 0.45;
  const backTop = baja ? 0.68 : f === 'clasica' ? 0.88 : 0.8;
  const armW = { recta: 0.15, redondeada: 0.2, organica: 0.22, clasica: 0.17 }[f] * (plazas === 1 ? 0.85 : 1);
  const armTop = seatTop + (baja || f === 'organica' ? 0.14 : 0.18);
  const backD = 0.2, rt = rT(E);
  patas(g, M, E, { w: W - 0.12, d: D - 0.12, h: hp });
  cajaB(g, W, hb, D, M.textil, 0, hp, 0, Math.min(rt, 0.04));
  cajaB(g, W - 0.01, backTop - yb - (f === 'clasica' ? 0.05 : 0), backD, M.textil, 0, yb, -D / 2 + backD / 2, rt);
  if (f === 'clasica') poner(g, cil(0.055, 0.055, W - 2 * armW + 0.02, M.textil, 14), 0, backTop - 0.055, -D / 2 + backD / 2, 0, 0, PI / 2);
  for (const s of [-1, 1]) {
    const x = s * (W / 2 - armW / 2), hA = armTop - yb;
    if (f === 'recta') cajaB(g, armW, hA, D, M.textil, x, yb, 0, rt * 0.6);
    else if (f === 'organica') cajaB(g, armW, hA, D, M.textil, x, yb, 0, armW / 2 - 0.002);
    else {
      const rr = f === 'clasica' ? armW * 0.6 : armW / 2;
      cajaB(g, armW, hA - rr, D - 0.02, M.textil, x, yb, 0, 0.02);
      poner(g, cil(rr, rr, D - 0.02, M.textil, 16), x + (f === 'clasica' ? s * 0.012 : 0), armTop - rr, 0, PI / 2);
      if (f === 'clasica') poner(g, cil(rr * 0.75, rr * 0.75, 0.012, M.textil2, 16), x + s * 0.012, armTop - rr, D / 2 - 0.004, PI / 2);
    }
  }
  const Wi = W - 2 * armW, cw = Wi / plazas, cd = D - backD - 0.01, ch = seatTop - yb;
  const banco = f === 'recta' && plazas > 1 && R() < 0.3;
  if (banco) cajaB(g, Wi - 0.008, ch, cd, M.textil, 0, yb, -D / 2 + backD + cd / 2, rt);
  const bh = Math.max(0.2, backTop - seatTop + (f === 'recta' ? 0 : 0.04)), bt = 0.17;
  for (let i = 0; i < plazas; i++) {
    const x = -Wi / 2 + cw * (i + 0.5);
    if (!banco) cajaB(g, cw - 0.008, ch, cd, M.textil, x, yb, -D / 2 + backD + cd / 2, rt);
    poner(g, caja(cw - 0.01, bh, bt, M.textil, rt * 1.1), x, seatTop + bh / 2 - 0.01, -D / 2 + backD + bt / 2 - 0.04, -0.13);
  }
  const nCoj = plazas === 1 ? (E.densidad >= 1 ? 1 : 0) : 2 + (plazas >= 3 && E.densidad > 1.15 ? 1 : 0);
  for (let i = 0; i < nCoj; i++) {
    const s = nCoj === 1 ? 0 : i === 2 ? 0.35 : i === 0 ? -1 : 1;
    const c = caja(0.42, 0.42, 0.13, i === 2 ? M.textil : M.textil2, 0.06);
    poner(g, c, s * Math.max(0, Wi / 2 - 0.26), seatTop + 0.2, -D / 2 + backD + bt + 0.01, -0.3, s * -0.15, s * 0.06 + (R() - 0.5) * 0.08);
  }
  return g;
}

export function crearSillon(dims = {}, mats, estilo, rng) {
  return crearSofa({ ancho: dims.ancho ?? 0.88, prof: dims.prof ?? 0.85, plazas: 1, nombre: dims.nombre || 'Sillón', tipo: 'sillon' }, mats, estilo, rng);
}

export function crearCama(dims = {}, mats, estilo, rng) {
  const [M, E, R] = prep(mats, estilo, rng);
  const W = dims.ancho ?? 1.6, L = dims.largo ?? 2.0, f = E.forma, baja = E.altura === 'baja';
  const g = nuevoGrupo(W >= 1.8 ? 'Cama king size' : W >= 1.35 ? 'Cama matrimonial' : 'Cama individual', 'cama');
  const hbT = 0.08, Dt = L + hbT, zHead = -Dt / 2, zM0 = zHead + hbT, zc = zM0 + L / 2;
  const tp = tipoPatas(E), hp = tp === 'ocultas' ? 0.08 : baja ? 0.07 : 0.15, frameH = baja ? 0.16 : 0.2;
  patas(g, M, E, { w: W - 0.1, d: L - 0.12, h: hp, grosor: 1.4, oz: zc });
  const tapizada = f === 'redondeada' || f === 'organica';
  cajaB(g, W + 0.06, frameH, L + 0.02, tapizada ? M.textil2 : M.carpinteria, 0, hp, zc, tapizada ? 0.04 : rM(E));
  const yM = hp + frameH - 0.04, mH = 0.24, top = yM + mH;
  cajaB(g, W - 0.02, mH, L - 0.03, M.colchon, 0, yM, zc, 0.04);
  const dl = L * 0.72;
  cajaB(g, W + 0.08, 0.26, dl, M.textil, 0, top - 0.22, zM0 + L - dl / 2 + 0.03, 0.04);
  cajaB(g, W + 0.085, 0.05, 0.13, M.colchon, 0, top - 0.005, zM0 + L - dl + 0.09, 0.02);
  if (E.densidad >= 0.8) cajaB(g, W + 0.1, 0.03, 0.42, M.textil2, 0, top + 0.036, zM0 + L - 0.3, 0.012);
  const n = W >= 1.3 ? 2 : 1, pw = Math.min(0.66, (W - 0.12) / n - 0.02);
  for (let i = 0; i < n; i++) poner(g, caja(pw, 0.15, 0.44, M.colchon, 0.07), n === 1 ? 0 : (i - 0.5) * (pw + 0.03), top + 0.11, zM0 + 0.27, -0.35);
  if (E.densidad >= 0.9) {
    const n2 = W >= 1.3 ? 2 : 1;
    for (let i = 0; i < n2; i++) poner(g, caja(0.44, 0.44, 0.13, M.textil2, 0.06), n2 === 1 ? 0 : (i - 0.5) * 0.48, top + 0.24, zM0 + 0.52, -0.3, 0, (R() - 0.5) * 0.1);
    if (W >= 1.3 && E.densidad >= 1.1) poner(g, caja(0.5, 0.28, 0.12, M.textil, 0.05), 0, top + 0.17, zM0 + 0.7, -0.25);
  }
  const Hh = (baja ? 0.95 : 1.15) + (f === 'clasica' ? 0.1 : 0);
  if (f === 'recta') {
    const ww = W + 0.1, ns = Math.max(5, Math.round(ww / 0.085)), sw = ww / ns;
    cajaB(g, ww, Hh - 0.08, 0.02, M.carpinteria2, 0, 0.04, zHead + 0.012);
    for (let i = 0; i < ns; i++) cajaB(g, sw - 0.012, Hh, 0.03, M.carpinteria, -ww / 2 + sw * (i + 0.5), 0, zHead + 0.04);
  } else if (f === 'redondeada') {
    cajaB(g, W + 0.14, Hh, 0.09, M.textil2, 0, 0, zHead + 0.045, 0.044);
  } else if (f === 'organica') {
    const w2 = (W + 0.16) / 2, s = new THREE.Shape();
    s.moveTo(-w2, 0); s.lineTo(w2, 0); s.lineTo(w2, Hh * 0.62); s.bezierCurveTo(w2, Hh * 1.08, -w2, Hh * 1.08, -w2, Hh * 0.62); s.lineTo(-w2, 0);
    poner(g, extruir(s, 0.075, M.textil2, 0.02), 0, 0.02, zHead + 0.045);
  } else {
    cajaB(g, W + 0.2, Hh + 0.04, 0.05, M.carpinteria, 0, 0, zHead + 0.025, 0.01);
    poner(g, cil(0.03, 0.03, W + 0.22, M.carpinteria, 12), 0, Hh + 0.05, zHead + 0.025, 0, 0, PI / 2);
    const y0p = top - 0.05, ph = Hh - 0.06 - y0p, pw2 = W - 0.04;
    cajaB(g, pw2, ph, 0.05, M.textil2, 0, y0p, zHead + 0.07, 0.025);
    const nr = Math.max(2, Math.floor(ph / 0.15)), nc = Math.max(3, Math.floor(pw2 / 0.15));
    const bgeo = new THREE.SphereGeometry(0.013, 6, 4);
    for (let i = 1; i < nr; i++) for (let j = 1; j < nc; j++) {
      if ((i + j) % 2) continue;
      poner(g, malla(bgeo, M.textil2), -pw2 / 2 + (pw2 * j) / nc, y0p + (ph * i) / nr, zHead + 0.095);
    }
  }
  return g;
}

export function crearBuro(dims = {}, mats, estilo, rng) {
  const [M, E] = prep(mats, estilo, rng);
  const W = dims.ancho ?? 0.5, D = dims.prof ?? 0.4, H = dims.alto ?? (E.altura === 'baja' ? 0.45 : 0.55);
  const g = nuevoGrupo(dims.nombre || 'Buró', dims.tipo || 'buro');
  const tp = tipoPatas(E), hp = tp === 'ocultas' ? 0.05 : E.altura === 'baja' ? 0.1 : 0.14;
  patas(g, M, E, { w: W - 0.08, d: D - 0.08, h: hp });
  const zb = -FT / 2;
  cajaB(g, W, H - hp, D - FT, M.carpinteria, 0, hp, zb, rM(E));
  if (E.forma === 'clasica') cajaB(g, W + 0.03, 0.022, D + 0.02, M.carpinteria, 0, H, 0, 0.006);
  const n = dims.cajones ?? 2, fh = (H - hp - 0.03) / n;
  for (let i = 0; i < n; i++) frente(g, M, E, 0, hp + 0.015 + fh * i + 0.002, D / 2 - FT, W - 0.03, fh - 0.004, { jal: 'cajon' });
  g.userData.altoSuperficie = H + (E.forma === 'clasica' ? 0.022 : 0);
  return g;
}

export function crearLamparaMesa(dims = {}, mats, estilo, rng) {
  const [M, E] = prep(mats, estilo, rng);
  const H = dims.alto ?? 0.55, k = H / 0.55, f = E.forma;
  const g = nuevoGrupo('Lámpara de mesa', 'lampara');
  const perfiles = {
    recta: [[0, 0], [0.065, 0], [0.065, 0.24], [0.02, 0.24], [0, 0.245]],
    redondeada: [[0, 0], [0.05, 0], [0.09, 0.06], [0.1, 0.12], [0.08, 0.2], [0.03, 0.24], [0.02, 0.26], [0, 0.26]],
    organica: [[0, 0], [0.06, 0], [0.1, 0.07], [0.07, 0.15], [0.085, 0.21], [0.03, 0.26], [0, 0.265]],
    clasica: [[0, 0], [0.07, 0], [0.07, 0.015], [0.03, 0.03], [0.04, 0.06], [0.095, 0.15], [0.07, 0.23], [0.03, 0.25], [0.035, 0.27], [0, 0.27]],
  };
  const pb = perfiles[f].map(([r, y]) => [r * k, y * k]);
  poner(g, torno(pb, M.ceramica, 20), 0, 0, 0);
  const bTop = pb[pb.length - 1][1];
  const [rb, rt] = { recta: [0.15, 0.15], redondeada: [0.16, 0.12], organica: [0.17, 0.14], clasica: [0.18, 0.11] }[f];
  const sh = 0.21 * k;
  cilB(g, 0.006, 0.006, H - sh * 0.6 - bTop, M.metal, 0, bTop, 0, 8);
  poner(g, pantalla(rb * k, rt * k, sh, M.emisivo), 0, H - sh, 0);
  poner(g, malla(new THREE.SphereGeometry(0.026 * k, 10, 8), M.foco), 0, H - sh * 0.55, 0);
  return g;
}

export function crearLamparaPiso(dims = {}, mats, estilo, rng) {
  const [M, E] = prep(mats, estilo, rng);
  const H = dims.alto ?? 1.6, f = E.forma;
  const g = nuevoGrupo('Lámpara de piso', 'lampara');
  if (dims.arco ?? f === 'organica') {
    const a = dims.alcance ?? 0.9;
    cajaB(g, 0.3, 0.07, 0.3, M.cubierta, 0, 0, 0, 0.02);
    const yEnd = 1.85;
    poner(g, tubo([[0, 0.07, 0], [0, 1.3, -0.02], [0, 1.95, a * 0.3], [0, 2.02, a * 0.7], [0, yEnd + 0.12, a]], 0.012, M.metal, 28, 6));
    poner(g, domo(0.2, 0.15, M.emisivo), 0, yEnd - 0.04, a);
    poner(g, malla(new THREE.SphereGeometry(0.03, 10, 8), M.foco), 0, yEnd, a);
    g.name = 'Lámpara de arco';
    return g;
  }
  if (f === 'clasica') {
    poner(g, torno([[0, 0], [0.17, 0], [0.17, 0.02], [0.12, 0.04], [0.13, 0.06], [0.05, 0.09], [0.03, 0.12], [0, 0.12]], M.carpinteria, 20));
    poner(g, torno(perfilTorneado(H - 0.42, 1.2), M.carpinteria, 10), 0, 0.12, 0);
  } else {
    cilB(g, 0.16, 0.17, 0.025, M.metal, 0, 0, 0, 24);
    cilB(g, 0.011, 0.011, H - 0.25, M.metal, 0, 0.025, 0, 8);
  }
  const [rb, rt] = f === 'clasica' ? [0.24, 0.15] : f === 'recta' ? [0.2, 0.2] : [0.22, 0.18];
  poner(g, pantalla(rb, rt, 0.32, M.emisivo), 0, H - 0.32, 0);
  poner(g, malla(new THREE.SphereGeometry(0.03, 10, 8), M.foco), 0, H - 0.18, 0);
  return g;
}

export function crearLamparaColgante(dims = {}, mats, estilo, rng) {
  const [M, E] = prep(mats, estilo, rng);
  const techo = dims.techo ?? 2.7, bajo = dims.bajo ?? 1.65, largo = dims.largo ?? 0, f = E.forma;
  const g = nuevoGrupo('Lámpara colgante', 'lampara');
  if (f === 'recta' && largo >= 1.0) {
    cajaB(g, largo, 0.05, 0.08, M.metal, 0, bajo, 0, 0.004);
    cajaB(g, largo - 0.04, 0.006, 0.05, M.emisivo, 0, bajo - 0.004, 0);
    for (const s of [-1, 1]) { cilB(g, 0.003, 0.003, techo - bajo - 0.05, M.metal, s * (largo / 2 - 0.1), bajo + 0.05, 0, 6); cilB(g, 0.05, 0.05, 0.015, M.metal, s * (largo / 2 - 0.1), techo - 0.015, 0, 16); }
    return g;
  }
  const n = dims.n ?? (largo >= 1.6 ? 3 : largo >= 1.0 ? 2 : 1), sep = n > 1 ? largo / n : 0;
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * sep;
    let sh;
    if (f === 'organica') { sh = 0.34; poner(g, malla(new THREE.SphereGeometry(0.17, 24, 16), M.emisivo), x, bajo + 0.17, 0); }
    else if (f === 'clasica') { sh = 0.26; poner(g, pantalla(0.23, 0.12, sh, M.emisivo), x, bajo, 0); }
    else if (f === 'redondeada') { sh = 0.17; poner(g, domo(0.2, 0.17, M.metal), x, bajo, 0); poner(g, cil(0.18, 0.18, 0.004, M.emisivo, 24), x, bajo + 0.006, 0); }
    else { sh = 0.26; poner(g, pantalla(0.13, 0.05, sh, M.metal), x, bajo, 0); poner(g, cil(0.12, 0.12, 0.004, M.emisivo, 24), x, bajo + 0.006, 0); }
    if (f !== 'organica') poner(g, malla(new THREE.SphereGeometry(0.03, 10, 8), M.foco), x, bajo + 0.06, 0);
    cilB(g, 0.003, 0.003, techo - bajo - sh, M.metal, x, bajo + sh, 0, 6);
    cilB(g, 0.06, 0.06, 0.015, M.metal, x, techo - 0.015, 0, 16);
  }
  return g;
}

export function crearMesa(dims = {}, mats, estilo, rng) {
  const [M, E, R] = prep(mats, estilo, rng);
  const W = dims.ancho ?? 1.8, D = dims.prof ?? 0.9, H = dims.alto ?? 0.75, f = E.forma, t = f === 'clasica' ? 0.04 : 0.035;
  const g = nuevoGrupo(dims.nombre || 'Mesa de comedor', dims.tipo || 'mesa');
  const sh = f === 'organica' ? (dims.redonda ? elipse(W / 2, D / 2) : formaOrganica(W / 2, D / 2, R)) : formaPlano(E, W, D, R);
  poner(g, losa(sh, t, M.carpinteria, 0.004), 0, H - t / 2, 0);
  const hl = H - t, tp = tipoPatas(E);
  if (f === 'organica' && tp !== 'metal') {
    const n = W > 1.5 ? 2 : 1, kk = clamp(D / 0.9, 0.7, 1.2);
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? 0 : (i ? 1 : -1) * W * 0.26;
      poner(g, torno([[0, 0], [0.22 * kk, 0], [0.22 * kk, 0.02], [0.09, 0.07], [0.065, 0.3], [0.075, hl - 0.06], [0.15 * kk, hl], [0, hl]], M.carpinteria, 24), x, 0, 0);
    }
    return g;
  }
  const ins = f === 'redondeada' ? Math.min(W, D) * 0.22 : 0.07;
  const lw = f === 'organica' ? W * 0.6 : W - 2 * ins, ld = f === 'organica' ? D * 0.52 : D - 2 * ins;
  if (tp === 'ocultas') { cajaB(g, Math.max(0.3, lw - 0.2), hl, Math.max(0.2, ld - 0.25), M.carpinteria2, 0, 0, 0); return g; }
  patas(g, M, E, { w: lw, d: ld, h: hl, grosor: 1.6 });
  if (f === 'clasica' || (f === 'recta' && tp !== 'metal')) {
    const ah = 0.08;
    for (const s of [-1, 1]) {
      cajaB(g, lw - 0.04, ah, 0.022, M.carpinteria, 0, hl - ah, s * ld / 2);
      cajaB(g, 0.022, ah, ld - 0.04, M.carpinteria, s * lw / 2, hl - ah, 0);
    }
  }
  return g;
}

export function crearSilla(dims = {}, mats, estilo, rng) {
  const [M, E] = prep(mats, estilo, rng);
  const f = E.forma, baja = E.altura === 'baja';
  const W = dims.ancho ?? 0.46, D = dims.prof ?? 0.5, sH = baja ? 0.43 : 0.46, bTop = (baja ? 0.76 : 0.84) + (f === 'clasica' ? 0.12 : 0);
  const g = nuevoGrupo('Silla', 'silla');
  let tp = tipoPatas(E); if (tp === 'ocultas') tp = 'metal';
  const lx = W / 2 - 0.03, lz = D / 2 - 0.03, hl = sH - 0.07;
  patas(g, M, E, { w: 2 * lx, d: 2 * lz, h: hl, tipo: tp });
  // asiento
  if (f === 'organica') cajaB(g, W, 0.08, D, M.textil, 0, hl, 0, 0.038);
  else if (f === 'clasica') { cajaB(g, W, 0.05, D, M.carpinteria, 0, hl, 0, 0.006); cajaB(g, W - 0.02, 0.05, D - 0.02, M.textil, 0, hl + 0.04, 0, 0.025); }
  else { cajaB(g, W, 0.035, D, M.carpinteria, 0, hl, 0, rM(E)); cajaB(g, W - 0.04, 0.035, D - 0.05, M.textil, 0, hl + 0.03, 0.01, 0.015); }
  const yS = hl + 0.05;
  const poste = (x, h0, h) => {
    if (tp === 'metal') cilB(g, 0.011, 0.011, h, M.metal, x, h0, -lz, 8);
    else if (tp === 'torneadas') poner(g, torno(perfilTorneado(h, 0.9), M.carpinteria, 10), x, h0, -lz);
    else if (f === 'recta') cajaB(g, 0.03, h, 0.03, M.carpinteria, x, h0, -lz);
    else cilB(g, 0.016, 0.016, h, M.carpinteria, x, h0, -lz, 10);
  };
  if (f === 'organica') {
    const back = arcoBanda(g, 0.42, 0.05, 1.2, bTop - yS, M.textil, yS - 0.02, -D / 2);
    back.rotation.x = -0.1;
  } else if (f === 'redondeada') {
    for (const s of [-1, 1]) poste(s * lx, yS - 0.02, bTop - 0.12 - yS);
    arcoBanda(g, 0.4, 0.025, 1.25, 0.2, M.carpinteria, bTop - 0.22, -D / 2 - 0.005);
  } else if (f === 'clasica') {
    for (const s of [-1, 1]) poste(s * lx, yS, bTop - yS);
    cajaB(g, 2 * lx - 0.02, 0.06, 0.03, M.carpinteria, 0, bTop - 0.06, -lz, 0.008);
    cajaB(g, 2 * lx - 0.05, bTop - yS - 0.22, 0.05, M.textil, 0, yS + 0.12, -lz, 0.022);
  } else {
    for (const s of [-1, 1]) poste(s * lx, yS - 0.03, bTop - yS + 0.03);
    if (tp === 'metal') cajaB(g, 2 * lx, 0.18, 0.02, M.carpinteria, 0, bTop - 0.2, -lz + 0.02);
    else for (const y of [bTop - 0.08, bTop - 0.2, bTop - 0.32]) cajaB(g, 2 * lx - 0.02, 0.055, 0.02, M.carpinteria, 0, y, -lz);
  }
  return g;
}

export function crearMesaCentro(dims = {}, mats, estilo, rng) {
  const [M, E, R] = prep(mats, estilo, rng);
  const W = dims.ancho ?? 1.1, D = dims.prof ?? 0.6, H = dims.alto ?? (E.altura === 'baja' ? 0.32 : 0.4), f = E.forma;
  const g = nuevoGrupo(dims.nombre || 'Mesa de centro', dims.tipo || 'mesa_centro');
  const tp = tipoPatas(E);
  let yTop = H, ancho = W;
  if (f === 'organica') {
    const w1 = W * 0.72, d1 = D;
    poner(g, losa(formaOrganica(w1 / 2, d1 / 2, R), H, M.carpinteria, 0.02), -W / 2 + w1 / 2, H / 2, 0);
    const w2 = W * 0.42;
    poner(g, losa(formaOrganica(w2 / 2, D * 0.35, R), H * 0.72, M.cubierta, 0.018), W / 2 - w2 / 2, H * 0.36, D * 0.14);
    if (E.densidad >= 0.8) { const dg = new THREE.Group(); dg.position.x = -W / 2 + w1 / 2; g.add(dg); decorarSuperficie(dg, M, E, R, { w: w1 * 0.6, y: H, z: 0 }); }
    return g;
  }
  if (f === 'redondeada') {
    const redonda = dims.redonda ?? W / D < 1.3;
    const sh = redonda ? elipse(W / 2, D / 2) : rectRedondeado(W, D, D / 2 - 0.002);
    poner(g, losa(sh, 0.04, M.carpinteria, 0.006), 0, H - 0.02, 0);
    if (tp === 'ocultas') poner(g, losa(redonda ? elipse(W * 0.35, D * 0.35) : rectRedondeado(W * 0.7, D * 0.6, D * 0.3 - 0.002), H - 0.04, M.carpinteria2, 0.01), 0, (H - 0.04) / 2, 0);
    else patas(g, M, E, { w: W * 0.6, d: D * 0.55, h: H - 0.04 });
  } else {
    const t = f === 'clasica' ? 0.04 : 0.035;
    cajaB(g, W, t, D, M.carpinteria, 0, H - t, 0, rM(E));
    if (tp === 'ocultas') cajaB(g, W - 0.16, H - t, D - 0.14, M.carpinteria2, 0, 0, 0);
    else {
      patas(g, M, E, { w: W - 0.1, d: D - 0.1, h: H - t, grosor: 1.2 });
      if (E.densidad >= 0.9 || f === 'clasica') cajaB(g, W - 0.08, 0.02, D - 0.08, M.carpinteria, 0, 0.1, 0);
    }
  }
  if (E.densidad >= 0.8) decorarSuperficie(g, M, E, R, { w: ancho * 0.75, y: yTop, z: 0 });
  return g;
}

export function crearTapete(dims = {}, mats, estilo, rng) {
  const [M, E, R] = prep(mats, estilo, rng);
  const W = dims.ancho ?? 2.0, L = dims.largo ?? 3.0, f = E.forma;
  const g = nuevoGrupo('Tapete', 'tapete');
  if (f === 'organica') { poner(g, losa(formaOrganica(W / 2, L / 2, R), 0.012, M.tapete, 0.003), 0, 0.006, 0); return g; }
  if (f === 'redondeada') { poner(g, losa(rectRedondeado(W, L, 0.3), 0.012, M.tapete, 0.003), 0, 0.006, 0); return g; }
  if (f === 'clasica') { cajaB(g, W, 0.01, L, M.textil2, 0, 0, 0); cajaB(g, W - 0.16, 0.013, L - 0.16, M.tapete, 0, 0, 0); return g; }
  cajaB(g, W, 0.012, L, M.tapete, 0, 0, 0);
  return g;
}

function construirInferior(g, M, E, R, L, D, H, { tarja = null, parrilla = null, sinCubierta = false, cajones = true } = {}) {
  const ct = 0.03, zh = 0.1, gap = 0.003;
  const zFront = D / 2 - 0.02 - FT; // cara frontal del casco
  const yC = H - ct;
  cajaB(g, L - 0.002, zh, D - 0.02 - FT - 0.06, M.carpinteria2, 0, 0, -D / 2 + (D - 0.02 - FT - 0.06) / 2);
  // casco (bajo la tarja se rebaja para que se vea la tina)
  const cascoZ = zFront + D / 2, cascoC = (zFront - D / 2) / 2;
  if (tarja !== null && !sinCubierta) {
    const sw = Math.min(0.7, L - 0.12), a = tarja - sw / 2, b = tarja + sw / 2;
    if (a + L / 2 > 0.005) cajaB(g, a + L / 2, yC - zh, cascoZ, M.carpinteria, (-L / 2 + a) / 2, zh, cascoC);
    if (L / 2 - b > 0.005) cajaB(g, L / 2 - b, yC - zh, cascoZ, M.carpinteria, (b + L / 2) / 2, zh, cascoC);
    cajaB(g, sw, H - 0.24 - zh, cascoZ, M.carpinteria, tarja, zh, cascoC);
    cajaB(g, sw, yC - (H - 0.24), 0.02, M.carpinteria, tarja, H - 0.24, zFront - 0.01);
  } else cajaB(g, L, yC - zh, cascoZ, M.carpinteria, 0, zh, cascoC);
  const n = Math.max(1, Math.round(L / 0.6)), mw = L / n;
  for (let i = 0; i < n; i++) {
    const x0 = -L / 2 + mw * i, x = x0 + mw / 2, hh = yC - zh - 2 * gap;
    const tiene = v => v !== null && v >= x0 - 1e-6 && v < x0 + mw + 1e-6;
    let tipo = tiene(parrilla) ? 'horno' : tiene(tarja) ? 'puertas' : cajones && (i % 3 === 1 || R() < 0.2) ? 'cajones' : 'puertas';
    if (tipo === 'horno' && mw < 0.55) tipo = 'cajones';
    const y0 = zh + gap;
    if (tipo === 'puertas') {
      if (mw >= 0.75) { for (const s of [-1, 1]) frente(g, M, E, x + s * mw / 4, y0, zFront, mw / 2 - 2 * gap, hh, { jal: s < 0 ? 'der' : 'izq' }); }
      else frente(g, M, E, x, y0, zFront, mw - 2 * gap, hh, { jal: i % 2 ? 'izq' : 'der' });
    } else if (tipo === 'cajones') {
      const hs = [0.18, 0.26]; hs.push(hh - hs[0] - hs[1] - 2 * gap);
      let yy = y0 + hh;
      for (const h of hs) { yy -= h; frente(g, M, E, x, yy, zFront, mw - 2 * gap, h - gap, { jal: 'cajon' }); yy -= gap; }
    } else {
      const hc = 0.14;
      frente(g, M, E, x, y0 + hh - hc, zFront, mw - 2 * gap, hc, { jal: 'cajon' });
      const ho = hh - hc - gap;
      cajaB(g, mw - 2 * gap, ho, FT, M.metal, x, y0, zFront + FT / 2, 0.004);
      cajaB(g, mw - 0.12, ho * 0.5, 0.004, M.espejo, x, y0 + ho * 0.22, zFront + FT + 0.002);
      poner(g, cil(0.008, 0.008, mw - 0.12, M.metal, 8), x, y0 + ho - 0.06, zFront + FT + 0.03, 0, 0, PI / 2);
      for (const s of [-1, 1]) poner(g, cil(0.005, 0.005, 0.03, M.metal, 6), x + s * (mw / 2 - 0.1), y0 + ho - 0.06, zFront + FT + 0.015, PI / 2);
    }
  }
  if (sinCubierta) return;
  if (tarja !== null) {
    const sw = Math.min(0.7, L - 0.12), sd = 0.4, tz = 0.02, a = tarja - sw / 2, b = tarja + sw / 2;
    if (a + L / 2 > 0.005) cajaB(g, a + L / 2, ct, D, M.cubierta, (-L / 2 + a) / 2, yC, 0);
    if (L / 2 - b > 0.005) cajaB(g, L / 2 - b, ct, D, M.cubierta, (b + L / 2) / 2, yC, 0);
    cajaB(g, sw, ct, tz - sd / 2 + D / 2, M.cubierta, tarja, yC, (-D / 2 + tz - sd / 2) / 2);
    cajaB(g, sw, ct, D / 2 - (tz + sd / 2), M.cubierta, tarja, yC, (D / 2 + tz + sd / 2) / 2);
    const fondo = H - 0.22, hw = H - 0.002 - fondo;
    cajaB(g, sw - 0.01, 0.008, sd - 0.01, M.metal, tarja, fondo, tz);
    for (const s of [-1, 1]) { cajaB(g, 0.008, hw, sd, M.metal, tarja + s * (sw / 2 - 0.004), fondo, tz); cajaB(g, sw, hw, 0.008, M.metal, tarja, fondo, tz + s * (sd / 2 - 0.004)); }
    cilB(g, 0.035, 0.035, 0.004, M.metal, tarja, fondo + 0.008, tz, 16);
    const gz = tz - sd / 2 - 0.06;
    cilB(g, 0.025, 0.028, 0.05, M.metal, tarja, H, gz, 14);
    if (E.forma === 'recta') { cilB(g, 0.012, 0.012, 0.3, M.metal, tarja, H + 0.05, gz, 10); cajaB(g, 0.024, 0.024, 0.22, M.metal, tarja, H + 0.33, gz + 0.1); }
    else poner(g, tubo([[0, 0.05, 0], [0, 0.26, 0], [0, 0.36, 0.06], [0, 0.32, 0.18], [0, 0.24, 0.21]].map(([x, y, z]) => [tarja + x, H + y, gz + z]), 0.012, M.metal, 20, 8));
    cajaB(g, 0.012, 0.012, 0.07, M.metal, tarja + 0.04, H + 0.1, gz + 0.02);
  } else cajaB(g, L, ct, D, M.cubierta, 0, yC, 0, E.forma === 'recta' ? 0 : 0.004);
  if (parrilla !== null) {
    const pw = Math.min(0.6, L - 0.05);
    cajaB(g, pw, 0.008, 0.5, M.metal, parrilla, H, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const bx = parrilla + sx * pw * 0.24, bz = sz * 0.12, rr = sz > 0 ? 0.045 : 0.06;
      poner(g, malla(new THREE.TorusGeometry(rr, 0.007, 6, 20), M.metal), bx, H + 0.012, bz, PI / 2);
      cilB(g, rr * 0.55, rr * 0.55, 0.012, M.metal, bx, H + 0.008, bz, 16);
      cajaB(g, rr * 2.6, 0.01, 0.01, M.metal, bx, H + 0.025, bz); cajaB(g, 0.01, 0.01, rr * 2.6, M.metal, bx, H + 0.025, bz);
    }
  }
}

export function crearGabinetes(dims = {}, mats, estilo, rng) {
  const [M, E, R] = prep(mats, estilo, rng);
  const sup = !!dims.superior, isla = !!dims.isla;
  const L = Math.max(0.3, dims.largo ?? 2.4);
  const g = nuevoGrupo(sup ? 'Alacenas' : isla ? 'Isla de cocina' : 'Gabinetes de cocina', sup ? 'alacena' : isla ? 'isla' : 'gabinete');
  if (sup) {
    const D = dims.prof ?? 0.35, y0 = dims.base ?? 1.45, H = dims.alto ?? 0.72, gap = 0.003;
    cajaB(g, L, H, D - FT, M.carpinteria, 0, y0, -FT / 2);
    const n = Math.max(1, Math.round(L / 0.5)), mw = L / n;
    for (let i = 0; i < n; i++) frente(g, M, E, -L / 2 + mw * (i + 0.5), y0 + gap, D / 2 - FT, mw - 2 * gap, H - 2 * gap, { jal: i % 2 ? 'izq-abajo' : 'der-abajo' });
    cajaB(g, L - 0.04, 0.008, 0.02, M.emisivo, 0, y0 - 0.008, D / 2 - 0.08);
    return g;
  }
  const D = dims.prof ?? 0.6, H = dims.alto ?? 0.9;
  if (isla) {
    const vol = dims.voladizo ?? 0.3, sub = new THREE.Group();
    construirInferior(sub, M, E, R, L, D, H, { sinCubierta: true, cajones: true });
    sub.rotation.y = PI; sub.position.z = -vol / 2; g.add(sub);
    cajaB(g, L - 0.01, H - 0.03 - 0.02, 0.02, M.carpinteria, 0, 0.02, -vol / 2 + D / 2 - 0.01);
    cajaB(g, L + 0.04, 0.03, D + vol, M.cubierta, 0, H - 0.03, 0, E.forma === 'recta' ? 0 : 0.006);
    return g;
  }
  construirInferior(g, M, E, R, L, D, H, { tarja: dims.tarja ?? null, parrilla: dims.parrilla ?? null, cajones: dims.cajones !== false });
  return g;
}

export function crearCampana(dims = {}, mats, estilo, rng) {
  const [M] = prep(mats, estilo, rng);
  const W = dims.ancho ?? 0.75, techo = dims.techo ?? 2.7, yb = dims.base ?? 1.6;
  const g = nuevoGrupo('Campana', 'campana');
  cajaB(g, W, 0.06, 0.5, M.metal, 0, yb, 0, 0.004);
  const hg = new THREE.Group(); hg.position.set(0, yb + 0.06 + 0.11, -0.02); hg.scale.z = 0.46 / W; g.add(hg);
  const p = cil(0.17 * Math.SQRT2, (W / 2) * Math.SQRT2, 0.22, M.metal, 4); p.rotation.y = PI / 4; hg.add(p);
  cajaB(g, 0.3, techo - yb - 0.28, 0.24, M.metal, 0, yb + 0.28, -0.13);
  return g;
}

export function crearRefrigerador(dims = {}, mats, estilo, rng) {
  const [M] = prep(mats, estilo, rng);
  const W = dims.ancho ?? 0.8, D = dims.prof ?? 0.72, H = dims.alto ?? 1.85, ft = 0.04;
  const g = nuevoGrupo('Refrigerador', 'refrigerador');
  cajaB(g, W, H, D - ft, M.metal, 0, 0, -ft / 2, 0.012);
  const zf = D / 2 - ft / 2, b0 = 0.04;
  cajaB(g, W - 0.04, b0, 0.02, M.carpinteria2, 0, 0, D / 2 - ft - 0.01);
  if (W >= 0.75) {
    const Ht = H * 0.6, yT = H - Ht;
    for (const s of [-1, 1]) {
      cajaB(g, W / 2 - 0.004, Ht - 0.003, ft, M.metal, s * W / 4, yT, zf, 0.008);
      cilB(g, 0.011, 0.011, Ht * 0.55, M.metal, s * 0.04, yT + Ht * 0.2, D / 2 + 0.04, 10);
      for (const k of [0.22, 0.73]) poner(g, cil(0.006, 0.006, 0.04, M.metal, 6), s * 0.04, yT + Ht * k, D / 2 + 0.02, PI / 2);
    }
    cajaB(g, W - 0.006, yT - b0 - 0.006, ft, M.metal, 0, b0, zf, 0.008);
    poner(g, cil(0.011, 0.011, W * 0.55, M.metal, 10), 0, yT - 0.08, D / 2 + 0.04, 0, 0, PI / 2);
    for (const s of [-1, 1]) poner(g, cil(0.006, 0.006, 0.04, M.metal, 6), s * W * 0.22, yT - 0.08, D / 2 + 0.02, PI / 2);
  } else {
    const Ht = H * 0.64, yT = H - Ht;
    cajaB(g, W - 0.006, Ht - 0.003, ft, M.metal, 0, yT, zf, 0.008);
    cajaB(g, W - 0.006, yT - b0 - 0.006, ft, M.metal, 0, b0, zf, 0.008);
    cilB(g, 0.011, 0.011, Ht * 0.4, M.metal, W / 2 - 0.06, yT + 0.05, D / 2 + 0.04, 10);
    cilB(g, 0.011, 0.011, 0.25, M.metal, W / 2 - 0.06, yT - 0.32, D / 2 + 0.04, 10);
    for (const y of [yT + 0.08, yT + Ht * 0.4 + 0.02, yT - 0.29, yT - 0.1]) poner(g, cil(0.006, 0.006, 0.04, M.metal, 6), W / 2 - 0.06, y, D / 2 + 0.02, PI / 2);
  }
  return g;
}

export function crearWC(dims = {}, mats, estilo, rng) {
  const [M, E] = prep(mats, estilo, rng);
  const g = nuevoGrupo('WC', 'wc');
  const D = dims.prof ?? 0.7, zt = -D / 2 + 0.09, f = E.forma;
  const bowl = torno([[0, 0], [0.11, 0], [0.12, 0.05], [0.13, 0.15], [0.16, 0.28], [0.18, 0.36], [0.185, 0.39], [0.17, 0.4], [0.13, 0.39], [0.06, 0.3], [0, 0.29]], M.ceramica, 28);
  bowl.scale.set(1, 1, 1.3); poner(g, bowl, 0, 0, 0.07);
  cajaB(g, 0.22, 0.38, 0.3, M.ceramica, 0, 0, -0.16, 0.06);
  const seat = malla(new THREE.TorusGeometry(0.15, 0.021, 8, 28), M.ceramica);
  seat.scale.set(1, 1.3, 1); poner(g, seat, 0, 0.415, 0.07, PI / 2);
  const tr = { recta: 0.012, redondeada: 0.05, organica: 0.08, clasica: 0.02 }[f];
  cajaB(g, 0.38, 0.37, 0.18, M.ceramica, 0, 0.4, zt, tr);
  cajaB(g, 0.39, 0.03, 0.19, M.ceramica, 0, 0.77, zt, Math.min(tr, 0.014));
  cilB(g, 0.022, 0.022, 0.008, M.metal, 0, 0.8, zt, 16);
  const tapa = cil(0.175, 0.175, 0.02, M.ceramica, 28);
  tapa.scale.set(1, 1, 1.25); poner(g, tapa, 0, 0.62, zt + 0.12, PI / 2 - 0.12);
  return g;
}

export function crearLavabo(dims = {}, mats, estilo, rng) {
  const [M, E] = prep(mats, estilo, rng);
  const W = dims.ancho ?? 0.8, D = dims.prof ?? 0.5, H = 0.85, f = E.forma;
  const g = nuevoGrupo('Lavabo', 'lavabo');
  const tp = tipoPatas(E), hp = tp === 'ocultas' ? 0.08 : 0.16;
  patas(g, M, E, { w: W - 0.08, d: D - 0.1, h: hp });
  cajaB(g, W, H - 0.03 - hp, D - 0.02 - FT, M.carpinteria, 0, hp, -0.01 - FT / 2, rM(E));
  const fh = H - 0.03 - hp - 0.01, zF = D / 2 - 0.02 - FT;
  if (W >= 0.7) for (const s of [-1, 1]) frente(g, M, E, s * W / 4, hp + 0.005, zF, W / 2 - 0.008, fh, { jal: 'cajon' });
  else frente(g, M, E, 0, hp + 0.005, zF, W - 0.01, fh, { jal: 'cajon' });
  cajaB(g, W + 0.01, 0.03, D, M.cubierta, 0, H - 0.03, 0, rM(E) * 0.5);
  if (f === 'recta') {
    const bw = Math.min(0.5, W - 0.14), bd = 0.36, bh = 0.13, t = 0.012;
    cajaB(g, bw, t, bd, M.ceramica, 0, H, 0.03);
    for (const s of [-1, 1]) { cajaB(g, t, bh, bd, M.ceramica, s * (bw / 2 - t / 2), H, 0.03); cajaB(g, bw, bh, t, M.ceramica, 0, H, 0.03 + s * (bd / 2 - t / 2)); }
  } else {
    const k = Math.min(1, (W - 0.12) / 0.42);
    const b = torno([[0, 0], [0.06, 0], [0.08, 0.02], [0.17, 0.09], [0.2, 0.14], [0.19, 0.145], [0.16, 0.1], [0.07, 0.03], [0, 0.03]].map(([r, y]) => [r * k, y]), M.ceramica, 28);
    if (f === 'clasica') b.scale.set(1, 1, 0.8);
    poner(g, b, 0, H, 0.03);
  }
  const gz = -D / 2 + 0.06;
  cilB(g, 0.022, 0.025, 0.04, M.metal, 0, H, gz, 14);
  poner(g, tubo([[0, H + 0.04, gz], [0, H + 0.27, gz], [0, H + 0.31, gz + 0.06], [0, H + 0.28, gz + 0.14]], 0.01, M.metal, 16, 8));
  cajaB(g, 0.01, 0.01, 0.06, M.metal, 0.03, H + 0.2, gz + 0.02);
  const mw = Math.min(W * 0.85, 0.9), mh = 0.8, yC = 1.62, zm = -D / 2 + 0.012;
  if (f === 'recta') { cajaB(g, mw + 0.03, mh + 0.03, 0.015, M.metal, 0, yC - mh / 2 - 0.015, zm); cajaB(g, mw, mh, 0.006, M.espejo, 0, yC - mh / 2, zm + 0.01); }
  else if (f === 'redondeada') poner(g, extruir(rectRedondeado(mw, mh, 0.16), 0.012, M.espejo, 0.003), 0, yC, zm);
  else if (f === 'organica') { const r = Math.min(mw, mh) / 2; poner(g, cil(r, r, 0.012, M.espejo, 40), 0, yC, zm, PI / 2); poner(g, malla(new THREE.TorusGeometry(r, 0.01, 8, 40), M.metal), 0, yC, zm); }
  else { poner(g, extruir(elipse(mw / 2 + 0.04, mh / 2 + 0.05), 0.02, M.carpinteria, 0.004), 0, yC, zm - 0.002); poner(g, extruir(elipse(mw / 2 - 0.01, mh / 2), 0.008, M.espejo, 0.002), 0, yC, zm + 0.011); }
  return g;
}

export function crearRegadera(dims = {}, mats, estilo, rng) {
  const [M, E] = prep(mats, estilo, rng);
  const W = dims.ancho ?? 0.9, D = dims.prof ?? 0.9, muro = dims.muro ?? 'izq', Hg = 1.95, t = 0.008;
  const g = nuevoGrupo('Regadera', 'regadera');
  cajaB(g, W, 0.04, D, M.ceramica, 0, 0, 0, 0.004);
  if (E.forma === 'recta') cajaB(g, W - 0.2, 0.004, 0.06, M.metal, 0, 0.04, -D / 2 + 0.08);
  else cilB(g, 0.04, 0.04, 0.004, M.metal, 0, 0.04, 0, 20);
  const zF = D / 2 - 0.03, y0 = 0.04;
  const izqLibre = muro !== 'izq' && muro !== 'ambos', derLibre = muro !== 'der' && muro !== 'ambos';
  const x0 = -W / 2 + (izqLibre ? 0.03 : 0), x1 = W / 2 - (derLibre ? 0.03 : 0), fw = x1 - x0;
  cajaB(g, fw * 0.52, Hg, t, M.vidrio, x0 + fw * 0.26, y0, zF);
  cajaB(g, fw * 0.52, Hg, t, M.vidrio, x1 - fw * 0.26, y0, zF - 0.025);
  cilB(g, 0.008, 0.008, 0.3, M.metal, x1 - fw * 0.52 + 0.06, y0 + 0.85, zF - 0.025 + 0.025, 8);
  for (const s of [-1, 1]) poner(g, cil(0.005, 0.005, 0.025, M.metal, 6), x1 - fw * 0.52 + 0.06, y0 + 1.0 + s * 0.12, zF - 0.012, PI / 2);
  cajaB(g, fw, 0.02, 0.02, M.metal, (x0 + x1) / 2, y0 + Hg, zF - 0.012);
  for (const [libre, x] of [[izqLibre, -W / 2 + 0.03], [derLibre, W / 2 - 0.03]]) {
    if (!libre) continue;
    cajaB(g, t, Hg, D - 0.06, M.vidrio, x, y0, -0.03);
    cajaB(g, 0.02, Hg, 0.02, M.metal, x, y0, zF);
  }
  if (!izqLibre && !derLibre || E.forma === 'recta') cajaB(g, 0.015, 0.015, D - 0.05, M.metal, x1 - 0.01, y0 + Hg, -0.02);
  const yh = 2.08, zw = -D / 2;
  poner(g, cil(0.01, 0.01, 0.35, M.metal, 8), 0, yh, zw + 0.175, PI / 2);
  if (E.forma === 'recta') cajaB(g, 0.25, 0.012, 0.25, M.metal, 0, yh - 0.03, zw + 0.3);
  else cilB(g, 0.12, 0.12, 0.014, M.metal, 0, yh - 0.03, zw + 0.3, 28);
  poner(g, cil(0.07, 0.07, 0.01, M.metal, 24), 0, 1.05, zw + 0.005, PI / 2);
  cajaB(g, 0.016, 0.016, 0.1, M.metal, 0, 1.05, zw + 0.06);
  return g;
}

export function crearEscritorio(dims = {}, mats, estilo, rng) {
  const [M, E, R] = prep(mats, estilo, rng);
  const W = dims.ancho ?? 1.3, D = dims.prof ?? 0.65, H = dims.alto ?? 0.75, t = 0.03, f = E.forma;
  const g = nuevoGrupo('Escritorio', 'escritorio');
  poner(g, losa(formaPlano(E, W, D, R), t, M.carpinteria, 0.003), 0, H - t / 2, 0);
  const tp = tipoPatas(E);
  if (tp === 'ocultas') for (const s of [-1, 1]) cajaB(g, 0.025, H - t, D - 0.02, M.carpinteria, s * (W / 2 - 0.03), 0, 0, rM(E));
  else patas(g, M, E, { w: f === 'organica' ? W * 0.6 : W - 0.12, d: f === 'organica' ? D * 0.5 : D - 0.12, h: H - t, grosor: 1.2 });
  if (E.densidad >= 0.9 && f !== 'organica') { cajaB(g, 0.42, 0.12, D - 0.12, M.carpinteria, W / 2 - 0.3, H - t - 0.12, -0.03, rM(E)); frente(g, M, E, W / 2 - 0.3, H - t - 0.115, D / 2 - 0.09, 0.4, 0.11, { jal: 'cajon' }); }
  const lx = -W * 0.12;
  cajaB(g, 0.32, 0.012, 0.22, M.metal, lx, H, 0.04, 0.004);
  const scr = new THREE.Group(); scr.position.set(lx, H + 0.012, 0.04 - 0.11); scr.rotation.x = -0.25; g.add(scr);
  cajaB(scr, 0.32, 0.21, 0.006, M.metal, 0, 0, 0, 0.003);
  cajaB(scr, 0.3, 0.19, 0.002, M.espejo, 0, 0.01, 0.004);
  const lam = crearLamparaMesa({ alto: 0.42 }, M, E, R); lam.position.set(W / 2 - 0.16, H, -D / 2 + 0.15); g.add(lam);
  pilaLibros(g, M, R, -W / 2 + 0.17, H, -D / 2 + 0.14, 3);
  return g;
}

export function crearLibrero(dims = {}, mats, estilo, rng) {
  const [M, E, R] = prep(mats, estilo, rng);
  const W = dims.ancho ?? 0.9, Ht = dims.alto ?? 2.0, D = dims.prof ?? 0.35, t = 0.022, f = E.forma;
  const H = f === 'clasica' ? Ht - 0.05 : Ht;
  const g = nuevoGrupo('Librero', 'librero');
  for (const s of [-1, 1]) cajaB(g, t, H, D, M.carpinteria, s * (W / 2 - t / 2), 0, 0, rM(E) * 0.5);
  cajaB(g, W, t, D, M.carpinteria, 0, H - t, 0, rM(E) * 0.5);
  cajaB(g, W - 2 * t, 0.08, D - 0.03, M.carpinteria2, 0, 0, -0.015);
  cajaB(g, W - 2 * t, H - 0.08 - t, 0.012, M.carpinteria2, 0, 0.08, -D / 2 + 0.006);
  if (f === 'clasica') cajaB(g, W + 0.06, 0.05, D + 0.03, M.carpinteria, 0, H, 0.0, 0.008);
  const bays = W > 1.05 ? 2 : 1, bw = (W - 2 * t - (bays - 1) * t) / bays;
  if (bays === 2) cajaB(g, t, H - 0.08 - t, D - 0.012, M.carpinteria, 0, 0.08, 0.006);
  const nL = Math.max(3, Math.round((H - 0.1) / 0.36)), s = (H - 0.08 - t) / nL;
  for (let i = 0; i < nL; i++) {
    const y = 0.08 + s * i;
    cajaB(g, W - 2 * t, t, D - 0.012, M.carpinteria, 0, y, 0.006);
    for (let b = 0; b < bays; b++) {
      const x0 = -W / 2 + t + b * (bw + t), x1 = x0 + bw;
      if (i === 0 && (f === 'clasica' || E.densidad < 0.85)) { frente(g, M, E, (x0 + x1) / 2, y + t + 0.004, D / 2 - FT - 0.002, bw - 0.008, s - t - 0.008, { jal: b ? 'izq' : 'der' }); continue; }
      if (i === nL - 1 && R() < 0.5) { poner(g, jarron(M, R, Math.min(s - t - 0.04, 0.24)), (x0 + x1) / 2 + 0.1, y + t, 0); filaLibros(g, M, R, x0, (x0 + x1) / 2 - 0.05, y + t, -D / 2 + 0.015, D - 0.04, s - t - 0.03); continue; }
      filaLibros(g, M, R, x0, x1, y + t, -D / 2 + 0.015, D - 0.04, s - t - 0.03);
    }
  }
  return g;
}

export function crearPlanta(dims = {}, mats, estilo, rng) {
  const [M, E, R] = prep(mats, estilo, rng);
  const especie = dims.especie || elegir(R, ['monstera', 'palma', 'ficus']);
  const H = dims.alto ?? { monstera: 1.0, palma: 1.5, ficus: 1.6 }[especie];
  const g = nuevoGrupo({ monstera: 'Planta monstera', palma: 'Palma de interior', ficus: 'Ficus' }[especie] || 'Planta', 'planta');
  const ph = clamp(H * 0.28, 0.22, 0.45), pr = clamp(H * 0.13, 0.13, 0.24), w = 0.012;
  const perf = {
    recta: [[0, 0], [pr * 0.85, 0], [pr, ph], [pr - w, ph], [pr - w, ph - 0.04], [0, ph - 0.04]],
    redondeada: [[0, 0], [pr * 0.55, 0], [pr * 0.9, ph * 0.25], [pr, ph * 0.55], [pr * 0.92, ph * 0.9], [pr * 0.82, ph], [pr * 0.82 - w, ph], [pr * 0.82 - w, ph - 0.04], [0, ph - 0.04]],
    clasica: [[0, 0], [pr * 0.6, 0], [pr * 0.6, 0.03], [pr * 0.42, 0.06], [pr * 0.48, 0.1], [pr * 0.85, ph * 0.55], [pr * 0.95, ph * 0.85], [pr * 1.05, ph * 0.9], [pr * 1.05, ph], [pr * 1.05 - w, ph], [pr * 1.05 - w, ph - 0.04], [0, ph - 0.04]],
  };
  const p = perf[E.forma] || perf.redondeada;
  poner(g, torno(p, M.maceta, 22));
  const rIn = p[p.length - 3][0] - 0.004, y0 = ph - 0.035;
  cilB(g, rIn, rIn, 0.01, M.carpinteria2, 0, y0 - 0.01, 0, 18);
  const hoja = (geo, s, x, y, z, yaw, pitch, roll = 0) => { const m = malla(geo, M.hoja); m.scale.setScalar(s); m.rotation.order = 'YXZ'; m.rotation.set(pitch, yaw, roll); m.position.set(x, y, z); g.add(m); };
  if (especie === 'monstera') {
    const geo = geoHoja(0.85, 0.18, 0.12), n = 7 + Math.floor(R() * 4);
    for (let i = 0; i < n; i++) {
      const th = (i / n) * 2 * PI + R() * 0.5, lh = y0 + (H * 0.85 - y0) * (0.35 + R() * 0.65), rad = (0.05 + R() * 0.1) * H;
      const ex = Math.cos(th) * rad, ez = Math.sin(th) * rad;
      g.add(tubo([[0, y0, 0], [ex * 0.3, y0 + (lh - y0) * 0.6, ez * 0.3], [ex, lh, ez]], 0.0065, M.hoja, 8, 5));
      hoja(geo, H * (0.22 + R() * 0.1), ex, lh, ez, Math.atan2(Math.cos(th), Math.sin(th)), -0.25 + R() * 0.55, (R() - 0.5) * 0.6);
    }
  } else if (especie === 'palma') {
    const geo = geoHoja(0.14, 0.3, 0.04, 6, 3), n = 6 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) {
      const th = (i / n) * 2 * PI + R() * 0.6, Lf = (H - y0) * (0.8 + 0.2 * R()), d = Lf * 0.38;
      const ux = Math.cos(th), uz = Math.sin(th);
      const pts = [[0, y0, 0], [ux * d * 0.15, y0 + Lf * 0.45, uz * d * 0.15], [ux * d * 0.55, y0 + Lf * 0.8, uz * d * 0.55], [ux * d, y0 + Lf * 0.72, uz * d]];
      const curva = new THREE.CatmullRomCurve3(pts.map(q => V3(...q)));
      g.add(malla(new THREE.TubeGeometry(curva, 12, 0.006, 4, false), M.hoja));
      const k = 8;
      for (let j = 0; j < k; j++) {
        const tt = 0.3 + (0.68 * j) / (k - 1), P = curva.getPoint(tt), T = curva.getTangent(tt);
        const S = V3(-T.z, 0, T.x).normalize();
        for (const sd of [-1, 1]) {
          const dir = S.clone().multiplyScalar(sd).addScaledVector(T, 0.6).normalize();
          const len = H * 0.17 * (1 - 0.5 * Math.abs(tt - 0.6));
          hoja(geo, len, P.x, P.y, P.z, Math.atan2(dir.x, dir.z), 0.35 - Math.asin(clamp(dir.y, -1, 1)), sd * 0.3);
        }
      }
    }
  } else {
    const top = H * 0.62, C = V3(0, H * 0.74, 0), rc = H * 0.19;
    g.add(tubo([[0, y0, 0], [0.02, y0 + (top - y0) * 0.4, 0.01], [-0.01, top, 0.02]], 0.016, M.carpinteria2, 10, 6));
    for (let b = 0; b < 3; b++) { const a = (b / 3) * 2 * PI + R(); g.add(tubo([[-0.01, top, 0.02], [Math.cos(a) * rc * 0.5, C.y + rc * 0.1, Math.sin(a) * rc * 0.5]], 0.008, M.carpinteria2, 4, 5)); }
    const geo = geoHoja(0.6, 0.12, 0.1), n = 55;
    for (let i = 0; i < n; i++) {
      const u = R() * 2 - 1, a = R() * 2 * PI, s = Math.sqrt(1 - u * u);
      const dir = V3(s * Math.cos(a), u, s * Math.sin(a)), rr = rc * (0.55 + 0.45 * R());
      hoja(geo, H * (0.08 + R() * 0.04), C.x + dir.x * rr, C.y + dir.y * rr * 1.25, C.z + dir.z * rr, Math.atan2(dir.x, dir.z) + (R() - 0.5) * 0.8, 0.3 - dir.y * 0.8, (R() - 0.5) * 0.5);
    }
  }
  return g;
}

export function crearCamastro(dims = {}, mats, estilo, rng) {
  const [M, E] = prep(mats, estilo, rng);
  const W = dims.ancho ?? 0.7, L = dims.largo ?? 1.95, ys = 0.3;
  const g = nuevoGrupo('Camastro', 'camastro');
  const tp = tipoPatas(E), mat = tp === 'metal' ? M.metal : M.carpinteria;
  patas(g, M, E, { w: W - 0.08, d: L - 0.12, h: ys - 0.06 });
  for (const s of [-1, 1]) cajaB(g, 0.045, 0.07, L, mat, s * (W / 2 - 0.0225), ys - 0.07, 0, rM(E));
  const seatL = L * 0.64, zP = L / 2 - seatL;
  cajaB(g, W - 0.09, 0.03, seatL, mat, 0, ys - 0.05, L / 2 - seatL / 2);
  cajaB(g, W - 0.06, 0.08, seatL - 0.02, M.textil, 0, ys - 0.02, L / 2 - seatL / 2, rT(E));
  const Lb = L / 2 + zP - 0.04, ang = 0.6;
  const bk = new THREE.Group(); bk.position.set(0, ys + 0.0, zP - 0.01); bk.rotation.x = ang; g.add(bk);
  cajaB(bk, W - 0.09, 0.03, Lb, mat, 0, -0.03, -Lb / 2);
  cajaB(bk, W - 0.06, 0.08, Lb, M.textil, 0, 0, -Lb / 2, rT(E));
  poner(bk, caja(W * 0.6, 0.12, 0.2, M.textil2, 0.05), 0, 0.12, -Lb + 0.14, 0.4);
  const zs = zP - Math.cos(ang) * Lb * 0.75, ys2 = ys + Math.sin(ang) * Lb * 0.75 - 0.03;
  for (const s of [-1, 1]) cajaB(g, 0.03, ys2 - (ys - 0.07), 0.03, mat, s * (W / 2 - 0.06), ys - 0.07, zs);
  return g;
}

export function crearAparador(dims = {}, mats, estilo, rng) {
  const [M, E, R] = prep(mats, estilo, rng);
  const tipo = dims.tipo || 'aparador';
  const W = dims.ancho ?? 1.6, D = dims.prof ?? 0.45, H = dims.alto ?? (tipo === 'tv' ? (E.altura === 'baja' ? 0.42 : 0.5) : tipo === 'comoda' ? 0.85 : 0.8);
  const g = nuevoGrupo({ aparador: 'Aparador', comoda: 'Cómoda', tv: 'Mueble de TV' }[tipo] || 'Aparador', tipo === 'tv' ? 'mueble_tv' : tipo);
  const tp = tipoPatas(E), hp = tp === 'ocultas' ? 0.06 : 0.15;
  patas(g, M, E, { w: W - 0.1, d: D - 0.1, h: hp });
  cajaB(g, W, H - hp, D - FT, M.carpinteria, 0, hp, -FT / 2, rM(E));
  let top = H;
  if (E.forma === 'clasica') { cajaB(g, W + 0.03, 0.025, D + 0.02, M.carpinteria, 0, H, 0, 0.006); top += 0.025; }
  const zF = D / 2 - FT, y0 = hp + 0.012, fh = H - hp - 0.024;
  if (tipo === 'comoda') {
    const cols = W > 1.1 ? 2 : 1, rows = fh > 0.6 ? 4 : 3, cw = W / cols - 0.01, rh = fh / rows;
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) frente(g, M, E, -W / 2 + (W / cols) * (c + 0.5), y0 + rh * r + 0.002, zF, cw - 0.006, rh - 0.004, { jal: 'cajon' });
  } else {
    const n = Math.max(2, Math.round(W / (tipo === 'tv' ? 0.6 : 0.45))), mw = (W - 0.02) / n;
    for (let i = 0; i < n; i++) {
      const x = -W / 2 + 0.01 + mw * (i + 0.5);
      if (tipo === 'tv') frente(g, M, E, x, y0, zF, mw - 0.006, fh, { jal: 'cajon' });
      else frente(g, M, E, x, y0, zF, mw - 0.006, fh, { jal: i < n / 2 ? 'der' : 'izq' });
    }
  }
  if (tipo === 'tv') {
    const tv = crearTV({ ancho: clamp(W * 0.7, 0.9, 1.45) }, M, E, R); tv.position.set(0, top, -0.03); g.add(tv);
    if (E.densidad >= 0.9 && W > 1.3) { poner(g, jarron(M, R, 0.22), W / 2 - 0.15, top, 0); pilaLibros(g, M, R, -W / 2 + 0.18, top, 0, 2); }
  } else if (tipo === 'comoda' && dims.decor !== false) {
    const l = crearLamparaMesa({ alto: 0.5 }, M, E, R); l.position.set(-W / 2 + 0.22, top, -0.03); g.add(l);
    if (W > 0.8) poner(g, jarron(M, R, 0.24), W / 2 - 0.18, top, 0);
  } else if (dims.decor !== false) decorarSuperficie(g, M, E, R, { w: W, y: top, z: 0 });
  return g;
}

export function crearTV(dims = {}, mats, estilo, rng) {
  const [M] = prep(mats, estilo, rng);
  const W = dims.ancho ?? 1.23, h = W * 0.5625;
  const g = nuevoGrupo('Pantalla', 'tv');
  cajaB(g, 0.36, 0.012, 0.22, M.metal, 0, 0, 0, 0.004);
  cajaB(g, 0.06, 0.07, 0.03, M.metal, 0, 0.012, -0.02);
  cajaB(g, W, h, 0.03, M.metal, 0, 0.07, -0.02, 0.004);
  cajaB(g, W - 0.014, h - 0.014, 0.002, M.espejo, 0, 0.077, -0.004);
  return g;
}

export function crearCloset(dims = {}, mats, estilo, rng) {
  const [M, E] = prep(mats, estilo, rng);
  const W = dims.ancho ?? 2.0, H = dims.alto ?? 2.4, D = dims.prof ?? 0.6;
  const g = nuevoGrupo('Clóset', 'closet');
  const zh = 0.08, zF = D / 2 - FT, Hc = E.forma === 'clasica' ? H - 0.06 : H;
  cajaB(g, W, zh, D - FT - 0.05, M.carpinteria2, 0, 0, -FT / 2 - 0.025);
  cajaB(g, W, Hc - zh, D - FT, M.carpinteria, 0, zh, -FT / 2, rM(E) * 0.5);
  if (E.forma === 'clasica') cajaB(g, W + 0.05, 0.06, D + 0.03, M.carpinteria, 0, Hc, 0, 0.01);
  const n = Math.max(2, Math.round(W / 0.5)), dw = W / n;
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + dw * (i + 0.5), der = i % 2 === 0;
    frente(g, M, E, x, zh + 0.003, zF, dw - 0.004, Hc - zh - 0.006, { jal: null });
    const hx = x + (der ? 1 : -1) * (dw / 2 - 0.05);
    if (E.forma === 'organica') cajaB(g, 0.014, 0.5, 0.004, M.carpinteria2, x + (der ? 1 : -1) * (dw / 2 - 0.02), 0.95, D / 2 + 0.002);
    else jaladera(g, M, E, hx, 1.1, D / 2, { largo: E.forma === 'recta' ? 0.6 : 0.4, vertical: true });
  }
  return g;
}

export function crearModuloVestidor(dims = {}, mats, estilo, rng) {
  const [M, E, R] = prep(mats, estilo, rng);
  const W = dims.ancho ?? 1.0, H = dims.alto ?? 2.3, D = dims.prof ?? 0.55, t = 0.022;
  const g = nuevoGrupo('Módulo de vestidor', 'vestidor');
  for (const s of [-1, 1]) cajaB(g, t, H, D, M.carpinteria, s * (W / 2 - t / 2), 0, 0, rM(E) * 0.5);
  cajaB(g, W, t, D, M.carpinteria, 0, H - t, 0);
  cajaB(g, W - 2 * t, 0.08, D - 0.03, M.carpinteria2, 0, 0, -0.015);
  cajaB(g, W - 2 * t, H - 0.08 - t, 0.012, M.carpinteria2, 0, 0.08, -D / 2 + 0.006);
  const yS = H - 0.36;
  cajaB(g, W - 2 * t, t, D - 0.012, M.carpinteria, 0, yS, 0.006);
  const yRod = yS - 0.07, largaRopa = R() < 0.5;
  poner(g, cil(0.012, 0.012, W - 2 * t, M.metal, 10), 0, yRod, 0, 0, 0, PI / 2);
  const telas = [M.textil, M.textil2, M.carpinteria2, M.colchon];
  const nR = Math.floor(((W - 0.12) / 0.065) * clamp(E.densidad, 0.6, 1.1));
  const yBase = largaRopa ? 0.25 : 0.62;
  for (let i = 0; i < nR; i++) {
    const x = -W / 2 + 0.07 + i * ((W - 0.14) / Math.max(1, nR - 1));
    const lg = largaRopa ? entre(R, 0.8, yRod - 0.33) : entre(R, 0.6, Math.min(0.85, yRod - yBase - 0.07));
    cajaB(g, entre(R, 0.02, 0.04), lg, entre(R, 0.42, 0.48), elegir(R, telas), x, yRod - 0.045 - lg, 0.0, 0.008);
    cajaB(g, 0.006, 0.04, 0.38, M.metal, x, yRod - 0.045, 0.0);
  }
  if (!largaRopa) {
    cajaB(g, W - 2 * t, t, D - 0.012, M.carpinteria, 0, 0.5, 0.006);
    frente(g, M, E, 0, 0.083, D / 2 - FT, W - 2 * t - 0.006, 0.2, { jal: 'cajon' });
    frente(g, M, E, 0, 0.286, D / 2 - FT, W - 2 * t - 0.006, 0.2, { jal: 'cajon' });
  }
  let x = -W / 2 + t + 0.03;
  while (x < W / 2 - t - 0.2) {
    const w = entre(R, 0.22, 0.32); if (x + w > W / 2 - t - 0.02) break;
    let y = yS + t; const n = 2 + Math.floor(R() * 4), m = elegir(R, telas);
    for (let k = 0; k < n; k++) { const h = entre(R, 0.03, 0.05); cajaB(g, w, h, 0.3, m, x + w / 2, y, 0.02, 0.01); y += h; }
    x += w + 0.06;
  }
  return g;
}

export function crearLavadora(dims = {}, mats, estilo, rng) {
  const [M] = prep(mats, estilo, rng);
  const W = 0.6, D = 0.6, H = 0.85, sec = dims.secadora;
  const g = nuevoGrupo(sec ? 'Secadora' : 'Lavadora', sec ? 'secadora' : 'lavadora');
  cajaB(g, W, H, D, M.ceramica, 0, 0, 0, 0.02);
  cajaB(g, W - 0.04, 0.09, 0.006, M.metal, 0, H - 0.12, D / 2);
  poner(g, cil(0.025, 0.025, 0.02, M.metal, 16), W / 2 - 0.12, H - 0.075, D / 2 + 0.01, PI / 2);
  poner(g, malla(new THREE.TorusGeometry(0.17, 0.022, 10, 32), M.metal), 0, 0.42, D / 2 + 0.01);
  poner(g, cil(0.155, 0.155, 0.012, sec ? M.espejo : M.vidrio, 32), 0, 0.42, D / 2 + 0.008, PI / 2);
  return g;
}

export function crearBanco(dims = {}, mats, estilo, rng) {
  const [M, E] = prep(mats, estilo, rng);
  const H = dims.alto ?? 0.65, g = nuevoGrupo('Banco alto', 'banco');
  const tp = tipoPatas(E) === 'ocultas' ? 'metal' : tipoPatas(E);
  patas(g, M, E, { w: 0.28, d: 0.28, h: H - 0.05, tipo: tp });
  if (E.forma === 'recta') cajaB(g, 0.38, 0.05, 0.36, M.textil, 0, H - 0.05, 0, 0.015);
  else cilB(g, 0.19, 0.19, 0.05, M.textil, 0, H - 0.05, 0, 24);
  poner(g, malla(new THREE.TorusGeometry(0.2, 0.008, 6, 24), tp === 'metal' ? M.metal : M.carpinteria), 0, 0.28, 0, PI / 2);
  return g;
}

export function crearBanca(dims = {}, mats, estilo, rng) {
  const [M, E] = prep(mats, estilo, rng);
  const W = dims.ancho ?? 1.2, D = dims.prof ?? 0.42, H = E.altura === 'baja' ? 0.4 : 0.45;
  const g = nuevoGrupo('Banca', 'banca');
  const hp = tipoPatas(E) === 'ocultas' ? 0.06 : 0.3;
  patas(g, M, E, { w: W - 0.1, d: D - 0.1, h: hp });
  if (hp > 0.1) cajaB(g, W, 0.04, D, M.carpinteria, 0, hp, 0, rM(E));
  const y = hp > 0.1 ? hp + 0.04 : hp;
  cajaB(g, W, H - y, D, M.textil2, 0, y, 0, rT(E));
  return g;
}

export function crearToallero(dims = {}, mats, estilo, rng) {
  const [M] = prep(mats, estilo, rng);
  const W = dims.ancho ?? 0.6, y = 1.1, g = nuevoGrupo('Toallero', 'toallero'), zw = -0.06;
  poner(g, cil(0.01, 0.01, W, M.metal, 10), 0, y, zw + 0.07, 0, 0, PI / 2);
  for (const s of [-1, 1]) poner(g, cil(0.009, 0.009, 0.07, M.metal, 8), s * (W / 2 - 0.03), y, zw + 0.035, PI / 2);
  cajaB(g, W * 0.7, 0.012, 0.05, M.textil, 0, y + 0.006, zw + 0.07, 0.005);
  cajaB(g, W * 0.7, 0.5, 0.012, M.textil, 0, y - 0.49, zw + 0.092, 0.005);
  cajaB(g, W * 0.7, 0.42, 0.012, M.textil, 0, y - 0.41, zw + 0.05, 0.005);
  return g;
}

/* ======================= colocación ======================= */

const HOLGURA = 0.13; // 0.05 de holgura + ~0.08 de medio muro

function enPoligono(x, z, P) {
  let d = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, zi] = P[i], [xj, zj] = P[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) d = !d;
  }
  return d;
}

export function rectanguloUtil(poligono) {
  const P = (poligono || []).map(p => [+p[0], +p[1]]).filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (P.length < 3) return null;
  const rnd = v => Math.round(v * 1000) / 1000;
  let xs = [...new Set(P.map(p => rnd(p[0])))].sort((a, b) => a - b);
  let zs = [...new Set(P.map(p => rnd(p[1])))].sort((a, b) => a - b);
  const recti = P.every((p, i) => { const q = P[(i + 1) % P.length]; return Math.abs(p[0] - q[0]) < 0.01 || Math.abs(p[1] - q[1]) < 0.01; });
  if (!recti || xs.length > 40 || zs.length > 40) {
    const rej = arr => { const a = arr[0], b = arr[arr.length - 1], n = Math.min(36, Math.max(2, Math.ceil((b - a) / 0.15))), o = []; for (let i = 0; i <= n; i++) o.push(a + ((b - a) * i) / n); return o; };
    xs = rej(xs); zs = rej(zs);
  }
  const nx = xs.length - 1, nz = zs.length - 1;
  if (nx < 1 || nz < 1) return null;
  const dentro = [];
  for (let i = 0; i < nx; i++) {
    dentro[i] = [];
    for (let j = 0; j < nz; j++) {
      const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2;
      let ok = enPoligono(cx, cz, P);
      if (ok && !recti) { const ex = (xs[i + 1] - xs[i]) * 0.49, ez = (zs[j + 1] - zs[j]) * 0.49; ok = enPoligono(cx - ex, cz - ez, P) && enPoligono(cx + ex, cz - ez, P) && enPoligono(cx - ex, cz + ez, P) && enPoligono(cx + ex, cz + ez, P); }
      dentro[i][j] = ok;
    }
  }
  let mejor = null, mejorA = 0;
  for (let i0 = 0; i0 < nx; i0++) {
    const col = new Array(nz).fill(true);
    for (let i1 = i0; i1 < nx; i1++) {
      for (let j = 0; j < nz; j++) col[j] = col[j] && dentro[i1][j];
      const w = xs[i1 + 1] - xs[i0];
      let j0 = -1;
      for (let j = 0; j <= nz; j++) {
        if (j < nz && col[j]) { if (j0 < 0) j0 = j; }
        else if (j0 >= 0) { const a = w * (zs[j] - zs[j0]); if (a > mejorA + 1e-9) { mejorA = a; mejor = { x0: xs[i0], x1: xs[i1 + 1], z0: zs[j0], z1: zs[j] }; } j0 = -1; }
      }
    }
  }
  return mejor;
}

function crearContexto(espacio, aberturas, M, E, R, g) {
  const R0 = rectanguloUtil(espacio.poligono);
  if (!R0) return null;
  const r = { x0: R0.x0 + HOLGURA, x1: R0.x1 - HOLGURA, z0: R0.z0 + HOLGURA, z1: R0.z1 - HOLGURA };
  if (r.x1 - r.x0 < 0.45 || r.z1 - r.z0 < 0.45) return null;
  const lados = {};
  for (const id of ['N', 'S', 'O', 'E']) {
    const h = id === 'N' || id === 'S';
    lados[id] = { id, ventanas: [], puertas: [], lo: h ? r.x0 : r.z0, hi: h ? r.x1 : r.z1 };
    lados[id].len = lados[id].hi - lados[id].lo;
  }
  // tramos de cada lado que no coinciden con un muro del polígono (p. ej. el lado interior de una L)
  const P = espacio.poligono.map(q => [+q[0], +q[1]]);
  const enBorde = (x, z) => P.some((p0, i) => {
    const p1 = P[(i + 1) % P.length], dx = p1[0] - p0[0], dz = p1[1] - p0[1], L2 = dx * dx + dz * dz || 1;
    const t = clamp(((x - p0[0]) * dx + (z - p0[1]) * dz) / L2, 0, 1);
    return Math.hypot(x - p0[0] - t * dx, z - p0[1] - t * dz) < 0.03;
  });
  for (const L of Object.values(lados)) {
    L.abiertos = [];
    const n = Math.max(2, Math.ceil(L.len / 0.1));
    let ini = null;
    for (let i = 0; i <= n; i++) {
      const u = L.lo + (L.len * i) / n;
      const [x, z] = L.id === 'N' ? [u, R0.z0] : L.id === 'S' ? [u, R0.z1] : L.id === 'O' ? [R0.x0, u] : [R0.x1, u];
      const ok = enBorde(x, z);
      if (!ok && ini === null) ini = u;
      if (ok && ini !== null) { L.abiertos.push([ini - 0.1, u]); ini = null; }
    }
    if (ini !== null) L.abiertos.push([ini - 0.1, L.hi + 0.1]);
  }
  const circulos = [];
  for (const a of aberturas || []) {
    if (!a || !Number.isFinite(+a.x) || !Number.isFinite(+a.z)) continue;
    const ax = +a.x, az = +a.z, tipo = a.tipo || 'puerta', ancho = +a.ancho > 0 ? +a.ancho : 0.9;
    if (tipo !== 'ventana') circulos.push({ x: ax, z: az, r: ancho + 0.3, ancho, tipo });
    const c = [['N', Math.abs(az - R0.z0), ax, R0.x0, R0.x1], ['S', Math.abs(az - R0.z1), ax, R0.x0, R0.x1], ['O', Math.abs(ax - R0.x0), az, R0.z0, R0.z1], ['E', Math.abs(ax - R0.x1), az, R0.z0, R0.z1]]
      .filter(q => q[2] > q[3] - 0.3 && q[2] < q[4] + 0.3 && q[1] < 0.45).sort((p, q) => p[1] - q[1]);
    if (c.length) { const [id, , u] = c[0]; lados[id][tipo === 'ventana' ? 'ventanas' : 'puertas'].push({ u0: u - ancho / 2, u1: u + ancho / 2, u }); }
  }
  const techo = clamp(+espacio.altura || 2.7, 2.2, 6);
  return { R0, r, lados, circulos, ocupado: [], g, M, E, rng: R, techo, area: (r.x1 - r.x0) * (r.z1 - r.z0) };
}

const fwd = ry => ({ x: Math.sin(ry), z: Math.cos(ry) });
const der = ry => ({ x: Math.cos(ry), z: -Math.sin(ry) });
const opuesto = id => ({ N: 'S', S: 'N', O: 'E', E: 'O' })[id];

function cajaLado(ctx, id, u, w, d) {
  const r = ctx.r;
  switch (id) {
    case 'N': return { x0: u - w / 2, x1: u + w / 2, z0: r.z0, z1: r.z0 + d, x: u, z: r.z0 + d / 2, ry: 0 };
    case 'S': return { x0: u - w / 2, x1: u + w / 2, z0: r.z1 - d, z1: r.z1, x: u, z: r.z1 - d / 2, ry: PI };
    case 'O': return { x0: r.x0, x1: r.x0 + d, z0: u - w / 2, z1: u + w / 2, x: r.x0 + d / 2, z: u, ry: PI / 2 };
    default: return { x0: r.x1 - d, x1: r.x1, z0: u - w / 2, z1: u + w / 2, x: r.x1 - d / 2, z: u, ry: -PI / 2 };
  }
}
function cajaCentro(x, z, w, d, ry) {
  const giro = Math.abs(Math.sin(ry)) > 0.5, a = giro ? d : w, b = giro ? w : d;
  return { x0: x - a / 2, x1: x + a / 2, z0: z - b / 2, z1: z + b / 2, x, z, ry };
}
const solapa = (a, b) => a.x0 < b.x1 - 1e-4 && a.x1 > b.x0 + 1e-4 && a.z0 < b.z1 - 1e-4 && a.z1 > b.z0 + 1e-4;
function libre(ctx, b, { alto = 0, puertas = true, ocupado = true } = {}) {
  const r = ctx.r, e = 1e-4;
  if (b.x0 < r.x0 - e || b.x1 > r.x1 + e || b.z0 < r.z0 - e || b.z1 > r.z1 + e) return false;
  if (ocupado) for (const o of ctx.ocupado) if (solapa(b, o)) return false;
  if (puertas) for (const c of ctx.circulos) { const dx = Math.max(b.x0 - c.x, 0, c.x - b.x1), dz = Math.max(b.z0 - c.z, 0, c.z - b.z1); if (dx * dx + dz * dz < c.r * c.r) return false; }
  if (alto > 0.95) {
    const L = ctx.lados, t = 0.03, chk = (id, a0, a1) => L[id].ventanas.some(v => a0 < v.u1 + 0.05 && a1 > v.u0 - 0.05);
    if (b.z0 <= r.z0 + t && chk('N', b.x0, b.x1)) return false;
    if (b.z1 >= r.z1 - t && chk('S', b.x0, b.x1)) return false;
    if (b.x0 <= r.x0 + t && chk('O', b.z0, b.z1)) return false;
    if (b.x1 >= r.x1 - t && chk('E', b.z0, b.z1)) return false;
  }
  return true;
}
function frenteDe(id, b, f) {
  switch (id) {
    case 'N': return { x0: b.x0, x1: b.x1, z0: b.z1, z1: b.z1 + f };
    case 'S': return { x0: b.x0, x1: b.x1, z0: b.z0 - f, z1: b.z0 };
    case 'O': return { x0: b.x1, x1: b.x1 + f, z0: b.z0, z1: b.z1 };
    default: return { x0: b.x0 - f, x1: b.x0, z0: b.z0, z1: b.z1 };
  }
}
function recortar(b, r) { return { x0: Math.max(b.x0, r.x0), x1: Math.min(b.x1, r.x1), z0: Math.max(b.z0, r.z0), z1: Math.min(b.z1, r.z1) }; }
function candidatos(lo, hi, w, pref, paso = 0.05) {
  const a = lo + w / 2, b = hi - w / 2;
  if (b < a - 1e-6) return [];
  const out = [], n = Math.floor((b - a) / paso + 1e-6);
  for (let i = 0; i <= n; i++) out.push(a + i * paso);
  if (b - out[out.length - 1] > 1e-4) out.push(b);
  const mid = (a + b) / 2;
  const key = typeof pref === 'number' ? u => Math.abs(u - pref) : pref === 'inicio' ? u => u - a : pref === 'fin' ? u => b - u : pref === 'extremos' ? u => Math.min(u - a, b - u) : u => Math.abs(u - mid);
  return out.sort((p, q) => key(p) - key(q));
}
function enMuro(ctx, id, w, d, { pref = 'centro', alto = 0, frente = 0, puertas = true } = {}) {
  const L = ctx.lados[id];
  for (const u of candidatos(L.lo, L.hi, w, pref)) {
    if (L.abiertos.some(([a0, a1]) => u - w / 2 < a1 && u + w / 2 > a0)) continue;
    const b = cajaLado(ctx, id, u, w, d);
    if (!libre(ctx, b, { alto, puertas })) continue;
    if (frente > 0 && !libre(ctx, frenteDe(id, b, frente), { puertas: false })) continue;
    return { ...b, u, lado: id };
  }
  return null;
}
function fijar(ctx, obj, p, { registrar = true, reservar = 0 } = {}) {
  obj.position.set(p.x, 0, p.z); obj.rotation.y = p.ry; ctx.g.add(obj);
  if (registrar) ctx.ocupado.push({ x0: p.x0, x1: p.x1, z0: p.z0, z1: p.z1 });
  if (reservar > 0 && p.lado) ctx.ocupado.push(recortar(frenteDe(p.lado, p, reservar), ctx.r));
  return obj;
}
function puntajeLado(ctx, id, evitarVentana) {
  const L = ctx.lados[id];
  return -L.puertas.length * 3 - (evitarVentana ? L.ventanas.length * 1.5 : 0) + (ctx.lados[opuesto(id)].puertas.length ? 1 : 0) + L.len * 0.3;
}
const ladosOrdenados = (ctx, evitarVentana = false) => ['N', 'S', 'O', 'E'].sort((a, b) => puntajeLado(ctx, b, evitarVentana) - puntajeLado(ctx, a, evitarVentana));
const ladosPorLargo = (ctx, excluir = []) => ['N', 'S', 'O', 'E'].filter(i => !excluir.includes(i)).sort((a, b) => ctx.lados[b].len - ctx.lados[a].len);

// planta en esquina libre (usa su caja real para no atravesar muros)
function ponerPlantas(ctx, n, opts = {}) {
  const { r, M, E, rng } = ctx;
  let puestas = 0;
  const esq = [[r.x0, r.z0, 1, 1], [r.x1, r.z0, -1, 1], [r.x0, r.z1, 1, -1], [r.x1, r.z1, -1, -1]].sort(() => rng() - 0.5);
  for (let k = 0; k < n; k++) {
    const p = crearPlanta({ alto: opts.alto ? opts.alto * entre(rng, 0.85, 1.15) : undefined, especie: opts.especie }, M, E, rng);
    const bb = new THREE.Box3().setFromObject(p), h = Math.max(-bb.min.x, bb.max.x, -bb.min.z, bb.max.z, 0.2);
    let ok = false;
    for (const [x, z, sx, sz] of esq) {
      const cx = x + sx * h, cz = z + sz * h, b = { x0: cx - h, x1: cx + h, z0: cz - h, z1: cz + h };
      if (!libre(ctx, b)) continue;
      p.position.set(cx, 0, cz); p.rotation.y = rng() * 2 * PI; ctx.g.add(p); ctx.ocupado.push(b); ok = true; puestas++; break;
    }
    if (!ok) {
      for (const id of ['N', 'S', 'O', 'E'].sort(() => rng() - 0.5)) {
        const q = enMuro(ctx, id, 2 * h, 2 * h, { pref: 'extremos' });
        if (q) { p.position.set(q.x, 0, q.z); p.rotation.y = rng() * 2 * PI; ctx.g.add(p); ctx.ocupado.push(q); ok = true; puestas++; break; }
      }
    }
    if (!ok) break;
  }
  return puestas;
}
function tapeteEn(ctx, cx, cz, w, l, ry) {
  const b = recortar(cajaCentro(cx, cz, w, l, ry), ctx.r);
  const giro = Math.abs(Math.sin(ry)) > 0.5;
  const W = giro ? b.z1 - b.z0 : b.x1 - b.x0, L = giro ? b.x1 - b.x0 : b.z1 - b.z0;
  if (W < 0.6 || L < 0.6) return;
  const t = crearTapete({ ancho: W, largo: L }, ctx.M, ctx.E, ctx.rng);
  t.position.set((b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2); t.rotation.y = ry; ctx.g.add(t);
}

/* ---------- por uso ---------- */

function amueblarRecamara(ctx) {
  const { R0, M, E, rng } = ctx;
  const corto = Math.min(R0.x1 - R0.x0, R0.z1 - R0.z0);
  const anchos = corto >= 3 ? (corto >= 3.5 ? [1.6, 1.4, 1.0] : [1.4, 1.0]) : [1.0, 0.9];
  const L = 2.0, bD = L + 0.08 + 0.02, buroW = 0.48, buroD = 0.4;
  let cama = null;
  fuera: for (const W of anchos) for (const id of ladosOrdenados(ctx, true)) for (const nb of [2, 0]) {
    const bw = W + 0.1, tw = bw + nb * (buroW + 0.03);
    const p = enMuro(ctx, id, tw, bD, { frente: 0.55 });
    if (p) { cama = { p, W, id, nb, bw }; break fuera; }
  }
  if (!cama) return;
  const { p, W, id, bw } = cama;
  const bp = cajaLado(ctx, id, p.u, bw, bD);
  fijar(ctx, crearCama({ ancho: W, largo: L }, M, E, rng), { ...bp, lado: id });
  for (const s of [-1, 1]) {
    const u = p.u + s * (bw / 2 + 0.02 + buroW / 2), q = cajaLado(ctx, id, u, buroW, buroD);
    if (!libre(ctx, q)) continue;
    const b = fijar(ctx, crearBuro({ ancho: buroW, prof: buroD }, M, E, rng), q);
    const l = crearLamparaMesa({ alto: 0.5 }, M, E, rng); l.position.set(0, b.userData.altoSuperficie, -0.03); b.add(l);
  }
  const f = fwd(bp.ry), head = { x: bp.x - f.x * bD / 2, z: bp.z - f.z * bD / 2 };
  const rl = 1.9, off = 0.85 + rl / 2;
  tapeteEn(ctx, head.x + f.x * off, head.z + f.z * off, bw + 1.1, rl, bp.ry);
  if (E.densidad >= 0.9) {
    const bw2 = Math.min(bw - 0.2, 1.3), c = { x: bp.x + f.x * (bD / 2 + 0.26), z: bp.z + f.z * (bD / 2 + 0.26) };
    const b = cajaCentro(c.x, c.z, bw2, 0.42, bp.ry), ext = cajaCentro(bp.x + f.x * (bD / 2 + 0.55), bp.z + f.z * (bD / 2 + 0.55), bw2, 1.0, bp.ry);
    if (libre(ctx, ext)) fijar(ctx, crearBanca({ ancho: bw2 }, M, E, rng), b);
  }
  let closet = false;
  for (const lid of ladosPorLargo(ctx, [id])) {
    for (let w = Math.min(2.4, ctx.lados[lid].len); w >= 1.0 && !closet; w -= 0.2) {
      const q = enMuro(ctx, lid, w, 0.6, { pref: 'extremos', alto: 2.4, frente: 0.6 });
      if (q) { fijar(ctx, crearCloset({ ancho: w }, M, E, rng), q, { reservar: 0.55 }); closet = true; }
    }
    if (closet) break;
  }
  if (!closet || E.densidad >= 1.15) {
    for (const lid of ladosPorLargo(ctx, [id])) { const q = enMuro(ctx, lid, 1.0, 0.48, { frente: 0.5 }); if (q) { fijar(ctx, crearAparador({ tipo: 'comoda', ancho: 1.0, prof: 0.48 }, M, E, rng), q); break; } }
  }
  if (E.densidad >= 1.0 && ctx.area >= 10) {
    for (const lid of ladosPorLargo(ctx, [id])) {
      const q = enMuro(ctx, lid, 0.88, 0.85, { pref: 'extremos', frente: 0.4 });
      if (q) {
        fijar(ctx, crearSillon({}, M, E, rng), q);
        if (E.densidad >= 1.15) { const l2 = enMuro(ctx, lid, 0.4, 0.4, { pref: q.u }); if (l2) fijar(ctx, crearLamparaPiso({ arco: false }, M, E, rng), l2); }
        break;
      }
    }
  }
  if (E.plantas > 0) ponerPlantas(ctx, Math.min(E.plantas, 2), { alto: 1.1 });
}

function amueblarSala(ctx, { exterior = false } = {}) {
  const { M, E, rng } = ctx;
  let sofa = null;
  fuera: for (const id of ladosOrdenados(ctx)) {
    for (let w = Math.min(2.4, ctx.lados[id].len - 0.3); w >= 1.4; w -= 0.2) {
      const p = enMuro(ctx, id, w, 0.92, { frente: 1.25 });
      if (p) { sofa = { p, w, d: 0.92, id }; break fuera; }
    }
  }
  if (!sofa) {
    for (const id of ladosOrdenados(ctx)) { const p = enMuro(ctx, id, 0.88, 0.85, { frente: 0.6 }); if (p) { fijar(ctx, crearSillon({}, M, E, rng), p); break; } }
    if (E.plantas > 0) ponerPlantas(ctx, 1);
    return;
  }
  const { p, w, d, id } = sofa;
  fijar(ctx, crearSofa({ ancho: w, prof: d }, M, E, rng), p);
  const f = fwd(p.ry), rg = der(p.ry);
  const mw = clamp(w * 0.55, 0.7, 1.3), md = 0.6, dist = d / 2 + 0.42 + md / 2;
  const tc = { x: p.x + f.x * dist, z: p.z + f.z * dist };
  const tb = cajaCentro(tc.x, tc.z, mw, md, p.ry);
  if (libre(ctx, tb)) fijar(ctx, crearMesaCentro({ ancho: mw, prof: md }, M, E, rng), tb);
  const ro = d / 2 - 0.25 + 1.1;
  tapeteEn(ctx, p.x + f.x * ro, p.z + f.z * ro, w + 0.7, 2.2, p.ry);
  [[1, 0.8], [-1, 1.1]].forEach(([s, umbral]) => {
    if (E.densidad < umbral) return;
    const c = { x: tc.x + rg.x * s * (mw / 2 + 0.4 + 0.43), z: tc.z + rg.z * s * (mw / 2 + 0.4 + 0.43) };
    const ry = Math.atan2(-rg.x * s, -rg.z * s), b = cajaCentro(c.x, c.z, 0.86, 0.86, ry);
    if (libre(ctx, b)) fijar(ctx, crearSillon({ ancho: 0.86, prof: 0.86 }, M, E, rng), b);
  });
  if (!exterior) {
    for (const s of [1, -1]) {
      const c = { x: p.x + rg.x * s * (w / 2 + 0.22) - f.x * (d / 2 - 0.22), z: p.z + rg.z * s * (w / 2 + 0.22) - f.z * (d / 2 - 0.22) };
      const b = cajaCentro(c.x, c.z, 0.36, 0.36, 0);
      if (!libre(ctx, b)) continue;
      const lam = crearLamparaPiso({ alcance: Math.min(0.9, w / 2) }, M, E, rng);
      fijar(ctx, lam, { ...b, ry: E.forma === 'organica' ? Math.atan2(-rg.x * s, -rg.z * s) : 0 });
      break;
    }
    const tvW = clamp(w * 0.85, 1.2, 1.9);
    const q = enMuro(ctx, opuesto(id), tvW, 0.45, { pref: p.u, frente: 0.3 }) || enMuro(ctx, opuesto(id), 1.2, 0.45, { frente: 0.3 });
    if (q) fijar(ctx, crearAparador({ tipo: 'tv', ancho: q.x1 - q.x0 > q.z1 - q.z0 ? q.x1 - q.x0 : q.z1 - q.z0 }, M, E, rng), q);
    if (E.densidad >= 1.05 || !q) {
      for (const lid of ladosPorLargo(ctx, [id])) {
        const lw = Math.min(1.6, ctx.lados[lid].len * 0.6);
        if (lw < 0.8) continue;
        const qq = enMuro(ctx, lid, lw, 0.35, { alto: 2.0, frente: 0.5 });
        if (qq) { fijar(ctx, crearLibrero({ ancho: lw }, M, E, rng), qq); break; }
      }
    }
  }
  ponerPlantas(ctx, exterior ? E.plantas + 1 : E.plantas, { alto: exterior ? 1.3 : undefined });
}

function amueblarComedor(ctx) {
  const { r, M, E, rng } = ctx;
  const W = r.x1 - r.x0, D = r.z1 - r.z0, largoX = W >= D, A = largoX ? W : D, B = largoX ? D : W;
  const cfgs = [{ n: 8, L: 2.2, P: 1.0 }, { n: 6, L: 1.8, P: 0.9 }, { n: 4, L: 1.2, P: 0.8 }, { n: 2, L: 0.8, P: 0.7 }].filter(c => E.densidad >= 0.8 || c.n !== 8);
  const ry = largoX ? 0 : PI / 2, cx0 = (r.x0 + r.x1) / 2, cz0 = (r.z0 + r.z1) / 2;
  let sel = null;
  fuera: for (const cfg of cfgs) for (const cl of [0.65, 0.5]) {
    const along = cfg.L + (cfg.n === 8 ? 2 * cl : 0.2), across = cfg.P + 2 * cl;
    if (along > A || across > B) continue;
    const ma = (A - along) / 2, mb = (B - across) / 2;
    const offs = [];
    for (let a = 0; a <= ma + 1e-6; a += 0.1) for (let b = 0; b <= mb + 1e-6; b += 0.1) for (const sa of a ? [1, -1] : [1]) for (const sb of b ? [1, -1] : [1]) offs.push([sa * a, sb * b]);
    offs.sort((p, q) => Math.hypot(...p) - Math.hypot(...q));
    for (const [oa, ob] of offs) {
      const cx = cx0 + (largoX ? oa : ob), cz = cz0 + (largoX ? ob : oa);
      const box = cajaCentro(cx, cz, along, across, ry);
      if (libre(ctx, box)) { sel = { cfg, cx, cz, box }; break fuera; }
    }
  }
  if (!sel) { if (E.plantas > 0) ponerPlantas(ctx, 1); return; }
  const { cfg, cx, cz, box } = sel;
  const redonda = E.forma === 'organica' && cfg.n <= 4;
  const mesa = crearMesa({ ancho: redonda ? Math.max(cfg.L, 1.1) : cfg.L, prof: redonda ? Math.max(cfg.L, 1.1) * 0.95 : cfg.P, redonda }, M, E, rng);
  mesa.position.set(cx, 0, cz); mesa.rotation.y = ry; ctx.g.add(mesa);
  ctx.ocupado.push(box);
  const rg = der(ry), f = fwd(ry);
  const k = cfg.n === 2 ? 1 : cfg.n === 4 ? 2 : 3, sp = cfg.L / k;
  const pos = [];
  for (let i = 0; i < k; i++) for (const s of [-1, 1]) pos.push([-cfg.L / 2 + sp * (i + 0.5), s * (cfg.P / 2 + 0.12), s > 0 ? ry + PI : ry]);
  if (cfg.n === 8) for (const s of [-1, 1]) pos.push([s * (cfg.L / 2 + 0.12), 0, Math.atan2(-rg.x * s, -rg.z * s)]);
  for (const [a, c, rr] of pos) {
    const s = crearSilla({}, M, E, rng);
    s.position.set(cx + rg.x * a + f.x * c, 0, cz + rg.z * a + f.z * c); s.rotation.y = rr; ctx.g.add(s);
  }
  const lamp = crearLamparaColgante({ largo: cfg.L >= 1.6 ? cfg.L * 0.7 : 0, techo: ctx.techo }, M, E, rng);
  lamp.position.set(cx, 0, cz); lamp.rotation.y = ry; ctx.g.add(lamp);
  if (E.densidad >= 0.8) for (const lid of ladosPorLargo(ctx)) {
    const aw = Math.min(1.8, ctx.lados[lid].len * 0.55);
    if (aw < 0.9) continue;
    const q = enMuro(ctx, lid, aw, 0.45, { frente: 0.5 });
    if (q) { fijar(ctx, crearAparador({ ancho: aw }, M, E, rng), q); break; }
  }
  if (E.plantas > 0) ponerPlantas(ctx, Math.min(2, E.plantas));
}

function intervalosLibres(ctx, id, d, opts = {}) {
  const L = ctx.lados[id], paso = 0.05, out = [];
  let ini = null;
  for (let u = L.lo; u < L.hi - 1e-6; u += paso) {
    const u1 = Math.min(L.hi, u + paso);
    const ok = !L.abiertos.some(([a0, a1]) => u < a1 && u1 > a0) && libre(ctx, cajaLado(ctx, id, (u + u1) / 2, u1 - u, d), opts);
    if (ok && ini === null) ini = u;
    if (!ok && ini !== null) { out.push([ini, u]); ini = null; }
  }
  if (ini !== null) out.push([ini, L.hi]);
  return out;
}
const signoLocal = id => (id === 'N' || id === 'E' ? 1 : -1);
// lado adyacente y punto de inicio de la "L" a partir de un extremo (lo/hi) del lado principal
function adyacente(ctx, id, extremo) {
  const r = ctx.r;
  const tabla = { N: { lo: ['O', 'lo'], hi: ['E', 'lo'] }, S: { lo: ['O', 'hi'], hi: ['E', 'hi'] }, O: { lo: ['N', 'lo'], hi: ['S', 'lo'] }, E: { lo: ['N', 'hi'], hi: ['S', 'hi'] } };
  return tabla[id][extremo];
}
function corridaCocina(ctx, id, a, b, { tarja = null, parrilla = null, superiores = true } = {}) {
  const { M, E, rng } = ctx;
  const run = b - a, uc = (a + b) / 2, sg = signoLocal(id);
  const p = cajaLado(ctx, id, uc, run, 0.6);
  const gab = crearGabinetes({ largo: run, tarja: tarja === null ? null : sg * (tarja - uc), parrilla: parrilla === null ? null : sg * (parrilla - uc) }, M, E, rng);
  fijar(ctx, gab, { ...p, lado: id }, { reservar: 0.9 });
  if (!superiores) return;
  const L = ctx.lados[id];
  let cortes = [[a, b]];
  const quitar = (q0, q1) => { cortes = cortes.flatMap(([x0, x1]) => (q1 <= x0 || q0 >= x1 ? [[x0, x1]] : [[x0, q0], [q1, x1]].filter(([m, n]) => n - m > 0))); };
  for (const v of L.ventanas) quitar(v.u0 - 0.08, v.u1 + 0.08);
  if (parrilla !== null) quitar(parrilla - 0.4, parrilla + 0.4);
  for (const [x0, x1] of cortes) {
    if (x1 - x0 < 0.35) continue;
    const q = cajaLado(ctx, id, (x0 + x1) / 2, x1 - x0, 0.35);
    const al = crearGabinetes({ superior: true, largo: x1 - x0 }, M, E, rng);
    al.position.set(q.x, 0, q.z); al.rotation.y = q.ry; ctx.g.add(al);
  }
  if (parrilla !== null) { const q = cajaLado(ctx, id, parrilla, 0.75, 0.5); const c = crearCampana({ techo: ctx.techo }, M, E, rng); c.position.set(q.x, 0, q.z); c.rotation.y = q.ry; ctx.g.add(c); }
}
function amueblarCocina(ctx) {
  const { R0, M, E, rng, lados } = ctx;
  let best = null;
  for (const id of ['N', 'S', 'O', 'E']) for (const iv of intervalosLibres(ctx, id, 0.6)) { const len = iv[1] - iv[0]; if (!best || len > best.len) best = { id, a: iv[0], b: iv[1], len }; }
  if (!best || best.len < 0.6) return;
  const id = best.id, Lw = lados[id];
  let a = best.a, b = best.b;
  const esqA = Math.abs(a - Lw.lo) < 0.06, esqB = Math.abs(b - Lw.hi) < 0.06;
  if (best.len >= 1.8) {
    const fw = best.len >= 2.6 ? 0.85 : 0.75, fd = 0.72;
    const ends = [['b', b - fw / 2], ['a', a + fw / 2]].sort((p, q) => ((p[0] === 'a' ? esqA : esqB) ? 1 : 0) - ((q[0] === 'a' ? esqA : esqB) ? 1 : 0));
    for (const [e, u] of ends) {
      const q = cajaLado(ctx, id, u, fw, fd);
      if (!libre(ctx, q, { alto: 1.9 })) continue;
      fijar(ctx, crearRefrigerador({ ancho: fw, prof: fd }, M, E, rng), q, { reservar: 0 });
      if (e === 'b') b -= fw + 0.02; else a += fw + 0.02;
      break;
    }
  }
  const run = b - a;
  if (run < 0.45) return;
  // L en una esquina libre
  let L2 = null;
  if (E.densidad >= 0.75) {
    for (const [e, esq] of [['hi', Math.abs(b - Lw.hi) < 0.06], ['lo', Math.abs(a - Lw.lo) < 0.06]]) {
      if (!esq) continue;
      const [aid, aext] = adyacente(ctx, id, e), La = lados[aid];
      const ini = aext === 'lo' ? La.lo + 0.6 : La.hi - 0.6;
      const iv = intervalosLibres(ctx, aid, 0.6).find(([x0, x1]) => ini >= x0 - 0.03 && ini <= x1 + 0.03);
      if (!iv) continue;
      const len = Math.min(2.4, aext === 'lo' ? iv[1] - ini : ini - iv[0]);
      if (len < 0.9) continue;
      L2 = { id: aid, a: aext === 'lo' ? ini : ini - len, b: aext === 'lo' ? ini + len : ini, esquina: e };
      break;
    }
  }
  // tarja y parrilla fuera de la esquina ciega
  const aa = a + (L2?.esquina === 'lo' ? 0.62 : 0), bb = b - (L2?.esquina === 'hi' ? 0.62 : 0), rr = bb - aa;
  const vent = Lw.ventanas.filter(v => v.u > aa + 0.35 && v.u < bb - 0.35);
  const tu = clamp(vent.length ? vent[0].u : aa + rr * (rr > 2 ? 0.35 : 0.5), aa + Math.min(0.36, rr / 2), bb - Math.min(0.36, rr / 2));
  let pu = null;
  if (rr >= 1.9) { pu = clamp(tu < (aa + bb) / 2 ? Math.max(tu + 0.9, bb - rr * 0.25) : Math.min(tu - 0.9, aa + rr * 0.25), aa + 0.36, bb - 0.36); if (Math.abs(pu - tu) < 0.75) pu = null; }
  if (pu === null && L2 && L2.b - L2.a >= 0.9) L2.parrilla = (L2.a + L2.b) / 2;
  corridaCocina(ctx, id, a, b, { tarja: tu, parrilla: pu });
  if (L2) corridaCocina(ctx, L2.id, L2.a, L2.b, { parrilla: L2.parrilla ?? null });
  const across = id === 'N' || id === 'S' ? R0.z1 - R0.z0 : R0.x1 - R0.x0;
  if (across >= 3.2 && E.densidad >= 0.8) {
    const idp = 1.2, pasillo = 0.9, banq = 0.35, prof = 0.6 + pasillo + idp + banq;
    let c = null, bxR = null, iw = 0, q0 = null;
    buscar: for (iw = clamp(run * 0.7, 1.2, 2.2); iw >= 1.2; iw -= 0.2) {
      for (const u of candidatos(Lw.lo, Lw.hi, iw, (a + b) / 2, 0.1)) {
        q0 = cajaLado(ctx, id, u, iw, prof);
        const f0 = fwd(q0.ry), bk = { x: q0.x - f0.x * prof / 2, z: q0.z - f0.z * prof / 2 };
        c = { x: bk.x + f0.x * (0.6 + pasillo + idp / 2), z: bk.z + f0.z * (0.6 + pasillo + idp / 2) };
        bxR = cajaCentro(c.x + f0.x * banq / 2, c.z + f0.z * banq / 2, iw, idp + banq, q0.ry);
        if (libre(ctx, bxR)) break buscar;
        c = null;
      }
    }
    const f = q0 ? fwd(q0.ry) : null;
    if (c) {
      const isla = crearGabinetes({ isla: true, largo: iw }, M, E, rng);
      isla.position.set(c.x, 0, c.z); isla.rotation.y = q0.ry; ctx.g.add(isla); ctx.ocupado.push(bxR);
      const rg = der(q0.ry), nb = Math.max(2, Math.floor(iw / 0.55));
      for (let i = 0; i < nb; i++) {
        const al = -iw / 2 + (iw / nb) * (i + 0.5), zz = idp / 2 - 0.1;
        const bn = crearBanco({}, M, E, rng);
        bn.position.set(c.x + rg.x * al + f.x * zz, 0, c.z + rg.z * al + f.z * zz); bn.rotation.y = q0.ry + PI; ctx.g.add(bn);
      }
    }
  }
  if (E.plantas >= 2) ponerPlantas(ctx, 1, { alto: 0.9 });
}

function amueblarBano(ctx) {
  const { M, E, rng, lados } = ctx;
  const along = { N: [1, 0], S: [1, 0], O: [0, 1], E: [0, 1] };
  const regadera = (w, d) => {
    let mejor = null;
    for (const id of ['N', 'S', 'O', 'E']) for (const ext of ['lo', 'hi']) {
      const L = lados[id];
      if (L.len < w - 1e-6) continue;
      const u = ext === 'lo' ? L.lo + w / 2 : L.hi - w / 2, q = cajaLado(ctx, id, u, w, d);
      if (L.abiertos.some(([a0, a1]) => u - w / 2 < a1 && u + w / 2 > a0) || !libre(ctx, q)) continue;
      const dist = ctx.circulos.length ? Math.min(...ctx.circulos.map(c => Math.hypot(c.x - q.x, c.z - q.z))) : 9;
      if (!mejor || dist > mejor.dist) mejor = { q: { ...q, lado: id }, w, d, id, ext, dist };
    }
    return mejor;
  };
  const wc = () => {
    for (const id of ladosOrdenados(ctx)) {
      const q = enMuro(ctx, id, 0.75, 0.72, { pref: 'extremos', frente: 0.45 }) || enMuro(ctx, id, 0.62, 0.72, { pref: 'extremos', frente: 0.35 });
      if (q) return q;
    }
    return null;
  };
  const lavabo = () => {
    for (const w of ctx.area < 5 ? [0.8, 0.6] : [1.0, 0.8, 0.6]) for (const id of ladosOrdenados(ctx, true)) {
      const q = enMuro(ctx, id, w, 0.5, { pref: 'extremos', alto: 1.9, frente: 0.6 }) || enMuro(ctx, id, w, 0.5, { pref: 'extremos', frente: 0.55 });
      if (q) return { ...q, w };
    }
    return null;
  };
  // plan: regadera (de mayor a menor) + WC + lavabo, en ambos órdenes; si no caben con la holgura completa de
  // puertas (ancho + 0.3), se reintenta con la holgura del abatimiento (ancho + 0.05) — baños chicos.
  const radios = ctx.circulos.map(c => c.r);
  let mejor = null;
  fuera: for (const holgura of [0.3, 0.05]) {
    ctx.circulos.forEach((c, i) => { c.r = radios[i] - 0.3 + holgura; });
    for (const tam of [[1.2, 0.9], [0.9, 1.2], [0.9, 0.9], [0.8, 0.8], null]) for (const orden of [['wc', 'lav'], ['lav', 'wc']]) {
      const n0 = ctx.ocupado.length, plan = { reg: null, wc: null, lav: null, holgura };
      if (tam) { plan.reg = regadera(...tam); if (!plan.reg) continue; ctx.ocupado.push(plan.reg.q, recortar(frenteDe(plan.reg.id, plan.reg.q, 0.5), ctx.r)); }
      for (const k of orden) {
        const q = k === 'wc' ? wc() : lavabo();
        if (q) { plan[k] = q; ctx.ocupado.push(q, recortar(frenteDe(q.lado, q, k === 'wc' ? 0.4 : 0.5), ctx.r)); }
      }
      ctx.ocupado.length = n0;
      const pts = (plan.wc ? 4 : 0) + (plan.lav ? 3 : 0) + (plan.reg ? 2 + plan.reg.w * plan.reg.d : 0) - (holgura < 0.3 ? 0.5 : 0);
      if (!mejor || pts > mejor.pts) mejor = { ...plan, pts };
      if (plan.wc && plan.lav && plan.reg) break fuera;
    }
  }
  ctx.circulos.forEach((c, i) => { c.r = radios[i] - 0.3 + (mejor ? mejor.holgura : 0.3); });
  if (mejor?.reg) {
    const { q, w, d, id, ext } = mejor.reg;
    const [ax, az] = along[id], s = ext === 'hi' ? 1 : -1, rg = der(q.ry);
    let muro = s * (ax * rg.x + az * rg.z) > 0 ? 'der' : 'izq';
    if (Math.abs(lados[id].len - w) < 0.06) muro = 'ambos';
    fijar(ctx, crearRegadera({ ancho: w, prof: d, muro }, M, E, rng), q, { reservar: 0.5 });
  }
  if (mejor?.wc) fijar(ctx, crearWC({}, M, E, rng), mejor.wc, { reservar: 0.4 });
  if (mejor?.lav) fijar(ctx, crearLavabo({ ancho: mejor.lav.w }, M, E, rng), mejor.lav, { reservar: 0.5 });
  for (const id of ['N', 'S', 'O', 'E'].sort(() => rng() - 0.5)) {
    const q = enMuro(ctx, id, 0.6, 0.12, { alto: 1.2 });
    if (q) { fijar(ctx, crearToallero({}, M, E, rng), q); break; }
  }
  ctx.circulos.forEach((c, i) => { c.r = radios[i]; });
  if (E.plantas >= 2 && ctx.area > 4) ponerPlantas(ctx, 1, { alto: 0.7, especie: 'monstera' });
}

function amueblarEstudio(ctx) {
  const { M, E, rng, lados } = ctx;
  const orden = ['N', 'S', 'O', 'E'].sort((a, b) => (lados[b].ventanas.length - lados[a].ventanas.length) || (puntajeLado(ctx, b) - puntajeLado(ctx, a)));
  let usado = null;
  for (const id of orden) {
    for (const w of [Math.min(1.5, lados[id].len - 0.1), 1.2, 1.0]) {
      if (w < 0.9) continue;
      const q = enMuro(ctx, id, w, 0.65, { frente: 0.85 });
      if (!q) continue;
      fijar(ctx, crearEscritorio({ ancho: w }, M, E, rng), q);
      const f = fwd(q.ry), sl = crearSilla({}, M, E, rng);
      sl.position.set(q.x + f.x * 0.55, 0, q.z + f.z * 0.55); sl.rotation.y = q.ry + PI; ctx.g.add(sl);
      ctx.ocupado.push(recortar(frenteDe(id, q, 0.85), ctx.r));
      usado = id; break;
    }
    if (usado) break;
  }
  for (const id of ladosPorLargo(ctx, [usado])) {
    const lw = Math.min(1.6, lados[id].len * 0.7);
    if (lw < 0.7) continue;
    const q = enMuro(ctx, id, lw, 0.35, { alto: 2.0, frente: 0.5 });
    if (q) { fijar(ctx, crearLibrero({ ancho: lw }, M, E, rng), q); break; }
  }
  if (E.densidad >= 1.0 && ctx.area >= 9) for (const id of ladosPorLargo(ctx, [usado])) { const q = enMuro(ctx, id, 0.88, 0.85, { pref: 'extremos', frente: 0.4 }); if (q) { fijar(ctx, crearSillon({}, M, E, rng), q); break; } }
  ponerPlantas(ctx, Math.max(E.plantas, 1));
}

function amueblarTerraza(ctx) {
  const { r, M, E, rng } = ctx;
  const W = r.x1 - r.x0, D = r.z1 - r.z0;
  if (Math.min(W, D) >= 2.6 && Math.max(W, D) >= 3.0) return amueblarSala(ctx, { exterior: true });
  let n = 0;
  for (const id of ladosPorLargo(ctx)) {
    const L = ctx.lados[id], k = Math.min(3, Math.floor(L.len / 0.95));
    if (k < 1) continue;
    for (let i = 0; i < k; i++) { const q = enMuro(ctx, id, 0.85, 2.0, { pref: 'inicio' }); if (q) { fijar(ctx, crearCamastro({}, M, E, rng), q); n++; } }
    if (n) break;
  }
  if (!n) {
    const b = cajaCentro((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, 0.7, 0.7, 0);
    if (Math.min(W, D) >= 1.6 && libre(ctx, b)) {
      fijar(ctx, crearMesaCentro({ ancho: 0.6, prof: 0.6, alto: 0.72, redonda: true, nombre: 'Mesa de terraza' }, M, E, rng), b);
      for (const s of [-1, 1]) { const ss = crearSilla({}, M, E, rng); const big = W >= D; ss.position.set(b.x + (big ? s * 0.55 : 0), 0, b.z + (big ? 0 : s * 0.55)); ss.rotation.y = big ? (s > 0 ? -PI / 2 : PI / 2) : (s > 0 ? PI : 0); ctx.g.add(ss); }
    }
  }
  ponerPlantas(ctx, E.plantas + 1, { alto: 1.3 });
}

function amueblarVestidor(ctx) {
  const { M, E, rng, lados } = ctx;
  let n = 0;
  for (const id of ladosPorLargo(ctx)) {
    for (const [x0, x1] of intervalosLibres(ctx, id, 0.55, { alto: 2.3 })) {
      const len = x1 - x0, k = Math.floor(len / 0.8);
      if (k < 1) continue;
      const mw = Math.min(1.1, len / k), total = mw * k, st = (x0 + x1) / 2 - total / 2;
      for (let i = 0; i < k; i++) {
        const q = cajaLado(ctx, id, st + mw * (i + 0.5), mw, 0.55);
        if (!libre(ctx, q, { alto: 2.3 }) || !libre(ctx, frenteDe(id, q, 0.6), { puertas: false })) continue;
        fijar(ctx, crearModuloVestidor({ ancho: mw }, M, E, rng), { ...q, lado: id }, { reservar: 0.6 }); n++;
      }
    }
    if (n >= 2 * Math.round(E.densidad * 3)) break;
  }
  void lados;
  const r = ctx.r, b = cajaCentro((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, 1.0, 0.42, (r.x1 - r.x0) >= (r.z1 - r.z0) ? 0 : PI / 2);
  if (E.densidad >= 1 && libre(ctx, b)) fijar(ctx, crearBanca({ ancho: 1.0 }, M, E, rng), b);
}

function amueblarLavanderia(ctx) {
  const { M, E, rng } = ctx;
  for (const id of ladosOrdenados(ctx)) {
    let q = enMuro(ctx, id, 1.24, 0.65, { frente: 0.6 }), dos = true;
    if (!q) { q = enMuro(ctx, id, 0.62, 0.65, { frente: 0.6 }); dos = false; }
    if (!q) continue;
    const g = nuevoGrupo('Lavadora y secadora', 'lavado');
    const l = crearLavadora({}, M, E, rng); l.position.x = dos ? -0.31 : 0; g.add(l);
    if (dos) { const s = crearLavadora({ secadora: true }, M, E, rng); s.position.x = 0.31; g.add(s); }
    fijar(ctx, g, q, { reservar: 0.5 });
    const al = crearGabinetes({ superior: true, largo: dos ? 1.24 : 0.62, base: 1.5 }, M, E, rng);
    const qa = cajaLado(ctx, id, q.u, 1, 0.35); al.position.set(qa.x, 0, qa.z); al.rotation.y = qa.ry; ctx.g.add(al);
    break;
  }
  for (const id of ladosOrdenados(ctx)) { const q = enMuro(ctx, id, 0.6, 0.6, { frente: 0.5 }); if (q) { fijar(ctx, crearGabinetes({ largo: 0.6, tarja: 0 }, M, E, rng), q); break; } }
}

function amueblarExterior(ctx, { camastros }) {
  const { M, E, rng } = ctx;
  if (camastros && ctx.area >= 12 && E.densidad >= 0.8) {
    for (const id of ladosPorLargo(ctx)) {
      let k = 0;
      for (let i = 0; i < 2; i++) { const q = enMuro(ctx, id, 0.85, 2.0, { pref: 'inicio' }); if (q) { fijar(ctx, crearCamastro({}, M, E, rng), q); k++; } }
      if (k) break;
    }
  }
  ponerPlantas(ctx, (camastros ? 2 : 1) + E.plantas, { alto: entre(rng, 1.4, 2.0) });
}

export function amueblar({ espacio, aberturas = [], mats, estilo, rng } = {}) {
  const M = resolverMats(mats), E = normalizarEstilo(estilo), R = rngDe(rng);
  const g = nuevoGrupo(`Mobiliario · ${espacio?.nombre || espacio?.uso || 'espacio'}`, 'mobiliario');
  if (!espacio || !Array.isArray(espacio.poligono) || espacio.poligono.length < 3) return g;
  g.userData.espacio = espacio.id;
  const ctx = crearContexto(espacio, aberturas, M, E, R, g);
  if (!ctx) return g;
  const uso = espacio.uso || 'otro';
  const ejecutar = () => {
    switch (uso) {
      case 'recamara': amueblarRecamara(ctx); break;
      case 'sala': amueblarSala(ctx); break;
      case 'comedor': amueblarComedor(ctx); break;
      case 'cocina': amueblarCocina(ctx); break;
      case 'bano': amueblarBano(ctx); break;
      case 'estudio': amueblarEstudio(ctx); break;
      case 'terraza': amueblarTerraza(ctx); break;
      case 'vestidor': amueblarVestidor(ctx); break;
      case 'lavanderia': amueblarLavanderia(ctx); break;
      case 'jardin': amueblarExterior(ctx, { camastros: true }); break;
      case 'alberca': amueblarExterior(ctx, { camastros: false }); break;
      case 'cochera': case 'bodega': break;
      default: if (E.plantas > 0 && ctx.area >= 3) ponerPlantas(ctx, 1);
    }
  };
  const PRINCIPAL = { recamara: 'cama', sala: 'sofa', comedor: 'mesa', cocina: 'gabinete', estudio: 'escritorio', terraza: null, vestidor: 'vestidor', lavanderia: 'lavado' };
  try {
    ejecutar();
    // si la holgura completa de puertas (ancho + 0.3) deja el espacio sin su mueble principal, se reintenta con la
    // holgura de paso (abatimiento + 0.05; corredizas y vanos 1.0 m) — típico de terrazas con corrediza ancha.
    const clave = PRINCIPAL[uso];
    const falta = uso in PRINCIPAL && (clave ? !g.children.some(c => c.userData.tipo === clave) : g.children.filter(c => c.userData.tipo !== 'planta').length === 0);
    if (falta && ctx.circulos.length) {
      while (g.children.length) { const c = g.children[0]; g.remove(c); c.traverse(o => o.geometry?.dispose?.()); }
      ctx.ocupado.length = 0;
      for (const c of ctx.circulos) c.r = Math.min(c.r, c.tipo === 'puerta' ? c.ancho + 0.05 : 1.0);
      ejecutar();
    }
  } catch (err) {
    console.warn('[mobiliario] no se pudo amueblar', espacio.nombre || uso, err);
  }
  return g;
}
