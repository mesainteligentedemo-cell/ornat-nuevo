// Almacenamiento del CMS en Supabase (tablas cms_*). core.js delega aquí cuando shared/remote-boot.js expone `remote`.
// Antes de guardar, cada imagen o video en data: se sube a Storage (bucket cms-media): en la base solo quedan URLs https.
import { remote } from '../shared/remote-boot.js';

const TABLES = { projects: 'cms_projects', versions: 'cms_versions', media: 'cms_media', kits: 'cms_kits', publications: 'cms_publications' };
const PAGE = 1000;
const UPLOADS_AT_ONCE = 4;
const DATA_URL = /^data:((?:image|video)\/[a-z0-9.+-]+);base64,/i;
const SAFE_URL = /^https:\/\/[^\s"'<>\\()]+$/i;
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm' };
const READ_ERROR = 'No se pudo leer la información de la nube. Revisa tu conexión e inténtalo de nuevo.';
const WRITE_ERROR = 'No se guardaron los cambios en la nube. Revisa tu conexión e inténtalo de nuevo.';

const bySource = new Map(); // data: URL → Promise<url pública>
const byHash = new Map();   // sha-256 de los bytes → Promise<url pública>: la misma imagen se sube una sola vez
const revs = new Map();     // id de proyecto → rev leída (concurrencia optimista)
const queues = new Map();   // id de proyecto → último guardado en curso (los guardados de una pestaña van en fila)
const publications = new Map();

const table = name => { if (!Object.hasOwn(TABLES, name)) throw new Error(`Almacén desconocido: ${name}.`); return TABLES[name]; };
const from = name => remote.client.from(table(name));
const failure = (error, text) => Object.assign(new Error(text), { code: error?.code || 'remote', cause: error });
const conflict = () => Object.assign(new Error('Otro usuario guardó cambios; recarga para ver la última versión'), { code: 'conflict' });
const text = value => typeof value === 'string' ? value : null;
const member = () => Boolean(remote.session && remote.profile && remote.orgId);

function auth() {
  if (remote.requireAuth() && remote.orgId) return;
  throw Object.assign(new Error('Inicia sesión para continuar.'), { code: 'auth' });
}

function columns(name, data) {
  if (name === 'projects') return { name: text(data.name), template: text(data.template) };
  if (name === 'versions' || name === 'publications') return { project_id: text(data.projectId) };
  return {};
}

// ---------- medios: data: → Storage ----------
const hex = buffer => [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
function cached(map, key, make) {
  if (!map.has(key)) map.set(key, make().catch(error => { map.delete(key); throw error; }));
  return map.get(key);
}
function upload(src) {
  return cached(bySource, src, async () => {
    const blob = await (await fetch(src)).blob();
    const hash = hex(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()));
    return cached(byHash, hash, async () => {
      const type = DATA_URL.exec(src)[1].toLowerCase();
      let result;
      try { result = await remote.uploadMedia('cms-media', blob, `${hash.slice(0, 32)}.${EXT[type] || 'bin'}`); }
      catch (error) { throw failure(error, 'No se pudo subir una imagen a la nube. Revisa tu conexión e inténtalo de nuevo.'); }
      if (!SAFE_URL.test(result?.url || '')) throw failure(null, 'La nube devolvió una dirección de imagen no válida.');
      return result.url;
    });
  });
}
function collect(value, found) {
  if (typeof value === 'string') { if (DATA_URL.test(value)) found.add(value); }
  else if (Array.isArray(value)) for (const item of value) collect(item, found);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) collect(item, found);
  return found;
}
function swap(value, urls) {
  if (typeof value === 'string') return urls.get(value) ?? value;
  if (Array.isArray(value)) return value.map(item => swap(item, urls));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, swap(item, urls)]));
  return value;
}
async function detach(value) {
  const sources = [...collect(value, new Set())];
  if (!sources.length) return value;
  const urls = new Map();
  for (let i = 0; i < sources.length; i += UPLOADS_AT_ONCE) {
    await Promise.all(sources.slice(i, i + UPLOADS_AT_ONCE).map(async src => urls.set(src, await upload(src))));
  }
  return swap(value, urls);
}

// ---------- publicaciones: visitantes sin sesión leen por RPC ----------
function unwrap(result) {
  if (result && typeof result === 'object' && 'error' in result && 'data' in result && !('id' in result)) {
    if (result.error) throw result.error;
    return result.data ?? null;
  }
  return result ?? null;
}
function publication(id) {
  return cached(publications, id, async () => {
    try { return unwrap(await remote.getPublication(id)); }
    catch (error) { throw failure(error, 'No se pudo abrir la publicación. Revisa tu conexión e inténtalo de nuevo.'); }
  });
}

// ---------- proyectos: rev con concurrencia optimista ----------
function serial(key, task) {
  const run = (queues.get(key) || Promise.resolve()).catch(() => {}).then(task);
  queues.set(key, run);
  run.finally(() => { if (queues.get(key) === run) queues.delete(key); }).catch(() => {});
  return run;
}
async function saveProjectRow(id, data) {
  const fields = { data, ...columns('projects', data), deleted_at: null };
  let expected = revs.get(id);
  if (expected === undefined) {
    const inserted = await from('projects').insert({ org_id: remote.orgId, id, ...fields }).select('rev').single();
    if (!inserted.error) { revs.set(id, inserted.data.rev); return; }
    if (inserted.error.code !== '23505') throw failure(inserted.error, WRITE_ERROR);
    // Ya existe: si estaba en la papelera se recupera; si no, otro usuario lo creó antes.
    const current = await from('projects').select('rev,deleted_at').eq('org_id', remote.orgId).eq('id', id).maybeSingle();
    if (current.error) throw failure(current.error, WRITE_ERROR);
    if (!current.data?.deleted_at) throw conflict();
    expected = current.data.rev;
  }
  const updated = await from('projects').update({ ...fields, rev: expected + 1 }).eq('org_id', remote.orgId).eq('id', id).eq('rev', expected).select('rev');
  if (updated.error) throw failure(updated.error, WRITE_ERROR);
  if (!updated.data?.length) throw conflict();
  revs.set(id, updated.data[0].rev);
}

// ---------- primitivas (mismas que dbAll/dbGet/dbPut/dbDelete/dbClear de core.js) ----------
async function all(name) {
  auth();
  const fields = name === 'projects' ? 'id,data,rev' : 'id,data';
  const rows = [];
  for (let start = 0; ; start += PAGE) {
    const { data, error } = await from(name).select(fields).eq('org_id', remote.orgId).is('deleted_at', null).order('id').range(start, start + PAGE - 1);
    if (error) throw failure(error, READ_ERROR);
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  if (name === 'projects') for (const row of rows) revs.set(row.id, row.rev);
  return rows.map(row => row.data);
}

async function get(name, id) {
  const key = String(id);
  if (name === 'publications' && !member()) return publication(key);
  auth();
  const { data, error } = await from(name).select(name === 'projects' ? 'id,data,rev' : 'id,data').eq('org_id', remote.orgId).eq('id', key).is('deleted_at', null).maybeSingle();
  if (error) throw failure(error, READ_ERROR);
  if (!data) return name === 'publications' ? publication(key).catch(() => null) : null;
  if (name === 'projects') revs.set(key, data.rev);
  return data.data;
}

async function put(name, value) {
  auth();
  table(name);
  const data = await detach(value);
  const id = String(data.id);
  if (name === 'projects') await serial(id, () => saveProjectRow(id, data));
  else {
    const { error } = await from(name).upsert({ org_id: remote.orgId, id, data, ...columns(name, data), deleted_at: null }, { onConflict: 'org_id,id' });
    if (error) throw failure(error, WRITE_ERROR);
  }
  if (name === 'publications') publications.delete(id);
  return data;
}

async function remove(name, id) {
  auth();
  const key = String(id);
  const { error } = await from(name).update({ deleted_at: new Date().toISOString() }).eq('org_id', remote.orgId).eq('id', key);
  if (error) throw failure(error, WRITE_ERROR);
  if (name === 'projects') revs.delete(key);
  if (name === 'publications') publications.delete(key);
}

async function clear(name) {
  auth();
  const { error } = await from(name).update({ deleted_at: new Date().toISOString() }).eq('org_id', remote.orgId).is('deleted_at', null);
  if (error) throw failure(error, WRITE_ERROR);
  if (name === 'projects') revs.clear();
  if (name === 'publications') publications.clear();
}

export const remoteStore = remote ? { all, get, put, delete: remove, clear } : null;
