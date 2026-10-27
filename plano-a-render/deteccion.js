// ORNAT · Plano a render — detección LOCAL de muros, espacios y aberturas a partir de la imagen de un plano.
// ESM puro: sin DOM, sin red, sin IA, sin dependencias. Recibe píxeles RGBA (como ImageData).
//
// detectarPlano({ data, width, height }, { umbral, grosorMinPx, maxLado, onProgreso }) → {
//   plantas: [{ recorte:{x,y,w,h}, muros:[{x1,y1,x2,y2,grosor}], espacios:[{poligono,areaPx,centro}], aberturas:[{tipo,x,y,ancho}] }],
//   diagnostico: { umbral, grosorMuroPx, grosorMinPx, mPorPxEstimado, inclinacionGrados, escalaTrabajo,
//                  murosDetectados, mursDetectados (alias), espaciosDetectados, aberturasDetectadas, ms, advertencias }
// }
// Todas las coordenadas salen en px de la imagen ORIGINAL (completa), listas para plantaDesdePx de modelo.js.
//
// Pipeline: gris (+ normalización de fondo) → umbral Otsu → tinta → grosor de muro por corridas → apertura
// morfológica (solo trazos gruesos) → segmentos H/V (componentes + regresión) → enderezado si está inclinado →
// fusión de colineales (cerrando huecos de puertas/ventanas) → extensión/snap de extremos (esquinas y T) →
// agrupación en plantas → relleno de regiones sobre máscara cerrada → contorno → polígono rectilíneo.

export const ADVERTENCIA_SIN_MUROS = 'No encontré muros: sube el plano con más contraste o dibuja los muros a mano.';
const GROSOR_REF_M = 0.15; // grosor típico de muro interior, para estimar escala (m/px) cuando no hay otra pista
const ahora = () => (globalThis.performance?.now?.() ?? Date.now());

export function detectarPlano(imagen, opciones = {}) {
  const t0 = ahora();
  const { data, width: W0, height: H0 } = imagen || {};
  if (!data || !(W0 > 0) || !(H0 > 0) || data.length < W0 * H0 * 4) throw new Error('Imagen no válida: se espera { data: RGBA, width, height }.');
  const avisar = typeof opciones.onProgreso === 'function' ? p => { try { opciones.onProgreso(Math.max(0, Math.min(1, p))); } catch { /* el progreso nunca rompe la detección */ } } : () => {};
  const adv = [];
  const diag = { umbral: null, grosorMuroPx: null, grosorMinPx: null, mPorPxEstimado: null, inclinacionGrados: 0, escalaTrabajo: 1, murosDetectados: 0, mursDetectados: 0, espaciosDetectados: 0, aberturasDetectadas: 0, ms: 0, advertencias: adv };
  const fin = plantas => {
    diag.murosDetectados = diag.mursDetectados = plantas.reduce((s, p) => s + p.muros.length, 0);
    diag.espaciosDetectados = plantas.reduce((s, p) => s + p.espacios.length, 0);
    diag.aberturasDetectadas = plantas.reduce((s, p) => s + p.aberturas.length, 0);
    if (!plantas.length && !adv.includes(ADVERTENCIA_SIN_MUROS)) adv.unshift(ADVERTENCIA_SIN_MUROS);
    diag.ms = Math.round(ahora() - t0); avisar(1);
    return { plantas, diagnostico: diag };
  };

  // 1. gris reducido al tamaño de trabajo
  const maxLado = Math.max(200, Number(opciones.maxLado) || 2400);
  const s = Math.min(1, maxLado / Math.max(W0, H0));
  const { g: gris, W, H } = grisReducido(data, W0, H0, s);
  diag.escalaTrabajo = r3(s);
  if (s < 1) adv.push(`Analicé la imagen reducida a ${W}×${H} px; las coordenadas se devuelven en px originales.`);
  avisar(0.05);

  // 2. fondo + umbral
  const norm = normalizarFondo(gris, W, H);
  const hist = new Uint32Array(256); for (let i = 0; i < norm.length; i++) hist[norm[i]]++;
  const N = W * H;
  const pOscuro = percentil(hist, N, 0.002);
  let umbral = Number.isFinite(Number(opciones.umbral)) && opciones.umbral !== null && opciones.umbral !== '' ? Math.max(1, Math.min(254, Math.round(Number(opciones.umbral)))) : otsu(hist, N);
  diag.umbral = umbral;
  if (opciones.umbral == null && pOscuro > 170) return fin([]); // casi sin tinta: imagen en blanco o sin contraste
  const tinta = new Uint8Array(N); let nTinta = 0;
  for (let i = 0; i < N; i++) if (norm[i] < umbral) { tinta[i] = 1; nTinta++; }
  if (nTinta < Math.max(30, N * 0.0003)) return fin([]);
  if (nTinta > N * 0.6) adv.push('Más de la mitad de la imagen salió como tinta: revisa el contraste o ajusta el umbral.');
  avisar(0.15);

  // 3. grosor de muro y apertura morfológica
  let est = estimarGrosor(tinta, W, H);
  if (Number(opciones.grosorMinPx) > 0) est = { ...est, k: Math.max(1, Math.round(Number(opciones.grosorMinPx) * s)), modo: est.modo === 'delgado' ? 'normal' : est.modo, G: Math.max(est.G, Math.round(Number(opciones.grosorMinPx) * s * 1.4)) };
  let { k, G } = est, M, segs, Lmin, rutaHueca = false;
  if (est.modo === 'delgado') {
    const hueco = rutaMurosHuecos(tinta, W, H);
    if (hueco) {
      ({ M, segs, k, G, Lmin } = hueco); rutaHueca = true;
      adv.push('Los muros parecen huecos (doble línea) o achurados: los reconstruí a partir de sus dos caras; revisa el resultado (el mobiliario de doble línea puede salir como muro y las ventanas no se distinguen).');
    } else {
      adv.push('Los muros parecen dibujados con línea delgada; la detección será menos precisa.');
      M = tinta.slice(); Lmin = Math.max(4 * G, 0.04 * Math.min(W, H));
      segs = extraerSegmentos(M, W, H, k, G, Lmin);
    }
  } else {
    M = abrir(tinta, W, H, k); Lmin = Math.max(2 * k, 1.2 * G);
    segs = extraerSegmentos(M, W, H, k, G, Lmin);
  }
  diag.grosorMinPx = r3(k / s); diag.grosorMuroPx = r3(G / s); diag.mPorPxEstimado = +(GROSOR_REF_M / (G / s)).toPrecision(3);
  avisar(0.3);

  // 4. segmentos (+ enderezado)
  let theta = 0, fina = restar(tinta, M);
  const ang = inclinacion(segs, G);
  if (Math.abs(ang) >= 0.35 * Math.PI / 180 && Math.abs(ang) <= 12 * Math.PI / 180) {
    theta = ang;
    M = rotarMascara(M, W, H, theta); fina = rotarMascara(fina, W, H, theta);
    segs = extraerSegmentos(M, W, H, k, G, Lmin);
    adv.push(`El plano está inclinado ${r1(theta * 180 / Math.PI)}°; lo enderecé para detectar los muros.`);
  }
  diag.inclinacionGrados = r1(theta * 180 / Math.PI);
  segs = quitarContenidos(quitarDelgados(segs, G));
  avisar(0.45);

  // 5. fusión, huecos (puertas/ventanas) y snap de extremos
  const aberturas = [];
  const tipoHueco = (o, c, a, b, g) => clasificarHueco(fina, M, W, H, o, c, a, b, g);
  let hs = fusionar(segs.filter(q => q.o === 'h'), G, tipoHueco, aberturas, true);
  let vs = fusionar(segs.filter(q => q.o === 'v'), G, tipoHueco, aberturas, true);
  for (const q of [...hs, ...vs]) q.tocado = false;
  extender(hs, vs, G, tipoHueco, aberturas, rutaHueca);
  extender(vs, hs, G, tipoHueco, aberturas, rutaHueca);
  if (rutaHueca) { // con muros huecos, un par de líneas aislado suele ser mueble de doble línea
    const conectado = q => q.unido[0] || q.unido[1] || q.tocado;
    hs = hs.filter(conectado); vs = vs.filter(conectado);
  }
  hs = fusionar(hs, G, null, null, false); vs = fusionar(vs, G, null, null, false);
  let todos = quitarSueltos(quitarContenidos([...hs, ...vs]), G);
  todos = quitarMarco(todos, W, H, adv);
  avisar(0.6);
  if (!todos.length) return fin([]);

  // 6. plantas
  const grupos = agruparPlantas(todos, W, H, G, adv);
  avisar(0.7);
  if (!grupos.length) return fin([]);

  // máscara cerrada (muros dibujados con huecos cerrados + máscara real)
  const cerrada = M.slice();
  for (const q of todos) pintarSeg(cerrada, W, H, q);

  const c = { x: W / 2, y: H / 2 }, cos = Math.cos(theta), sin = Math.sin(theta);
  const aOrig = (x, y) => { // marco de trabajo (enderezado, reducido) → px originales
    const dx = x - c.x, dy = y - c.y;
    return [(dx * cos - dy * sin + c.x) / s, (dx * sin + dy * cos + c.y) / s];
  };
  const P = v => Math.round(v * 10) / 10;

  const plantas = [];
  const mPx2 = (GROSOR_REF_M / G) ** 2; // m² por px² de trabajo (estimado)
  let limiteMuros = 600, recortados = false;
  grupos.forEach((gr, gi) => {
    const m = Math.ceil(Math.max(3, 2 * G));
    const X0 = Math.max(0, Math.floor(gr.x0 - m)), Y0 = Math.max(0, Math.floor(gr.y0 - m)), X1 = Math.min(W, Math.ceil(gr.x1 + m)), Y1 = Math.min(H, Math.ceil(gr.y1 + m));
    const { espacios: esp, lab, vivos } = espaciosEnRecorte(cerrada, W, X0, Y0, X1 - X0, Y1 - Y0, G, mPx2);
    // muros: los cortos que no colindan con ningún espacio son rótulos/símbolos (si hay espacios)
    const cw = X1 - X0, ch = Y1 - Y0;
    const colinda = q => {
      const n = Math.max(3, Math.ceil((q.b - q.a) / G));
      for (let i = 0; i <= n; i++) {
        const t = q.a + (q.b - q.a) * i / n;
        for (const off of [q.g / 2 + 2, q.g / 2 + G, -(q.g / 2 + 2), -(q.g / 2 + G)]) {
          const x = Math.floor((q.o === 'h' ? t : q.c + off) - X0), y = Math.floor((q.o === 'h' ? q.c + off : t) - Y0);
          if (x >= 0 && y >= 0 && x < cw && y < ch && vivos.has(lab[y * cw + x])) return true;
        }
      }
      return false;
    };
    const segsPl = esp.length ? gr.segs.filter(q => q.b - q.a >= 10 * G || colinda(q)) : gr.segs;
    let muros = segsPl.slice().sort((a, b) => (b.b - b.a) - (a.b - a.a));
    if (muros.length > limiteMuros) { muros = muros.slice(0, limiteMuros); recortados = true; }
    limiteMuros = Math.max(0, limiteMuros - muros.length);
    const murosOut = muros.map(q => {
      const [x1, y1] = q.o === 'h' ? aOrig(q.a, q.c) : aOrig(q.c, q.a);
      const [x2, y2] = q.o === 'h' ? aOrig(q.b, q.c) : aOrig(q.c, q.b);
      return { x1: P(x1), y1: P(y1), x2: P(x2), y2: P(y2), grosor: P(q.g / s) };
    });
    const espOut = esp.map(e => ({
      poligono: e.poligono.map(([x, y]) => aOrig(x + X0, y + Y0).map(P)),
      areaPx: Math.round(e.area / (s * s)),
      centro: aOrig(e.centro[0] + X0, e.centro[1] + Y0).map(P),
    }));
    const sobreMuro = a => muros.some(q => (q.o === 'h' ? Math.abs(a.y - q.c) <= q.g && a.x >= q.a - 1 && a.x <= q.b + 1 : Math.abs(a.x - q.c) <= q.g && a.y >= q.a - 1 && a.y <= q.b + 1));
    const abOut = aberturas.filter(a => a.x >= gr.x0 - G && a.x <= gr.x1 + G && a.y >= gr.y0 - G && a.y <= gr.y1 + G && !a.usada && sobreMuro(a))
      .map(a => { a.usada = true; const [x, y] = aOrig(a.x, a.y); return { tipo: a.tipo, x: P(x), y: P(y), ancho: P(a.ancho / s) }; });
    // recorte: caja de las esquinas transformadas
    const esq = [aOrig(X0, Y0), aOrig(X1, Y0), aOrig(X0, Y1), aOrig(X1, Y1)];
    const rx0 = Math.max(0, Math.floor(Math.min(...esq.map(p => p[0])))), ry0 = Math.max(0, Math.floor(Math.min(...esq.map(p => p[1]))));
    const rx1 = Math.min(W0, Math.ceil(Math.max(...esq.map(p => p[0])))), ry1 = Math.min(H0, Math.ceil(Math.max(...esq.map(p => p[1]))));
    plantas.push({ recorte: { x: rx0, y: ry0, w: rx1 - rx0, h: ry1 - ry0 }, muros: murosOut, espacios: espOut, aberturas: abOut });
    if (!espOut.length) adv.push(`Planta ${gi + 1}: encontré muros pero ningún espacio cerrado; revisa que los muros cierren.`);
    avisar(0.7 + 0.28 * (gi + 1) / grupos.length);
  });
  if (recortados) adv.push('El plano tiene más de 600 muros; conservé los más largos.');
  if (plantas.length > 1) adv.push(`Encontré ${plantas.length} plantas en la lámina.`);
  return fin(plantas);
}

/* ====================================================================================== */
/* utilidades numéricas                                                                    */
/* ====================================================================================== */
const r1 = n => Math.round(n * 10) / 10;
const r3 = n => Math.round(n * 1000) / 1000;

function percentil(hist, total, p) {
  const obj = total * p; let acc = 0;
  for (let v = 0; v < hist.length; v++) { acc += hist[v]; if (acc > obj) return v; }
  return hist.length - 1;
}

function otsu(hist, total) {
  let suma = 0; for (let v = 0; v < 256; v++) suma += v * hist[v];
  let sB = 0, wB = 0, mejor = -1, umbral = 128;
  for (let t = 0; t < 255; t++) {
    wB += hist[t]; if (!wB) continue;
    const wF = total - wB; if (!wF) break;
    sB += t * hist[t];
    const mB = sB / wB, mF = (suma - sB) / wF, v = wB * wF * (mB - mF) ** 2;
    if (v > mejor) { mejor = v; umbral = t + 1; } // tinta = gris < umbral
  }
  return umbral;
}

/** Gris (alfa compuesto sobre blanco) y reducción por promedio de área si s < 1. */
function grisReducido(data, W0, H0, s) {
  if (s >= 1) {
    const g = new Uint8Array(W0 * H0);
    for (let i = 0, j = 0; i < g.length; i++, j += 4) {
      const a = data[j + 3], l = (data[j] * 77 + data[j + 1] * 150 + data[j + 2] * 29) >> 8;
      g[i] = a === 255 ? l : ((l * a + 255 * (255 - a)) / 255) | 0;
    }
    return { g, W: W0, H: H0 };
  }
  const W = Math.max(1, Math.round(W0 * s)), H = Math.max(1, Math.round(H0 * s));
  const suma = new Float32Array(W * H), cnt = new Uint16Array(W * H);
  const mx = new Int32Array(W0); for (let x = 0; x < W0; x++) mx[x] = Math.min(W - 1, Math.floor(x * W / W0));
  for (let y = 0; y < H0; y++) {
    const fila = Math.min(H - 1, Math.floor(y * H / H0)) * W;
    for (let x = 0, j = y * W0 * 4; x < W0; x++, j += 4) {
      const a = data[j + 3], l = (data[j] * 77 + data[j + 1] * 150 + data[j + 2] * 29) >> 8;
      const d = fila + mx[x]; suma[d] += a === 255 ? l : (l * a + 255 * (255 - a)) / 255; cnt[d]++;
    }
  }
  const g = new Uint8Array(W * H);
  for (let i = 0; i < g.length; i++) g[i] = cnt[i] ? Math.round(suma[i] / cnt[i]) : 255;
  return { g, W, H };
}

/** Normaliza fondo gris o iluminación dispareja: divide entre un fondo estimado por bloques (percentil 90). */
function normalizarFondo(g, W, H) {
  const B = Math.max(16, Math.min(128, Math.round(Math.min(W, H) / 16)));
  const bw = Math.ceil(W / B), bh = Math.ceil(H / B), nb = bw * bh;
  const hist = new Uint32Array(nb * 256), cnt = new Uint32Array(nb);
  const ghist = new Uint32Array(256);
  for (let y = 0; y < H; y++) { const by = ((y / B) | 0) * bw; for (let x = 0, i = y * W; x < W; x++, i++) { const b = by + ((x / B) | 0); hist[b * 256 + g[i]]++; cnt[b]++; ghist[g[i]]++; } }
  const p95 = percentil(ghist, W * H, 0.95);
  const piso = Math.max(40, p95 * 0.6);
  const bloque = new Float32Array(nb);
  for (let b = 0; b < nb; b++) bloque[b] = percentil(hist.subarray(b * 256, b * 256 + 256), cnt[b], 0.9);
  const bg = new Float32Array(nb);
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    let m = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = by + dy, xx = bx + dx; if (yy >= 0 && yy < bh && xx >= 0 && xx < bw) m = Math.max(m, bloque[yy * bw + xx]); }
    bg[by * bw + bx] = Math.max(piso, m);
  }
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const fy = Math.max(0, Math.min(bh - 1, (y + 0.5) / B - 0.5)), y0 = Math.floor(fy), y1 = Math.min(bh - 1, y0 + 1), ty = fy - y0;
    for (let x = 0, i = y * W; x < W; x++, i++) {
      const fx = Math.max(0, Math.min(bw - 1, (x + 0.5) / B - 0.5)), x0 = Math.floor(fx), x1 = Math.min(bw - 1, x0 + 1), tx = fx - x0;
      const f = (bg[y0 * bw + x0] * (1 - tx) + bg[y0 * bw + x1] * tx) * (1 - ty) + (bg[y1 * bw + x0] * (1 - tx) + bg[y1 * bw + x1] * tx) * ty;
      const v = (g[i] * 255) / f; out[i] = v >= 255 ? 255 : v | 0;
    }
  }
  return out;
}

/** Longitud de la corrida horizontal y vertical que contiene a cada píxel de la máscara. */
function corridas(m, W, H) {
  const N = W * H, hr = new Uint16Array(N), vr = new Uint16Array(N);
  for (let y = 0; y < H; y++) {
    const f = y * W; let x = 0;
    while (x < W) {
      if (!m[f + x]) { x++; continue; }
      let e = x; while (e < W && m[f + e]) e++;
      const L = Math.min(65535, e - x); for (let k = x; k < e; k++) hr[f + k] = L; x = e;
    }
  }
  const up = new Uint16Array(N);
  for (let i = 0; i < N; i++) if (m[i]) up[i] = i >= W ? Math.min(65535, up[i - W] + 1) : 1;
  for (let i = N - 1; i >= 0; i--) if (m[i]) vr[i] = i + W < N && m[i + W] ? vr[i + W] : up[i];
  return { hr, vr };
}

/**
 * Distribución del grosor local (lado corto de las corridas) de los trazos alargados. Otsu en escala log separa
 * trazos finos (texto, cotas, mobiliario) de gruesos (muros). Devuelve k (lado del elemento de apertura) y G (grosor típico).
 */
function estimarGrosor(tinta, W, H) {
  const { hr, vr } = corridas(tinta, W, H);
  const MAXT = 128, h = new Float64Array(MAXT + 1);
  for (let i = 0; i < tinta.length; i++) {
    if (!tinta[i]) continue;
    const a = hr[i], b = vr[i], mn = a < b ? a : b, mx = a < b ? b : a;
    if (mx >= 3 * mn) h[Math.min(MAXT, mn)]++;
  }
  let tot = 0; for (let t = 1; t <= MAXT; t++) tot += h[t];
  if (!tot) return { k: 1, G: 2, modo: 'delgado' };
  const modo = (a, b) => { let m = a, v = -1; for (let t = a; t <= b; t++) if (h[t] > v) { v = h[t]; m = t; } return m; };
  const mediana = (a, b) => { let w = 0; for (let t = a; t <= b; t++) w += h[t]; let acc = 0; for (let t = a; t <= b; t++) { acc += h[t]; if (acc >= w / 2) return t; } return b; };
  // Otsu sobre ln(t)
  let sum = 0; for (let t = 1; t <= MAXT; t++) sum += Math.log(t) * h[t];
  let wB = 0, sB = 0, best = -1, T = 1;
  for (let t = 1; t < MAXT; t++) {
    wB += h[t]; if (!wB) continue; const wF = tot - wB; if (!wF) break;
    sB += Math.log(t) * h[t]; const v = wB * wF * (sB / wB - (sum - sB) / wF) ** 2;
    if (v > best) { best = v; T = t; }
  }
  let wThick = 0; for (let t = T + 1; t <= MAXT; t++) wThick += h[t];
  const mt = modo(1, T), mw = modo(T + 1, MAXT);
  if (wThick / tot > 0.02 && mw >= 3 && mw / mt >= 1.7) {
    const G = Math.max(mw >= 3 ? mediana(T + 1, MAXT) : mw, 3);
    const k = Math.max(mt + 1, Math.min(T + 1, Math.max(mt + 1, Math.floor(0.75 * Math.min(mw, G)))));
    return { k, G, modo: 'normal' };
  }
  const m = modo(1, MAXT);
  if (m >= 3) return { k: Math.max(2, Math.floor(0.6 * m)), G: m, modo: 'unico' };
  return { k: 1, G: Math.max(2, m), modo: 'delgado' };
}

/** Apertura morfológica con un cuadrado k×k (erosión + dilatación separables, O(N)). */
function abrir(m, W, H, k) { return k <= 1 ? m.slice() : dilatar(erosionar(m, W, H, k), W, H, k); }
function dilatar(m, W, H, k) {
  const a = Math.floor((k - 1) / 2), b = k - 1 - a, N = W * H;
  const t = new Uint8Array(N), out = new Uint8Array(N);
  dilatar1D(m, t, W, H, b, a, true); dilatar1D(t, out, W, H, b, a, false);
  return out;
}

/**
 * Muros huecos (doble línea, con o sin achurado): extrae líneas rectas finas largas (H/V) y empareja paralelas
 * cercanas que se traslapan sin otra línea entre ellas; cada pareja es un muro con eje al centro.
 * La distancia típica entre caras sale del histograma de distancias a la paralela más cercana.
 */
function rutaMurosHuecos(tinta, W, H) {
  const Lr = Math.max(10, Math.round(Math.min(W, H) / 100));
  const { hr, vr } = corridas(tinta, W, H);
  const cls = new Uint8Array(W * H);
  for (let i = 0; i < cls.length; i++) if (tinta[i] && (hr[i] >= Lr || vr[i] >= Lr)) cls[i] = hr[i] >= vr[i] ? 1 : 2;
  const lineas = segmentosDeClases(cls, W, H, Lr, (len, g, spread, p) => len >= Lr && g <= 6 && spread <= g + 3 + Math.abs(p) * len);
  const MAXD = Math.max(20, Math.round(Math.min(W, H) / 25));
  const hist = new Float64Array(MAXD + 2);
  const porO = { h: lineas.filter(q => q.o === 'h').sort((p, q) => p.c - q.c), v: lineas.filter(q => q.o === 'v').sort((p, q) => p.c - q.c) };
  const traslape = (p, q) => Math.min(p.b, q.b) - Math.max(p.a, q.a);
  for (const L of Object.values(porO)) for (let i = 0; i < L.length; i++) {
    for (let j = i + 1; j < L.length && L[j].c - L[i].c <= MAXD; j++) {
      const ov = traslape(L[i], L[j]); if (ov <= 0.3 * Math.min(L[i].b - L[i].a, L[j].b - L[j].a)) continue;
      const d = Math.round(L[j].c - L[i].c); if (d >= 3) hist[d] += ov; break;
    }
  }
  let Gd = 0, best = 0;
  for (let d = 3; d <= MAXD; d++) { const v = hist[d - 1] + 2 * hist[d] + hist[d + 1]; if (v > best) { best = v; Gd = d; } }
  if (!Gd) return null;
  const dMin = Math.max(2.5, 0.5 * Gd), dMax = Math.min(MAXD, 4 * Gd); // amplio: el modo puede ser el de líneas de ventana
  const muros = [];
  for (const [o, L] of Object.entries(porO)) for (let i = 0; i < L.length; i++) {
    for (let j = i + 1; j < L.length && L[j].c - L[i].c <= dMax; j++) {
      const d = L[j].c - L[i].c; if (d < dMin) continue;
      const a = Math.max(L[i].a, L[j].a), b = Math.min(L[i].b, L[j].b);
      if (b - a < Math.max(2 * d, 2 * Lr)) continue;
      let tapada = false; // ¿otra línea paralela entre las dos cubre buena parte del tramo?
      for (let k = i + 1; k < j && !tapada; k++) if (L[k].c - L[i].c > 1 && L[j].c - L[k].c > 1 && Math.min(b, L[k].b) - Math.max(a, L[k].a) > 0.9 * (b - a)) tapada = true;
      if (!tapada) muros.push({ o, c: (L[i].c + L[j].c) / 2, a, b, g: d + (L[i].g + L[j].g) / 2, p: 0 });
    }
  }
  if (muros.length < 4) return null;
  const M = new Uint8Array(W * H);
  for (const q of muros) pintarSeg(M, W, H, q);
  const gs = muros.map(q => q.g).sort((x, y) => x - y);
  const G = Math.max(3, Math.round(gs[gs.length >> 1])), k = Math.max(2, Math.floor(0.6 * gs[0]));
  return { M, segs: muros, k, G, Lmin: Math.max(2 * k, 1.2 * G) };
}

function erosionar(m, W, H, k) {
  const a = Math.floor((k - 1) / 2), b = k - 1 - a; // ventana [x-a, x+b]
  const N = W * H, t1 = new Uint8Array(N), t2 = new Uint8Array(N);
  // erosión horizontal: x sobrevive si [x-a, x+b] es todo tinta
  const run = new Int32Array(W);
  for (let y = 0; y < H; y++) {
    const f = y * W; let c = 0;
    for (let x = 0; x < W; x++) { c = m[f + x] ? c + 1 : 0; run[x] = c; }
    for (let x = a; x + b < W; x++) if (run[x + b] >= k) t1[f + x] = 1;
  }
  // erosión vertical
  const col = new Uint16Array(N);
  for (let i = 0; i < N; i++) if (t1[i]) col[i] = i >= W ? col[i - W] + 1 : 1;
  for (let y = a; y + b < H; y++) for (let x = 0, i = y * W; x < W; x++, i++) if (col[i + b * W] >= k) t2[i] = 1;
  return t2;
}

/** Dilatación 1D: out[p] = 1 si existe src en [p-antes, p+despues]. */
function dilatar1D(src, out, W, H, antes, despues, vertical) {
  if (!vertical) {
    for (let y = 0; y < H; y++) {
      const f = y * W; let ultimo = -1e9;
      for (let x = 0; x < W; x++) { if (src[f + x]) ultimo = x; if (x - ultimo <= antes) out[f + x] = 1; }
      let sig = 1e9;
      for (let x = W - 1; x >= 0; x--) { if (src[f + x]) sig = x; if (sig - x <= despues) out[f + x] = 1; }
    }
  } else {
    const ult = new Int32Array(W).fill(-1e9);
    for (let y = 0; y < H; y++) for (let x = 0, i = y * W; x < W; x++, i++) { if (src[i]) ult[x] = y; if (y - ult[x] <= antes) out[i] = 1; }
    ult.fill(1e9);
    for (let y = H - 1; y >= 0; y--) for (let x = 0, i = y * W; x < W; x++, i++) { if (src[i]) ult[x] = y; if (ult[x] - y <= despues) out[i] = 1; }
  }
}

function restar(a, b) { const o = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) o[i] = a[i] && !b[i] ? 1 : 0; return o; }

/** Rota una máscara por -theta alrededor del centro (vecino más cercano): endereza un plano inclinado theta. */
function rotarMascara(m, W, H, theta) {
  const o = new Uint8Array(W * H), cx = W / 2, cy = H / 2, c = Math.cos(theta), s = Math.sin(theta);
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - cy;
    for (let x = 0, i = y * W; x < W; x++, i++) {
      const dx = x + 0.5 - cx;
      const sx = Math.floor(dx * c - dy * s + cx), sy = Math.floor(dx * s + dy * c + cy);
      if (sx >= 0 && sy >= 0 && sx < W && sy < H && m[sy * W + sx]) o[i] = 1;
    }
  }
  return o;
}

/* ====================================================================================== */
/* segmentos                                                                               */
/* ====================================================================================== */
/**
 * Cada píxel de muro se clasifica H (corrida horizontal ≥ vertical) o V. Componentes conexas por clase →
 * regresión lineal → segmento {o:'h'|'v', c (coordenada del eje), a, b (extensión), g (grosor), p (pendiente)}.
 */
function extraerSegmentos(M, W, H, k, G, Lmin) {
  const { hr, vr } = corridas(M, W, H);
  const cls = new Uint8Array(W * H);
  for (let i = 0; i < cls.length; i++) if (M[i]) cls[i] = hr[i] >= vr[i] ? 1 : 2;
  return segmentosDeClases(cls, W, H, Math.max(4, k * k), (len, g, spread, p) =>
    !(len < Lmin || len < 1.5 * g || g < Math.max(1, 0.5 * k) || g > Math.max(3 * G, 2 * k + 2)) && spread <= 1.5 * g + Math.abs(p) * len + 2);
}

/** Componentes 4-conexas por clase (1 = H, 2 = V) → segmentos con regresión lineal; `aceptar(len, g, spread, p)` filtra. */
function segmentosDeClases(cls, W, H, minN, aceptar) {
  const N = W * H;
  const lab = new Int32Array(N);
  let par = new Int32Array(1024), n = 0;
  const find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  for (let y = 0; y < H; y++) for (let x = 0, i = y * W; x < W; x++, i++) {
    const c = cls[i]; if (!c) continue;
    const l = x > 0 && cls[i - 1] === c ? lab[i - 1] : 0, u = y > 0 && cls[i - W] === c ? lab[i - W] : 0;
    if (!l && !u) { if (++n >= par.length) { const p2 = new Int32Array(par.length * 2); p2.set(par); par = p2; } par[n] = n; lab[i] = n; }
    else if (l && u) { const rl = find(l), ru = find(u); lab[i] = rl < ru ? rl : ru; if (rl !== ru) par[rl < ru ? ru : rl] = rl < ru ? rl : ru; }
    else lab[i] = l || u;
  }
  const cnt = new Float64Array(n + 1), sx = new Float64Array(n + 1), sy = new Float64Array(n + 1), sxx = new Float64Array(n + 1), syy = new Float64Array(n + 1), sxy = new Float64Array(n + 1);
  const x0 = new Int32Array(n + 1).fill(1e9), x1 = new Int32Array(n + 1).fill(-1), y0 = new Int32Array(n + 1).fill(1e9), y1 = new Int32Array(n + 1).fill(-1), tipo = new Uint8Array(n + 1);
  for (let y = 0; y < H; y++) for (let x = 0, i = y * W; x < W; x++, i++) {
    if (!lab[i]) continue; const r = find(lab[i]);
    cnt[r]++; sx[r] += x; sy[r] += y; sxx[r] += x * x; syy[r] += y * y; sxy[r] += x * y; tipo[r] = cls[i];
    if (x < x0[r]) x0[r] = x; if (x > x1[r]) x1[r] = x; if (y < y0[r]) y0[r] = y; if (y > y1[r]) y1[r] = y;
  }
  const segs = [];
  for (let r = 1; r <= n; r++) {
    if (par[r] !== r || cnt[r] < minN) continue;
    const c = cnt[r], mx = sx[r] / c, my = sy[r] / c, vx = sxx[r] / c - mx * mx, vy = syy[r] / c - my * my, cv = sxy[r] / c - mx * my;
    const h = tipo[r] === 1;
    const len = h ? x1[r] - x0[r] + 1 : y1[r] - y0[r] + 1, spread = h ? y1[r] - y0[r] + 1 : x1[r] - x0[r] + 1;
    const p = h ? (vx > 0 ? cv / vx : 0) : (vy > 0 ? cv / vy : 0);
    const g = c / len;
    if (!aceptar(len, g, spread, p)) continue;
    segs.push(h ? { o: 'h', c: my + 0.5, a: x0[r], b: x1[r] + 1, g, p } : { o: 'v', c: mx + 0.5, a: y0[r], b: y1[r] + 1, g, p });
  }
  return segs;
}

/**
 * Quita trazos cortos claramente más delgados que los muros largos (letras de rótulos en negrita, flechas, símbolos).
 * Referencia: percentil 25 (ponderado por largo) del grosor de los segmentos largos, que sí son muros.
 */
function quitarDelgados(segs, G) {
  const largos = segs.filter(q => q.b - q.a >= 6 * G).sort((p, q) => p.g - q.g);
  if (!largos.length) return segs;
  const tot = largos.reduce((s, q) => s + q.b - q.a, 0); let acc = 0, gRef = largos[0].g;
  for (const q of largos) { acc += q.b - q.a; if (acc >= 0.25 * tot) { gRef = q.g; break; } }
  return segs.filter(q => q.b - q.a >= 10 * G || q.g >= 0.6 * gRef);
}

/** Ángulo de inclinación global (mediana ponderada por longitud de los segmentos largos). */
function inclinacion(segs, G) {
  const v = segs.filter(q => q.b - q.a >= 6 * G).map(q => ({ ang: q.o === 'h' ? Math.atan(q.p) : Math.atan(-q.p), w: q.b - q.a }));
  if (v.length < 2) return 0;
  v.sort((a, b) => a.ang - b.ang);
  const tot = v.reduce((s, q) => s + q.w, 0); let acc = 0;
  for (const q of v) { acc += q.w; if (acc >= tot / 2) return q.ang; }
  return 0;
}

/**
 * ¿Qué hay en el hueco de un muro? Revisa la tinta FINA dentro de la banda del muro entre a y b.
 * 'ventana': 2+ líneas finas paralelas a lo largo del hueco; 'linea': una sola línea; 'vacio': nada (puerta/vano).
 */
function clasificarHueco(fina, M, W, H, o, c, a, b, g) {
  const lo = Math.floor(c - g / 2) - 1, hi = Math.ceil(c + g / 2) + 1;
  // tramo realmente libre de muro (el hueco puede incluir el cruce con un muro perpendicular)
  const ma = Math.max(lo + 2, Math.round(c - g / 2 + 1)), mb = Math.min(hi - 2, Math.round(c + g / 2 - 1));
  let ra = -1, rb = -1, ini = -1;
  for (let t = Math.floor(a); t <= Math.ceil(b); t++) {
    let lleno = t < 0 || t >= (o === 'h' ? W : H);
    for (let u = ma; u <= mb && !lleno; u++) { const x = o === 'h' ? t : u, y = o === 'h' ? u : t; if (x >= 0 && y >= 0 && x < W && y < H && M[y * W + x]) lleno = true; }
    if (!lleno) { if (ini < 0) ini = t; if (t - ini > rb - ra) { ra = ini; rb = t; } } else ini = -1;
  }
  if (ra < 0) return { tipo: 'lleno', a, b };
  a = ra; b = rb + 1;
  return { tipo: tipoBanda(fina, W, H, o, a, b, lo, hi), a, b };
}

function tipoBanda(fina, W, H, o, a, b, lo, hi) {
  const ia = Math.ceil(a) + 1, ib = Math.floor(b) - 2;
  if (ib - ia < 2) return 'vacio';
  let cols = 0, conTinta = 0, dos = 0;
  for (let t = ia; t <= ib; t++) {
    let runs = 0, prev = 0, tinta = 0;
    for (let u = lo; u <= hi; u++) {
      const x = o === 'h' ? t : u, y = o === 'h' ? u : t;
      const v = x >= 0 && y >= 0 && x < W && y < H ? fina[y * W + x] : 0;
      if (v) { tinta++; if (!prev) runs++; } prev = v;
    }
    cols++; if (tinta && tinta <= 0.8 * (hi - lo + 1)) conTinta++; if (runs >= 2) dos++;
  }
  if (dos / cols >= 0.5) return 'ventana';
  if (conTinta / cols >= 0.85) return 'linea';
  if (conTinta / cols <= 0.35) return 'vacio';
  return 'mixto';
}

const RANGO_PUERTA = [2.5, 10]; // múltiplos de G (≈ 0.4–1.5 m con muro de 15 cm)

/** Une colineales. Con `huecos`, cierra huecos de puerta/ventana y registra la abertura. */
function fusionar(lista, G, tipoHueco, aberturas, huecos) {
  if (!lista.length) return [];
  const o = lista[0].o;
  const ord = lista.slice().sort((p, q) => p.c - q.c);
  const grupos = [];
  for (const q of ord) {
    const gr = grupos[grupos.length - 1];
    if (gr && Math.abs(q.c - gr.c) <= Math.max(2, 0.6 * Math.min(gr.g, q.g))) { gr.items.push(q); const w = q.b - q.a; gr.c = (gr.c * gr.w + q.c * w) / (gr.w + w); gr.w += w; gr.g = Math.min(gr.g, q.g); }
    else grupos.push({ c: q.c, w: q.b - q.a, g: q.g, items: [q] });
  }
  const out = [];
  for (const gr of grupos) {
    const it = gr.items.sort((p, q) => p.a - q.a);
    let cur = { ...it[0] };
    for (let j = 1; j < it.length; j++) {
      const q = it[j], gap = q.a - cur.b;
      let unir = gap <= 2 * G, ab = null;
      if (!unir && huecos) {
        const gm = Math.max(cur.g, q.g), cc = (cur.c + q.c) / 2;
        const { tipo: t, a: ha, b: hb } = tipoHueco(o, cc, cur.b, q.a, gm), w = hb - ha;
        if (t === 'ventana' && gap <= 25 * G) { unir = true; ab = 'ventana'; }
        else if (gap <= RANGO_PUERTA[1] * G && w >= RANGO_PUERTA[0] * G && (t === 'vacio' || t === 'linea' || t === 'mixto')) { unir = true; ab = 'puerta'; }
        if (ab) aberturas.push(o === 'h' ? { tipo: ab, x: (ha + hb) / 2, y: cc, ancho: w } : { tipo: ab, x: cc, y: (ha + hb) / 2, ancho: w });
      }
      if (unir) {
        const w1 = cur.b - cur.a, w2 = q.b - q.a;
        cur.c = (cur.c * w1 + q.c * w2) / (w1 + w2); cur.g = (cur.g * w1 + q.g * w2) / (w1 + w2); cur.b = Math.max(cur.b, q.b);
      } else { out.push(cur); cur = { ...q }; }
    }
    out.push(cur);
  }
  return out;
}

/**
 * Lleva cada extremo de `lista` al eje del muro perpendicular más cercano en su dirección:
 * cerca (≤ 1.5 G) → snap (cierra esquinas y T); hueco de puerta → extiende + puerta; ventana → extiende + ventana.
 */
function extender(lista, perp, G, tipoHueco, aberturas, estricto = false) {
  for (const fase of [0, 1]) for (const q of lista) {
    if (fase === 0) q.unido = [false, false];
    for (const lado of [0, 1]) {
      if (fase === 1 && (q.unido[lado] || !((!estricto && q.b - q.a >= 8 * G) || q.unido[1 - lado]))) continue; // huecos solo desde muros anclados
      const fin = lado ? q.b : q.a; let mejor = null, dm = Infinity;
      for (const p of perp) {
        const tol = Math.max(p.g, G) * 1.2;
        if (q.c < p.a - tol || q.c > p.b + tol) continue;
        const d = lado ? p.c - fin : fin - p.c; // >0: el perpendicular está adelante
        if (d < -(1.5 * G + p.g / 2)) continue;
        if (lado ? p.c <= q.a + G : p.c >= q.b - G) continue;
        if (d < dm) { dm = d; mejor = p; }
      }
      if (!mejor) continue;
      if (dm <= 1.5 * G + mejor.g / 2) { if (lado) q.b = mejor.c; else q.a = mejor.c; q.unido[lado] = true; mejor.tocado = true; continue; }
      if (fase === 0) continue;
      const cara = lado ? mejor.c - mejor.g / 2 : mejor.c + mejor.g / 2, gap = Math.abs(cara - fin);
      if (gap > 25 * G) continue;
      const [ga, gb] = lado ? [fin, cara] : [cara, fin];
      const { tipo: t, a: ha, b: hb } = tipoHueco(q.o, q.c, ga, gb, q.g), w = hb - ha;
      let ab = null;
      if (t === 'lleno' && gap <= RANGO_PUERTA[1] * G) { if (lado) q.b = mejor.c; else q.a = mejor.c; q.unido[lado] = mejor.tocado = true; continue; } // hay muro, solo no se segmentó
      if (t === 'ventana') ab = 'ventana';
      else if (t !== 'lleno' && w >= RANGO_PUERTA[0] * G && gap <= RANGO_PUERTA[1] * G) ab = 'puerta';
      if (!ab) continue;
      aberturas.push(q.o === 'h' ? { tipo: ab, x: (ha + hb) / 2, y: q.c, ancho: w } : { tipo: ab, x: q.c, y: (ha + hb) / 2, ancho: w });
      if (lado) q.b = mejor.c; else q.a = mejor.c;
      q.unido[lado] = mejor.tocado = true;
    }
  }
}

function rectSeg(q) {
  const h = q.g / 2;
  return q.o === 'h' ? [q.a - h, q.c - h, q.b + h, q.c + h] : [q.c - h, q.a - h, q.c + h, q.b + h];
}
function distRect(r1, r2) {
  const dx = Math.max(0, r1[0] - r2[2], r2[0] - r1[2]), dy = Math.max(0, r1[1] - r2[3], r2[1] - r1[3]);
  return Math.hypot(dx, dy);
}

/** Quita segmentos que caen dentro de la banda de un muro paralelo más grueso (duplicados, líneas de ventana). */
function quitarContenidos(segs) {
  const fuera = new Uint8Array(segs.length);
  for (let i = 0; i < segs.length; i++) {
    const q = segs[i], L = q.b - q.a;
    for (let j = 0; j < segs.length && !fuera[i]; j++) {
      const p = segs[j];
      if (i === j || fuera[j] || p.o !== q.o || p.g < q.g || (p.g === q.g && j > i)) continue;
      if (Math.abs(q.c - p.c) + q.g / 2 <= p.g / 2 + 2 && Math.min(p.b, q.b) - Math.max(p.a, q.a) >= 0.8 * L) fuera[i] = 1;
    }
  }
  return segs.filter((_, i) => !fuera[i]);
}

/** Quita segmentos cortos que no tocan a ningún otro (restos de texto grueso, símbolos). */
function quitarSueltos(segs, G) {
  const R = segs.map(rectSeg);
  return segs.filter((q, i) => {
    if (q.b - q.a >= 6 * G) return true;
    for (let j = 0; j < segs.length; j++) if (j !== i && distRect(R[i], R[j]) <= 2 * G) return true;
    return false;
  });
}

/** Ignora el marco de la lámina (líneas gruesas que recorren casi toda la imagen pegadas al borde). */
function quitarMarco(segs, W, H, adv) {
  const out = segs.filter(q => {
    const L = q.b - q.a;
    if (q.o === 'h') return !(L > 0.8 * W && (q.c < 0.08 * H || q.c > 0.92 * H));
    return !(L > 0.8 * H && (q.c < 0.08 * W || q.c > 0.92 * W));
  });
  if (out.length < segs.length) adv.push('Ignoré el marco de la lámina.');
  return out;
}

/** Agrupa segmentos en plantas: rejilla gruesa + dilatación + componentes conexas; une cajas traslapadas. */
function agruparPlantas(segs, W, H, G, adv) {
  const c = Math.max(2, Math.round(G)), gw = Math.ceil(W / c), gh = Math.ceil(H / c);
  const grid = new Uint8Array(gw * gh), R = segs.map(rectSeg);
  const celdas = R.map(r => [Math.max(0, Math.floor(r[0] / c)), Math.max(0, Math.floor(r[1] / c)), Math.min(gw - 1, Math.floor(r[2] / c)), Math.min(gh - 1, Math.floor(r[3] / c))]);
  for (const [a, b, e, f] of celdas) for (let y = b; y <= f; y++) for (let x = a; x <= e; x++) grid[y * gw + x] = 1;
  const rad = Math.max(1, Math.ceil(6 * G / c));
  const t = new Uint8Array(gw * gh), d = new Uint8Array(gw * gh);
  dilatar1D(grid, t, gw, gh, rad, rad, false); dilatar1D(t, d, gw, gh, rad, rad, true);
  const lab = new Int32Array(gw * gh), pila = new Int32Array(gw * gh); let n = 0;
  for (let i = 0; i < d.length; i++) {
    if (!d[i] || lab[i]) continue; n++; let sp = 0; pila[sp++] = i; lab[i] = n;
    while (sp) { const p = pila[--sp], x = p % gw, y = (p / gw) | 0;
      if (x > 0 && d[p - 1] && !lab[p - 1]) { lab[p - 1] = n; pila[sp++] = p - 1; }
      if (x < gw - 1 && d[p + 1] && !lab[p + 1]) { lab[p + 1] = n; pila[sp++] = p + 1; }
      if (y > 0 && d[p - gw] && !lab[p - gw]) { lab[p - gw] = n; pila[sp++] = p - gw; }
      if (y < gh - 1 && d[p + gw] && !lab[p + gw]) { lab[p + gw] = n; pila[sp++] = p + gw; } }
  }
  const mapa = new Map();
  segs.forEach((q, i) => {
    const [a, b] = celdas[i]; const l = lab[b * gw + a]; if (!l) return;
    if (!mapa.has(l)) mapa.set(l, { segs: [], x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, largo: 0 });
    const gr = mapa.get(l), r = R[i]; gr.segs.push(q); gr.largo += q.b - q.a;
    gr.x0 = Math.min(gr.x0, r[0]); gr.y0 = Math.min(gr.y0, r[1]); gr.x1 = Math.max(gr.x1, r[2]); gr.y1 = Math.max(gr.y1, r[3]);
  });
  let grupos = [...mapa.values()];
  // une cajas traslapadas
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (let i = 0; i < grupos.length && !cambio; i++) for (let j = i + 1; j < grupos.length && !cambio; j++) {
      const A = grupos[i], B = grupos[j];
      if (A.x0 < B.x1 && B.x0 < A.x1 && A.y0 < B.y1 && B.y0 < A.y1) {
        A.segs.push(...B.segs); A.largo += B.largo; A.x0 = Math.min(A.x0, B.x0); A.y0 = Math.min(A.y0, B.y0); A.x1 = Math.max(A.x1, B.x1); A.y1 = Math.max(A.y1, B.y1);
        grupos.splice(j, 1); cambio = true;
      }
    }
  }
  const maxL = Math.max(0, ...grupos.map(gr => gr.largo));
  const antes = grupos.length;
  grupos = grupos.filter(gr => gr.segs.length >= 4 && gr.largo >= 0.2 * maxL && (gr.x1 - gr.x0) >= 8 * G && (gr.y1 - gr.y0) >= 8 * G);
  if (grupos.length < antes && grupos.length) adv.push(`Descarté ${antes - grupos.length} grupo(s) pequeño(s) de trazos gruesos (rótulos, símbolos o detalles).`);
  const banda = Math.max(1, H / 3);
  grupos.sort((p, q) => Math.floor(p.y0 / banda) - Math.floor(q.y0 / banda) || p.x0 - q.x0);
  return grupos.slice(0, 8);
}

function pintarSeg(m, W, H, q) {
  const g = Math.max(2, q.g), [rx0, ry0, rx1, ry1] = rectSeg({ ...q, g });
  const xa = Math.max(0, Math.ceil(rx0 - 0.5)), xb = Math.min(W - 1, Math.floor(rx1 - 0.5)), ya = Math.max(0, Math.ceil(ry0 - 0.5)), yb = Math.min(H - 1, Math.floor(ry1 - 0.5));
  for (let y = ya; y <= yb; y++) m.fill(1, y * W + xa, y * W + xb + 1);
}

/* ====================================================================================== */
/* espacios                                                                                */
/* ====================================================================================== */
function espaciosEnRecorte(cerrada, W, X0, Y0, cw, ch, G, mPx2) {
  const N = cw * ch, lab = new Int32Array(N), pila = new Int32Array(N);
  const libre = i => !cerrada[(Y0 + ((i / cw) | 0)) * W + X0 + (i % cw)];
  const regiones = [];
  for (let i0 = 0; i0 < N; i0++) {
    if (lab[i0] || !libre(i0)) continue;
    const L = regiones.length + 1; let sp = 0; pila[sp++] = i0; lab[i0] = L;
    let area = 0, borde = false, sx = 0, sy = 0, bx0 = cw, by0 = ch, bx1 = 0, by1 = 0;
    while (sp) {
      const p = pila[--sp], x = p % cw, y = (p / cw) | 0;
      area++; sx += x; sy += y; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
      if (x === 0 || y === 0 || x === cw - 1 || y === ch - 1) borde = true;
      if (x > 0 && !lab[p - 1] && libre(p - 1)) { lab[p - 1] = L; pila[sp++] = p - 1; }
      if (x < cw - 1 && !lab[p + 1] && libre(p + 1)) { lab[p + 1] = L; pila[sp++] = p + 1; }
      if (y > 0 && !lab[p - cw] && libre(p - cw)) { lab[p - cw] = L; pila[sp++] = p - cw; }
      if (y < ch - 1 && !lab[p + cw] && libre(p + cw)) { lab[p + cw] = L; pila[sp++] = p + cw; }
    }
    regiones.push({ L, area, borde, sx, sy, inicio: i0, bx0, by0, bx1, by1 });
  }
  const minArea = Math.max(0.015 * N, 1.5 / mPx2);
  const out = [], vivos = new Set();
  for (const r of regiones) {
    if (r.borde || r.area < minArea || Math.min(r.bx1 - r.bx0 + 1, r.by1 - r.by0 + 1) < 3 * G) continue;
    const crudo = trazar(lab, cw, ch, r.L, r.inicio % cw, (r.inicio / cw) | 0);
    const poligono = simplificarRectilineo(crudo, Math.max(2, 0.6 * G));
    if (poligono.length < 4) continue;
    // centro: promedio de píxeles; si cae fuera, el punto medio de la corrida más larga de esa fila
    let cx = r.sx / r.area, cy = r.sy / r.area;
    const fy = Math.round(cy), fx = Math.round(cx);
    if (lab[fy * cw + fx] !== r.L) {
      let mejor = null;
      for (let dy = 0; dy < ch && !mejor; dy++) for (const yy of [fy - dy, fy + dy]) {
        if (yy < 0 || yy >= ch) continue; let x = 0, best = 0;
        while (x < cw) { if (lab[yy * cw + x] !== r.L) { x++; continue; } let e = x; while (e < cw && lab[yy * cw + e] === r.L) e++; if (e - x > best) { best = e - x; mejor = [(x + e) / 2, yy + 0.5]; } x = e; }
        if (mejor) break;
      }
      if (mejor) [cx, cy] = mejor;
    } else { cx += 0.5; cy += 0.5; }
    out.push({ poligono, area: r.area, centro: [cx, cy] }); vivos.add(r.L);
  }
  return { espacios: out, lab, vivos };
}

/** Seguimiento de fronteras entre píxeles (crack following, 4-conexo). Devuelve vértices en esquinas de píxel. */
function trazar(lab, cw, ch, L, sx, sy) {
  const dentro = (x, y) => x >= 0 && y >= 0 && x < cw && y < ch && lab[y * cw + x] === L;
  const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
  let x = sx, y = sy, d = 0; const pts = [[x, y]]; let guard = 0; const lim = 4 * (cw + 1) * (ch + 1);
  do {
    let lx, ly, rx, ry;
    if (d === 0) { lx = x; ly = y - 1; rx = x; ry = y; }
    else if (d === 1) { lx = x; ly = y; rx = x - 1; ry = y; }
    else if (d === 2) { lx = x - 1; ly = y; rx = x - 1; ry = y - 1; }
    else { lx = x - 1; ly = y - 1; rx = x; ry = y - 1; }
    let nd;
    if (!dentro(rx, ry)) nd = (d + 1) & 3; else if (dentro(lx, ly)) nd = (d + 3) & 3; else nd = d;
    if (nd !== d && !(x === sx && y === sy)) pts.push([x, y]);
    d = nd; x += DX[d]; y += DY[d];
  } while (!(x === sx && y === sy) && ++guard < lim);
  return pts;
}

/** Simplifica un polígono rectilíneo: quita colineales y escalones/muescas menores que eps. */
function simplificarRectilineo(pts, eps) {
  let p = limpiarColineales(pts.map(q => q.slice()));
  let iter = 0;
  while (p.length > 4 && iter++ < 2000) {
    let iMin = -1, lMin = eps;
    for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; const l = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]); if (l < lMin) { lMin = l; iMin = i; } }
    if (iMin < 0) break;
    const n = p.length, i0 = (iMin - 1 + n) % n, i1 = iMin, i2 = (iMin + 1) % n, i3 = (iMin + 2) % n;
    const A = p[i0], B = p[i1], C = p[i2], D = p[i3];
    const hor = B[1] === C[1]; // la arista corta es horizontal → sus vecinas son verticales
    const lAB = Math.abs(A[0] - B[0]) + Math.abs(A[1] - B[1]), lCD = Math.abs(C[0] - D[0]) + Math.abs(C[1] - D[1]);
    if (hor) { const xx = lAB >= lCD ? B[0] : C[0]; A[0] = xx; D[0] = xx; }
    else { const yy = lAB >= lCD ? B[1] : C[1]; A[1] = yy; D[1] = yy; }
    p = limpiarColineales(p.filter((_, i) => i !== i1 && i !== i2));
  }
  return p;
}

function limpiarColineales(p) {
  let cambio = true;
  while (cambio && p.length > 3) {
    cambio = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i - 1 + p.length) % p.length], b = p[i], c = p[(i + 1) % p.length];
      if ((a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1]) || (a[0] === b[0] && a[1] === b[1])) { p.splice(i, 1); cambio = true; break; }
    }
  }
  return p;
}
