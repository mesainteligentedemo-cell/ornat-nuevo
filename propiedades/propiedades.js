import { data, OPERATIONS, PROPERTY_TYPES, PROPERTY_STATUSES } from '/shared/data.js';
import { formatPrice, formatArea, formatBaths, listingJsonLd, whatsappLink } from '/shared/catalog.js';
import { relatedProperties } from '/shared/related.js';
import { specsSectionsHTML, relatedCardsHTML, fichaDocHTML, displayDescription, propertyCode } from '/shared/ficha.js';
import { attachAll } from '/shared/forms.js';
import { config } from '/shared/config.js';
import '/shared/session-bar.js';

const $ = sel => document.querySelector(sel);
if (data().backend().mode === 'supabase') { const foot = document.querySelector('.foot span:last-child'); if (foot) foot.textContent = 'Inventario en vivo desde la base de datos de ORNAT.'; }
const esc =s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BASE = { title: 'Propiedades | ORNAT', description: $('meta[name="description"]').content };

function setMeta(title, description, canonical, image) {
  document.title = title;
  const set = (sel, attr, value) => {
    let el = document.head.querySelector(sel);
    if (!el) { el = document.createElement(sel.startsWith('link') ? 'link' : 'meta'); const [, name, val] = sel.match(/\[(\w+)="([^"]+)"\]/); el.setAttribute(name, val); document.head.append(el); }
    el.setAttribute(attr, value);
  };
  set('meta[name="description"]', 'content', description);
  set('link[rel="canonical"]', 'href', canonical);
  set('meta[property="og:title"]', 'content', title);
  set('meta[property="og:description"]', 'content', description);
  set('meta[property="og:url"]', 'content', canonical);
  set('meta[property="og:type"]', 'content', 'website');
  if (image) set('meta[property="og:image"]', 'content', image);
}

function setJsonLd(obj) {
  document.getElementById('ld-listing')?.remove();
  if (!obj) return;
  const s = document.createElement('script');
  s.type = 'application/ld+json'; s.id = 'ld-listing';
  s.textContent = JSON.stringify(obj).replace(/</g, '\\u003c');
  document.head.append(s);
}


function renderSeedBox() {
  const box = $('#seed-box'); const d = data();
  if (d.properties.list().length) { box.hidden = true; return; }
  const session = d.getSession();
  box.hidden = false;
  if (session && d.can('properties.edit')) {
    box.innerHTML = '<p><strong>Aún no hay propiedades.</strong> Puedes cargar 12 fichas de ejemplo para probar el catálogo; después las quitas desde el Editor o con un clic aquí.</p><button class="btn" type="button" id="seed">Cargar propiedades de ejemplo</button>';
    $('#seed').addEventListener('click', () => { d.properties.seedDemo(); });
  } else {
    const next = encodeURIComponent('/propiedades/');
    box.innerHTML = `<p><strong>Aún no hay propiedades.</strong> ${session ? 'Tu rol no puede cargar propiedades.' : 'Entra con un usuario que pueda editar propiedades para cargar fichas de ejemplo.'}</p><a class="btn dark" href="/cuenta/?next=${next}">${session ? 'Cambiar de usuario' : 'Entrar (demo)'}</a>`;
  }
}

function showList() {
  $('#detail-view').hidden = true; $('#list-view').hidden = false;
  setMeta(BASE.title, BASE.description, location.origin + '/propiedades/');
  setJsonLd(null);
  renderSeedBox(); renderUploadButton();
}

function renderUploadButton() {
  const d = data(); const btn = $('#upload-btn'); if (btn) btn.hidden = !(d.getSession() && d.can('properties.edit'));
}

function detailHTML(p, related, { canEdit = false } = {}) {
  const closed = ['vendido', 'rentado'].includes(p.status);
  const where = [PROPERTY_TYPES[p.type], p.development && p.development !== p.zone ? p.development : '', p.zone, p.city].filter(Boolean).join(' · ');
  const fact = (label, value) => (value ? `<div><dt>${label}</dt><dd>${esc(value)}</dd></div>` : '');
  const imgs = p.images || [];
  const alt = i => esc(p.photoMeta?.[i]?.alt || `${p.title}, foto ${i + 1}`);
  const paras = displayDescription(p).split(/\n{2,}/).map(t => t.trim()).filter(Boolean);
  const map = p.lat !== null && p.lng !== null ? (() => {
    const d = 0.006; const bbox = [p.lng - d, p.lat - d, p.lng + d, p.lat + d].join(',');
    return `<section class="sec"><h2>Ubicación</h2><div class="map"><iframe title="Mapa de ${esc(p.title)}" loading="lazy" referrerpolicy="no-referrer" src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&amp;layer=mapnik&amp;marker=${p.lat},${p.lng}"></iframe></div><a class="map-link" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=${p.lat}&amp;mlon=${p.lng}#map=16/${p.lat}/${p.lng}">Abrir mapa más grande ↗</a></section>`;
  })() : '';
  return `<a class="crumb" href="/propiedades/">← Todas las propiedades</a>
  ${p.draft ? '<p class="notice draft">Borrador: solo lo ves tú porque puedes editar propiedades. No aparece en el catálogo público.</p>' : ''}
  <div class="d-grid">
    <div>
      <div class="gallery"><div class="main" id="g-main">${imgs[0] ? `<img src="${esc(imgs[0])}" alt="${alt(0)}">` : '<div class="none">Sin fotos todavía</div>'}</div>
        ${imgs.length > 1 ? `<div class="thumbs" role="group" aria-label="Fotos">${imgs.map((src, i) => `<button type="button" data-i="${i}" aria-label="Ver foto ${i + 1}" aria-current="${i === 0}"><img src="${esc(src)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}</div>
      <div class="d-head"><span class="chip">${esc(OPERATIONS[p.operation])}</span><span class="chip st-${p.status}">${esc(PROPERTY_STATUSES[p.status])}</span>${p.featured ? '<span class="chip">Destacada</span>' : ''}<span class="chip code">${esc(propertyCode(p))}</span></div>
      <h1 class="d-title">${esc(p.title)}</h1>
      ${p.copy?.subtitle ? `<p class="d-sub">${esc(p.copy.subtitle)}</p>` : ''}
      <p class="where">${esc(where)}</p>
      <dl class="facts">${fact('Construcción', formatArea(p.areaM2))}${fact('Terreno', formatArea(p.lotM2))}${fact('Recámaras', p.bedrooms)}${fact('Baños', formatBaths(p.bathrooms))}${fact('Estacionamientos', p.parking)}${fact('Niveles', p.specs?.levels)}</dl>
      ${paras.length ? `<section class="sec"><h2>Descripción</h2>${paras.map(t => `<p>${esc(t)}</p>`).join('')}</section>` : ''}
      ${p.features.length ? `<section class="sec"><h2>Características</h2><ul class="feat">${p.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul></section>` : ''}
      ${specsSectionsHTML(p)}
      ${map}
    </div>
    <aside class="side" aria-label="Contacto">
      <div class="price">${esc(formatPrice(p.price, p.currency, p.operation))}</div>
      ${p.status === 'apartado' ? '<p class="notice">Esta propiedad está apartada. Escríbenos y te avisamos si se libera o te mostramos opciones parecidas.</p>' : ''}
      ${closed ? `<p class="notice">Esta propiedad ya está ${p.status === 'vendido' ? 'vendida' : 'rentada'}. Déjanos tus datos y te mostramos opciones parecidas.</p>` : ''}
      <form data-ornat-form="propiedad" data-property-id="${esc(p.id)}" data-ornat-status="#f-status" aria-label="Pedir información de ${esc(p.title)}">
        <label>Nombre<input name="name" autocomplete="name" maxlength="150" required></label>
        <label>Correo<input name="email" type="email" autocomplete="email" maxlength="250"></label>
        <label>Teléfono<input name="phone" type="tel" autocomplete="tel" maxlength="80" placeholder="Opcional si dejas correo"></label>
        <label>Mensaje<textarea name="message" maxlength="5000">Hola, me interesa ${esc(p.title)}. ¿Me comparten más información?</textarea></label>
        <button class="btn" type="submit">${closed ? 'Quiero opciones parecidas' : 'Pedir información'}</button>
      </form>
      <p id="f-status" data-ornat-status role="status" aria-live="polite"></p>
      <div class="actions"><a class="btn dark" id="wa" target="_blank" rel="noopener" href="#">WhatsApp</a><button class="btn ghost" type="button" id="share">Compartir</button></div>
      <button class="btn ghost" type="button" id="print-ficha">Ficha técnica en PDF</button>
      ${canEdit ? '<a class="btn ghost" href="/propiedades/subir/">Subir otra con IA</a>' : ''}
      <p class="note">${data().backend().mode === 'supabase' ? 'Tu consulta llega directo al equipo de ORNAT.' : 'Demo: el formulario guarda tu consulta en el CRM de este navegador.'} WhatsApp abre un chat con mensaje prellenado; no se envía nada solo.</p>
    </aside>
  </div>
  ${related.length ? `<section class="similar"><h2>Propiedades relacionadas</h2><p class="rel-note">Ordenadas por afinidad (ciudad, tipo, operación, precio, recámaras y superficie). Pasa el cursor para ver por qué.</p>${relatedCardsHTML(related)}</section>` : ''}`;
}

function showDetail(slug) {
  const d = data(); const p = d.properties.get(slug);
  const canEdit = !!d.getSession() && d.can('properties.edit');
  $('#list-view').hidden = true; const view = $('#detail-view'); view.hidden = false;
  if (!p || (p.draft && !canEdit)) {
    view.innerHTML = '<div class="missing"><h1>No encontramos esta propiedad</h1><p>Puede que ya no esté publicada o que el enlace esté incompleto. (Demo: las propiedades viven en este navegador.)</p><a class="btn" href="/propiedades/">Ver el catálogo</a></div>';
    setMeta('Propiedad no encontrada | ORNAT', BASE.description, location.origin + '/propiedades/'); setJsonLd(null);
    return;
  }
  const related = relatedProperties(p, d.properties.list(), { limit: 6 });
  view.innerHTML = detailHTML(p, related, { canEdit });
  const url = `${location.origin}/propiedades/?p=${encodeURIComponent(p.slug)}`;
  const desc = (p.copy?.seo?.description || p.description || `${PROPERTY_TYPES[p.type]} en ${p.city || p.zone}`).slice(0, 155);
  setMeta(p.copy?.seo?.title ? `${p.copy.seo.title} | ORNAT` : `${p.title} · ${p.city || p.zone} | ORNAT`, `${formatPrice(p.price, p.currency, p.operation)}. ${desc}`, url, p.images[0] && !p.images[0].startsWith('data:') ? new URL(p.images[0], location.origin).href : '');
  setJsonLd(p.draft ? null : listingJsonLd(p, location.origin));
  $('#wa').href = whatsappLink(config.whatsapp, `Hola, me interesa la propiedad "${p.title}" (${url}). ¿Me puedes dar más información?`);
  attachAll(view);
  view.querySelectorAll('.thumbs button').forEach(btn => btn.addEventListener('click', () => {
    const i = Number(btn.dataset.i);
    $('#g-main').innerHTML = `<img src="${esc(p.images[i])}" alt="${esc(p.photoMeta?.[i]?.alt || `${p.title}, foto ${i + 1}`)}">`;
    view.querySelectorAll('.thumbs button').forEach(b => b.setAttribute('aria-current', String(b === btn)));
  }));
  $('#share').addEventListener('click', async () => {
    const status = $('#f-status');
    try {
      if (navigator.share) await navigator.share({ title: p.title, url });
      else { await navigator.clipboard.writeText(url); status.textContent = 'Enlace copiado.'; status.dataset.state = 'saved'; }
    } catch (e) { if (e?.name !== 'AbortError') { status.textContent = `No se pudo compartir. Copia el enlace de la barra de direcciones.`; status.dataset.state = 'error'; } }
  });
  $('#print-ficha').addEventListener('click', async () => {
    const root = $('#print-root'); root.innerHTML = fichaDocHTML(p, { related, origin: location.origin });
    await Promise.all([...root.querySelectorAll('img')].map(i => { i.loading = 'eager'; return Promise.race([i.decode?.().catch(() => {}), new Promise(r => setTimeout(r, 2500))]); }));
    document.body.classList.add('print-ficha');
    addEventListener('afterprint', () => { document.body.classList.remove('print-ficha'); root.innerHTML = ''; }, { once: true });
    window.print();
  });
}

function route() {
  const slug = new URLSearchParams(location.search).get('p');
  if (slug) showDetail(slug); else showList();
}
route();
// El catálogo gestiona sus propios filtros; aquí solo reaccionamos a cambios de propiedades y al botón atrás.
data().subscribe(topic => { if (['properties', 'session', 'all'].includes(topic)) { const slug = new URLSearchParams(location.search).get('p'); if (!slug) { renderSeedBox(); renderUploadButton(); } } });
