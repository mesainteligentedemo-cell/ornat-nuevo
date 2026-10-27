// ORNAT · Plano a render — modelo del proyecto (puro, sin DOM ni three; probado con node --test).
//
// Unidades: metros. Ejes del plano: x a la derecha, y hacia abajo (como la imagen de la lámina).
// En 3D: plano x -> mundo x, plano y -> mundo z, altura -> mundo y.
//
// proyecto = {
//   version: 1, id, nombre, origen: 'ejemplo'|'ia'|'deteccion'|'manual', creado, actualizado,
//   estilo: idEstilo,                       // estilo global
//   laminas: [{ id, nombre, ancho, alto, src? }],  // tamaño en px; la imagen vive aparte (src solo para los ejemplos del sitio)
//   plantas: [planta]
// }
// planta = {
//   id, nombre, nivel (0 = planta baja), altura (m de piso a techo), losa (m de grosor),
//   estilo: idEstilo|null,                   // sobrescribe el global
//   escala: { confianza: 'alta'|'media'|'baja', fuente: 'ejemplo'|'ia'|'cota'|'calibracion'|'supuesta', nota },
//   lamina: { id, x, y, mPorPx } | null,     // dónde está esta planta en su lámina: el punto (0,0) m cae en el px (x,y)
//   muros: [{ id, x1, y1, x2, y2, grosor }],
//   aberturas: [{ id, muro, tipo: 'puerta'|'ventana'|'corrediza'|'vano', pos, ancho, alto, antepecho }],
//                                             // pos = distancia (m) desde (x1,y1) del muro al centro de la abertura
//   espacios: [{ id, nombre, uso, poligono: [[x,y],...], estilo: idEstilo|null }]
// }

export const VERSION = 1;

export const USOS = {
  sala: 'Sala', comedor: 'Comedor', cocina: 'Cocina', recamara: 'Recámara', bano: 'Baño', estudio: 'Estudio',
  terraza: 'Terraza', vestidor: 'Vestidor', lavanderia: 'Lavandería', circulacion: 'Circulación', escalera: 'Escalera',
  cochera: 'Cochera', bodega: 'Bodega', jardin: 'Jardín', alberca: 'Alberca', otro: 'Otro',
};
export const USO_KEYS = Object.keys(USOS);
export const TIPOS_ABERTURA = ['puerta', 'ventana', 'corrediza', 'vano'];
export const DEFAULTS = { altura: 2.7, losa: 0.2, grosorMuro: 0.15, puerta: { ancho: 0.9, alto: 2.1, antepecho: 0 }, ventana: { ancho: 1.2, alto: 1.2, antepecho: 0.9 }, corrediza: { ancho: 2.4, alto: 2.3, antepecho: 0 }, vano: { ancho: 1.0, alto: 2.3, antepecho: 0 } };
const LIM = { plantas: 8, muros: 600, aberturas: 300, espacios: 120, vertices: 64, coord: 500, texto: 80 };

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const num = (v, d = 0, min = -Infinity, max = Infinity) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
const str = (v, max = LIM.texto) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const r3 = n => Math.round(n * 1000) / 1000;
export const uid = (p = 'id') => `${p}-${(globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replace(/-/g, '').slice(0, 10)}`;
const SAFE_ID = /^[A-Za-z0-9_-]{1,40}$/;
const SRC_MUESTRA = /^muestras\/[a-z0-9-]{1,60}\.(png|webp|jpg)$/; // solo imágenes de ejemplo del propio sitio
const safeId = (v, p) => (SAFE_ID.test(String(v ?? '')) ? String(v) : uid(p));

/* ---------- geometría ---------- */
export const largo = m => Math.hypot(m.x2 - m.x1, m.y2 - m.y1);
export function areaPoligono(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i]; const [x2, y2] = pts[(i + 1) % pts.length]; a += x1 * y2 - x2 * y1; } return Math.abs(a) / 2; }
export function centroide(pts) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i]; const [x2, y2] = pts[(i + 1) % pts.length]; const f = x1 * y2 - x2 * y1; a += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f; }
  if (Math.abs(a) < 1e-9) { const n = pts.length || 1; return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n]; }
  return [cx / (3 * a), cy / (3 * a)];
}
export function puntoEnPoligono([x, y], pts) { let dentro = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro; } return dentro; }
/** Distancia de un punto a un segmento y parámetro t (0..1) de la proyección. */
export function distanciaASegmento([px, py], m) {
  const dx = m.x2 - m.x1, dy = m.y2 - m.y1; const L2 = dx * dx + dy * dy || 1e-12;
  const t = Math.max(0, Math.min(1, ((px - m.x1) * dx + (py - m.y1) * dy) / L2));
  return { d: Math.hypot(px - (m.x1 + t * dx), py - (m.y1 + t * dy)), t };
}
export function limites(planta) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  for (const m of planta.muros) { add(m.x1, m.y1); add(m.x2, m.y2); }
  for (const e of planta.espacios) for (const [x, y] of e.poligono) add(x, y);
  if (!Number.isFinite(x0)) return { x0: 0, y0: 0, x1: 1, y1: 1, ancho: 1, fondo: 1 };
  return { x0, y0, x1, y1, ancho: x1 - x0, fondo: y1 - y0 };
}

/** Coloca una abertura sobre el muro más cercano a un punto (x,y). Devuelve null si no hay muro a menos de `tolerancia` m. */
export function ajustarAberturaAMuro(planta, { x, y, tipo = 'puerta', ancho, alto, antepecho }, tolerancia = 0.6) {
  let mejor = null;
  for (const m of planta.muros) { const { d, t } = distanciaASegmento([x, y], m); if (!mejor || d < mejor.d) mejor = { d, t, m }; }
  if (!mejor || mejor.d > tolerancia) return null;
  const t0 = TIPOS_ABERTURA.includes(tipo) ? tipo : 'puerta'; const def = DEFAULTS[t0]; const L = largo(mejor.m);
  const w = Math.min(num(ancho, def.ancho, 0.3, 8), Math.max(0.3, L - 0.1));
  const pos = Math.min(Math.max(mejor.t * L, w / 2 + 0.02), L - w / 2 - 0.02);
  return { id: uid('ab'), muro: mejor.m.id, tipo: t0, pos: r3(pos), ancho: r3(w), alto: r3(num(alto, def.alto, 0.3, 4)), antepecho: r3(num(antepecho, def.antepecho, 0, 3)) };
}

/** Multiplica todas las coordenadas de una planta por k (calibración de escala). */
export function escalarPlanta(planta, k) {
  if (!(k > 0) || !Number.isFinite(k)) throw new Error('Factor de escala no válido.');
  for (const m of planta.muros) { m.x1 = r3(m.x1 * k); m.y1 = r3(m.y1 * k); m.x2 = r3(m.x2 * k); m.y2 = r3(m.y2 * k); }
  for (const a of planta.aberturas) a.pos = r3(a.pos * k);
  for (const e of planta.espacios) e.poligono = e.poligono.map(([x, y]) => [r3(x * k), r3(y * k)]);
  if (planta.lamina?.mPorPx) planta.lamina.mPorPx *= k;
  return planta;
}

/** Une muros colineales que se tocan (limpieza tras la detección o la edición). */
export function fusionarMuros(muros, tol = 0.05) {
  const out = muros.map(m => ({ ...m })); let cambio = true;
  const horiz = m => Math.abs(m.y1 - m.y2) < tol, vert = m => Math.abs(m.x1 - m.x2) < tol;
  while (cambio) {
    cambio = false;
    for (let i = 0; i < out.length && !cambio; i++) for (let j = i + 1; j < out.length && !cambio; j++) {
      const a = out[i], b = out[j];
      if (horiz(a) && horiz(b) && Math.abs(a.y1 - b.y1) < tol && Math.abs(a.grosor - b.grosor) < 0.08) {
        const [a0, a1] = [Math.min(a.x1, a.x2), Math.max(a.x1, a.x2)], [b0, b1] = [Math.min(b.x1, b.x2), Math.max(b.x1, b.x2)];
        if (b0 <= a1 + tol && a0 <= b1 + tol) { Object.assign(a, { x1: Math.min(a0, b0), x2: Math.max(a1, b1), y2: a.y1, grosor: Math.max(a.grosor, b.grosor) }); out.splice(j, 1); cambio = true; }
      } else if (vert(a) && vert(b) && Math.abs(a.x1 - b.x1) < tol && Math.abs(a.grosor - b.grosor) < 0.08) {
        const [a0, a1] = [Math.min(a.y1, a.y2), Math.max(a.y1, a.y2)], [b0, b1] = [Math.min(b.y1, b.y2), Math.max(b.y1, b.y2)];
        if (b0 <= a1 + tol && a0 <= b1 + tol) { Object.assign(a, { y1: Math.min(a0, b0), y2: Math.max(a1, b1), x2: a.x1, grosor: Math.max(a.grosor, b.grosor) }); out.splice(j, 1); cambio = true; }
      }
    }
  }
  return out;
}

/* ---------- normalización (todo lo que entra: archivo JSON, localStorage, IA, detección) ---------- */
function normalizarPlanta(p, i, estilosValidos) {
  const P = isObj(p) ? p : {};
  const muros = (Array.isArray(P.muros) ? P.muros : []).filter(isObj).slice(0, LIM.muros).map(m => ({
    id: safeId(m.id, 'mu'), x1: r3(num(m.x1, 0, -LIM.coord, LIM.coord)), y1: r3(num(m.y1, 0, -LIM.coord, LIM.coord)), x2: r3(num(m.x2, 0, -LIM.coord, LIM.coord)), y2: r3(num(m.y2, 0, -LIM.coord, LIM.coord)), grosor: r3(num(m.grosor, DEFAULTS.grosorMuro, 0.05, 1)),
  })).filter(m => largo(m) >= 0.05);
  const ids = new Set(muros.map(m => m.id));
  const aberturas = (Array.isArray(P.aberturas) ? P.aberturas : []).filter(isObj).slice(0, LIM.aberturas).map(a => {
    const tipo = TIPOS_ABERTURA.includes(a.tipo) ? a.tipo : 'puerta'; const def = DEFAULTS[tipo];
    return { id: safeId(a.id, 'ab'), muro: String(a.muro ?? ''), tipo, pos: r3(num(a.pos, 0, 0, LIM.coord)), ancho: r3(num(a.ancho, def.ancho, 0.3, 8)), alto: r3(num(a.alto, def.alto, 0.3, 4)), antepecho: r3(num(a.antepecho, def.antepecho, 0, 3)) };
  }).filter(a => ids.has(a.muro));
  const espacios = (Array.isArray(P.espacios) ? P.espacios : []).filter(isObj).slice(0, LIM.espacios).map((e, k) => ({
    id: safeId(e.id, 'es'), nombre: str(e.nombre) || `Espacio ${k + 1}`, uso: USO_KEYS.includes(e.uso) ? e.uso : 'otro',
    poligono: (Array.isArray(e.poligono) ? e.poligono : []).slice(0, LIM.vertices).map(pt => Array.isArray(pt) ? [r3(num(pt[0], 0, -LIM.coord, LIM.coord)), r3(num(pt[1], 0, -LIM.coord, LIM.coord))] : isObj(pt) ? [r3(num(pt.x, 0, -LIM.coord, LIM.coord)), r3(num(pt.y, 0, -LIM.coord, LIM.coord))] : null).filter(Boolean),
    estilo: estilosValidos(e.estilo) ? e.estilo : null,
  })).filter(e => e.poligono.length >= 3 && areaPoligono(e.poligono) > 0.2);
  const esc = isObj(P.escala) ? P.escala : {};
  const lam = isObj(P.lamina) ? P.lamina : null;
  return {
    id: safeId(P.id, 'pl'), nombre: str(P.nombre) || `Planta ${i + 1}`, nivel: Math.round(num(P.nivel, i, -3, 40)),
    altura: r3(num(P.altura, DEFAULTS.altura, 2, 8)), losa: r3(num(P.losa, DEFAULTS.losa, 0.08, 0.6)),
    estilo: estilosValidos(P.estilo) ? P.estilo : null,
    escala: { confianza: ['alta', 'media', 'baja'].includes(esc.confianza) ? esc.confianza : 'baja', fuente: ['ejemplo', 'ia', 'cota', 'calibracion', 'supuesta'].includes(esc.fuente) ? esc.fuente : 'supuesta', nota: str(esc.nota, 200) },
    lamina: lam && SAFE_ID.test(String(lam.id ?? '')) ? { id: String(lam.id), x: num(lam.x, 0), y: num(lam.y, 0), mPorPx: num(lam.mPorPx, 0.02, 1e-5, 10) } : null,
    muros, aberturas, espacios,
  };
}

/** Limpia cualquier objeto de proyecto. `esEstilo(id)` dice si un id de estilo existe (lo pasa la app con el catálogo). */
export function normalizarProyecto(raw, { esEstilo = () => false } = {}) {
  const R = isObj(raw) ? raw : {};
  for (const k of ['__proto__', 'prototype', 'constructor']) if (Object.prototype.hasOwnProperty.call(R, k)) throw new Error('Proyecto con claves no permitidas.');
  const plantas = (Array.isArray(R.plantas) ? R.plantas : []).slice(0, LIM.plantas).map((p, i) => normalizarPlanta(p, i, esEstilo));
  const laminas = (Array.isArray(R.laminas) ? R.laminas : []).filter(isObj).slice(0, 20).map((l, i) => ({ id: safeId(l.id, 'la'), nombre: str(l.nombre, 120) || `Lámina ${i + 1}`, ancho: Math.round(num(l.ancho, 0, 0, 20000)), alto: Math.round(num(l.alto, 0, 0, 20000)), ...(SRC_MUESTRA.test(String(l.src ?? '')) ? { src: l.src } : {}) }));
  const now = new Date().toISOString();
  return {
    version: VERSION, id: safeId(R.id, 'pr'), nombre: str(R.nombre, 120) || 'Proyecto sin nombre',
    origen: ['ejemplo', 'ia', 'deteccion', 'manual'].includes(R.origen) ? R.origen : 'manual',
    creado: str(R.creado, 40) || now, actualizado: now,
    estilo: esEstilo(R.estilo) ? R.estilo : null, laminas, plantas: plantas.sort((a, b) => a.nivel - b.nivel),
  };
}

/** Resumen accesible (alternativa textual del canvas). */
export function resumenPlanta(planta) {
  const area = planta.espacios.reduce((s, e) => s + areaPoligono(e.poligono), 0);
  return { espacios: planta.espacios.length, muros: planta.muros.length, aberturas: planta.aberturas.length, areaM2: Math.round(area * 10) / 10 };
}

/** Estilo efectivo de un espacio: el del espacio, si no el de su planta, si no el global, si no el primero. */
export const estiloDe = (proyecto, planta, espacio, porDefecto) => espacio?.estilo || planta?.estilo || proyecto?.estilo || porDefecto;

/** Convierte la geometría en px que entrega la detección local a metros con `mPorPx` (origen en la esquina superior izquierda del recorte). */
export function plantaDesdePx({ muros = [], espacios = [], aberturas = [], recorte = { x: 0, y: 0 } }, mPorPx, extra = {}) {
  const k = mPorPx, ox = recorte.x || 0, oy = recorte.y || 0; const X = x => r3((x - ox) * k), Y = y => r3((y - oy) * k);
  const pl = {
    id: uid('pl'), nombre: extra.nombre || 'Planta', nivel: extra.nivel ?? 0, altura: DEFAULTS.altura, losa: DEFAULTS.losa, estilo: null,
    escala: { confianza: extra.confianza || 'baja', fuente: extra.fuente || 'supuesta', nota: extra.nota || '' },
    lamina: extra.laminaId ? { id: extra.laminaId, x: ox, y: oy, mPorPx: k } : null,
    muros: muros.map(m => ({ id: uid('mu'), x1: X(m.x1), y1: Y(m.y1), x2: X(m.x2), y2: Y(m.y2), grosor: r3(Math.max(0.08, Math.min(0.6, (m.grosor || 6) * k))) })),
    aberturas: [], espacios: espacios.map((e, i) => ({ id: uid('es'), nombre: e.nombre || `Espacio ${i + 1}`, uso: USO_KEYS.includes(e.uso) ? e.uso : 'otro', poligono: e.poligono.map(([x, y]) => [X(x), Y(y)]), estilo: null })),
  };
  for (const a of aberturas) { const ab = ajustarAberturaAMuro(pl, { x: X(a.x), y: Y(a.y), tipo: a.tipo, ancho: a.ancho ? a.ancho * k : undefined }); if (ab) pl.aberturas.push(ab); }
  return pl;
}

/* ---------- serialización ---------- */
export const aJSON = proyecto => JSON.stringify(proyecto, null, 2);
export function desdeJSON(texto, opciones) {
  if (typeof texto !== 'string' || texto.length > 5_000_000) throw new Error('Archivo de proyecto no válido o demasiado grande.');
  let raw; try { raw = JSON.parse(texto); } catch { throw new Error('El archivo no es un JSON válido.'); }
  if (!isObj(raw) || !Array.isArray(raw.plantas)) throw new Error('El archivo no parece un proyecto de Plano a render.');
  return normalizarProyecto(raw, opciones);
}
