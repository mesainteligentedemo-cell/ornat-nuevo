// ORNAT · Plano a render — editor 2D sobre la lámina (SVG). Corrige lo que la detección o la IA no leyeron bien:
// dibujar, mover y borrar muros; colocar puertas, ventanas y corredizas; seleccionar espacios; calibrar la escala con dos clics.
import { uid, ajustarAberturaAMuro, distanciaASegmento, limites, largo, centroide, puntoEnPoligono, USOS } from './modelo.js';

const NS = 'http://www.w3.org/2000/svg';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLOR_USO = { sala: '#98ff03', comedor: '#c6f08a', cocina: '#f2c46d', recamara: '#9cc4f2', bano: '#7fd6d0', estudio: '#c9b6f0', terraza: '#e8d9b0', vestidor: '#f0b6d0', lavanderia: '#b8e0f0', circulacion: '#dcd8cf', escalera: '#cfcac0', cochera: '#bdbdbd', bodega: '#c7bfb0', jardin: '#a6d39a', alberca: '#8fd3ea', otro: '#e6e2d8' };
const r2 = n => Math.round(n * 20) / 20; // rejilla de 5 cm

export const HERRAMIENTAS = {
  seleccionar: 'Seleccionar y mover', muro: 'Dibujar muro', puerta: 'Puerta', ventana: 'Ventana', corrediza: 'Corrediza', borrar: 'Borrar', calibrar: 'Calibrar escala',
};

export class Editor {
  constructor(host, { onCambio = () => {}, onSeleccion = () => {}, onCalibrar = () => {}, anunciar = () => {} } = {}) {
    Object.assign(this, { host, onCambio, onSeleccion, onCalibrar, anunciar });
    this.planta = null; this.lamina = null; this.tool = 'seleccionar'; this.sel = null; this.tmp = null; this.verLamina = true;
    this.svg = document.createElementNS(NS, 'svg'); this.svg.setAttribute('class', 'editor-svg'); this.svg.setAttribute('role', 'img'); this.svg.setAttribute('tabindex', '0');
    host.replaceChildren(this.svg);
    this.svg.addEventListener('pointerdown', e => this.down(e)); this.svg.addEventListener('pointermove', e => this.move(e)); this.svg.addEventListener('pointerup', e => this.up(e));
    this.svg.addEventListener('keydown', e => this.tecla(e));
  }
  /** Transformación metros <-> px de la lámina (o una lámina virtual de 50 px/m si no hay imagen). */
  mapa() {
    const l = this.planta?.lamina;
    if (l && this.lamina) return { ox: l.x, oy: l.y, k: l.mPorPx, w: this.lamina.ancho, h: this.lamina.alto };
    const lim = limites(this.planta || { muros: [], espacios: [] }); const k = 0.02, m = 60;
    return { ox: m - lim.x0 / k, oy: m - lim.y0 / k, k, w: Math.max(400, lim.ancho / k + m * 2), h: Math.max(300, lim.fondo / k + m * 2), virtual: true };
  }
  mostrar(planta, lamina) { this.planta = planta; this.lamina = lamina || null; this.sel = null; this.tmp = null; this.dibujar(); }
  herramienta(t) { this.tool = HERRAMIENTAS[t] ? t : 'seleccionar'; this.tmp = null; this.svg.dataset.tool = this.tool; this.dibujar(); }
  seleccionar(sel) { this.sel = sel; this.dibujar(); }

  dibujar() {
    const P = this.planta; if (!P) { this.svg.innerHTML = ''; return; }
    const M = this.mapa(); const X = x => M.ox + x / M.k, Y = y => M.oy + y / M.k; const px = m => m / M.k;
    this.svg.setAttribute('viewBox', `0 0 ${M.w} ${M.h}`);
    this.svg.setAttribute('aria-label', `Editor de la ${P.nombre}: ${P.muros.length} muros, ${P.aberturas.length} aberturas y ${P.espacios.length} espacios. Usa la lista de espacios para editar sin el mouse.`);
    const fs = Math.max(10, px(0.32)); const out = [];
    if (M.virtual) out.push(`<defs><pattern id="rej" width="${px(1)}" height="${px(1)}" patternUnits="userSpaceOnUse"><path d="M ${px(1)} 0 L 0 0 0 ${px(1)}" fill="none" stroke="#dcd8cf" stroke-width="1"/></pattern></defs><rect width="100%" height="100%" fill="url(#rej)"/>`);
    else if (this.verLamina) out.push(`<image href="${esc(this.lamina.url)}" x="0" y="0" width="${M.w}" height="${M.h}" opacity="0.9" preserveAspectRatio="none"/>`);
    for (const e of P.espacios) {
      const s = this.sel?.tipo === 'espacio' && this.sel.id === e.id; const [cx, cy] = centroide(e.poligono);
      out.push(`<polygon data-tipo="espacio" data-id="${esc(e.id)}" points="${e.poligono.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')}" fill="${COLOR_USO[e.uso] || '#e6e2d8'}" fill-opacity="${s ? 0.55 : 0.28}" stroke="${s ? '#0a0a0b' : 'none'}" stroke-width="${s ? 3 : 0}"/>`);
      out.push(`<text x="${X(cx)}" y="${Y(cy)}" font-size="${fs}" text-anchor="middle" class="lbl">${esc(e.nombre)}</text><text x="${X(cx)}" y="${Y(cy) + fs * 1.1}" font-size="${fs * 0.8}" text-anchor="middle" class="lbl sub">${esc(USOS[e.uso] || '')}</text>`);
    }
    for (const m of P.muros) {
      const s = this.sel?.tipo === 'muro' && this.sel.id === m.id;
      out.push(`<line x1="${X(m.x1)}" y1="${Y(m.y1)}" x2="${X(m.x2)}" y2="${Y(m.y2)}" stroke="${s ? '#98ff03' : '#0a0a0b'}" stroke-opacity="${s ? 1 : 0.82}" stroke-width="${Math.max(3, px(m.grosor))}" stroke-linecap="square"/>`);
      out.push(`<line data-tipo="muro" data-id="${esc(m.id)}" class="hit" x1="${X(m.x1)}" y1="${Y(m.y1)}" x2="${X(m.x2)}" y2="${Y(m.y2)}" stroke="transparent" stroke-width="${Math.max(14, px(0.45))}"/>`);
      if (s) for (const [x, y] of [[m.x1, m.y1], [m.x2, m.y2]]) out.push(`<circle cx="${X(x)}" cy="${Y(y)}" r="${Math.max(5, px(0.12))}" fill="#98ff03" stroke="#0a0a0b" stroke-width="2"/>`);
    }
    for (const a of P.aberturas) {
      const m = P.muros.find(w => w.id === a.muro); if (!m) continue; const L = largo(m); const ux = (m.x2 - m.x1) / L, uy = (m.y2 - m.y1) / L; const s = this.sel?.tipo === 'abertura' && this.sel.id === a.id;
      const x1 = m.x1 + ux * (a.pos - a.ancho / 2), y1 = m.y1 + uy * (a.pos - a.ancho / 2), x2 = m.x1 + ux * (a.pos + a.ancho / 2), y2 = m.y1 + uy * (a.pos + a.ancho / 2);
      const col = a.tipo === 'puerta' ? '#e0682b' : a.tipo === 'vano' ? '#9a978f' : '#1f78c8';
      out.push(`<line data-tipo="abertura" data-id="${esc(a.id)}" x1="${X(x1)}" y1="${Y(y1)}" x2="${X(x2)}" y2="${Y(y2)}" stroke="${s ? '#98ff03' : col}" stroke-width="${Math.max(6, px(m.grosor) * 0.9)}" stroke-linecap="butt"/>`);
    }
    if (this.tmp?.tipo === 'muro') out.push(`<line x1="${X(this.tmp.x1)}" y1="${Y(this.tmp.y1)}" x2="${X(this.tmp.x2)}" y2="${Y(this.tmp.y2)}" stroke="#98ff03" stroke-width="${Math.max(4, px(this.tmp.grosor))}" stroke-dasharray="${px(0.2)} ${px(0.1)}"/><text x="${X((this.tmp.x1 + this.tmp.x2) / 2)}" y="${Y((this.tmp.y1 + this.tmp.y2) / 2) - fs}" font-size="${fs}" text-anchor="middle" class="lbl">${largo(this.tmp).toFixed(2)} m</text>`);
    if (this.tmp?.tipo === 'calibrar') { for (const p of this.tmp.puntos) out.push(`<circle cx="${p[0]}" cy="${p[1]}" r="${Math.max(6, M.w / 250)}" fill="#98ff03" stroke="#0a0a0b" stroke-width="2"/>`); if (this.tmp.puntos.length === 2) { const [a, b] = this.tmp.puntos; out.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#0a0a0b" stroke-width="2" stroke-dasharray="6 4"/>`); } }
    this.svg.innerHTML = out.join('');
  }

  punto(e) { const pt = this.svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const p = pt.matrixTransform(this.svg.getScreenCTM().inverse()); const M = this.mapa(); return { px: [p.x, p.y], m: [(p.x - M.ox) * M.k, (p.y - M.oy) * M.k] }; }
  imantar([x, y], libre = false) {
    let best = null; for (const m of this.planta.muros) for (const [ex, ey] of [[m.x1, m.y1], [m.x2, m.y2]]) { const d = Math.hypot(ex - x, ey - y); if (d < 0.3 && (!best || d < best.d)) best = { d, p: [ex, ey] }; }
    return best ? best.p : libre ? [x, y] : [r2(x), r2(y)];
  }
  grosorTipico() { const g = this.planta.muros.map(m => m.grosor).sort((a, b) => a - b); return g.length ? g[Math.floor(g.length / 2)] : 0.15; }
  objetivo(e) { const t = e.target.closest?.('[data-tipo]'); return t ? { tipo: t.dataset.tipo, id: t.dataset.id } : null; }

  down(e) {
    if (!this.planta || e.button > 0) return; this.svg.focus({ preventScroll: true }); const { px, m } = this.punto(e); const obj = this.objetivo(e);
    if (this.tool === 'muro') { const p = this.imantar(m); this.tmp = { tipo: 'muro', x1: p[0], y1: p[1], x2: p[0], y2: p[1], grosor: this.grosorTipico() }; this.svg.setPointerCapture(e.pointerId); return; }
    if (this.tool === 'calibrar') { const pts = this.tmp?.tipo === 'calibrar' && this.tmp.puntos.length < 2 ? this.tmp.puntos : []; pts.push(px); this.tmp = { tipo: 'calibrar', puntos: pts }; this.dibujar();
      if (pts.length === 2) { const M = this.mapa(); const dpx = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]); this.onCalibrar({ distanciaPx: dpx, distanciaM: dpx * M.k }); } else this.anunciar('Marca el segundo extremo de la cota.'); return; }
    if (['puerta', 'ventana', 'corrediza'].includes(this.tool)) { const ab = ajustarAberturaAMuro(this.planta, { x: m[0], y: m[1], tipo: this.tool }); if (!ab) { this.anunciar('Haz clic sobre un muro para colocar la abertura.'); return; } this.planta.aberturas.push(ab); this.sel = { tipo: 'abertura', id: ab.id }; this.cambio(`${this.tool} agregada`); return; }
    if (this.tool === 'borrar') { if (obj && obj.tipo !== 'espacio') { this.sel = obj; this.borrarSeleccion(); } else if (obj) { this.sel = obj; this.borrarSeleccion(); } return; }
    // seleccionar
    this.sel = obj || this.espacioEn(m); this.onSeleccion(this.sel); this.dibujar();
    if (this.sel?.tipo === 'muro') { const w = this.planta.muros.find(x => x.id === this.sel.id); this.tmp = { tipo: 'mover', m0: m, orig: { ...w } }; this.svg.setPointerCapture(e.pointerId); }
  }
  move(e) {
    if (!this.tmp || this.tmp.tipo === 'calibrar') return; const { m } = this.punto(e);
    if (this.tmp.tipo === 'muro') { let p = this.imantar(m); const t = this.tmp; if (!e.shiftKey) { if (Math.abs(p[0] - t.x1) > Math.abs(p[1] - t.y1)) p = [p[0], t.y1]; else p = [t.x1, p[1]]; } t.x2 = p[0]; t.y2 = p[1]; this.dibujar(); return; }
    if (this.tmp.tipo === 'mover') { const w = this.planta.muros.find(x => x.id === this.sel?.id); if (!w) return; const o = this.tmp.orig; let dx = r2(m[0] - this.tmp.m0[0]), dy = r2(m[1] - this.tmp.m0[1]);
      if (Math.abs(o.y1 - o.y2) < 0.01) dx = 0; else if (Math.abs(o.x1 - o.x2) < 0.01) dy = 0; Object.assign(w, { x1: o.x1 + dx, y1: o.y1 + dy, x2: o.x2 + dx, y2: o.y2 + dy }); this.tmp.movido = dx || dy; this.dibujar(); }
  }
  up() {
    if (this.tmp?.tipo === 'muro') { const t = this.tmp; this.tmp = null; if (largo(t) >= 0.2) { const w = { id: uid('mu'), x1: t.x1, y1: t.y1, x2: t.x2, y2: t.y2, grosor: t.grosor }; this.planta.muros.push(w); this.sel = { tipo: 'muro', id: w.id }; this.cambio(`Muro de ${largo(w).toFixed(2)} m agregado`); } else this.dibujar(); return; }
    if (this.tmp?.tipo === 'mover') { const mov = this.tmp.movido; this.tmp = null; if (mov) this.cambio('Muro movido'); }
  }
  tecla(e) {
    if (e.key === 'Escape') { this.tmp = null; this.sel = null; this.onSeleccion(null); this.dibujar(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.sel) { e.preventDefault(); this.borrarSeleccion(); return; }
    const d = { ArrowLeft: [-0.05, 0], ArrowRight: [0.05, 0], ArrowUp: [0, -0.05], ArrowDown: [0, 0.05] }[e.key];
    if (d && this.sel?.tipo === 'muro') { e.preventDefault(); const w = this.planta.muros.find(x => x.id === this.sel.id); if (w) { w.x1 += d[0]; w.x2 += d[0]; w.y1 += d[1]; w.y2 += d[1]; this.cambio('Muro movido 5 cm'); } }
  }
  espacioEn(m) { const e = this.planta.espacios.find(s => puntoEnPoligono(m, s.poligono)); return e ? { tipo: 'espacio', id: e.id } : null; }
  borrarSeleccion() {
    const s = this.sel; if (!s) return; const P = this.planta;
    if (s.tipo === 'muro') { P.muros = P.muros.filter(m => m.id !== s.id); P.aberturas = P.aberturas.filter(a => a.muro !== s.id); }
    else if (s.tipo === 'abertura') P.aberturas = P.aberturas.filter(a => a.id !== s.id);
    else if (s.tipo === 'espacio') P.espacios = P.espacios.filter(e => e.id !== s.id);
    this.sel = null; this.cambio(s.tipo === 'muro' ? 'Muro borrado' : s.tipo === 'abertura' ? 'Abertura borrada' : 'Espacio borrado');
  }
  cancelarCalibracion() { if (this.tmp?.tipo === 'calibrar') { this.tmp = null; this.dibujar(); } }
  cambio(msg) { this.dibujar(); this.onCambio(this.planta, msg); this.anunciar(msg); }
}

/** Distancia de un punto (m) al muro más cercano — utilidad para pruebas. */
export const muroMasCercano = (planta, p) => planta.muros.map(m => ({ m, ...distanciaASegmento(p, m) })).sort((a, b) => a.d - b.d)[0] || null;
