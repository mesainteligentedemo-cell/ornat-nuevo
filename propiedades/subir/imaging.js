// ORNAT · procesamiento de imágenes en el navegador (canvas). Las métricas puras viven en /shared/image-metrics.js.
import { toGray, luminanceStats, laplacianVariance, dHash, dominantColors, assessQuality, orientationOf } from '/shared/image-metrics.js';

export const SIZES = { big: 2400, ai: 1568, thumb: 480 };

function canvasOf(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}
const fit = (w, h, max) => { const k = Math.min(1, max / Math.max(w, h)); return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))]; };

async function toBlob(canvas, type, quality) {
  const blob = canvas.convertToBlob ? await canvas.convertToBlob({ type, quality }) : await new Promise(res => canvas.toBlob(res, type, quality));
  if (!blob) throw new Error('No se pudo codificar la imagen.');
  return blob;
}
/** Intenta WebP; si el navegador lo ignora (Safari antiguo devuelve PNG) cae a JPEG, que la API también acepta. */
export async function encode(source, w, h, quality = 0.82) {
  const [cw, ch] = [w, h]; const c = canvasOf(cw, ch); const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high'; ctx.drawImage(source, 0, 0, cw, ch);
  let blob = await toBlob(c, 'image/webp', quality);
  if (blob.type !== 'image/webp') blob = await toBlob(c, 'image/jpeg', quality);
  return blob;
}

export async function decode(blobOrFile) {
  try { return await createImageBitmap(blobOrFile, { imageOrientation: 'from-image' }); }
  catch { throw new Error('No pude leer esta imagen. Si es HEIC, expórtala a JPG o WebP y vuelve a cargarla.'); }
}

function pixels(bitmap, w, h) {
  const c = canvasOf(w, h); const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(bitmap, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}

/** Métricas reales (sin IA): exposición, contraste, nitidez, huella perceptual, colores, orientación y avisos. */
export function measure(bitmap) {
  const W = bitmap.width, H = bitmap.height;
  const [aw, ah] = fit(W, H, 256);
  const rgba = pixels(bitmap, aw, ah); const gray = toGray(rgba, aw * ah);
  const lum = luminanceStats(gray); const sharp = laplacianVariance(gray, aw, ah);
  const hashGray = toGray(pixels(bitmap, 9, 8), 72);
  const [cw, ch] = fit(W, H, 48);
  const metrics = { width: W, height: H, orientation: orientationOf(W, H), mean: Math.round(lum.mean), std: Math.round(lum.std), sharp: Math.round(sharp), hash: dHash(hashGray), colors: dominantColors(pixels(bitmap, cw, ch), 3) };
  const quality = assessQuality({ width: W, height: H, mean: lum.mean, std: lum.std, sharp, darkShare: lum.darkShare, brightShare: lum.brightShare });
  return { metrics, quality: quality.map(q => ({ ...q, by: 'local' })) };
}

/** Archivo -> { big, thumb, metrics, quality, width, height }. big = 2400 px WebP (se queda en IndexedDB). */
export async function ingest(file) {
  if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|avif|gif)$/i.test(file.name)) throw new Error('Este archivo no es una imagen.');
  if (file.size > 40 * 1024 * 1024) throw new Error('La imagen pesa más de 40 MB.');
  const bitmap = await decode(file);
  try {
    const [bw, bh] = fit(bitmap.width, bitmap.height, SIZES.big);
    const [tw, th] = fit(bitmap.width, bitmap.height, SIZES.thumb);
    const [big, thumb] = await Promise.all([encode(bitmap, bw, bh, 0.86), encode(bitmap, tw, th, 0.72)]);
    const { metrics, quality } = measure(bitmap);
    return { big, thumb, metrics, quality, width: bitmap.width, height: bitmap.height };
  } finally { bitmap.close?.(); }
}

const blobToBase64 = blob => new Promise((resolve, reject) => {
  const fr = new FileReader(); fr.onload = () => resolve(String(fr.result).split(',')[1] || ''); fr.onerror = () => reject(fr.error); fr.readAsDataURL(blob);
});
const blobToDataUrl = blob => new Promise((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(String(fr.result)); fr.onerror = () => reject(fr.error); fr.readAsDataURL(blob); });

/** Versión para la IA: ≤1568 px, ≤1.4 MB decodificados (el API limita el body a 4.5 MB en Vercel). */
export async function aiPayload(blob) {
  const bitmap = await decode(blob);
  try {
    const [w, h] = fit(bitmap.width, bitmap.height, SIZES.ai);
    for (const q of [0.82, 0.72, 0.6, 0.48]) {
      const out = await encode(bitmap, w, h, q);
      if (out.size <= 1_400_000) return { media_type: out.type, data: await blobToBase64(out) };
    }
    throw new Error('La imagen es demasiado pesada incluso reducida.');
  } finally { bitmap.close?.(); }
}

/** Versiones web para guardar en el inventario: prueba escalones hasta que el total quepa en el presupuesto. */
export const WEB_TIERS = [[1600, 0.8], [1400, 0.74], [1200, 0.7], [1000, 0.66], [800, 0.6], [640, 0.55]];
export async function webVersions(blobs, budgetBytes) {
  const bitmaps = await Promise.all(blobs.map(decode));
  try {
    for (const [side, q] of WEB_TIERS) {
      const outs = [];
      for (const b of bitmaps) { const [w, h] = fit(b.width, b.height, side); outs.push(await encode(b, w, h, q)); }
      const total = outs.reduce((n, o) => n + o.size * 1.34, 0); // base64 pesa ~4/3
      if (total <= budgetBytes) return { urls: await Promise.all(outs.map(blobToDataUrl)), side, quality: q, bytes: Math.round(total) };
    }
    return null;
  } finally { bitmaps.forEach(b => b.close?.()); }
}
