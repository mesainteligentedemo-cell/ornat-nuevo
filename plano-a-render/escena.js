// ORNAT · Plano a render — construye el modelo 3D (three.js) a partir del proyecto y los estilos.
// Muros extruidos con huecos reales de puertas y ventanas, losas, pisos por espacio, plafones (para vistas interiores),
// carpintería, cancelería y mobiliario por uso. Solo MeshStandard/MeshPhysical (compatibles con three-gpu-pathtracer).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { materialDe, uvMetros } from './texturas.js';
import { amueblar, rectanguloUtil } from './mobiliario.js';
import { centroide, puntoEnPoligono, areaPoligono, limites, estiloDe } from './modelo.js';

const EXTERIOR = new Set(['terraza', 'jardin', 'alberca']);
const HUMEDO = new Set(['bano', 'cocina', 'lavanderia', 'terraza']);
const sat = v => Math.min(1, Math.max(0, v));
const aclarar = (hex, k) => { const c = new THREE.Color(hex); c.lerp(new THREE.Color('#ffffff'), k); return `#${c.getHexString()}`; };

/* ---------- materiales por estilo (con caché) ---------- */
const matsCache = new Map();
export function materialesDe(estilo) {
  if (matsCache.has(estilo.id)) return matsCache.get(estilo.id);
  const st = (k, extra) => materialDe(estilo[k], { nombre: `${estilo.nombre} · ${k}`, ...extra });
  const textilTam = 256;
  const m = {
    piso: st('piso'), pisoHumedo: st('pisoHumedo'), muro: st('muro'), muroAcento: st('muroAcento'),
    carpinteria: st('carpinteria'), cubierta: st('cubierta'),
    carpinteria2: materialDe({ ...estilo.carpinteria, color: estilo.carpinteria.color2 || estilo.carpinteria.color, color2: estilo.carpinteria.color }, { nombre: `${estilo.nombre} · carpinteria2` }),
    textil: materialDe(estilo.textil, { nombre: `${estilo.nombre} · textil`, tam: textilTam }),
    textil2: materialDe(estilo.textil2, { nombre: `${estilo.nombre} · textil2`, tam: textilTam }),
    tapete: materialDe({ textura: 'alfombra', color: estilo.paleta[3], color2: estilo.paleta[1], rugosidad: 1, metalicidad: 0, escala: 1 }, { nombre: `${estilo.nombre} · tapete`, tam: textilTam }),
    metal: new THREE.MeshStandardMaterial({ name: `${estilo.nombre} · metal`, color: estilo.metal.color, roughness: estilo.metal.rugosidad, metalness: estilo.metal.metalicidad }),
    ceramica: new THREE.MeshPhysicalMaterial({ name: 'Cerámica sanitaria', color: '#f4f2ee', roughness: 0.12, clearcoat: 0.8, clearcoatRoughness: 0.05 }),
    vidrio: new THREE.MeshPhysicalMaterial({ name: 'Vidrio', color: '#ffffff', roughness: 0.02, metalness: 0, transmission: 1, thickness: 0.01, ior: 1.5, transparent: true, opacity: 0.25 }),
    espejo: new THREE.MeshStandardMaterial({ name: 'Espejo', color: '#e8eef0', roughness: 0.02, metalness: 1 }),
    emisivo: new THREE.MeshStandardMaterial({ name: 'Pantalla de lámpara', color: '#fff4e0', emissive: kelvin(estilo.iluminacion.temperaturaK), emissiveIntensity: 2.2 * estilo.iluminacion.intensidad, roughness: 0.9 }),
    foco: new THREE.MeshStandardMaterial({ name: 'Foco', color: '#ffffff', emissive: kelvin(estilo.iluminacion.temperaturaK), emissiveIntensity: 9 * estilo.iluminacion.intensidad, roughness: 0.5 }),
    hoja: new THREE.MeshStandardMaterial({ name: 'Hoja', color: '#3f6b35', roughness: 0.55, side: THREE.DoubleSide }),
    maceta: materialDe({ textura: 'concreto', color: estilo.paleta[1], color2: estilo.paleta[0], rugosidad: 0.85, metalicidad: 0, escala: 0.6 }, { nombre: 'Maceta', tam: 256 }),
    colchon: new THREE.MeshStandardMaterial({ name: 'Blancos', color: '#f1eee8', roughness: 0.92 }),
    libro: ['#7d3b2c', '#2f4a5c', '#c9b28a', '#4d5a3c'].map((c, i) => new THREE.MeshStandardMaterial({ name: `Libro ${i}`, color: c, roughness: 0.8 })),
    techo: materialDe({ textura: 'pintura', color: aclarar(estilo.muro.color, 0.55), color2: aclarar(estilo.muro.color, 0.6), rugosidad: 0.95, metalicidad: 0, escala: 2 }, { nombre: 'Plafón', extra: { side: THREE.DoubleSide } }),
    losa: new THREE.MeshStandardMaterial({ name: 'Losa', color: '#d9d4ca', roughness: 0.9 }),
    zoclo: st('carpinteria'),
    pasto: materialDe({ textura: 'pasto', color: '#6b8a3f', color2: '#3e5a28', rugosidad: 1, metalicidad: 0, escala: 2 }, { nombre: 'Pasto' }),
    agua: new THREE.MeshPhysicalMaterial({ name: 'Agua', color: '#bfe7ef', roughness: 0.03, transmission: 0.9, thickness: 1.2, ior: 1.33, attenuationColor: new THREE.Color('#3aa3b8'), attenuationDistance: 1.6, transparent: true, opacity: 0.6 }),
    mosaicoAlberca: materialDe({ textura: 'mosaico', color: '#5fb3c4', color2: '#3d8fa3', rugosidad: 0.3, metalicidad: 0, escala: 0.5 }, { nombre: 'Mosaico alberca' }),
    cancel: new THREE.MeshStandardMaterial({ name: 'Cancelería', color: estilo.metal.color, roughness: Math.max(0.3, estilo.metal.rugosidad), metalness: estilo.metal.metalicidad }),
  };
  matsCache.set(estilo.id, m); return m;
}
export function kelvin(K) {
  const t = K / 100; let r, g, b;
  if (t <= 66) { r = 255; g = 99.47 * Math.log(t) - 161.12; b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04; } else { r = 329.7 * Math.pow(t - 60, -0.1332); g = 288.12 * Math.pow(t - 60, -0.0755); b = 255; }
  return new THREE.Color(sat(r / 255), sat(g / 255), sat(b / 255));
}
function rngDe(seed) { let s = 0; for (const ch of String(seed)) s = (Math.imul(s, 31) + ch.charCodeAt(0)) | 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ---------- utilidades de geometría ---------- */
function caja(w, h, d, cx, cy, cz, rotY = 0) { const g = new THREE.BoxGeometry(w, h, d); g.rotateY(rotY); g.translate(cx, cy, cz); return g; }
function malla(geos, mat, nombre) { if (!geos.length) return null; const g = geos.length === 1 ? geos[0] : mergeGeometries(geos.map(x => x.index ? x.toNonIndexed() : x)); uvMetros(g); const m = new THREE.Mesh(g, mat); m.name = nombre; m.castShadow = m.receiveShadow = true; return m; }
const contorno = pts => { const s = new THREE.Shape(); const p = THREE.ShapeUtils.isClockWise(pts.map(([x, y]) => new THREE.Vector2(x, -y))) ? [...pts].reverse() : pts; p.forEach(([x, y], i) => (i ? s.lineTo(x, -y) : s.moveTo(x, -y))); return s; };
function placa(pts, y, mat, nombre, abajo = false) { const g = new THREE.ShapeGeometry(contorno(pts)); g.rotateX(-Math.PI / 2); if (abajo) g.scale(1, -1, 1); g.translate(0, y, 0); g.computeVertexNormals(); return malla([g], mat, nombre); }
function losaDe(pts, y, espesor, mat, nombre) { const g = new THREE.ExtrudeGeometry(contorno(pts), { depth: espesor, bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.translate(0, y - espesor, 0); return malla([g], mat, nombre); }

/** Huecos de un muro ordenados: [{ a, b, ab }] en metros a lo largo del muro. */
function huecos(muro, aberturas, L) { return aberturas.filter(a => a.muro === muro.id).map(a => ({ a: Math.max(0, a.pos - a.ancho / 2), b: Math.min(L, a.pos + a.ancho / 2), ab: a })).sort((p, q) => p.a - q.a); }

/* ---------- carpintería y cancelería ---------- */
function puerta(ab, H, t, M, rot) {
  const g = new THREE.Group(); g.name = 'Puerta'; const w = ab.ancho, h = Math.min(ab.alto, H - 0.02), marco = 0.05;
  const geos = [caja(marco, h, t + 0.02, -w / 2 + marco / 2, h / 2, 0), caja(marco, h, t + 0.02, w / 2 - marco / 2, h / 2, 0), caja(w, marco, t + 0.02, 0, h - marco / 2, 0)];
  const mm = malla(geos, M.carpinteria, 'Marco de puerta'); g.add(mm);
  const hoja = new THREE.Group(); const lw = w - marco * 2 - 0.01, lh = h - marco - 0.01;
  const hm = malla([caja(lw, lh, 0.04, lw / 2, lh / 2, 0)], M.carpinteria2, 'Hoja de puerta'); hoja.add(hm);
  const jal = malla([caja(0.02, 0.02, 0.14, lw - 0.08, 1.0, 0), caja(0.12, 0.02, 0.02, lw - 0.13, 1.0, 0.06), caja(0.12, 0.02, 0.02, lw - 0.13, 1.0, -0.06)], M.metal, 'Manija'); hoja.add(jal);
  hoja.position.set(-w / 2 + marco, 0, t / 2 - 0.02); hoja.rotation.y = -1.25; g.add(hoja);
  return g;
}
function ventana(ab, t, M, corrediza) {
  const g = new THREE.Group(); g.name = corrediza ? 'Cancel corredizo' : 'Ventana'; const w = ab.ancho, h = ab.alto, f = 0.045;
  const geos = [caja(w, f, 0.06, 0, f / 2, 0), caja(w, f, 0.06, 0, h - f / 2, 0), caja(f, h, 0.06, -w / 2 + f / 2, h / 2, 0), caja(f, h, 0.06, w / 2 - f / 2, h / 2, 0)];
  const hojas = corrediza ? 2 : w > 1.4 ? 2 : 1; for (let i = 1; i < hojas; i++) geos.push(caja(f, h, 0.06, -w / 2 + (w * i) / hojas, h / 2, 0));
  g.add(malla(geos, M.cancel, 'Cancelería'));
  const vid = new THREE.Mesh(new THREE.BoxGeometry(w - f * 2, h - f * 2, 0.008), M.vidrio); vid.position.set(0, h / 2, 0); vid.name = 'Vidrio'; g.add(vid);
  if (!corrediza) g.add(malla([caja(w + 0.06, 0.03, t + 0.06, 0, -0.015, 0)], M.cubierta, 'Repisón'));
  return g;
}

/* ---------- construcción ---------- */
/**
 * proyecto, catálogo -> { grupo, plantas: [{ id, grupo, y0, altura, lim, techos }], espacios: [{ id, plantaId, nombre, uso, y0, altura, poligono, puertas }] }
 * opciones: { techos: bool (plafones visibles), apilar: bool, separacion: m extra entre plantas, mobiliario: bool, lamina: { [laminaId]: HTMLImageElement|Canvas } }
 */
export function construirModelo(proyecto, { estiloPorId, porDefecto, techos = false, mobiliario = true, separacion = 0, laminas = {} } = {}) {
  const raiz = new THREE.Group(); raiz.name = proyecto.nombre || 'Proyecto ORNAT';
  const info = { grupo: raiz, plantas: [], espacios: [] };
  let y0 = 0;
  for (const pl of proyecto.plantas) {
    const estPl = estiloPorId(estiloDe(proyecto, pl, null, porDefecto)) || estiloPorId(porDefecto);
    const M = materialesDe(estPl); const H = pl.altura;
    const gp = new THREE.Group(); gp.name = pl.nombre; gp.position.y = y0; gp.userData = { planta: pl.id };
    // muros por tramos alrededor de los huecos
    const muroGeos = [], extras = new THREE.Group(); extras.name = 'Carpintería y cancelería';
    const abMundo = [];
    for (const m of pl.muros) {
      const dx = m.x2 - m.x1, dy = m.y2 - m.y1, L = Math.hypot(dx, dy); if (L < 0.05) continue;
      const ux = dx / L, uy = dy / L, rot = -Math.atan2(dy, dx), t = m.grosor, ext = t / 2;
      const tramo = (a, b, y1, y2) => { if (b - a < 0.005 || y2 - y1 < 0.005) return; const c = (a + b) / 2; muroGeos.push(caja(b - a, y2 - y1, t, m.x1 + ux * c, (y1 + y2) / 2, m.y1 + uy * c, rot)); };
      let cur = -ext; const hs = huecos(m, pl.aberturas, L);
      for (const { a, b, ab } of hs) {
        tramo(cur, a, -pl.losa, H); const sill = ab.tipo === 'ventana' ? ab.antepecho : 0, top = Math.min(H, sill + ab.alto);
        if (sill > 0) tramo(a, b, -pl.losa, sill); else tramo(a, b, -pl.losa, 0); tramo(a, b, top, H); cur = Math.max(cur, b);
        const c = (a + b) / 2, cx = m.x1 + ux * c, cz = m.y1 + uy * c; const nx = -uy, nz = ux;
        abMundo.push({ x: cx, z: cz, ancho: ab.ancho, tipo: ab.tipo, nx, nz, base: sill, alto: Math.min(ab.alto, H - sill), y0, t });
        let pieza = null;
        if (ab.tipo === 'puerta') pieza = puerta(ab, H, t, M, rot);
        else if (ab.tipo === 'ventana' || ab.tipo === 'corrediza') pieza = ventana(ab, t, M, ab.tipo === 'corrediza');
        if (pieza) { pieza.position.set(cx, ab.tipo === 'ventana' ? sill : 0, cz); pieza.rotation.y = rot; extras.add(pieza); }
      }
      tramo(cur, L + ext, -pl.losa, H);
    }
    const muros = malla(muroGeos, M.muro, 'Muros'); if (muros) { muros.userData.capa = 'muros'; gp.add(muros); }
    gp.add(extras);
    // espacios: losa, piso, plafón, muro de acento y mobiliario
    const pisos = new THREE.Group(); pisos.name = 'Pisos'; const techosG = new THREE.Group(); techosG.name = 'Plafones'; techosG.visible = techos; techosG.userData.capa = 'techos';
    const muebles = new THREE.Group(); muebles.name = 'Mobiliario'; muebles.visible = mobiliario; muebles.userData.capa = 'mobiliario';
    for (const e of pl.espacios) {
      const est = estiloPorId(estiloDe(proyecto, pl, e, porDefecto)) || estPl; const Me = materialesDe(est);
      const exterior = EXTERIOR.has(e.uso);
      if (e.uso === 'alberca') { pisos.add(alberca(e, Me)); }
      else {
        const matPiso = e.uso === 'jardin' ? Me.pasto : HUMEDO.has(e.uso) ? Me.pisoHumedo : Me.piso;
        const lo = losaDe(e.poligono, 0, pl.losa, Me.losa, `Losa · ${e.nombre}`); if (lo) pisos.add(lo);
        const pi = placa(e.poligono, 0.004, matPiso, `Piso · ${e.nombre}`); if (pi) { pi.userData.espacio = e.id; pisos.add(pi); }
      }
      if (!exterior) { const te = placa(e.poligono, H, Me.techo, `Plafón · ${e.nombre}`, true); if (te) techosG.add(te); }
      if (['sala', 'recamara', 'comedor', 'estudio'].includes(e.uso)) { const ac = muroAcento(e, pl, Me, H); if (ac) gp.add(ac); }
      if (mobiliario) {
        const [cx, cz] = centroide(e.poligono);
        const abs = abMundo.map(a => { const s = Math.sign((cx - a.x) * a.nx + (cz - a.z) * a.nz) || 1; return { ...a, nx: a.nx * s, nz: a.nz * s }; });
        const g = amueblar({ espacio: { id: e.id, nombre: e.nombre, uso: e.uso, poligono: e.poligono, altura: H }, aberturas: abs, mats: Me, estilo: est.mobiliario, rng: rngDe(`${e.id}|${est.id}`) });
        muebles.add(g);
      }
      const puertas = abMundo.filter(a => (a.tipo !== 'ventana') && cerca(e.poligono, a, 0.6));
      info.espacios.push({ id: e.id, plantaId: pl.id, nombre: e.nombre, uso: e.uso, y0, altura: H, poligono: e.poligono, puertas, ventanas: abMundo.filter(a => a.tipo === 'ventana' && cerca(e.poligono, a, 0.6)), exterior });
    }
    // losa de azotea sobre la huella de los muros (solo visible con plafones): sella rendijas entre plafones y muros
    if (pl.muros.length) { let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const m of pl.muros) { x0 = Math.min(x0, m.x1, m.x2); x1 = Math.max(x1, m.x1, m.x2); z0 = Math.min(z0, m.y1, m.y2); z1 = Math.max(z1, m.y1, m.y2); }
      const az = malla([caja(x1 - x0 + 0.3, 0.18, z1 - z0 + 0.3, (x0 + x1) / 2, H + 0.092, (z0 + z1) / 2)], M.losa, 'Losa de azotea'); if (az) techosG.add(az); }
    gp.add(pisos, techosG, muebles);
    // lámina original (para comparar)
    if (pl.lamina && laminas[pl.lamina.id]) gp.add(planoLamina(pl, laminas[pl.lamina.id]));
    raiz.add(gp);
    info.plantas.push({ id: pl.id, nombre: pl.nombre, grupo: gp, y0, altura: H, lim: limites(pl) });
    y0 += H + pl.losa + separacion;
  }
  return info;
}

function cerca(pts, a, tol) { for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1; const t = Math.max(0, Math.min(1, ((a.x - x1) * dx + (a.z - y1) * dy) / L2)); if (Math.hypot(a.x - x1 - t * dx, a.z - y1 - t * dy) < tol) return true; } return false; }

function muroAcento(e, pl, M, H) {
  // el lado más largo del espacio que coincide con un muro sin aberturas se recubre con el material de acento
  let mejor = null; const pts = e.poligono; const [cx, cy] = centroide(pts);
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; const L = Math.hypot(x2 - x1, y2 - y1); if (L < 1.8 || (mejor && L <= mejor.L)) continue;
    const muro = pl.muros.find(m => { const d1 = distLinea(m, x1, y1), d2 = distLinea(m, x2, y2); return d1 < m.grosor / 2 + 0.12 && d2 < m.grosor / 2 + 0.12 && paralelos(m, x1, y1, x2, y2); });
    if (!muro) continue;
    const libre = !pl.aberturas.some(a => { if (a.muro !== muro.id) return false; const Lm = Math.hypot(muro.x2 - muro.x1, muro.y2 - muro.y1); const ux = (muro.x2 - muro.x1) / Lm, uy = (muro.y2 - muro.y1) / Lm; const ax = muro.x1 + ux * a.pos, ay = muro.y1 + uy * a.pos; const t = ((ax - x1) * (x2 - x1) + (ay - y1) * (y2 - y1)) / (L * L); return t > -0.05 && t < 1.05; });
    if (libre) mejor = { L, x1, y1, x2, y2, muro };
  }
  if (!mejor) return null;
  const { x1, y1, x2, y2, L, muro } = mejor; const ux = (x2 - x1) / L, uy = (y2 - y1) / L; let nx = -uy, ny = ux; const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  if ((cx - mx) * nx + (cy - my) * ny < 0) { nx = -nx; ny = -ny; }
  const off = muro.grosor / 2 + 0.012; const largoUtil = L - muro.grosor - 0.04;
  const g = caja(largoUtil, H - 0.01, 0.02, mx + nx * off, (H - 0.01) / 2, my + ny * off, -Math.atan2(y2 - y1, x2 - x1));
  const m = malla([g], M.muroAcento, `Muro de acento · ${e.nombre}`); return m;
}
const distLinea = (m, x, y) => { const dx = m.x2 - m.x1, dy = m.y2 - m.y1, L = Math.hypot(dx, dy) || 1; return Math.abs((x - m.x1) * dy - (y - m.y1) * dx) / L; };
const paralelos = (m, x1, y1, x2, y2) => { const a = Math.atan2(m.y2 - m.y1, m.x2 - m.x1), b = Math.atan2(y2 - y1, x2 - x1); const d = Math.abs(((a - b) % Math.PI + Math.PI) % Math.PI); return d < 0.05 || Math.abs(d - Math.PI) < 0.05; };

function alberca(e, M) {
  const g = new THREE.Group(); g.name = `Alberca · ${e.nombre}`; const prof = 1.3;
  const r = rectanguloUtil(e.poligono) || null;
  const geos = [];
  const pts = e.poligono; const fondo = new THREE.ShapeGeometry(contorno(pts)); fondo.rotateX(-Math.PI / 2); fondo.translate(0, -prof, 0); geos.push(fondo);
  for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; const L = Math.hypot(x2 - x1, y2 - y1); geos.push(caja(L, prof, 0.05, (x1 + x2) / 2, -prof / 2, (y1 + y2) / 2, -Math.atan2(y2 - y1, x2 - x1))); }
  g.add(malla(geos, M.mosaicoAlberca, 'Vaso de alberca'));
  for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; const L = Math.hypot(x2 - x1, y2 - y1); g.add(malla([caja(L + 0.3, 0.05, 0.3, (x1 + x2) / 2, 0.0, (y1 + y2) / 2, -Math.atan2(y2 - y1, x2 - x1))], M.cubierta, 'Coronamiento')); }
  const agua = placa(pts, -0.12, M.agua, 'Agua'); if (agua) { agua.castShadow = false; g.add(agua); }
  g.userData.rect = r;
  return g;
}

function planoLamina(pl, img) {
  const k = pl.lamina.mPorPx; const w = (img.naturalWidth || img.width) * k, h = (img.naturalHeight || img.height) * k;
  const tex = new THREE.Texture(img); tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.92, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(-pl.lamina.x * k + w / 2, 0.012, -pl.lamina.y * k + h / 2); m.name = 'Lámina original'; m.visible = false; m.userData.capa = 'lamina'; m.renderOrder = 2;
  return m;
}

/** Muestra/oculta capas por nombre en todo el modelo: { techos, mobiliario, lamina, pisos } */
export function capas(grupo, estado) { grupo.traverse(o => { const c = o.userData?.capa; if (c && c in estado) o.visible = !!estado[c]; }); }

/** Cámara interior a altura de ojo (1.6 m) desde la esquina más cercana al acceso, mirando a la esquina opuesta. */
export function camaraInterior(esp, aspecto = 16 / 9, muebles = []) {
  const r = rectanguloUtil(esp.poligono) || (() => { const l = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity }; for (const [x, y] of esp.poligono) { l.x0 = Math.min(l.x0, x); l.z0 = Math.min(l.z0, y); l.x1 = Math.max(l.x1, x); l.z1 = Math.max(l.z1, y); } return l; })();
  const { x0, x1 } = r, y0 = r.z0, y1 = r.z1; const cx = (x0 + x1) / 2, cz = (y0 + y1) / 2;
  // candidatos: 4 esquinas (mirando a la opuesta) y 4 puntos medios de lado (mirando al centro y más allá)
  const ins = 0.4; const C = [[x0 + ins, y0 + ins], [x1 - ins, y0 + ins], [x1 - ins, y1 - ins], [x0 + ins, y1 - ins]];
  const cand = C.map((p, i) => ({ p, t: C[(i + 2) % 4], esquina: true }))
    .concat([[cx, y0 + ins], [x1 - ins, cz], [cx, y1 - ins], [x0 + ins, cz]].map(p => ({ p, t: [cx + (cx - p[0]) * 0.9, cz + (cz - p[1]) * 0.9], esquina: false })));
  const altos = muebles.filter(b => b.max.y > esp.y0 + 0.35);
  const holgura = ([x, z]) => altos.reduce((m, b) => Math.min(m, Math.hypot(Math.max(b.min.x - x, 0, x - b.max.x), Math.max(b.min.z - z, 0, z - b.max.z))), 9);
  const tapa = ({ p, t }) => { const dx = t[0] - p[0], dz = t[1] - p[1], L = Math.hypot(dx, dz) || 1; return altos.some(b => b.max.y > esp.y0 + 1.45 && [0.4, 0.8, 1.2, 1.6].some(s => { const x = p[0] + (dx / L) * s, z = p[1] + (dz / L) * s; return x > b.min.x && x < b.max.x && z > b.min.z && z < b.max.z; })); };
  const ref = esp.puertas[0] || null; const ven = [...esp.ventanas].sort((a, b) => b.ancho - a.ancho)[0];
  for (const c of cand) { c.h = holgura(c.p); c.bloq = tapa(c); c.score = (c.esquina ? 0 : 0.9) + Math.max(0, 1.4 - c.h) * 1.5 + (ref ? Math.hypot(c.p[0] - ref.x, c.p[1] - ref.z) * 0.25 : ven ? -Math.hypot(c.p[0] - ven.x, c.p[1] - ven.z) * 0.25 : 0); }
  const ok = cand.filter(c => c.h >= 0.7 && !c.bloq).sort((a, b) => a.score - b.score);
  const elegido = ok[0] || cand.sort((a, b) => b.h - a.h)[0];
  const [ex, ez] = elegido.p, [tx, tz] = elegido.t;
  const chico = Math.min(x1 - x0, y1 - y0) < 3;
  const cam = new THREE.PerspectiveCamera(esp.exterior ? 55 : chico ? 72 : 62, aspecto, 0.05, 200);
  cam.position.set(ex, esp.y0 + 1.6, ez); cam.lookAt(tx, esp.y0 + 1.05, tz); cam.userData.objetivo = new THREE.Vector3(tx, esp.y0 + 1.05, tz);
  return cam;
}

/** Cámara isométrica (ortográfica) encuadrando una planta o todo el conjunto. */
export function camaraIsometrica(caja3, aspecto = 16 / 9, margen = 1.12) {
  const c = caja3.getCenter(new THREE.Vector3()); const s = caja3.getSize(new THREE.Vector3());
  const dir = new THREE.Vector3(1, 1.6, 1).normalize(); /* ~49° de elevación: deja ver el interior sobre los muros */ const R = s.length() / 2;
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, R * 8 + 50);
  cam.position.copy(c).addScaledVector(dir, R * 3 + 10); cam.lookAt(c); cam.updateMatrixWorld();
  // encuadre: proyecta las 8 esquinas en el espacio de la cámara
  const inv = cam.matrixWorldInverse; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < 8; i++) { const v = new THREE.Vector3(i & 1 ? caja3.max.x : caja3.min.x, i & 2 ? caja3.max.y : caja3.min.y, i & 4 ? caja3.max.z : caja3.min.z).applyMatrix4(inv); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
  let w = (x1 - x0) * margen, h = (y1 - y0) * margen; if (w / h > aspecto) h = w / aspecto; else w = h * aspecto;
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2; cam.left = mx - w / 2; cam.right = mx + w / 2; cam.top = my + h / 2; cam.bottom = my - h / 2; cam.updateProjectionMatrix();
  cam.userData.objetivo = c; return cam;
}

/** Caja envolvente de un grupo ignorando la lámina (que es más grande que la planta). */
export function cajaDe(obj) { const b = new THREE.Box3(); obj.updateMatrixWorld(true); obj.traverse(o => { if (o.isMesh && o.visible !== false && o.userData?.capa !== 'lamina' && o.name !== 'Lámina original') { o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); b.union(bb); } }); return b; }

export { areaPoligono, puntoEnPoligono };
