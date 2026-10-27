// Kits de marca: logos + paleta + fuentes guardados una vez y reutilizables en cualquier proyecto.
import { dbAll, dbPut, dbDelete, readMedia } from './core.js';
import { newKit, validateKit, kitFromPatch, applyKit, KIT_FONTS, KIT_ROLES, normHex } from './kits.js';

export function create(host, ext) {
  const { esc } = host;
  let kits = []; let draft = null; const opts = { logo: true, colors: true, fonts: true, name: true };
  const FONT_LABEL = { Inter: 'Moderna · Inter', Arial: 'Neutra · Arial', Georgia: 'Editorial · Georgia', 'Times New Roman': 'Clásica · Times', 'system-ui': 'Sistema · Sans' };
  const ROLE_DEFAULT = { accent: '#719c2d', background: '#ffffff', text: '#191c19', secondary: '#5d6256' };
  async function load() { try { kits = (await dbAll('kits')).flatMap(k => { try { return [validateKit(k)]; } catch { return []; } }).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))); } catch { kits = []; } if (host.currentTab === 'brand') host.renderPanel(); }
  const refresh = () => { if (host.currentTab === 'brand') host.renderPanel(); };

  function card(k) {
    // Solo se pintan colores hexadecimales válidos (normHex); cualquier otro valor guardado se ignora.
    const sw = KIT_ROLES.filter(([r]) => normHex(k.colors[r])).map(([r, l]) => `<i class="x-sw" style="background:${esc(normHex(k.colors[r]))}" title="${esc(l)} ${esc(normHex(k.colors[r]))}"></i>`).join('');
    return `<div class="x-kit"><div class="x-kit-head">${k.logos[0] ? `<img src="${esc(k.logos[0].src)}" alt="Logo de ${esc(k.name)}">` : '<span class="x-kit-nologo" aria-hidden="true"></span>'}<div><b>${esc(k.name)}</b><div class="x-sws">${sw || '<span class="muted">Sin colores</span>'}</div><small class="muted">${k.fonts.heading || k.fonts.body ? esc([k.fonts.heading && 'Títulos ' + k.fonts.heading, k.fonts.body && 'Texto ' + k.fonts.body].filter(Boolean).join(' · ')) : 'Fuentes de la plantilla'}</small></div></div><div class="actions-row"><button type="button" class="button lime" data-x="kit:apply" data-xid="${esc(k.id)}" ${ext.canEdit() ? '' : 'disabled'}>Aplicar a este proyecto</button><button type="button" class="button" data-x="kit:edit" data-xid="${esc(k.id)}" ${ext.canEdit() ? '' : 'disabled'}>Editar</button><button type="button" class="icon-btn" data-x="kit:del" data-xid="${esc(k.id)}" aria-label="Eliminar el kit ${esc(k.name)}" ${ext.canEdit() ? '' : 'disabled'}>${ext.icon('trash')}</button></div></div>`;
  }
  function chk(key, label) { return `<label class="x-check"><input type="checkbox" data-xi="kit:opt" data-key="${key}" ${opts[key] ? 'checked' : ''}> ${esc(label)}</label>`; }

  function dialogHTML() {
    const d = draft;
    return `<div class="dialog-head"><div><span class="eyebrow">KIT DE MARCA</span><h2>${d.id && kits.some(k => k.id === d.id) ? 'Editar kit' : 'Nuevo kit'}</h2></div><button type="button" class="icon-btn" data-x="ui:close" aria-label="Cerrar">${ext.icon('close')}</button></div>
    <form data-xs="kit:save"><label class="field"><span>Nombre del kit</span><input name="name" value="${esc(d.name)}" maxlength="80" required></label><label class="field"><span>Nombre de la marca (opcional)</span><input name="brandName" value="${esc(d.brandName)}" maxlength="80"><small>Se aplica a los nombres de marca que la plantilla permite detectar.</small></label>
    <span class="field-label">Paleta</span><div class="x-two">${KIT_ROLES.map(([r, l]) => `<label class="field"><span>${l}</span><input type="color" name="color-${r}" value="${esc(d.colors[r] || ROLE_DEFAULT[r])}"></label>`).join('')}</div>
    <div class="x-two"><label class="field"><span>Fuente de títulos</span><select name="font-heading"><option value="">Original</option>${KIT_FONTS.map(f => `<option value="${f}" ${d.fonts.heading === f ? 'selected' : ''}>${FONT_LABEL[f]}</option>`).join('')}</select></label><label class="field"><span>Fuente de texto</span><select name="font-body"><option value="">Original</option>${KIT_FONTS.map(f => `<option value="${f}" ${d.fonts.body === f ? 'selected' : ''}>${FONT_LABEL[f]}</option>`).join('')}</select></label></div>
    <span class="field-label">Logos (hasta 4; el primero se aplica)</span><div class="x-logos">${d.logos.map((l, i) => `<div class="x-logo"><img src="${esc(l.src)}" alt="${esc(l.name)}"><button type="button" class="text-btn" data-x="kit:logo-del" data-xv="${i}">Quitar</button></div>`).join('') || '<p class="muted">Sin logos todavía.</p>'}</div>
    <div class="actions-row" style="margin:10px 0"><button type="button" class="button" data-x="kit:logo-add" ${d.logos.length >= 4 ? 'disabled' : ''}>Subir logo PNG</button></div>
    <div class="actions-row"><button type="submit" class="button lime">Guardar kit</button><button type="button" class="button" data-x="ui:close">Cancelar</button></div></form>`;
  }
  function openDialog(kit) {
    draft = kit ? JSON.parse(JSON.stringify(kit)) : { id: '', name: 'Mi marca', brandName: '', logos: [], colors: {}, fonts: {} };
    let dlg = document.getElementById('kit-dialog');
    if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'kit-dialog'; dlg.setAttribute('aria-label', 'Kit de marca'); document.body.append(dlg); }
    dlg.innerHTML = dialogHTML(); if (!dlg.open) dlg.showModal();
  }
  function readDraftFromForm() {
    const form = document.querySelector('#kit-dialog form'); if (!form) return;
    const fd = new FormData(form);
    draft.name = String(fd.get('name') || ''); draft.brandName = String(fd.get('brandName') || '');
    draft.colors = {}; for (const [r] of KIT_ROLES) draft.colors[r] = String(fd.get('color-' + r) || '');
    draft.fonts = { heading: String(fd.get('font-heading') || ''), body: String(fd.get('font-body') || '') };
  }
  function logoInput() {
    let input = document.getElementById('kit-logo-file');
    if (!input) { input = document.createElement('input'); input.type = 'file'; input.id = 'kit-logo-file'; input.hidden = true; input.accept = 'image/png,image/jpeg,image/webp,image/avif'; input.addEventListener('change', async () => { const file = input.files[0]; input.value = ''; if (!file || !draft) return; try { readDraftFromForm(); const m = await readMedia(file, { logo: true }); draft.logos = [...draft.logos, { name: file.name.slice(0, 100), src: m.src }].slice(0, 4); document.getElementById('kit-dialog').innerHTML = dialogHTML(); } catch (e) { host.toast(e.message, true); } }); document.body.append(input); }
    return input;
  }

  return {
    init() { return load(); },
    extra: {
      brand() {
        return `<hr class="divider"><h3 class="section-title">Kits de marca <span class="badge">${kits.length}</span></h3><p class="muted">Guarda logo, paleta y fuentes una vez y aplícalos a cualquier proyecto en un clic.</p>
        <fieldset class="x-opts"><legend class="sr">Qué aplicar del kit</legend>${chk('logo', 'Logo')}${chk('name', 'Nombre')}${chk('colors', 'Colores')}${chk('fonts', 'Fuentes')}</fieldset>
        <div class="x-kits">${kits.map(card).join('') || '<div class="empty-state">Aún no tienes kits. Guarda el de este proyecto o crea uno nuevo.</div>'}</div>
        <div class="stack" style="margin-top:10px"><button type="button" class="button" data-x="kit:from-project" ${ext.canEdit() ? '' : 'disabled'}>Guardar la marca de este proyecto como kit</button><button type="button" class="button" data-x="kit:new" ${ext.canEdit() ? '' : 'disabled'}>Crear un kit nuevo</button></div>
        <p class="hint">Los colores se asignan por el nombre de cada variable de la plantilla (acento, fondo, texto…). Revisa el resultado en el lienzo: puedes deshacerlo con Ctrl+Z.</p>`;
      }
    },
    click(act, b) {
      const id = b.dataset.xid;
      if (!ext.canEdit() && !['logo-add'].includes(act)) { ext.denied(); return; }
      if (act === 'new') openDialog(null);
      else if (act === 'edit') openDialog(kits.find(k => k.id === id));
      else if (act === 'from-project') {
        try { const kit = kitFromPatch(host.patch, host.inventory.colors, `${host.project.name} · marca`); dbPut('kits', kit).then(() => { kits = [kit, ...kits]; refresh(); host.toast('Kit guardado. Ya puedes usarlo en otros proyectos.'); ext.audit('Kit de marca creado', kit.name); }).catch(e => host.toast(e.message, true)); }
        catch (error) { host.toast(error.message, true); }
      }
      else if (act === 'apply') {
        const kit = kits.find(k => k.id === id); if (!kit) return;
        const { patch, changed } = applyKit(host.patch, kit, opts, host.inventory.colors.map(c => c.key));
        if (!changed.length) { host.toast('El kit no cambió nada: esta plantilla no expone esos colores o el kit no tiene ese dato.', true); return; }
        if (host.replacePatch(patch)) { host.toast(`Kit «${kit.name}» aplicado: ${changed.join(', ')}.`, false, { label: 'Deshacer', run: host.undo }); ext.audit('Kit de marca aplicado', `${kit.name} → ${host.project.name}`); }
      }
      else if (act === 'del') {
        const kit = kits.find(k => k.id === id); if (!kit || !confirm(`¿Eliminar el kit «${kit.name}»? Los proyectos que ya lo aplicaron no cambian.`)) return;
        dbDelete('kits', id).then(() => { kits = kits.filter(k => k.id !== id); refresh(); }).catch(e => host.toast(e.message, true));
      }
      else if (act === 'logo-add') { readDraftFromForm(); logoInput().click(); }
      else if (act === 'logo-del') { readDraftFromForm(); draft.logos.splice(Number(b.dataset.xv), 1); document.getElementById('kit-dialog').innerHTML = dialogHTML(); }
    },
    change(act, el) { if (act === 'opt') opts[el.dataset.key] = el.checked; },
    async submit(act) {
      if (act !== 'save') return;
      readDraftFromForm();
      try {
        const base = kits.find(k => k.id === draft.id);
        const kit = base ? validateKit({ ...base, ...draft, updatedAt: new Date().toISOString() }) : newKit({ name: draft.name, brandName: draft.brandName, logos: draft.logos, colors: draft.colors, fonts: draft.fonts });
        await dbPut('kits', kit);
        kits = [kit, ...kits.filter(k => k.id !== kit.id)]; document.getElementById('kit-dialog')?.close(); draft = null; refresh();
        host.toast(`Kit «${kit.name}» guardado.`); ext.audit('Kit de marca guardado', kit.name);
      } catch (error) { host.toast(error.message, true); }
    },
    normHex
  };
}
