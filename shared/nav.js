// Valida el parámetro ?next= para evitar redirecciones abiertas: solo rutas internas del mismo sitio.
export function safeNext(raw, fallback = '') {
  if (typeof raw !== 'string') return fallback;
  let v = raw.trim();
  try { v = decodeURIComponent(v); } catch { return fallback; }
  if (!v.startsWith('/') || v.startsWith('//') || /[\\\s<>"'\u0000-\u001f]/.test(v) || v.length > 300) return fallback;
  return v;
}

export const NEXT_LABELS = [['/cms/', 'el Editor'], ['/control/', 'el CRM'], ['/propiedades/', 'Propiedades']];
export const nextLabel = next => (NEXT_LABELS.find(([p]) => next.startsWith(p)) || [, 'la página anterior'])[1];
