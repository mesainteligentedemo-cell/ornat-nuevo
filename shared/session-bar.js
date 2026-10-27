// ORNAT · barra de sesión reutilizable <ornat-session>.
//
// USO (en cualquier página del sitio, CMS o CRM)
//   <script type="module" src="/shared/session-bar.js"></script>
//   <ornat-session current="cms"></ornat-session>
//
//   current   "cms" | "crm" | "cuenta" | "propiedades" | "capacitacion" | "rrhh"  -> oculta el enlace a la pantalla actual
//   variant   "light" (por defecto) | "dark"              -> claro u oscuro según el fondo donde la pongas
//   Sin sesión muestra "Entrar" y lleva a /cuenta/?next=<página actual>.
//   Con sesión: nombre y rol; menú para cambiar de usuario (demo), ir a Editor / CRM / Propiedades / Cuenta y cerrar sesión.
//   Se actualiza sola cuando cambia la sesión en otra pestaña (data().subscribe).
//   Colores: --ornat-session-accent, --ornat-session-ink, --ornat-session-bg, --ornat-session-line.
// Es un componente de presentación: los permisos reales los comprueba cada pantalla con data().can(...).
// Con Supabase conectado (remote !== null): sin cambio de usuario; nombre y rol reales y botón «Salir».
import { data, ROLES } from './data.js';
import { remote } from './remote-boot.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// 4.º elemento: permiso de data().can(...), null (siempre) o función (data, sesión) => boolean.
const notClient = (d, session) => session.user.role !== 'client';
const LINKS = [['cms', 'Editor', '/cms/', 'cms.view'], ['crm', 'CRM', '/control/', 'crm.view'], ['propiedades', 'Propiedades', '/propiedades/', null], ['capacitacion', 'Capacitación', '/capacitacion/', notClient], ['rrhh', 'RRHH', '/rrhh/', notClient], ['cuenta', 'Cuenta', '/cuenta/', null]];

const CSS = `
:host{display:inline-block;position:relative;--a:var(--ornat-session-accent,#d6f36a);--ink:var(--ornat-session-ink,#181a18);--bg:var(--ornat-session-bg,#fffefa);--line:var(--ornat-session-line,#dedfd5);font:13px/1.4 'DM Sans',Arial,sans-serif;color:var(--ink)}
:host([variant=dark]){--ink:var(--ornat-session-ink,#eef0e7);--bg:var(--ornat-session-bg,#1a1d19);--line:var(--ornat-session-line,#3a3f37)}
*{box-sizing:border-box}
button,a{font:inherit;color:inherit}
.chip{display:flex;align-items:center;gap:9px;max-width:min(70vw,320px);background:var(--bg);border:1px solid var(--line);border-radius:99px;padding:5px 12px 5px 5px;cursor:pointer;min-height:40px}
.avatar{width:30px;height:30px;border-radius:50%;background:var(--a);color:#20261a;display:grid;place-items:center;font-weight:700;font-size:13px}
.who{display:grid;text-align:left;line-height:1.15;min-width:0}.who b{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.who small{opacity:.7;font-size:11px}
.pop{position:absolute;right:0;top:calc(100% + 8px);min-width:250px;background:var(--bg);border:1px solid var(--line);border-radius:14px;box-shadow:0 18px 40px rgba(0,0,0,.18);padding:10px;z-index:50;display:grid;gap:2px}
.pop[hidden]{display:none}
.pop a,.pop button.item{display:block;width:100%;text-align:left;padding:10px 12px;border-radius:9px;text-decoration:none;background:none;border:0;cursor:pointer}
.pop a:hover,.pop button.item:hover{background:rgba(127,127,127,.14)}
.pop label{display:grid;gap:4px;padding:6px 12px 8px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;opacity:.75}
.pop select{font:inherit;font-size:13px;text-transform:none;letter-spacing:0;color:inherit;background:transparent;border:1px solid var(--line);border-radius:8px;padding:8px}
.pop select option{color:#181a18}
.pop hr{border:0;border-top:1px solid var(--line);margin:6px 0;width:100%}
.demo{padding:2px 12px 6px;font-size:11px;opacity:.7}
.enter{display:inline-flex;align-items:center;background:var(--a);color:#20261a;border-radius:99px;padding:10px 18px;text-decoration:none;font-weight:600;min-height:40px}
:focus-visible{outline:3px solid #66871d;outline-offset:2px}
`;

class OrnatSession extends HTMLElement {
  #unsub; #open = false; #onDoc;
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.#unsub = data().subscribe(topic => { if (['session', 'users', 'all'].includes(topic)) this.#render(); });
    this.#onDoc = e => { if (this.#open && !e.composedPath().includes(this)) this.#set(false); };
    document.addEventListener('click', this.#onDoc);
    this.shadowRoot.addEventListener('keydown', e => { if (e.key === 'Escape' && this.#open) { this.#set(false); this.shadowRoot.querySelector('.chip')?.focus(); } });
    this.#render();
  }
  disconnectedCallback() { this.#unsub?.(); document.removeEventListener('click', this.#onDoc); }
  static get observedAttributes() { return ['current', 'variant']; }
  attributeChangedCallback() { if (this.shadowRoot) this.#render(); }

  #set(open) { this.#open = open; const pop = this.shadowRoot.querySelector('.pop'); const chip = this.shadowRoot.querySelector('.chip'); if (pop) pop.hidden = !open; chip?.setAttribute('aria-expanded', String(open)); }

  #render() {
    const d = data(); const root = this.shadowRoot;
    const p = remote?.session ? remote.profile : null;
    const session = d.getSession() || (p?.email ? { user: { id: p.id, name: p.name || p.email.split('@')[0], email: p.email, role: p.role } } : null);
    if (!session) {
      const next = encodeURIComponent(location.pathname + location.search);
      root.innerHTML = `<style>${CSS}</style><a class="enter" href="/cuenta/?next=${next}">Entrar</a>`;
      return;
    }
    const u = session.user; const current = this.getAttribute('current') || '';
    if (remote) { this.#renderRemote(d, session, u, current); return; }
    const others = d.users.list();
    const links = LINKS.filter(([key, , , perm]) => key !== current && (!perm || (typeof perm === 'function' ? perm(d, session) : d.can(perm)))).map(([, label, href]) => `<a href="${href}">${label}</a>`).join('');
    root.innerHTML = `<style>${CSS}</style>
      <button class="chip" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="pop"><span class="avatar" aria-hidden="true">${esc((u.name || u.email)[0].toUpperCase())}</span><span class="who"><b>${esc(u.name)}</b><small>${esc(ROLES[u.role])} · demo</small></span></button>
      <div class="pop" id="pop" hidden>
        ${others.length > 1 ? `<label>Cambiar de usuario (demo)<select data-switch aria-label="Cambiar de usuario">${others.map(o => `<option value="${esc(o.email)}"${o.email === u.email ? ' selected' : ''}>${esc(o.name)} · ${esc(ROLES[o.role])}</option>`).join('')}</select></label><hr>` : ''}
        ${links}<hr>
        <button class="item" type="button" data-out>Cerrar sesión</button>
        <div class="demo">Demo: sin contraseña, datos en este navegador.</div>
      </div>`;
    root.querySelector('.chip').addEventListener('click', () => this.#set(!this.#open));
    root.querySelector('[data-out]').addEventListener('click', () => { d.signOut(); this.dispatchEvent(new CustomEvent('ornat:signout', { bubbles: true, composed: true })); });
    root.querySelector('[data-switch]')?.addEventListener('change', e => { d.signIn({ email: e.target.value }); this.dispatchEvent(new CustomEvent('ornat:switch', { bubbles: true, composed: true, detail: { email: e.target.value } })); });
    this.#set(false);
  }

  #renderRemote(d, session, u, current) {
    const root = this.shadowRoot;
    const links = LINKS.filter(([key, , , perm]) => key !== current && (!perm || (typeof perm === 'function' ? perm(d, session) : d.can(perm, session)))).map(([, label, href]) => `<a href="${href}">${label}</a>`).join('');
    root.innerHTML = `<style>${CSS}</style>
      <button class="chip" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="pop"><span class="avatar" aria-hidden="true">${esc((u.name || u.email)[0].toUpperCase())}</span><span class="who"><b>${esc(u.name)}</b><small>${esc(ROLES[u.role])}</small></span></button>
      <div class="pop" id="pop" hidden>
        <div class="demo">${esc(u.email)}</div><hr>
        ${links}<hr>
        <button class="item" type="button" data-out>Salir</button>
      </div>`;
    root.querySelector('.chip').addEventListener('click', () => this.#set(!this.#open));
    root.querySelector('[data-out]').addEventListener('click', async e => {
      e.currentTarget.disabled = true;
      await d.signOut();
      this.dispatchEvent(new CustomEvent('ornat:signout', { bubbles: true, composed: true }));
      location.assign('/cuenta/');
    });
    this.#set(false);
  }
}
if (globalThis.customElements && !customElements.get('ornat-session')) customElements.define('ornat-session', OrnatSession);
export { OrnatSession };
