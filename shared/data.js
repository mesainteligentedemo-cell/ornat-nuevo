// ORNAT shared data layer. Demo mode keeps everything in this browser (localStorage).
// CMS, CRM and the public site all go through this API so a Supabase adapter can replace
// the storage later without touching the screens. Contract: see the exports below.
// Modo conectado (shared/remote-boot.js devuelve un objeto): la misma API síncrona sobre un espejo de Supabase.
import { remote } from './remote-boot.js';

export const ROLES = { owner: 'Dueño', editor: 'Editor', sales: 'Vendedor', client: 'Cliente' };
const PERMISSIONS = {
  owner: ['*'],
  editor: ['cms.view', 'cms.edit', 'cms.publish', 'cms.comment', 'properties.view', 'properties.edit', 'crm.view'],
  sales: ['crm.view', 'crm.edit', 'properties.view', 'properties.status', 'cms.view', 'cms.comment'],
  client: ['cms.view', 'cms.comment', 'cms.approve'],
};
export const PROPERTY_TYPES = { casa: 'Casa', departamento: 'Departamento', villa: 'Villa', terreno: 'Terreno', local: 'Local comercial', oficina: 'Oficina', lote: 'Lote en desarrollo' };
export const OPERATIONS = { venta: 'Venta', renta: 'Renta', preventa: 'Preventa' };
export const PROPERTY_STATUSES = { disponible: 'Disponible', apartado: 'Apartado', vendido: 'Vendido', rentado: 'Rentado' };

const KEY = 'ornat-data-v1';
const SESSION_KEY = 'ornat-session-v1';
const MAX_BYTES = 4 * 1024 * 1024;
const CHANNEL = 'ornat-data';
const DEMO_PROPERTY_MEDIA = Object.freeze({
  'Villa Tankah': 'property-villa-tankah',
  'Residencia Aldea Zamá 12': 'property-aldea-zama',
  'Departamento Lumina 304': 'property-lumina-304',
  'Penthouse Coral 1201': 'property-coral-1201',
  'Lote Selvanova 45': 'property-selvanova-45',
  'Casa Patio Mérida': 'property-patio-merida',
  'Loft Quinta 18': 'property-loft-quinta',
  'Local Plaza Andara': 'property-plaza-andara',
  'Villa Akumal Reef': 'property-akumal-reef',
  'Oficina Torre Malecón 7B': 'property-malecon-7b',
  'Residencia Bacalar Lagoon': 'property-bacalar-lagoon',
  'Departamento Arena 502': 'property-arena-502',
});
const LEGACY_DEMO_MEDIA = new Set(['/img/r0202.webp', '/img/r0306.webp', '/img/r02.webp', '/img/r17.webp', '/img/x01.webp', '/img/x04.webp', '/img/x15.webp', '/img/x24.webp']);
const DEMO_PROPERTY_MEDIA_VERSIONS = Object.freeze({
  "/img/gpt-properties-demo/property-akumal-reef-primary.webp": "maroma-6db3e30019fe",
  "/img/gpt-properties-demo/property-akumal-reef-secondary.webp": "maroma-7529ea8edefe",
  "/img/gpt-properties-demo/property-bacalar-lagoon-primary.webp": "maroma-dca124da7a52",
  "/img/gpt-properties-demo/property-bacalar-lagoon-secondary.webp": "maroma-d9e9db24c976",
  "/img/gpt-properties-demo/property-coral-1201-primary.webp": "maroma-46d4ac9760de",
  "/img/gpt-properties-demo/property-coral-1201-secondary.webp": "maroma-e43dd7338051",
  "/img/gpt-properties-demo/property-malecon-7b-primary.webp": "maroma-13b101581fe3",
  "/img/gpt-properties-demo/property-malecon-7b-secondary.webp": "maroma-58ab1adb4a18",
  "/img/gpt-properties-demo/property-villa-tankah-primary.webp": "maroma-1ffae8a93e4c",
  "/img/gpt-properties-demo/property-villa-tankah-secondary.webp": "maroma-6303adc0767d"
});
const demoImages = title => Object.hasOwn(DEMO_PROPERTY_MEDIA, title)
  ? ['primary', 'secondary'].map(view => { const path = `/img/gpt-properties-demo/${DEMO_PROPERTY_MEDIA[title]}-${view}.webp`; return DEMO_PROPERTY_MEDIA_VERSIONS[path] ? `${path}?v=${DEMO_PROPERTY_MEDIA_VERSIONS[path]}` : path; })
  : null;

export const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const text = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
const int = (value, { min = 0, max = 1e12 } = {}) => {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error('Un valor numérico no es válido.');
  return Math.round(n);
};
const num = (value, { min = -1e9, max = 1e9 } = {}) => {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error('Un valor numérico no es válido.');
  return n;
};
const iso = value => (value && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : new Date().toISOString());
const slugify = value => text(value, 120).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'propiedad';
function checkKeys(value, depth = 0) {
  if (depth > 10) throw new Error('Datos con demasiados niveles.');
  if (!isObject(value) && !Array.isArray(value)) return;
  for (const [key, item] of Object.entries(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Clave no permitida.');
    checkKeys(item, depth + 1);
  }
}
export function safeMediaURL(value) {
  const v = String(value ?? '').trim();
  if (/^data:image\/(png|jpe?g|webp|avif);base64,[a-z0-9+/=]+$/i.test(v)) return v.length <= 1_500_000;
  if (/^\/(?!\/)[^\s"'<>\\]*$/.test(v)) return true;
  try { const u = new URL(v); return u.protocol === 'https:' && !/[\s"'<>\\]/.test(v); } catch { return false; }
}

export function cleanUser(input) {
  if (!isObject(input)) throw new Error('Usuario no válido.');
  const email = text(input.email, 250).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Escribe un correo válido.');
  const role = ROLES[input.role] ? input.role : 'editor';
  return { id: text(input.id || uid(), 100), name: text(input.name, 120) || email.split('@')[0], email, role, createdAt: iso(input.createdAt) };
}

// Espacios que reconoce el alta con IA (clave sin acentos -> etiqueta). Claves estables: se guardan en photoMeta[].space.
export const SPACES = { sala: 'Sala', comedor: 'Comedor', cocina: 'Cocina', recamara: 'Recámara', bano: 'Baño', fachada: 'Fachada', jardin: 'Jardín', alberca: 'Alberca', terraza: 'Terraza', vista: 'Vista', amenidad: 'Amenidad', plano: 'Plano', otro: 'Otro' };

const list = (value, max, len = 60) => (Array.isArray(value) ? value : String(value ?? '').split(','))
  .map(v => text(v, len)).filter(Boolean).slice(0, max);

// Bloque de copy (español o inglés). Todo opcional; devuelve null si no hay nada.
function cleanCopyBlock(c) {
  if (!isObject(c)) return null;
  const seo = isObject(c.seo) ? { title: text(c.seo.title, 120), description: text(c.seo.description, 300) } : { title: '', description: '' };
  const block = {
    title: text(c.title, 160), subtitle: text(c.subtitle, 240), long: text(c.long, 8000), short: text(c.short, 600),
    highlights: list(c.highlights, 12, 200), seo, instagram: text(c.instagram, 2200), whatsapp: text(c.whatsapp, 1500),
    toConfirm: list(c.toConfirm, 20, 300),
  };
  const empty = !block.title && !block.long && !block.short && !block.highlights.length && !block.instagram && !block.whatsapp;
  return empty ? null : block;
}
function cleanCopy(c) {
  const block = cleanCopyBlock(c);
  if (!block) return null;
  return { ...block, source: ['ai', 'template', 'manual'].includes(c.source) ? c.source : 'manual', en: cleanCopyBlock(c.en), generatedAt: c.generatedAt ? iso(c.generatedAt) : '' };
}

// Ficha técnica extendida. services/finishes/amenities son listas cortas de texto libre.
function cleanSpecs(s) {
  const x = isObject(s) ? s : {};
  return {
    code: text(x.code, 24).toUpperCase(),
    levels: int(x.levels, { max: 200 }), ageYears: int(x.ageYears, { max: 1000 }), newBuild: x.newBuild === true,
    orientation: text(x.orientation, 60), furnished: text(x.furnished, 40), delivery: text(x.delivery, 60),
    maintenanceFee: int(x.maintenanceFee), maintenanceCurrency: x.maintenanceCurrency === 'USD' ? 'USD' : 'MXN',
    services: list(x.services, 30), finishes: list(x.finishes, 30, 80), amenities: list(x.amenities, 40, 80),
    priceConditions: text(x.priceConditions, 600),
  };
}

// photoMeta[i] describe images[i] (mismo índice). `src` solo se conserva si NO es data: (así no se duplica la foto en el almacenamiento).
function cleanPhotoMeta(m) {
  const x = isObject(m) ? m : {};
  const quality = (Array.isArray(x.quality) ? x.quality : []).map(q => (isObject(q) ? { issue: text(q.issue, 40), suggestion: text(q.suggestion, 300) } : { issue: text(q, 40), suggestion: '' })).filter(q => q.issue).slice(0, 8);
  const src = typeof x.src === 'string' && !x.src.startsWith('data:') && safeMediaURL(x.src) ? x.src : '';
  return { src, space: SPACES[x.space] ? x.space : 'otro', alt: text(x.alt, 300), quality };
}

export function cleanProperty(input) {
  if (!isObject(input)) throw new Error('Propiedad no válida.');
  const title = text(input.title, 160);
  if (!title) throw new Error('La propiedad necesita un nombre.');
  const type = PROPERTY_TYPES[input.type] ? input.type : 'casa';
  const operation = OPERATIONS[input.operation] ? input.operation : 'venta';
  const status = PROPERTY_STATUSES[input.status] ? input.status : 'disponible';
  const providedImages = Array.isArray(input.images) ? input.images : [];
  const expectedDemoImages = demoImages(title);
  const canonicalDemoPath = value => {
    if (typeof value !== 'string' || !value.startsWith('/img/gpt-properties-demo/')) return null;
    try {
      const parsed = new URL(value, 'https://ornat-nuevo.vercel.app');
      if (parsed.hash || [...parsed.searchParams.keys()].some(key => key !== 'v')) return null;
      return parsed.pathname;
    } catch { return null; }
  };
  const exactDemoPair = expectedDemoImages && providedImages.length === 2 && providedImages.every((url, index) => canonicalDemoPath(url) === canonicalDemoPath(expectedDemoImages[index]));
  const stockPair = input.source === 'demo' && providedImages.length === 2 && (providedImages.every(url => LEGACY_DEMO_MEDIA.has(url)) || exactDemoPair);
  const rawImages = (stockPair && demoImages(title)) || providedImages;
  const images = [], keep = [];
  rawImages.forEach((u, i) => { if (images.length < 12 && safeMediaURL(u)) { images.push(u); keep.push(i); } });
  const rawMeta = Array.isArray(input.photoMeta) ? input.photoMeta : [];
  const photoMeta = images.map((_, k) => cleanPhotoMeta(rawMeta[keep[k]]));
  const features = (Array.isArray(input.features) ? input.features : String(input.features || '').split(','))
    .map(f => text(f, 60)).filter(Boolean).slice(0, 30);
  const leadIds = (Array.isArray(input.leadIds) ? input.leadIds : []).map(id => text(id, 200)).filter(Boolean).slice(0, 500);
  return {
    id: text(input.id || uid(), 100),
    slug: slugify(input.slug || title),
    title, type, operation, status,
    price: int(input.price), currency: input.currency === 'USD' ? 'USD' : 'MXN',
    areaM2: int(input.areaM2, { max: 1e7 }), lotM2: int(input.lotM2, { max: 1e8 }),
    bedrooms: int(input.bedrooms, { max: 100 }), bathrooms: num(input.bathrooms, { min: 0, max: 100 }), parking: int(input.parking, { max: 100 }),
    development: text(input.development, 120), zone: text(input.zone, 120), city: text(input.city, 120),
    description: text(input.description, 8000), features, images, leadIds,
    lat: num(input.lat, { min: -90, max: 90 }), lng: num(input.lng, { min: -180, max: 180 }),
    featured: input.featured === true,
    copy: cleanCopy(input.copy), photoMeta, specs: cleanSpecs(input.specs),
    draft: input.draft === true, aiGenerated: input.aiGenerated === true,
    source: ['manual', 'demo', 'csv', 'ai'].includes(input.source) ? input.source : 'manual',
    createdAt: iso(input.createdAt), updatedAt: iso(input.updatedAt),
  };
}

export function cleanIntake(input) {
  if (!isObject(input)) throw new Error('Formulario no válido.');
  const email = text(input.email, 250).toLowerCase();
  const phone = text(input.phone, 80);
  if (!email && !phone) throw new Error('Escribe un correo o un teléfono.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Escribe un correo válido.');
  return {
    id: text(input.id || uid(), 100), name: text(input.name, 150), email, phone, message: text(input.message, 5000),
    page: text(input.page, 500), form: text(input.form, 120), propertyId: text(input.propertyId, 100),
    utm: isObject(input.utm) ? Object.fromEntries(['source', 'medium', 'campaign', 'term', 'content'].map(k => [k, text(input.utm[k], 200)]).filter(([, v]) => v)) : {},
    receivedAt: iso(input.receivedAt),
  };
}

const emptyState = () => ({ version: 1, users: [], properties: [], intake: [], audit: [] });
function validate(input) {
  checkKeys(input);
  if (!isObject(input)) throw new Error('Datos locales dañados.');
  return {
    version: 1,
    users: (input.users || []).slice(0, 200).map(cleanUser),
    properties: (input.properties || []).slice(0, 2000).map(cleanProperty),
    intake: (input.intake || []).slice(-2000).map(cleanIntake),
    audit: (input.audit || []).slice(0, 3000).map(a => ({ id: text(a.id || uid(), 100), at: iso(a.at), actor: text(a.actor, 250), action: text(a.action, 300), detail: text(a.detail, 1000), area: text(a.area, 40) })),
  };
}

function memoryStorage() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }

export function createData(storage = globalThis.localStorage || memoryStorage()) {
  const listeners = new Set();
  const channel = globalThis.BroadcastChannel ? new BroadcastChannel(CHANNEL) : null;
  const emit = (topic, origin = 'local') => { for (const fn of listeners) { try { fn(topic); } catch {} } if (origin === 'local') channel?.postMessage({ topic }); };
  if (channel) { channel.onmessage = e => emit(e.data?.topic || 'all', 'remote'); channel.unref?.(); }
  globalThis.addEventListener?.('storage', e => { if (e.key === KEY || e.key === SESSION_KEY) emit('all', 'remote'); });

  const read = () => { const raw = storage.getItem(KEY); if (!raw) return emptyState(); try { return validate(JSON.parse(raw)); } catch (error) { throw new Error(`No se pudieron leer los datos guardados: ${error.message}`); } };
  const write = state => {
    const json = JSON.stringify(validate(state));
    if (new TextEncoder().encode(json).byteLength > MAX_BYTES) throw new Error('Los datos superan 4 MB en este navegador. Usa imágenes por URL o más ligeras.');
    try { storage.setItem(KEY, json); } catch (error) { throw error?.ornatRemote ? error : new Error('El navegador no permitió guardar (espacio lleno o bloqueado).'); }
  };
  const mutate = (topic, fn, action, detail = '', area = topic) => {
    const state = read(); const result = fn(state);
    if (action) state.audit.unshift({ id: uid(), at: new Date().toISOString(), actor: getSession()?.user?.email || 'invitado', action, detail: String(detail).slice(0, 1000), area });
    state.audit = state.audit.slice(0, 3000);
    write(state); emit(topic); return result;
  };

  function getSession() { try { const raw = storage.getItem(SESSION_KEY); if (!raw) return null; const s = JSON.parse(raw); if (!s?.user) return null; const stored = cleanUser(s.user); const live = read().users.find(u => u.email === stored.email); return live ? { user: live, since: iso(s.since) } : null; } catch { return null; } } // el rol sale SIEMPRE de la lista de usuarios: si cambia o se elimina, la sesión lo refleja
  function signIn({ name, email, role }) {
    const user = cleanUser({ name, email, role });
    const state = read(); const existing = state.users.find(u => u.email === user.email);
    if (!existing) { if (!state.users.length) user.role = 'owner'; mutate('users', s => { s.users.push(user); }, 'Alta de usuario', `${user.email} · ${ROLES[user.role]}`, 'auth'); }
    const final = existing || user;
    storage.setItem(SESSION_KEY, JSON.stringify({ user: final, since: new Date().toISOString() }));
    mutate('session', () => {}, 'Inicio de sesión', final.email, 'auth');
    return { user: final };
  }
  function signOut() { const s = getSession(); storage.removeItem(SESSION_KEY); if (s) mutate('session', () => {}, 'Cierre de sesión', s.user.email, 'auth'); else emit('session'); }
  function can(action, session = getSession()) {
    if (!session) return false;
    const perms = PERMISSIONS[session.user.role] || [];
    return perms.includes('*') || perms.includes(action) || perms.includes(action.split('.')[0] + '.*');
  }

  const users = {
    list: () => read().users,
    save(input) { const user = cleanUser(input); mutate('users', s => { const i = s.users.findIndex(u => u.id === user.id || u.email === user.email); if (i >= 0) s.users[i] = { ...s.users[i], ...user, id: s.users[i].id, createdAt: s.users[i].createdAt || user.createdAt, name: String(input?.name ?? '').trim() ? user.name : s.users[i].name }; else s.users.push(user); }, 'Guardar usuario', `${user.email} · ${ROLES[user.role]}`, 'auth'); return user; },
    remove(id) { mutate('users', s => { const owners = s.users.filter(u => u.role === 'owner'); const target = s.users.find(u => u.id === id); if (target?.role === 'owner' && owners.length === 1) throw new Error('Debe quedar al menos un dueño.'); s.users = s.users.filter(u => u.id !== id); }, 'Eliminar usuario', id, 'auth'); },
  };

  const properties = {
    list: () => read().properties,
    get: id => read().properties.find(p => p.id === id || p.slug === id) || null,
    save(input) {
      const property = cleanProperty({ ...input, updatedAt: new Date().toISOString() });
      mutate('properties', s => {
        const i = s.properties.findIndex(p => p.id === property.id);
        let slug = property.slug, n = 1;
        while (s.properties.some(p => p.slug === slug && p.id !== property.id)) slug = `${property.slug}-${++n}`;
        property.slug = slug;
        if (i >= 0) s.properties[i] = { ...property, createdAt: s.properties[i].createdAt }; else s.properties.push(property);
      }, input.id ? 'Editar propiedad' : 'Crear propiedad', property.title, 'properties');
      return property;
    },
    setStatus(id, status) { if (!PROPERTY_STATUSES[status]) throw new Error('Estado no válido.'); return mutate('properties', s => { const p = s.properties.find(x => x.id === id); if (!p) throw new Error('La propiedad no existe.'); p.status = status; p.updatedAt = new Date().toISOString(); return p; }, 'Cambiar estado de propiedad', `${id} → ${PROPERTY_STATUSES[status]}`, 'properties'); },
    linkLead(id, leadId, linked = true) { return mutate('properties', s => { const p = s.properties.find(x => x.id === id); if (!p) throw new Error('La propiedad no existe.'); p.leadIds = linked ? [...new Set([...p.leadIds, leadId])] : p.leadIds.filter(x => x !== leadId); return p; }, linked ? 'Vincular contacto a propiedad' : 'Desvincular contacto', `${id} · ${leadId}`, 'properties'); },
    remove(id) { mutate('properties', s => { s.properties = s.properties.filter(p => p.id !== id); }, 'Eliminar propiedad', id, 'properties'); },
    seedDemo() { const items = demoProperties(); mutate('properties', s => { s.properties = s.properties.filter(p => p.source !== 'demo').concat(items); }, 'Cargar propiedades de ejemplo', `${items.length} propiedades`, 'properties'); return items.length; },
    clearDemo() { mutate('properties', s => { s.properties = s.properties.filter(p => p.source !== 'demo'); }, 'Quitar propiedades de ejemplo', '', 'properties'); },
  };

  // Public forms drop submissions here; the CRM drains them into leads.
  const intake = {
    push(input) { const item = cleanIntake(input); mutate('intake', s => { s.intake.push(item); s.intake = s.intake.slice(-2000); }, 'Formulario recibido', item.email || item.phone, 'intake'); return item; },
    list: () => read().intake,
    drain() { let items = []; mutate('intake', s => { items = s.intake; s.intake = []; }, null); if (items.length) emit('intake'); return items; },
    size: () => read().intake.length,
  };

  const audit = {
    log(action, detail = '', area = 'general') { mutate('audit', () => {}, action, detail, area); },
    list: (area = '') => read().audit.filter(a => !area || a.area === area),
  };

  return {
    getSession, signIn, signOut, can, users, properties, intake, audit,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    backend: () => ({ mode: 'local', connected: false, label: 'Demo local · datos en este navegador' }),
    exportAll: () => JSON.stringify({ format: 'ornat-data', version: 1, exportedAt: new Date().toISOString(), state: read() }, null, 2),
    importAll(raw) { const parsed = JSON.parse(raw); checkKeys(parsed); if (parsed?.format !== 'ornat-data') throw new Error('Formato no compatible.'); write(parsed.state); emit('all'); },
  };
}

function demoProperties() {
  const base = [
    ['Villa Tankah', 'villa', 'venta', 'disponible', 18900000, 420, 900, 4, 4.5, 3, 'Tankah Bay', 'Tulum', ['Alberca infinita', 'Frente al mar', 'Paneles solares']],
    ['Residencia Aldea Zamá 12', 'casa', 'venta', 'apartado', 9450000, 280, 360, 3, 3.5, 2, 'Aldea Zamá', 'Tulum', ['Roof garden', 'Alberca', 'Seguridad 24 h']],
    ['Departamento Lumina 304', 'departamento', 'preventa', 'disponible', 4380000, 96, null, 2, 2, 1, 'Centro', 'Playa del Carmen', ['Amenidades', 'Gimnasio', 'Coworking']],
    ['Penthouse Coral 1201', 'departamento', 'venta', 'disponible', 12600000, 210, null, 3, 3, 2, 'Puerto Cancún', 'Cancún', ['Vista al mar', 'Terraza privada', 'Jacuzzi']],
    ['Lote Selvanova 45', 'terreno', 'venta', 'vendido', 1850000, null, 520, null, null, null, 'Selvanova', 'Playa del Carmen', ['Servicios', 'Acceso controlado']],
    ['Casa Patio Mérida', 'casa', 'venta', 'disponible', 6200000, 310, 420, 3, 3, 2, 'Centro Histórico', 'Mérida', ['Casona restaurada', 'Alberca', 'Pisos de pasta']],
    ['Loft Quinta 18', 'departamento', 'renta', 'rentado', 38000, 74, null, 1, 1, 1, 'Quinta Avenida', 'Playa del Carmen', ['Amueblado', 'Pet friendly']],
    ['Local Plaza Andara', 'local', 'renta', 'disponible', 65000, 140, null, null, 1, 4, 'Av. Huayacán', 'Cancún', ['Esquina', 'Estacionamiento']],
    ['Villa Akumal Reef', 'villa', 'venta', 'disponible', 24500000, 510, 1100, 5, 5.5, 4, 'Akumal', 'Riviera Maya', ['Muelle', 'Casa de huéspedes', 'Frente al arrecife']],
    ['Oficina Torre Malecón 7B', 'oficina', 'renta', 'disponible', 52000, 160, null, null, 2, 3, 'Malecón Tajamar', 'Cancún', ['Vista a la laguna', 'Sala de juntas']],
    ['Residencia Bacalar Lagoon', 'casa', 'preventa', 'disponible', 7900000, 260, 800, 3, 3, 2, 'Costera', 'Bacalar', ['Acceso a laguna', 'Muelle privado']],
    ['Departamento Arena 502', 'departamento', 'venta', 'apartado', 5650000, 118, null, 2, 2, 1, 'Zona Hotelera', 'Cancún', ['Frente a la playa', 'Alberca']],
  ];
  const now = Date.now();
  return base.map(([title, type, operation, status, price, areaM2, lotM2, bedrooms, bathrooms, parking, zone, city, features], i) => cleanProperty({
    title, type, operation, status, price, areaM2, lotM2, bedrooms, bathrooms, parking, zone, city, features,
    development: zone, description: `${PROPERTY_TYPES[type]} en ${zone}, ${city}. Ficha de ejemplo para probar el catálogo; reemplázala con tu inventario real.`,
    images: demoImages(title), featured: i < 3, source: 'demo',
    createdAt: new Date(now - i * 86400000 * 3).toISOString(),
  }));
}

/* ---------- modo conectado (Supabase) ----------
   users <- profiles (solo lectura: el alta pasa por /api/team), properties <-> properties,
   intake <- intake_submissions pendientes (drain marca processed_at), audit -> audit_log (solo altas). */
const PROPERTY_BUCKET = 'property-media';
const tryClean = (fn, value) => { try { return [fn(value)]; } catch { return []; } };
const hasInline = p => (p?.images || []).some(u => String(u).startsWith('data:'));
const remoteError = message => Object.assign(new Error(message), { ornatRemote: true });
const fireStorage = key => { try { globalThis.dispatchEvent?.(new StorageEvent('storage', { key })); } catch {} };

function sessionJSON(r) {
  const p = r.profile; if (!p?.email) return null;
  return JSON.stringify({ user: { id: p.id, name: p.name || p.email.split('@')[0], email: p.email, role: p.role }, since: r.session?.user?.last_sign_in_at || new Date().toISOString() });
}
const intakeFromRow = r => tryClean(cleanIntake, { ...r.data, id: r.id, receivedAt: r.data?.receivedAt || r.cols?.received_at || r.received_at });
const profileUser = r => tryClean(cleanUser, { id: r.profile?.id, name: r.profile?.name, email: r.profile?.email, role: r.profile?.role });

export function remoteDataSpec({ role = () => '', me = () => null, pending = new Map(), claims = { drained: new Set(), orphans: new Map() } } = {}) {
  const lastClean = new Map();   // id -> última versión ya guardada en la tabla (sin fotos data:)
  const canEdit = () => { const p = PERMISSIONS[role()] || []; return p.includes('*') || p.includes('properties.edit'); };
  return {
    key: KEY,
    tables: [
      { name: 'profiles', entity: false, write: 'none' },
      'properties',
      { name: 'intake_submissions', write: 'none', whereNull: ['processed_at'], order: { column: 'received_at' } },
      { name: 'audit_log', write: 'insert', order: { column: 'at', ascending: false }, limit: 3000 },
    ],
    fromRows(rows) {
      const users = (rows.profiles || []).flatMap(r => tryClean(cleanUser, { id: r.data.id, name: r.data.name, email: r.data.email, role: r.data.role, createdAt: r.data.created_at }));
      const self = me();
      if (self?.email && !users.some(u => u.id === self.id)) users.push(...tryClean(cleanUser, { id: self.id, name: self.name, email: self.email, role: self.role }));
      const stored = (rows.properties || []).flatMap(r => tryClean(cleanProperty, { ...r.data, id: r.id }));
      for (const p of stored) lastClean.set(p.id, p);
      const ids = new Set(stored.map(p => p.id));
      const properties = stored.map(p => pending.get(p.id) || p).concat([...pending.values()].filter(p => !ids.has(p.id)));
      // Pendientes del servidor menos los ya entregados a drain(), más los reclamados por intake_drain que aún no se entregaron.
      const intake = (rows.intake_submissions || []).filter(r => !claims.drained.has(r.id) && !claims.orphans.has(r.id))
        .flatMap(r => intakeFromRow(r)).concat([...claims.orphans.values()])
        .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
      const audit = (rows.audit_log || []).map(r => r.data).filter(isObject).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 3000);
      return { version: 1, users, properties, intake, audit };
    },
    toRows(state) {
      const editor = canEdit(); const properties = [];
      for (const p of state.properties || []) {
        let out = p;
        if (hasInline(p)) out = lastClean.get(p.id);                                   // las fotos se suben primero
        else if (!editor) out = lastClean.has(p.id) ? { ...lastClean.get(p.id), status: p.status } : null; // ventas: solo el estado
        if (!out) continue;
        lastClean.set(p.id, out); properties.push(out);
      }
      return {
        properties: properties.map(p => ({ id: p.id, data: p, cols: { slug: p.slug, status: p.status, operation: p.operation, is_public: !p.draft } })),
        audit_log: (state.audit || []).map(a => ({ id: a.id, data: a, cols: { at: a.at } })),
      };
    },
  };
}

// Fotos en base64 -> bucket property-media; al terminar se reemplazan por la URL pública y se guarda la propiedad.
function inlineUploader(r, getMirror, pending) {
  const uploaded = new Map(); const busy = new Set();
  async function run(id, attempt = 0) {
    if (busy.has(id)) return; busy.add(id);
    try {
      const p = pending.get(id); if (!p) return;
      for (const [i, u] of p.images.entries()) {
        if (!u.startsWith('data:') || uploaded.has(u)) continue;
        const blob = await (await fetch(u)).blob();
        const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
        uploaded.set(u, (await r.uploadMedia(PROPERTY_BUCKET, blob, `${p.slug}-${i + 1}.${ext}`)).url);
      }
    } catch (error) {
      console.warn('[ORNAT] No se pudieron subir las fotos de la propiedad.', error?.message || error);
      busy.delete(id);
      if (attempt < 3) setTimeout(() => run(id, attempt + 1), 5000 * (attempt + 1));
      return;
    }
    busy.delete(id);
    const cur = pending.get(id); if (!cur) return;
    if (cur.images.some(u => u.startsWith('data:') && !uploaded.has(u))) { run(id); return; }
    const mirror = getMirror(); const state = JSON.parse(mirror.getItem(KEY));
    const i = state.properties.findIndex(x => x.id === id);
    pending.delete(id);
    if (i < 0) return;
    state.properties[i] = { ...cur, images: cur.images.map(u => uploaded.get(u) || u) };
    mirror.setItem(KEY, JSON.stringify(state)); fireStorage(KEY);
  }
  return state => {
    const ids = new Set();
    for (const p of state.properties || []) { ids.add(p.id); if (hasInline(p)) { pending.set(p.id, p); run(p.id); } else pending.delete(p.id); }
    for (const id of [...pending.keys()]) if (!ids.has(id)) pending.delete(id);
  };
}

// drained: ids ya entregados por drain() (se ocultan hasta que Realtime confirme processed_at).
// orphans: filas que intake_drain marcó como nuestras sin que list() las hubiera mostrado; se guardan para no perderlas.
function intakeClaims(storageKey) {
  const ls = () => { try { return globalThis.localStorage || null; } catch { return null; } };
  const orphans = new Map();
  try { for (const i of JSON.parse(ls()?.getItem(storageKey) || '[]')) for (const c of tryClean(cleanIntake, i)) orphans.set(c.id, c); } catch {}
  const save = () => { try { if (orphans.size) ls()?.setItem(storageKey, JSON.stringify([...orphans.values()])); else ls()?.removeItem(storageKey); } catch {} };
  return { drained: new Set(), orphans, save };
}

// Solo lectura: visitantes sin sesión (catálogo público) o fallo al cargar los datos del equipo.
function fixedStorage(state, r, message) {
  const json = JSON.stringify(state);
  return {
    getItem: k => (k === KEY ? json : k === SESSION_KEY ? sessionJSON(r) : null),
    setItem(k) { if (k === KEY) throw remoteError(message); },
    removeItem() {},
  };
}

async function publicState(r) {
  const state = emptyState();
  if (!r.client) return state;
  try {
    const { data: rows, error } = await r.client.from('public_properties').select('id,data').order('updated_at', { ascending: false }).range(0, 1999);
    if (error) throw error;
    state.properties = (rows || []).flatMap(row => tryClean(cleanProperty, { ...row.data, id: row.id }));
  } catch (error) { console.warn('[ORNAT] No se pudo leer el catálogo público.', error?.message || error); }
  return state;
}

async function remoteBackend(r) {
  if (!(r.session && r.profile)) return { storage: fixedStorage(await publicState(r), r, 'Inicia sesión para guardar cambios.'), live: false };
  const pending = new Map(); let mirror = null;
  const claims = intakeClaims(`ornat-intake-claimed:${r.orgId}`);
  const spec = remoteDataSpec({ role: () => r.profile?.role || '', me: () => r.profile, pending, claims });
  const track = inlineUploader(r, () => mirror, pending);
  try { mirror = await r.mirror(spec); }
  catch (error) {
    console.warn('[ORNAT] No se pudieron cargar los datos del equipo.', error?.message || error);
    return { storage: fixedStorage({ ...emptyState(), users: profileUser(r) }, r, 'Sin conexión con Supabase: no se guardó. Recarga la página.'), live: false, failed: true };
  }
  return {
    live: true, claims,
    // Agrega al estado local formularios reclamados que el CRM aún no recibió (sin escribir en el servidor).
    addOrphans(items) {
      const state = JSON.parse(mirror.getItem(KEY)); const have = new Set(state.intake.map(i => i.id));
      state.intake.push(...items.filter(i => !have.has(i.id)));
      mirror.setItem(KEY, JSON.stringify(state)); fireStorage(KEY);
    },
    storage: {
      getItem: k => (k === SESSION_KEY ? sessionJSON(r) : k === KEY ? mirror.getItem(KEY) : null),
      setItem(k, v) { if (k !== KEY) return; track(JSON.parse(v)); mirror.setItem(KEY, v); },
      removeItem(k) { if (k === KEY) mirror.removeItem(KEY); },
      status: () => mirror.status(),
      refresh: () => mirror.rehydrate(),
    },
  };
}

function createRemoteData(r, { storage, live, failed = false, claims = null, addOrphans = null }) {
  const base = createData(storage);
  const getSession = () => { const s = base.getSession(); return s && { ...s, id: s.user.id, name: s.user.name, email: s.user.email, role: s.user.role }; };
  const managed = () => { throw new Error('El acceso del equipo se administra en Cuenta → Equipo.'); };
  return {
    ...base,
    getSession,
    can: (action, session = getSession()) => base.can(action, session),
    signIn: ({ email, password } = {}) => r.signIn(email, password),
    signOut: async () => { await r.signOut(); },
    users: { list: base.users.list, save: managed, remove: managed },
    intake: {
      ...base.intake,
      push(input) { const item = cleanIntake(input); const { id: _id, receivedAt: _at, ...payload } = item; return r.submitIntake(payload).then(res => ({ ...item, id: res.id })); },
      // Atómico: rpc intake_drain marca y devuelve solo lo que este usuario reclamó. Devuelve una promesa con esas filas.
      drain() {
        if (!claims) return Promise.resolve([]);
        const handed = base.intake.list(); const handedIds = new Set(handed.map(i => i.id));
        for (const i of handed) { claims.drained.add(i.id); claims.orphans.delete(i.id); }
        claims.save(); base.intake.drain();
        return r.client.rpc('intake_drain').then(({ data: rows, error }) => {
          if (error) throw error;
          const claimed = (rows || []).flatMap(intakeFromRow);
          const extra = claimed.filter(i => !handedIds.has(i.id));
          if (extra.length) { for (const i of extra) claims.orphans.set(i.id, i); claims.save(); addOrphans(extra); }
          return claimed;
        }).catch(error => {
          for (const i of handed) claims.drained.delete(i.id);   // siguen pendientes en el servidor: volverán a aparecer
          console.warn('[ORNAT] No se pudieron marcar los formularios como procesados.', error?.message || error);
          return [];
        });
      },
    },
    backend: () => (live ? { mode: 'supabase', connected: true, label: 'Supabase · datos compartidos del equipo' }
      : failed || !r.client ? { mode: 'supabase', connected: false, label: 'Sin conexión con Supabase' }
      : { mode: 'supabase', connected: true, label: 'Supabase · sitio público' }),
    sync: () => storage.status?.() || { pending: 0, lastError: null, online: globalThis.navigator?.onLine ?? true },
    refresh: async () => { await storage.refresh?.(); },
    importAll() { throw new Error('Con Supabase conectado los datos se restauran desde la base de datos, no desde un archivo.'); },
  };
}

const backendState = remote ? await remoteBackend(remote) : null;

let shared;
export function data() { return (shared ||= backendState ? createRemoteData(remote, backendState) : createData()); }
