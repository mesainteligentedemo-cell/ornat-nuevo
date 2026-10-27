// ORNAT · formularios públicos -> cola de intake (CRM).
//
// USO
//   <form data-ornat-form="contacto">            nombre del formulario (queda en el registro)
//     <input name="name"> <input name="email" type="email"> <input name="phone" type="tel">
//     <textarea name="message"></textarea>
//     <input type="hidden" name="propertyId" value="...">   (o data-property-id en el <form>)
//     <button>Enviar</button>
//   </form>
//   <p data-ornat-status role="status" aria-live="polite"></p>   (opcional; si no existe se crea uno)
//   <script type="module" src="/shared/forms.js"></script>        conecta solos los [data-ornat-form]
//
//   import { attachAll, attachForm } from '/shared/forms.js';
//   attachAll();                  // además conecta formularios con campo email/tel sin data-ornat-form
//   attachForm(formEl, opts);     // un formulario concreto. data-ornat-form="off" lo excluye.
//   Atributo data-ornat-status="#id" en el <form> apunta a un elemento de estado existente.
//
// Anti-spam: campo trampa oculto (honeypot) + tiempo mínimo desde que aparece el formulario.
// Atribución: página y utm_* de la primera visita quedan en sessionStorage y viajan con el envío.
// Honestidad: en modo demo el texto dice que se guardó en este navegador, no que llegó a nadie.
import { data } from './data.js';

export const MIN_FILL_MS = 2000;
export const HONEYPOT_NAME = 'ornat_website';
const ATTR_KEY = 'ornat-attribution-v1';
const UTM_KEYS = ['source', 'medium', 'campaign', 'term', 'content'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MESSAGES = {
  demo: 'Recibido. (Demo: se guardó en el CRM de este navegador; al conectar el backend llegará a tu equipo.)',
  live: 'Recibido. Tu equipo ya puede verlo.',
  tooFast: 'Un momento: espera un par de segundos y vuelve a enviar.',
};

/** Extrae utm_* de un querystring -> {source, medium, campaign, term, content} (solo los presentes). */
export function readUtm(search = '') {
  const params = new URLSearchParams(search);
  const out = {};
  for (const k of UTM_KEYS) { const v = (params.get(`utm_${k}`) || '').trim().slice(0, 200); if (v) out[k] = v; }
  return out;
}

/** Guarda la atribución de la primera visita de la sesión y la devuelve. No pisa una atribución previa con utm. */
export function captureAttribution(storage, location = {}, referrer = '') {
  let saved = null;
  try { saved = JSON.parse(storage?.getItem(ATTR_KEY) || 'null'); } catch { saved = null; }
  const current = readUtm(location.search || '');
  if (saved && (Object.keys(saved.utm || {}).length || !Object.keys(current).length)) return saved;
  const next = { utm: current, landing: String(location.pathname || '/').slice(0, 500), referrer: String(referrer || '').slice(0, 300), at: new Date().toISOString() };
  try { storage?.setItem(ATTR_KEY, JSON.stringify(next)); } catch { /* sin almacenamiento: seguimos sin atribución persistida */ }
  return next;
}

/**
 * Valida un envío. Devuelve { ok, spam, error, values }.
 * - spam:true  -> honeypot lleno: se descarta en silencio.
 * - error      -> mensaje en español para mostrar.
 */
export function validateSubmission(fields, { startedAt = 0, now = Date.now(), minMs = MIN_FILL_MS } = {}) {
  const f = fields || {};
  const clip = (v, n) => String(v ?? '').trim().slice(0, n);
  if (clip(f[HONEYPOT_NAME], 200)) return { ok: false, spam: true };
  const values = { name: clip(f.name, 150), email: clip(f.email, 250).toLowerCase(), phone: clip(f.phone, 80), message: clip(f.message, 5000), propertyId: clip(f.propertyId, 100) };
  if (!values.email && !values.phone) return { ok: false, error: 'Escribe un correo o un teléfono para poder responderte.' };
  if (values.email && !EMAIL.test(values.email)) return { ok: false, error: 'Escribe un correo válido, por ejemplo nombre@dominio.com.' };
  if (values.phone && !/^[0-9+()\-.\s]{6,80}$/.test(values.phone)) return { ok: false, error: 'Escribe un teléfono válido (solo números, espacios, + y guiones).' };
  if (startedAt && now - startedAt < minMs) return { ok: false, error: MESSAGES.tooFast, tooFast: true };
  return { ok: true, values };
}

/** Arma el objeto que recibe data().intake.push. */
export function buildIntake(values, { form = '', page = '', attribution = {} } = {}) {
  return { ...values, form, page, utm: attribution.utm || {} };
}

function statusElement(form) {
  const sel = form.dataset.ornatStatus;
  let el = sel ? document.querySelector(sel) : form.querySelector('[data-ornat-status]') || form.parentElement?.querySelector('[data-ornat-status]');
  if (!el) {
    el = document.createElement('p');
    el.dataset.ornatStatus = ''; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    form.after(el);
  }
  return el;
}

function addHoneypot(form) {
  if (form.querySelector(`[name="${HONEYPOT_NAME}"]`)) return;
  const wrap = document.createElement('div');
  wrap.setAttribute('aria-hidden', 'true');
  wrap.style.cssText = 'position:absolute!important;left:-9999px!important;width:1px;height:1px;overflow:hidden';
  wrap.innerHTML = `<label>No llenar este campo<input type="text" name="${HONEYPOT_NAME}" tabindex="-1" autocomplete="off"></label>`;
  form.append(wrap);
}

const attached = new WeakSet();

/** Conecta un formulario. Devuelve una función para desconectarlo. */
export function attachForm(form, { api = data, storage = globalThis.sessionStorage, minMs = MIN_FILL_MS } = {}) {
  if (!form || attached.has(form) || form.dataset.ornatForm === 'off') return () => {};
  attached.add(form);
  addHoneypot(form);
  const status = statusElement(form);
  const startedAt = Date.now();
  const onSubmit = event => {
    event.preventDefault();
    const fd = new FormData(form);
    const fields = Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === 'string'));
    if (!fields.propertyId && form.dataset.propertyId) fields.propertyId = form.dataset.propertyId;
    const result = validateSubmission(fields, { startedAt, minMs });
    if (result.spam) { form.reset(); return; }
    if (!result.ok) { status.textContent = result.error; status.dataset.state = 'error'; return; }
    try {
      const attribution = captureAttribution(storage, globalThis.location || {}, globalThis.document?.referrer);
      const item = buildIntake(result.values, { form: form.dataset.ornatForm || form.id || 'formulario', page: globalThis.location?.pathname || '', attribution });
      const pushed = api().intake.push(item);
      const done = () => { status.textContent = api().backend().connected ? MESSAGES.live : MESSAGES.demo; status.dataset.state = 'saved'; form.reset(); form.dispatchEvent(new CustomEvent('ornat:submitted', { bubbles: true, detail: item })); };
      if (pushed && typeof pushed.then === 'function') pushed.then(done, error => { status.textContent = `No se envió: ${error.message}`; status.dataset.state = 'error'; });
      else done();
    } catch (error) {
      status.textContent = `No se guardó: ${error.message}`;
      status.dataset.state = 'error';
    }
  };
  form.addEventListener('submit', onSubmit);
  form.noValidate = true; // los mensajes los damos nosotros, en español y con aria-live
  return () => { form.removeEventListener('submit', onSubmit); attached.delete(form); };
}

/** Conecta todos los [data-ornat-form] y, con attachAll(), también los que tengan campo email/tel. */
export function attachAll(root = globalThis.document, opts = {}) {
  if (!root) return [];
  const forms = new Set(root.querySelectorAll('form[data-ornat-form]'));
  for (const form of root.querySelectorAll('form')) {
    if (form.dataset.ornatForm === 'off') continue;
    if (form.querySelector('input[type="email"], input[type="tel"], input[name="email"], input[name="phone"]')) forms.add(form);
  }
  return [...forms].map(form => attachForm(form, opts));
}

if (globalThis.document) {
  try { captureAttribution(globalThis.sessionStorage, globalThis.location, globalThis.document.referrer); } catch { /* ignorar */ }
  const boot = () => { for (const form of document.querySelectorAll('form[data-ornat-form]')) attachForm(form); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
}
