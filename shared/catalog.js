// ORNAT · catálogo público de propiedades.
//
// USO
//   <script type="module" src="/shared/catalog.js"></script>
//   <ornat-catalog filters limit="12" operation="venta" type="villa" city="Tulum" featured
//                  detail-base="/propiedades/"></ornat-catalog>
//   atributos: filters (muestra filtros; filters="false" los oculta), limit (tarjetas por página),
//   operation | type | city (preajustes), featured (solo destacadas), detail-base, sync-url="false".
//
//   import { mountCatalog } from '/shared/catalog.js';
//   const catalog = mountCatalog(el, { filters: true, limit: 12, detailBase: '/propiedades/' });
//   catalog.refresh(); catalog.destroy();
//
// Estilos encapsulados en Shadow DOM. Para tomar los colores de la plantilla define en la página o en el elemento:
//   --ornat-catalog-accent (lima #d6f36a) · --ornat-catalog-accent-ink · --ornat-catalog-ink · --ornat-catalog-paper
//   --ornat-catalog-card · --ornat-catalog-line · --ornat-catalog-muted · --ornat-catalog-radius
//   --ornat-catalog-font · --ornat-catalog-display
// Con filters activo, los filtros viven en la URL (?op=venta&tipo=villa&pmax=20000000&orden=precio-asc) y se pueden compartir.
// La lógica pura (parseFilters, filterProperties, sortProperties, formatPrice...) está exportada y probada.
import { data, OPERATIONS, PROPERTY_TYPES, PROPERTY_STATUSES } from './data.js';

/* ---------- lógica pura ---------- */
export const SORTS = { recientes: 'Más recientes', 'precio-asc': 'Precio: menor a mayor', 'precio-desc': 'Precio: mayor a menor', m2: 'Más m²' };
export const DEFAULT_FILTERS = Object.freeze({ operation: '', type: '', city: '', priceMin: null, priceMax: null, bedrooms: null, areaMin: null, status: '', currency: '', q: '', sort: 'recientes', featured: false });
const PARAMS = { operation: 'op', type: 'tipo', city: 'ciudad', priceMin: 'pmin', priceMax: 'pmax', bedrooms: 'rec', areaMin: 'm2', status: 'estado', currency: 'moneda', q: 'q', sort: 'orden' };

export const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const numOrNull = v => { if (v === '' || v === null || v === undefined) return null; const n = Number(String(v).replace(/[,\s$]/g, '')); return Number.isFinite(n) && n >= 0 ? n : null; };

/** querystring -> filtros normalizados (valores desconocidos se ignoran). */
export function parseFilters(search = '', base = {}) {
  const p = new URLSearchParams(search);
  const f = { ...DEFAULT_FILTERS, ...base };
  const op = p.get(PARAMS.operation); if (OPERATIONS[op]) f.operation = op;
  const type = p.get(PARAMS.type); if (PROPERTY_TYPES[type]) f.type = type;
  const status = p.get(PARAMS.status); if (PROPERTY_STATUSES[status]) f.status = status;
  const cur = p.get(PARAMS.currency); if (cur === 'MXN' || cur === 'USD') f.currency = cur;
  const city = p.get(PARAMS.city); if (city) f.city = city.slice(0, 120);
  const q = p.get(PARAMS.q); if (q) f.q = q.slice(0, 120);
  const sort = p.get(PARAMS.sort); if (SORTS[sort]) f.sort = sort;
  for (const key of ['priceMin', 'priceMax', 'bedrooms', 'areaMin']) { const n = numOrNull(p.get(PARAMS[key])); if (n !== null) f[key] = n; }
  return f;
}

/** filtros -> URLSearchParams, partiendo de unos params existentes (conserva los ajenos, p.ej. ?p=). */
export function filtersToQuery(filters, current = '') {
  const p = new URLSearchParams(current);
  for (const [key, name] of Object.entries(PARAMS)) {
    const v = filters[key]; const def = DEFAULT_FILTERS[key];
    if (v === null || v === undefined || v === '' || v === def) p.delete(name); else p.set(name, String(v));
  }
  return p;
}

export const DEFAULT_CATALOG_FILTER_KEYS = Object.keys(PARAMS);

export function filterProperties(list, f = {}) {
  const q = norm(f.q); const city = norm(f.city);
  return list.filter(p => {
    if (f.featured && !p.featured) return false;
    if (f.operation && p.operation !== f.operation) return false;
    if (f.type && p.type !== f.type) return false;
    if (f.status && p.status !== f.status) return false;
    if (f.currency && p.currency !== f.currency) return false;
    if (city && norm(p.city) !== city && norm(p.zone) !== city) return false;
    if (f.priceMin !== null && f.priceMin !== undefined && (p.price === null || p.price < f.priceMin)) return false;
    if (f.priceMax !== null && f.priceMax !== undefined && (p.price === null || p.price > f.priceMax)) return false;
    if (f.bedrooms !== null && f.bedrooms !== undefined && (p.bedrooms === null || p.bedrooms < f.bedrooms)) return false;
    if (f.areaMin !== null && f.areaMin !== undefined && (p.areaM2 === null || p.areaM2 < f.areaMin)) return false;
    if (q && !norm([p.title, p.zone, p.city, p.development, p.description, PROPERTY_TYPES[p.type], ...(p.features || [])].join(' ')).includes(q)) return false;
    return true;
  });
}

export function sortProperties(list, sort = 'recientes') {
  const out = [...list];
  const price = (p, dir) => (p.price === null ? Infinity : p.price * dir);
  const cmp = {
    recientes: (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    'precio-asc': (a, b) => price(a, 1) - price(b, 1),
    'precio-desc': (a, b) => (a.price === null) - (b.price === null) || (b.price ?? 0) - (a.price ?? 0),
    m2: (a, b) => (b.areaM2 ?? -1) - (a.areaM2 ?? -1),
  }[sort] || (() => 0);
  return out.sort((a, b) => { const r = cmp(a, b); return Number.isNaN(r) ? 0 : r; });
}

/** "$18,900,000 MXN" · renta: "$38,000 MXN / mes" · sin precio: "Precio a consultar". */
export function formatPrice(price, currency = 'MXN', operation = 'venta') {
  if (price === null || price === undefined) return 'Precio a consultar';
  const n = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(price);
  return `$${n} ${currency === 'USD' ? 'USD' : 'MXN'}${operation === 'renta' ? ' / mes' : ''}`;
}
export const formatArea = m2 => (m2 === null || m2 === undefined ? '' : `${new Intl.NumberFormat('es-MX').format(m2)} m²`);
export const formatBaths = n => (n === null || n === undefined ? '' : String(n).replace(/\.0$/, ''));

/** Opciones de ciudad/zona presentes en el inventario (únicas, ordenadas). */
export function facets(list) {
  const uniq = key => [...new Map(list.map(p => [norm(p[key]), p[key]]).filter(([k]) => k)).values()].sort((a, b) => a.localeCompare(b, 'es'));
  return { cities: uniq('city'), zones: uniq('zone'), currencies: [...new Set(list.map(p => p.currency))] };
}

export const detailHref = (p, detailBase = '/propiedades/') => `${detailBase}${detailBase.includes('?') ? '&' : '?'}p=${encodeURIComponent(p.slug)}`;

/** Enlace wa.me con mensaje prellenado (el número va en formato internacional sin "+"). */
export const whatsappLink = (number, message) => `https://wa.me/${String(number).replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;

const LD_TYPE = { casa: 'SingleFamilyResidence', villa: 'SingleFamilyResidence', departamento: 'Apartment', terreno: 'Place', lote: 'Place', local: 'Place', oficina: 'Place' };
const LD_AVAIL = { disponible: 'https://schema.org/InStock', apartado: 'https://schema.org/LimitedAvailability', vendido: 'https://schema.org/SoldOut', rentado: 'https://schema.org/SoldOut' };

/** JSON-LD schema.org (RealEstateListing + Offer) para el detalle de una propiedad. */
export function listingJsonLd(p, origin = '', path = '/propiedades/') {
  const abs = u => (/^https?:|^data:/.test(u) ? u : `${origin}${u}`);
  const drop = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)));
  const about = drop({
    '@type': LD_TYPE[p.type] || 'Place',
    name: p.title,
    address: drop({ '@type': 'PostalAddress', addressLocality: p.city, addressRegion: p.zone, addressCountry: 'MX' }),
    geo: p.lat !== null && p.lng !== null ? { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lng } : null,
    floorSize: p.areaM2 !== null ? { '@type': 'QuantitativeValue', value: p.areaM2, unitCode: 'MTK' } : null,
    lotSize: p.lotM2 !== null ? { '@type': 'QuantitativeValue', value: p.lotM2, unitCode: 'MTK' } : null,
    numberOfBedrooms: p.bedrooms, numberOfBathroomsTotal: p.bathrooms,
    amenityFeature: (p.features || []).map(name => ({ '@type': 'LocationFeatureSpecification', name, value: true })),
  });
  return drop({
    '@context': 'https://schema.org', '@type': 'RealEstateListing',
    name: p.title, description: p.description || `${PROPERTY_TYPES[p.type]} en ${p.city || p.zone}`,
    url: `${origin}${path}?p=${encodeURIComponent(p.slug)}`,
    image: (p.images || []).map(abs), datePosted: p.createdAt, dateModified: p.updatedAt,
    about,
    offers: p.price === null ? null : drop({
      '@type': 'Offer', price: p.price, priceCurrency: p.currency, availability: LD_AVAIL[p.status],
      businessFunction: p.operation === 'renta' ? 'http://purl.org/goodrelations/v1#LeaseOut' : 'http://purl.org/goodrelations/v1#Sell',
    }),
  });
}

/* ---------- presentación ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CSS = `
:host{display:block;--a:var(--ornat-catalog-accent,#d6f36a);--ai:var(--ornat-catalog-accent-ink,#20261a);--ink:var(--ornat-catalog-ink,#181a18);--paper:var(--ornat-catalog-paper,#f3f1ea);--card:var(--ornat-catalog-card,#fffefa);--line:var(--ornat-catalog-line,#dedfd5);--muted:var(--ornat-catalog-muted,#5d6058);--r:var(--ornat-catalog-radius,16px);--font:var(--ornat-catalog-font,'DM Sans',Arial,sans-serif);--disp:var(--ornat-catalog-display,Georgia,'Times New Roman',serif);color:var(--ink);font:15px/1.5 var(--font)}
*{box-sizing:border-box}
.bar{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;padding:18px;background:var(--card);border:1px solid var(--line);border-radius:var(--r);margin-bottom:18px}
.bar label{display:grid;gap:5px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600}
.bar .wide{grid-column:span 2}
.bar input,.bar select{font:inherit;font-size:14px;letter-spacing:0;text-transform:none;color:var(--ink);background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:10px 11px;min-height:42px;width:100%}
.bar input:focus-visible,.bar select:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid #66871d;outline-offset:2px}
.bar .pair{display:grid;grid-template-columns:1fr 1fr;gap:8px;grid-column:span 2}.bar label{white-space:nowrap}
.meta{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 14px;color:var(--muted);font-size:14px}
.meta button{font:inherit;font-size:13px;background:none;border:1px solid var(--line);border-radius:99px;padding:7px 14px;color:var(--ink);cursor:pointer}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,290px),1fr));gap:20px;list-style:none;margin:0;padding:0}
.card{position:relative;background:var(--card);border:1px solid var(--line);border-radius:var(--r);overflow:hidden;display:flex;flex-direction:column;transition:transform .2s,box-shadow .2s}
.card:hover{transform:translateY(-3px);box-shadow:0 14px 34px rgba(24,26,24,.12)}
.card.is-closed .photo img{filter:grayscale(.55)}
.photo{position:relative;aspect-ratio:4/3;background:#e4e2d8;overflow:hidden}
.photo img{width:100%;height:100%;object-fit:cover;display:block}
.photo .none{display:grid;place-items:center;height:100%;color:var(--muted);font-size:13px}
.badges{position:absolute;left:12px;top:12px;display:flex;gap:6px;flex-wrap:wrap}
.badge{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:5px 10px;border-radius:99px;background:var(--card);color:var(--ink)}
.badge.op{background:var(--ink);color:#fff}
.badge.st-disponible{background:var(--a);color:var(--ai)}
.badge.st-apartado{background:#f5c04a;color:#3a2a00}
.badge.st-vendido,.badge.st-rentado{background:#2b2d2a;color:#fff}
.body{padding:16px 18px 18px;display:grid;gap:6px}
.price{font:600 24px/1.1 var(--disp);letter-spacing:-.01em}
.title{font-size:16px;font-weight:600;margin:0}
.title a{color:inherit;text-decoration:none}
.title a::after{content:'';position:absolute;inset:0}
.where{color:var(--muted);font-size:14px;margin:0}
.specs{display:flex;gap:14px;flex-wrap:wrap;margin:6px 0 0;padding:10px 0 0;border-top:1px solid var(--line);list-style:none;font-size:13px;color:var(--ink)}
.specs li{display:flex;gap:5px;align-items:baseline}
.specs b{font-weight:700}
.empty{padding:44px 20px;text-align:center;background:var(--card);border:1px dashed var(--line);border-radius:var(--r);color:var(--muted)}
.empty strong{display:block;color:var(--ink);font:600 20px var(--disp);margin-bottom:6px}
.empty button,.more{font:inherit;font-weight:600;background:var(--a);color:var(--ai);border:0;border-radius:99px;padding:12px 24px;cursor:pointer;margin-top:12px}
.footer{text-align:center;margin-top:24px}
.footer a{color:var(--ink);font-weight:600}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
@media (max-width:600px){.bar .wide,.bar .pair{grid-column:auto}.bar{padding:14px}}
@media (prefers-reduced-motion:reduce){.card{transition:none}.card:hover{transform:none}}
`;

function truthy(v, dflt) { if (v === undefined || v === null) return dflt; return !/^(false|0|no|off)$/i.test(String(v)); }

export function mountCatalog(element, options = {}) {
  const opt = { filters: true, limit: 12, featured: false, operation: '', type: '', city: '', detailBase: '/propiedades/', syncUrl: undefined, api: data, ...options };
  const showFilters = truthy(opt.filters, true);
  const sync = truthy(opt.syncUrl, showFilters) && showFilters && !!globalThis.history;
  const pageSize = Math.max(1, Math.min(60, Number(opt.limit) || 12));
  const root = element.shadowRoot || element.attachShadow({ mode: 'open' });
  const preset = { operation: opt.operation, type: opt.type, city: opt.city, featured: opt.featured === '' || opt.featured === true || (typeof opt.featured === 'string' && truthy(opt.featured, false)) };
  let filters = showFilters && sync ? parseFilters(globalThis.location.search, preset) : { ...DEFAULT_FILTERS, ...preset };
  let visible = pageSize;
  let all = [];
  let debounce;

  const load = () => { try { all = opt.api().properties.list().filter(p => !p.draft); }  /* los borradores del alta con IA no se publican */ catch (e) { all = []; root.innerHTML = `<style>${CSS}</style><div class="empty"><strong>No se pudo leer el catálogo</strong>${esc(e.message)}</div>`; return false; } return true; };

  const select = (name, label, options, value, extra = '') => `<label>${label}<select data-f="${name}" ${extra}>${options.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(value ?? '') ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;

  function barHTML() {
    const fx = facets(all);
    const places = [...new Map([...fx.cities, ...fx.zones].map(v => [norm(v), v])).values()].sort((a, b) => a.localeCompare(b, 'es'));
    const bedsOpts = [['', 'Cualquiera'], ...[1, 2, 3, 4, 5].map(n => [n, `${n}+`])];
    return `<form class="bar" role="search" aria-label="Filtros del catálogo" onsubmit="return false">
      <label class="wide">Buscar<input type="search" data-f="q" value="${esc(filters.q)}" placeholder="Nombre, zona, característica…" autocomplete="off"></label>
      ${select('operation', 'Operación', [['', 'Todas'], ...Object.entries(OPERATIONS)], filters.operation)}
      ${select('type', 'Tipo', [['', 'Todos'], ...Object.entries(PROPERTY_TYPES)], filters.type)}
      ${select('city', 'Ciudad / zona', [['', 'Todas'], ...places.map(v => [v, v])], places.find(v => norm(v) === norm(filters.city)) || '')}
      <div class="pair"><label>Precio mín.<input type="number" inputmode="numeric" min="0" step="any" data-f="priceMin" value="${filters.priceMin ?? ''}" placeholder="0"></label><label>Precio máx.<input type="number" inputmode="numeric" min="0" step="any" data-f="priceMax" value="${filters.priceMax ?? ''}" placeholder="Sin tope"></label></div>
      ${select('bedrooms', 'Recámaras', bedsOpts, filters.bedrooms ?? '')}
      <label>m² mínimos<input type="number" inputmode="numeric" min="0" step="any" data-f="areaMin" value="${filters.areaMin ?? ''}" placeholder="0"></label>
      ${select('status', 'Estado', [['', 'Todos'], ...Object.entries(PROPERTY_STATUSES)], filters.status)}
      ${fx.currencies.length > 1 ? select('currency', 'Moneda', [['', 'Todas'], ['MXN', 'MXN'], ['USD', 'USD']], filters.currency) : ''}
      ${select('sort', 'Ordenar por', Object.entries(SORTS), filters.sort)}
    </form>`;
  }

  function cardHTML(p) {
    const closed = p.status === 'vendido' || p.status === 'rentado';
    const img = p.images?.[0];
    const specs = [
      p.areaM2 !== null ? `<li><b>${esc(formatArea(p.areaM2))}</b> construcción</li>` : '',
      p.bedrooms !== null ? `<li><b>${p.bedrooms}</b> rec.</li>` : '',
      p.bathrooms !== null ? `<li><b>${esc(formatBaths(p.bathrooms))}</b> baños</li>` : '',
      p.areaM2 === null && p.lotM2 !== null ? `<li><b>${esc(formatArea(p.lotM2))}</b> terreno</li>` : '',
    ].join('');
    return `<li class="card${closed ? ' is-closed' : ''}"><div class="photo">${img ? `<img src="${esc(img)}" alt="${esc(p.title)}" loading="lazy" decoding="async">` : '<div class="none">Sin imagen</div>'}
      <div class="badges"><span class="badge op">${esc(OPERATIONS[p.operation])}</span><span class="badge st-${p.status}">${esc(PROPERTY_STATUSES[p.status])}</span>${p.featured ? '<span class="badge">Destacada</span>' : ''}</div></div>
      <div class="body"><div class="price">${esc(formatPrice(p.price, p.currency, p.operation))}</div>
      <h3 class="title"><a href="${esc(detailHref(p, opt.detailBase))}">${esc(p.title)}</a></h3>
      <p class="where">${esc([PROPERTY_TYPES[p.type], p.zone, p.city].filter(Boolean).join(' · '))}</p>
      ${specs ? `<ul class="specs">${specs}</ul>` : ''}</div></li>`;
  }

  function listHTML() {
    const matches = sortProperties(filterProperties(all, filters), filters.sort);
    const shown = matches.slice(0, visible);
    const active = JSON.stringify(filters) !== JSON.stringify({ ...DEFAULT_FILTERS, ...preset });
    const count = `<div class="meta"><span role="status" aria-live="polite"><b>${matches.length}</b> ${matches.length === 1 ? 'propiedad' : 'propiedades'}${all.length !== matches.length ? ` de ${all.length}` : ''}</span>${showFilters && active ? '<button type="button" data-clear>Limpiar filtros</button>' : ''}</div>`;
    if (!all.length) return `${count}<div class="empty"><strong>Aún no hay propiedades publicadas</strong>${data().backend().mode === 'supabase' ? 'Vuelve pronto: el inventario se actualiza en cuanto el equipo publica.' : 'Demo: el catálogo lee las propiedades guardadas en este navegador.'}</div>`;
    if (!matches.length) return `${count}<div class="empty"><strong>Sin resultados</strong>Ninguna propiedad cumple esos filtros. Prueba ampliando el precio o quitando algún filtro.${showFilters ? '<br><button type="button" data-clear>Limpiar filtros</button>' : ''}</div>`;
    const rest = matches.length - shown.length;
    const foot = rest > 0 ? (showFilters ? `<div class="footer"><button class="more" type="button" data-more>Ver más (${rest})</button></div>` : `<div class="footer"><a href="${esc(opt.detailBase)}">Ver todo el catálogo (${matches.length})</a></div>`) : '';
    return `${count}<ul class="grid">${shown.map(cardHTML).join('')}</ul>${foot}`;
  }

  function renderList() { root.querySelector('[data-list]').innerHTML = listHTML(); }
  function renderAll() {
    if (!load()) return;
    root.innerHTML = `<style>${CSS}</style>${showFilters ? barHTML() : ''}<div data-list></div>`;
    renderList();
  }

  function pushUrl() {
    if (!sync) return;
    const params = filtersToQuery(filters, globalThis.location.search);
    // los preajustes de la plantilla no se escriben en la URL si siguen igual
    for (const [k, v] of Object.entries(preset)) if (v && filters[k] === v) params.delete(PARAMS[k]);
    const qs = params.toString();
    globalThis.history.replaceState(null, '', `${globalThis.location.pathname}${qs ? `?${qs}` : ''}${globalThis.location.hash}`);
  }

  const readControl = el => {
    const key = el.dataset.f; const v = el.value;
    if (['priceMin', 'priceMax', 'bedrooms', 'areaMin'].includes(key)) filters[key] = numOrNull(v);
    else filters[key] = v;
  };
  const onInput = e => {
    const el = e.target.closest?.('[data-f]'); if (!el) return;
    clearTimeout(debounce);
    const apply = () => { if (!el.isConnected) return; readControl(el); visible = pageSize; pushUrl(); renderList(); };
    if (el.tagName === 'SELECT') apply(); else debounce = setTimeout(apply, 180);
  };
  const onClick = e => {
    if (e.target.closest('[data-more]')) { visible += pageSize; renderList(); root.querySelectorAll('.card')[visible - pageSize]?.querySelector('a')?.focus({ preventScroll: true }); }
    if (e.target.closest('[data-clear]')) { clearTimeout(debounce); filters = { ...DEFAULT_FILTERS, ...preset }; visible = pageSize; pushUrl(); renderAll(); }
  };
  const onPop = () => { if (!sync) return; filters = parseFilters(globalThis.location.search, preset); visible = pageSize; renderAll(); };

  root.addEventListener('input', onInput);
  root.addEventListener('change', onInput);
  root.addEventListener('click', onClick);
  globalThis.addEventListener?.('popstate', onPop);
  const unsub = opt.api().subscribe(topic => { if (topic === 'properties' || topic === 'all') refresh(); });

  function refresh() {
    // conserva el foco y el texto si el usuario está escribiendo en un filtro
    const active = root.activeElement?.dataset?.f;
    if (!load()) return;
    if (showFilters) { const bar = root.querySelector('.bar'); if (!bar) return renderAll(); if (!active) bar.outerHTML = barHTML(); }
    renderList();
  }

  renderAll();
  return {
    refresh, get filters() { return { ...filters }; },
    destroy() { unsub(); root.removeEventListener('input', onInput); root.removeEventListener('change', onInput); root.removeEventListener('click', onClick); globalThis.removeEventListener?.('popstate', onPop); root.innerHTML = ''; },
  };
}

if (globalThis.customElements && globalThis.HTMLElement && !customElements.get('ornat-catalog')) {
  class OrnatCatalog extends HTMLElement {
    static observedAttributes = ['filters', 'limit', 'operation', 'type', 'city', 'featured', 'detail-base', 'sync-url'];
    connectedCallback() { this.#mount(); }
    disconnectedCallback() { this.#handle?.destroy(); this.#handle = null; }
    attributeChangedCallback() { if (this.isConnected && this.#handle) { this.#handle.destroy(); this.#mount(); } }
    refresh() { this.#handle?.refresh(); }
    #handle = null;
    #mount() {
      const a = n => this.getAttribute(n);
      this.#handle = mountCatalog(this, {
        filters: this.hasAttribute('filters') ? truthy(a('filters') || 'true', true) : false,
        limit: a('limit') || 12, operation: a('operation') || '', type: a('type') || '', city: a('city') || '',
        featured: this.hasAttribute('featured') ? (a('featured') === '' ? true : truthy(a('featured'), true)) : false,
        detailBase: a('detail-base') || '/propiedades/', syncUrl: a('sync-url') ?? undefined,
      });
    }
  }
  customElements.define('ornat-catalog', OrnatCatalog);
}
