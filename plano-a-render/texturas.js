// ORNAT · Plano a render — texturas PBR procedurales en canvas (sin descargas).
// Cada textura es periódica (se repite sin costura) y cubre `escala` metros; la geometría lleva UV en metros.
// Devuelve { mapa, normal } como THREE.CanvasTexture. Todo determinista por semilla.
import * as THREE from 'three';

const N = 512;
const hex = c => { const n = parseInt(String(c || '#888888').slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mezcla = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const tono = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
const clamp = v => (v < 0 ? 0 : v > 255 ? 255 : v);
const sat = v => (v < 0 ? 0 : v > 1 ? 1 : v);

/* ---------- ruido periódico (value noise con retícula envuelta) ---------- */
function hash(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function ruido(x, y, periodo, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const w = v => ((v % periodo) + periodo) % periodo;
  const a = hash(w(xi), w(yi), s), b = hash(w(xi + 1), w(yi), s), c = hash(w(xi), w(yi + 1), s), d = hash(w(xi + 1), w(yi + 1), s);
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** fbm periódico: (u,v) en [0,1); `base` = celdas en la primera octava. */
function fbm(u, v, base, oct, s) { let f = 0, amp = 0.5, tot = 0, p = base; for (let o = 0; o < oct; o++) { f += amp * ruido(u * p, v * p, p, s + o * 17); tot += amp; amp *= 0.5; p *= 2; } return f / tot; }
function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

/* ---------- generadores: escriben color (rgb) y altura (0..1) por píxel ---------- */
// Cada generador recibe (spec, n) y devuelve { col: Float32Array(n*n*3), alt: Float32Array(n*n) | null }
function lienzo(n) { return { col: new Float32Array(n * n * 3), alt: new Float32Array(n * n) }; }
const put = (T, i, c) => { T.col[i * 3] = c[0]; T.col[i * 3 + 1] = c[1]; T.col[i * 3 + 2] = c[2]; };

function liso(spec, n, amp = 0.02, base = 4) {
  const T = lienzo(n); const c1 = hex(spec.color), c2 = hex(spec.color2 || spec.color);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const u = x / n, v = y / n; const f = fbm(u, v, base, 5, 3); const g = hash(x, y, 9); put(T, y * n + x, tono(mezcla(c1, c2, f * 0.6), 1 + (f - 0.5) * amp * 4 + (g - 0.5) * amp)); T.alt[y * n + x] = f * 0.3 + g * 0.05; }
  return T;
}
const G = {
  pintura: (s, n) => liso(s, n, 0.012, 3),
  laca: (s, n) => liso(s, n, 0.006, 2),
  aplanado: (s, n) => { const T = liso(s, n, 0.05, 6); return T; },
  terciopelo: (s, n) => liso(s, n, 0.05, 5),
  alfombra: (s, n) => { const T = liso(s, n, 0.08, 16); return T; },
  concreto(s, n) {
    const T = lienzo(n); const c1 = hex(s.color), c2 = hex(s.color2 || s.color); const R = rng(7);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const u = x / n, v = y / n; const f = fbm(u, v, 3, 6, 11); const g = fbm(u, v, 24, 2, 5); put(T, y * n + x, tono(mezcla(c1, c2, sat(f * 1.4 - 0.2)), 0.94 + g * 0.12)); T.alt[y * n + x] = f * 0.4 + g * 0.2; }
    for (let k = 0; k < 900; k++) { const px = Math.floor(R() * n), py = Math.floor(R() * n), r = 1 + Math.floor(R() * 2); for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (dx * dx + dy * dy > r * r) continue; const i = ((py + dy + n) % n) * n + ((px + dx + n) % n); T.col[i * 3] *= 0.8; T.col[i * 3 + 1] *= 0.8; T.col[i * 3 + 2] *= 0.8; T.alt[i] -= 0.4; } }
    return T;
  },
  madera(s, n) {
    // duela: 6 tablas por repetición, juntas escalonadas, veta a lo largo de x
    const T = lienzo(n); const c1 = hex(s.color), c2 = hex(s.color2 || s.color); const R = rng(21);
    const tablas = 6, h = n / tablas; const cortes = Array.from({ length: tablas }, () => R()); const tinte = Array.from({ length: tablas * 2 }, () => 0.88 + R() * 0.22);
    for (let y = 0; y < n; y++) { const t = Math.floor(y / h), yy = (y % h) / h; for (let x = 0; x < n; x++) {
      const u = x / n, v = y / n; const seg = (u + cortes[t]) % 1 < 0.5 ? 0 : 1; const junta = Math.min(Math.abs(((u + cortes[t]) % 0.5) * n), Math.abs(0.5 * n - ((u + cortes[t]) % 0.5) * n));
      const ondas = fbm(u, v, 2, 3, 30 + t) * 6; const veta = 0.5 + 0.5 * Math.sin((yy * 9 + ondas + t * 3.7) * Math.PI * 2 + fbm(u, v * 0.2, 8, 3, 40) * 4);
      const fino = fbm(u, v, 64, 2, 50 + t);
      let c = mezcla(c1, c2, sat(veta * 0.75 + fino * 0.35)); c = tono(c, tinte[t * 2 + seg] * (0.95 + fino * 0.1));
      const borde = yy < 0.03 || yy > 0.97 || junta < 1.2; if (borde) c = tono(c, 0.62);
      put(T, y * n + x, c); T.alt[y * n + x] = borde ? 0 : 0.6 + veta * 0.15;
    } }
    return T;
  },
  piedra: (s, n) => losetas(s, n, 2, 2, 0.006, (u, v, k) => { const f = fbm(u, v, 4, 6, 60 + k); return sat(f * 1.5 - 0.25); }),
  porcelanato: (s, n) => losetas(s, n, 2, 2, 0.004, (u, v, k) => fbm(u, v, 3, 4, 70 + k) * 0.5),
  barro: (s, n) => losetas(s, n, 4, 4, 0.012, (u, v, k) => sat(fbm(u, v, 6, 5, 80 + k) * 1.3 - 0.1), 0.18),
  marmol(s, n) {
    const T = lienzo(n); const c1 = hex(s.color), c2 = hex(s.color2 || s.color);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const u = x / n, v = y / n; const turb = fbm(u, v, 3, 6, 90); const ve = Math.abs(Math.sin((u * 2 + v * 1 + turb * 3.2) * Math.PI * 2)); const fina = Math.abs(Math.sin((u * 5 - v * 3 + fbm(u, v, 6, 5, 95) * 4) * Math.PI * 2));
      const k = sat(Math.pow(1 - ve, 14) * 0.9 + Math.pow(1 - fina, 30) * 0.5); put(T, y * n + x, mezcla(tono(c1, 0.97 + turb * 0.06), c2, k)); T.alt[y * n + x] = 0.5; }
    return T;
  },
  terrazo(s, n) {
    const T = liso({ color: s.color, color2: s.color }, n, 0.03, 6); const c2 = hex(s.color2 || s.color); const R = rng(101);
    const pal = [c2, tono(c2, 0.7), mezcla(c2, [245, 242, 235], 0.5), tono(hex(s.color), 0.75)];
    for (let k = 0; k < 1400; k++) { const px = R() * n, py = R() * n, r = 1.5 + R() * R() * 7, c = pal[Math.floor(R() * pal.length)]; const ang = R() * 6.28, ex = 0.6 + R() * 0.8;
      for (let dy = -r - 1; dy <= r + 1; dy++) for (let dx = -r - 1; dx <= r + 1; dx++) { const rx = dx * Math.cos(ang) + dy * Math.sin(ang), ry = (-dx * Math.sin(ang) + dy * Math.cos(ang)) / ex; if (Math.abs(rx) + Math.abs(ry) * 0.8 > r) continue; const i = ((Math.floor(py + dy) % n + n) % n) * n + ((Math.floor(px + dx) % n + n) % n); put(T, i, c); } }
    return T;
  },
  mosaico(s, n) {
    // pasta de cemento: 4x4 piezas con motivo geométrico de color2
    const T = lienzo(n); const c1 = hex(s.color), c2 = hex(s.color2 || s.color), c3 = mezcla(c1, c2, 0.5); const m = n / 4;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const tx = (x % m) / m - 0.5, ty = (y % m) / m - 0.5; const r = Math.hypot(tx, ty); const rombo = Math.abs(tx) + Math.abs(ty);
      let c = c1; if (rombo < 0.22) c = c2; else if (r > 0.38 && r < 0.46) c = c3; else if (Math.abs(Math.abs(tx) - 0.5) < 0.06 && Math.abs(Math.abs(ty) - 0.5) < 0.06) c = c2;
      const g = fbm(x / n, y / n, 16, 2, 120); c = tono(c, 0.95 + g * 0.08); const borde = Math.abs(tx) > 0.49 || Math.abs(ty) > 0.49; if (borde) c = tono(c, 0.7); put(T, y * n + x, c); T.alt[y * n + x] = borde ? 0.2 : 0.6; }
    return T;
  },
  ladrillo(s, n) {
    const T = lienzo(n); const c1 = hex(s.color), c2 = hex(s.color2 || s.color); const filas = 8, h = n / filas, w = n / 4; const R = rng(131); const tin = Array.from({ length: 64 }, () => R());
    for (let y = 0; y < n; y++) { const f = Math.floor(y / h); const off = f % 2 ? w / 2 : 0; for (let x = 0; x < n; x++) { const xx = (x + off) % n; const col = Math.floor(xx / w); const bx = xx % w, by = y % h; const junta = bx < 3 || by < 3;
      const g = fbm(x / n, y / n, 12, 4, 140); let c = mezcla(c1, c2, tin[(f * 4 + col) % 64]); c = tono(c, 0.85 + g * 0.3); if (junta) c = [196, 190, 178]; put(T, y * n + x, c); T.alt[y * n + x] = junta ? 0 : 0.6 + g * 0.2; } }
    return T;
  },
  textil: (s, n) => tejido(s, n, 128, 0.07),
  lino: (s, n) => tejido(s, n, 96, 0.12),
  boucle(s, n) { const T = liso(s, n, 0.1, 32); for (let i = 0; i < n * n; i++) { const g = hash(i % n, Math.floor(i / n), 77); const b = 0.88 + g * 0.2; T.col[i * 3] *= b; T.col[i * 3 + 1] *= b; T.col[i * 3 + 2] *= b; T.alt[i] = fbm((i % n) / n, Math.floor(i / n) / n, 48, 2, 78); } return T; },
  rattan(s, n) {
    const T = lienzo(n); const c1 = hex(s.color), c2 = hex(s.color2 || s.color); const p = 16;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const a = ((x + y) / n) * p, b = ((x - y + n) / n) * p; const fa = a % 1, fb = b % 1; const sobre = (Math.floor(a) + Math.floor(b)) % 2 === 0;
      const hilo = sobre ? Math.sin(fa * Math.PI) : Math.sin(fb * Math.PI); const hueco = Math.min(Math.sin(fa * Math.PI), Math.sin(fb * Math.PI)) < 0.12; let c = mezcla(c2, c1, hilo); if (hueco) c = tono(c2, 0.45); put(T, y * n + x, c); T.alt[y * n + x] = hueco ? 0 : hilo; }
    return T;
  },
  pasto(s, n) { const T = lienzo(n); const c1 = hex(s.color || '#5f7d3a'), c2 = hex(s.color2 || '#3f5a26'); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const f = fbm(x / n, y / n, 6, 4, 150); const g = hash(x, y, 151); put(T, y * n + x, tono(mezcla(c1, c2, f), 0.8 + g * 0.35)); T.alt[y * n + x] = g; } return T; },
};

function losetas(s, n, cx, cy, junta, fn, varia = 0.08) {
  const T = lienzo(n); const c1 = hex(s.color), c2 = hex(s.color2 || s.color); const R = rng(41); const tin = Array.from({ length: cx * cy }, () => 1 - varia / 2 + R() * varia);
  const jx = Math.max(1.5, junta * n * 4), w = n / cx, h = n / cy, cj = tono(mezcla(c1, c2, 0.5), 0.72);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const ix = Math.floor(x / w), iy = Math.floor(y / h); const bx = x % w, by = y % h; const borde = bx < jx / 2 || bx > w - jx / 2 || by < jx / 2 || by > h - jx / 2;
    const k = iy * cx + ix; let c = mezcla(c1, c2, fn(x / n, y / n, k)); c = tono(c, tin[k]); if (borde) c = cj; put(T, y * n + x, c); T.alt[y * n + x] = borde ? 0 : 0.7; }
  return T;
}
function tejido(s, n, p, amp) {
  const T = lienzo(n); const c1 = hex(s.color), c2 = hex(s.color2 || s.color);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const a = Math.sin((x / n) * p * Math.PI * 2), b = Math.sin((y / n) * p * Math.PI * 2); const w = (a * b + 1) / 2; const f = fbm(x / n, y / n, 8, 3, 160); const sl = fbm(x / n, y / n * 0.1, 64, 1, 161);
    put(T, y * n + x, tono(mezcla(c1, c2, f * 0.7), 1 - amp + w * amp * 2 - (sl - 0.5) * amp)); T.alt[y * n + x] = w; }
  return T;
}

/* ---------- a canvas ---------- */
function aCanvas(T, n) {
  const cv = document.createElement('canvas'); cv.width = cv.height = n; const ctx = cv.getContext('2d'); const img = ctx.createImageData(n, n);
  for (let i = 0; i < n * n; i++) { img.data[i * 4] = clamp(T.col[i * 3]); img.data[i * 4 + 1] = clamp(T.col[i * 3 + 1]); img.data[i * 4 + 2] = clamp(T.col[i * 3 + 2]); img.data[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0); return cv;
}
function normalCanvas(alt, n, fuerza = 2.2) {
  const cv = document.createElement('canvas'); cv.width = cv.height = n; const ctx = cv.getContext('2d'); const img = ctx.createImageData(n, n);
  const a = (x, y) => alt[((y + n) % n) * n + ((x + n) % n)];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const dx = (a(x + 1, y) - a(x - 1, y)) * fuerza, dy = (a(x, y + 1) - a(x, y - 1)) * fuerza; const l = Math.hypot(dx, dy, 1); const i = (y * n + x) * 4;
    img.data[i] = (-dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255; }
  ctx.putImageData(img, 0, 0); return cv;
}
const CON_NORMAL = new Set(['madera', 'piedra', 'porcelanato', 'barro', 'mosaico', 'ladrillo', 'concreto', 'aplanado', 'rattan', 'boucle', 'lino', 'textil', 'pasto']);
const cache = new Map();

/** Texturas de una especificación { textura, color, color2, escala }. `tam` reduce el lienzo para textiles o vista previa. */
export function texturas(spec, tam = N) {
  const tipo = G[spec?.textura] ? spec.textura : 'pintura';
  const key = `${tipo}|${spec?.color}|${spec?.color2}|${tam}`;
  if (cache.has(key)) return cache.get(key);
  const T = G[tipo](spec || {}, tam);
  const mapa = new THREE.CanvasTexture(aCanvas(T, tam)); mapa.colorSpace = THREE.SRGBColorSpace;
  let normal = null;
  if (CON_NORMAL.has(tipo)) { normal = new THREE.CanvasTexture(normalCanvas(T.alt, tam, tipo === 'madera' || tipo === 'mosaico' || tipo === 'barro' || tipo === 'piedra' || tipo === 'porcelanato' || tipo === 'ladrillo' ? 3 : 1.6)); normal.colorSpace = THREE.NoColorSpace; }
  for (const t of [mapa, normal]) if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.generateMipmaps = true; }
  const out = { mapa, normal }; cache.set(key, out); return out;
}

/** Material PBR (MeshStandard/MeshPhysical) a partir de una especificación del catálogo. */
export function materialDe(spec, { nombre = '', tam = N, fisico = false, extra = {} } = {}) {
  const { mapa, normal } = texturas(spec, tam);
  const rep = 1 / Math.max(0.2, Number(spec?.escala) || 1);
  const conRep = t => { if (!t) return null; const c = t.clone(); c.needsUpdate = true; c.repeat.set(rep, rep); return c; };
  const params = { name: nombre, map: conRep(mapa), normalMap: conRep(normal), roughness: sat(Number(spec?.rugosidad ?? 0.7)), metalness: sat(Number(spec?.metalicidad ?? 0)), ...extra };
  if (normal) params.normalScale = new THREE.Vector2(0.55, 0.55);
  const m = fisico || spec?.textura === 'marmol' || spec?.textura === 'laca' ? new THREE.MeshPhysicalMaterial({ ...params, clearcoat: spec?.textura === 'marmol' || spec?.textura === 'laca' ? 0.6 : 0, clearcoatRoughness: 0.12 }) : new THREE.MeshStandardMaterial(params);
  return m;
}

/** Vista previa 2D (para las tarjetas del catálogo): canvas pequeño con la textura. */
export function muestraCanvas(spec, tam = 96) { const T = G[G[spec?.textura] ? spec.textura : 'pintura'](spec || {}, tam); return aCanvas(T, tam); }

/** Proyecta UV en metros (proyección por caras, como un mapeo de caja) sobre una geometría ya ubicada en el mundo. */
export function uvMetros(geo) {
  const pos = geo.attributes.position; const nor = geo.attributes.normal || (geo.computeVertexNormals(), geo.attributes.normal);
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
    if (ay >= ax && ay >= az) { uv[i * 2] = x; uv[i * 2 + 1] = z; } else if (ax >= az) { uv[i * 2] = z; uv[i * 2 + 1] = y; } else { uv[i * 2] = x; uv[i * 2 + 1] = y; } }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return geo;
}
