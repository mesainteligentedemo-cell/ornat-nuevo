// ORNAT · arranque del modo conectado (Supabase) en el navegador.
//   import { remote } from '/shared/remote-boot.js';
// remote === null en Node, en modo local (config.backend !== 'supabase') o fuera del navegador.
// Con backend 'supabase' siempre hay objeto: si algo falla, session = null y las pantallas mandan a /cuenta/
// en lugar de caer en silencio a datos locales. Nunca lanza al importar.
import { config, supabaseReady } from './config.js';
import { createMirror } from './remote-mirror.js';

const PROFILE_COLS = 'id,org_id,email,name,role';
const SESSION_EVENT_KEY = 'ornat-session-v1';
const BOOT_TIMEOUT_MS = 12000;

let warned = false;
const warn = (msg, e) => { if (warned) return; warned = true; console.warn(`[ORNAT] ${msg}`, e?.message || e || ''); };

const AUTH_ERRORS = [
  [/invalid login credentials/i, 'Correo o contraseña incorrectos.'],
  [/email not confirmed/i, 'Confirma tu correo antes de entrar.'],
  [/rate limit|too many/i, 'Demasiados intentos. Espera unos minutos.'],
  [/failed to fetch|network|load failed/i, 'Sin conexión con el servidor de cuentas.'],
  [/password should be|weak password/i, 'La contraseña es muy débil: usa al menos 12 caracteres.'],
];
export const authMessage = e => { const m = String(e?.message || e || ''); return (AUTH_ERRORS.find(([re]) => re.test(m)) || [null, m || 'No se pudo completar la operación.'])[1]; };

const uuid = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
const safeName = name => String(name || 'archivo').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(-80) || 'archivo';
const sessionChanged = () => { try { globalThis.dispatchEvent?.(new StorageEvent('storage', { key: SESSION_EVENT_KEY })); } catch {} };

export function createRemote(client, session = null, { recovery = false } = {}) {
  const mirrors = new Map();
  const r = {
    client, session, profile: null, orgId: null, recovery, profileError: null,

    async refreshProfile() {
      r.profileError = null;
      if (!client || !r.session) { r.profile = null; r.orgId = null; return null; }
      const { data, error } = await client.from('profiles').select(PROFILE_COLS).eq('id', r.session.user.id).maybeSingle();
      if (error) { r.profileError = authMessage(error); r.profile = null; r.orgId = null; return null; }
      r.profile = data || null; r.orgId = data?.org_id ?? null;
      return r.profile;
    },

    async signIn(email, password) {
      if (!client) return { error: 'Sin conexión con el servidor de cuentas.' };
      try {
        const { data, error } = await client.auth.signInWithPassword({ email: String(email || '').trim().toLowerCase(), password: String(password || '') });
        if (error) return { error: authMessage(error) };
        r.session = data.session;
        await r.refreshProfile();
        if (r.profileError) return { error: r.profileError };
        return { profile: r.profile };
      } catch (e) { return { error: authMessage(e) }; }
    },

    async signOut() {
      for (const p of mirrors.values()) { try { const m = await p; await m.flush().catch(() => {}); m.close(); } catch {} }
      mirrors.clear();
      if (client) { try { await client.auth.signOut(); } catch {} }
      r.session = null; r.profile = null; r.orgId = null;
      sessionChanged();
    },

    requireAuth() {
      if (r.session && r.profile) return true;
      const l = globalThis.location;
      l?.assign?.(`/cuenta/?next=${encodeURIComponent(`${l.pathname}${l.search}`)}`);
      return false;
    },

    mirror(spec) {
      if (!client || !r.session || !r.orgId) return Promise.reject(new Error('Inicia sesión para ver estos datos.'));
      if (!mirrors.has(spec.key)) {
        const p = createMirror({ client, orgId: r.orgId, spec, rest: { url: config.supabaseUrl.replace(/\/+$/, ''), apikey: config.supabaseAnonKey, token: () => r.session?.access_token } });
        p.catch(() => mirrors.delete(spec.key));
        mirrors.set(spec.key, p);
      }
      return mirrors.get(spec.key);
    },

    async submitIntake(payload) {
      if (!client) throw new Error('Sin conexión con el servidor.');
      const { data, error } = await client.rpc('submit_intake', { p: payload });
      if (error) throw new Error(error.message || 'No se pudo enviar el formulario.');
      return { id: data };
    },

    async getPublication(id) {
      if (!client) throw new Error('Sin conexión con el servidor.');
      const { data, error } = await client.rpc('get_publication', { p_id: String(id ?? '') });
      if (error) throw new Error(error.message || 'No se pudo leer la publicación.');
      return data ?? null;
    },

    async uploadMedia(bucket, file, name) {
      if (!client || !r.orgId) throw new Error('Inicia sesión para subir archivos.');
      const path = `${r.orgId}/${uuid()}-${safeName(name || file?.name)}`;
      const { error } = await client.storage.from(bucket).upload(path, file, { contentType: file?.type || undefined, cacheControl: '31536000', upsert: false });
      if (error) throw new Error(error.message || 'No se pudo subir el archivo.');
      const { data } = client.storage.from(bucket).getPublicUrl(path);
      return { url: data.publicUrl, path };
    },

    authHeader() { return r.session?.access_token ? { Authorization: `Bearer ${r.session.access_token}` } : {}; },
  };
  return r;
}

const withTimeout = (promise, ms) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('Tiempo de espera agotado.')), ms))]);

async function boot() {
  if (typeof window === 'undefined' || typeof document === 'undefined' || config.backend !== 'supabase') return null;
  if (!supabaseReady(config)) { warn('Configuración de Supabase incompleta (shared/config.js).'); return createRemote(null); }
  try {
    const recovery = /(?:^|[#&])type=recovery(?:&|$)/.test(location.hash);
    const { createClient } = await withTimeout(import(config.supabaseClientUrl), BOOT_TIMEOUT_MS);
    const client = createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    const { data, error } = await withTimeout(client.auth.getSession(), BOOT_TIMEOUT_MS);
    if (error) throw error;
    const r = createRemote(client, data.session, { recovery });
    if (r.session) await withTimeout(r.refreshProfile(), BOOT_TIMEOUT_MS);
    client.auth.onAuthStateChange((event, s) => {
      if (event === 'INITIAL_SESSION') return;
      const prev = r.session?.user?.id;
      if (event === 'PASSWORD_RECOVERY') r.recovery = true;
      if (s?.user?.id && prev && s.user.id !== prev) { location.reload(); return; }
      r.session = s || null;
      if (!s && prev) { r.profile = null; r.orgId = null; sessionChanged(); }
    });
    return r;
  } catch (e) {
    warn('No se pudo iniciar Supabase.', e);
    return createRemote(null);
  }
}

export const remote = await boot();
