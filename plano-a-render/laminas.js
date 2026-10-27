// ORNAT · Plano a render — carga de láminas: JPG/PNG/WebP y PDF (pdf.js rasteriza cada página en el navegador).
// Todo se redimensiona en el cliente: nada sale del navegador salvo que el usuario pida "Leer con IA".
export const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/build/pdf.min.mjs';
export const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/build/pdf.worker.min.mjs';
export const LIMITES = { archivoMB: 40, laminas: 12, paginasPDF: 10, ladoMax: 2400 };
const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];

const lienzo = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function ajustar(src, w, h, max = LIMITES.ladoMax) {
  const k = Math.min(1, max / Math.max(w, h)); const c = lienzo(Math.round(w * k), Math.round(h * k)); const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(src, 0, 0, c.width, c.height); return c;
}

/** Lee archivos y devuelve [{ nombre, canvas }] (una entrada por imagen o por página de PDF). Lanza Error con mensaje es-MX. */
export async function leerArchivos(files, { onProgreso = () => {} } = {}) {
  const out = []; const lista = [...files];
  for (const f of lista) {
    if (f.size > LIMITES.archivoMB * 1e6) throw new Error(`${f.name} pesa más de ${LIMITES.archivoMB} MB. Exporta la lámina a menor resolución.`);
    const esPDF = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
    if (esPDF) { for (const p of await leerPDF(f, onProgreso)) out.push(p); }
    else if (TIPOS.includes(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name)) {
      let bmp; try { bmp = await createImageBitmap(f); } catch { throw new Error(`No pude leer ${f.name}: ¿es una imagen válida?`); }
      out.push({ nombre: f.name.replace(/\.[^.]+$/, ''), canvas: ajustar(bmp, bmp.width, bmp.height) }); bmp.close?.();
    } else throw new Error(`${f.name}: solo acepto JPG, PNG, WebP o PDF.`);
    if (out.length > LIMITES.laminas) throw new Error(`Máximo ${LIMITES.laminas} láminas por proyecto.`);
  }
  return out;
}

let pdfjs = null;
async function leerPDF(file, onProgreso) {
  if (!pdfjs) { pdfjs = await import(/* @vite-ignore */ PDFJS); pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; }
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  const n = Math.min(doc.numPages, LIMITES.paginasPDF); const out = [];
  for (let i = 1; i <= n; i++) {
    const page = await doc.getPage(i); const v1 = page.getViewport({ scale: 1 }); const k = Math.min(4, LIMITES.ladoMax / Math.max(v1.width, v1.height));
    const vp = page.getViewport({ scale: k }); const c = lienzo(Math.round(vp.width), Math.round(vp.height)); const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, canvas: c, viewport: vp }).promise; out.push({ nombre: `${file.name.replace(/\.pdf$/i, '')} · pág. ${i}`, canvas: c });
    onProgreso(i / n);
  }
  await doc.destroy?.();
  return out;
}

export async function cargarImagen(src) { const img = new Image(); img.decoding = 'async'; img.src = src; await img.decode(); return ajustar(img, img.naturalWidth, img.naturalHeight, 4000); }

/** Imagen para la IA: JPEG ≤ 2000 px de lado y ≤ ~2.2 MB en base64. */
export async function paraIA(canvas) {
  let lado = 2000, q = 0.88;
  for (let i = 0; i < 6; i++) {
    const c = ajustar(canvas, canvas.width, canvas.height, lado); const url = c.toDataURL('image/jpeg', q); const data = url.slice(url.indexOf(',') + 1);
    if (data.length < 2_200_000) return { media_type: 'image/jpeg', data, ancho: c.width, alto: c.height, escala: c.width / canvas.width };
    lado = Math.round(lado * 0.8); q = Math.max(0.7, q - 0.05);
  }
  throw new Error('La lámina es demasiado pesada para enviarla a la IA.');
}
