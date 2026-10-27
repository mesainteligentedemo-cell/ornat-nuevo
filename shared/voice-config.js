// ORNAT · configuración del asistente de voz (ElevenLabs Conversational AI).
// shared/config.js es de otro módulo, por eso esta configuración vive aquí.
//
// PARA CONECTAR (próxima semana):
//   1. En ElevenLabs crea el agente y copia su Agent ID (empieza con "agent_").
//   2. Pégalo en `agentId` de abajo (o, en el futuro, desde Cuenta → Conexiones: se guarda en localStorage 'ornat-voice-v1').
//   3. En ElevenLabs → Agente → Seguridad: activa la lista de dominios permitidos (allowlist) con el dominio del sitio.
//   4. Declara en el agente las variables dinámicas `ornat_context` y `ornat_role` (el widget las envía; ver README en voice-widget.js).
// NO se incluye ningún agentId aquí: queda vacío a propósito.
export const voiceConfig = {
  agentId: '',
  // Posición del botón/widget: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'.
  position: 'bottom-right',
  // Versión EXACTA del paquete oficial (verificada en unpkg el 2026-10-17) y su hash SRI.
  embedVersion: '0.20.0',
  embedIntegrity: 'sha384-VRJuvlBAVGZKRimmeaoEND6/pJ7uZQt/W5EusHS9vW2gJUl4sU9+lbcK6y9jUvEz',
};
export const embedSrc = (c = voiceConfig) => `https://unpkg.com/@elevenlabs/convai-widget-embed@${c.embedVersion}/dist/index.js`;
