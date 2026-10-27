// Configuración de la plataforma ORNAT.
// Modo local (demo): supabaseUrl y supabaseAnonKey vacíos. Todo vive en este navegador (localStorage).
// Modo conectado: llena las dos constantes de abajo y backend pasa solo a 'supabase'
// (login real en /cuenta/, datos compartidos del equipo con RLS y Realtime; ver shared/remote-boot.js).
// La clave publicable (sb_publishable_… o la anon key JWT) es pública por diseño: la protege RLS.
// NUNCA pongas aquí la clave secreta (sb_secret_… / service_role): vive solo en Vercel (SUPABASE_SERVICE_ROLE_KEY).
const supabaseUrl = '';
const supabaseAnonKey = '';

export const config = {
  backend: supabaseUrl && supabaseAnonKey ? 'supabase' : 'local',
  supabaseUrl,
  supabaseAnonKey,
  // Organización a la que pertenecen los formularios públicos (uuid de public.organizations).
  organizationId: '',
  // Si está vacío se usa `${supabaseUrl}/functions/v1/intake`.
  intakeEndpoint: '',
  // WhatsApp del estudio en formato internacional sin "+" (para enlaces wa.me).
  whatsapp: '529842353159',
  // Versión fija del cliente; solo se descarga si backend === 'supabase'.
  supabaseClientUrl: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm',
};

// Clave publicable nueva (sb_publishable_…) o anon key JWT clásica. Una clave secreta nunca pasa.
export const publicKeyOk = key => /^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key) || /^eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}$/.test(key);

export const supabaseReady = (c = config) => c.backend === 'supabase' && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(c.supabaseUrl) && publicKeyOk(String(c.supabaseAnonKey || ''));
