// ORNAT · Alta de propiedad con IA (5 pasos). ES modules sin build.
// Fotos -> análisis (local siempre + Claude si está conectado) -> datos -> copy -> ficha técnica -> publicar.
// Honestidad de modo demo: sin ANTHROPIC_API_KEY el análisis local corre real, el copy sale de una plantilla marcada
// "Borrador automático sin IA" y la reescritura por prompt queda deshabilitada con su explicación.
import { data, cleanProperty, PROPERTY_TYPES, OPERATIONS, SPACES } from '/shared/data.js';
import { relatedProperties } from '/shared/related.js';
import { fichaDocHTML, esc } from '/shared/ficha.js';
import { findDuplicates } from '/shared/image-metrics.js';
import { createAiClient, guessSpaceFromName, suggestFromAnalyses, mergeQuality, templateCopy, missingFacts, aiMessage, estimateCostUsd, newPropertyCode, groupBySpace, MAX_AI_PHOTOS, MAX_PHOTOS, AI_MESSAGES } from '/shared/property-ai.js';
import { ingest, aiPayload, webVersions } from './imaging.js';
import { blobStore, draftStore } from './store.js';
import '/shared/session-bar.js';

const $ = (sel, root = document) => root.querySelector(sel);
if (data().backend().mode === 'supabase') { const foot = $('.foot span:last-child'); if (foot) foot.textContent = 'Al publicar, la propiedad se guarda en la base de datos de ORNAT. El borrador se queda en este navegador hasta entonces.'; }
const STEPS =[['fotos', 'Fotos'], ['analisis', 'Análisis'], ['datos', 'Datos'], ['copy', 'Copy'], ['ficha', 'Ficha']];
const DEMO_AI = AI_MESSAGES.ai_not_configured;

/* =================== estado =================== */
const blank = () => ({
  v: 1, draftId: `d${crypto.randomUUID()}`, step: 1, propertyId: '', code: newPropertyCode(), savedAt: '',
  photos: [], usage: { input_tokens: 0, output_tokens: 0 },
  form: { operation: 'venta', type: 'casa', price: '', currency: 'MXN', areaM2: '', lotM2: '', bedrooms: '', bathrooms: '', parking: '', development: '', zone: '', city: '', lat: '', lng: '', levels: '', ageMode: 'years', ageYears: '', orientation: '', furnished: '', delivery: '', maintenanceFee: '', maintenanceCurrency: 'MXN', priceConditions: '', notes: '', amenities: [], finishes: [], services: [], suggested: { type: '', amenities: [], finishes: [], style: '' }, englishVersion: false, appliedSuggestions: false },
  copy: { current: null, history: [], redo: [], edited: false },
});
let S = blank();
const mem = { blobs: new Map(), urls: new Map(), persistent: true };   // id -> {big, thumb}; id -> {thumb, big} object URLs
let ai = { configured: false, reachable: false, checked: false, model: 'claude-opus-5-5' };
let client = createAiClient({ draftId: S.draftId });
let analysisRun = null;                                                   // { abort, total, done }
const ui = { view: 'order', busy: '', publishedSlug: '', confirmPending: false, lastWeb: null };

const FIELD_LABELS = { title: 'Título', subtitle: 'Subtítulo', long: 'Descripción larga', short: 'Versión corta', highlights: 'Puntos destacados', seo: 'SEO', instagram: 'Instagram', whatsapp: 'WhatsApp', en: 'Inglés' };

/* =================== utilidades =================== */
const clone = v => JSON.parse(JSON.stringify(v));
const num = v => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
const fmtUsd = n => `US$${n < 0.1 ? n.toFixed(3) : n.toFixed(2)}`;
const fmtTokens = n => new Intl.NumberFormat('es-MX').format(n);
const timeAgo = iso => { if (!iso) return ''; const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000); return s < 10 ? 'justo ahora' : s < 60 ? `hace ${Math.round(s)} s` : s < 3600 ? `hace ${Math.round(s / 60)} min` : `hace ${Math.round(s / 3600)} h`; };
let toastTimer;
function toast(msg, kind = '') { const t = $('#toast'); t.textContent = msg; t.dataset.kind = kind; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 3800); }
async function pool(items, n, fn) { let i = 0; await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const item = items[i++]; await fn(item); } })); }
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'; document.body.append(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { /* sin portapapeles */ } ta.remove(); return ok;
  }
}
const urlsOf = id => {
  let u = mem.urls.get(id); const b = mem.blobs.get(id);
  if (!u && b) { u = { thumb: URL.createObjectURL(b.thumb), big: URL.createObjectURL(b.big) }; mem.urls.set(id, u); }
  return u || { thumb: '', big: '' };
};
function dropUrls(id) { const u = mem.urls.get(id); if (u) { URL.revokeObjectURL(u.thumb); URL.revokeObjectURL(u.big); } mem.urls.delete(id); mem.blobs.delete(id); }

/* =================== persistencia del borrador =================== */
let saveTimer;
function persistNow() {
  const snapshot = clone({ ...S, photos: S.photos.map(p => ({ ...p, aiState: p.aiState === 'done' ? 'done' : 'idle', aiError: '' })) });
  snapshot.savedAt = new Date().toISOString(); S.savedAt = snapshot.savedAt;
  if (!draftStore.save(snapshot)) toast('No se pudo guardar el borrador en este navegador (espacio lleno).', 'error');
  renderDraftBar();
}
const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(persistNow, 350); };
addEventListener('pagehide', () => { if (S.photos.length || S.copy.current) persistNow(); });

async function restoreDraft() {
  const saved = draftStore.load();
  if (!saved || saved.v !== 1 || !(saved.photos?.length || saved.copy?.current || saved.form?.price || saved.form?.city)) return false;
  const base = blank();
  S = { ...base, ...saved, form: { ...base.form, ...saved.form, suggested: { ...base.form.suggested, ...(saved.form?.suggested || {}) } }, copy: { ...base.copy, ...(saved.copy || {}) }, photos: [] };
  let lost = 0;
  for (const p of saved.photos || []) {
    try { const rec = await blobStore.get(`${saved.draftId}:${p.id}`); if (rec?.big && rec?.thumb) { mem.blobs.set(p.id, rec); S.photos.push({ ...p, aiState: p.aiState === 'done' ? 'done' : 'idle' }); } else lost++; } catch { lost++; }
  }
  if (lost) toast(`${lost} foto${lost === 1 ? '' : 's'} del borrador no se pudo${lost === 1 ? '' : 'ieron'} recuperar; vuelve a cargarla${lost === 1 ? '' : 's'}.`, 'error');
  client = createAiClient({ draftId: S.draftId });
  return true;
}

/* =================== acceso =================== */
function gateHTML(session) {
  const next = encodeURIComponent('/propiedades/subir/');
  return `<div class="gate"><p class="eyebrow">( Acceso )</p><h1>Subir propiedad con IA</h1>
    <p class="lead">${session ? `Tu rol (${esc(data().getSession().user.role)}) no puede crear ni editar propiedades. Entra con un usuario Dueño o Editor.` : 'Necesitas iniciar sesión con un usuario que pueda editar propiedades.'}</p>
    <a class="btn" href="/cuenta/?next=${next}">${session ? 'Cambiar de usuario' : 'Entrar (demo)'}</a> <a class="btn ghost" href="/propiedades/">Ver el catálogo</a></div>`;
}
function checkAccess() {
  const d = data(); const session = d.getSession(); const ok = !!session && d.can('properties.edit');
  $('#gate').hidden = ok; $('#app').hidden = !ok;
  if (!ok) $('#gate').innerHTML = gateHTML(session);
  return ok;
}

/* =================== cabecera: IA, pasos, borrador =================== */
function renderBanner() {
  const b = $('#ai-banner');
  if (!ai.checked) { b.className = 'banner'; b.innerHTML = '<p>Comprobando la conexión con la IA…</p>'; return; }
  if (ai.configured) {
    const cost = estimateCostUsd(S.usage);
    b.className = 'banner on';
    b.innerHTML = `<p><strong>IA conectada</strong> · ${esc(ai.model)}. Claude analiza cada foto, redacta el copy y reescribe con tus instrucciones.</p><p class="meter">Gasto de esta propiedad: <b>≈ ${fmtUsd(cost)}</b> <span>(${fmtTokens(S.usage.input_tokens)} tokens de entrada · ${fmtTokens(S.usage.output_tokens)} de salida)</span></p>`;
  } else {
    b.className = 'banner demo';
    b.innerHTML = `<p><strong>${esc(DEMO_AI)}</strong></p><p>Mientras tanto funciona el análisis local real de cada foto (tamaño, luz, nitidez, duplicados, colores) y el copy sale de una plantilla claramente marcada como borrador automático sin IA.${ai.reachable ? '' : ' (No se encontró el servidor de IA en este entorno.)'}</p>`;
  }
}
function renderSteps() {
  $('#steps').innerHTML = STEPS.map(([key, label], i) => {
    const n = i + 1; const cls = n === S.step ? 'now' : n < S.step ? 'done' : '';
    return `<li class="${cls}"${n === S.step ? ' aria-current="step"' : ''}><button type="button" data-goto="${n}" ${canGo(n) ? '' : 'disabled'}><span class="n">${n < S.step ? '✓' : n}</span><span class="t">${label}</span></button></li>`;
  }).join('');
}
function canGo(n) {
  if (n === 1) return true;
  if (n >= 2 && !S.photos.length) return false;
  if (n >= 4 && !S.copy.current) return n === 4;      // el paso 4 genera el copy al entrar
  return true;
}
function renderDraftBar() {
  const bar = $('#draftbar'); if (!bar) return;
  const has = S.photos.length || S.copy.current;
  bar.innerHTML = has ? `<span>Borrador autoguardado ${S.savedAt ? esc(timeAgo(S.savedAt)) : ''}${mem.persistent ? '' : ' · <b>sin IndexedDB: las fotos no sobrevivirán a recargar</b>'}</span><button type="button" class="link" data-action="reset">Empezar de nuevo</button>` : '<span>Se guarda solo mientras avanzas.</span>';
}
function renderNav() {
  const nav = $('#nav');
  if (ui.publishedSlug) { nav.innerHTML = ''; return; }
  const back = S.step > 1 ? '<button type="button" class="btn ghost" data-action="back">← Atrás</button>' : '<span></span>';
  const labels = { 1: 'Analizar fotos →', 2: 'Continuar con los datos →', 3: S.copy.current ? 'Ir al copy →' : 'Generar el copy →', 4: 'Ver la ficha técnica →' };
  const dis = (S.step === 1 && !S.photos.some(p => p.status !== 'error' && !p.processing)) || ui.busy ? ' disabled' : '';
  nav.innerHTML = `${back}${S.step < 5 ? `<button type="button" class="btn" data-action="next"${dis}>${labels[S.step]}</button>` : ''}`;
}
function renderChrome() { renderBanner(); renderSteps(); renderDraftBar(); renderNav(); }

/* =================== navegación =================== */
async function goto(n) {
  if (n === S.step && $('#panel').innerHTML) return;
  if (n > S.step && n >= 3 && !S.photos.length) return;
  S.step = n; ui.confirmPending = false;
  if (n === 3) applySuggestions();
  renderChrome(); renderPanel(); save();
  if (n === 2) maybeAutoAnalyze();
  if (n === 4 && !S.copy.current) await generateCopy();
  $('#panel h2')?.focus?.({ preventScroll: false });
  window.scrollTo({ top: Math.max(0, $('#steps').getBoundingClientRect().top + scrollY - 80), behavior: 'smooth' });
}

/* =================== PASO 1: fotos =================== */
function step1HTML() {
  const n = S.photos.length;
  return `<h2 tabindex="-1">1 · Fotos de la propiedad</h2>
  <p class="hint">Hasta ${MAX_PHOTOS} fotos. Las primeras ${MAX_AI_PHOTOS} (en tu orden) son las que se publican en el catálogo y las que analiza la IA; el resto queda en el borrador. Arrastra para reordenar y elige la portada.</p>
  <div class="drop" id="drop" role="group" aria-label="Cargar fotos">
    <label class="drop-main"><input id="file" type="file" accept="image/*" multiple class="sr">
      <strong>Arrastra las fotos aquí</strong><span>o toca para elegirlas · JPG, PNG, WebP o AVIF</span></label>
    <label class="btn dark cam"><input id="cam" type="file" accept="image/*" capture="environment" class="sr">Tomar foto</label>
  </div>
  <p class="count" id="count">${n} de ${MAX_PHOTOS} fotos</p>
  <ul class="grid" id="photo-grid" aria-label="Fotos cargadas"></ul>
  <details class="note"><summary>¿Cómo se guardan las fotos?</summary><p>Cada foto se comprime en tu navegador (WebP): una copia de 2400 px para guardarla, otra de 1568 px para la IA y una miniatura. El demo guarda el inventario en este navegador y ese almacenamiento admite 4 MB; por eso las copias de 2400 px viven en un almacén aparte (IndexedDB) y, al publicar, el catálogo recibe versiones web más ligeras ajustadas al espacio libre. Al conectar Supabase Storage se guardan las originales completas.</p></details>`;
}
function tileHTML(p, i) {
  const u = p.processing || p.status === 'error' ? null : urlsOf(p.id);
  const cover = i === 0;
  return `<li class="tile${p.status === 'error' ? ' err' : ''}${p.processing ? ' proc' : ''}" data-id="${esc(p.id)}" draggable="${p.processing || p.status === 'error' ? 'false' : 'true'}">
    <div class="ph">${u?.thumb ? `<img src="${esc(u.thumb)}" alt="${esc(p.alt || p.name)}" draggable="false">` : `<div class="wait">${p.status === 'error' ? 'No se pudo leer' : '<span class="spin" aria-hidden="true"></span> Procesando'}</div>`}
      ${cover ? '<b class="cover">Portada</b>' : ''}<b class="idx">${i + 1}</b>${i >= MAX_AI_PHOTOS && !p.processing ? '<b class="over" title="Fuera de las 12 que se publican y analizan con IA">Solo borrador</b>' : ''}</div>
    <p class="nm" title="${esc(p.name)}">${esc(p.name)}</p>
    ${p.status === 'error' ? `<p class="er">${esc(p.error || 'Error')}</p>` : ''}
    <div class="tools" role="group" aria-label="Acciones de ${esc(p.name)}">
      <button type="button" data-act="left" aria-label="Mover antes" ${i === 0 ? 'disabled' : ''}>←</button>
      <button type="button" data-act="right" aria-label="Mover después" ${i === S.photos.length - 1 ? 'disabled' : ''}>→</button>
      <button type="button" data-act="cover" aria-label="Usar como portada" ${i === 0 || p.processing ? 'disabled' : ''}>★</button>
      <button type="button" data-act="del" aria-label="Eliminar foto">✕</button></div></li>`;
}
function renderGrid() {
  const g = $('#photo-grid'); if (!g) return;
  g.innerHTML = S.photos.map(tileHTML).join('');
  $('#count').textContent = `${S.photos.length} de ${MAX_PHOTOS} fotos${S.photos.length > MAX_AI_PHOTOS ? ` · ${S.photos.length - MAX_AI_PHOTOS} quedan solo en el borrador` : ''}`;
  renderNav();
}
function refreshDuplicates() {
  const dup = findDuplicates(S.photos.filter(p => p.metrics).map(p => ({ id: p.id, hash: p.metrics.hash })));
  S.photos.forEach(p => { p.dupOf = dup.get(p.id) || ''; });
}
async function addFiles(fileList) {
  const files = [...fileList].filter(f => f.size >= 0);
  const room = MAX_PHOTOS - S.photos.length;
  if (!files.length) return;
  if (files.length > room) toast(`Solo caben ${MAX_PHOTOS} fotos: se cargarán ${Math.max(room, 0)} de ${files.length}.`, 'error');
  const batch = files.slice(0, Math.max(room, 0)).map(f => ({ file: f, p: { id: crypto.randomUUID(), name: f.name || 'foto', bytes: f.size, space: guessSpaceFromName(f.name) || 'otro', spaceSource: guessSpaceFromName(f.name) ? 'nombre' : '', alt: '', altSource: '', quality: [], localQuality: [], metrics: null, analysis: null, aiState: 'idle', dupOf: '', processing: true, status: 'ok' } }));
  S.photos.push(...batch.map(b => b.p)); renderGrid();
  await pool(batch, 2, async ({ file, p }) => {
    try {
      const out = await ingest(file);
      mem.blobs.set(p.id, { big: out.big, thumb: out.thumb });
      try { await blobStore.put(`${S.draftId}:${p.id}`, { big: out.big, thumb: out.thumb }); } catch { if (mem.persistent) { mem.persistent = false; toast('Tu navegador no permite IndexedDB: el borrador no conservará las fotos si recargas.', 'error'); } }
      Object.assign(p, { metrics: out.metrics, localQuality: out.quality, quality: out.quality, width: out.width, height: out.height, processing: false, bytes: out.big.size });
    } catch (e) { Object.assign(p, { processing: false, status: 'error', error: e.message }); }
    refreshDuplicates(); renderGrid(); save();
  });
  renderChrome();
}
function movePhoto(id, delta) {
  const i = S.photos.findIndex(p => p.id === id); const j = i + delta;
  if (i < 0 || j < 0 || j >= S.photos.length) return;
  [S.photos[i], S.photos[j]] = [S.photos[j], S.photos[i]]; renderGrid(); save();
}
function dropBefore(srcId, targetId) {
  const from = S.photos.findIndex(p => p.id === srcId); const to = S.photos.findIndex(p => p.id === targetId);
  if (from < 0 || to < 0 || from === to) return;
  const [item] = S.photos.splice(from, 1); S.photos.splice(to, 0, item);   // la foto toma la posición de la que soltaste encima
  renderGrid(); save();
}
async function removePhoto(id) {
  const i = S.photos.findIndex(p => p.id === id); if (i < 0) return;
  S.photos.splice(i, 1); dropUrls(id); try { await blobStore.del(`${S.draftId}:${id}`); } catch { /* ya no está */ }
  refreshDuplicates(); renderGrid(); save();
}
function bindStep1() {
  const drop = $('#drop');
  $('#file').addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });
  $('#cam').addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });
  const isFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { if (isFiles(e)) { e.preventDefault(); drop.classList.add('over'); } }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => { if (isFiles(e)) addFiles(e.dataTransfer.files); });
  const grid = $('#photo-grid'); let dragId = '';
  grid.addEventListener('click', e => {
    const b = e.target.closest('button[data-act]'); if (!b) return; const id = b.closest('.tile').dataset.id;
    ({ left: () => movePhoto(id, -1), right: () => movePhoto(id, 1), cover: () => { const i = S.photos.findIndex(p => p.id === id); const [it] = S.photos.splice(i, 1); S.photos.unshift(it); renderGrid(); save(); toast('Portada actualizada.'); }, del: () => removePhoto(id) })[b.dataset.act]();
  });
  grid.addEventListener('dragstart', e => { const t = e.target.closest('.tile'); if (!t) return; dragId = t.dataset.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); t.classList.add('drag'); });
  grid.addEventListener('dragend', () => { dragId = ''; grid.querySelectorAll('.drag,.target').forEach(el => el.classList.remove('drag', 'target')); });
  grid.addEventListener('dragover', e => { if (!dragId) return; const t = e.target.closest('.tile'); if (!t || t.dataset.id === dragId) return; e.preventDefault(); grid.querySelectorAll('.target').forEach(el => el.classList.remove('target')); t.classList.add('target'); });
  grid.addEventListener('drop', e => { if (!dragId) return; const t = e.target.closest('.tile'); if (!t) return; e.preventDefault(); dropBefore(dragId, t.dataset.id); dragId = ''; });
  renderGrid();
}

/* =================== PASO 2: análisis =================== */
const spaceOptions = cur => Object.entries(SPACES).map(([k, l]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${l}</option>`).join('');
const SRC_LABEL = { ia: 'IA', nombre: 'por nombre de archivo', manual: 'tú' };
function cardHTML(p, i) {
  const m = p.metrics; const u = urlsOf(p.id); const a = p.analysis;
  const state = p.aiState === 'running' ? '<span class="st run"><span class="spin"></span> Claude analizando…</span>' : p.aiState === 'done' ? '<span class="st ok">Analizada con IA</span>' : p.aiState === 'error' ? `<span class="st bad">IA: ${esc(p.aiError || 'error')} <button type="button" class="link" data-act="retry">Reintentar</button></span>` : i >= MAX_AI_PHOTOS ? '<span class="st mute">Solo análisis local (fuera de las 12)</span>' : ai.configured ? '<span class="st mute">En espera de IA</span>' : '<span class="st mute">Solo análisis local</span>';
  const warns = [...(p.quality || [])];
  return `<li class="card ph-card" data-id="${esc(p.id)}">
    <div class="thumb"><img src="${esc(u.thumb)}" alt="${esc(p.alt || p.name)}"><b>${i + 1}</b></div>
    <div class="body">
      <div class="row1"><label class="fld">Espacio${p.spaceSource ? ` <small>(${SRC_LABEL[p.spaceSource] || ''})</small>` : ''}<select data-k="space">${spaceOptions(p.space)}</select></label>${state}</div>
      <label class="fld">Texto alternativo${p.altSource === 'ia' ? ' <small>(IA)</small>' : ''}<input data-k="alt" maxlength="300" value="${esc(p.alt)}" placeholder="${ai.configured ? 'La IA lo propone al analizar' : 'Describe lo que se ve (accesibilidad y SEO)'}"></label>
      ${warns.length ? `<ul class="warns">${warns.map(q => `<li><b>${esc(q.issue)}</b>${q.by === 'ia' ? ' <small>IA</small>' : ''} — ${esc(q.suggestion)}</li>`).join('')}</ul>` : '<p class="okline">Sin avisos de calidad.</p>'}
      ${p.dupOf ? `<p class="dup">Casi idéntica a la foto ${S.photos.findIndex(x => x.id === p.dupOf) + 1}. Considera quitar una.</p>` : ''}
      ${m ? `<p class="metrics"><span>${m.width}×${m.height}px · ${esc(m.orientation)}</span><span>luz ${m.mean}/255</span><span>contraste ${m.std}</span><span>nitidez ${m.sharp}</span><span class="sw">${m.colors.map(c => `<i style="background:${esc(c)}" title="${esc(c)}"></i>`).join('')}</span></p>` : ''}
      ${a ? `<div class="aidetail"><p><b>Estilo:</b> ${esc(a.style || '—')} · <b>Luz:</b> ${esc(a.lighting || '—')} · confianza ${esc(a.confidence)}</p>${a.elements?.length ? `<ul class="chips">${a.elements.map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}${a.materials?.length ? `<p><b>Materiales:</b> ${esc(a.materials.join(', '))}</p>` : ''}${a.sellingPoints?.length ? `<p><b>Rasgos vendibles:</b> ${esc(a.sellingPoints.join(' · '))}</p>` : ''}</div>` : ''}
    </div></li>`;
}
function renderCards() {
  const host = $('#cards'); if (!host) return;
  const ready = S.photos.filter(p => !p.processing && p.status !== 'error');
  if (ui.view === 'space') {
    host.innerHTML = groupBySpace(ready).map(g => `<h3 class="grp">${esc(g.label)} <small>${g.photos.length}</small></h3><ul class="cards">${g.photos.map(p => cardHTML(p, S.photos.indexOf(p))).join('')}</ul>`).join('');
  } else host.innerHTML = `<ul class="cards">${ready.map(p => cardHTML(p, S.photos.indexOf(p))).join('')}</ul>`;
  updateSummary();
}
function patchCard(id) {
  const el = document.querySelector(`#cards .card[data-id="${CSS.escape(id)}"]`); const p = S.photos.find(x => x.id === id);
  if (el && p) { const hadFocus = el.contains(document.activeElement); const tmp = document.createElement('div'); tmp.innerHTML = cardHTML(p, S.photos.indexOf(p)); if (!hadFocus) el.replaceWith(tmp.firstElementChild); else { el.querySelector('.row1 .st')?.replaceWith(tmp.querySelector('.row1 .st')); } }
  updateSummary();
}
function updateSummary() {
  const el = $('#sum'); if (!el) return;
  const ready = S.photos.filter(p => !p.processing && p.status !== 'error');
  const warned = ready.filter(p => p.quality?.length).length; const dups = ready.filter(p => p.dupOf).length;
  const done = ready.filter(p => p.aiState === 'done').length; const eligible = Math.min(ready.length, MAX_AI_PHOTOS);
  const pct = analysisRun ? Math.round((analysisRun.done / Math.max(1, analysisRun.total)) * 100) : eligible ? Math.round((done / eligible) * 100) : 0;
  el.innerHTML = `<div class="stats"><span><b>${ready.length}</b> fotos</span><span><b>${warned}</b> con avisos</span><span><b>${dups}</b> posibles duplicadas</span>${ai.configured ? `<span><b>${done}</b>/${eligible} analizadas con IA</span>` : ''}</div>
    ${ai.configured ? `<div class="bar" role="progressbar" aria-label="Progreso del análisis con IA" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>` : ''}`;
  const btn = $('#runai'); if (btn) { btn.disabled = !!analysisRun; btn.textContent = analysisRun ? `Analizando… ${analysisRun.done}/${analysisRun.total}` : done >= eligible && eligible ? 'Volver a analizar fallidas' : `Analizar con IA (${eligible - done})`; btn.hidden = !ai.configured; }
  const stop = $('#stopai'); if (stop) stop.hidden = !analysisRun;
  renderBanner();
}
function step2HTML() {
  return `<h2 tabindex="-1">2 · Análisis de las fotos</h2>
  <p class="hint">${ai.configured ? 'Cada foto se revisa dos veces: primero un análisis local real en tu navegador y encima el de Claude (espacio, materiales, estilo, texto alternativo y avisos). Puedes corregir cualquier etiqueta.' : 'El análisis local es real (corre en tu navegador). La etiqueta de espacio y el texto alternativo los defines tú; con la IA conectada se proponen solos.'}</p>
  <div class="toolbar"><div id="sum" class="sum"></div>
    <div class="acts"><button type="button" class="btn" id="runai" hidden>Analizar con IA</button><button type="button" class="btn ghost" id="stopai" hidden>Detener</button>
    <div class="seg" role="group" aria-label="Vista"><button type="button" data-view="order" aria-pressed="${ui.view === 'order'}">En orden</button><button type="button" data-view="space" aria-pressed="${ui.view === 'space'}">Por espacio</button></div></div></div>
  <div id="cards"></div>`;
}
function bindStep2() {
  renderCards();
  $('#runai').addEventListener('click', () => runAnalysis());
  $('#stopai').addEventListener('click', () => analysisRun?.abort.abort());
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { ui.view = b.dataset.view; document.querySelectorAll('[data-view]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); renderCards(); }));
  const host = $('#cards');
  host.addEventListener('change', e => {
    const id = e.target.closest('.card')?.dataset.id; const p = S.photos.find(x => x.id === id); if (!p || e.target.dataset.k !== 'space') return;
    p.space = e.target.value; p.spaceSource = 'manual'; save(); if (ui.view === 'space') renderCards(); else patchCard(id);
  });
  host.addEventListener('input', e => { const id = e.target.closest('.card')?.dataset.id; const p = S.photos.find(x => x.id === id); if (p && e.target.dataset.k === 'alt') { p.alt = e.target.value; p.altSource = 'manual'; save(); } });
  host.addEventListener('click', e => { if (e.target.closest('[data-act="retry"]')) { const p = S.photos.find(x => x.id === e.target.closest('.card').dataset.id); if (p) { p.aiState = 'idle'; runAnalysis([p.id]); } } });
}
function maybeAutoAnalyze() {
  if (!ai.configured || analysisRun) return;
  if (S.photos.slice(0, MAX_AI_PHOTOS).some(p => !p.processing && p.status !== 'error' && p.aiState !== 'done')) runAnalysis();
}
async function runAnalysis(onlyIds) {
  if (analysisRun || !ai.configured) return;
  const targets = S.photos.slice(0, MAX_AI_PHOTOS).filter(p => !p.processing && p.status !== 'error' && p.aiState !== 'done' && (!onlyIds || onlyIds.includes(p.id)));
  if (!targets.length) return;
  const abort = new AbortController(); analysisRun = { abort, total: targets.length, done: 0 }; renderNav(); updateSummary();
  await pool(targets, 3, async p => {
    if (abort.signal.aborted) return;
    p.aiState = 'running'; p.aiError = ''; patchCard(p.id);
    try {
      const payload = await aiPayload(mem.blobs.get(p.id).big);
      const res = await client.analyze({ photoId: p.id, image: payload, context: { type: S.form.type, city: S.form.city, operation: S.form.operation } }, abort.signal);
      applyAnalysis(p, res.analysis); p.aiState = 'done';
      S.usage.input_tokens += res.usage?.input_tokens || 0; S.usage.output_tokens += res.usage?.output_tokens || 0;
    } catch (e) {
      if (e?.name === 'AbortError') p.aiState = 'idle';
      else if (e?.code === 'ai_not_configured') { ai.configured = false; abort.abort(); p.aiState = 'idle'; renderBanner(); toast(DEMO_AI, 'error'); }
      else { p.aiState = 'error'; p.aiError = aiMessage(e); }
    }
    analysisRun.done++; patchCard(p.id); save();
  });
  analysisRun = null; renderBanner(); renderNav(); updateSummary(); renderCards();
  const failed = targets.filter(p => p.aiState === 'error').length;
  if (failed) toast(`${failed} foto${failed === 1 ? '' : 's'} no se pudo analizar con IA. Puedes reintentar.`, 'error');
}
function applyAnalysis(p, a) {
  p.analysis = a;
  if (p.spaceSource !== 'manual' && a.space) { p.space = a.space; p.spaceSource = 'ia'; }
  if (p.altSource !== 'manual' && a.altText) { p.alt = a.altText; p.altSource = 'ia'; }
  p.quality = mergeQuality(p.localQuality || [], (a.quality || []).map(q => ({ issue: q.issue, suggestion: q.suggestion })));
}

/* =================== PASO 3: datos =================== */
const AMENITY_OPTS = ['Alberca', 'Terraza', 'Roof garden', 'Jardín', 'Vista al mar', 'Gimnasio', 'Jacuzzi', 'Cocina integral', 'Aire acondicionado', 'Paneles solares', 'Elevador', 'Seguridad 24 h', 'Acceso controlado', 'Cochera techada', 'Pet friendly'];
const SERVICE_OPTS = ['Agua potable', 'Luz (CFE)', 'Gas', 'Internet / fibra', 'Drenaje', 'Cisterna', 'Planta de emergencia'];
const FINISH_OPTS = ['Madera', 'Mármol', 'Concreto pulido', 'Cantera', 'Chukum', 'Porcelanato', 'Vidrio', 'Piedra natural'];
const lower = s => s.toLowerCase();
function applySuggestions() {
  const f = S.form; if (f.appliedSuggestions) return;
  const sug = suggestFromAnalyses(S.photos.map(p => p.analysis));
  f.suggested = { type: '', amenities: [], finishes: [], style: sug.style };
  if (sug.type) { f.type = sug.type; f.suggested.type = sug.type; }
  for (const a of sug.amenities) { const label = AMENITY_OPTS.find(o => lower(o).startsWith(lower(a).split(' ')[0])) || (a[0].toUpperCase() + a.slice(1)); if (!f.amenities.some(x => lower(x) === lower(label))) { f.amenities.push(label); f.suggested.amenities.push(label); } }
  for (const m of sug.finishes) if (!f.finishes.some(x => lower(x) === lower(m))) { f.finishes.push(m); f.suggested.finishes.push(m); }
  f.appliedSuggestions = true;
}
const input = (name, label, o = {}) => `<label class="fld${o.wide ? ' wide' : ''}">${label}${o.sug ? ' <em class="sug">sugerido — confirma</em>' : ''}<input name="${name}" type="${o.type || 'text'}" ${o.type === 'number' ? `inputmode="decimal" min="0" step="${o.step || 'any'}"` : ''} value="${esc(S.form[name])}" ${o.ph ? `placeholder="${esc(o.ph)}"` : ''} ${o.max ? `maxlength="${o.max}"` : ''} ${o.list ? `list="${o.list}"` : ''}></label>`;
const sel = (name, label, opts, o = {}) => `<label class="fld${o.wide ? ' wide' : ''}">${label}${o.sug ? ' <em class="sug">sugerido — confirma</em>' : ''}<select name="${name}">${opts.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(S.form[name]) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
function chipGroup(key, opts) {
  const f = S.form; const all = [...new Set([...opts, ...f[key]])];
  return `<div class="chipset" data-group="${key}">${all.map(o => { const on = f[key].some(x => lower(x) === lower(o)); const sug = f.suggested[key]?.some(x => lower(x) === lower(o)); return `<label class="opt${on ? ' on' : ''}"><input type="checkbox" value="${esc(o)}" ${on ? 'checked' : ''}><span>${esc(o)}</span>${on && sug ? '<em class="sug">sugerido — confirma</em>' : ''}</label>`; }).join('')}</div>
  <div class="addrow"><input type="text" data-add="${key}" maxlength="60" placeholder="Agregar otro…" aria-label="Agregar otro"><button type="button" class="btn ghost sm" data-addbtn="${key}">Agregar</button></div>`;
}
function step3HTML() {
  const f = S.form; const sug = f.suggested;
  const missing = missingFacts(f);
  return `<h2 tabindex="-1">3 · Datos de la ficha</h2>
  <p class="hint">Lo que la IA no puede saber. ${S.photos.some(p => p.analysis) ? 'Lo marcado <em class="sug">sugerido — confirma</em> viene del análisis de las fotos: revísalo.' : 'Todo es opcional salvo operación y tipo, pero cuanto más completo, mejor sale el copy y la ficha.'}</p>
  <form id="dataform" class="form" onsubmit="return false" autocomplete="off">
    <fieldset><legend>Operación</legend><div class="grid2">
      ${sel('operation', 'Operación', Object.entries(OPERATIONS))}
      ${sel('type', 'Tipo de propiedad', Object.entries(PROPERTY_TYPES), { sug: !!sug.type && f.type === sug.type })}
      ${input('price', 'Precio', { type: 'number', ph: 'Ej. 9450000' })}
      ${sel('currency', 'Moneda', [['MXN', 'MXN'], ['USD', 'USD']])}
      ${input('priceConditions', 'Condiciones de precio y pago', { wide: true, max: 600, ph: 'Ej. Acepta crédito hipotecario, enganche del 30 %, mantenimiento incluido…' })}</div></fieldset>
    <fieldset><legend>Superficies y distribución</legend><div class="grid3">
      ${input('areaM2', 'Construcción (m²)', { type: 'number' })}${input('lotM2', 'Terreno (m²)', { type: 'number' })}${input('levels', 'Niveles', { type: 'number', step: 1 })}
      ${input('bedrooms', 'Recámaras', { type: 'number', step: 1 })}${input('bathrooms', 'Baños', { type: 'number', step: 0.5 })}${input('parking', 'Estacionamientos', { type: 'number', step: 1 })}</div></fieldset>
    <fieldset><legend>Ubicación</legend><div class="grid3">
      ${input('city', 'Ciudad', { ph: 'Tulum, Cancún, Mérida…', list: 'cities' })}${input('zone', 'Zona o colonia', { ph: 'Aldea Zamá' })}${input('development', 'Desarrollo (opcional)')}
      ${input('lat', 'Latitud (opcional)', { type: 'number', ph: '20.2114' })}${input('lng', 'Longitud (opcional)', { type: 'number', ph: '-87.4654' })}</div>
      <datalist id="cities"><option>Tulum</option><option>Playa del Carmen</option><option>Cancún</option><option>Mérida</option><option>Bacalar</option><option>Akumal</option><option>Puerto Morelos</option></datalist>
      <p class="mini">Con coordenadas, la ficha muestra el mapa. Sin ellas, solo la zona y ciudad.</p></fieldset>
    <fieldset><legend>Características</legend><div class="grid3">
      <div class="fld"><span>Antigüedad</span><div class="inl"><select name="ageMode" aria-label="Antigüedad"><option value="years"${f.ageMode === 'years' ? ' selected' : ''}>Años</option><option value="new"${f.ageMode === 'new' ? ' selected' : ''}>A estrenar</option></select><input name="ageYears" type="number" min="0" inputmode="numeric" value="${esc(f.ageYears)}" aria-label="Años de antigüedad" ${f.ageMode === 'new' ? 'disabled' : ''}></div></div>
      ${input('orientation', 'Orientación', { ph: 'Oriente, vista al mar…' })}${sel('furnished', 'Amueblado', [['', 'Sin especificar'], ['Sin amueblar', 'Sin amueblar'], ['Semi amueblado', 'Semi amueblado'], ['Amueblado', 'Amueblado']])}
      ${input('maintenanceFee', 'Mantenimiento mensual', { type: 'number' })}${input('delivery', 'Entrega (preventa)', { ph: 'Dic 2027' })}</div></fieldset>
    <fieldset><legend>Amenidades</legend>${chipGroup('amenities', AMENITY_OPTS)}</fieldset>
    <fieldset><legend>Acabados y materiales${sug.finishes.length ? '' : ''}</legend>${chipGroup('finishes', FINISH_OPTS)}</fieldset>
    <fieldset><legend>Servicios</legend>${chipGroup('services', SERVICE_OPTS)}</fieldset>
    <fieldset><legend>Notas para la redacción</legend><label class="fld wide"><span class="sr">Notas</span><textarea name="notes" rows="3" maxlength="1500" placeholder="Algo que el comprador debe saber y no se ve en las fotos: cercanía a la playa, uso de suelo, historia del lugar…">${esc(f.notes)}</textarea></label>
      <label class="check"><input type="checkbox" name="englishVersion" ${f.englishVersion ? 'checked' : ''}> También generar la versión en inglés${ai.configured ? '' : ' <small>(requiere la IA conectada)</small>'}</label></fieldset>
  </form>
  ${missing.length ? `<aside class="warnbox"><b>Faltan datos que el copy dejará como "por confirmar":</b> ${esc(missing.join(' · '))}.</aside>` : ''}`;
}
function bindStep3() {
  const form = $('#dataform'); const f = S.form;
  form.addEventListener('input', e => {
    const t = e.target; if (!t.name) return;
    if (t.type === 'checkbox') f[t.name] = t.checked; else f[t.name] = t.value;
    if (t.name === 'type') f.suggested.type = '';
    save();
  });
  form.addEventListener('change', e => {
    const t = e.target;
    if (t.name === 'ageMode') { form.querySelector('[name=ageYears]').disabled = t.value === 'new'; }
    const group = t.closest('.chipset')?.dataset.group;
    if (group && t.type === 'checkbox') {
      const set = new Set(f[group].map(x => x)); const val = t.value;
      if (t.checked) { if (!f[group].some(x => lower(x) === lower(val))) f[group].push(val); } else { f[group] = f[group].filter(x => lower(x) !== lower(val)); }
      f.suggested[group] = (f.suggested[group] || []).filter(x => lower(x) !== lower(val)); void set;
      t.closest('.opt').classList.toggle('on', t.checked); t.closest('.opt').querySelector('.sug')?.remove(); save();
    }
  });
  const add = key => { const inp = form.querySelector(`[data-add="${key}"]`); const v = inp.value.trim(); if (!v) return; if (!f[key].some(x => lower(x) === lower(v))) f[key].push(v); save(); rerenderPanel(); };
  form.addEventListener('click', e => { const b = e.target.closest('[data-addbtn]'); if (b) add(b.dataset.addbtn); });
  form.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.add) { e.preventDefault(); add(e.target.dataset.add); } });
}

/* =================== PASO 4: copy =================== */
const factsForAi = () => {
  const f = S.form; const out = { operation: f.operation, type: f.type, currency: f.currency, zone: f.zone, city: f.city, development: f.development, notes: f.notes, orientation: f.orientation, priceConditions: f.priceConditions, furnished: f.furnished, delivery: f.delivery, amenities: f.amenities, finishes: f.finishes, services: f.services };
  for (const k of ['price', 'areaM2', 'lotM2', 'bedrooms', 'bathrooms', 'parking', 'levels', 'maintenanceFee']) { const v = num(f[k]); if (v !== null && v >= 0) out[k] = v; }
  if (f.ageMode === 'new') out.newBuild = true; else { const v = num(f.ageYears); if (v !== null) out.ageYears = v; }
  return out;
};
const aiAnalyses = () => S.photos.filter(p => p.analysis).map(p => ({ ...p.analysis, space: p.space }));
const stripCopy = c => { const { source, generatedAt, ...rest } = c; return rest; };

function commitCopy(next, label, source) {
  const cur = S.copy.current;
  if (cur) { S.copy.history.push({ at: new Date().toISOString(), label, copy: clone(cur) }); S.copy.history = S.copy.history.slice(-20); }
  S.copy.redo = []; S.copy.current = { ...next, source: source || cur?.source || 'manual', generatedAt: next.generatedAt || new Date().toISOString() };
  save();
}
async function generateCopy() {
  const prev = S.copy.current ? clone(S.copy.current) : null;
  ui.busy = 'copy'; ui.copyError = ''; renderPanel(); renderNav();
  try {
    let next;
    if (ai.configured) {
      const res = await client.copy({ analyses: aiAnalyses(), facts: factsForAi(), englishVersion: S.form.englishVersion });
      S.usage.input_tokens += res.usage?.input_tokens || 0; S.usage.output_tokens += res.usage?.output_tokens || 0;
      next = { ...res.copy, source: 'ai', generatedAt: new Date().toISOString() };
      if (res.warnings?.length) toast('Algunos textos se ajustaron a su límite de caracteres.');
    } else next = templateCopy({ ...S.form, ...factsForAi() }, S.photos);
    if (prev) { S.copy.history.push({ at: new Date().toISOString(), label: 'Antes de volver a generar', copy: prev }); S.copy.history = S.copy.history.slice(-20); }
    S.copy.current = next; S.copy.edited = false; S.copy.redo = [];
  } catch (e) { ui.copyError = aiMessage(e); }
  ui.busy = ''; save(); renderChrome(); renderPanel();
}
const FIELDS = [
  ['title', 'Título', 'input', 70], ['subtitle', 'Subtítulo', 'input', 140], ['long', 'Descripción larga', 'area', 0, 9], ['short', 'Versión corta', 'area', 300, 3],
  ['highlights', 'Puntos destacados (uno por línea)', 'lines', 0, 6], ['seo.title', 'Meta título (SEO)', 'input', 60], ['seo.description', 'Meta descripción (SEO)', 'area', 155, 3],
  ['instagram', 'Instagram', 'area', 2200, 7], ['whatsapp', 'WhatsApp', 'area', 1000, 5],
];
const getPath = (o, path) => path.split('.').reduce((a, k) => a?.[k], o);
function setPath(o, path, v) { const keys = path.split('.'); const last = keys.pop(); const t = keys.reduce((a, k) => (a[k] ||= {}), o); t[last] = v; }
function fieldHTML(prefix, [path, label, kind, max, rows]) {
  const full = prefix ? `${prefix}.${path}` : path; const cur = S.copy.current; let v = getPath(cur, full);
  if (kind === 'lines') v = (v || []).join('\n');
  const id = `f-${full.replace(/\./g, '-')}`; const len = String(v ?? '').length;
  const ctl = kind === 'input' ? `<input id="${id}" data-path="${full}" value="${esc(v)}" ${max ? `maxlength="${max * 3}"` : ''}>` : `<textarea id="${id}" data-path="${full}" rows="${rows || 4}" data-kind="${kind}">${esc(v)}</textarea>`;
  return `<div class="cf"><div class="cfh"><label for="${id}">${label}</label><span class="cnt${max && len > max ? ' over' : ''}" data-cnt="${full}">${max ? `${len}/${max}` : ''}</span><button type="button" class="link" data-copy="${full}">Copiar</button></div>${ctl}</div>`;
}
const sourceBadge = c => c.source === 'ai' ? `<span class="badge ai">Generado por Claude${S.copy.edited ? ' · editado a mano' : ''}</span>` : c.source === 'template' ? `<span class="badge tpl">Borrador automático sin IA${S.copy.edited ? ' · editado a mano' : ''}</span>` : '<span class="badge">Escrito a mano</span>';
function step4HTML() {
  if (ui.busy === 'copy') return `<h2 tabindex="-1">4 · Copy</h2><div class="working"><span class="spin big" aria-hidden="true"></span><p><b>${ai.configured ? 'Claude está redactando la ficha…' : 'Armando el borrador automático…'}</b></p><p class="hint">${ai.configured ? 'Suele tardar entre 15 y 40 segundos.' : 'Es una plantilla a partir de tus datos y espacios; no usa IA.'}</p></div>`;
  if (ui.copyError) return `<h2 tabindex="-1">4 · Copy</h2><div class="errbox" role="alert"><p><b>No se pudo generar el copy con la IA.</b> ${esc(ui.copyError)}</p><div class="acts"><button type="button" class="btn" data-action="regen">Reintentar</button><button type="button" class="btn ghost" data-action="template">Usar borrador automático sin IA</button>${S.copy.current ? '<button type="button" class="btn ghost" data-action="keepcopy">Mantener el copy actual</button>' : ''}</div></div>`;
  const c = S.copy.current; if (!c) return '<h2 tabindex="-1">4 · Copy</h2><p>Genera el copy desde el paso anterior.</p>';
  const canAi = ai.configured;
  const scope = [['', 'Todo el copy'], ...Object.entries(FIELD_LABELS).filter(([k]) => k !== 'en').map(([k, l]) => [k, l])];
  const hist = S.copy.history.slice().reverse();
  return `<h2 tabindex="-1">4 · Copy</h2><div id="copyroot">
  <div class="copyhead">${sourceBadge(c)}<div class="vers"><button type="button" class="btn ghost sm" data-action="undo" ${S.copy.history.length ? '' : 'disabled'}>↶ Deshacer</button><button type="button" class="btn ghost sm" data-action="redo" ${S.copy.redo.length ? '' : 'disabled'}>↷ Rehacer</button><button type="button" class="btn ghost sm" data-action="regen" ${ui.busy ? 'disabled' : ''}>Volver a generar</button></div></div>
  ${c.source === 'template' ? '<p class="warnbox tight">Este texto es una <b>plantilla</b> armada con tus datos, no lo escribió una IA. Revísalo y ajústalo a mano; la reescritura por prompt se activa al conectar la IA.</p>' : ''}
  ${c.toConfirm?.length ? `<aside class="warnbox"><b>Datos por confirmar</b> antes de publicar:<ul>${c.toConfirm.map(t => `<li>${esc(t)}</li>`).join('')}</ul></aside>` : ''}
  <div class="rewrite${canAi ? '' : ' off'}">
    <h3>Pídele un cambio a la IA</h3>
    ${canAi ? '' : `<p class="why"><b>${esc(DEMO_AI)}</b></p>`}
    <div class="quick" role="group" aria-label="Cambios rápidos">${['Más corto', 'Más lujoso', 'Enfoque inversión', 'Para familias', 'En inglés'].map(t => `<button type="button" class="chip" data-quick="${t}" ${canAi && !ui.busy ? '' : 'disabled'}>${t}</button>`).join('')}</div>
    <div class="free"><label class="sr" for="prompt">Instrucción</label><textarea id="prompt" rows="2" maxlength="600" placeholder="Ej. Hazlo más cálido y destaca la cercanía a la playa" ${canAi ? '' : 'disabled'}></textarea>
      <div class="freerow"><label>Aplicar a <select id="scope" ${canAi ? '' : 'disabled'}>${scope.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label><button type="button" class="btn" id="applyprompt" ${canAi && !ui.busy ? '' : 'disabled'}>${ui.busy === 'rewrite' ? 'Aplicando…' : 'Aplicar cambio'}</button></div></div>
    <p class="mini" id="rwstatus" role="status"></p>
  </div>
  <div class="fields">${FIELDS.map(f => fieldHTML('', f)).join('')}</div>
  ${c.en ? `<details class="en" open><summary>Versión en inglés</summary><div class="fields">${FIELDS.map(f => fieldHTML('en', f)).join('')}</div></details>` : `<p class="mini">${canAi ? 'Para la versión en inglés usa el botón "En inglés" o activa la casilla en el paso 3 y vuelve a generar.' : 'La versión en inglés requiere la IA conectada.'}</p>`}
  ${hist.length ? `<details class="history"><summary>Historial de versiones (${hist.length})</summary><ol>${hist.map((h, i) => `<li><span><b>${esc(h.label)}</b> · ${esc(timeAgo(h.at))}</span><button type="button" class="link" data-restore="${S.copy.history.length - 1 - i}">Restaurar</button></li>`).join('')}</ol></details>` : ''}</div>`;
}
function bindStep4() {
  const panel = $('#copyroot'); if (!panel) return; let base = null;
  panel.addEventListener('focusin', e => { if (e.target.dataset?.path) base = clone(S.copy.current); });
  panel.addEventListener('input', e => {
    const t = e.target; const path = t.dataset?.path; if (!path || !S.copy.current) return;
    let v = t.value; if (t.dataset.kind === 'lines') v = v.split('\n').map(x => x.trim()).filter(Boolean);
    setPath(S.copy.current, path, v); S.copy.edited = true;
    const cnt = $(`[data-cnt="${path}"]`); const max = FIELDS.find(f => f[0] === path.replace(/^en\./, ''))?.[3];
    if (cnt && max) { cnt.textContent = `${t.value.length}/${max}`; cnt.classList.toggle('over', t.value.length > max); }
    save();
  });
  panel.addEventListener('change', e => {
    const path = e.target.dataset?.path; if (!path || !base) return;
    if (JSON.stringify(base) !== JSON.stringify(S.copy.current)) {
      S.copy.history.push({ at: new Date().toISOString(), label: `Edición manual: ${path}`, copy: base }); S.copy.history = S.copy.history.slice(-20); S.copy.redo = []; save(); renderCopyMeta();
    }
    base = null;
  });
  panel.addEventListener('click', async e => {
    const cp = e.target.closest('[data-copy]');
    if (cp) { const v = getPath(S.copy.current, cp.dataset.copy); const ok = await copyText(Array.isArray(v) ? v.map(x => `• ${x}`).join('\n') : String(v ?? '')); toast(ok ? 'Copiado al portapapeles.' : 'No se pudo copiar; selecciona el texto manualmente.', ok ? '' : 'error'); return; }
    const q = e.target.closest('[data-quick]'); if (q) { applyRewrite(q.dataset.quick === 'En inglés' ? 'Traduce todo el copy al inglés para compradores internacionales (llena la versión en inglés y deja el español igual).' : q.dataset.quick === 'Más lujoso' ? 'Hazlo más lujoso y editorial, sin adjetivos exagerados.' : q.dataset.quick === 'Enfoque inversión' ? 'Reenfócalo en inversión: plusvalía, renta potencial y ubicación, sin prometer rendimientos.' : q.dataset.quick === 'Para familias' ? 'Reenfócalo para familias: espacios, seguridad, comodidad y vida diaria.' : 'Hazlo más corto y directo, conservando los datos clave.', q.dataset.quick, ''); return; }
    const r = e.target.closest('[data-restore]'); if (r) { const h = S.copy.history[Number(r.dataset.restore)]; if (h) { commitCopy(h.copy, `Restaurado: ${h.label}`, h.copy.source); renderPanel(); toast('Versión restaurada.'); } }
  });
  $('#applyprompt')?.addEventListener('click', () => { const v = $('#prompt').value.trim(); if (v.length < 3) { $('#rwstatus').textContent = 'Escribe qué quieres cambiar.'; return; } applyRewrite(v, v.length > 40 ? `${v.slice(0, 40)}…` : v, $('#scope').value); });
}
function renderCopyMeta() { const u = $('[data-action="undo"]'); if (u) u.disabled = !S.copy.history.length; const r = $('[data-action="redo"]'); if (r) r.disabled = !S.copy.redo.length; }
async function applyRewrite(instruction, label, field) {
  if (!ai.configured || ui.busy) return;
  ui.busy = 'rewrite'; const status = $('#rwstatus'); document.querySelectorAll('.rewrite button, #prompt').forEach(el => { el.disabled = true; }); if (status) status.textContent = 'Claude está reescribiendo…';
  try {
    const res = await client.rewrite({ copy: stripCopy(S.copy.current), instruction, field: field || undefined, facts: factsForAi() });
    S.usage.input_tokens += res.usage?.input_tokens || 0; S.usage.output_tokens += res.usage?.output_tokens || 0;
    commitCopy({ ...res.copy }, `IA: ${label || instruction}`, 'ai'); S.copy.edited = false;
    ui.busy = ''; renderChrome(); renderPanel(); toast(res.changed?.length ? `Cambio aplicado (${res.changed.map(k => FIELD_LABELS[k] || k).join(', ')}). Puedes deshacerlo.` : 'La IA no encontró nada que cambiar.');
  } catch (e) { ui.busy = ''; renderPanel(); const s2 = $('#rwstatus'); if (s2) s2.textContent = aiMessage(e); toast(aiMessage(e), 'error'); }
}

/* =================== PASO 5: ficha, guardar, publicar =================== */
function formProps() {
  const f = S.form; const c = S.copy.current || {};
  const type = PROPERTY_TYPES[f.type] || 'Propiedad';
  return {
    title: (c.title || `${type}${f.city ? ` en ${f.city}` : ''}`).slice(0, 160), type: f.type, operation: f.operation, status: 'disponible',
    price: num(f.price), currency: f.currency, areaM2: num(f.areaM2), lotM2: num(f.lotM2), bedrooms: num(f.bedrooms), bathrooms: num(f.bathrooms), parking: num(f.parking),
    development: f.development, zone: f.zone, city: f.city, lat: num(f.lat), lng: num(f.lng), description: (c.long || '').slice(0, 8000), features: f.amenities,
    copy: c.title || c.long ? c : null, aiGenerated: c.source === 'ai', source: c.source === 'ai' ? 'ai' : 'manual',
    specs: { code: S.code, levels: num(f.levels), ageYears: f.ageMode === 'new' ? null : num(f.ageYears), newBuild: f.ageMode === 'new', orientation: f.orientation, furnished: f.furnished, delivery: f.delivery, maintenanceFee: num(f.maintenanceFee), maintenanceCurrency: f.maintenanceCurrency, services: f.services, finishes: f.finishes, amenities: f.amenities, priceConditions: f.priceConditions },
  };
}
const photoMetaOf = (list, title) => list.map(p => ({ space: p.space, alt: p.alt || `${title}, ${SPACES[p.space] ? SPACES[p.space].toLowerCase() : 'foto'}`, quality: (p.quality || []).map(q => ({ issue: q.issue, suggestion: q.suggestion })) }));
function previewProperty() {
  const ready = S.photos.filter(p => !p.processing && p.status !== 'error').slice(0, 12);
  const base = cleanProperty({ ...formProps(), id: S.propertyId || 'preview', slug: 'preview', images: [] });
  base.images = ready.map(p => urlsOf(p.id).big); base.photoMeta = photoMetaOf(ready, base.title).map(m => ({ src: '', ...m }));
  return base;
}
function relatedFor(prop) { return relatedProperties(prop, data().properties.list().filter(p => p.id !== S.propertyId), { limit: 6 }); }
function step5HTML() {
  if (ui.publishedSlug) return publishedHTML();
  const prop = previewProperty(); const rel = relatedFor(prop); const c = S.copy.current || {};
  const pending = c.toConfirm || [];
  const issues = []; if (!prop.images.length) issues.push('Sube al menos una foto.'); if (!prop.price) issues.push('Falta el precio: se mostrará como "Precio a consultar".'); if (!prop.city && !prop.zone) issues.push('Falta la ubicación (ciudad o zona).');
  return `<h2 tabindex="-1">5 · Ficha técnica</h2>
  <div class="factions">
    <div class="acts"><button type="button" class="btn dark" data-action="print">Imprimir / guardar PDF</button><a class="btn ghost" id="wa" target="_blank" rel="noopener" href="${esc(waShare(prop))}">Compartir por WhatsApp</a></div>
    <div class="acts"><button type="button" class="btn ghost" data-action="draft">Guardar como borrador</button><button type="button" class="btn" data-action="publish" ${prop.images.length ? '' : 'disabled'}>${S.propertyId ? 'Actualizar en el catálogo' : 'Publicar en el catálogo'}</button></div>
  </div>
  ${ui.savedDraftNote ? `<p class="okbox" role="status">${esc(ui.savedDraftNote)}</p>` : ''}
  ${issues.length ? `<aside class="warnbox tight"><ul>${issues.map(t => `<li>${esc(t)}</li>`).join('')}</ul></aside>` : ''}
  ${pending.length ? `<label class="check pend"><input type="checkbox" id="okpend" ${ui.confirmPending ? 'checked' : ''}> Entiendo que hay ${pending.length} dato${pending.length === 1 ? '' : 's'} por confirmar (paso 4) y los verificaré con el propietario.</label>` : ''}
  <p class="mini">${rel.length ? `Propiedades relacionadas encontradas: ${rel.length}. Pasa el cursor sobre una para ver por qué se parece.` : 'Aún no hay otras propiedades similares en el inventario; al publicar más, aparecerán aquí.'}</p>
  <div class="docwrap">${fichaDocHTML(prop, { related: rel, origin: S.propertyId ? location.origin : '' })}</div>`;
}
const waShare = prop => `https://wa.me/?text=${encodeURIComponent([S.copy.current?.whatsapp || prop.title, ui.publishedSlug ? `${location.origin}/propiedades/?p=${encodeURIComponent(ui.publishedSlug)}` : ''].filter(Boolean).join('\n\n'))}`;
function publishedHTML() {
  const href = `/propiedades/?p=${encodeURIComponent(ui.publishedSlug)}`;
  const prop = previewProperty();
  return `<div class="done"><p class="eyebrow">( Listo )</p><h2 tabindex="-1">Propiedad publicada</h2>
  <p class="lead">Ya aparece en el catálogo público con su ficha técnica y propiedades relacionadas.</p>
  ${ui.lastWeb ? `<p class="mini">Se guardaron ${ui.lastWeb.count} foto${ui.lastWeb.count === 1 ? '' : 's'} optimizadas (${ui.lastWeb.side}px, ≈ ${Math.round(ui.lastWeb.bytes / 1024)} KB en total) para respetar el límite de 4 MB del demo local.${ui.lastWeb.dropped ? ` <b>${ui.lastWeb.dropped} no cupieron</b> y no se publicaron.` : ''}</p>` : ''}
  <div class="acts"><a class="btn" id="viewpub" href="${esc(href)}">Ver ficha pública</a><a class="btn ghost" href="/propiedades/">Ir al catálogo</a><button type="button" class="btn ghost" data-action="print">Imprimir / PDF</button><a class="btn ghost" target="_blank" rel="noopener" href="${esc(waShare(prop))}">Compartir por WhatsApp</a><button type="button" class="btn ghost" data-action="again">Subir otra propiedad</button></div></div>`;
}
function publishBudget() {
  const d = data(); const MAX = 4 * 1024 * 1024;
  const used = new TextEncoder().encode(d.exportAll()).byteLength;
  const own = S.propertyId ? new TextEncoder().encode(JSON.stringify(d.properties.get(S.propertyId) || {})).byteLength : 0;
  return Math.max(0, MAX - (used - own) - 90 * 1024);   // margen para el texto del copy y la bitácora
}
async function persistProperty({ draft }) {
  if (!checkAccess()) return null;
  const ready = S.photos.filter(p => !p.processing && p.status !== 'error').slice(0, 12);
  if (!ready.length) { toast('Sube al menos una foto.', 'error'); return null; }
  ui.busy = 'save'; renderNav(); document.querySelectorAll('.factions button').forEach(b => { b.disabled = true; });
  try {
    const d = data(); let keep = ready.slice(); let web = null; let saved = null; let scale = 1;
    // Ajusta la calidad de las fotos web al espacio libre; si ni a la calidad mínima caben todas, quita las últimas.
    for (let i = 0; i < 24 && !saved && keep.length; i++) {
      web = await webVersions(keep.map(p => mem.blobs.get(p.id).big), Math.floor(publishBudget() * scale));
      if (!web) { keep = keep.slice(0, -1); continue; }
      const f = formProps();
      try { saved = d.properties.save({ ...f, id: S.propertyId || undefined, images: web.urls, photoMeta: photoMetaOf(keep, f.title), draft }); }
      catch (e) { if (/4 MB|espacio/i.test(e.message)) { scale *= 0.8; continue; } throw e; }
    }
    if (!saved) throw new Error('No cupo en el almacenamiento local del demo (4 MB). Quita fotos o elimina propiedades de ejemplo desde el Editor.');
    S.propertyId = saved.id; ui.lastWeb = { count: keep.length, side: web.side, bytes: web.bytes, dropped: ready.length - keep.length };
    d.audit.log('Alta de propiedad con IA', `${saved.title} · IA: ${saved.aiGenerated ? 'sí' : 'no'} · ${keep.length} fotos${draft ? ' · borrador' : ''}`, 'properties');
    if (draft) { persistNow(); ui.savedDraftNote = `Borrador guardado en el inventario (${keep.length} foto${keep.length === 1 ? '' : 's'}, ${web.side}px). No aparece en el catálogo hasta que publiques.`; }
    else { ui.publishedSlug = saved.slug; ui.savedDraftNote = ''; draftStore.clear(); try { await blobStore.clearDraft(S.draftId); } catch { /* sin IndexedDB */ } }
    return saved;
  } catch (e) { toast(e.message, 'error'); return null; }
  finally { ui.busy = ''; renderChrome(); renderPanel(); }
}
async function printFicha() {
  const prop = previewProperty();
  const root = $('#print-root'); root.innerHTML = fichaDocHTML(prop, { related: relatedFor(prop), origin: S.propertyId ? location.origin : '' });
  await Promise.all([...root.querySelectorAll('img')].map(i => { i.loading = 'eager'; return Promise.race([i.decode?.().catch(() => {}), new Promise(r => setTimeout(r, 2500))]); }));
  document.body.classList.add('print-ficha');
  const done = () => { document.body.classList.remove('print-ficha'); root.innerHTML = ''; };
  addEventListener('afterprint', done, { once: true });
  window.print();
}
function bindStep5() {
  $('#okpend')?.addEventListener('change', e => { ui.confirmPending = e.target.checked; });
  document.querySelector('.docwrap')?.addEventListener('click', e => { if (e.target.closest('.fd-rel')) e.preventDefault(); });
}

/* =================== render y acciones globales =================== */
const VIEWS = { 1: [step1HTML, bindStep1], 2: [step2HTML, bindStep2], 3: [step3HTML, bindStep3], 4: [step4HTML, bindStep4], 5: [step5HTML, bindStep5] };
let delegated = false;
function renderPanel() {
  const [html, bind] = VIEWS[S.step];
  $('#panel').innerHTML = html(); bind();
}
const rerenderPanel = () => renderPanel();

async function resetAll() {
  if (!confirm('¿Empezar de nuevo? Se borran las fotos y el texto del borrador (las propiedades ya publicadas no se tocan).')) return;
  analysisRun?.abort.abort(); try { await blobStore.clearDraft(S.draftId); } catch { /* nada */ }
  for (const id of [...mem.blobs.keys()]) dropUrls(id);
  draftStore.clear(); S = blank(); client = createAiClient({ draftId: S.draftId }); Object.assign(ui, { publishedSlug: '', savedDraftNote: '', confirmPending: false, copyError: '', lastWeb: null, busy: '' });
  renderChrome(); renderPanel(); window.scrollTo({ top: 0 });
}
document.addEventListener('click', async e => {
  const g = e.target.closest('[data-goto]'); if (g && !g.disabled) { await goto(Number(g.dataset.goto)); return; }
  const a = e.target.closest('[data-action]'); if (!a) return;
  const act = a.dataset.action;
  if (act === 'next') { if (S.step === 3 && !S.copy.current) { await goto(4); } else await goto(S.step + 1); }
  else if (act === 'back') await goto(S.step - 1);
  else if (act === 'reset' || act === 'again') await resetAll();
  else if (act === 'regen') await generateCopy();
  else if (act === 'keepcopy') { ui.copyError = ''; renderPanel(); }
  else if (act === 'template') { ui.copyError = ''; S.copy.current = templateCopy({ ...S.form, ...factsForAi() }, S.photos); save(); renderChrome(); renderPanel(); }
  else if (act === 'undo') { const h = S.copy.history.pop(); if (h) { S.copy.redo.push(clone(S.copy.current)); S.copy.current = h.copy; save(); renderPanel(); toast(`Deshecho: ${h.label}`); } }
  else if (act === 'redo') { const r = S.copy.redo.pop(); if (r) { S.copy.history.push({ at: new Date().toISOString(), label: 'Rehacer', copy: clone(S.copy.current) }); S.copy.current = r; save(); renderPanel(); } }
  else if (act === 'print') await printFicha();
  else if (act === 'draft') { const s = await persistProperty({ draft: true }); if (s) toast('Borrador guardado en el inventario.'); }
  else if (act === 'publish') {
    if ((S.copy.current?.toConfirm || []).length && !ui.confirmPending) { toast('Marca la casilla de datos por confirmar para publicar.', 'error'); $('#okpend')?.focus(); return; }
    const s = await persistProperty({ draft: false }); if (s) toast('Propiedad publicada en el catálogo.');
  }
});

async function init() {
  await blobStore.available().then(ok => { mem.persistent = ok; });
  const restored = await restoreDraft();
  client = createAiClient({ draftId: S.draftId });
  const st = await client.status(); ai = { ...ai, ...st, checked: true };
  if (!checkAccess()) { data().subscribe(t => { if (['session', 'users', 'all'].includes(t) && checkAccess()) location.reload(); }); return; }
  data().subscribe(t => { if (['session', 'users', 'all'].includes(t)) checkAccess(); });
  if (restored) { S.photos.forEach(p => { if (p.aiState === 'running') p.aiState = 'idle'; }); if (S.step === 4 && !S.copy.current) S.step = 3; }
  else S.step = 1;
  renderChrome(); renderPanel();
  if (restored && S.photos.length) toast(`Recuperé tu borrador (${S.photos.length} fotos).`);
  if (S.step === 2) maybeAutoAnalyze();
  window.__ornatSubir = { get state() { return S; }, get ai() { return ai; } };   // solo lectura, para depurar
}
init();
