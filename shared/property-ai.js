// ORNAT · lógica compartida del alta de propiedad con IA (sin DOM, probada con node --test).
//   - cliente de /api/property-ai (fetch inyectable)
//   - sugerencias a partir de los análisis de las fotos
//   - borrador automático SIN IA (plantilla) para el modo demo: siempre con source:'template', nunca se hace pasar por IA
//   - estimación de costo
import { SPACES, PROPERTY_TYPES, OPERATIONS } from './data.js';
import { remote } from './remote-boot.js';

export const MODEL = 'claude-opus-5-5';
export const PRICE_PER_MTOK = { input: 4, output: 20 }; // USD por millón de tokens (claude-opus-5-5)
export const MAX_AI_PHOTOS = 12;
export const MAX_PHOTOS = 30;

export const estimateCostUsd = usage => (((usage?.input_tokens || 0) * PRICE_PER_MTOK.input) + ((usage?.output_tokens || 0) * PRICE_PER_MTOK.output)) / 1e6;
export const sumUsage = list => list.reduce((a, u) => ({ input_tokens: a.input_tokens + (u?.input_tokens || 0), output_tokens: a.output_tokens + (u?.output_tokens || 0) }), { input_tokens: 0, output_tokens: 0 });

const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const uniq = arr => [...new Set(arr.map(v => String(v).trim()).filter(Boolean))];
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
const money = (n, cur) => `${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(n)} ${cur}`;
const joinEs = items => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`);

/* ---------- espacios ---------- */
const NAME_HINTS = [
  ['cocina', /cocina|kitchen/], ['recamara', /recamara|habitacion|bedroom|cuarto/], ['bano', /bano|bath|regadera/], ['alberca', /alberca|pool|piscina/],
  ['fachada', /fachada|frente|exterior|front/], ['terraza', /terraza|balcon|roof|azotea|terrace/], ['vista', /vista|view|panoram/], ['sala', /sala|living|lounge/],
  ['comedor', /comedor|dining/], ['jardin', /jardin|garden|patio/], ['plano', /plano|floorplan|blueprint/], ['amenidad', /gym|gimnasio|amenid|spa|club/],
];
/** Pista honesta por nombre de archivo ("cocina-2.jpg" -> cocina). Devuelve '' si no hay pista. */
export function guessSpaceFromName(name) {
  const n = norm(name);
  for (const [space, re] of NAME_HINTS) if (re.test(n)) return space;
  return '';
}

/** [{space,label,count}] en el orden canónico de SPACES; ignora 'otro' sin etiqueta salvo que sea lo único. */
export function spaceSummary(photos) {
  const counts = {}; for (const p of photos) { const s = SPACES[p.space] ? p.space : 'otro'; counts[s] = (counts[s] || 0) + 1; }
  return Object.keys(SPACES).filter(k => counts[k]).map(k => ({ space: k, label: SPACES[k], count: counts[k] }));
}

/** Agrupa fotos por espacio conservando el orden de cada una. */
export function groupBySpace(photos) {
  const groups = new Map(); for (const p of photos) { const s = SPACES[p.space] ? p.space : 'otro'; if (!groups.has(s)) groups.set(s, []); groups.get(s).push(p); }
  return Object.keys(SPACES).filter(k => groups.has(k)).map(k => ({ space: k, label: SPACES[k], photos: groups.get(k) }));
}

/* ---------- sugerencias a partir de los análisis de la IA ---------- */
const AMENITY_RULES = [['alberca', /alberca|piscina|pool/], ['terraza', /terraza|balc[oó]n/], ['roof garden', /roof|azotea/], ['jardín', /jard[ií]n|patio/], ['vista al mar', /vista (al )?mar|oc[eé]ano|caribe/], ['gimnasio', /gimnasio|gym/], ['jacuzzi', /jacuzzi|jacuzzi/], ['cocina integral', /cocina integral|isla/], ['chimenea', /chimenea/], ['cochera techada', /cochera|garage|carport/]];
export function suggestFromAnalyses(analyses) {
  const list = analyses.filter(Boolean);
  // cuenta por clave sin acentos/mayúsculas, pero devuelve el texto original (con acentos) de la primera aparición
  const tally = arr => { const m = new Map(); for (const v of arr) { const t = String(v ?? '').trim(); if (!t) continue; const k = norm(t); const e = m.get(k) || { t, n: 0 }; e.n++; m.set(k, e); } return [...m.values()].sort((a, b) => b.n - a.n).map(e => e.t); };
  const types = list.map(a => a.propertyTypeHint).filter(t => PROPERTY_TYPES[t]);
  const blob = norm(list.flatMap(a => [...(a.elements || []), ...(a.sellingPoints || []), a.space === 'alberca' ? 'alberca' : '', a.space === 'terraza' ? 'terraza' : '', a.space === 'vista' ? 'vista' : '']).join(' | '));
  const amenities = AMENITY_RULES.filter(([, re]) => re.test(blob)).map(([name]) => name);
  const finishes = tally(list.flatMap(a => a.materials || [])).slice(0, 8).map(cap);
  const styles = tally(list.map(a => a.style));
  return { type: tally(types)[0] || '', amenities: uniq(amenities), finishes: uniq(finishes), style: styles[0] ? cap(styles[0]) : '' };
}

/** Une los avisos de calidad de la IA y los locales sin repetir el mismo problema. */
export function mergeQuality(local = [], ai = []) {
  const seen = new Set(), out = [];
  for (const q of [...ai.map(x => ({ ...x, by: 'ia' })), ...local.map(x => ({ ...x, by: 'local' }))]) {
    const k = norm(q.issue).replace(/\s+/g, '_').replace(/_?(de_la_)?foto$/, '');
    const alias = /oscur|subexp/.test(k) ? 'oscura' : /sobreexp|quemad/.test(k) ? 'sobreexpuesta' : /borros|desenfoc/.test(k) ? 'borrosa' : k;
    if (!seen.has(alias)) { seen.add(alias); out.push(q); }
  }
  return out;
}

/* ---------- borrador automático sin IA (plantilla) ---------- */
export function missingFacts(f) {
  const out = [];
  if (!f.price) out.push('Precio y condiciones de pago');
  if (!f.areaM2 && !f.lotM2) out.push('Metros cuadrados de construcción o terreno');
  if (f.bedrooms === null || f.bedrooms === undefined || f.bedrooms === '') { if (!['terreno', 'lote', 'local', 'oficina'].includes(f.type)) out.push('Número de recámaras'); }
  if (!f.city && !f.zone) out.push('Ubicación (zona y ciudad)');
  return out;
}

export function templateCopy(f, photos = []) {
  const type = PROPERTY_TYPES[f.type] || 'Propiedad';
  const op = f.operation === 'renta' ? 'en renta' : f.operation === 'preventa' ? 'en preventa' : 'en venta';
  const where = [f.zone, f.city].filter(Boolean).join(', ');
  const spaces = spaceSummary(photos).filter(s => s.space !== 'otro');
  const amen = uniq(f.amenities || []);
  const finishes = uniq(f.finishes || []);
  const num = v => (v === null || v === undefined || v === '' ? null : Number(v));
  const area = num(f.areaM2), lot = num(f.lotM2), beds = num(f.bedrooms), baths = num(f.bathrooms), park = num(f.parking), price = num(f.price);

  const titleBase = beds && ['casa', 'departamento', 'villa'].includes(f.type) ? `${type} de ${beds} recámara${beds === 1 ? '' : 's'}` : type;
  let title = `${titleBase}${where ? ` en ${f.zone || f.city}` : ''}`;
  if (title.length > 70) title = title.slice(0, 70).replace(/\s+\S*$/, '');
  const facts = [area ? `${area} m² de construcción` : '', lot ? `${lot} m² de terreno` : '', beds ? `${beds} recámara${beds === 1 ? '' : 's'}` : '', baths ? `${baths} baño${baths === 1 ? '' : 's'}` : '', park ? `${park} lugar${park === 1 ? '' : 'es'} de estacionamiento` : ''].filter(Boolean);
  const subtitle = [OPERATIONS[f.operation] || 'Venta', ...facts.slice(0, 3)].join(' · ').slice(0, 240);

  const p1 = `${type} ${op}${where ? ` en ${where}` : ''}${facts.length ? `, con ${joinEs(facts)}` : ''}.`;
  const paras = [p1];
  if (spaces.length) paras.push(`En las fotografías se aprecian ${joinEs(spaces.map(s => `${s.label.toLowerCase()}${s.count > 1 ? ` (${s.count} fotos)` : ''}`))}.`);
  if (amen.length) paras.push(`Cuenta con ${joinEs(amen.map(a => a.toLowerCase()))}.`);
  if (finishes.length) paras.push(`Acabados y materiales: ${joinEs(finishes.map(a => a.toLowerCase()))}.`);
  paras.push('Para agendar una visita o pedir la ficha completa, escríbenos y te la enviamos.');
  const long = paras.join('\n\n');

  const short = [p1, amen.length ? `Incluye ${joinEs(amen.slice(0, 3).map(a => a.toLowerCase()))}.` : ''].filter(Boolean).join(' ').slice(0, 300);
  const highlights = uniq([area ? `${area} m² de construcción` : '', lot ? `${lot} m² de terreno` : '', beds ? `${beds} recámaras` : '', baths ? `${baths} baños` : '', park ? `${park} estacionamientos` : '', ...amen.map(cap)]).slice(0, 8);
  const seoTitle = `${title} ${op}${f.city ? ` | ${f.city}` : ''}`.slice(0, 60);
  const seoDesc = `${p1}`.slice(0, 155);
  const tag = f.city ? `#${norm(f.city).replace(/[^a-z0-9]/g, '')}` : '';
  const priceLine = price ? `${money(price, f.currency || 'MXN')}${f.operation === 'renta' ? ' al mes' : ''}` : '';
  const instagram = [`${title}${priceLine ? ` · ${priceLine}` : ''}`, p1, 'Escríbenos por mensaje directo para agendar visita.', ['#bienesraices', tag, `#${norm(type).replace(/\s+/g, '')}`].filter(Boolean).join(' ')].join('\n\n').slice(0, 2200);
  const whatsapp = [`*${title}*`, priceLine, p1, 'Si te interesa, respóndeme y coordinamos una visita.'].filter(Boolean).join('\n').slice(0, 1500);
  return { title, subtitle, long, short, highlights, seo: { title: seoTitle, description: seoDesc }, instagram, whatsapp, en: null, toConfirm: missingFacts(f), source: 'template', generatedAt: new Date().toISOString() };
}

/* ---------- cliente de la API ---------- */
export class AiError extends Error { constructor(code, message, status = 0, extra = {}) { super(message || code); this.code = code; this.status = status; Object.assign(this, extra); } }

export function createAiClient({ fetch: f = globalThis.fetch?.bind(globalThis), base = '/api/property-ai', draftId = '' } = {}) {
  async function call(path, { method = 'POST', body, signal } = {}) {
    let res;
    try {
      res = await f(`${base}/${path}`, { method, signal, headers: { 'content-type': 'application/json', ...(draftId ? { 'x-draft-id': draftId } : {}), ...(remote?.authHeader() || {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) { if (e?.name === 'AbortError') throw e; throw new AiError('network', 'No hay conexión con el servidor de IA.', 0); }
    let json = null; try { json = await res.json(); } catch { /* respuesta no JSON */ }
    if (!res.ok) throw new AiError(json?.error || `http_${res.status}`, json?.message || `El servidor respondió ${res.status}.`, res.status, { retryAfter: Number(res.headers?.get?.('retry-after')) || 0 });
    return json;
  }
  return {
    async status() {
      try { const j = await call('status', { method: 'GET' }); return { configured: j?.configured === true, model: j?.model || MODEL, reachable: true }; }
      catch (e) { return { configured: false, model: MODEL, reachable: e.code !== 'network' && e.status !== 404 && e.status !== 0, reason: e.code }; }
    },
    analyze: (body, signal) => call('analyze', { body, signal }),
    copy: (body, signal) => call('copy', { body, signal }),
    rewrite: (body, signal) => call('rewrite', { body, signal }),
  };
}

export const AI_MESSAGES = {
  ai_not_configured: 'IA pendiente de conectar: el análisis de Claude y la reescritura por prompt se activan al agregar la API key en Vercel.',
  rate_limited: 'Demasiadas solicitudes seguidas. Espera un momento y reintenta.',
  ai_refused: 'La IA no pudo procesar este contenido. Prueba con otra foto o ajusta la instrucción.',
  too_many_photos: 'Ya se analizaron las 12 fotos que admite cada propiedad con IA.',
  network: 'No hay conexión con el servidor de IA. Revisa tu internet y reintenta.',
};
export const aiMessage = e => AI_MESSAGES[e?.code] || e?.message || 'No se pudo completar la solicitud de IA.';

/* ---------- ficha: datos del formulario -> propiedad ---------- */
export function newPropertyCode(now = Date.now(), rnd = Math.random()) { return `ORN-${(now % 1679616).toString(36).toUpperCase().padStart(4, '0')}${Math.floor(rnd * 1296).toString(36).toUpperCase().padStart(2, '0')}`; }
