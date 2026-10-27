const DB_NAME = 'ornat-cms-demo';
const STORE = 'projects';
// Stores added in DB v2 (versions, media library, brand kits, publications). v1 data in 'projects' is untouched.
export const EXTRA_STORES = ['versions', 'media', 'kits', 'publications'];
const MAX_FILE = 80 * 1024 * 1024;
export const MAX_PROJECT_BYTES = 72 * 1024 * 1024;
let databasePromise;

export async function openStore() {
  if (!globalThis.indexedDB) throw new Error('Tu navegador no permite almacenamiento local. Exporta el proyecto antes de cerrar.');
  if (!databasePromise) databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of [STORE, ...EXTRA_STORES]) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); databasePromise = undefined; };
      resolve(db);
    };
    request.onerror = () => reject(new Error('No se pudo abrir el almacenamiento local. Revisa los permisos del navegador y exporta tu proyecto.'));
    request.onblocked = () => reject(new Error('Otra pestaña bloquea el almacenamiento. Ciérrala e inténtalo de nuevo.'));
  }).catch(error => { databasePromise = undefined; throw error; });
  return databasePromise;
}

async function transact(mode, action) {
  const db = await openStore();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    let request;
    try { request = action(transaction.objectStore(STORE)); }
    catch (error) { reject(error); return; }
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = transaction.onabort = () => reject(new Error(transaction.error?.name === 'QuotaExceededError' ? 'El navegador no tiene espacio suficiente. Exporta el proyecto y elimina proyectos antiguos.' : 'No se guardaron los cambios. Exporta el proyecto e inténtalo de nuevo.'));
  });
}

async function storeTx(name, mode, action) {
  const db = await openStore();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(name, mode);
    let request;
    try { request = action(transaction.objectStore(name)); }
    catch (error) { reject(error); return; }
    transaction.oncomplete = () => resolve(request?.result);
    transaction.onerror = transaction.onabort = () => reject(new Error(transaction.error?.name === 'QuotaExceededError' ? 'El navegador no tiene espacio suficiente. Borra versiones o imágenes que no uses.' : 'No se guardaron los cambios en el almacenamiento local.'));
  });
}
// Con backend Supabase (shared/remote-boot.js) los almacenes viven en remote-store.js; sin él, IndexedDB como siempre.
let remotePromise;
const remoteStore = () => remotePromise ??= import('./remote-store.js').then(module => module.remoteStore, error => { if (globalThis.document) console.error(error); return null; });
export const dbAll = async name => (await remoteStore())?.all(name) ?? storeTx(name, 'readonly', store => store.getAll());
export const dbGet = async (name, id) => (await remoteStore())?.get(name, id) ?? storeTx(name, 'readonly', store => store.get(String(id))).then(value => value ?? null);
export const dbPut = async (name, value) => (await remoteStore())?.put(name, value) ?? storeTx(name, 'readwrite', store => store.put(value)).then(() => value);
export const dbDelete = async (name, id) => (await remoteStore())?.delete(name, id) ?? storeTx(name, 'readwrite', store => store.delete(String(id)));
export const dbClear = async name => (await remoteStore())?.clear(name) ?? storeTx(name, 'readwrite', store => store.clear());

export async function listProjects() {
  const list = await ((await remoteStore())?.all(STORE) ?? transact('readonly', store => store.getAll()));
  return list.sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}
// Se valida AL LEER (no solo al guardar): lo que haya en IndexedDB o en la nube pudo escribirlo otra pestaña, otro usuario o una versión anterior.
export async function loadProject(id) { const stored = (await ((await remoteStore())?.get(STORE, id) ?? transact('readonly', store => store.get(String(id))))) ?? null; return stored ? validateProject(stored) : null; }
export async function deleteProject(id) { await ((await remoteStore())?.delete(STORE, id) ?? transact('readwrite', store => store.delete(String(id)))); }
export async function saveProject(project) {
  const now = new Date().toISOString();
  const value = validateProject({...project, createdAt:project.createdAt || now, updatedAt:now});
  await ((await remoteStore())?.put(STORE, value) ?? transact('readwrite', store => store.put(value)));
  return value;
}

function dimensions(slot = {}) {
  const explicitRatio = typeof slot.ratio === 'string' && slot.ratio.includes(':') ? slot.ratio.split(':').reduce((a,b)=>Number(a)/Number(b)) : Number(slot.ratio);
  const width = Number(slot.width) > 0 ? Number(slot.width) : slot.kind === 'logo' ? 240 : 960;
  const height = Number(slot.height) > 0 ? Number(slot.height) : width / (explicitRatio > 0 ? explicitRatio : slot.kind === 'logo' ? 1 : 16/9);
  return {width,height,ratio:slot.kind==='logo'?width/height:explicitRatio > 0 ? explicitRatio : width/height};
}
export function assessImage(meta = {}, slot = {}) {
  const target = dimensions(slot);
  const scale=Math.min(2,(slot.kind==='logo'?1600:3840)/Math.max(target.width,target.height));
  const recommended = {width:Math.max(1,Math.round(target.width*scale)),height:Math.max(1,Math.round(target.height*scale))};
  const result = {level:'good',messages:[],recommended,ratio:target.ratio};
  if (!(Number(meta.width)>0 && Number(meta.height)>0)) return {...result,level:'error',messages:['No se pudo leer el tamaño de esta imagen. Sube un archivo PNG, JPEG, WebP o AVIF válido.']};
  if (meta.width < recommended.width || meta.height < recommended.height) result.messages.push(`Puede perder nitidez: recomendamos ${recommended.width} × ${recommended.height} px para este módulo.`);
  const mismatch = Math.abs(Math.log((meta.width/meta.height)/target.ratio));
  if (slot.kind === 'logo') {
    if (meta.hasAlpha === false) result.messages.push('El logo tiene fondo sólido. Un PNG transparente permite integrarlo mejor en distintos fondos.');
    if (mismatch>0.6) result.messages.push('El logo tiene una proporción diferente al área disponible. Se ajustará completo, sin recortarlo; revisa su tamaño visual.');
  } else if (mismatch>0.15) result.messages.push('La proporción requiere recorte. Ajusta el punto de enfoque para conservar el elemento importante, o elige encajar para mostrar todo.');
  if (Number(meta.bytes)>5*1024*1024) result.messages.push('El original es pesado. Lo optimizamos al cargarlo; conserva una copia del archivo original.');
  if (result.messages.length) result.level='warning';
  else result.messages.push(slot.kind === 'logo' ? 'Resolución adecuada. El logo se mostrará completo y sin deformación.' : 'Resolución y proporción adecuadas para este módulo.');
  return result;
}

function parseHex(value) {
  if (typeof value !== 'string' || !/^#(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(value)) throw new Error('Color inválido: usa hexadecimal #RGB o #RRGGBB.');
  let hex=value.slice(1); if(hex.length===3)hex=hex.split('').map(x=>x+x).join('');
  return [0,2,4].map(index=>parseInt(hex.slice(index,index+2),16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4).reduce((sum,v,index)=>sum+v*[0.2126,0.7152,0.0722][index],0);
}
export function contrastRatio(first,second) { const a=parseHex(first),b=parseHex(second); return (Math.max(a,b)+.05)/(Math.min(a,b)+.05); }
export function assessContrast(foreground,background,{largeText=false}={}) {
  const ratio=contrastRatio(foreground,background),minRatio=largeText?3:4.5;
  return {level:ratio>=minRatio?'good':'warning',ratio,minRatio,messages:[ratio>=minRatio?'Contraste adecuado para leer el texto.':`El texto puede ser difícil de leer (${ratio.toFixed(2)}:1). Usa un texto más oscuro o claro hasta llegar a ${minRatio}:1.`]};
}

export function buildImagePrompts({section='Portada',brand='tu marca',style='fotografía arquitectónica editorial hiperrealista',ratio=16/9,width=1920,height=1080,animation=false,referenceDescription='el proyecto de la imagen adjunta',initialDescription='bosquejo arquitectónico a lápiz fino del proyecto, líneas de construcción precisas, sombras sutiles y fondo coherente con la imagen final',finalDescription='fotografía arquitectónica hiperrealista del proyecto construido, materiales y acabados realistas, iluminación natural, sin trazo de boceto'}={}) {
  const frame=`Formato ${width} × ${height} px, proporción ${typeof ratio==='number'?ratio.toFixed(3):ratio}.`;
  const base=`Crea una imagen para el módulo «${section}» de ${brand}. Estilo: ${style}. ${frame} Usa la imagen adjunta como referencia de ${referenceDescription}; conserva su identidad, materiales y geometría. Perspectiva arquitectónica coherente, iluminación físicamente creíble, texturas naturales y detalles construibles. Deja espacio visual limpio para el texto. Sin texto, marcas de agua ni logos inventados.`;
  const continuity='Mantén exactamente la misma cámara, focal, encuadre, horizonte, proporciones y geometría del proyecto entre las imágenes. No agregues edificios ni cambies la estructura.';
  return {
    single:base,
    initial:`${base} Esta es la imagen INICIAL de una transición por scroll. Estado visual inicial obligatorio: ${initialDescription}. Este estado define la técnica visual de esta imagen aunque la dirección general mencione fotografía. ${continuity} Prepara los mismos límites y fondo que en el estado final previsto: ${finalDescription}.`,
    final:`${base} Adjunto también la imagen INICIAL como referencia obligatoria. Esta es la imagen FINAL. Estado visual final obligatorio: ${finalDescription}. Transforma únicamente la representación inicial «${initialDescription}» hasta ese resultado final. ${continuity} Las zonas sin cambios deben coincidir con la referencia inicial.`,
    requirements:animation?[
      `Sube dos imágenes diferentes: estado inicial y estado final, ambas de ${width} × ${height} px.`,
      'Usa la misma cámara, encuadre y geometría para evitar saltos durante la transición.',
      'Genera primero la imagen inicial; adjúntala como referencia al pedir la imagen final junto con tu fotografía del proyecto.',
      'Revisa que ventanas, bordes y líneas del edificio coincidan antes de cargar ambas imágenes.',
      'Estas dos imágenes son estados extremos. Para un recorrido continuo necesitas video o fotogramas intermedios coherentes; dos imágenes no equivalen a una secuencia de 300 fotogramas.'
    ]:[`Sube una imagen de ${width} × ${height} px o mayor, con la proporción del módulo.`, 'Adjunta una fotografía de referencia de tu proyecto al usar el prompt.', 'Mantén al sujeto importante lejos de los bordes; revisa el recorte en móvil y escritorio.']
  };
}

// Estilos de texto del lienzo: lista blanca estricta de propiedades y valores (nada de url(), var(), expresiones ni comas).
export const STYLE_FONT_NAMES=['Inter','Barlow Condensed','Playfair Display','Arial','Verdana','Trebuchet MS','Georgia','Times New Roman','Courier New','system-ui'];
export const STYLE_PROPS=['fontFamily','fontSize','fontWeight','fontStyle','textAlign','color','letterSpacing','lineHeight'];
export function isSafeStyle(prop,value) {
  if(typeof value!=='string')return false;
  switch(prop) {
    case 'fontFamily':return STYLE_FONT_NAMES.includes(value);
    case 'fontSize':return /^\d{1,3}(?:\.\d{1,2})?px$/.test(value)&&parseFloat(value)>=6&&parseFloat(value)<=400;
    case 'fontWeight':return ['300','400','500','600','700','800','900'].includes(value);
    case 'fontStyle':return ['normal','italic'].includes(value);
    case 'textAlign':return ['left','center','right','justify'].includes(value);
    case 'color':return /^#(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(value);
    case 'letterSpacing':{const m=/^(-?\d{1,2}(?:\.\d{1,3})?)(em|px)$/.exec(value);return !!m&&Math.abs(Number(m[1]))<=(m[2]==='em'?2:30);}
    case 'lineHeight':return /^\d{1,2}(?:\.\d{1,2})?$/.test(value)&&Number(value)>=.6&&Number(value)<=4;
    default:return false;
  }
}
const safeStyleKey=key=>typeof key==='string'&&key.length>0&&key.length<=300&&!/[\x00-\x1f\x7f]/.test(key);

export function isSafeLink(value) {
  if (typeof value!=='string' || value.length>4096) return false;
  const link=value.trim();
  if(/[\u0000-\u0020\u007f\\]/.test(link)||link.startsWith('//')) return false;
  return link==='' || /^(?:https?:\/\/|mailto:|tel:|#|\/(?!\/)|\.\.?\/)/i.test(link);
}
function sanitize(value,depth=0,counter={count:0}) {
  if (++counter.count>50000 || depth>16) throw new Error('El proyecto contiene demasiados datos o niveles.');
  if (value===null || typeof value==='boolean') return value;
  if (typeof value==='number') {if(!Number.isFinite(value))throw new Error('El proyecto contiene un número inválido.');return value;}
  if (typeof value==='string') {
    const inlineLimit=/^data:video\/(?:mp4|webm);base64,/i.test(value)?Math.ceil(32*1024*1024*4/3)+64:20*1024*1024;
    if(value.length>inlineLimit)throw new Error('Un recurso supera el tamaño permitido para importar.');
    const compact=value.replace(/[\u0000-\u0020\u007f]/g,'');
    if(/^(?:javascript|vbscript):/i.test(compact)||/^data:(?!(?:image\/(?:png|jpeg|webp|avif)|video\/(?:mp4|webm));base64,)/i.test(compact))throw new Error('El proyecto contiene un enlace no permitido por seguridad.');
    return value;
  }
  if (Array.isArray(value)) return value.map(item=>sanitize(item,depth+1,counter));
  if (!value || typeof value!=='object' || Object.getPrototypeOf(value)!==Object.prototype)throw new Error('Formato de datos no permitido.');
  const out={};
  for(const [key,item]of Object.entries(value)) {
    if(['__proto__','prototype','constructor'].includes(key))throw new Error('El proyecto contiene una clave no permitida por seguridad.');
    if(item===undefined)continue;
    out[key]=sanitize(item,depth+1,counter);
  }
  return out;
}
// ---------- Bloques insertados (patch.blocks), traducciones (patch.i18n), páginas (patch.pages), comentarios y revisión ----------
// Lista blanca estricta de tipos y campos: nada de HTML libre. blocks.js renderiza estos datos escapándolos.
export const BLOCK_ID_RE = /^[a-z0-9]{4,12}$/;
export const BLOCK_TYPES = {
  textimage: { label: 'Texto + imagen', fields: { eyebrow: ['t', 80], title: ['t', 200], body: ['t', 2000], imageSrc: ['img'], imageAlt: ['t', 300], ctaLabel: ['t', 80], ctaHref: ['link'], reverse: ['bool'] } },
  gallery: { label: 'Galería', fields: { title: ['t', 200], columns: ['int', 1, 4], items: ['list', 8, { src: ['img'], alt: ['t', 300] }] } },
  testimonials: { label: 'Testimonios', fields: { title: ['t', 200], items: ['list', 6, { quote: ['t', 600], name: ['t', 100], role: ['t', 120] }] } },
  faq: { label: 'Preguntas frecuentes', fields: { title: ['t', 200], items: ['list', 12, { q: ['t', 300], a: ['t', 1500] }] } },
  cta: { label: 'Llamada a la acción', fields: { title: ['t', 200], body: ['t', 600], label: ['t', 80], href: ['link'] } },
  contact: { label: 'Formulario de contacto', fields: { title: ['t', 200], body: ['t', 600], buttonLabel: ['t', 80], form: ['t', 60] } },
  map: { label: 'Mapa', fields: { title: ['t', 200], address: ['t', 300], lat: ['num', -90, 90], lng: ['num', -180, 180], zoom: ['int', 3, 19] } },
  video: { label: 'Video', fields: { title: ['t', 200], url: ['url'] } },
  catalog: { label: 'Catálogo de propiedades', fields: { title: ['t', 200], mode: ['enum', 'catalog', 'featured'], filters: ['bool'], limit: ['int', 1, 24], operation: ['enum', '', 'venta', 'renta', 'preventa'], type: ['t', 40], city: ['t', 120] } },
  spacer: { label: 'Separador', fields: { height: ['int', 8, 400] } },
  hero: { label: 'Encabezado de sección', fields: { eyebrow: ['t', 80], title: ['t', 200], subtitle: ['t', 600], bgSrc: ['img'], align: ['enum', 'left', 'center'], ctaLabel: ['t', 80], ctaHref: ['link'] } },
  richtext: { label: 'Texto largo', fields: { title: ['t', 200], items: ['list', 24, { kind: ['enum', 'p', 'h3'], text: ['t', 3000] }] } },
  process: { label: 'Proceso por pasos', fields: { title: ['t', 200], items: ['list', 6, { title: ['t', 120], body: ['t', 500] }, 3] } },
  stats: { label: 'Cifras', fields: { title: ['t', 200], items: ['list', 6, { value: ['t', 24], label: ['t', 100] }] } },
  team: { label: 'Equipo', fields: { title: ['t', 200], items: ['list', 8, { src: ['img'], alt: ['t', 300], name: ['t', 100], role: ['t', 120] }] } },
  logos: { label: 'Logos de clientes', fields: { title: ['t', 200], items: ['list', 12, { src: ['img'], alt: ['t', 200] }] } },
  pricing: { label: 'Paquetes y precios', fields: { title: ['t', 200], items: ['list', 4, { name: ['t', 80], price: ['t', 40], note: ['t', 80], features: ['t', 600], ctaLabel: ['t', 60], ctaHref: ['link'], featured: ['bool'] }, 2] } },
  beforeafter: { label: 'Antes y después', fields: { title: ['t', 200], beforeSrc: ['img'], beforeAlt: ['t', 300], afterSrc: ['img'], afterAlt: ['t', 300], beforeLabel: ['t', 40], afterLabel: ['t', 40] } },
  property: { label: 'Propiedad destacada', fields: { title: ['t', 200], slug: ['slug'], name: ['t', 160], price: ['t', 60], location: ['t', 160], facts: ['t', 200], imageSrc: ['img'], imageAlt: ['t', 300], ctaLabel: ['t', 80] } },
  newsletter: { label: 'Suscripción', fields: { title: ['t', 200], body: ['t', 400], placeholder: ['t', 80], buttonLabel: ['t', 60], form: ['t', 60] } }
};
const blockImageOK = v => typeof v === 'string' && (v === '' || /^data:image\/(?:png|jpeg|webp|avif);base64,[A-Za-z0-9+/]*={0,2}$/i.test(v) || /^https:\/\/[^\s"'<>\\]+$/i.test(v) || /^\/(?!\/)[^\s"'<>\\]*$/.test(v));
function checkSpec(spec, value, label) {
  const bad = msg => { throw new Error(`Bloque: el campo «${label}» ${msg}.`); };
  const [kind, a, b] = spec;
  switch (kind) {
    case 't': if (typeof value !== 'string' || value.length > a || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) bad(`debe ser texto de hasta ${a} caracteres`); break;
    case 'img': if (!blockImageOK(value)) bad('necesita una imagen PNG, JPEG, WebP o AVIF, una URL https o una ruta del sitio'); break;
    case 'link': if (!isSafeLink(value)) bad('contiene un enlace no permitido'); break;
    case 'url': if (value !== '' && !(typeof value === 'string' && /^https:\/\//i.test(value) && safeWebURL(value))) bad('debe ser una URL https'); break;
    case 'slug': if (typeof value !== 'string' || !/^[a-z0-9-]{0,120}$/.test(value)) bad('debe ser un identificador en minúsculas, números y guiones'); break;
    case 'bool': if (typeof value !== 'boolean') bad('debe ser sí o no'); break;
    case 'int': if (!Number.isInteger(value) || value < a || value > b) bad(`debe ser un entero entre ${a} y ${b}`); break;
    case 'num': if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < a || value > b)) bad(`debe ser un número entre ${a} y ${b}`); break;
    case 'enum': if (!spec.slice(1).includes(value)) bad('tiene una opción no válida'); break;
    case 'list': {
      if (!Array.isArray(value) || value.length > a) bad(`admite hasta ${a} elementos`);
      if (spec[3] && value.length < spec[3]) bad(`necesita al menos ${spec[3]} elementos`);
      for (const item of value) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) bad('tiene un elemento inválido');
        for (const [key, v] of Object.entries(item)) { if (!Object.hasOwn(b, key)) throw new Error(`Bloque: el campo «${label}.${key}» no está permitido.`); checkSpec(b[key], v, `${label}.${key}`); }
      }
      break;
    }
    default: bad('no es válido');
  }
}
export function validateBlocks(list) {
  if (!Array.isArray(list) || list.length > 60) throw new Error('Los bloques deben ser una lista de hasta 60 elementos.');
  const seen = new Set();
  for (const block of list) {
    if (!block || typeof block !== 'object' || Array.isArray(block)) throw new Error('Un bloque no es válido.');
    for (const key of Object.keys(block)) if (!['id', 'type', 'after', 'fields'].includes(key)) throw new Error(`El bloque contiene un campo no permitido (${key}).`);
    if (typeof block.id !== 'string' || !BLOCK_ID_RE.test(block.id) || seen.has(block.id)) throw new Error('Un bloque tiene un identificador inválido o repetido.');
    seen.add(block.id);
    const def = typeof block.type === 'string' && Object.hasOwn(BLOCK_TYPES, block.type) ? BLOCK_TYPES[block.type] : null;
    if (!def) throw new Error('Un bloque tiene un tipo que no existe.');
    if (typeof block.after !== 'string' || block.after.length > 300 || /[\u0000-\u001f\u007f]/.test(block.after)) throw new Error('La posición de un bloque no es válida.');
    if (!block.fields || typeof block.fields !== 'object' || Array.isArray(block.fields)) throw new Error('Un bloque necesita sus campos.');
    for (const [key, value] of Object.entries(block.fields)) {
      if (!Object.hasOwn(def.fields, key)) throw new Error(`El bloque «${def.label}» no admite el campo ${key}.`);
      checkSpec(def.fields[key], value, key);
    }
  }
  return list;
}
const i18nKey = key => typeof key === 'string' && key.length > 0 && key.length <= 300 && !/[\u0000-\u001f\u007f]/.test(key) && !['__proto__', 'prototype', 'constructor'].includes(key);
export function validateI18n(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('El campo i18n debe ser un objeto.');
  for (const key of Object.keys(value)) if (!['enabled', 'en'].includes(key)) throw new Error(`El campo i18n.${key} no está permitido.`);
  if (value.enabled !== undefined && typeof value.enabled !== 'boolean') throw new Error('i18n.enabled debe ser sí o no.');
  if (value.en !== undefined) {
    if (!value.en || typeof value.en !== 'object' || Array.isArray(value.en)) throw new Error('Las traducciones al inglés deben ser un objeto.');
    const entries = Object.entries(value.en);
    if (entries.length > 3000) throw new Error('Hay demasiadas traducciones (máximo 3000).');
    for (const [id, text] of entries) {
      if (!i18nKey(id)) throw new Error('Una traducción tiene un identificador inválido.');
      if (typeof text !== 'string' || text.length > 5000) throw new Error('Cada traducción debe ser texto de hasta 5000 caracteres.');
    }
  }
  return value;
}
export function validatePages(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('El campo pages debe ser un objeto.');
  const entries = Object.entries(value);
  if (entries.length > 100) throw new Error('Hay demasiadas páginas con SEO propio (máximo 100).');
  for (const [path, page] of entries) {
    if (!/^\/[^\s"'<>\\]{0,298}$/.test(path)) throw new Error('La ruta de una página no es válida.');
    if (!page || typeof page !== 'object' || Array.isArray(page)) throw new Error('Los datos SEO de una página no son válidos.');
    for (const [key, v] of Object.entries(page)) {
      if (key === 'title' && typeof v === 'string' && v.length <= 200) continue;
      if (key === 'description' && typeof v === 'string' && v.length <= 1000) continue;
      if (key === 'sitemap' && typeof v === 'boolean') continue;
      throw new Error(`El campo SEO ${key} de una página no es válido.`);
    }
  }
  return value;
}
export const REVIEW_STATUSES = ['draft', 'review', 'approved', 'published'];
export const COMMENT_ID_RE = /^[a-z0-9-]{1,64}$/;
const person = (value, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}: falta el autor.`);
  for (const key of ['name', 'email', 'role']) if (typeof value[key] !== 'string' || value[key].length > 250) throw new Error(`${label}: el autor no es válido.`);
  if (value.id !== undefined && (typeof value.id !== 'string' || value.id.length > 100)) throw new Error(`${label}: el autor no es válido.`);
};
export function validateComments(list) {
  if (!Array.isArray(list) || list.length > 500) throw new Error('Los comentarios deben ser una lista de hasta 500 hilos.');
  const ids = new Set();
  for (const c of list) {
    if (!c || typeof c !== 'object' || typeof c.id !== 'string' || !COMMENT_ID_RE.test(c.id) || ids.has(c.id)) throw new Error('Un comentario tiene un identificador inválido.');
    if (c.status !== undefined && !REVIEW_STATUSES.includes(c.status)) throw new Error('El estado de un comentario no es válido.');
    ids.add(c.id);
    const anchor = c.anchor;
    if (!anchor || typeof anchor !== 'object' || !i18nKey(anchor.id) || !(anchor.ox >= 0 && anchor.ox <= 1) || !(anchor.oy >= 0 && anchor.oy <= 1)) throw new Error('El ancla de un comentario no es válida.');
    if (anchor.label !== undefined && (typeof anchor.label !== 'string' || anchor.label.length > 200)) throw new Error('La etiqueta de un comentario no es válida.');
    person(c.author, 'Comentario');
    if (typeof c.text !== 'string' || !c.text.trim() || c.text.length > 2000) throw new Error('Un comentario debe tener entre 1 y 2000 caracteres.');
    if (Number.isNaN(Date.parse(c.at))) throw new Error('La fecha de un comentario no es válida.');
    if (typeof c.resolved !== 'boolean') throw new Error('El estado de un comentario no es válido.');
    if (!Array.isArray(c.replies) || c.replies.length > 200) throw new Error('Las respuestas de un comentario no son válidas.');
    for (const r of c.replies) { if (r?.id !== undefined && (typeof r.id !== 'string' || !COMMENT_ID_RE.test(r.id))) throw new Error('Una respuesta tiene un identificador inválido.'); person(r?.author, 'Respuesta'); if (typeof r.text !== 'string' || !r.text.trim() || r.text.length > 2000 || Number.isNaN(Date.parse(r.at))) throw new Error('Una respuesta no es válida.'); }
  }
  return list;
}
export function validateReview(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !REVIEW_STATUSES.includes(value.status)) throw new Error('El estado de revisión no es válido.');
  if (!Array.isArray(value.history) || value.history.length > 200) throw new Error('El historial de revisión no es válido.');
  for (const h of value.history) {
    if (!REVIEW_STATUSES.includes(h?.status) || Number.isNaN(Date.parse(h.at))) throw new Error('Una entrada del historial de revisión no es válida.');
    person(h.by, 'Revisión');
    if (h.note !== undefined && (typeof h.note !== 'string' || h.note.length > 2000)) throw new Error('La nota de una revisión no es válida.');
  }
  return value;
}

// ---------- Estructura de la plantilla (patch.layout, patch.items, patch.sectionStyles, patch.buttons) ----------
// Las funciones para armar el patch viven en layout.js; aquí solo la validación, porque core.js debe poder cargarse solo.
export const CLONE_ID_RE = /^[a-z][a-z0-9]{3,11}$/;
export const LIST_ID_RE = /^[A-Za-z0-9_~-]{1,100}$/;
export const ITEM_ID_RE = /^[A-Za-z0-9_~-]{1,100}:(?:\d{1,5}|[a-z][a-z0-9]{3,11})$/;
export const PAD_STEPS = [0, 8, 16, 24, 32, 48, 64, 80, 96, 120, 160, 200, 240];
export const RADIUS_STEPS = [0, 2, 4, 6, 8, 12, 16, 24, 32, 999];
export const MAX_CLONES = 40;
const FORBIDDEN = ['__proto__', 'prototype', 'constructor'];
const hexOK = v => typeof v === 'string' && /^#(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(v);
const idOK = (v, max = 300) => typeof v === 'string' && v.length > 0 && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v) && !FORBIDDEN.includes(v);
const record = v => !!v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
// Misma regla que las imágenes de los bloques: data: de imagen raster, https o ruta del sitio. Sin comillas, espacios ni paréntesis.
export const imageSrcOK = v => typeof v === 'string' && v.length > 0 && v.length <= 20 * 1024 * 1024 && (/^data:image\/(?:png|jpeg|webp|avif);base64,[A-Za-z0-9+/]*={0,2}$/i.test(v) || /^https:\/\/[^\s"'<>\\()]+$/i.test(v) || /^\/(?!\/)[^\s"'<>\\()]*$/.test(v));

// ---------- identificadores ----------
export const baseId = id => String(id).split('~')[0];
export const rebaseId = (id, cloneId) => baseId(id) + '~' + cloneId;
export const sectionCloneId = entry => baseId(entry.of) + '~' + entry.id;
export const itemCloneId = (listId, entry) => listId + ':' + entry.id;
export const itemList = itemId => String(itemId).slice(0, String(itemId).lastIndexOf(':'));
// ---------- validación ----------
function stringList(value, label, { max = 300, test = idOK } = {}) {
  if (!Array.isArray(value) || value.length > max) throw new Error(`${label} debe ser una lista de hasta ${max} elementos.`);
  const seen = new Set();
  for (const v of value) { if (!test(v) || seen.has(v)) throw new Error(`${label} contiene un identificador inválido o repetido.`); seen.add(v); }
}
export function validateLayout(layout) {
  if (!record(layout)) throw new Error('El campo layout debe ser un objeto.');
  for (const key of Object.keys(layout)) if (!['order', 'removed', 'clones'].includes(key)) throw new Error(`El campo layout.${key} no está permitido.`);
  if (layout.order !== undefined) stringList(layout.order, 'layout.order');
  if (layout.removed !== undefined) stringList(layout.removed, 'layout.removed');
  if (layout.clones !== undefined) {
    if (!Array.isArray(layout.clones) || layout.clones.length > MAX_CLONES) throw new Error(`Se admiten hasta ${MAX_CLONES} secciones duplicadas.`);
    const ids = new Set(); const full = new Set();
    for (const c of layout.clones) {
      if (!record(c) || Object.keys(c).some(k => !['id', 'of', 'after'].includes(k))) throw new Error('Una sección duplicada no es válida.');
      if (typeof c.id !== 'string' || !CLONE_ID_RE.test(c.id) || ids.has(c.id)) throw new Error('Una sección duplicada tiene un identificador inválido o repetido.');
      if (!idOK(c.of)) throw new Error('Una sección duplicada no indica su origen.');
      if (c.after !== undefined && c.after !== '' && !idOK(c.after)) throw new Error('La posición de una sección duplicada no es válida.');
      if (c.of.includes('~') && !full.has(c.of)) throw new Error('Una sección duplicada apunta a un origen que no existe.');
      ids.add(c.id); full.add(sectionCloneId(c));
    }
  }
  return layout;
}
export function validateItems(items) {
  if (!record(items)) throw new Error('El campo items debe ser un objeto.');
  const lists = Object.entries(items);
  if (lists.length > 120) throw new Error('Hay demasiadas listas con cambios (máximo 120).');
  for (const [listId, spec] of lists) {
    if (!LIST_ID_RE.test(listId) || FORBIDDEN.includes(listId)) throw new Error('Una lista tiene un identificador inválido.');
    if (!record(spec)) throw new Error('Los cambios de una lista no son válidos.');
    for (const key of Object.keys(spec)) if (!['order', 'removed', 'clones'].includes(key)) throw new Error(`El campo items.${key} no está permitido.`);
    const own = id => typeof id === 'string' && ITEM_ID_RE.test(id) && id.startsWith(listId + ':') && itemList(id) === listId;
    if (spec.order !== undefined) stringList(spec.order, 'items.order', { test: own });
    if (spec.removed !== undefined) stringList(spec.removed, 'items.removed', { test: own });
    if (spec.clones !== undefined) {
      if (!Array.isArray(spec.clones) || spec.clones.length > MAX_CLONES) throw new Error(`Se admiten hasta ${MAX_CLONES} elementos duplicados por lista.`);
      const ids = new Set(); const full = new Set();
      for (const c of spec.clones) {
        if (!record(c) || Object.keys(c).some(k => !['id', 'of'].includes(k))) throw new Error('Un elemento duplicado no es válido.');
        if (typeof c.id !== 'string' || !CLONE_ID_RE.test(c.id) || ids.has(c.id)) throw new Error('Un elemento duplicado tiene un identificador inválido o repetido.');
        if (!own(c.of)) throw new Error('Un elemento duplicado apunta a un origen de otra lista.');
        const suffix = c.of.slice(listId.length + 1);
        if (!/^\d+$/.test(suffix) && !full.has(c.of)) throw new Error('Un elemento duplicado apunta a un origen que no existe.');
        ids.add(c.id); full.add(itemCloneId(listId, c));
      }
    }
  }
  return items;
}
export function validateSectionStyles(map) {
  if (!record(map)) throw new Error('El campo sectionStyles debe ser un objeto.');
  const entries = Object.entries(map);
  if (entries.length > 300) throw new Error('Hay demasiados estilos de sección (máximo 300).');
  const allowed = ['padTop', 'padBottom', 'align', 'bg', 'bgImage', 'overlay', 'hideMobile', 'hideDesktop'];
  for (const [id, s] of entries) {
    if (!idOK(id)) throw new Error('El identificador de un estilo de sección no es válido.');
    if (!record(s)) throw new Error('El estilo de una sección no es válido.');
    for (const [k, v] of Object.entries(s)) {
      if (!allowed.includes(k)) throw new Error(`El estilo de sección ${k} no está permitido.`);
      if ((k === 'padTop' || k === 'padBottom') && !PAD_STEPS.includes(v)) throw new Error('El espaciado de una sección debe ser uno de los pasos permitidos.');
      else if (k === 'align' && !['left', 'center', 'right'].includes(v)) throw new Error('La alineación de una sección no es válida.');
      else if (k === 'bg' && !hexOK(v)) throw new Error('El color de fondo de una sección debe ser hexadecimal (#RRGGBB).');
      else if (k === 'overlay' && !(Number.isInteger(v) && v >= 0 && v <= 90)) throw new Error('La superposición debe estar entre 0 y 90 %.');
      else if ((k === 'hideMobile' || k === 'hideDesktop') && typeof v !== 'boolean') throw new Error('Ocultar en móvil o escritorio debe ser sí o no.');
      else if (k === 'bgImage') {
        if (!record(v) || Object.keys(v).some(x => !['src', 'position', 'fit'].includes(x))) throw new Error('La imagen de fondo de una sección no es válida.');
        if (!imageSrcOK(v.src)) throw new Error('La imagen de fondo debe ser PNG, JPEG, WebP o AVIF, una URL https o una ruta del sitio.');
        if (v.position !== undefined && !/^\d{1,3}(?:\.\d+)?% \d{1,3}(?:\.\d+)?%$/.test(v.position)) throw new Error('El encuadre del fondo no es válido.');
        if (v.fit !== undefined && !['cover', 'contain'].includes(v.fit)) throw new Error('El ajuste del fondo debe ser cover o contain.');
      }
    }
  }
  return map;
}
export function validateButtons(map) {
  if (!record(map)) throw new Error('El campo buttons debe ser un objeto.');
  const entries = Object.entries(map);
  if (entries.length > 400) throw new Error('Hay demasiados botones con estilo propio (máximo 400).');
  for (const [id, s] of entries) {
    if (!idOK(id)) throw new Error('El identificador de un botón no es válido.');
    if (!record(s)) throw new Error('El estilo de un botón no es válido.');
    for (const [k, v] of Object.entries(s)) {
      if (!['bg', 'color', 'border', 'radius', 'variant'].includes(k)) throw new Error(`El estilo de botón ${k} no está permitido.`);
      if (['bg', 'color', 'border'].includes(k) && !hexOK(v)) throw new Error('Los colores de un botón deben ser hexadecimales (#RRGGBB).');
      if (k === 'radius' && !RADIUS_STEPS.includes(v)) throw new Error('El radio de un botón debe ser uno de los pasos permitidos.');
      if (k === 'variant' && !['fill', 'outline'].includes(v)) throw new Error('La variante de un botón debe ser fill o outline.');
    }
  }
  return map;
}


export function validateProject(input) {
  const project=sanitize(input);
  if(projectByteSize(project)>MAX_PROJECT_BYTES)throw new Error('El proyecto supera 72 MB. Reduce los fotogramas o las imágenes para poder guardarlo y volver a importar tu copia.');
  for(const key of ['id','name','template'])if(typeof project[key]!=='string'||!project[key].trim()||project[key].length>300)throw new Error(`El proyecto necesita un campo ${key} válido.`);
  if(!project.patch||Array.isArray(project.patch)||typeof project.patch!=='object')throw new Error('El proyecto necesita los cambios en un objeto patch.');
  const p=project.patch;
  const record=(value,label)=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`El campo ${label} debe ser un objeto.`);};
  for(const key of ['texts','images','videos','links','colors','brand','seo','legal','typography','mediaMeta','sequences','styles','hidden','i18n','pages','layout','items','sectionStyles','buttons'])if(p[key]!==undefined)record(p[key],key);
  if(p.layout!==undefined)validateLayout(p.layout);
  if(p.items!==undefined)validateItems(p.items);
  if(p.sectionStyles!==undefined)validateSectionStyles(p.sectionStyles);
  if(p.buttons!==undefined)validateButtons(p.buttons);
  if(p.blocks!==undefined)validateBlocks(p.blocks);
  if(p.i18n!==undefined)validateI18n(p.i18n);
  if(p.pages!==undefined)validatePages(p.pages);
  if(project.comments!==undefined)validateComments(project.comments);
  if(project.review!==undefined)validateReview(project.review);
  for(const [id,style] of Object.entries(p.styles||{})) {
    if(!safeStyleKey(id))throw new Error('El identificador de un estilo no es válido.');
    record(style,'estilo');
    for(const [prop,value] of Object.entries(style))if(!isSafeStyle(prop,value))throw new Error(`El estilo ${prop} contiene un valor no permitido.`);
  }
  for(const [id,value] of Object.entries(p.hidden||{}))if(!safeStyleKey(id)||value!==true)throw new Error('El campo hidden solo admite elementos marcados como ocultos.');
  for(const key of ['texts','links','colors','typography','seo'])for(const value of Object.values(p[key]||{}))if(typeof value!=='string')throw new Error(`El campo ${key} debe contener texto.`);
  for(const value of Object.values(p.links||{}))if(!isSafeLink(value))throw new Error('El proyecto contiene un enlace no permitido.');
  for(const key of ['favicon','ogImage'])if(p.seo?.[key]!==undefined&&!safeSEOImage(p.seo[key]))throw new Error(`La imagen SEO ${key} no está permitida. Usa PNG, JPEG, WebP o AVIF, o una URL HTTP/HTTPS.`);
  if(p.seo?.canonical!==undefined&&!safeWebURL(p.seo.canonical))throw new Error('La URL canónica debe ser una URL HTTP o HTTPS válida.');
  for(const [key,value] of Object.entries(p.legal||{})) {
    if(!['privacyText','privacyUrl','termsText','termsUrl','cookiesText','cookiesUrl'].includes(key))throw new Error('El campo legal no está permitido.');
    if(typeof value!=='string')throw new Error(`El campo legal ${key} debe contener texto.`);
    if(key.endsWith('Text')&&value.length>30000)throw new Error('Cada texto legal admite hasta 30000 caracteres.');
    if(key.endsWith('Url')&&!safeWebURL(value,{allowFragment:true}))throw new Error('La URL legal debe ser HTTP/HTTPS o un ancla interna como #privacidad.');
  }
  for(const key of ['name','logo'])if(p.brand?.[key]!==undefined&&typeof p.brand[key]!=='string')throw new Error(`El campo de marca ${key} debe contener texto.`);
  for(const image of Object.values(p.images||{})) {
    record(image,'imagen');
    for(const key of ['src','alt','position','fit'])if(image[key]!==undefined&&typeof image[key]!=='string')throw new Error(`El campo de imagen ${key} debe contener texto.`);
    if(image.fit!==undefined&&!['cover','contain'].includes(image.fit))throw new Error('El ajuste de imagen debe ser cover o contain.');
    if(image.position!==undefined&&!/^\d{1,3}(?:\.\d+)?% \d{1,3}(?:\.\d+)?%$/.test(image.position))throw new Error('El campo de encuadre de imagen no es válido.');
  }
  for(const video of Object.values(p.videos||{})) {
    record(video,'video');
    for(const key of ['src','poster','fit','position'])if(video[key]!==undefined&&typeof video[key]!=='string')throw new Error(`El campo de video ${key} debe contener texto.`);
    if(video.src!==undefined&&!safeMediaSource(video.src,'video'))throw new Error('La fuente de video no está permitida. Usa MP4, WebM o una URL segura.');
    if(video.poster!==undefined&&!safeMediaSource(video.poster,'image'))throw new Error('La imagen de portada del video no está permitida.');
    if(video.fit!==undefined&&!['cover','contain'].includes(video.fit))throw new Error('El ajuste de video debe ser cover o contain.');
    if(video.position!==undefined&&!/^\d{1,3}(?:\.\d+)?% \d{1,3}(?:\.\d+)?%$/.test(video.position))throw new Error('El campo de encuadre de video no es válido.');
  }
  for(const sequence of Object.values(p.sequences||{})) {
    record(sequence,'secuencia');
    if(!Array.isArray(sequence.frames)||sequence.frames.length>300||sequence.frames.some(frame=>typeof frame!=='string'))throw new Error('La secuencia necesita hasta 300 fotogramas de imagen válidos.');
  }
  for(const key of ['createdAt','updatedAt'])if(project[key]!==undefined&&(typeof project[key]!=='string'||Number.isNaN(Date.parse(project[key]))))throw new Error('La fecha del proyecto no es válida.');
  return project;
}
// Valida solo el patch (lo que recibe el bridge, lo que guardan versiones y publicaciones). Lanza si algo no cumple la lista blanca.
export function validatePatch(patch) {
  return validateProject({ id: 'patch', name: 'patch', template: 'patch', patch }).patch;
}
export function parseProjectFile(text) {
  if(typeof text!=='string'||text.length>MAX_FILE)throw new Error('El archivo de proyecto es demasiado grande (máximo 80 MB).');
  let wrapper;try{wrapper=JSON.parse(text);}catch{throw new Error('El archivo no contiene un proyecto JSON válido.');}
  if(wrapper?.format!=='ornat-cms'||wrapper.version!==1)throw new Error('Formato o versión de proyecto no compatible.');
  return validateProject(wrapper.project);
}

export function projectByteSize(project) {
  return new TextEncoder().encode(JSON.stringify(project)).byteLength;
}

function safeMediaSource(src,kind) {
  if(!src)return true;
  if(/[\u0000-\u0020\u007f\\]/.test(src))return false;
  const data=kind==='video'?/^data:video\/(?:mp4|webm);base64,[A-Za-z0-9+/]*={0,2}$/i:/^data:image\/(?:png|jpeg|webp|avif);base64,[A-Za-z0-9+/]*={0,2}$/i;
  return data.test(src)||/^https?:\/\//i.test(src)||/^blob:https?:\/\//i.test(src)||/^\/(?!\/)/.test(src);
}

function safeWebURL(value,{allowFragment=false}={}) {
  if(typeof value!=='string'||value.length>4096)return false;
  if(value==='')return true;
  if(/[\u0000-\u0020\u007f\\]/.test(value))return false;
  if(allowFragment&&value.startsWith('#'))return value.length>1;
  if(!/^https?:\/\//i.test(value))return false;
  try {const parsed=new URL(value);return ['http:','https:'].includes(parsed.protocol)&&Boolean(parsed.hostname);}catch{return false;}
}

function safeSEOImage(value) {
  if(typeof value!=='string')return false;
  return /^data:image\/(?:png|jpeg|webp|avif);base64,[A-Za-z0-9+/]*={0,2}$/i.test(value)||safeWebURL(value);
}

export async function readVideo(file,{maxBytes=32*1024*1024}={}) {
  if(!['video/mp4','video/webm'].includes(file?.type))throw new Error('Sube un video MP4 o WebM.');
  if(!Number.isFinite(file.size)||file.size<=0||file.size>maxBytes)throw new Error(`El video debe pesar menos de ${Math.round(maxBytes/1024/1024)} MB.`);
  if(!globalThis.document||!globalThis.FileReader)throw new Error('La carga de video necesita un navegador compatible.');
  let objectURL,video;
  try {
    objectURL=URL.createObjectURL(file);
    video=document.createElement('video');
    video.preload='metadata';video.autoplay=false;video.muted=true;video.playsInline=true;
    const metadata=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{video.onloadedmetadata=video.onerror=null;reject(new Error('No se pudo leer el video a tiempo. Prueba un MP4 con códec H.264 o un WebM compatible.'));},20000);
      video.onloadedmetadata=()=>{
        clearTimeout(timer);video.onloadedmetadata=video.onerror=null;
        const width=video.videoWidth,height=video.videoHeight,duration=video.duration;
        if(!width||!height||!Number.isFinite(duration)||duration<=0){reject(new Error('El video no tiene dimensiones o duración válidas.'));return;}
        resolve({width,height,duration});
      };
      video.onerror=()=>{clearTimeout(timer);video.onloadedmetadata=video.onerror=null;reject(new Error('No se pudo leer este video. Prueba un MP4 con códec H.264 o un WebM compatible.'));};
      video.src=objectURL;
    });
    const src=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>typeof reader.result==='string'?resolve(reader.result):reject(new Error('No se pudo guardar el video.'));
      reader.onerror=reader.onabort=()=>reject(new Error('No se pudo leer el archivo de video. Inténtalo de nuevo.'));
      reader.readAsDataURL(file);
    });
    return {src,...metadata,bytes:file.size,type:file.type,name:String(file.name||'Video').slice(0,300)};
  } catch(error) {throw new Error(error?.message||'No se pudo preparar el video. Inténtalo con otro MP4 o WebM.');}
  finally {if(video){video.onloadedmetadata=video.onerror=null;video.removeAttribute('src');video.load();}if(objectURL)URL.revokeObjectURL(objectURL);}
}

// Íconos: PNG, WebP, JPEG o SVG. Un SVG nunca se guarda ni se inserta como código: se dibuja como imagen (ahí no corren scripts)
// y se re-codifica como PNG transparente. Así no puede llevar scripts, estilos externos ni referencias.
export async function readIcon(file,{maxBytes=2*1024*1024,size=512}={}) {
  if(file?.type!=='image/svg+xml')return readMedia(file,{logo:true,maxBytes:Math.max(maxBytes,6*1024*1024),maxDimension:size});
  if(!Number.isFinite(file.size)||file.size<=0||file.size>maxBytes)throw new Error(`El SVG debe pesar menos de ${Math.round(maxBytes/1024/1024)} MB.`);
  if(!globalThis.document)throw new Error('La carga de íconos necesita un navegador compatible.');
  const text=await file.text();
  if(!/<svg[\s>]/i.test(text))throw new Error('Ese archivo no es un SVG válido.');
  const url=URL.createObjectURL(new Blob([text],{type:'image/svg+xml'}));
  try {
    const img=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('No se pudo leer ese SVG.'));im.src=url;});
    const w0=img.naturalWidth||256,h0=img.naturalHeight||256,k=Math.min(1,size/Math.max(w0,h0))||1;
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w0*k));canvas.height=Math.max(1,Math.round(h0*k));
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Tu navegador no puede procesar este SVG.');
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const src=canvas.toDataURL('image/png');
    return {src,width:w0,height:h0,bytes:file.size,type:'image/svg+xml',name:String(file.name||'Ícono').slice(0,300),hasAlpha:true,storedWidth:canvas.width,storedHeight:canvas.height,storedBytes:Math.floor((src.length-src.indexOf(',')-1)*.75)};
  } finally {URL.revokeObjectURL(url);}
}

export async function readMedia(file,{logo=false,maxBytes=12*1024*1024,maxDimension=3840,compressionQuality=.86,quality}={}) {
  if(file?.type==='image/svg+xml')throw new Error('Para proteger tu proyecto, convierte el SVG a PNG transparente antes de subirlo.');
  if(!['image/png','image/jpeg','image/webp','image/avif'].includes(file?.type))throw new Error('Sube una imagen PNG, JPEG, WebP o AVIF.');
  if(!Number.isFinite(file.size)||file.size<=0||file.size>maxBytes)throw new Error(`La imagen debe pesar menos de ${Math.round(maxBytes/1024/1024)} MB.`);
  if(!globalThis.document)throw new Error('La carga de imágenes necesita un navegador compatible.');
  let bitmap,objectURL;
  try {
    if(globalThis.createImageBitmap)bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
    else bitmap=await new Promise((resolve,reject)=>{objectURL=URL.createObjectURL(file);const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('No se pudo leer la imagen.'));image.src=objectURL;});
    const width=bitmap.width||bitmap.naturalWidth,height=bitmap.height||bitmap.naturalHeight;
    if(!width||!height||width*height>100000000)throw new Error('Esta imagen es demasiado grande o no tiene dimensiones válidas. Reduce su resolución y vuelve a subirla.');
    const dimension=Math.max(64,Math.min(logo?1600:3840,Number(maxDimension)||(logo?1600:3840)));
    const scale=Math.min(1,dimension/Math.max(width,height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
    const ctx=canvas.getContext('2d',{willReadFrequently:logo});
    if(!ctx)throw new Error('Tu navegador no puede procesar esta imagen.');
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    let hasAlpha=false;
    if(logo) {const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;for(let i=3;i<pixels.length;i+=4)if(pixels[i]<255){hasAlpha=true;break;}}
    const requestedType=logo?'image/png':'image/webp';
    const encodingQuality=Math.max(.2,Math.min(1,Number(quality??compressionQuality)||.86));
    const src=canvas.toDataURL(requestedType,encodingQuality);
    return {src,width,height,bytes:file.size,type:file.type,name:String(file.name||'Imagen').slice(0,300),hasAlpha:logo?hasAlpha:undefined,storedWidth:canvas.width,storedHeight:canvas.height,storedBytes:Math.floor((src.length-src.indexOf(',')-1)*.75)};
  } catch(error) {throw new Error(error?.message||'No se pudo procesar esta imagen. Prueba con un PNG o JPEG.');}
  finally {bitmap?.close?.();if(objectURL)URL.revokeObjectURL(objectURL);}
}

export async function storageEstimate() {
  if(!globalThis.navigator?.storage?.estimate)return {usage:null,quota:null,available:null};
  const {usage=0,quota=0}=await navigator.storage.estimate();
  return {usage,quota,available:Math.max(0,quota-usage)};
}
