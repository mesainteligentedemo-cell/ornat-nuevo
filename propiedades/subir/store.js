// ORNAT · almacén del borrador del alta con IA.
//
// POR QUÉ DOS ALMACENES (el límite de 4 MB):
//   shared/data.js guarda el inventario en localStorage y rechaza más de 4 MB en total. Las fotos originales
//   (hasta 30 × ~400 KB a 2400 px) no caben ahí. Por eso:
//     - las fotos grandes y las miniaturas viven en IndexedDB propio ("ornat-property-draft"), que admite cientos de MB;
//     - el estado del borrador (texto: datos, copy, análisis, orden) vive en localStorage bajo una clave aparte y pesa unos KB;
//     - al PUBLICAR, el inventario recibe solo versiones web ligeras (data URL WebP) ajustadas al espacio libre
//       que queda de los 4 MB (ver publishBudget en subir.js). Con Supabase Storage este recorte desaparece.
// Si IndexedDB no está disponible (navegación privada estricta) el borrador funciona en memoria y avisa que no persistirá.

const DB = 'ornat-property-draft';
const STORE = 'photos';
const KEY = 'ornat-property-draft-v1';

let dbPromise;
function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('IndexedDB no disponible'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB bloqueado'));
  });
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}
const run = (mode, fn) => open().then(db => new Promise((resolve, reject) => {
  const tx = db.transaction(STORE, mode); const st = tx.objectStore(STORE); const out = fn(st);
  tx.oncomplete = () => resolve(out?.result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
}));

export const blobStore = {
  available: () => open().then(() => true, () => false),
  put: (key, value) => run('readwrite', st => st.put(value, key)),
  get: key => run('readonly', st => st.get(key)),
  del: key => run('readwrite', st => st.delete(key)),
  async clearDraft(draftId) {
    const db = await open();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite'); const st = tx.objectStore(STORE); const req = st.openCursor();
      req.onsuccess = () => { const c = req.result; if (!c) return; if (String(c.key).startsWith(`${draftId}:`)) c.delete(); c.continue(); };
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
  },
};

export const draftStore = {
  load() { try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } },
  save(state) { try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch { return false; } },
  clear() { try { localStorage.removeItem(KEY); } catch { /* sin almacenamiento */ } },
  bytes() { try { return (localStorage.getItem(KEY) || '').length; } catch { return 0; } },
};
