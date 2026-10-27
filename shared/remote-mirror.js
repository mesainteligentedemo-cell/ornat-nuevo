// ORNAT · espejo Supabase con API de localStorage (síncrona).
// createMirror({client, orgId, spec}) hidrata las tablas de spec.tables, devuelve un adaptador
// {getItem, setItem, removeItem, status, flush, rehydrate, close} y lo mantiene al día con Realtime.
//
// spec = { key, tables, fromRows(rowsByTable) -> state, toRows(state) -> {[tabla]: [{id, data, cols}]} }
//   tables: 'crm_leads' o { name, entity = true, write = 'all' | 'insert' | 'remove' | 'none',
//            removeColumn = 'deleted_at', whereNull = [], order = {column, ascending}, limit }
//     entity:false  -> tabla sin columna data/deleted_at (ej. profiles): data = la fila completa.
//     write:'insert' -> solo altas (ON CONFLICT DO NOTHING); cambios y bajas se ignoran (bitácoras).
//     write:'remove' -> solo bajas: update set <removeColumn> = now() (ej. formularios procesados).
//     write:'none'   -> solo lectura.
//   rowsByTable[t] = [{id, data, cols}] sin filas borradas; cols = columnas extraídas tal como llegan.
//   Solo se comparan las tablas que devuelve toRows: una tabla ausente nunca se borra.
// Cambios locales -> outbox (localStorage['ornat-outbox:'+key]) -> upsert/baja con 300 ms de espera,
// reintento con backoff y envío keepalive al cerrar la página. Realtime -> StorageEvent('storage', {key}).

export const OUTBOX_PREFIX = 'ornat-outbox:';
const SENT_TTL = 120000;
const PAGE = 1000;
const CHUNK = 500;

export function canonical(value) {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).filter(k => value[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
}

export const normalizeTable = t => {
  const o = typeof t === 'string' ? { name: t } : { ...t };
  return { entity: true, write: 'all', removeColumn: 'deleted_at', whereNull: [], order: null, limit: 0, ...o };
};

const SKIP_COLS = new Set(['org_id', 'id', 'data', 'updated_by', 'deleted_at']);
const toRecord = (t, row) => {
  if (!t.entity) return { id: String(row.id), data: row, cols: {} };
  const cols = {}; for (const [k, v] of Object.entries(row)) if (!SKIP_COLS.has(k)) cols[k] = v;
  return { id: String(row.id), data: row.data, cols };
};
const isLive = (t, row) => (!t.entity || row.deleted_at == null) && t.whereNull.every(c => row[c] == null);
const opKey = (table, id) => `${table}\u0000${id}`;
// Rechazos definitivos (permiso, validación, 4xx): no se reintentan; se descarta la escritura y se resincroniza.
const FATAL_CODES = /^(42501|P0001|PGRST|22|23|42)/;
export const isFatal = res => {
  const status = Number(res?.status) || 0; const code = String(res?.error?.code || '');
  return FATAL_CODES.test(code) || (status >= 400 && status < 500 && status !== 408 && status !== 429);
};
const errText = e => String(e?.message || e || 'Error desconocido');

function storageEvent(key) {
  if (typeof StorageEvent === 'function') { try { return new StorageEvent('storage', { key }); } catch {} }
  const e = new Event('storage'); Object.defineProperty(e, 'key', { value: key }); return e;
}

export async function createMirror({
  client, orgId, spec,
  storage = globalThis.localStorage,
  target = globalThis,
  rest = null,                       // { url, apikey, token: () => string } para el envío keepalive
  debounceMs = 300,
  maxBackoffMs = 30000,
  timers = { set: (fn, ms) => setTimeout(fn, ms), clear: id => clearTimeout(id) },
  online = () => globalThis.navigator?.onLine ?? true,
  now = () => new Date().toISOString(),
}) {
  if (!client || !orgId) throw new Error('Sin sesión con organización.');
  const tables = spec.tables.map(normalizeTable);
  const byName = Object.fromEntries(tables.map(t => [t.name, t]));
  const outboxKey = OUTBOX_PREFIX + spec.key;
  const server = Object.fromEntries(tables.map(t => [t.name, new Map()]));
  let state = null, baseline = {};
  const ops = new Map(); let seq = 0;
  const sent = new Map();            // opKey -> Map(canon(data) -> ms)
  let lastError = null, attempt = 0, timer = null, flushing = null, again = false, closed = false, rejected = null, needsResync = false;
  let ready = false; const buffered = [];

  /* ---------- estado ---------- */
  const indexRows = rows => {
    const out = {};
    for (const [table, list] of Object.entries(rows || {})) {
      if (!byName[table]) continue;
      const m = new Map();
      for (const r of list || []) m.set(String(r.id), { canon: canonical({ data: r.data, cols: r.cols || {} }), row: r });
      out[table] = m;
    }
    return out;
  };
  const recompute = () => {
    const rowsByTable = Object.fromEntries(tables.map(t => [t.name, [...server[t.name].values()]]));
    state = spec.fromRows(rowsByTable);
    baseline = indexRows(spec.toRows(state));
  };
  const notifyStatus = () => {
    try { target.dispatchEvent?.(Object.assign(new Event('ornat:sync'), { detail: { key: spec.key, ...status() } })); } catch {}
  };
  const emit = () => { try { target.dispatchEvent?.(storageEvent(spec.key)); } catch {} };

  /* ---------- outbox ---------- */
  const persist = () => {
    try {
      if (!ops.size) storage?.removeItem?.(outboxKey);
      else storage?.setItem?.(outboxKey, JSON.stringify({ orgId, ops: [...ops.values()].map(({ table, id, op, row }) => ({ table, id, op, row })) }));
    } catch {}
  };
  const enqueue = (table, id, op, row = null) => { ops.set(opKey(table, id), { table, id, op, row, v: ++seq }); };
  const loadOutbox = () => {
    try {
      const saved = JSON.parse(storage?.getItem?.(outboxKey) || 'null');
      if (!saved || saved.orgId !== orgId || !Array.isArray(saved.ops)) return;
      for (const o of saved.ops) if (byName[o?.table] && o.id != null && (o.op === 'remove' || (o.op === 'upsert' && o.row))) enqueue(o.table, String(o.id), o.op, o.row);
    } catch {}
  };
  const applyOpsToServer = () => {
    for (const o of ops.values()) {
      if (o.op === 'upsert') server[o.table].set(o.id, { id: o.id, data: o.row.data, cols: o.row.cols || {} });
      else server[o.table].delete(o.id);
    }
  };
  const markSent = (table, id, data) => {
    const k = opKey(table, id); const t = Date.now();
    const m = sent.get(k) || new Map(); for (const [c, at] of m) if (t - at > SENT_TTL) m.delete(c);
    m.set(canonical(data), t); sent.set(k, m);
  };

  const groups = list => {
    const out = new Map();
    for (const o of list) { const g = `${o.op}\u0000${o.table}`; if (!out.has(g)) out.set(g, { op: o.op, table: o.table, items: [] }); out.get(g).items.push(o); }
    return [...out.values()];
  };
  const upsertRow = (t, o) => ({ org_id: orgId, id: o.id, ...(t.entity ? { data: o.row.data } : {}), ...(o.row.cols || {}), ...(t.entity ? { deleted_at: null } : {}) });

  async function send(batch) {
    for (const g of groups(batch)) {
      const t = byName[g.table];
      for (let i = 0; i < g.items.length; i += CHUNK) {
        const items = g.items.slice(i, i + CHUNK);
        let res;
        if (g.op === 'upsert') {
          items.forEach(o => markSent(g.table, o.id, o.row.data));
          res = await client.from(g.table).upsert(items.map(o => upsertRow(t, o)), { onConflict: 'org_id,id', ignoreDuplicates: t.write === 'insert' });
        } else {
          res = await client.from(g.table).update({ [t.removeColumn]: now() }).eq('org_id', orgId).in('id', items.map(o => o.id));
        }
        if (res?.error && !isFatal(res)) throw new Error(`${g.table}: ${res.error.message || res.error}`);
        for (const o of items) { const k = opKey(o.table, o.id); if (ops.get(k) === o) ops.delete(k); }
        persist();
        if (res?.error) { rejected = `${g.table}: ${res.error.message || res.error}`; needsResync = true; }
      }
    }
  }

  function schedule(ms = debounceMs) {
    if (closed) return;
    if (timer) timers.clear(timer);
    timer = timers.set(() => { timer = null; flush().catch(() => {}); }, ms);
  }

  async function flush() {
    if (flushing) { again = true; return flushing; }
    if (!ops.size || closed) return;
    if (timer) { timers.clear(timer); timer = null; }
    flushing = (async () => {
      try {
        rejected = null;
        await send([...ops.values()]);
        lastError = rejected; attempt = 0;
        if (needsResync) { needsResync = false; await hydrate().then(emit, () => {}); }
      } catch (e) {
        lastError = errText(e); attempt++;
        schedule(Math.min(maxBackoffMs, 1000 * 2 ** (attempt - 1)));
        throw e;
      } finally {
        flushing = null; notifyStatus();
        if (again) { again = false; if (ops.size && !lastError) schedule(0); }
      }
    })();
    return flushing;
  }

  /* ---------- envío al cerrar la página ---------- */
  let lastKeepalive = 0;
  function keepaliveFlush() {
    if (!rest?.url || !ops.size || typeof fetch !== 'function' || Date.now() - lastKeepalive < 1000) return;
    lastKeepalive = Date.now();
    const token = rest.token?.() || '';
    const headers = { apikey: rest.apikey, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    let budget = 60000;
    for (const g of groups([...ops.values()])) {
      const t = byName[g.table];
      let url, init;
      if (g.op === 'upsert') {
        const body = JSON.stringify(g.items.map(o => upsertRow(t, o)));
        url = `${rest.url}/rest/v1/${g.table}?on_conflict=org_id,id`;
        init = { method: 'POST', body, headers: { ...headers, Prefer: `resolution=${t.write === 'insert' ? 'ignore' : 'merge'}-duplicates,return=minimal` } };
      } else {
        const ids = g.items.map(o => `"${String(o.id).replace(/(["\\])/g, '\\$1')}"`).join(',');
        url = `${rest.url}/rest/v1/${g.table}?org_id=eq.${encodeURIComponent(orgId)}&id=in.(${encodeURIComponent(ids)})`;
        init = { method: 'PATCH', body: JSON.stringify({ [t.removeColumn]: now() }), headers: { ...headers, Prefer: 'return=minimal' } };
      }
      budget -= init.body.length; if (budget < 0) break;
      try { fetch(url, { ...init, keepalive: true }); } catch {}
    }
  }

  /* ---------- Realtime ---------- */
  function onChange(table, payload) {
    if (!ready) { buffered.push([table, payload]); return; }
    const t = byName[table]; if (!t) return;
    const row = payload?.eventType === 'DELETE' ? payload.old : payload?.new;
    if (!row || row.id == null || (row.org_id && row.org_id !== orgId)) return;
    const id = String(row.id); const k = opKey(table, id);
    if (ops.has(k)) return;                                   // el cambio local pendiente manda
    const cur = server[table].get(id);
    if (payload.eventType === 'DELETE' || !isLive(t, row)) {
      if (!cur) return;
      server[table].delete(id);
    } else {
      const rec = toRecord(t, row); const c = canonical(rec.data);
      if (cur && canonical(cur.data) === c) { cur.cols = rec.cols; return; }   // eco o sin cambios
      if (sent.get(k)?.has(c)) return;                          // eco de una escritura nuestra anterior
      server[table].set(id, rec);
    }
    recompute(); emit();
  }

  /* ---------- hidratación ---------- */
  async function fetchTable(t) {
    const out = [];
    for (let from = 0; ; from += PAGE) {
      const to = t.limit ? Math.min(from + PAGE, t.limit) - 1 : from + PAGE - 1;
      if (to < from) break;
      let q = client.from(t.name).select('*').eq('org_id', orgId);
      if (t.entity) q = q.is('deleted_at', null);
      for (const c of t.whereNull) q = q.is(c, null);
      q = q.order(t.order?.column || 'id', { ascending: t.order?.ascending !== false });
      const { data, error } = await q.range(from, to);
      if (error) throw new Error(`${t.name}: ${error.message || error}`);
      out.push(...(data || []));
      if (!data || data.length < to - from + 1 || (t.limit && out.length >= t.limit)) break;
    }
    return out;
  }
  async function hydrate() {
    const results = await Promise.all(tables.map(fetchTable));
    tables.forEach((t, i) => { server[t.name].clear(); for (const row of results[i]) if (isLive(t, row)) { const r = toRecord(t, row); server[t.name].set(r.id, r); } });
    applyOpsToServer();
    recompute();
  }

  let channel = null;
  if (typeof client.channel === 'function') {
    channel = client.channel(`ornat-mirror:${spec.key}:${orgId}`);
    for (const t of tables) channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: t.name, filter: `org_id=eq.${orgId}` }, p => onChange(t.name, p));
    let subscribedOnce = false;
    channel.subscribe?.(s => { if (s !== 'SUBSCRIBED') return; if (subscribedOnce) rehydrate().catch(() => {}); subscribedOnce = true; });
  }

  loadOutbox();
  await hydrate();
  ready = true;
  for (const [table, payload] of buffered.splice(0)) onChange(table, payload);

  async function rehydrate() {
    if (closed) return;
    await hydrate(); emit(); notifyStatus();
  }

  const onOnline = () => { flush().catch(() => {}); rehydrate().catch(() => {}); };
  const onOffline = () => notifyStatus();
  const onHide = () => keepaliveFlush();
  const onVisibility = () => { if (globalThis.document?.visibilityState === 'hidden') flush().catch(() => {}); };
  target.addEventListener?.('online', onOnline);
  target.addEventListener?.('offline', onOffline);
  target.addEventListener?.('pagehide', onHide);
  target.addEventListener?.('beforeunload', onHide);
  globalThis.document?.addEventListener?.('visibilitychange', onVisibility);

  function status() { return { pending: ops.size, lastError, online: online() }; }

  // `state` solo se reemplaza (nunca se muta), así que la cadena se recalcula únicamente cuando cambia.
  let servedFor, servedJson = null;
  const adapter = {
    getItem(key) {
      if (key !== spec.key) return null;
      if (servedFor !== state) { servedJson = JSON.stringify(state); servedFor = state; }
      return servedJson;
    },
    setItem(key, json) {
      if (key !== spec.key) return;
      const next = JSON.parse(json);
      const rows = spec.toRows(next) || {};
      for (const [table, list] of Object.entries(rows)) {
        const t = byName[table]; if (!t || t.write === 'none') continue;
        const prev = baseline[table] || new Map(); const seen = new Map();
        for (const r of list || []) {
          const id = String(r.id); const row = { data: r.data, cols: r.cols || {} };
          const c = canonical(row); seen.set(id, { canon: c, row: r });
          const old = prev.get(id);
          if (old?.canon === c || t.write === 'remove' || (t.write === 'insert' && old)) continue;
          enqueue(table, id, 'upsert', row);
          server[table].set(id, { id, data: row.data, cols: row.cols });
        }
        if (t.write !== 'insert') for (const id of prev.keys()) if (!seen.has(id)) { enqueue(table, id, 'remove'); server[table].delete(id); }
        baseline[table] = seen;
      }
      state = next;
      persist(); notifyStatus();
      if (ops.size) schedule();
    },
    removeItem(key) {
      if (key !== spec.key) return;
      for (const t of tables) {
        if (t.write === 'none' || t.write === 'insert') continue;
        for (const id of server[t.name].keys()) enqueue(t.name, id, 'remove');
        server[t.name].clear();
      }
      recompute(); persist(); notifyStatus();
      if (ops.size) schedule();
    },
    status,
    flush,
    rehydrate,
    close() {
      closed = true; if (timer) timers.clear(timer);
      target.removeEventListener?.('online', onOnline); target.removeEventListener?.('offline', onOffline);
      target.removeEventListener?.('pagehide', onHide); target.removeEventListener?.('beforeunload', onHide);
      globalThis.document?.removeEventListener?.('visibilitychange', onVisibility);
      if (channel) { try { client.removeChannel?.(channel); } catch {} }
    },
  };
  if (ops.size) schedule(0);
  return adapter;
}
