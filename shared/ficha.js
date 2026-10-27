// ORNAT · ficha técnica de propiedad. Funciones puras que devuelven HTML (con escape) para:
//   - el paso 5 del alta con IA (/propiedades/subir/)
//   - la ficha pública (/propiedades/?p=slug): secciones en pantalla + documento imprimible/PDF
// Estilos: /shared/ficha.css (incluye @media print con A4).
import { PROPERTY_TYPES, OPERATIONS, PROPERTY_STATUSES, SPACES } from './data.js';
import { formatPrice, formatArea, formatBaths, detailHref } from './catalog.js';
import { explain } from './related.js';
import { spaceSummary } from './property-ai.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const paragraphs = text => String(text ?? '').split(/\n{2,}/).map(t => t.trim()).filter(Boolean);
const dateEs = (d = new Date()) => new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' }).format(d);

export const propertyCode = p => p.specs?.code || `ORN-${String(p.id).replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase()}`;
export const displayDescription = p => p.copy?.long || p.description || '';

export function ageLabel(specs) { if (specs?.newBuild) return 'A estrenar'; return specs?.ageYears === null || specs?.ageYears === undefined ? '' : specs.ageYears === 0 ? 'Menos de 1 año' : `${specs.ageYears} año${specs.ageYears === 1 ? '' : 's'}`; }

/** Filas "etiqueta -> valor" de los datos generales; omite lo que no se sabe. */
export function dataRows(p) {
  const s = p.specs || {};
  const fee = s.maintenanceFee ? `${new Intl.NumberFormat('es-MX').format(s.maintenanceFee)} ${s.maintenanceCurrency || 'MXN'} al mes` : '';
  return [
    ['Tipo', PROPERTY_TYPES[p.type]], ['Operación', OPERATIONS[p.operation]], ['Estado', PROPERTY_STATUSES[p.status]],
    ['Desarrollo', p.development], ['Niveles', s.levels], ['Antigüedad', ageLabel(s)], ['Orientación', s.orientation],
    ['Amueblado', s.furnished], ['Entrega', s.delivery], ['Mantenimiento', fee],
  ].filter(([, v]) => v !== null && v !== undefined && v !== '');
}

export function factsList(p) {
  const s = p.specs || {};
  return [['Construcción', formatArea(p.areaM2)], ['Terreno', formatArea(p.lotM2)], ['Recámaras', p.bedrooms], ['Baños', formatBaths(p.bathrooms)], ['Estacionamientos', p.parking], ['Niveles', s.levels]]
    .filter(([, v]) => v !== null && v !== undefined && v !== '');
}

const amenitiesOf = p => (p.specs?.amenities?.length ? p.specs.amenities : p.features || []);
const chips = (items, cls = 'fd-chip') => (items.length ? `<ul class="fd-chips">${items.map(i => `<li class="${cls}">${esc(i)}</li>`).join('')}</ul>` : '');

export function mapHTML(p, { print = false } = {}) {
  if (p.lat === null || p.lng === null || p.lat === undefined) return '';
  const d = 0.006; const bbox = [p.lng - d, p.lat - d, p.lng + d, p.lat + d].join(',');
  const link = `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=16/${p.lat}/${p.lng}`;
  return `<div class="fd-map"><iframe title="Mapa de ${esc(p.title)}" loading="lazy" referrerpolicy="no-referrer" src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&amp;layer=mapnik&amp;marker=${p.lat},${p.lng}"></iframe></div>
  <p class="fd-coords">Coordenadas: ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)} · <a target="_blank" rel="noopener" href="${esc(link)}">Abrir en OpenStreetMap ↗</a></p>`;
}

export function relatedCardsHTML(related, { detailBase = '/propiedades/' } = {}) {
  if (!related?.length) return '';
  return `<ul class="fd-related">${related.map(r => {
    const p = r.property; const why = explain(r);
    return `<li><a class="fd-rel" href="${esc(detailHref(p, detailBase))}" data-why="${esc(why)}" aria-label="${esc(`${p.title}. ${formatPrice(p.price, p.currency, p.operation)}. ${why}`)}">
      <span class="fd-rel-img">${p.images?.[0] ? `<img src="${esc(p.images[0])}" alt="" loading="lazy" decoding="async">` : ''}<b class="fd-score">${r.score} %</b></span>
      <span class="fd-rel-body"><span class="fd-rel-price">${esc(formatPrice(p.price, p.currency, p.operation))}</span><span class="fd-rel-title">${esc(p.title)}</span><span class="fd-rel-where">${esc([PROPERTY_TYPES[p.type], p.zone || p.city].filter(Boolean).join(' · '))}</span></span></a></li>`;
  }).join('')}</ul>`;
}

/** Secciones de la ficha pública en pantalla (sin portada ni precio: esas ya están en el detalle). */
export function specsSectionsHTML(p) {
  const s = p.specs || {};
  const dist = spaceSummary((p.photoMeta || []).map(m => ({ space: m.space }))).filter(x => x.space !== 'otro' || (p.photoMeta || []).length === x.count);
  const rows = dataRows(p);
  const parts = [];
  if (p.copy?.highlights?.length) parts.push(`<section class="sec"><h2>Puntos destacados</h2><ul class="fd-high">${p.copy.highlights.map(h => `<li>${esc(h)}</li>`).join('')}</ul></section>`);
  if (rows.length) parts.push(`<section class="sec"><h2>Ficha técnica</h2><dl class="fd-rows">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>`);
  if (dist.length) parts.push(`<section class="sec"><h2>Espacios en la galería</h2>${chips(dist.map(x => `${x.label} · ${x.count}`))}</section>`);
  if (s.finishes?.length) parts.push(`<section class="sec"><h2>Acabados y materiales</h2>${chips(s.finishes)}</section>`);
  if (s.services?.length) parts.push(`<section class="sec"><h2>Servicios</h2>${chips(s.services)}</section>`);
  if (s.priceConditions) parts.push(`<section class="sec"><h2>Condiciones</h2><p>${esc(s.priceConditions)}</p></section>`);
  return parts.join('');
}

/** Documento completo de la ficha (A4, una o dos páginas al imprimir). */
export function fichaDocHTML(p, { related = [], images = p.images || [], origin = '', now = new Date() } = {}) {
  const s = p.specs || {};
  const meta = p.photoMeta || [];
  const where = [p.development && p.development !== p.zone ? p.development : '', p.zone, p.city].filter(Boolean).join(' · ');
  const facts = factsList(p);
  const rows = dataRows(p);
  const dist = spaceSummary(meta.map(m => ({ space: m.space })));
  const amen = amenitiesOf(p);
  const body = paragraphs(displayDescription(p));
  const galleryImgs = images.slice(1, 7);
  const url = origin ? `${origin}/propiedades/?p=${encodeURIComponent(p.slug)}` : '';
  const col = (title, inner) => (inner ? `<section class="fd-col"><h3>${esc(title)}</h3>${inner}</section>` : '');

  return `<article class="fd" aria-label="Ficha técnica de ${esc(p.title)}">
  <section class="fd-page fd-p1">
    <header class="fd-head"><span class="fd-brand">ORNAT</span><span class="fd-code">Ficha técnica · <b>${esc(propertyCode(p))}</b><br><small>${esc(dateEs(now))}</small></span></header>
    <figure class="fd-cover">${images[0] ? `<img src="${esc(images[0])}" alt="${esc(meta[0]?.alt || p.title)}">` : '<div class="fd-noimg">Sin fotos</div>'}</figure>
    <div class="fd-titlebar">
      <div><p class="fd-kicker">${esc(PROPERTY_TYPES[p.type])} · ${esc(OPERATIONS[p.operation])}${p.status !== 'disponible' ? ` · ${esc(PROPERTY_STATUSES[p.status])}` : ''}</p>
      <h1 class="fd-title">${esc(p.copy?.title || p.title)}</h1>
      ${p.copy?.subtitle ? `<p class="fd-sub">${esc(p.copy.subtitle)}</p>` : ''}
      ${where ? `<p class="fd-where">${esc(where)}</p>` : ''}</div>
      <p class="fd-price">${esc(formatPrice(p.price, p.currency, p.operation))}</p>
    </div>
    ${facts.length ? `<dl class="fd-facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
    ${body.length ? `<div class="fd-text">${body.map(t => `<p>${esc(t)}</p>`).join('')}</div>` : ''}
    ${p.copy?.highlights?.length ? `<ul class="fd-high">${p.copy.highlights.map(h => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
  </section>
  <section class="fd-page fd-p2">
    ${galleryImgs.length ? `<div class="fd-gallery">${galleryImgs.map((src, i) => `<figure><img src="${esc(src)}" alt="${esc(meta[i + 1]?.alt || `${p.title}, foto ${i + 2}`)}"><figcaption>${esc(SPACES[meta[i + 1]?.space] && meta[i + 1]?.space !== 'otro' ? SPACES[meta[i + 1].space] : `Foto ${i + 2}`)}</figcaption></figure>`).join('')}</div>` : ''}
    <div class="fd-cols">
      ${col('Datos de la propiedad', rows.length ? `<dl class="fd-rows">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : '')}
      ${col('Distribución por espacios', dist.length ? chips(dist.map(x => `${x.label} · ${x.count} foto${x.count === 1 ? '' : 's'}`)) : '')}
      ${col('Amenidades', chips(amen))}
      ${col('Acabados y materiales', chips(s.finishes || []))}
      ${col('Servicios', chips(s.services || []))}
      ${col('Precio y condiciones', `<p class="fd-bigprice">${esc(formatPrice(p.price, p.currency, p.operation))}</p>${s.priceConditions ? `<p>${esc(s.priceConditions)}</p>` : '<p class="fd-muted">Condiciones por confirmar con el asesor.</p>'}`)}
    </div>
    ${p.lat !== null && p.lat !== undefined && p.lng !== null && p.lng !== undefined ? `<section class="fd-loc"><h3>Ubicación</h3>${mapHTML(p)}</section>` : ''}
    ${related.length ? `<section class="fd-rel-sec"><h3>Propiedades relacionadas</h3>${relatedCardsHTML(related.slice(0, 6))}</section>` : ''}
    <footer class="fd-foot"><span><b>ORNAT</b> · Riviera Maya, Cancún y Mérida</span><span>${url ? esc(url) : esc(propertyCode(p))}</span><span class="fd-legal">Información sujeta a cambios sin previo aviso. Superficies y características por confirmar con documentos oficiales.</span></footer>
  </section>
</article>`;
}
