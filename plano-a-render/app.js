// ORNAT · Plano a render — orquestación de la pantalla.
// Flujo: láminas -> plantas (ejemplo, detección local, IA opcional o dibujo a mano) -> modelo 3D + estilos -> render local -> exportar.
// Nada depende de llaves de API: el análisis con IA y el motor en la nube solo aparecen si el servidor los tiene activos.
import { ESTILOS, estiloPorId, buscarEstilos, TEMPERATURAS, REGIONES, PRESUPUESTOS, ESTILO_POR_DEFECTO } from './estilos.js';
import { normalizarProyecto, desdeJSON, aJSON, USOS, USO_KEYS, resumenPlanta, areaPoligono, escalarPlanta, plantaDesdePx, uid, ajustarAberturaAMuro, centroide, puntoEnPoligono, limites, estiloDe } from './modelo.js';
import { detectarPlano } from './deteccion.js';
import { Editor, HERRAMIENTAS } from './editor.js';
import { leerArchivos, cargarImagen, paraIA, LIMITES } from './laminas.js';
import { muestraCanvas } from './texturas.js';
import { Visor } from './visor.js';
import { renderizar, liberarRender, CALIDADES, RESOLUCIONES, soportePathTracing } from './render-local.js';
import { remote } from '../shared/remote-boot.js';
import '../shared/session-bar.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ALMACEN = 'ornat:plano-a-render:v1';
const EJEMPLOS = [
  { id: 'casa-dos-plantas', nombre: 'Casa de dos plantas', detalle: '240 m² · 3 recámaras · 2 plantas en una lámina' },
  { id: 'departamento', nombre: 'Departamento', detalle: '126 m² · 2 recámaras · terraza' },
  { id: 'villa-tulum', nombre: 'Villa en Tulum', detalle: '128 m² · terraza, alberca y jardín' },
];
const esEstilo = id => !!estiloPorId(id);

const S = {
  proyecto: null, laminas: new Map(), plantaSel: null, sel: null, herramienta: 'seleccionar',
  vista: 'iso', aplicarA: 'proyecto', filtros: { texto: '', temperatura: '', region: '', presupuesto: '' },
  servidor: { analisis: { disponible: false }, nube: { disponible: false, proveedores: [] } },
  render: { vista: '', calidad: 'borrador', res: 'hd', dof: false, modo: 'pt', corriendo: false, control: null, hecho: null },
};
let editor = null, visor = null;

/* ---------- utilidades de interfaz ---------- */
function toast(msg, tipo = 'ok') { const el = document.createElement('div'); el.className = `toast${tipo === 'error' ? ' error' : ''}`; el.textContent = msg; $('#toasts').append(el); setTimeout(() => el.remove(), tipo === 'error' ? 6500 : 3200); }
const anunciar = msg => { const n = $('#sr-anuncio'); n.textContent = ''; setTimeout(() => { n.textContent = msg; }, 30); };
function descargar(nombre, blob) { const url = URL.createObjectURL(blob); const a = Object.assign(document.createElement('a'), { href: url, download: nombre }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); }
const slug = s => String(s || 'proyecto').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'proyecto';
const planta = (id = S.plantaSel) => S.proyecto?.plantas.find(p => p.id === id) || S.proyecto?.plantas[0] || null;
const m2 = n => `${n.toLocaleString('es-MX', { maximumFractionDigits: 1 })} m²`;
const ocupado = (btn, on, texto) => { if (!btn) return; if (on) { btn.dataset.txt = btn.textContent; btn.disabled = true; btn.innerHTML = `<span class="spin" aria-hidden="true"></span> ${esc(texto)}`; } else { btn.disabled = false; btn.textContent = btn.dataset.txt || btn.textContent; } };
const pausa = () => new Promise(r => setTimeout(r, 30));

function guardarLocal(silencioso = true) {
  if (!S.proyecto) return false;
  try { localStorage.setItem(ALMACEN, aJSON(S.proyecto)); if (!silencioso) toast('Proyecto guardado en este navegador.'); return true; }
  catch { if (!silencioso) toast('No se pudo guardar en este navegador (almacenamiento lleno o bloqueado). Descarga el JSON.', 'error'); return false; }
}
function leerLocal() { try { const t = localStorage.getItem(ALMACEN); return t ? desdeJSON(t, { esEstilo }) : null; } catch { return null; } }
let tGuardar = 0; const autoguardar = () => { clearTimeout(tGuardar); tGuardar = setTimeout(() => { tGuardar = 0; guardarLocal(true); }, 600); };
// si la pestaña se cierra o se oculta antes de que corra el autoguardado, se guarda en ese momento
const guardarPendiente = () => { if (tGuardar) { clearTimeout(tGuardar); tGuardar = 0; guardarLocal(true); } };
addEventListener('pagehide', guardarPendiente); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') guardarPendiente(); });

/* ---------- láminas ---------- */
async function registrarLamina({ id = uid('la'), nombre, canvas, src }) {
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  const lam = { id, nombre, canvas, ancho: canvas.width, alto: canvas.height, url: URL.createObjectURL(blob), src };
  S.laminas.set(id, lam); return lam;
}
function limpiarLaminas() { for (const l of S.laminas.values()) URL.revokeObjectURL(l.url); S.laminas.clear(); }
const laminaDe = pl => (pl?.lamina ? S.laminas.get(pl.lamina.id) || null : null);

/* ---------- proyecto ---------- */
function nuevoProyecto(nombre) { return normalizarProyecto({ id: uid('pr'), nombre, origen: 'manual', estilo: ESTILO_POR_DEFECTO, laminas: [], plantas: [] }, { esEstilo }); }
function establecer(proyecto, { conservarSel = false } = {}) {
  S.proyecto = proyecto; if (!conservarSel || !planta(S.plantaSel)) S.plantaSel = proyecto.plantas[0]?.id || null; S.sel = null;
  pintarTodo(); refrescar3D(); autoguardar();
}
function cambioGeometria(msg) { S.proyecto.actualizado = new Date().toISOString(); pintarPanel(); refrescar3D(); autoguardar(); if (msg) anunciar(msg); }

async function abrirEjemplo(id, btn) {
  ocupado(btn, true, 'Cargando…');
  try {
    const r = await fetch(`muestras/${id}.json`); if (!r.ok) throw new Error('No se pudo cargar el ejemplo.');
    const p = desdeJSON(await r.text(), { esEstilo });
    limpiarLaminas();
    for (const l of p.laminas) if (l.src) await registrarLamina({ id: l.id, nombre: l.nombre, canvas: await cargarImagen(l.src), src: l.src });
    establecer(p); toast(`Ejemplo cargado: ${p.nombre}. Es un plano dibujado por ORNAT con su lectura ya hecha.`);
    $('#plano').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) { toast(e.message || 'No se pudo abrir el ejemplo.', 'error'); }
  finally { ocupado(btn, false); }
}

async function subirArchivos(files) {
  if (!files?.length) return;
  const zona = $('#zona'); zona?.classList.add('cargando');
  try {
    const hojas = await leerArchivos(files);
    if ((S.proyecto?.laminas.length || 0) + hojas.length > LIMITES.laminas) throw new Error(`Máximo ${LIMITES.laminas} láminas por proyecto.`);
    if (!S.proyecto) S.proyecto = nuevoProyecto(hojas[0]?.nombre || 'Proyecto nuevo');
    for (const h of hojas) { const lam = await registrarLamina(h); S.proyecto.laminas.push({ id: lam.id, nombre: lam.nombre, ancho: lam.ancho, alto: lam.alto }); }
    toast(`${hojas.length === 1 ? 'Lámina cargada' : `${hojas.length} láminas cargadas`}. Ahora detecta los muros o dibújalos.`);
    pintarTodo();
    // detección automática de la primera lámina sin plantas
    const pendiente = S.proyecto.laminas.find(l => !S.proyecto.plantas.some(p => p.lamina?.id === l.id));
    if (pendiente) await detectar(pendiente.id);
  } catch (e) { toast(e.message || 'No se pudo leer el archivo.', 'error'); }
  finally { zona?.classList.remove('cargando'); }
}

/* ---------- detección local ---------- */
function sugerirUsos(espacios) {
  const orden = espacios.map((e, i) => ({ i, a: areaPoligono(e.poligono) })).sort((a, b) => b.a - a.a); const cuenta = {};
  orden.forEach(({ i, a }, k) => { const uso = k === 0 && a > 12 ? 'sala' : a >= 8.5 && a <= 26 ? 'recamara' : a >= 2.4 && a < 8.5 ? 'bano' : 'otro'; cuenta[uso] = (cuenta[uso] || 0) + 1; espacios[i].uso = uso; espacios[i].nombre = `${USOS[uso]}${cuenta[uso] > 1 || uso === 'otro' ? ` ${cuenta[uso]}` : ''}`; });
  return espacios;
}
async function detectar(laminaId, btn) {
  const lam = S.laminas.get(laminaId); if (!lam) return toast('Esta lámina no tiene imagen cargada.', 'error');
  ocupado(btn, true, 'Leyendo muros…'); const prog = $('#det-prog'); if (prog) prog.hidden = false; await pausa();
  try {
    const ctx = lam.canvas.getContext('2d', { willReadFrequently: true }); const img = ctx.getImageData(0, 0, lam.ancho, lam.alto);
    const t0 = performance.now(); const res = detectarPlano({ data: img.data, width: lam.ancho, height: lam.alto });
    const ms = Math.round(performance.now() - t0);
    if (!res.plantas.length) { toast(res.diagnostico.advertencias?.[0] || 'No encontré muros en esta lámina.', 'error'); return; }
    const mpp = res.diagnostico.mPorPxEstimado > 0 ? res.diagnostico.mPorPxEstimado : 0.02;
    const yaHay = S.proyecto.plantas.length; S.proyecto.plantas = S.proyecto.plantas.filter(p => p.lamina?.id !== laminaId);
    res.plantas.sort((a, b) => a.recorte.x - b.recorte.x || a.recorte.y - b.recorte.y).forEach((pp, i) => {
      sugerirUsos(pp.espacios);
      const pl = plantaDesdePx(pp, mpp, { laminaId, nombre: res.plantas.length > 1 ? `Planta ${i + 1} · ${lam.nombre}` : lam.nombre, nivel: yaHay + i, confianza: 'baja', fuente: 'supuesta', nota: 'Escala supuesta a partir del grosor típico de muro (15 cm). Calibra con una cota.' });
      pl.lamina = { id: laminaId, x: pp.recorte.x, y: pp.recorte.y, mPorPx: mpp };
      // plantaDesdePx usa el recorte como origen: conservamos esa relación
      S.proyecto.plantas.push(pl);
    });
    S.proyecto.origen = 'deteccion'; S.proyecto.plantas.sort((a, b) => a.nivel - b.nivel);
    S.plantaSel = S.proyecto.plantas.find(p => p.lamina?.id === laminaId)?.id || S.plantaSel;
    const d = res.diagnostico; pintarTodo(); refrescar3D(); autoguardar();
    toast(`Detección local en ${ms} ms: ${d.murosDetectados} muros, ${d.espaciosDetectados} espacios${d.aberturasDetectadas ? `, ${d.aberturasDetectadas} aberturas` : ''}. Revisa usos y calibra la escala.`);
    for (const a of d.advertencias || []) toast(a, 'error');
  } catch (e) { console.error(e); toast('La detección automática falló en esta lámina. Puedes dibujar los muros a mano.', 'error'); }
  finally { ocupado(btn, false); if (prog) prog.hidden = true; }
}

/** Recalcula los espacios a partir de los muros actuales (tras corregirlos a mano), conservando nombres y usos. */
async function recalcularEspacios(btn) {
  const pl = planta(); if (!pl?.muros.length) return;
  ocupado(btn, true, 'Recalculando…'); await pausa();
  try {
    const lim = limites(pl); const k = 0.025, m = 40; const W = Math.ceil(lim.ancho / k + m * 2), H = Math.ceil(lim.fondo / k + m * 2);
    const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = '#000'; ctx.lineCap = 'square';
    const X = x => m + (x - lim.x0) / k, Y = y => m + (y - lim.y0) / k;
    for (const w of pl.muros) { ctx.lineWidth = Math.max(5, w.grosor / k); ctx.beginPath(); ctx.moveTo(X(w.x1), Y(w.y1)); ctx.lineTo(X(w.x2), Y(w.y2)); ctx.stroke(); }
    const res = detectarPlano({ data: ctx.getImageData(0, 0, W, H).data, width: W, height: H }, { grosorMinPx: 4 });
    const esp = res.plantas.flatMap(p => p.espacios).map(e => ({ poligono: e.poligono.map(([x, y]) => [Math.round(((x - m) * k + lim.x0) * 1000) / 1000, Math.round(((y - m) * k + lim.y0) * 1000) / 1000]) }));
    const viejos = pl.espacios; let n = 0;
    pl.espacios = esp.map(e => { const v = viejos.find(o => puntoEnPoligono(centroide(o.poligono), e.poligono)); if (v) n++; return { id: v?.id || uid('es'), nombre: v?.nombre || `Espacio ${pl.espacios.length + 1}`, uso: v?.uso || 'otro', poligono: e.poligono, estilo: v?.estilo || null }; }).filter(e => areaPoligono(e.poligono) > 0.5);
    cambioGeometria(); editor.mostrar(pl, laminaDe(pl));
    toast(`${pl.espacios.length} espacios a partir de los muros (${n} conservaron su nombre y uso).`);
  } catch (e) { console.error(e); toast('No se pudieron recalcular los espacios.', 'error'); }
  finally { ocupado(btn, false); }
}

/* ---------- IA opcional ---------- */
async function leerConIA(laminaId, btn) {
  const lam = S.laminas.get(laminaId); if (!lam) return;
  ocupado(btn, true, 'Claude está leyendo la lámina…');
  try {
    const img = await paraIA(lam.canvas);
    const r = await fetch('/api/plano/analizar', { method: 'POST', headers: { 'content-type': 'application/json', ...(remote?.authHeader?.() || {}) }, body: JSON.stringify({ image: { media_type: img.media_type, data: img.data } }) });
    let j = null; try { j = await r.json(); } catch {}
    if (!r.ok) throw new Error(j?.message || `El servidor respondió ${r.status}.`);
    const plantas = j.analisis?.plantas || []; if (!plantas.length) throw new Error('La IA no encontró plantas en esta lámina.');
    S.proyecto.plantas = S.proyecto.plantas.filter(p => p.lamina?.id !== laminaId); const base = S.proyecto.plantas.length;
    plantas.forEach((p, i) => {
      const rx = p.recorte.x * lam.ancho, ry = p.recorte.y * lam.alto; const lim = limites({ muros: p.muros, espacios: p.espacios.map(e => ({ poligono: e.poligono })) });
      const mpp = p.escala.metrosPorPixel ? p.escala.metrosPorPixel * img.escala : Math.max(lim.x1, 1) / Math.max(1, p.recorte.ancho * lam.ancho);
      const pl = { id: uid('pl'), nombre: p.nombre || `Planta ${i + 1}`, nivel: p.nivel ?? base + i, escala: { confianza: p.escala.confianza, fuente: 'ia', nota: p.escala.evidencia || '' }, lamina: { id: laminaId, x: rx, y: ry, mPorPx: mpp },
        muros: p.muros.map(m => ({ id: uid('mu'), ...m })), aberturas: [], espacios: p.espacios.map(e => ({ id: uid('es'), nombre: e.nombre, uso: e.uso, poligono: e.poligono, estilo: null })) };
      for (const a of p.aberturas) { const ab = ajustarAberturaAMuro(pl, a); if (ab) pl.aberturas.push(ab); }
      S.proyecto.plantas.push(pl);
    });
    const norm = normalizarProyecto({ ...S.proyecto, origen: 'ia' }, { esEstilo }); establecer(norm, { conservarSel: false });
    const baja = norm.plantas.some(p => p.escala.confianza === 'baja');
    toast(`Claude leyó ${plantas.length} planta(s).${baja ? ' No encontró una cota legible: calibra la escala.' : ''}`);
    for (const a of j.analisis.advertencias || []) toast(a);
  } catch (e) { toast(e.message || 'No se pudo leer con IA.', 'error'); }
  finally { ocupado(btn, false); }
}

/* ---------- paso 1: plano ---------- */
function pintarInicio() {
  return `<div class="pr-inicio">
    <label class="zona" id="zona" for="archivos">
      <input id="archivos" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.pdf" multiple class="sr">
      <span class="zona-t">Arrastra aquí tus láminas</span>
      <span class="hint">o haz clic para elegirlas · JPG, PNG, WebP o PDF de hasta 40 MB · máximo 12 láminas</span>
    </label>
    <div class="pr-ejemplos">
      <p class="eyebrow">( ¿Sin plano? Abre uno de ejemplo )</p>
      <div class="ej-lista">${EJEMPLOS.map(e => `<button class="ej" type="button" data-ejemplo="${e.id}"><img src="muestras/${e.id}.png" alt="" loading="lazy" width="320" height="200"><span><b>${esc(e.nombre)}</b><small>${esc(e.detalle)}</small></span></button>`).join('')}</div>
      <p class="hint">Los ejemplos son planos dibujados por ORNAT con su lectura ya hecha: recorren todo el flujo sin red.</p>
    </div>
    <div id="guardado-aviso"></div>
  </div>`;
}

function pintarPlano() {
  const cuerpo = $('#plano-cuerpo');
  if (!S.proyecto) { editor = null; cuerpo.innerHTML = pintarInicio(); const g = leerLocal(); if (g) $('#guardado-aviso').innerHTML = `<div class="banner"><p>Tienes un proyecto guardado en este navegador: <b>${esc(g.nombre)}</b> (${g.plantas.length} planta${g.plantas.length === 1 ? '' : 's'}).</p><button class="btn sm dark" type="button" data-accion="abrir-guardado">Abrirlo</button></div>`; return; }
  const P = S.proyecto; const pl = planta(); const lamSin = P.laminas.filter(l => !P.plantas.some(p => p.lamina?.id === l.id));
  cuerpo.innerHTML = `
    <div class="pr-barra">
      <label class="f pr-nombre">Nombre del proyecto<input id="p-nombre" value="${esc(P.nombre)}" maxlength="120"></label>
      <div class="row"><label class="btn ghost sm" for="archivos2">Agregar láminas<input id="archivos2" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.pdf" multiple class="sr"></label><button class="btn ghost sm" type="button" data-accion="nuevo">Empezar de nuevo</button></div>
    </div>
    ${P.origen === 'ejemplo' ? '<p class="tag soft pr-origen">Plano de ejemplo · lectura precalculada</p>' : ''}
    ${P.laminas.length ? `<div class="laminas" role="list" aria-label="Láminas">${P.laminas.map(l => { const lam = S.laminas.get(l.id); const n = P.plantas.filter(p => p.lamina?.id === l.id).length; return `<div class="lam" role="listitem">${lam ? `<img src="${esc(lam.url)}" alt="Lámina ${esc(l.nombre)}">` : '<div class="lam-sin">Sin imagen</div>'}<div class="lam-info"><b>${esc(l.nombre)}</b><small>${n ? `${n} planta${n === 1 ? '' : 's'}` : 'Sin leer'}</small><div class="row">${lam ? `<button class="btn sm ${n ? 'ghost' : ''}" type="button" data-accion="detectar" data-id="${esc(l.id)}">${n ? 'Volver a detectar' : 'Detectar muros'}</button>` : ''}${lam && S.servidor.analisis.disponible ? `<button class="btn sm dark" type="button" data-accion="ia" data-id="${esc(l.id)}">Leer con IA</button>` : ''}${lam && !n ? `<button class="btn sm ghost" type="button" data-accion="a-mano" data-id="${esc(l.id)}">Dibujar a mano</button>` : ''}</div></div></div>`; }).join('')}</div>` : ''}
    <p id="det-prog" class="hint" hidden><span class="spin" aria-hidden="true"></span> Leyendo la lámina en tu navegador…</p>
    ${lamSin.length && P.plantas.length ? `<p class="hint">${lamSin.length} lámina(s) sin leer.</p>` : ''}
    ${P.plantas.length ? `
    <div class="tabs" role="tablist" aria-label="Plantas">${P.plantas.map(p => `<button role="tab" type="button" aria-selected="${p.id === pl.id}" data-planta="${esc(p.id)}">${esc(p.nombre)}</button>`).join('')}</div>
    <div class="pr-editor">
      <div class="ed-col">
        <div class="ed-tools" role="toolbar" aria-label="Herramientas de edición">${Object.entries(HERRAMIENTAS).map(([k, v]) => `<button type="button" class="tool" data-tool="${k}" aria-pressed="${S.herramienta === k}">${esc(v)}</button>`).join('')}</div>
        <div id="editor" class="ed-lienzo"></div>
        <div id="calibra" class="calibra" hidden></div>
        <div class="row ed-pie"><button class="btn sm ghost" type="button" data-accion="recalcular">Recalcular espacios desde los muros</button>${laminaDe(pl) ? `<label class="f chk"><input type="checkbox" id="ver-lamina" ${editor?.verLamina !== false ? 'checked' : ''}> Ver lámina</label>` : ''}<span class="hint">Supr borra lo seleccionado · flechas mueven el muro 5 cm · Mayús dibuja en diagonal</span></div>
      </div>
      <div class="ed-panel" id="panel"></div>
    </div>` : P.laminas.length ? '' : '<p class="hint">Agrega una lámina para empezar.</p>'}`;
  if (P.plantas.length) {
    editor = new Editor($('#editor'), { onCambio: (_, msg) => { S.sel = editor?.sel || null; cambioGeometria(msg); }, onSeleccion: sel => { S.sel = sel; pintarPanel(); }, onCalibrar: d => pedirCalibracion(d), anunciar });
    editor.verLamina = $('#ver-lamina') ? $('#ver-lamina').checked : true; editor.herramienta(S.herramienta); editor.mostrar(pl, laminaDe(pl)); pintarPanel();
  } else editor = null;
}

function pintarPanel() {
  const panel = $('#panel'); const pl = planta(); if (!panel || !pl) return;
  const r = resumenPlanta(pl); const esc0 = pl.escala;
  const avisoEscala = esc0.confianza === 'baja' ? `<div class="banner warn"><p><b>Escala por confirmar.</b> ${esc(esc0.nota || 'Marca una cota conocida para que las medidas sean reales.')}</p><button class="btn sm dark" type="button" data-accion="calibrar">Calibrar</button></div>` : `<p class="hint">Escala: ${esc0.fuente === 'calibracion' ? 'calibrada con una cota' : esc0.fuente === 'ejemplo' ? 'exacta (plano de ejemplo)' : esc0.fuente === 'ia' ? 'leída por la IA' : esc0.fuente} · <button class="link" type="button" data-accion="calibrar">recalibrar</button></p>`;
  const opcionesUso = sel => USO_KEYS.map(k => `<option value="${k}"${k === sel ? ' selected' : ''}>${USOS[k]}</option>`).join('');
  const opcionesEstilo = sel => `<option value="">Heredar</option>${ESTILOS.map(e => `<option value="${e.id}"${e.id === sel ? ' selected' : ''}>${esc(e.nombre)}</option>`).join('')}`;
  const sel = S.sel;
  panel.innerHTML = `
    <div class="fields two">
      <label class="f">Nombre de la planta<input data-campo="planta-nombre" value="${esc(pl.nombre)}" maxlength="80"></label>
      <label class="f">Nivel<input data-campo="planta-nivel" type="number" min="-3" max="40" step="1" value="${pl.nivel}"></label>
      <label class="f">Altura libre (m)<input data-campo="planta-altura" type="number" min="2" max="8" step="0.05" value="${pl.altura}"></label>
      <label class="f">Estilo de la planta<select data-campo="planta-estilo">${opcionesEstilo(pl.estilo)}</select></label>
    </div>
    ${avisoEscala}
    <p class="hint">${r.muros} muros · ${r.aberturas} aberturas · ${r.espacios} espacios · ${m2(r.areaM2)} útiles</p>
    ${sel && sel.tipo !== 'espacio' ? `<div class="sel-box"><p><b>${sel.tipo === 'muro' ? 'Muro seleccionado' : 'Abertura seleccionada'}</b></p>${selDetalle(pl, sel)}<button class="btn sm danger" type="button" data-accion="borrar-sel">Borrar</button></div>` : ''}
    ${pl.espacios.some(e => /^(Recámara|Baño|Sala|Otro)( \d+)?$/.test(e.nombre)) && S.proyecto.origen === 'deteccion' ? '<p class="hint"><b>Usos sugeridos por tamaño:</b> revísalos, la detección local no lee los rótulos.</p>' : ''}
    <h3 class="pr-h3">Espacios</h3>
    <ul class="esp-lista" aria-label="Espacios de ${esc(pl.nombre)}">${pl.espacios.map(e => `<li class="esp${sel?.tipo === 'espacio' && sel.id === e.id ? ' on' : ''}" data-esp="${esc(e.id)}">
      <label class="f"><span class="sr">Nombre</span><input data-campo="esp-nombre" data-id="${esc(e.id)}" value="${esc(e.nombre)}" maxlength="80" aria-label="Nombre del espacio"></label>
      <label class="f"><span class="sr">Uso</span><select data-campo="esp-uso" data-id="${esc(e.id)}" aria-label="Uso de ${esc(e.nombre)}">${opcionesUso(e.uso)}</select></label>
      <label class="f"><span class="sr">Estilo</span><select data-campo="esp-estilo" data-id="${esc(e.id)}" aria-label="Estilo de ${esc(e.nombre)}">${opcionesEstilo(e.estilo)}</select></label>
      <span class="esp-a">${m2(areaPoligono(e.poligono))}</span>
      <button class="iconbtn" type="button" data-accion="borrar-esp" data-id="${esc(e.id)}" aria-label="Borrar ${esc(e.nombre)}">✕</button></li>`).join('') || '<li class="hint">Sin espacios: dibuja los muros y pulsa «Recalcular espacios».</li>'}</ul>
    <div class="row"><button class="btn sm ghost" type="button" data-accion="borrar-planta">Quitar esta planta</button></div>`;
}
function selDetalle(pl, sel) {
  if (sel.tipo === 'muro') { const m = pl.muros.find(x => x.id === sel.id); if (!m) return ''; return `<label class="f">Grosor (m)<input data-campo="muro-grosor" data-id="${esc(m.id)}" type="number" min="0.05" max="1" step="0.01" value="${m.grosor}"></label><p class="hint">Largo ${Math.hypot(m.x2 - m.x1, m.y2 - m.y1).toFixed(2)} m · arrástralo o usa las flechas</p>`; }
  const a = pl.aberturas.find(x => x.id === sel.id); if (!a) return '';
  return `<div class="fields two"><label class="f">Tipo<select data-campo="ab-tipo" data-id="${esc(a.id)}">${['puerta', 'ventana', 'corrediza', 'vano'].map(t => `<option${t === a.tipo ? ' selected' : ''}>${t}</option>`).join('')}</select></label><label class="f">Ancho (m)<input data-campo="ab-ancho" data-id="${esc(a.id)}" type="number" min="0.3" max="8" step="0.05" value="${a.ancho}"></label><label class="f">Alto (m)<input data-campo="ab-alto" data-id="${esc(a.id)}" type="number" min="0.3" max="4" step="0.05" value="${a.alto}"></label><label class="f">Antepecho (m)<input data-campo="ab-antepecho" data-id="${esc(a.id)}" type="number" min="0" max="3" step="0.05" value="${a.antepecho}"></label></div>`;
}

function pedirCalibracion({ distanciaM }) {
  const box = $('#calibra'); box.hidden = false;
  box.innerHTML = `<form class="row" id="f-calibra"><p class="hint">Distancia marcada: <b>${distanciaM.toFixed(2)} m</b> con la escala actual. ¿Cuánto mide en realidad?</p><label class="f">Metros reales<input id="cal-m" type="number" min="0.1" max="500" step="0.01" required inputmode="decimal"></label><button class="btn sm" type="submit">Aplicar escala</button><button class="btn sm ghost" type="button" data-accion="cal-cancelar">Cancelar</button></form>`;
  $('#cal-m').focus();
  $('#f-calibra').addEventListener('submit', ev => {
    ev.preventDefault(); const real = Number($('#cal-m').value); if (!(real > 0)) return;
    const pl = planta(); const k = real / distanciaM; escalarPlanta(pl, k); pl.escala = { confianza: 'alta', fuente: 'calibracion', nota: `Cota de ${real} m marcada a mano.` };
    box.hidden = true; editor.cancelarCalibracion(); S.herramienta = 'seleccionar'; editor.herramienta('seleccionar'); pintarHerramientas(); editor.mostrar(pl, laminaDe(pl)); cambioGeometria(`Escala calibrada: ×${k.toFixed(3)}`); toast(`Escala calibrada (×${k.toFixed(3)}). Las medidas ya son reales.`);
  });
}
function pintarHerramientas() { document.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === S.herramienta))); }

/* ---------- paso 2: modelo y estilos ---------- */
function pintarModelo() {
  const c = $('#modelo-cuerpo');
  if (!S.proyecto?.plantas.length) { c.innerHTML = '<p class="empty-s">Cuando tengas al menos una planta, aquí aparece su isométrico y el modelo 3D.</p>'; visor?.destruir(); visor = null; return; }
  const P = S.proyecto; const pl = planta();
  if (!$('#visor')) {
    c.innerHTML = `
      <div class="vis-barra">
        <div class="seg" role="radiogroup" aria-label="Vista">${[['iso', 'Isométrico por planta'], ['3d', '3D completo'], ['comparar', 'Comparar con la lámina']].map(([k, t]) => `<button type="button" role="radio" data-vista="${k}" aria-checked="${S.vista === k}">${t}</button>`).join('')}</div>
        <label class="f inline">Planta<select id="vis-planta"></select></label>
        <label class="f chk"><input type="checkbox" id="vis-mob" checked> Mobiliario</label>
      </div>
      <div class="vis-marco"><canvas id="visor" role="img" aria-label="Modelo 3D del proyecto" aria-describedby="alt-modelo"></canvas><p class="vis-ayuda hint">Arrastra para girar · rueda o pellizco para acercar · clic derecho para desplazar</p></div>
      <details class="alt-texto"><summary>Descripción del modelo (texto)</summary><div id="alt-modelo"></div></details>
      <div class="estilos">
        <div class="est-head"><h3 class="pr-h3">Estilos de interior</h3><label class="f inline">Aplicar a<select id="aplicar-a"></select></label></div>
        <div class="filters">
          <label class="f search">Buscar<input id="est-q" type="search" placeholder="Japandi, barro, mármol, Tulum…" value="${esc(S.filtros.texto)}"></label>
          <label class="f">Temperatura<select id="est-temp"><option value="">Todas</option>${Object.entries(TEMPERATURAS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
          <label class="f">Región<select id="est-reg"><option value="">Todas</option>${Object.entries(REGIONES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></label>
          <label class="f">Presupuesto<select id="est-pre"><option value="">Todos</option>${Object.entries(PRESUPUESTOS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></label>
        </div>
        <p class="hint" id="est-cuenta" aria-live="polite"></p>
        <div class="est-grid" id="est-grid"></div>
      </div>`;
    try { visor = new Visor($('#visor'), { onError: e => toast(`No se pudo cargar el entorno de luz: ${e.message || e}`, 'error') }); }
    catch (e) { visor = null; $('.vis-marco').innerHTML = `<div class="banner warn"><p>Tu navegador no pudo iniciar WebGL, así que no puedo mostrar el modelo 3D. La lectura del plano y la exportación del proyecto siguen disponibles.</p></div>`; }
  }
  $('#vis-planta').innerHTML = P.plantas.map(p => `<option value="${esc(p.id)}"${p.id === pl.id ? ' selected' : ''}>${esc(p.nombre)}</option>`).join('');
  const aplicar = $('#aplicar-a'); const val = S.aplicarA;
  aplicar.innerHTML = `<option value="proyecto">Todo el proyecto</option>${P.plantas.map(p => `<optgroup label="${esc(p.nombre)}"><option value="pl:${esc(p.id)}">Toda la ${esc(p.nombre)}</option>${p.espacios.map(e => `<option value="es:${esc(e.id)}">${esc(e.nombre)}</option>`).join('')}</optgroup>`).join('')}`;
  aplicar.value = [...aplicar.options].some(o => o.value === val) ? val : 'proyecto'; S.aplicarA = aplicar.value;
  pintarAlt(); pintarEstilos();
}
function estiloObjetivo() { const P = S.proyecto; const a = S.aplicarA; if (a.startsWith('pl:')) { const p = P.plantas.find(x => x.id === a.slice(3)); return estiloDe(P, p, null, ESTILO_POR_DEFECTO); } if (a.startsWith('es:')) { for (const p of P.plantas) { const e = p.espacios.find(x => x.id === a.slice(3)); if (e) return estiloDe(P, p, e, ESTILO_POR_DEFECTO); } } return P.estilo || ESTILO_POR_DEFECTO; }
const previas = new Map();
function previa(spec) { const k = JSON.stringify([spec.textura, spec.color, spec.color2]); if (!previas.has(k)) previas.set(k, muestraCanvas(spec, 72).toDataURL('image/png')); return previas.get(k); }
function pintarEstilos() {
  const grid = $('#est-grid'); if (!grid) return;
  const lista = buscarEstilos(S.filtros); const actual = estiloObjetivo();
  $('#est-cuenta').textContent = `${lista.length} de ${ESTILOS.length} estilos`;
  grid.innerHTML = lista.map(e => `<button type="button" class="est${e.id === actual ? ' on' : ''}" data-estilo="${e.id}" aria-pressed="${e.id === actual}">
    <span class="est-mat" aria-hidden="true"><img alt="" width="72" height="72" data-prev="piso"><img alt="" width="72" height="72" data-prev="muroAcento"><img alt="" width="72" height="72" data-prev="textil"></span>
    <span class="est-pal" aria-hidden="true">${e.paleta.map(c => `<i style="background:${c}"></i>`).join('')}</span>
    <b>${esc(e.nombre)}</b><small>${esc(e.descripcion)}</small>
    <span class="est-tags">${esc(TEMPERATURAS[e.temperatura])} · ${esc(REGIONES[e.region])} · ${esc(PRESUPUESTOS[e.presupuesto])}</span></button>`).join('') || '<p class="hint">Ningún estilo coincide con esa búsqueda.</p>';
  // previsualizaciones de material en tiempo libre
  const imgs = [...grid.querySelectorAll('img[data-prev]')]; let i = 0;
  const paso = () => { const t0 = performance.now(); while (i < imgs.length && performance.now() - t0 < 12) { const im = imgs[i++]; const e = estiloPorId(im.closest('[data-estilo]').dataset.estilo); im.src = previa(e[im.dataset.prev]); } if (i < imgs.length) requestAnimationFrame(paso); };
  requestAnimationFrame(paso);
}
function aplicarEstilo(id) {
  const P = S.proyecto; const e = estiloPorId(id); if (!e) return; const a = S.aplicarA; let donde = 'todo el proyecto';
  if (a === 'proyecto') { P.estilo = id; for (const p of P.plantas) { p.estilo = null; for (const s of p.espacios) s.estilo = null; } }
  else if (a.startsWith('pl:')) { const p = P.plantas.find(x => x.id === a.slice(3)); if (p) { p.estilo = id; for (const s of p.espacios) s.estilo = null; donde = p.nombre; } }
  else if (a.startsWith('es:')) { for (const p of P.plantas) { const s = p.espacios.find(x => x.id === a.slice(3)); if (s) { s.estilo = id; donde = s.nombre; } } }
  pintarEstilos(); pintarPanel(); refrescar3D(); autoguardar(); anunciar(`Estilo ${e.nombre} aplicado a ${donde}.`); toast(`${e.nombre} · ${donde}`);
}
function pintarAlt() {
  const alt = $('#alt-modelo'); if (!alt) return; const P = S.proyecto;
  alt.innerHTML = P.plantas.map(p => `<h4>${esc(p.nombre)} · nivel ${p.nivel} · altura ${p.altura} m · estilo ${esc(estiloPorId(estiloDe(P, p, null, ESTILO_POR_DEFECTO))?.nombre)}</h4><ul>${p.espacios.map(e => `<li>${esc(e.nombre)} (${esc(USOS[e.uso])}), ${m2(areaPoligono(e.poligono))}, estilo ${esc(estiloPorId(estiloDe(P, p, e, ESTILO_POR_DEFECTO))?.nombre)}</li>`).join('')}</ul>`).join('');
}
let t3d = 0;
function refrescar3D() {
  clearTimeout(t3d); t3d = setTimeout(() => {
    if (!S.proyecto?.plantas.length) { pintarModelo(); pintarRender(); return; }
    if (!$('#visor')) pintarModelo(); else { pintarAlt(); }
    if (visor) { try { const lams = {}; for (const [id, l] of S.laminas) lams[id] = l.canvas; visor.cargar(S.proyecto, { estiloPorId, porDefecto: ESTILO_POR_DEFECTO, laminas: lams }); visor.set(S.vista, planta()?.id); } catch (e) { console.error(e); toast('No se pudo construir el modelo 3D con esta geometría.', 'error'); } }
    pintarRender(); pintarExportar();
  }, 60);
}

/* ---------- paso 3: render ---------- */
function opcionesVista() {
  const P = S.proyecto; const int = [], iso = [];
  for (const p of P.plantas) { iso.push([`iso:${p.id}`, `Isométrico · ${p.nombre}`]); for (const e of p.espacios) if (!['circulacion', 'escalera', 'bodega', 'cochera'].includes(e.uso)) int.push([`int:${e.id}`, `${e.nombre} · ${p.nombre}`]); }
  if (P.plantas.length > 1) iso.push(['iso:', 'Isométrico · conjunto']);
  return { int, iso };
}
function pintarRender() {
  const c = $('#render-cuerpo'); if (!c) return;
  if (!S.proyecto?.plantas.length) { const rc = $('#r-canvas'); if (rc) { if (S.render.control) S.render.control.detener = true; else liberarRender(rc); } S.render.hecho = null; c.innerHTML = '<p class="empty-s">Primero lee un plano o abre un ejemplo.</p>'; return; }
  const { int, iso } = opcionesVista(); const todas = [...int, ...iso].map(x => x[0]);
  if (!todas.includes(S.render.vista)) S.render.vista = int[0]?.[0] || iso[0][0];
  const sop = soportePathTracing(); const R = S.render;
  if (!$('#r-form')) {
    c.innerHTML = `
      <form id="r-form" class="r-form">
        <label class="f">Vista<select id="r-vista"></select></label>
        <label class="f">Calidad<select id="r-calidad">${Object.entries(CALIDADES).map(([k, v]) => `<option value="${k}"${k === R.calidad ? ' selected' : ''}>${v.etiqueta}</option>`).join('')}</select></label>
        <label class="f">Resolución<select id="r-res">${Object.entries(RESOLUCIONES).map(([k, v]) => `<option value="${k}"${k === R.res ? ' selected' : ''}>${v[2]}</option>`).join('')}</select></label>
        <label class="f">Motor<select id="r-modo"><option value="pt">Trazado de rayos (fotorrealista)</option><option value="raster">Rasterizado rápido</option></select></label>
        <label class="f chk"><input type="checkbox" id="r-dof"${R.dof ? ' checked' : ''}> Profundidad de campo (interiores)</label>
        <div class="row r-acc"><button class="btn" type="submit" id="r-ir">Renderizar</button><button class="btn ghost" type="button" id="r-stop" disabled>Detener</button><button class="btn dark" type="button" id="r-png" disabled>Descargar PNG</button></div>
      </form>
      ${sop.ok ? '' : `<div class="banner warn"><p>${esc(sop.motivo)} Usaré el rasterizado de alta calidad (luz de entorno, sombras suaves y oclusión ambiental): se ve bien, pero no calcula rebotes de luz.</p></div>`}
      <div class="r-prog" id="r-prog" hidden><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="Progreso del render"><i style="width:0%"></i></div><p class="hint" id="r-estado" aria-live="polite"></p></div>
      <figure class="r-marco" id="r-marco"><canvas id="r-canvas" role="img" aria-label="Render todavía no generado"></canvas><figcaption id="r-pie" class="hint">Elige una vista y pulsa Renderizar. El cálculo ocurre en tu tarjeta gráfica; puedes detenerlo cuando la imagen te convenza.</figcaption></figure>
      <details class="nube" id="nube"><summary>Motor en la nube (opcional)</summary><div id="nube-cuerpo"></div></details>`;
  }
  $('#r-vista').innerHTML = `<optgroup label="Interior a 1.60 m">${int.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('')}</optgroup><optgroup label="Isométrico">${iso.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('')}</optgroup>`;
  $('#r-vista').value = R.vista; pintarNube();
}
function pintarNube() {
  const n = $('#nube-cuerpo'); if (!n) return; const N = S.servidor.nube;
  if (!N.disponible) { n.innerHTML = `<p>El render de arriba ya es el resultado final y no necesita conexión. Como extra, este espacio puede mandar la imagen a un motor de IA en la nube (Gemini o HomeDesigns) para una versión con texturas generativas.</p><p class="hint">Ese motor todavía no está activado aquí: un administrador debe configurar <code>GEMINI_API_KEY</code> o <code>HOMEDESIGNS_API_KEY</code> y la sesión del equipo en Vercel. Las llaves viven solo en el servidor.</p>`; return; }
  const act = N.proveedores.filter(p => p.estado === 'activo');
  n.innerHTML = `<p>Envía el render terminado al motor en la nube. Se conserva la geometría y se reinterpretan materiales y luz con el estilo elegido. Requiere sesión y consume créditos del proveedor.</p>
    <div class="row"><label class="f inline">Proveedor<select id="nube-prov">${act.map(p => `<option value="${esc(p.id)}">${esc(p.nombre)}</option>`).join('')}</select></label><button class="btn dark" type="button" id="nube-ir" ${S.render.hecho ? '' : 'disabled'}>Mejorar en la nube</button></div>
    <div id="nube-res"></div>`;
}
function vistaActual() { const v = S.render.vista; return v.startsWith('int:') ? { tipo: 'interior', espacioId: v.slice(4) } : { tipo: 'iso', plantaId: v.slice(4) || null }; }
function estiloDeVista(vista) { const P = S.proyecto; if (vista.tipo === 'interior') for (const p of P.plantas) { const e = p.espacios.find(x => x.id === vista.espacioId); if (e) return estiloPorId(estiloDe(P, p, e, ESTILO_POR_DEFECTO)); } const p = P.plantas.find(x => x.id === vista.plantaId) || P.plantas[0]; return estiloPorId(estiloDe(P, p, null, ESTILO_POR_DEFECTO)); }

async function renderizarAhora() {
  const R = S.render; if (R.corriendo) return; R.corriendo = true; R.hecho = null;
  const [w, h] = RESOLUCIONES[R.res]; const total = CALIDADES[R.calidad].muestras; const vista = vistaActual(); const est = estiloDeVista(vista);
  const ctrl = { detener: false }; R.control = ctrl;
  $('#r-ir').disabled = true; $('#r-stop').disabled = false; $('#r-png').disabled = true; $('#r-prog').hidden = false;
  const bar = $('#r-prog .bar'); const est0 = $('#r-estado');
  const prog = (s, t, fase, v) => { const pct = fase === 'preparando' ? 2 : Math.round((s / t) * 100); bar.setAttribute('aria-valuenow', String(pct)); bar.firstElementChild.style.width = `${pct}%`; est0.textContent = fase === 'preparando' ? 'Preparando la escena y el BVH…' : fase === 'raster' ? 'Rasterizando…' : `Muestra ${s} de ${t}${v ? ` · faltan ~${v >= 90 ? `${Math.round(v / 60)} min` : `${Math.max(1, Math.round(v))} s`}` : ''}. Puedes detenerlo cuando la imagen te convenza.`; };
  const canvas = $('#r-canvas');
  try {
    const res = await renderizar(canvas, { proyecto: S.proyecto, estiloPorId, porDefecto: ESTILO_POR_DEFECTO, vista, ancho: w, alto: h, muestras: total, dof: R.dof, forzarRaster: R.modo === 'raster', exposicion: est?.iluminacion?.exposicion || 1, onProgreso: prog, control: ctrl });
    if (!canvas.isConnected) return; // el proyecto se cerró mientras se renderizaba
    R.hecho = { ...res, vista, estilo: est?.nombre, w, h };
    const etiqueta = $('#r-vista').selectedOptions[0]?.textContent || '';
    canvas.setAttribute('aria-label', `Render de ${etiqueta} en estilo ${est?.nombre || ''}`);
    $('#r-pie').textContent = `${etiqueta} · ${est?.nombre || ''} · ${res.modo === 'pathtracing' ? `trazado de rayos, ${res.muestras} muestras${res.detenido ? ' (detenido)' : ''}` : 'rasterizado de alta calidad'} · ${w}×${h} · ${(res.ms / 1000).toFixed(1)} s${res.motivo ? ` · ${res.motivo}` : ''}`;
    est0.textContent = res.modo === 'pathtracing' ? `Listo: ${res.muestras} muestras.` : 'Listo (rasterizado).';
    $('#r-png').disabled = false; const nb = $('#nube-ir'); if (nb) nb.disabled = false;
    toast('Render terminado.');
  } catch (e) { if (!canvas.isConnected) return; console.error(e); toast(`No se pudo renderizar: ${e.message || e}`, 'error'); est0.textContent = 'El render falló.'; }
  finally {
    R.corriendo = false; R.control = null;
    if (!canvas.isConnected) liberarRender(canvas);
    const ir = $('#r-ir'), stop = $('#r-stop'); if (ir) ir.disabled = false; if (stop) stop.disabled = true;
  }
}
async function nubeAhora(btn) {
  const R = S.render; if (!R.hecho) return; ocupado(btn, true, 'Enviando…');
  try {
    const c = $('#r-canvas'); const url = c.toDataURL('image/jpeg', 0.9); const data = url.slice(url.indexOf(',') + 1); const est = estiloPorId(estiloDeVista(R.hecho.vista)?.id) || estiloDeVista(R.hecho.vista);
    const uso = R.hecho.vista.tipo === 'interior' ? S.proyecto.plantas.flatMap(p => p.espacios).find(e => e.id === R.hecho.vista.espacioId)?.uso : 'sala';
    const r = await fetch('/api/plano/render', { method: 'POST', headers: { 'content-type': 'application/json', ...(remote?.authHeader?.() || {}) }, body: JSON.stringify({ image: { media_type: 'image/jpeg', data }, estilo: { id: est.id, nombre: est.nombre, prompt: est.prompt, homedesigns: est.homedesigns }, uso, proveedor: $('#nube-prov')?.value, ancho: c.width, alto: c.height }) });
    let j = null; try { j = await r.json(); } catch {}
    if (!r.ok) throw new Error(j?.message || `El servidor respondió ${r.status}.`);
    const src = `data:${j.imagen.media_type};base64,${j.imagen.data}`;
    $('#nube-res').innerHTML = `<figure class="r-marco"><img src="${esc(src)}" alt="Render en la nube de la misma vista"><figcaption class="hint">Motor en la nube: ${esc(j.proveedor)} (${esc(j.modelo || '')}). Imagen generada por IA a partir de tu render: revisa que respete la geometría.</figcaption></figure><a class="btn sm ghost" download="${slug(S.proyecto.nombre)}-nube.${j.imagen.media_type.split('/')[1]}" href="${esc(src)}">Descargar</a>`;
  } catch (e) { toast(e.message || 'El motor en la nube no respondió.', 'error'); }
  finally { ocupado(btn, false); }
}

/* ---------- paso 4: exportar ---------- */
function pintarExportar() {
  const c = $('#exportar-cuerpo'); if (!c) return; const hay = !!S.proyecto?.plantas.length;
  c.innerHTML = `<div class="exp-grid">
    <div class="exp"><h3 class="pr-h3">Modelo 3D</h3><p class="hint">Muros con huecos, cancelería, pisos y mobiliario con materiales del estilo. Metros, eje Y arriba.</p><button class="btn" type="button" data-accion="glb" ${hay && visor ? '' : 'disabled'}>Descargar .glb</button></div>
    <div class="exp"><h3 class="pr-h3">Isométricos</h3><p class="hint">Un PNG de 1800 × 1200 por planta, con sombras y luz de cielo.</p><button class="btn ghost" type="button" data-accion="png-iso" ${hay && visor ? '' : 'disabled'}>Descargar PNG por planta</button></div>
    <div class="exp"><h3 class="pr-h3">Proyecto</h3><p class="hint">Geometría, usos y estilos en JSON. No incluye las imágenes de tus láminas.</p><div class="row"><button class="btn ghost" type="button" data-accion="json" ${S.proyecto ? '' : 'disabled'}>Descargar JSON</button><label class="btn ghost" for="abrir-json">Abrir JSON<input id="abrir-json" type="file" accept="application/json,.json" class="sr"></label></div></div>
    <div class="exp"><h3 class="pr-h3">En este navegador</h3><p class="hint">Se guarda solo mientras trabajas. Si borras los datos del navegador, se pierde.</p><div class="row"><button class="btn ghost" type="button" data-accion="guardar" ${S.proyecto ? '' : 'disabled'}>Guardar ahora</button><button class="btn ghost" type="button" data-accion="abrir-guardado">Abrir lo guardado</button></div></div>
  </div>`;
}
async function exportarGLB(btn) {
  ocupado(btn, true, 'Generando .glb…');
  try { const blob = await visor.exportarGLB(); descargar(`${slug(S.proyecto.nombre)}.glb`, blob); toast(`Modelo exportado (${(blob.size / 1e6).toFixed(1)} MB).`); }
  catch (e) { console.error(e); toast('No se pudo exportar el modelo.', 'error'); }
  finally { ocupado(btn, false); }
}
async function exportarIsos(btn) {
  ocupado(btn, true, 'Generando…');
  try { for (const p of S.proyecto.plantas) { const b = await visor.capturaIsometrico(p.id); descargar(`${slug(S.proyecto.nombre)}-${slug(p.nombre)}-isometrico.png`, b); await pausa(); } toast('Isométricos descargados.'); }
  catch (e) { console.error(e); toast('No se pudieron generar los isométricos.', 'error'); }
  finally { ocupado(btn, false); }
}
async function abrirProyecto(p) {
  limpiarLaminas();
  for (const l of p.laminas) if (l.src) { try { await registrarLamina({ id: l.id, nombre: l.nombre, canvas: await cargarImagen(l.src), src: l.src }); } catch {} }
  establecer(p);
  const faltan = p.laminas.filter(l => !S.laminas.has(l.id)).length;
  toast(faltan ? `Proyecto abierto. ${faltan} lámina(s) no traen imagen: verás la geometría sobre una cuadrícula.` : 'Proyecto abierto.');
}

/* ---------- eventos ---------- */
function pintarTodo() { pintarPlano(); pintarModelo(); pintarRender(); pintarExportar(); }

document.addEventListener('click', async ev => {
  const t = ev.target.closest('button, [data-accion]'); if (!t) return;
  if (t.dataset.ejemplo) return abrirEjemplo(t.dataset.ejemplo, t);
  if (t.dataset.tool) { S.herramienta = t.dataset.tool; editor?.herramienta(S.herramienta); pintarHerramientas(); if (S.herramienta === 'calibrar') anunciar('Marca los dos extremos de una cota conocida.'); return; }
  if (t.dataset.planta) { S.plantaSel = t.dataset.planta; S.sel = null; pintarPlano(); if (visor) visor.set(S.vista, S.plantaSel); const sp = $('#vis-planta'); if (sp) sp.value = S.plantaSel; return; }
  if (t.dataset.vista) { S.vista = t.dataset.vista; document.querySelectorAll('[data-vista]').forEach(b => b.setAttribute('aria-checked', String(b === t))); visor?.set(S.vista, planta()?.id); return; }
  if (t.dataset.estilo) return aplicarEstilo(t.dataset.estilo);
  const a = t.dataset.accion; if (!a) { if (t.id === 'r-stop' && S.render.control) { S.render.control.detener = true; $('#r-estado').textContent = 'Deteniendo…'; } else if (t.id === 'r-png') { $('#r-canvas').toBlob(b => (b ? descargar(`${slug(S.proyecto.nombre)}-render.png`, b) : toast('No se pudo generar el PNG del render.', 'error')), 'image/png'); } else if (t.id === 'nube-ir') nubeAhora(t); return; }
  const pl = planta();
  switch (a) {
    case 'detectar': return detectar(t.dataset.id, t);
    case 'ia': return leerConIA(t.dataset.id, t);
    case 'a-mano': { const lam = S.laminas.get(t.dataset.id); const p = { id: uid('pl'), nombre: lam.nombre, nivel: S.proyecto.plantas.length, altura: 2.7, losa: 0.2, estilo: null, escala: { confianza: 'baja', fuente: 'supuesta', nota: 'Escala supuesta de 2 cm por píxel: calibra con una cota antes de dibujar.' }, lamina: { id: lam.id, x: 0, y: 0, mPorPx: 0.02 }, muros: [], aberturas: [], espacios: [] }; S.proyecto.plantas.push(p); S.plantaSel = p.id; S.herramienta = 'calibrar'; pintarTodo(); refrescar3D(); toast('Primero calibra: marca los dos extremos de una cota y escribe su medida.'); return; }
    case 'recalcular': return recalcularEspacios(t);
    case 'calibrar': S.herramienta = 'calibrar'; editor?.herramienta('calibrar'); pintarHerramientas(); toast('Marca los dos extremos de una cota conocida en la lámina.'); return;
    case 'cal-cancelar': $('#calibra').hidden = true; editor?.cancelarCalibracion(); return;
    case 'borrar-sel': editor?.borrarSeleccion(); S.sel = null; pintarPanel(); return;
    case 'borrar-esp': pl.espacios = pl.espacios.filter(e => e.id !== t.dataset.id); editor?.mostrar(pl, laminaDe(pl)); cambioGeometria('Espacio borrado'); return;
    case 'borrar-planta': if (!confirm(`¿Quitar la ${pl.nombre} del proyecto?`)) return; S.proyecto.plantas = S.proyecto.plantas.filter(p => p.id !== pl.id); S.plantaSel = S.proyecto.plantas[0]?.id || null; pintarTodo(); refrescar3D(); autoguardar(); return;
    case 'nuevo': if (!confirm('¿Empezar un proyecto nuevo? El actual sigue guardado en este navegador hasta que lo reemplaces.')) return; S.proyecto = null; limpiarLaminas(); visor?.destruir(); visor = null; pintarTodo(); return;
    case 'glb': return exportarGLB(t);
    case 'png-iso': return exportarIsos(t);
    case 'json': return descargar(`${slug(S.proyecto.nombre)}.plano-a-render.json`, new Blob([aJSON(S.proyecto)], { type: 'application/json' }));
    case 'guardar': return guardarLocal(false);
    case 'abrir-guardado': { const g = leerLocal(); if (!g) return toast('No hay ningún proyecto guardado en este navegador.', 'error'); return abrirProyecto(g); }
    default:
  }
});

document.addEventListener('change', async ev => {
  const t = ev.target;
  if (t.id === 'archivos' || t.id === 'archivos2') { await subirArchivos(t.files); t.value = ''; return; }
  if (t.id === 'abrir-json') { const f = t.files?.[0]; t.value = ''; if (!f) return; try { if (f.size > 5e6) throw new Error('El archivo es demasiado grande.'); await abrirProyecto(desdeJSON(await f.text(), { esEstilo })); } catch (e) { toast(e.message, 'error'); } return; }
  if (t.id === 'ver-lamina') { editor.verLamina = t.checked; editor.dibujar(); return; }
  if (t.id === 'vis-planta') { S.plantaSel = t.value; visor?.set(S.vista, t.value); pintarPlano(); return; }
  if (t.id === 'vis-mob') { visor?.capas({ mobiliario: t.checked }); return; }
  if (t.id === 'aplicar-a') { S.aplicarA = t.value; pintarEstilos(); return; }
  if (['est-temp', 'est-reg', 'est-pre'].includes(t.id)) { S.filtros = { ...S.filtros, temperatura: $('#est-temp').value, region: $('#est-reg').value, presupuesto: $('#est-pre').value }; pintarEstilos(); return; }
  if (t.id === 'r-vista') { S.render.vista = t.value; return; }
  if (t.id === 'r-calidad') { S.render.calidad = t.value; return; }
  if (t.id === 'r-res') { S.render.res = t.value; return; }
  if (t.id === 'r-modo') { S.render.modo = t.value; return; }
  if (t.id === 'r-dof') { S.render.dof = t.checked; return; }
  const campo = t.dataset?.campo; if (!campo) return; const pl = planta(); if (!pl) return;
  const num = (v, a, b, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };
  if (campo === 'planta-nombre') { pl.nombre = t.value.trim().slice(0, 80) || pl.nombre; pintarPlano(); pintarModelo(); }
  else if (campo === 'planta-nivel') { pl.nivel = Math.round(num(t.value, -3, 40, pl.nivel)); S.proyecto.plantas.sort((a, b) => a.nivel - b.nivel); }
  else if (campo === 'planta-altura') pl.altura = num(t.value, 2, 8, pl.altura);
  else if (campo === 'planta-estilo') pl.estilo = estiloPorId(t.value) ? t.value : null;
  else if (campo.startsWith('esp-')) { const e = pl.espacios.find(x => x.id === t.dataset.id); if (!e) return; if (campo === 'esp-nombre') e.nombre = t.value.trim().slice(0, 80) || e.nombre; if (campo === 'esp-uso' && USO_KEYS.includes(t.value)) e.uso = t.value; if (campo === 'esp-estilo') e.estilo = estiloPorId(t.value) ? t.value : null; editor?.dibujar(); }
  else if (campo === 'muro-grosor') { const m = pl.muros.find(x => x.id === t.dataset.id); if (m) m.grosor = num(t.value, 0.05, 1, m.grosor); editor?.dibujar(); }
  else if (campo.startsWith('ab-')) { const ab = pl.aberturas.find(x => x.id === t.dataset.id); if (!ab) return; const k = campo.slice(3); if (k === 'tipo' && ['puerta', 'ventana', 'corrediza', 'vano'].includes(t.value)) ab.tipo = t.value; else if (k !== 'tipo') ab[k] = num(t.value, k === 'antepecho' ? 0 : 0.3, k === 'ancho' ? 8 : 4, ab[k]); editor?.dibujar(); }
  cambioGeometria(); if (campo !== 'planta-nombre') pintarModelo();
});
document.addEventListener('input', ev => { const t = ev.target; if (t.id === 'est-q') { S.filtros.texto = t.value; clearTimeout(t._t); t._t = setTimeout(pintarEstilos, 120); } if (t.id === 'p-nombre') { S.proyecto.nombre = t.value.slice(0, 120); autoguardar(); } });
document.addEventListener('submit', ev => { if (ev.target.id === 'r-form') { ev.preventDefault(); renderizarAhora(); } });
// arrastrar y soltar láminas
document.addEventListener('dragover', ev => { if ([...(ev.dataTransfer?.types || [])].includes('Files')) { ev.preventDefault(); $('#zona')?.classList.add('sobre'); } });
document.addEventListener('dragleave', ev => { if (ev.target.id === 'zona') ev.target.classList.remove('sobre'); });
document.addEventListener('drop', ev => { if (ev.dataTransfer?.files?.length) { ev.preventDefault(); $('#zona')?.classList.remove('sobre'); subirArchivos(ev.dataTransfer.files); } });

// navegación: paso actual en el riel
const io = new IntersectionObserver(ents => { for (const e of ents) if (e.isIntersecting) document.querySelectorAll('#nav a').forEach(a => a.toggleAttribute('aria-current', a.getAttribute('href') === `#${e.target.id}`)); }, { rootMargin: '-40% 0px -55% 0px' });
document.querySelectorAll('.pr-sec').forEach(s => io.observe(s));

/* ---------- arranque ---------- */
async function estadoServidor() {
  try {
    const r = await fetch('/api/plano/estado', { headers: { accept: 'application/json' } }); if (!r.ok) return;
    const j = await r.json(); if (j?.ok) { const antes = S.servidor.analisis.disponible; S.servidor = { analisis: { disponible: j.analisis?.disponible === true }, nube: { disponible: j.nube?.disponible === true, proveedores: Array.isArray(j.nube?.proveedores) ? j.nube.proveedores : [] } }; if (S.servidor.analisis.disponible !== antes) pintarPlano(); pintarNube(); }
  } catch { /* sin servidor: la herramienta sigue completa en modo local */ }
}
pintarTodo();
estadoServidor();
const q = new URLSearchParams(location.search).get('ejemplo'); if (q && EJEMPLOS.some(e => e.id === q)) abrirEjemplo(q);
