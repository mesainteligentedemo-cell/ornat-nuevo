// ORNAT · métricas de imagen reales y locales (sin IA, sin red). Funciones puras sobre píxeles RGBA:
// el navegador las alimenta desde un <canvas> reducido; los tests, con matrices sintéticas.
export const toGray = (rgba, n = rgba.length / 4) => { const g = new Uint8Array(n); for (let i = 0; i < n; i++) g[i] = (rgba[i * 4] * 299 + rgba[i * 4 + 1] * 587 + rgba[i * 4 + 2] * 114) / 1000; return g; };

/** Luminancia media (0-255), desviación (contraste) y proporción de sombras/altas luces. */
export function luminanceStats(gray) {
  const n = gray.length || 1; let sum = 0, dark = 0, bright = 0; const hist = new Uint32Array(256);
  for (const v of gray) { sum += v; hist[v]++; if (v < 40) dark++; if (v > 235) bright++; }
  const mean = sum / n; let varSum = 0; for (const v of gray) varSum += (v - mean) ** 2;
  const pct = q => { let acc = 0; for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= n * q) return i; } return 255; };
  return { mean, std: Math.sqrt(varSum / n), p5: pct(0.05), p95: pct(0.95), darkShare: dark / n, brightShare: bright / n };
}

/** Varianza del laplaciano: proxy clásico de nitidez (más alto = más nítido). Comparable solo con el mismo tamaño de análisis. */
export function laplacianVariance(gray, w, h) {
  if (w < 3 || h < 3) return 0;
  let sum = 0, sum2 = 0, n = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; const l = gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w] - 4 * gray[i];
    sum += l; sum2 += l * l; n++;
  }
  const mean = sum / n; return sum2 / n - mean * mean;
}

/** dHash 64 bits: compara pixeles vecinos de una miniatura de 9x8 en gris. Devuelve 16 caracteres hex. */
export function dHash(gray9x8) {
  let bits = '';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += gray9x8[y * 9 + x] > gray9x8[y * 9 + x + 1] ? '1' : '0';
  let hex = ''; for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}
export function hamming(a, b) {
  if (!a || !b || a.length !== b.length) return 64;
  let d = 0; for (let i = 0; i < a.length; i++) { let x = parseInt(a[i], 16) ^ parseInt(b[i], 16); while (x) { d += x & 1; x >>= 1; } }
  return d;
}

/** Colores dominantes: cuantiza a 4 bits por canal, ordena por frecuencia y descarta tonos casi iguales. */
export function dominantColors(rgba, count = 3) {
  const buckets = new Map();
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue;
    const key = ((rgba[i] >> 4) << 8) | ((rgba[i + 1] >> 4) << 4) | (rgba[i + 2] >> 4);
    const b = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 }; b.r += rgba[i]; b.g += rgba[i + 1]; b.b += rgba[i + 2]; b.n++; buckets.set(key, b);
  }
  const sorted = [...buckets.values()].sort((a, b) => b.n - a.n).map(b => [Math.round(b.r / b.n), Math.round(b.g / b.n), Math.round(b.b / b.n)]);
  const out = [];
  for (const c of sorted) {
    if (out.every(o => Math.hypot(o[0] - c[0], o[1] - c[1], o[2] - c[2]) > 60)) out.push(c);
    if (out.length >= count) break;
  }
  return out.map(([r, g, b]) => `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`);
}

export const THRESHOLDS = { minLongSide: 1200, dark: 70, bright: 195, flat: 32, blur: 40 };

/** Convierte las métricas en avisos de calidad con una sugerencia concreta. */
export function assessQuality({ width, height, mean, std, sharp, darkShare = 0, brightShare = 0 }, t = THRESHOLDS) {
  const out = [];
  if (Math.max(width, height) < t.minLongSide) out.push({ issue: 'resolución baja', suggestion: `Mide ${width}×${height}px. Sube la original (idealmente 2000px o más de lado largo) para que no se vea pixelada en pantalla grande.` });
  if (mean < t.dark || darkShare > 0.45) out.push({ issue: 'oscura', suggestion: 'Está subexpuesta. Repite la toma con más luz natural (abre cortinas, mejor hora del día) o sube la exposición antes de cargarla.' });
  if (mean > t.bright || brightShare > 0.35) out.push({ issue: 'sobreexpuesta', suggestion: 'Hay zonas quemadas. Evita el contraluz directo o fotografía con menos ventana en cuadro.' });
  if (sharp < t.blur) out.push({ issue: 'borrosa', suggestion: 'Parece desenfocada o movida. Apoya el teléfono o usa tripié y vuelve a enfocar antes de disparar.' });
  if (std < t.flat && mean >= t.dark && mean <= t.bright) out.push({ issue: 'plana', suggestion: 'Tiene muy poco contraste. Mejora la luz o sube contraste antes de cargarla.' });
  return out;
}

/** Marca las fotos casi idénticas. photos: [{id, hash}] -> Map(id -> id de la foto con la que se repite). */
export function findDuplicates(photos, maxDistance = 5) {
  const dup = new Map();
  for (let i = 0; i < photos.length; i++) for (let j = 0; j < i; j++) {
    if (dup.has(photos[j].id)) continue;
    if (hamming(photos[i].hash, photos[j].hash) <= maxDistance) { dup.set(photos[i].id, photos[j].id); break; }
  }
  return dup;
}

export const orientationOf = (w, h) => (Math.abs(w - h) / Math.max(w, h) < 0.06 ? 'cuadrada' : w > h ? 'horizontal' : 'vertical');
