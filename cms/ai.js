// Adaptador de IA. Hoy NO hay proveedor conectado: cada operación falla con un mensaje claro y no se inventa texto.
// Cuando exista una conexión (Cuenta → Conexiones) basta con llamar a registerProvider({rewrite, translate, altText}).
export const CONNECT_URL = '/cuenta/#conexiones';
export const NOT_CONNECTED = 'Conecta un proveedor de IA en Cuenta → Conexiones para usar esta función.';
export class AiNotConnectedError extends Error {
  constructor(operation) { super(NOT_CONNECTED); this.name = 'AiNotConnectedError'; this.operation = operation; this.connectUrl = CONNECT_URL; }
}
let provider = null;
export function registerProvider(impl) {
  if (impl === null) { provider = null; return; }
  for (const op of ['rewrite', 'translate', 'altText']) if (typeof impl?.[op] !== 'function') throw new Error(`El proveedor de IA debe implementar ${op}().`);
  provider = impl;
}
export const aiStatus = () => (provider ? { connected: true, message: 'Proveedor de IA conectado.', link: '' } : { connected: false, message: NOT_CONNECTED, link: CONNECT_URL });
const run = async (operation, args) => { if (!provider) throw new AiNotConnectedError(operation); return provider[operation](args); };
/** rewrite({ text, tone, instruction, lang }) → string */
export const rewrite = args => run('rewrite', args);
/** translate({ text, from, to }) → string */
export const translate = args => run('translate', args);
/** altText({ src, context, lang }) → string */
export const altText = args => run('altText', args);
