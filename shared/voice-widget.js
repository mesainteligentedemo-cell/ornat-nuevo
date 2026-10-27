// ORNAT · asistente de voz <ornat-voice> (ElevenLabs Conversational AI).
//
// USO
//   <script type="module" src="/shared/voice-widget.js"></script>
//   <ornat-voice context="crm"></ornat-voice>
//
// ATRIBUTOS
//   context   "crm" | "cms" | "rrhh" | "capacitacion" | "sitio"  (por defecto "sitio"). Se envía al agente como variable dinámica `ornat_context`.
//   agent-id  opcional; reemplaza al de voice-config.js / localStorage 'ornat-voice-v1' ({"agentId":"agent_..."}).
//   position  bottom-right | bottom-left | top-right | top-left  (por defecto el de voice-config.js).
//
// COMPORTAMIENTO
//   - Sin agentId: botón discreto «Asistente de voz · se activa al conectar ElevenLabs» y un panel que explica cómo conectarlo. No carga nada externo.
//   - Con agentId válido (agent_...): en tiempo de inactividad inserta <elevenlabs-convai agent-id="..."> y el script oficial
//     @elevenlabs/convai-widget-embed (versión exacta + SRI en voice-config.js). Carga perezosa: no bloquea el render.
//   - Variables dinámicas enviadas (atributo `dynamic-variables` soportado por el widget): ornat_context y ornat_role.
//     Debes declararlas en el agente de ElevenLabs. No se envía nombre ni correo.
//   - Respeta prefers-reduced-motion. En móvil el botón es compacto y deja libre la parte baja con un margen configurable
//     (--ornat-voice-offset-x / --ornat-voice-offset-y).
//   - Si algún día se añade una CSP: permitir script-src https://unpkg.com y connect-src/media/frame de ElevenLabs (api.elevenlabs.io, wss://api.elevenlabs.io).
import { voiceConfig, embedSrc } from './voice-config.js';

const CONTEXTS = { crm: 'el CRM', cms: 'el Editor', rrhh: 'Recursos Humanos', capacitacion: 'Capacitación', sitio: 'el sitio' };
const POSITIONS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
export const AGENT_ID_RE = /^agent_[A-Za-z0-9]{10,64}$/;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function resolveAgentId(attr) {
  const candidates = [attr];
  try { candidates.push(JSON.parse(localStorage.getItem('ornat-voice-v1') || '{}')?.agentId); } catch {}
  candidates.push(voiceConfig.agentId);
  return candidates.map(v => String(v ?? '').trim()).find(v => AGENT_ID_RE.test(v)) || '';
}

const CSS = `
:host{position:fixed;z-index:2147483000;font:14px/1.45 Inter,Arial,sans-serif;color:#0a0a0b;--ink:#0a0a0b;--lime:#98ff03;--paper:#f4f1ea;--line:#dedfd5}
:host([data-pos=bottom-right]){right:calc(16px + var(--ornat-voice-offset-x,0px));bottom:calc(16px + var(--ornat-voice-offset-y,0px))}
:host([data-pos=bottom-left]){left:calc(16px + var(--ornat-voice-offset-x,0px));bottom:calc(16px + var(--ornat-voice-offset-y,0px))}
:host([data-pos=top-right]){right:calc(16px + var(--ornat-voice-offset-x,0px));top:calc(16px + var(--ornat-voice-offset-y,0px))}
:host([data-pos=top-left]){left:calc(16px + var(--ornat-voice-offset-x,0px));top:calc(16px + var(--ornat-voice-offset-y,0px))}
*{box-sizing:border-box}
.fab{display:inline-flex;align-items:center;gap:9px;min-height:44px;padding:8px 16px 8px 10px;border-radius:99px;border:1px solid var(--line);background:var(--paper);color:var(--ink);cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.14);font:inherit;font-size:13px;font-weight:600;transition:transform .2s}
.fab:hover{transform:translateY(-1px)}
.fab .mic{width:28px;height:28px;border-radius:50%;background:var(--lime);display:grid;place-items:center}
.fab small{font-weight:500;opacity:.7;display:block;font-size:11px;line-height:1.1}
.fab span.t{display:grid;text-align:left;line-height:1.15}
:focus-visible{outline:3px solid #66871d;outline-offset:3px}
.panel{position:absolute;width:min(360px,calc(100vw - 32px));max-height:min(70vh,520px);overflow:auto;background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:18px;box-shadow:0 22px 50px rgba(0,0,0,.22)}
:host([data-pos^=bottom]) .panel{bottom:56px}:host([data-pos^=top]) .panel{top:56px}
:host([data-pos$=right]) .panel{right:0}:host([data-pos$=left]) .panel{left:0}
.panel[hidden]{display:none}
h2{font:400 24px/1.15 'Instrument Serif',Georgia,serif;margin:0 28px 8px 0}
p{margin:0 0 10px}ol{margin:0 0 10px;padding-left:20px}li{margin-bottom:4px}
code{background:#f3f1ea;padding:1px 5px;border-radius:5px;font-size:12px}
.x{position:absolute;right:10px;top:10px;width:36px;height:36px;border:0;background:transparent;border-radius:50%;cursor:pointer;font-size:20px;line-height:1;color:var(--ink)}
.x:hover{background:#f3f1ea}
.note{font-size:12px;opacity:.75}
@media (max-width:640px){.fab span.t small{display:none}.fab{padding:6px 14px 6px 8px}.fab .lbl{display:none}.fab .short{display:inline}}
.short{display:none}
@media (prefers-reduced-motion:reduce){.fab{transition:none}.fab:hover{transform:none}}
`;

class OrnatVoice extends HTMLElement {
  static get observedAttributes() { return ['context', 'agent-id', 'position']; }
  #open = false; #loaded = false;
  connectedCallback() { this.attachShadow({ mode: 'open' }); this.#render(); this.#maybeLoad(); }
  attributeChangedCallback() { if (this.shadowRoot) { this.#render(); this.#maybeLoad(); } }
  get context() { const c = this.getAttribute('context') || 'sitio'; return CONTEXTS[c] ? c : 'sitio'; }
  get agentId() { return resolveAgentId(this.getAttribute('agent-id')); }
  get position() { const p = this.getAttribute('position') || voiceConfig.position; return POSITIONS.includes(p) ? p : 'bottom-right'; }

  #render() {
    this.setAttribute('data-pos', this.position);
    if (this.agentId) { this.shadowRoot.innerHTML = ''; return; } // el widget oficial pone su propia interfaz
    const where = CONTEXTS[this.context];
    this.shadowRoot.innerHTML = `<style>${CSS}</style>
      <button class="fab" type="button" aria-haspopup="dialog" aria-expanded="${this.#open}" aria-controls="panel" aria-label="Asistente de voz, se activa al conectar ElevenLabs">
        <span class="mic" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#20261a" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></span>
        <span class="t"><span class="lbl">Asistente de voz</span><span class="short">Voz</span><small>se activa al conectar ElevenLabs</small></span>
      </button>
      <section class="panel" id="panel" role="dialog" aria-modal="false" aria-labelledby="ttl" ${this.#open ? '' : 'hidden'}>
        <button class="x" type="button" aria-label="Cerrar">×</button>
        <h2 id="ttl">Asistente de voz de ORNAT</h2>
        <p>Aquí podrás <strong>hablar con un asistente</strong> mientras usas ${esc(where)}: preguntarle cómo se hace algo, pedirle un resumen o que te guíe paso a paso. Hoy está en modo preparado: todavía no hay un agente conectado.</p>
        <p><strong>Cómo conectarlo</strong></p>
        <ol>
          <li>Crea el agente en ElevenLabs y copia su <code>Agent ID</code> (empieza con <code>agent_</code>).</li>
          <li>Pégalo en <code>shared/voice-config.js</code> (campo <code>agentId</code>) o, cuando esté disponible, en Cuenta → Conexiones.</li>
          <li>En ElevenLabs permite el dominio del sitio en la lista de dominios del agente.</li>
        </ol>
        <p class="note">Contexto de esta pantalla: <code>${esc(this.context)}</code>. No se envía tu nombre ni tu correo al asistente, solo la pantalla y tu rol.</p>
      </section>`;
    const root = this.shadowRoot; const fab = root.querySelector('.fab');
    const set = open => { this.#open = open; root.querySelector('.panel').hidden = !open; fab.setAttribute('aria-expanded', String(open)); if (open) root.querySelector('.x').focus(); else fab.focus(); };
    fab.addEventListener('click', () => set(!this.#open));
    root.querySelector('.x').addEventListener('click', () => set(false));
    root.addEventListener('keydown', e => { if (e.key === 'Escape' && this.#open) { e.stopPropagation(); set(false); } });
  }

  #maybeLoad() {
    const id = this.agentId; const existing = this.querySelector('elevenlabs-convai');
    if (!id) { existing?.remove(); return; }
    if (existing?.getAttribute('agent-id') === id) return;
    const go = async () => {
      let role = 'anonimo'; try { const { data } = await import('./data.js'); role = data().getSession()?.user?.role || 'anonimo'; } catch {}
      this.querySelector('elevenlabs-convai')?.remove();
      const el = document.createElement('elevenlabs-convai');
      el.setAttribute('agent-id', id); el.setAttribute('placement', this.position);
      el.setAttribute('dynamic-variables', JSON.stringify({ ornat_context: this.context, ornat_role: role }));
      el.setAttribute('data-ornat-voice', 'true');
      this.append(el);
      if (!this.#loaded && !document.querySelector('script[data-ornat-voice-embed]')) {
        const s = document.createElement('script'); s.src = embedSrc(); s.async = true; s.crossOrigin = 'anonymous'; s.integrity = voiceConfig.embedIntegrity; s.setAttribute('data-ornat-voice-embed', voiceConfig.embedVersion);
        s.addEventListener('error', () => this.dispatchEvent(new CustomEvent('ornat:voice-error', { bubbles: true, detail: 'No se pudo cargar el script de ElevenLabs.' })));
        document.head.append(s);
      }
      this.#loaded = true;
    };
    (globalThis.requestIdleCallback || (fn => setTimeout(fn, 300)))(go, { timeout: 2500 });
  }
}
if (globalThis.customElements && !customElements.get('ornat-voice')) customElements.define('ornat-voice', OrnatVoice);
export { OrnatVoice };
