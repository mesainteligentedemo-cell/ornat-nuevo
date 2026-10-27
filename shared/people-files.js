// ORNAT · archivos de expediente en IndexedDB (SOLO DEMO LOCAL).
// Datos personales sensibles (INE, CURP, RFC, NSS, comprobantes) no deben vivir en el navegador en producción:
// allí se suben a almacenamiento cifrado en backend con acceso por rol y URLs firmadas de corta vida.
const DB = 'ornat-people-files-v1'; const STORE = 'files';
export const MAX_FILE_BYTES = 3 * 1024 * 1024;
export const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

const open = () => new Promise((resolve, reject) => {
  if (!globalThis.indexedDB) return reject(new Error('Este navegador no permite guardar archivos locales.'));
  const req = indexedDB.open(DB, 1);
  req.onupgradeneeded = () => req.result.createObjectStore(STORE);
  req.onsuccess = () => resolve(req.result); req.onerror = () => reject(new Error('No se pudo abrir el almacenamiento local de archivos.'));
});
const tx = async (mode, fn) => { const db = await open(); return new Promise((resolve, reject) => { const t = db.transaction(STORE, mode); const r = fn(t.objectStore(STORE)); t.oncomplete = () => { db.close(); resolve(r?.result); }; t.onerror = () => { db.close(); reject(new Error('Falló el almacenamiento local de archivos.')); }; }); };
const key = (employeeId, docKey) => `${employeeId}|${docKey}`;

export function validateFile(file) {
  if (!file) throw new Error('Elige un archivo.');
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error('Solo se aceptan PDF, PNG, JPG o WebP.');
  if (file.size > MAX_FILE_BYTES) throw new Error('El archivo supera 3 MB.');
}
export async function putFile(employeeId, docKey, file) { validateFile(file); await tx('readwrite', s => s.put({ blob: file, name: String(file.name).slice(0, 120), type: file.type, size: file.size, at: new Date().toISOString() }, key(employeeId, docKey))); return String(file.name).slice(0, 120); }
export const getFile = (employeeId, docKey) => tx('readonly', s => s.get(key(employeeId, docKey)));
export const deleteFile = (employeeId, docKey) => tx('readwrite', s => s.delete(key(employeeId, docKey)));
export const clearFiles = () => tx('readwrite', s => s.clear());
