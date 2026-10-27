/* ORNAT demo: same-origin editing bridge. Scroll engines remain owned by the template. */
(() => {
  'use strict';
  if (window.parent === window || new URLSearchParams(location.search).get('cms') !== '1') return;
  const CHANNEL = 'ornat-cms';
  // ?pub=1: la plantilla se muestra como sitio publicado (sin edición), dentro de /cms/sitio.html.
  const PUB = new URLSearchParams(location.search).get('pub') === '1';
  let externalPages = new Map(); let lang = 'es'; let rawPatch = {}; let commenting = false; let pins = []; let pinLayer = null; let blocksApi = null; let blocksFailed = false; let needInventory = false; let blockIssues = []; let blockPlaced = [];
  const blocksSig = new Map();
  const blocksReady = import('/cms/blocks.js').then(m => { blocksApi = m; return m; }).catch(() => { blocksFailed = true; return null; });
  // Validador de core.js (lista blanca). Todo parche que llega por postMessage se valida antes de tocar el DOM.
  const coreReady = import('/cms/core.js').catch(() => null);
  // Estructura de la plantilla (secciones y elementos repetidos) y estilos por sección: módulos aparte, cargados al arrancar.
  let structApi = null; let structFailed = false; let styleApi = null; let styleFailed = false; let pageReady = false; let structUsed = false; let settled = false;
  const structReady = import('/cms/structure-dom.js').then(m => { structApi = m.createStructure({ nodes, originals, fragmentIds, blockIds, logoIds, fnv, findVirtualScroller, scan: () => scan(), settled: () => settled }); return structApi; }).catch(() => { structFailed = true; return null; });
  const styleReady = import('/cms/style-dom.js').then(m => { styleApi = m.createStyles({ nodes, originals, textElement, excluded, fnv, blockIds, fragmentIds, fragmentParents, safeSource, isDynamic: el => isDynamic(el), findVirtualScroller }); return styleApi; }).catch(() => { styleFailed = true; return null; });
  Promise.all([structReady, styleReady]).then(() => { if (!pageReady) return; try { send('inventory', { inventory: scan() }); if (Object.keys(rawPatch).length) apply(rawPatch, true); } catch { /* sin estructura */ } });
  if (PUB) { try { const q = new URLSearchParams(location.search).get('lang'); const st = localStorage.getItem('ornat-lang'); lang = q === 'en' || q === 'es' ? q : st === 'en' ? 'en' : 'es'; } catch { /* sin almacenamiento */ } }
  const nodes = new Map();
  const originals = new Map();
  const fragmentIds = new WeakMap();
  const fragmentParents = new Map();
  const logoIds = new Set();
  const brandEdits = new Map();
  const TEXT_SELECTOR = 'h1,h2,h3,h4,h5,h6,p,a,button,span,li,label,small,strong,em';
  // Extra leaf containers (stats, word wrappers, captions). They get their own id prefix so ids saved before they were supported keep working.
  const EXTRA_TEXT_SELECTOR = 'div,i,b,u,time,td,th,dt,dd,figcaption,blockquote,cite';
  const TEXT_ALL = TEXT_SELECTOR + ',' + EXTRA_TEXT_SELECTOR;
  let selecting = false;
  let selectionMode = 'element';
  let analyticsEnabled = false;
  let selected = null;
  let inventory;
  let lastPatch = {};
  let sequenceSources = [];
  let textureValues = {};
  // This narrowly intercepts only numbered image sequences; ordinary canvas drawing is untouched.
  function installSequenceRuntime(sources, count, repaint) {
    const proto = CanvasRenderingContext2D.prototype;
    const original = proto.__ornatOriginalDraw || proto.drawImage;
    if (!proto.__ornatOriginalDraw) Object.defineProperty(proto, '__ornatOriginalDraw', { value: original });
    const frames = sources.map(src => { const im = new Image(); im.onload = () => repaint && dispatchEvent(new Event('resize')); im.src = src; return im; });
    proto.drawImage = function(image, ...args) {
      const match = image && typeof image.src === 'string' && /\/(?:f\/[dm]|frames)\/(\d+)\.(?:webp|png|jpe?g)(?:[?#]|$)/i.exec(image.src);
      if (match && frames.length) {
        const sourceIndex = Math.max(0, Number(match[1]) - 1);
        const im = frames[Math.min(frames.length - 1, Math.floor(sourceIndex / count * frames.length))];
        if (im?.complete && im.naturalWidth) {
          if (args.length === 8) { const x = im.naturalWidth / (image.naturalWidth || im.naturalWidth); const y = im.naturalHeight / (image.naturalHeight || im.naturalHeight); args[0] *= x; args[1] *= y; args[2] *= x; args[3] *= y; }
          return original.call(this, im, ...args);
        }
      }
      return original.call(this, image, ...args);
    };
    if (repaint) dispatchEvent(new Event('resize'));
  }
  const send = (type, data = {}) => parent.postMessage({ channel: CHANNEL, type, ...data }, location.origin);
  const excluded = el => !!el.closest('script,style,noscript,template,[data-cms-editor],[data-ornat-legal],svg,canvas,div[aria-hidden="true"]:has(input[name="ornat_website"])');
  const label = el => (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  const textElement = node => node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  // Detect text that the template's script keeps rewriting (captions, typewriters): edits would be overwritten.
  const dynCount = new Map(); const dynEls = new Set(); let dynLast = new WeakMap();
  // Only real text changes count (per-letter animations rebuild the DOM without changing the text).
  function noteMutation(r) {
    const el = r.type === 'characterData' ? r.target.parentElement : r.target;
    if (!(el instanceof Element) || el.closest('[data-cms-editor]')) return;
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!dynLast.has(el)) { dynLast.set(el, text); return; }
    if (dynLast.get(el) === text) return;
    dynLast.set(el, text);
    const n = (dynCount.get(el) || 0) + 1; dynCount.set(el, n);
    if (n >= 2) dynEls.add(el);
  }
  const dynObserver = new MutationObserver(records => { if (editing) return; records.forEach(noteMutation); });
  dynObserver.observe(document.documentElement, { subtree: true, characterData: true, childList: true });
  const isDynamic = el => !!el.closest('[aria-live]') || [...dynEls].some(d => d === el || el.contains(d));
  function flushTemplateMutations() { dynObserver.takeRecords().forEach(noteMutation); }
  function writeText(node, value) {
    if (!node) return;
    const element = textElement(node);
    if (!element || excluded(element) || (node.nodeType !== Node.TEXT_NODE && node.childElementCount)) return;
    if (node.nodeType === Node.TEXT_NODE) { const leading = /^\s*/.exec(node.nodeValue)[0]; const trailing = /\s*$/.exec(node.nodeValue)[0]; node.nodeValue = leading + value.trim() + trailing; } else node.textContent = value;
  }
  function register(el, kind, index) {
    let id = el.dataset.cmsId;
    if (!id) { id = `${kind}-${index}`; while (nodes.has(id) && nodes.get(id) !== el && textElement(nodes.get(id))?.isConnected) id += '_'; el.dataset.cmsId = id; }
    nodes.set(id, el);
    if (!originals.has(id)) originals.set(id, { text: el.textContent, style: el.getAttribute('style'), html: el.cloneNode(true), pictureSources: [...(el.closest('picture')?.querySelectorAll('source') || [])].map(s => s.cloneNode(true)), videoSources: el.tagName === 'VIDEO' ? [...el.querySelectorAll('source')].map(s => s.cloneNode(true)) : [] });
    return id;
  }
  function visible(el) {
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && el.getClientRects().length > 0;
  }
  function sectionOf(el) {
    const section = el.closest('section,header,footer,main,nav,[data-cms-section]');
    return section ? section.dataset.cmsSection || section.id || section.tagName.toLowerCase() : 'general';
  }
  function safeSource(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 16000000) return null;
    if (/^data:image\/(png|jpeg|webp|avif|gif|svg\+xml);/i.test(value)) return value;
    try { const u = new URL(value, location.href); return ['http:', 'https:', 'blob:'].includes(u.protocol) ? u.href : null; } catch { return null; }
  }
  function safeLink(value) {
    if (typeof value !== 'string' || value.length > 2048) return null;
    try { const u = new URL(value, location.href); return ['http:', 'https:', 'mailto:', 'tel:'].includes(u.protocol) ? value : null; } catch { return null; }
  }
  function safeVideo(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 60000000) return null;
    if (/^data:video\/(mp4|webm);base64,[a-z\d+/=\s]+$/i.test(value)) return value;
    if (value.length > 2000000) return null;
    try { const u = new URL(value, location.href); return ['http:', 'https:', 'blob:'].includes(u.protocol) ? u.href : null; } catch { return null; }
  }
  function safeHTTP(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 2048) return null;
    try { const u = new URL(value, location.href); return ['http:', 'https:'].includes(u.protocol) ? u.href : null; } catch { return null; }
  }
  function legalValues(value = {}) {
    if (!value || typeof value !== 'object') return {};
    const result = {};
    for (const key of ['privacy', 'terms', 'cookies']) {
      if (typeof value[`${key}Text`] === 'string' && value[`${key}Text`].trim()) result[`${key}Text`] = value[`${key}Text`].slice(0, 30000);
      const url = safeHTTP(value[`${key}Url`]); if (url) result[`${key}Url`] = url;
    }
    return result;
  }
  function renderLegal(values) {
    const signature = JSON.stringify(values);
    const existing = document.getElementById('ornat-legal');
    if (existing?.__ornatLegalSignature === signature) return;
    existing?.remove();
    if (!Object.keys(values).length) { document.getElementById('ornat-legal-style')?.remove(); return; }
    let style = document.getElementById('ornat-legal-style');
    if (!style) {
      style = document.createElement('style'); style.id = 'ornat-legal-style';
      style.textContent = '#ornat-legal{display:flex;flex-wrap:wrap;gap:1rem;padding:1.25rem;align-items:center;font:inherit;font-size:.85rem;color:inherit}#ornat-legal>a,#ornat-legal>button{font:inherit;color:inherit;background:none;border:0;padding:.25rem;text-decoration:underline;cursor:pointer}#ornat-legal dialog{position:fixed;inset:0;margin:auto;width:min(42rem,calc(100vw - 2rem));max-height:80vh;overflow:auto;border:1px solid #ccc;border-radius:12px;padding:1.5rem;background:#fff;color:#171717;z-index:2147483000;font:16px/1.6 system-ui,sans-serif}#ornat-legal dialog::backdrop{background:#0009}#ornat-legal dialog h2{font:600 1.5rem/1.3 system-ui,sans-serif;margin:0 0 1rem}#ornat-legal dialog p{white-space:pre-wrap;font:inherit;color:inherit}#ornat-legal dialog button{display:block;margin:1rem 0 0 auto;background:#171717;color:white;border:0;border-radius:6px;padding:.55rem 1rem;font:inherit;cursor:pointer}#ornat-legal :focus-visible{outline:3px solid #75a822;outline-offset:3px}';
      document.head.append(style);
    }
    const nav = document.createElement('nav'); nav.id = 'ornat-legal'; nav.dataset.ornatLegal = 'true'; nav.setAttribute('aria-label', 'Documentos legales'); nav.__ornatLegalSignature = signature;
    const labels = { privacy: 'Privacidad', terms: 'Términos y condiciones', cookies: 'Cookies' };
    for (const key of Object.keys(labels)) {
      const text = values[`${key}Text`]; const url = values[`${key}Url`]; if (!text && !url) continue;
      if (text) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = labels[key]; button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-controls', `ornat-legal-${key}`);
        const dialog = document.createElement('dialog'); dialog.id = `ornat-legal-${key}`; dialog.setAttribute('aria-labelledby', `ornat-legal-${key}-title`);
        const title = document.createElement('h2'); title.id = `ornat-legal-${key}-title`; title.textContent = labels[key];
        const content = document.createElement('p'); content.textContent = text;
        const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Cerrar';
        dialog.append(title, content);
        if (url) { const link = document.createElement('a'); link.href = url; link.textContent = 'Abrir documento'; link.target = '_blank'; link.rel = 'noopener noreferrer'; dialog.append(link); }
        dialog.append(close); nav.append(button, dialog);
        button.addEventListener('click', () => { if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', ''); });
        close.addEventListener('click', () => { if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open'); button.focus(); });
      } else { const link = document.createElement('a'); link.href = url; link.textContent = labels[key]; link.target = '_blank'; link.rel = 'noopener noreferrer'; nav.append(link); }
    }
    const footer = document.querySelector('footer'); (footer || document.body).append(nav);
  }
  function seoMetadata(values) {
    const configs = [
      ['description', 'meta[name="description"]', 'meta', 'name', 'description', 'content'],
      ['favicon', 'link[rel~="icon"]', 'link', 'rel', 'icon', 'href'],
      ['ogImage', 'meta[property="og:image"]', 'meta', 'property', 'og:image', 'content'],
      ['canonical', 'link[rel="canonical"]', 'link', 'rel', 'canonical', 'href']
    ];
    for (const [key, selector, tag, attr, attrValue, target] of configs) {
      if (!(key in values)) continue;
      let el = document.querySelector(selector);
      if (values[key] === null) { el?.remove(); continue; }
      if (!el) { el = document.createElement(tag); el.setAttribute(attr, attrValue); document.head.append(el); }
      el.setAttribute(target, values[key]);
      if (key === 'favicon') el.removeAttribute('type');
    }
    if (typeof values.title === 'string') document.title = values.title;
  }
  function sectionTitle(el) {
    const heading = el.querySelector('h1,h2,h3');
    let text = ((heading && (heading.innerText || heading.textContent)) || '').replace(/\s+/g, ' ').trim();
    if (!text) text = ((el.innerText || '').split('\n').map(x => x.trim()).find(Boolean) || '').replace(/\s+/g, ' ');
    return text.slice(0, 60);
  }
  let lastScanAt = 0; let lastSignature = ''; let rescanTimer = 0;
  const inventorySignature = inv => inv.texts.length + '|' + inv.images.length + '|' + inv.sections.length + '|' + fnv(inv.texts.map(t => t.id).join(',') + inv.images.map(i => i.id).join(',') + (inv.lists || []).map(l => l.id + ':' + l.count + ':' + l.items.map(i => (i.removed ? 'x' : '')).join('')).join(',') + inv.sections.map(x => x.id).join(','));
  const CLONED = '[data-cms-sclone],[data-cms-iclone],[data-cms-block]';
  function counter() { let n = 0; return el => (el.closest(CLONED) ? -1 : n++); }
  function scan() {
    const tI = counter(); const iI = counter(); const bI = counter(); const vI = counter(); const lI = counter(); const cI = counter(); const kI = counter();
    const sections = [];
    const sectionIds = new Set();
    document.querySelectorAll('section,header,footer,main,nav').forEach((el, i) => {
      let id = el.dataset.cmsSection || el.id || `section-${i}`;
      if (sectionIds.has(id)) id = `${id}-${i}`;
      sectionIds.add(id);
      el.dataset.cmsSection = id;
      sections.push({ id, label: sectionTitle(el) || (el.dataset.cmsBlockType === 'spacer' ? 'Separador' : el.tagName.toLowerCase()), leaf: !el.querySelector('section,header,footer,main,nav'), visible: el.getClientRects().length > 0 || el.hasAttribute('data-cms-hidden'), tag: el.tagName.toLowerCase() });
    });
    const foundLists = structApi ? (() => { try { return structApi.scanLists(); } catch { return []; } })() : [];
    const texts = [];
    document.querySelectorAll(TEXT_SELECTOR).forEach(el => {
      const i = tI(el);
      if (excluded(el) || el.childElementCount) return;
      const text = (el.textContent || '').trim();
      if (!text || text.length > 3000) return;
      texts.push({ id: register(el, 'text', i), text, tag: el.tagName.toLowerCase(), section: sectionOf(el), visible: visible(el), type: textClass(el) });
    });
    const extraSeen = new Map();
    document.querySelectorAll(EXTRA_TEXT_SELECTOR).forEach(el => {
      if (excluded(el) || el.childElementCount) return;
      const text = (el.textContent || '').trim();
      if (!text || text.length > 3000) return;
      const key = fnv(el.localName + '|' + normalizedText(el)); const n = extraSeen.get(key) || 0; extraSeen.set(key, n + 1);
      let id = el.dataset.cmsId;
      if (!id) { let index = 'x' + key + (n ? '-' + n : ''); while (nodes.has('text-' + index) && nodes.get('text-' + index) !== el && nodes.get('text-' + index)?.isConnected) index += '_'; id = register(el, 'text', index); } else nodes.set(id, el);
      if (!/^text-/.test(id)) return;
      texts.push({ id, text, tag: el.tagName.toLowerCase(), section: sectionOf(el), visible: visible(el), type: textClass(el) });
    });
    fragmentParents.clear(); pureCache = new WeakMap();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node; let fragmentIndex = 0;
    while ((node = walker.nextNode())) {
      const el = node.parentElement;
      const index = el?.closest(CLONED) ? -1 : fragmentIndex++;
      const text = node.nodeValue.trim();
      if (!el || !el.childElementCount || excluded(el) || !el.closest(TEXT_ALL) || !text || text.length > 3000) continue;
      let id = fragmentIds.get(node);
      if (!id) { id = `fragment-${index}`; fragmentIds.set(node, id); }
      nodes.set(id, node);
      if (!originals.has(id)) originals.set(id, { text: node.nodeValue });
      const ids = fragmentParents.get(el) || [];
      ids.push(id); fragmentParents.set(el, ids);
      texts.push({ id, text, tag: el.tagName.toLowerCase(), section: sectionOf(el), visible: visible(el), fragment: true, type: textClass(el) });
    }
    const blockOfId = new Map(); const rootOf = new Map(); const roots = new Set();
    for (const [tid, node] of [...nodes]) { if (!/^(?:text|fragment)-/.test(tid)) continue; const el = textElement(node); const root = el?.isConnected ? blockFor(el) : null; if (root) { rootOf.set(tid, root); roots.add(root); } }
    [...roots].sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)).forEach(root => ensureBlock(root));
    for (const [tid, root] of rootOf) { const bid = blockIds.get(root); if (bid) blockOfId.set(tid, bid); }
    for (const t of texts) { const bid = blockOfId.get(t.id); if (bid) t.block = bid; }
    for (const t of texts) { const te = textElement(nodes.get(t.id)); if (te && isDynamic(te)) t.dynamic = true; }
    texts.sort((a, b) => Number(b.visible) - Number(a.visible));
    const images = [];
    document.querySelectorAll('img').forEach(el => {
      const i = iI(el);
      if (el.closest('[data-cms-editor]')) return;
      const box = el.getBoundingClientRect();
      const id = register(el, 'image', i);
      images.push({ id, kind: el.dataset.cmsLogo ? 'logo' : 'image', src: el.currentSrc || el.src, alt: el.alt, width: Math.round(box.width), height: Math.round(box.height), naturalWidth: el.naturalWidth, naturalHeight: el.naturalHeight, ratio: box.height ? box.width / box.height : 1.5, section: sectionOf(el) });
    });
    document.querySelectorAll('body *').forEach(el => {
      const i = bI(el);
      if (excluded(el) || el.tagName === 'IMG' || images.length >= 250) return;
      const bg = getComputedStyle(el).backgroundImage;
      const match = /^url\(["']?(.*?)["']?\)$/.exec(bg);
      if (!match) return;
      const box = el.getBoundingClientRect();
      images.push({ id: register(el, 'background', i), kind: 'background', src: match[1], alt: el.getAttribute('aria-label') || '', width: Math.round(box.width), height: Math.round(box.height), naturalWidth: 0, naturalHeight: 0, ratio: box.height ? box.width / box.height : 1.5, section: sectionOf(el) });
    });
    try { if (styleApi) styleApi.scanIcons({ images, register, index: kI, sectionOf }); } catch { /* íconos opcionales */ }
    try { if (styleApi) styleApi.scanControls(); } catch { /* controles opcionales */ }
    if (Array.isArray(window.ornatCmsTextures?.slots)) {
      for (const slot of window.ornatCmsTextures.slots) {
        if (typeof slot.id !== 'string' || typeof slot.src !== 'string') continue;
        const width = Number(slot.width) || 1024; const height = Number(slot.height) || 1536;
        images.push({ id: slot.id, kind: 'texture', src: textureValues[slot.id] || slot.src, alt: String(slot.label || slot.id), width, height, naturalWidth: width, naturalHeight: height, ratio: width / height, section: 'Plano a render' });
      }
    }
    const videos = [...document.querySelectorAll('video')].map(el => {
      const i = vI(el);
      const box = el.getBoundingClientRect();
      return { id: register(el, 'video', i), src: el.currentSrc || el.src || el.querySelector('source')?.src || '', poster: el.poster || '', width: Math.round(box.width), height: Math.round(box.height), naturalWidth: el.videoWidth, naturalHeight: el.videoHeight, ratio: box.height ? box.width / box.height : 16 / 9, section: sectionOf(el), label: el.getAttribute('aria-label') || el.getAttribute('title') || `Video ${i + 1}` };
    });
    const logos = [];
    const brandCandidates = new Set(document.querySelectorAll('[aria-label^="ORNAT" i],.nav-brand,.nav-logo,.nav__logo,.nav_logo,.hdr-logo,.hdr__logo,.hud-logo,.site-logo,.nlogo,.fbrand,.nav-word,.crest,.logo,.brand,.bar-logo,.hnav-logo,.foot-logo,.footer__logo,.f-logo,[class*="brandmark"],svg[class*="logo"],svg[class*="mono"],img[class*="logo"],img[alt*="logo" i],.header-logo-item'));
    let logoIndex = 0;
    for (let el of brandCandidates) {
      if (/^H[1-6]$/.test(el.tagName) && !/^ORNAT(?:[.\s—-]*UX)?$/i.test(el.textContent.trim())) continue;
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
      if (el.closest('.loader,.preloader,[class*="loader__"],[class*="loader-"]') || /^(?:IMG|SVG)$/i.test(el.tagName) === false && !(/ornat/i.test(el.getAttribute('aria-label') || el.textContent) || el.querySelector('svg,img') || el.classList.contains('logo'))) continue;
      // Keep the clickable navigation wrapper: prefer its actual emblem when available.
      if (el.tagName !== 'IMG' && el.tagName.toLowerCase() !== 'svg') el = el.querySelector('svg,img') || el;
      if (el.closest('button') && !el.closest('button.logo,button[class*="brand"]')) continue;
      const box = el.getBoundingClientRect();
      if (box.width > 700 || el.tagName.toLowerCase() === 'svg' && !el.querySelector('use,path,text,image,circle')) continue;
      logoIds.add(register(el, 'logo', logoIndex++));
    }
    for (const id of logoIds) { const el = nodes.get(id); if (!el?.isConnected) continue; const box = el.getBoundingClientRect(); logos.push({ id, kind: 'logo', width: Math.round(box.width), height: Math.round(box.height), ratio: box.height ? box.width / box.height : 1, section: sectionOf(el), src: el.tagName === 'IMG' ? el.src : '', alt: el.getAttribute('aria-label') || 'Logo' }); }
    const keys = new Set();
    function readRules(rules) { for (const rule of rules) { if (rule.cssRules) readRules(rule.cssRules); if (!rule.style) continue; for (const key of rule.style) if (key.startsWith('--')) keys.add(key); } }
    for (const sheet of document.styleSheets) { try { readRules(sheet.cssRules); } catch { /* External font sheets may be opaque. */ } }
    const root = getComputedStyle(document.documentElement);
    const colors = [...keys].map(key => ({ key, value: root.getPropertyValue(key).trim(), label: key.replace(/^--/, '').replace(/-/g, ' ') })).filter(c => c.value && CSS.supports('color', c.value) && !c.value.includes('var('));
    const links = [...document.querySelectorAll('a[href]')].filter(el => !excluded(el)).map(el => ({ id: register(el, 'link', lI(el)), href: el.getAttribute('href'), text: label(el), section: sectionOf(el) }));
    const sequences = [...document.querySelectorAll('canvas')].map(el => {
      const i = cI(el);
      register(el, 'sequence', i);
      const loft = el.id === 'seq' && !!document.querySelector('#gate');
      return { id: loft ? 'canvas-frames' : el.dataset.cmsId, label: loft ? 'Recorrido inmersivo por fotogramas' : `Animación de lienzo ${i + 1}`, count: loft ? 300 : null, width: loft ? 1920 : el.width, height: loft ? 1080 : el.height, pattern: loft ? 'f/d/001.webp … 300.webp (móvil: f/m/)' : null, editable: loft };
    });
    const warnings = sequences.filter(s => !s.editable).length ? ['Esta plantilla contiene una animación canvas sin integración de fotogramas. Reemplazar una foto no cambia esa animación.'] : [];
    if (images.some(im => im.kind === 'background')) warnings.push('Los fondos con varias capas o pseudoelementos se conservan; el editor solo detecta fondos de una imagen.');
    lastScanAt = Date.now();
    if (lang === 'en' && rawPatch.i18n?.en) for (const t of texts) { const en = rawPatch.i18n.en; if (en[t.id] !== undefined || (t.block && en[t.block] !== undefined)) t.text = String(rawPatch.texts?.[t.id] ?? originals.get(t.id)?.text ?? t.text).trim(); }
    // Páginas cuyo scroll es virtual (el documento no crece con el contenido): un bloque quedaría fuera de alcance.
    const nativeScroll = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) > innerHeight * 1.08 || !!findVirtualScroller();
    const insertPoints = nativeScroll ? computeInsertPoints(sections) : [];
    const blocks = [...document.querySelectorAll('[data-cms-block]')].map(el => ({ id: el.dataset.cmsBlock, type: el.dataset.cmsBlockType || '' }));
    let lists = []; let effects = [];
    try { if (structApi) { structApi.scanSections(sections); lists = structApi.describeLists(foundLists, id => sections.find(s => s.id === id)?.label || id); } } catch { lists = []; }
    try { if (styleApi) effects = styleApi.scanEffects({ sequences, sectionOf }); } catch { effects = []; }
    // Lo quitado no aparece en los paneles; los textos e imágenes dentro de un elemento repetido llevan su id (`item`).
    const keep = arr => arr.filter(entry => { const node = nodes.get(entry.id); const el = node && textElement(node); if (el?.closest?.('[data-cms-removed]')) return false; const it = el?.closest?.('[data-cms-item]'); if (it) entry.item = it.dataset.cmsItem; return true; });
    for (const arr of [texts, images, videos, links, logos]) arr.splice(0, arr.length, ...keep(arr));
    inventory = { texts, images, videos, colors, sections, logos, links, sequences, warnings, insertPoints, blocks, lists, effects, blocksSupported: nativeScroll || blocks.length > 0, pages: discoverPages(), externalPages: [...externalPages.values()], seo: { title: document.title, description: document.querySelector('meta[name="description"]')?.content || '', favicon: document.querySelector('link[rel~="icon"]')?.href || '', ogImage: document.querySelector('meta[property="og:image"]')?.content || '', canonical: document.querySelector('link[rel="canonical"]')?.href || '' } };
    return inventory;
  }
  // ---------- Canvas editing layer (overlay, selection, inline editing, reframing) ----------
  const FONT_STACKS = { 'Inter': 'Inter,system-ui,sans-serif', 'Barlow Condensed': '"Barlow Condensed","Arial Narrow",sans-serif', 'Playfair Display': '"Playfair Display",Georgia,serif', 'Arial': 'Arial,Helvetica,sans-serif', 'Verdana': 'Verdana,Geneva,sans-serif', 'Trebuchet MS': '"Trebuchet MS",sans-serif', 'Georgia': 'Georgia,serif', 'Times New Roman': '"Times New Roman",Times,serif', 'Courier New': '"Courier New",monospace', 'system-ui': 'system-ui,sans-serif' };
  const FONT_LINKS = { 'Inter': 'Inter:wght@300;400;500;600;700;800', 'Barlow Condensed': 'Barlow+Condensed:wght@400;500;600;700', 'Playfair Display': 'Playfair+Display:wght@400;500;600;700' };
  const CSS_PROPS = { fontFamily: 'font-family', fontSize: 'font-size', fontWeight: 'font-weight', fontStyle: 'font-style', textAlign: 'text-align', color: 'color', letterSpacing: 'letter-spacing', lineHeight: 'line-height' };
  // Mirror of the strict whitelist in core.js: returns the value to apply, or null.
  function safeStyleValue(prop, value) {
    if (typeof value !== 'string') return null;
    switch (prop) {
      case 'fontFamily': return FONT_STACKS[value] ? value : null;
      case 'fontSize': return /^\d{1,3}(?:\.\d{1,2})?px$/.test(value) && parseFloat(value) >= 6 && parseFloat(value) <= 400 ? value : null;
      case 'fontWeight': return ['300', '400', '500', '600', '700', '800', '900'].includes(value) ? value : null;
      case 'fontStyle': return ['normal', 'italic'].includes(value) ? value : null;
      case 'textAlign': return ['left', 'center', 'right', 'justify'].includes(value) ? value : null;
      case 'color': return /^#(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(value) ? value : null;
      case 'letterSpacing': { const m = /^(-?\d{1,2}(?:\.\d{1,3})?)(em|px)$/.exec(value); return m && Math.abs(Number(m[1])) <= (m[2] === 'em' ? 2 : 30) ? value : null; }
      case 'lineHeight': return /^\d{1,2}(?:\.\d{1,2})?$/.test(value) && Number(value) >= .6 && Number(value) <= 4 ? value : null;
      default: return null;
    }
  }
  const scrollMode = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
  const KIND_LABEL = { title: 'Título', text: 'Texto', button: 'Botón', tag: 'Etiqueta', image: 'Imagen', background: 'Fondo', logo: 'Logo', icon: 'Ícono', video: 'Video', section: 'Sección', item: 'Elemento repetido' };
  const isTextId = id => /^(?:text|fragment|block)-/.test(id);
  const isTextKind = kind => ['title', 'text', 'button', 'tag'].includes(kind);
  function textClass(el) {
    const t = el.tagName;
    if (/^H[1-6]$/.test(t) || el.closest('h1,h2,h3,h4,h5,h6')) return 'title';
    if (t === 'DIV' && !el.closest('a[href],button,p,li')) { const size = parseFloat(getComputedStyle(el).fontSize) || 16; const len = (el.textContent || '').trim().length; return size >= 30 ? 'title' : len > 70 ? 'text' : 'tag'; }
    if (t === 'A' || t === 'BUTTON' || el.closest('a[href],button')) return 'button';
    if (t === 'P' || t === 'LI' || t === 'BLOCKQUOTE' || el.closest('p,li,blockquote')) return 'text';
    return 'tag';
  }
  function kindOf(id, el) {
    if (id.startsWith('section:')) return 'section';
    if (id.startsWith('item:')) return 'item';
    if (logoIds.has(id)) return 'logo';
    if (id.startsWith('icon-')) return 'icon';
    if (el.tagName === 'VIDEO') return 'video';
    if (el.tagName === 'CANVAS') return 'canvas';
    if (el.tagName === 'IMG') return 'image';
    if (id.startsWith('background-')) return 'background';
    if (isTextId(id)) return textClass(el);
    return 'button';
  }
  // A "block" is a title/paragraph/button made only of inline wrappers (typical split-text animations): it is selected, styled and hidden as one unit.
  const BLOCK_TAGS = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,a,button,label,figcaption,dt,dd,div';
  const INLINE_TEXT = new Set(['span', 'em', 'strong', 'b', 'i', 'br', 'small', 'sub', 'sup', 'mark', 'u', 's', 'abbr', 'wbr', 'cite', 'code', 'time']);
  const blockIds = new Map();
  const fnv = str => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); };
  const normalizedText = el => (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 400);
  let pureCache = new WeakMap();
  function isPureBlock(root) {
    if (pureCache.has(root)) return pureCache.get(root);
    let pure = !!root.textContent.trim() && !excluded(root);
    if (pure) { const all = root.getElementsByTagName('*'); if (all.length > 2500) pure = false; else for (const x of all) if (!INLINE_TEXT.has(x.localName) && !(x.localName === 'div' && /^inline/.test(getComputedStyle(x).display)) && !(/^(div|p|span|i|b)$/.test(x.localName) && x.closest('[aria-hidden="true"]'))) { pure = false; break; } }
    if (pure && root.querySelector('h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption,dt,dd,label')) pure = false;
    if (pure) {
      // Split-text pieces share one size; a container that mixes a small label and a big title is NOT one text.
      const sizes = [];
      for (const x of [root, ...root.getElementsByTagName('*')]) if ([...x.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.nodeValue.trim())) sizes.push(parseFloat(getComputedStyle(x).fontSize) || 0);
      if (sizes.length && Math.max(...sizes) - Math.min(...sizes) > 1) pure = false;
    }
    pureCache.set(root, pure); return pure;
  }
  function blockFor(el) {
    let best = null;
    for (let cur = el; cur && cur !== document.body && cur !== document.documentElement; cur = cur.parentElement) if (cur.matches(BLOCK_TAGS) && isPureBlock(cur)) best = cur;
    return best && best !== el ? best : null;
  }
  function textIdsIn(root) {
    const ids = []; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      if (!n.nodeValue.trim()) continue;
      const p = n.parentElement; const id = p && !p.childElementCount && /^text-/.test(p.dataset.cmsId || '') ? p.dataset.cmsId : fragmentIds.get(n);
      if (id && !ids.includes(id)) ids.push(id);
    }
    return ids;
  }
  function ensureBlock(root) {
    let id = blockIds.get(root); if (id) return id;
    if (!textIdsIn(root).length) return null;
    const key = fnv(root.localName + '|' + normalizedText(root));
    let n = 0; id = 'block-' + key;
    while (nodes.has(id) && nodes.get(id) !== root && nodes.get(id)?.isConnected) id = 'block-' + key + '-' + (++n);
    blockIds.set(root, id); nodes.set(id, root); return id;
  }
  function promote(hit) {
    if (!hit || !isTextId(hit.id) || hit.id.startsWith('block-')) return hit;
    const root = blockFor(hit.el); const id = root && ensureBlock(root);
    return id ? { id, el: root, kind: textClass(root) } : hit;
  }
  const style = document.createElement('style');
  style.dataset.cmsEditor = 'true';
  style.textContent = '[data-cms-hidden],[data-cms-removed]{display:none!important}' +
    'html[data-cms-selecting] *{cursor:default!important}html[data-cms-selecting][data-cms-grab] *{cursor:grab!important}html[data-cms-selecting][data-cms-dragging] *{cursor:grabbing!important}' +
    'html[data-cms-selecting] [data-cms-editing],html[data-cms-selecting] [data-cms-editing] *{cursor:text!important;user-select:text!important;-webkit-user-select:text!important;pointer-events:auto!important;outline:none!important}' +
    '#cms-overlay{position:fixed;inset:0;pointer-events:none;z-index:2147483646;--s:1;font-family:Inter,system-ui,sans-serif}#cms-overlay>div{position:fixed;display:none;box-sizing:border-box;margin:0;padding:0}' +
    '#cms-overlay .hv{border:calc(1.5px*var(--s)) solid #98ff03;box-shadow:0 0 0 calc(1px*var(--s)) rgba(20,24,18,.8)}' +
    '#cms-overlay .sel{border:calc(2px*var(--s)) solid #98ff03;box-shadow:0 0 0 calc(1px*var(--s)) rgba(20,24,18,.85),inset 0 0 0 calc(1px*var(--s)) rgba(20,24,18,.5)}' +
    '#cms-overlay .sel i{position:absolute;width:calc(8px*var(--s));height:calc(8px*var(--s));background:#fff;border:calc(1.5px*var(--s)) solid #191c19;border-radius:50%}' +
    '#cms-overlay .sel i:nth-child(1){left:calc(-5px*var(--s));top:calc(-5px*var(--s))}#cms-overlay .sel i:nth-child(2){right:calc(-5px*var(--s));top:calc(-5px*var(--s))}#cms-overlay .sel i:nth-child(3){left:calc(-5px*var(--s));bottom:calc(-5px*var(--s))}#cms-overlay .sel i:nth-child(4){right:calc(-5px*var(--s));bottom:calc(-5px*var(--s))}' +
    '#cms-overlay .tag{font:600 calc(11px*var(--s))/1 Inter,system-ui,sans-serif;letter-spacing:.02em;background:#191c19;color:#98ff03;padding:calc(5px*var(--s)) calc(8px*var(--s));border-radius:calc(4px*var(--s));white-space:nowrap}' +
    '#cms-overlay .drop{height:calc(4px*var(--s));border-radius:calc(2px*var(--s));background:#98ff03;box-shadow:0 0 0 calc(1px*var(--s)) rgba(20,24,18,.85),0 0 calc(16px*var(--s)) rgba(152,255,3,.85)}#cms-overlay .dropt{background:#98ff03;color:#17230e;font-weight:700}html[data-cms-dnd] [data-cms-dragging-block]{opacity:.35!important;outline:calc(2px*var(--s,1)) dashed #98ff03}html[data-cms-dnd],html[data-cms-dnd] *{cursor:grabbing!important}' +
    '#cms-overlay .note{font:600 calc(12px*var(--s))/1 Inter,system-ui,sans-serif;background:#191c19;color:#fff;padding:calc(6px*var(--s)) calc(10px*var(--s));border-radius:calc(6px*var(--s));white-space:nowrap}' +
    'html[data-cms-selecting] [data-cms-block] iframe,html[data-cms-selecting] [data-cms-block] video{pointer-events:none!important}html[data-cms-selecting] .ornat-blk--spacer{outline:1px dashed rgba(128,128,128,.6);outline-offset:-1px}html[data-cms-commenting] *{cursor:crosshair!important}' +
    '#cms-pins{position:fixed;inset:0;pointer-events:none;z-index:2147483645;--s:1;font-family:Inter,system-ui,sans-serif}#cms-pins .cpin{position:fixed;display:none;width:calc(26px*var(--s));height:calc(26px*var(--s));margin:calc(-13px*var(--s)) 0 0 calc(-13px*var(--s));padding:0;border:calc(2px*var(--s)) solid #fff;border-radius:50% 50% 50% 0;background:#98ff03;color:#17230e;font:700 calc(11px*var(--s))/1 Inter,system-ui,sans-serif;box-shadow:0 calc(2px*var(--s)) calc(8px*var(--s)) rgba(0,0,0,.45);pointer-events:auto;cursor:pointer;transform:rotate(-45deg)}#cms-pins .cpin span{display:block;transform:rotate(45deg)}#cms-pins .cpin.resolved{background:#b9bfae;color:#3b4237}#cms-pins .cpin.active{outline:calc(3px*var(--s)) solid #191c19}';
  document.head.append(style);
  const overlay = document.createElement('div');
  overlay.id = 'cms-overlay'; overlay.setAttribute('data-cms-editor', 'true'); overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = '<div class="hv"></div><div class="tag hvt"></div><div class="sel"><i></i><i></i><i></i><i></i></div><div class="tag selt"></div><div class="note"></div><div class="drop"></div><div class="tag dropt"></div>';
  document.documentElement.append(overlay);
  if (PUB) overlay.remove();
  const ov = { hv: overlay.querySelector('.hv'), hvt: overlay.querySelector('.hvt'), sel: overlay.querySelector('.sel'), selt: overlay.querySelector('.selt'), note: overlay.querySelector('.note'), drop: overlay.querySelector('.drop'), dropt: overlay.querySelector('.dropt') };
  let viewScale = 1; let selectedId = null; let selectedKind = null; let hoverHit = null; let mouse = null; let frameRequest = 0; let lastRectKey = ''; let lastSection = null; let editing = null; let drag = null; let lostSince = 0; let suppressClick = false; let noteTimer;
  const imageSizes = new Map();
  function box(div, rect) { div.style.cssText = `display:block;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`; }
  function tagAt(div, rect, text) {
    div.textContent = text; div.style.display = 'block';
    const s = 1 / viewScale; const above = rect.top - 24 * s - 4 * s;
    div.style.left = Math.max(2, Math.min(innerWidth - 80 * s, rect.left)) + 'px';
    div.style.top = (above >= 2 ? above : Math.min(innerHeight - 24 * s, rect.top + 6 * s)) + 'px';
  }
  function showNote(text, ms = 1600) { ov.note.textContent = text; ov.note.style.cssText = `display:block;left:${12 / viewScale}px;bottom:${12 / viewScale}px`; clearTimeout(noteTimer); if (ms) noteTimer = setTimeout(() => { ov.note.style.display = 'none'; }, ms); }
  const rendered = el => (typeof el.checkVisibility === 'function' ? el.checkVisibility({ checkVisibilityCSS: true }) : true);
  const seenOnScreen = el => (typeof el.checkVisibility === 'function' ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : true);
  // True when an ancestor with overflow/clip-path hides the point (e.g. the inactive items of a word rotator).
  function clippedAway(el, x, y) {
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible' || (cs.clipPath && cs.clipPath !== 'none')) {
        const r = a.getBoundingClientRect();
        if (x < r.left || x > r.right || y < r.top || y > r.bottom) return true;
      }
    }
    return false;
  }
  function resolve(el) {
    if (!el || el.closest('[data-cms-editor]')) return null;
    const target = el.closest('[data-cms-id]');
    let fp = el; while (fp && !fragmentParents.has(fp)) fp = fp.parentElement;
    let id;
    if (fp && (!target || target.contains(fp))) id = fragmentParents.get(fp)[0];
    else id = target?.dataset.cmsId || (fp && fragmentParents.get(fp)[0]);
    if (!id) return null;
    const element = textElement(nodes.get(id));
    if (!element?.isConnected || element.hasAttribute('data-cms-hidden')) return null;
    return promote({ id, el: element, kind: kindOf(id, element) });
  }
  function sectionHit(el) {
    const section = el?.closest?.('[data-cms-section]');
    return section && !section.closest('[data-cms-editor]') ? { id: 'section:' + section.dataset.cmsSection, el: section, kind: 'section' } : null;
  }
  function liveBox(el, x, y) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || x < r.left || x > r.right || y < r.top || y > r.bottom) return null;
    return r;
  }
  function textAt(x, y) {
    let best = null; let area = Infinity; const seen = new Set();
    for (const [id, node] of nodes) {
      if (!isTextId(id)) continue;
      const el = textElement(node);
      if (!el?.isConnected || seen.has(el) || excluded(el)) continue;
      seen.add(el);
      const r = liveBox(el, x, y); if (!r) continue;
      if (!seenOnScreen(el) || clippedAway(el, x, y)) continue;
      const a = r.width * r.height;
      if (a < area) { area = a; best = { id: fragmentParents.has(el) ? fragmentParents.get(el)[0] : id, el, kind: kindOf(id, el) }; }
    }
    return promote(best);
  }
  function mediaAt(x, y) {
    let best = null; let area = Infinity;
    for (const [id, node] of nodes) {
      if (!(logoIds.has(id) || /^(?:image|background|video|icon)-/.test(id)) || !(node instanceof Element) || !node.isConnected) continue;
      const r = liveBox(node, x, y); if (!r || !seenOnScreen(node) || clippedAway(node, x, y)) continue;
      const a = r.width * r.height; if (a < area) { area = a; best = { id, el: node, kind: kindOf(id, node) }; }
    }
    return best;
  }
  function pick(x, y) {
    let first = null;
    for (const el of document.elementsFromPoint(x, y)) {
      if (!seenOnScreen(el)) continue;
      const hit = resolve(el);
      if (hit && hit.kind !== 'canvas') { first = hit; break; }
    }
    if (!first || !isTextKind(first.kind)) { const t = textAt(x, y); if (t) return t; }
    if (first) return first;
    const media = mediaAt(x, y); if (media) return media;
    return sectionHit(document.elementsFromPoint(x, y).find(e => !e.closest('[data-cms-editor]')));
  }
  function colorHex(value) {
    const m = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(value || ''); if (!m) return '#000000';
    return '#' + [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('');
  }
  function describe() {
    if (!selected) return { id: null };
    const cs = getComputedStyle(selected); const text = isTextId(selectedId);
    const anchor = selected.closest?.('a[href]');
    const fontSize = parseFloat(cs.fontSize) || 16;
    const section = selected.closest?.('[data-cms-section]');
    const info = { id: selectedId, kind: selectedKind, label: KIND_LABEL[selectedKind] || 'Elemento', tag: selected.localName, editable: text && !isDynamic(selected), dynamic: text && isDynamic(selected), section: selectedKind === 'section' ? selected.dataset.cmsSection : section?.dataset.cmsSection || 'general', link: anchor && anchor.dataset.cmsId ? { id: anchor.dataset.cmsId, href: anchor.getAttribute('href') } : null };
    const blockEl = selected.closest?.('[data-cms-block]'); info.blockId = blockEl ? blockEl.dataset.cmsBlock : null; info.blockType = blockEl ? blockEl.dataset.cmsBlockType || '' : null;
    if (info.blockId && selectedKind === 'section') info.label = 'Bloque';
    try { if (structApi) { info.item = structApi.itemFor(selected); info.layout = structApi.sectionFor(selected); } } catch { /* sin estructura */ }
    if (selectedKind === 'section' || selectedKind === 'item') return info;
    if (['button', 'tag', 'title', 'text'].includes(selectedKind)) { const ctl = selected.closest?.('a,button'); if (ctl) { try { info.control = styleApi ? styleApi.controlInfo(ctl) : null; } catch { info.control = null; } } }
    if (text && !info.dynamic) {
      info.textIds = blockIds.has(selected) ? textIdsIn(selected) : (fragmentParents.get(selected) || [selectedId]);
      info.canAlign = cs.display !== 'inline';
      info.multiline = isMultiline(selected);
      info.style = { fontFamily: (cs.fontFamily.split(',')[0] || '').replace(/["']/g, '').trim(), fontSize: Math.round(fontSize * 10) / 10, fontWeight: Number(cs.fontWeight) || 400, fontStyle: cs.fontStyle === 'italic' ? 'italic' : 'normal', textAlign: /^(center|right|justify)$/.test(cs.textAlign) ? cs.textAlign : 'left', color: colorHex(cs.color), letterSpacing: cs.letterSpacing === 'normal' ? 0 : Math.round(parseFloat(cs.letterSpacing) / fontSize * 1000) / 1000, lineHeight: cs.lineHeight === 'normal' ? 1.2 : Math.round(parseFloat(cs.lineHeight) / fontSize * 100) / 100 };
    } else if (['image', 'background', 'video', 'icon'].includes(selectedKind)) {
      info.alt = selected.getAttribute('alt') || selected.getAttribute('aria-label') || '';
      info.fit = selectedKind === 'background' ? (/contain/.test(cs.backgroundSize) ? 'contain' : 'cover') : (cs.objectFit === 'contain' ? 'contain' : 'cover');
      info.position = selectedKind === 'background' ? cs.backgroundPosition : cs.objectPosition;
    }
    return info;
  }
  function select(hit, { scroll = false, silent = false } = {}) {
    if (!hit?.el?.isConnected) return;
    if (editing && editing.el !== hit.el) commitEdit();
    selected?.removeAttribute('data-cms-selected');
    selected = hit.el; selectedId = hit.id; selectedKind = hit.kind; lastRectKey = '';
    selected.setAttribute('data-cms-selected', '');
    if (scroll) { const r = hit.el.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight || r.height > innerHeight * .8) hit.el.scrollIntoView({ behavior: scrollMode(), block: r.height > innerHeight * .8 ? 'start' : 'center' }); }
    if (hit.kind === 'background' || hit.kind === 'image') preloadSize(hit.el);
    if (!silent) send('selected', describe());
    requestFrame();
  }
  function deselect(silent = false) {
    if (editing) commitEdit();
    if (!selected) return;
    selected.removeAttribute('data-cms-selected');
    selected = null; selectedId = null; selectedKind = null; lastRectKey = '';
    if (!silent) send('selected', { id: null });
    requestFrame();
  }
  function requestFrame() { if (!frameRequest) frameRequest = requestAnimationFrame(frame); }
  function frame() {
    frameRequest = 0;
    trackSection();
    if (pins.length) { positionPins(); requestFrame(); }
    if (!selecting) { for (const k of ['hv', 'hvt', 'sel', 'selt']) ov[k].style.display = 'none'; return; }
    hoverHit = null;
    if (mouse && !drag && !editing) {
      const hit = pick(mouse.x, mouse.y);
      hoverHit = hit && hit.el !== selected ? hit : null;
      const grab = !!hit && hit.el === selected && ['image', 'background'].includes(selectedKind);
      document.documentElement.toggleAttribute('data-cms-grab', grab);
    }
    if (hoverHit) { const r = hoverHit.el.getBoundingClientRect(); box(ov.hv, r); tagAt(ov.hvt, r, KIND_LABEL[hoverHit.kind] || 'Elemento'); } else { ov.hv.style.display = 'none'; ov.hvt.style.display = 'none'; }
    if (selected && !selected.isConnected) {
      const next = textElement(nodes.get(selectedId));
      if (next?.isConnected) { select({ id: selectedId, el: next, kind: selectedKind }); }
      else { lostSince = lostSince || Date.now(); if (Date.now() - lostSince > 4000) { lostSince = 0; deselect(); return; } for (const k of ['sel', 'selt']) ov[k].style.display = 'none'; requestFrame(); return; }
    } else lostSince = 0;
    if (selected) {
      const r = selected.getBoundingClientRect(); const shown = r.width > 0 && r.height > 0;
      if (shown) { box(ov.sel, r); tagAt(ov.selt, r, editing ? 'Editando · Esc cancela' : KIND_LABEL[selectedKind] || 'Elemento'); } else { ov.sel.style.display = 'none'; ov.selt.style.display = 'none'; }
      const key = [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height), innerWidth, innerHeight].join(',');
      if (key !== lastRectKey) { lastRectKey = key; send('rect', { rect: { x: r.left, y: r.top, w: r.width, h: r.height }, vw: innerWidth, vh: innerHeight }); }
    } else { ov.sel.style.display = 'none'; ov.selt.style.display = 'none'; }
    if (selected || drag) requestFrame();
  }
  function inFlow(el) {
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
      const p = getComputedStyle(a).position;
      if ((p === 'fixed' || p === 'sticky') && !a.parentElement?.classList.contains('pin-spacer')) return false;
    }
    return true;
  }
  function trackSection() {
    let best = null; let area = 0;
    for (const el of document.querySelectorAll('[data-cms-section]')) {
      if (el.querySelector('[data-cms-section]') || !inFlow(el)) continue;
      const r = el.getBoundingClientRect();
      const visibleArea = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) * Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
      if (visibleArea > area) { area = visibleArea; best = el; }
    }
    const id = best?.dataset.cmsSection || null;
    if (id !== lastSection) { lastSection = id; send('current-section', { id }); }
  }
  // ---- inline text editing ----
  // Text as typed (keeps case and line breaks); innerText would return the CSS-transformed text.
  function plainText(root) {
    let out = '';
    const walk = node => {
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) out += child.nodeValue;
        else if (child.nodeType === Node.ELEMENT_NODE) {
          if (child.localName === 'br') { out += '\n'; continue; }
          const block = !/^inline/.test(getComputedStyle(child).display);
          if (block && out && !out.endsWith('\n')) out += '\n';
          walk(child);
          if (block && out && !out.endsWith('\n')) out += '\n';
        }
      }
    };
    walk(root);
    return out;
  }
  function isMultiline(el) { return /^(pre|pre-line|pre-wrap|break-spaces)$/.test(getComputedStyle(el).whiteSpace); }
  function snapshotTree(el) {
    const values = []; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) values.push([n, n.nodeValue]);
    return { values, kids: [el, ...el.querySelectorAll('*')].map(p => [p, [...p.childNodes]]) };
  }
  function restoreTree(snap) { for (const [p, kids] of snap.kids) p.replaceChildren(...kids); for (const [n, v] of snap.values) n.nodeValue = v; }
  function textNodeOf(id) {
    const node = nodes.get(id);
    if (node?.nodeType === Node.TEXT_NODE) return node;
    if (node instanceof Element && node.childNodes.length === 1 && node.firstChild.nodeType === Node.TEXT_NODE) return node.firstChild;
    return null;
  }
  function startEdit({ caret = 'end' } = {}) {
    if (editing || !selected || !isTextKind(selectedKind) || !isTextId(selectedId)) return false;
    if (isDynamic(selected)) { send('notification', { level: 'info', message: 'Este texto lo controla la animación de la plantilla y se reescribe solo; no se puede editar aquí.' }); return false; }
    const el = selected; const isBlock = blockIds.has(el);
    let ids = isBlock ? textIdsIn(el) : (fragmentParents.get(el) || [selectedId]);
    if (isBlock && !ids.length) { send('inventory', { inventory: scan() }); ids = textIdsIn(el); }
    const leaf = !isBlock && !el.childElementCount && ids.length === 1 && !fragmentParents.has(el);
    if (!leaf && ids.some(id => !textNodeOf(id))) { send('notification', { level: 'info', message: 'Este texto tiene una estructura compleja. Edítalo desde el panel Texto para no romper su diseño.' }); return false; }
    editing = { el, ids, leaf, snap: snapshotTree(el), multiline: isMultiline(el), before: leaf ? el.textContent : null, attr: el.getAttribute('contenteditable') };
    el.setAttribute('contenteditable', 'true'); el.setAttribute('data-cms-editing', ''); el.spellcheck = false;
    el.addEventListener('paste', onEditPaste); el.addEventListener('drop', onEditDrop); el.addEventListener('beforeinput', onBeforeInput); el.addEventListener('blur', onEditBlur);
    el.focus({ preventScroll: true });
    const current = getSelection();
    if (caret === 'end' || !current.rangeCount || !el.contains(current.anchorNode)) { const range = document.createRange(); range.selectNodeContents(el); range.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(range); }
    send('edit-state', { editing: true, id: selectedId }); requestFrame();
    return true;
  }
  function onEditPaste(e) { e.preventDefault(); let text = e.clipboardData?.getData('text/plain') || ''; text = editing?.multiline ? text : text.replace(/\s*\n+\s*/g, ' '); document.execCommand('insertText', false, text); }
  function onEditDrop(e) { e.preventDefault(); }
  function onBeforeInput(e) {
    if (/^format/.test(e.inputType) || (/^insert(Paragraph|LineBreak)$/.test(e.inputType) && !editing?.multiline)) e.preventDefault();
  }
  function onEditBlur() { setTimeout(() => { if (editing && document.activeElement !== editing.el) commitEdit(); }, 0); }
  function endEdit() {
    const { el, attr } = editing;
    el.removeEventListener('paste', onEditPaste); el.removeEventListener('drop', onEditDrop); el.removeEventListener('beforeinput', onBeforeInput); el.removeEventListener('blur', onEditBlur);
    el.removeAttribute('data-cms-editing'); if (attr === null) el.removeAttribute('contenteditable'); else el.setAttribute('contenteditable', attr);
    getSelection()?.removeAllRanges();
    editing = null; dynObserver.takeRecords(); dynLast = new WeakMap(); send('edit-state', { editing: false }); requestFrame();
  }
  function cancelEdit(message) {
    if (!editing) return;
    restoreTree(editing.snap); endEdit();
    if (message) send('notification', { level: 'info', message });
  }
  function commitEdit() {
    if (!editing) return;
    const { el, ids, leaf, multiline } = editing; const edits = {};
    if (leaf) {
      let value = (multiline ? plainText(el) : el.textContent).replace(/ /g, ' ');
      value = multiline ? value.replace(/\n{3,}/g, '\n\n').trim() : value.replace(/\s+/g, ' ').trim();
      if (!value) { cancelEdit('Un texto no puede quedar vacío. Para quitarlo, selecciónalo y usa Ocultar.'); return; }
      if (value.length > 3000) { cancelEdit('Ese texto es demasiado largo (máximo 3000 caracteres).'); return; }
      const norm = text => (multiline ? text : text.replace(/\s+/g, ' ')).replace(/\u00a0/g, ' ').trim();
      if (value !== norm(editing.before)) { edits[ids[0]] = value; el.textContent = value; }
      else restoreTree(editing.snap);
    } else {
      const expected = ids.map(id => textNodeOf(id));
      const bid = blockIds.get(el);
      const intact = expected.every(n => n && el.contains(n));
      let joinedNow = ''; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
      while ((n = w.nextNode())) joinedNow += n.nodeValue;
      const was = new Map(editing.snap.values);
      let emptied = false; let partial = null;
      if (intact && joinedNow === expected.map(x => x.nodeValue).join('')) {
        partial = {};
        expected.forEach((node, i) => { if (node.nodeValue !== was.get(node)) { const value = node.nodeValue.trim(); if (value) partial[ids[i]] = value; else emptied = true; } });
      }
      const hasOverride = !!bid && lastPatch.texts?.[bid] !== undefined;
      if (partial && !emptied && !hasOverride) { Object.assign(edits, partial); if (!Object.keys(edits).length) restoreTree(editing.snap); }
      else {
        // The text was rewritten across several animated pieces (split words or letters). One block-level edit keeps the template's own
        // wrappers and motion: the whole new text goes in the first piece and the other pieces stay empty. It survives reloads because
        // the block id depends on the content, not on how many pieces the template creates.
        const full = (multiline ? plainText(el) : el.textContent).replace(/\u00a0/g, ' ').replace(multiline ? /\n{3,}/g : /\s+/g, multiline ? '\n\n' : ' ').trim();
        if (!full) { cancelEdit('Un texto no puede quedar vacío. Para quitarlo, selecciónalo y usa Ocultar.'); return; }
        if (full.length > 3000) { cancelEdit('Ese texto es demasiado largo (máximo 3000 caracteres).'); return; }
        const original = ids.map((id, i) => (was.get(expected[i]) ?? '').trim()).join(' ').replace(/\s+/g, ' ').trim();
        restoreTree(editing.snap);
        if (full !== original) {
          if (bid) edits[bid] = full; else ids.forEach((id, i) => { edits[id] = i === 0 ? full : ''; });
          send('notification', { level: 'info', message: styleApi?.split.can(el) ? 'Reescribiste el título completo: se reconstruyó su división en letras o palabras con el mismo diseño, para que la animación siga funcionando.' : 'Reescribiste el título completo: se unificó en una sola pieza para conservar el diseño. Se pierde la animación palabra por palabra de ese título.' });
        }
      }
    }
    endEdit();
    if (Object.keys(edits).length) send('text-edit', { edits });
  }
  // ---- image reframing by dragging ----
  function preloadSize(el) {
    if (el.tagName === 'IMG') return;
    const m = /^url\(["']?(.*?)["']?\)$/.exec(getComputedStyle(el).backgroundImage); if (!m || imageSizes.has(m[1])) return;
    imageSizes.set(m[1], null); const im = new Image(); im.onload = () => imageSizes.set(m[1], { w: im.naturalWidth, h: im.naturalHeight }); im.src = m[1];
  }
  function naturalSize(el) {
    if (el.tagName === 'IMG') return el.naturalWidth ? { w: el.naturalWidth, h: el.naturalHeight } : null;
    const m = /^url\(["']?(.*?)["']?\)$/.exec(getComputedStyle(el).backgroundImage); return m ? imageSizes.get(m[1]) : null;
  }
  function currentPosition(el) {
    const raw = el.tagName === 'IMG' ? getComputedStyle(el).objectPosition : getComputedStyle(el).backgroundPosition;
    const [a, b] = raw.split(/\s+/).map(v => v.endsWith('%') ? parseFloat(v) : 50);
    return [Number.isFinite(a) ? a : 50, Number.isFinite(b) ? b : 50];
  }
  function startDrag(e) {
    const el = selected; const nat = naturalSize(el);
    const cw = el.offsetWidth || el.getBoundingClientRect().width; const ch = el.offsetHeight || el.getBoundingClientRect().height;
    if (!nat || !cw || !ch) { showNote('Espera un momento: la imagen aún está cargando.'); return false; }
    const cs = getComputedStyle(el);
    if ((el.tagName === 'IMG' && cs.objectFit === 'contain') || (el.tagName !== 'IMG' && /contain/.test(cs.backgroundSize))) { showNote('Cambia el ajuste a «Llenar» para reencuadrar.', 2200); return false; }
    const cover = Math.max(cw / nat.w, ch / nat.h); const ox = nat.w * cover - cw; const oy = nat.h * cover - ch;
    if (ox < 1 && oy < 1) { showNote('Esta imagen ya encaja en su espacio: no hay encuadre que mover.', 2200); return false; }
    const r = el.getBoundingClientRect(); const sx = el.offsetWidth ? r.width / el.offsetWidth : 1; const sy = el.offsetHeight ? r.height / el.offsetHeight : 1;
    drag = { id: selectedId, el, x0: e.clientX, y0: e.clientY, pos: currentPosition(el), ox, oy, sx: sx || 1, sy: sy || 1, moved: false, pointerId: e.pointerId, current: null };
    try { el.setPointerCapture?.(e.pointerId); } catch { /* optional */ }
    document.documentElement.setAttribute('data-cms-dragging', '');
    requestFrame();
    return true;
  }
  function moveDrag(e) {
    const d = drag; if (!d) return;
    const dx = (e.clientX - d.x0) / d.sx; const dy = (e.clientY - d.y0) / d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 3) return;
    d.moved = true;
    const nx = d.ox >= 1 ? Math.max(0, Math.min(100, d.pos[0] - dx / d.ox * 100)) : d.pos[0];
    const ny = d.oy >= 1 ? Math.max(0, Math.min(100, d.pos[1] - dy / d.oy * 100)) : d.pos[1];
    d.current = `${Math.round(nx * 10) / 10}% ${Math.round(ny * 10) / 10}%`;
    if (d.el.tagName === 'IMG') { d.el.style.objectFit = 'cover'; d.el.style.objectPosition = d.current; } else { d.el.style.backgroundSize = 'cover'; d.el.style.backgroundPosition = d.current; }
    showNote(`Encuadre ${Math.round(nx)}% · ${Math.round(ny)}%`, 0);
    e.preventDefault();
  }
  function endDrag() {
    const d = drag; if (!d) return;
    drag = null; document.documentElement.removeAttribute('data-cms-dragging');
    try { d.el.releasePointerCapture?.(d.pointerId); } catch { /* optional */ }
    clearTimeout(noteTimer); ov.note.style.display = 'none';
    if (d.moved && d.current) { suppressClick = true; setTimeout(() => { suppressClick = false; }, 400); send('image-position', { id: d.id, position: d.current }); }
  }
  // ---- keyboard stepping between elements of the same section ----
  function selectable() {
    const section = selected?.closest?.('[data-cms-section]'); const seen = new Set(); const list = [];
    for (const [id, node] of nodes) {
      const el = textElement(node);
      if (!(el instanceof Element) || !el.isConnected || seen.has(el) || (section && el.closest('[data-cms-section]') !== section)) continue;
      if (!(isTextId(id) || logoIds.has(id) || /^(?:image|background|video|icon)-/.test(id))) continue;
      const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || !rendered(el)) continue;
      const hit = promote({ id: fragmentParents.has(el) ? fragmentParents.get(el)[0] : id, el, kind: kindOf(id, el) });
      if (seen.has(hit.el)) continue;
      seen.add(el); seen.add(hit.el); list.push(hit);
    }
    return list.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  }
  function step(dir) {
    if (!selected) return;
    if (selectedKind === 'section') { const first = selectable()[0]; if (first) select(first, { scroll: true }); return; }
    const list = selectable(); const i = list.findIndex(item => item.el === selected);
    const next = list[i + (dir > 0 ? 1 : -1)]; if (next) select(next, { scroll: true });
  }
  // ---- hidden elements and styles (patch.hidden / patch.styles) ----
  const styleBackup = new Map();
  function restoreStyle(el, prop) {
    const css = CSS_PROPS[prop]; const backup = styleBackup.get(el); if (!css || !backup || !(css in backup)) return;
    const [value, priority] = backup[css]; if (value) el.style.setProperty(css, value, priority); else el.style.removeProperty(css);
    delete backup[css];
  }
  function ensureFonts(fonts) {
    let link = document.querySelector('link[data-cms-font]');
    if (!fonts.size) { link?.remove(); return; }
    const href = 'https://fonts.googleapis.com/css2?' + [...fonts].sort().map(f => 'family=' + FONT_LINKS[f]).join('&') + '&display=swap';
    if (!link) { link = document.createElement('link'); link.rel = 'stylesheet'; link.dataset.cmsFont = 'true'; document.head.append(link); }
    if (link.getAttribute('href') !== href) link.setAttribute('href', href);
  }
  function applyStyles(next) {
    const prev = lastPatch.styles || {}; const fonts = new Set();
    for (const [id, props] of Object.entries(prev)) { const node = nodes.get(id); const el = node && textElement(node); if (!el) continue; for (const prop of Object.keys(props || {})) if (!(prop in (next[id] || {}))) restoreStyle(el, prop); }
    for (const [id, props] of Object.entries(next)) {
      const node = nodes.get(id); const el = node && textElement(node); if (!el || !props || typeof props !== 'object') continue;
      for (const [prop, value] of Object.entries(props)) {
        const css = CSS_PROPS[prop]; const safe = safeStyleValue(prop, value); if (!css || safe === null) continue;
        let backup = styleBackup.get(el); if (!backup) styleBackup.set(el, backup = {});
        if (!(css in backup)) backup[css] = [el.style.getPropertyValue(css), el.style.getPropertyPriority(css)];
        el.style.setProperty(css, prop === 'fontFamily' ? FONT_STACKS[value] : safe, 'important');
        if (prop === 'fontFamily' && FONT_LINKS[value]) fonts.add(value);
      }
    }
    ensureFonts(fonts);
  }
  function hiddenElement(id) {
    if (id.startsWith('item:')) return structApi?.byItem(id.slice(5)) || null;
    if (id.startsWith('section:')) { const sid = id.slice(8); return [...document.querySelectorAll('[data-cms-section]')].find(el => el.dataset.cmsSection === sid) || null; }
    const node = nodes.get(id); return node ? textElement(node) : null;
  }
  const blockOriginal = new WeakMap();
  function applyBlockTexts(next) {
    const prev = lastPatch.texts || {};
    const pieces = root => textIdsIn(root).map(id => textNodeOf(id)).filter(Boolean);
    let splitChanged = false;
    for (const id of Object.keys(prev)) {
      if (!id.startsWith('block-') || id in next) continue;
      const root = nodes.get(id);
      if (root && styleApi?.split.isRebuilt(root)) { styleApi.split.restore(root); splitChanged = true; continue; }
      const saved = root && blockOriginal.get(root);
      if (saved) { for (const [node, value] of saved) if (node.isConnected) node.nodeValue = value; blockOriginal.delete(root); }
    }
    for (const [id, value] of Object.entries(next)) {
      if (!id.startsWith('block-') || typeof value !== 'string' || !value.trim() || value.length > 5000 || editing?.ids && editing.el === nodes.get(id)) continue;
      const root = nodes.get(id); if (!(root instanceof Element) || !root.isConnected) continue;
      const sp = styleApi?.split;
      if (sp && (sp.isRebuilt(root) || (!blockOriginal.has(root) && sp.can(root)))) { if (sp.rebuild(root, value)) splitChanged = true; continue; }
      const list = pieces(root); if (!list.length) continue;
      if (!blockOriginal.has(root)) blockOriginal.set(root, list.map(node => [node, node.nodeValue]));
      list.forEach((node, i) => { const text = i === 0 ? value : ''; if (node.nodeValue !== text) node.nodeValue = text; });
    }
    if (splitChanged) { scan(); needInventory = true; }
  }
  function applyHidden(next, quiet = false) {
    const prev = lastPatch.hidden || {}; let changed = false;
    for (const id of Object.keys(prev)) if (!(id in next)) { const el = hiddenElement(id); if (el?.hasAttribute('data-cms-hidden')) { el.removeAttribute('data-cms-hidden'); changed = true; } }
    for (const id of Object.keys(next)) { const el = hiddenElement(id); if (el && !el.hasAttribute('data-cms-hidden')) { el.setAttribute('data-cms-hidden', ''); changed = true; if (selected && (selected === el || el.contains(selected))) deselect(); } }
    if (changed && !quiet) { dispatchEvent(new Event('resize')); try { window.ScrollTrigger?.refresh?.(); } catch { /* template-owned */ } }
  }
  function imagePatch(el, data) {
    const src = safeSource(data.src);
    if (!src) return;
    const fit = ['cover', 'contain', 'fill'].includes(data.fit) ? data.fit : 'cover';
    const position = typeof data.position === 'string' && /^(left|center|right|top|bottom|\d+(?:\.\d+)?%)(\s+(left|center|right|top|bottom|\d+(?:\.\d+)?%))?$/.test(data.position) ? data.position : '50% 50%';
    if (el.tagName === 'IMG') {
      el.src = src; el.removeAttribute('srcset'); el.removeAttribute('sizes');
      el.closest('picture')?.querySelectorAll('source').forEach(s => s.remove());
      el.alt = typeof data.alt === 'string' ? data.alt.slice(0, 1000) : el.alt;
      el.style.objectFit = fit; el.style.objectPosition = position;
    } else { el.style.backgroundImage = `url(${JSON.stringify(src)})`; el.style.backgroundSize = fit === 'fill' ? '100% 100%' : fit; el.style.backgroundPosition = position; }
  }
  function replaceLogo(el, src) {
    if (el.tagName === 'IMG') { imagePatch(el, { src, fit: 'contain' }); return; }
    if (el.tagName.toLowerCase() === 'svg') {
      const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
      const box = el.viewBox?.baseVal;
      image.setAttribute('href', src); image.setAttribute('x', box?.x || 0); image.setAttribute('y', box?.y || 0); image.setAttribute('width', box?.width || el.getBoundingClientRect().width || 64); image.setAttribute('height', box?.height || el.getBoundingClientRect().height || 64); image.setAttribute('preserveAspectRatio', 'xMidYMid meet'); image.dataset.cmsLogo = 'true';
      el.replaceChildren(image); el.dataset.cmsLogoContent = 'true';
      return;
    }
    if (el.querySelector('img[data-cms-logo]')) { imagePatch(el.querySelector('img[data-cms-logo]'), { src, fit: 'contain' }); return; }
    const box = el.getBoundingClientRect();
    const width = box.width || Math.max(48, parseFloat(getComputedStyle(el).fontSize) * 3 || 120);
    const height = box.height || parseFloat(getComputedStyle(el).lineHeight) || 40;
    const img = document.createElement('img');
    img.dataset.cmsLogo = 'true'; img.alt = 'Logo'; img.src = src;
    img.style.cssText = `width:${width}px;height:${height}px;object-fit:contain;display:inline-block;vertical-align:middle;max-width:100%`;
    el.replaceChildren(img); el.dataset.cmsLogoContent = 'true';
  }
  function restoreLogo(el, saved) {
    if (!el || !saved) return;
    el.replaceChildren(...[...saved.childNodes].map(node => node.cloneNode(true)));
    el.removeAttribute('data-cms-logo-content');
    for (const child of el.querySelectorAll('[data-cms-id]')) nodes.set(child.dataset.cmsId, child);
  }
  function videoPatch(el, value) {
    let reload = false;
    const src = safeVideo(value.src);
    if (src && el.getAttribute('src') !== src) { el.querySelectorAll('source').forEach(source => source.remove()); el.src = src; reload = true; }
    const poster = safeSource(value.poster);
    if (poster) el.poster = poster;
    if (value.poster === '') el.removeAttribute('poster');
    if (['cover', 'contain', 'fill'].includes(value.fit)) el.style.objectFit = value.fit;
    if (typeof value.position === 'string' && /^(left|center|right|top|bottom|\d+(?:\.\d+)?%)(\s+(left|center|right|top|bottom|\d+(?:\.\d+)?%))?$/.test(value.position)) el.style.objectPosition = value.position;
    if (reload) { el.load(); if (el.autoplay) el.play()?.catch(() => {}); }
  }

  // ---------- Bloques insertados ----------
  // Plantillas con scroll virtual (p. ej. Lenis con envoltorio): el documento no crece, pero un contenedor a pantalla casi completa
  // desplaza un contenido más alto. Los bloques insertados dentro de ese contenido sí quedan al alcance del scroll.
  function findVirtualScroller() {
    const wanted = innerHeight * 0.8;
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('[data-cms-editor]') || el.scrollHeight <= el.clientHeight * 1.08 + 8 || el.clientHeight < wanted || el.clientWidth < innerWidth * 0.8) continue;
      const cs = getComputedStyle(el);
      if (/(hidden|auto|scroll|clip)/.test(cs.overflowY) && cs.position !== 'fixed') return el;
    }
    return null;
  }
  function refreshScrollEngines() {
    dispatchEvent(new Event('resize'));
    try { window.ScrollTrigger?.refresh?.(); } catch { /* template-owned */ }
    for (const l of new Set([window.ornatPageLenis, window.lenis])) { try { l?.resize?.(); } catch { /* template-owned */ } }
    for (const el of document.querySelectorAll('.swiper,.swiper-container')) { try { el.swiper?.update?.(); } catch { /* template-owned */ } }
  }
  function detectTheme() {
    const rgb = v => { const m = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,\/]+([\d.]+))?/.exec(v || ''); return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null; };
    const hex = c => '#' + [c.r, c.g, c.b].map(n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('');
    const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
    const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    const outside = el => !el.closest('[data-cms-block],[data-cms-editor]');
    const body = getComputedStyle(document.body);
    let ink = rgb(body.color) || { r: 25, g: 28, b: 25 };
    let bg = null;
    for (const el of [document.body, document.documentElement]) { const c = rgb(getComputedStyle(el).backgroundColor); if (c && c.a > .6) { bg = c; break; } }
    if (!bg) bg = lum(ink) > .5 ? { r: 17, g: 17, b: 17 } : { r: 255, g: 255, b: 255 };
    if (contrast(ink, bg) < 3) ink = lum(bg) > .5 ? { r: 17, g: 17, b: 17 } : { r: 245, g: 245, b: 240 };
    const heading = [...document.querySelectorAll('h1,h2')].find(e => outside(e) && e.textContent.trim());
    const hs = heading ? getComputedStyle(heading) : null;
    let accent = null;
    for (const c of inventory?.colors || []) { if (/accent|brand|^--(or|lime|gold|primary|main)$/i.test(c.key)) { const parsed = rgb(c.value) || (/^#([\da-f]{3}|[\da-f]{6})$/i.test(c.value) ? (() => { let h = c.value.slice(1); if (h.length === 3) h = [...h].map(x => x + x).join(''); return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }; })() : null); if (parsed) { accent = parsed; break; } } }
    let radius = '2px';
    for (const b of document.querySelectorAll('a[class*="btn"],a[class*="button"],button,.btn,.button,[class*="cta"]')) {
      if (!outside(b)) continue; const cs = getComputedStyle(b); const c = rgb(cs.backgroundColor);
      if (!accent && c && c.a > .8 && contrast(c, bg) >= 2) accent = c;
      if (c && c.a > .8 && /^\d+(\.\d+)?px$/.test(cs.borderRadius)) { radius = Math.min(24, parseFloat(cs.borderRadius)) + 'px'; break; }
    }
    if (!accent || contrast(accent, bg) < 2.2) accent = ink;
    const fs = parseFloat(hs?.fontSize) || 16; const ls = hs && hs.letterSpacing !== 'normal' ? parseFloat(hs.letterSpacing) / fs : 0;
    return { font: body.fontFamily, hfont: hs?.fontFamily || body.fontFamily, hweight: hs ? String(Math.round(Number(hs.fontWeight) || 600)) : '600', hls: Math.abs(ls) < 1 && Number.isFinite(ls) ? ls.toFixed(3) + 'em' : '0', htt: hs && /^(uppercase|lowercase|capitalize)$/.test(hs.textTransform) ? hs.textTransform : 'none', ink: hex(ink), bg: hex(bg), accent: hex(accent), btnink: lum(accent) > .42 ? '#111111' : '#ffffff', radius };
  }
  function flowParentOK(p) {
    if (!p) return false;
    const cs = getComputedStyle(p);
    if (cs.position === 'fixed' || cs.position === 'sticky') return false;
    const d = cs.display;
    if (d === 'grid' || d === 'inline-grid' || d === 'inline' || d === 'table' || d === 'contents' || d === 'inline-block') return false;
    if ((d === 'flex' || d === 'inline-flex') && !/^column/.test(cs.flexDirection)) return false;
    if (p !== document.body && p !== document.documentElement && /(auto|scroll)/.test(cs.overflowX) && p.scrollWidth > p.clientWidth + 2) return false;
    return true;
  }
  // ¿La sección `nx` dibuja algo grande por encima de su propio borde superior (una imagen que sube hacia la sección anterior,
  // una capa animada con GSAP)? Un bloque colocado justo antes quedaría tapado por esa capa.
  function overlapsUp(nx) {
    const nr = nx.getBoundingClientRect(); const minArea = innerWidth * innerHeight * 0.12;
    const all = nx.querySelectorAll('*'); const limit = Math.min(all.length, 160);
    for (let i = 0; i < limit; i++) {
      const d = all[i]; if (d.closest('[data-cms-editor],[data-cms-block]')) continue;
      const r = d.getBoundingClientRect(); if (r.width * r.height < minArea || r.top >= nr.top - 24) continue;
      const cs = getComputedStyle(d); if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) continue;
      let fixed = false; for (let a = d; a && a !== nx.parentElement; a = a.parentElement) if (getComputedStyle(a).position === 'fixed') { fixed = true; break; }
      if (!fixed) return true;
    }
    return false;
  }
  // ¿`el` lleva una capa grande, absoluta, con z-index y animada con GSAP (p. ej. una imagen que crece sobre la sección siguiente)?
  // Un bloque colocado justo después quedaría debajo de esa capa mientras se anima.
  function hasAnimatedLayer(el) {
    const all = el.querySelectorAll('*'); const limit = Math.min(all.length, 500); const minArea = innerWidth * innerHeight * 0.12;
    for (let i = 0; i < limit; i++) {
      const d = all[i]; if (!d._gsap || d.closest('[data-cms-editor],[data-cms-block]')) continue;
      const cs = getComputedStyle(d); if (cs.position !== 'absolute' || cs.zIndex === 'auto' || !(Number(cs.zIndex) > 0)) continue;
      const r = d.getBoundingClientRect(); if (r.width * r.height >= minArea) return true;
    }
    return false;
  }
  // Contenedor de flujo normal donde se puede colocar un bloque justo después de `el` (nunca dentro de pines/sticky/carruseles).
  function safeContainer(el) {
    let cur = el;
    if (cur.parentElement?.classList.contains('pin-spacer')) cur = cur.parentElement;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      const p = cur.parentElement; const cs = getComputedStyle(cur);
      // Una sección siguiente que se encima a propósito (margen negativo) taparía el bloque: ese punto no es seguro.
      const nx = cur.nextElementSibling; const nxs = nx && !nx.hasAttribute('data-cms-block') ? getComputedStyle(nx) : null;
      if ((nxs && parseFloat(nxs.marginTop) < 0 && nxs.position !== 'absolute' && nxs.position !== 'fixed') || parseFloat(cs.marginBottom) < 0) return null;
      if (nx && nxs && nxs.position !== 'fixed' && overlapsUp(nx)) return null;
      // Un bloque ocupa todo el ancho: no se coloca dentro de tarjetas o maquetas estrechas (sube hasta un contenedor de página).
      if (cur.getBoundingClientRect().width < innerWidth * 0.8) { cur = p; continue; }
      if (cs.position !== 'fixed' && cs.position !== 'sticky' && cs.display !== 'none' && p && flowParentOK(p) && inFlow(cur) && !cur.closest('[data-cms-block],[data-cms-editor]') && !hasAnimatedLayer(cur)) return cur;
      cur = p;
    }
    return null;
  }
  function endContainer() {
    const footer = [...document.querySelectorAll('footer')].filter(f => !f.closest('[data-cms-block]')).pop();
    return footer ? safeContainer(footer) : null;
  }
  function computeInsertPoints(sections) {
    const out = []; const seen = new Set();
    for (const s of sections) {
      if (!s.leaf || !s.visible || s.tag === 'nav' || s.tag === 'footer' || s.id.startsWith('blk-')) continue;
      const el = document.querySelector(`[data-cms-section="${CSS.escape(s.id)}"]`); if (!el || el.closest('[data-cms-block]')) continue;
      const r = el.getBoundingClientRect(); if (r.height < 20) continue;
      const c = safeContainer(el); if (!c || seen.has(c)) continue;
      seen.add(c); out.push({ id: s.id, label: s.label });
    }
    return out;
  }
  function applyThemeVars(el, theme) {
    if (!blocksApi) return;
    for (const part of blocksApi.themeStyle(theme).split(';')) { const i = part.indexOf(':'); if (i > 0) el.style.setProperty(part.slice(0, i), part.slice(i + 1)); }
  }
  function ensureBlockCss() {
    let css = document.querySelector('style[data-cms-block-css]');
    if (!css) { css = document.createElement('style'); css.dataset.cmsBlockCss = 'true'; css.textContent = blocksApi.BLOCK_CSS; document.head.append(css); }
  }
  function mountBlockModules() {
    try { blocksApi?.blockRuntime?.(false); } catch { /* opcional */ }
    if (document.querySelector('ornat-catalog')) import('/shared/catalog.js').catch(() => {});
    if (document.querySelector('[data-ornat-form]')) import('/shared/forms.js').then(m => { try { m.attachAll?.(); } catch { /* optional */ } }).catch(() => {});
  }
  function applyBlocks(list) {
    list = (Array.isArray(list) ? list : []).filter(b => blocksApi?.isRenderableBlock?.(b));
    const existing = document.querySelectorAll('[data-cms-block]');
    if (!list.length && !existing.length) { blockIssues = []; blockPlaced = []; return false; }
    if (!blocksApi) return false;
    ensureBlockCss();
    const theme = detectTheme(); let changed = false; const issues = []; const placed = [];
    const wanted = new Set(list.map(b => b.id));
    existing.forEach(el => { if (!wanted.has(el.dataset.cmsBlock)) { el.remove(); blocksSig.delete(el.dataset.cmsBlock); changed = true; } });
    const plans = new Map(); // contenedor de flujo → bloques que van junto a él (varios puntos pueden compartir contenedor)
    for (const b of list) {
      let el = document.querySelector(`[data-cms-block="${CSS.escape(b.id)}"]`);
      const sig = JSON.stringify([b.type, b.fields]);
      if (!el || blocksSig.get(b.id) !== sig) {
        for (const k of [...originals.keys()]) if (k.includes('-b-' + b.id + '-')) originals.delete(k);
        const tpl = document.createElement('template'); tpl.innerHTML = blocksApi.renderBlock(b, {});
        const fresh = tpl.content.firstElementChild; if (!fresh) continue;
        if (el) el.replaceWith(fresh);
        el = fresh; blocksSig.set(b.id, sig); changed = true;
      }
      applyThemeVars(el, theme);
      let container = null; let where = 'after';
      if (b.after) { const sec = hiddenElement('section:' + b.after); container = sec && !sec.closest('[data-cms-block]') ? safeContainer(sec) : null; }
      if (!container) {
        if (b.after) issues.push({ id: b.id, reason: 'No había un punto seguro después de esa sección; el bloque se colocó antes del pie de página.' });
        const end = endContainer(); if (end) { container = end; where = 'before'; } else { container = document.body; where = 'append'; }
      }
      if (!plans.has(container)) plans.set(container, { where, els: [] });
      plans.get(container).els.push(el); placed.push(b.id);
    }
    for (const [container, plan] of plans) {
      const els = plan.els;
      if (plan.where === 'before') { for (let i = els.length - 1; i >= 0; i--) { const next = i === els.length - 1 ? container : els[i + 1]; if (els[i].nextElementSibling !== next) { next.before(els[i]); changed = true; } } }
      else if (plan.where === 'after') { for (let i = 0; i < els.length; i++) { const prev = i === 0 ? container : els[i - 1]; if (els[i].previousElementSibling !== prev) { prev.after(els[i]); changed = true; } } }
      else {
        // Sin pie de página: al final del body. Solo se vuelve a colocar si ya no están juntos, en orden y al final
        // (con varios bloques, comparar con nextElementSibling los movía en cada pasada y entraba en un ciclo infinito).
        const inOrder = els.every((el, i) => el.parentElement === document.body && (i === els.length - 1 || el.nextElementSibling === els[i + 1]));
        const trailing = n => { for (; n; n = n.nextElementSibling) if (!n.matches('script,style,link,noscript,[data-cms-editor]')) return true; return false; };
        if (!inOrder || trailing(els[els.length - 1].nextElementSibling)) { for (const el of els) document.body.append(el); changed = true; }
      }
    }
    blockIssues = issues; blockPlaced = placed;
    if (changed) {
      mountBlockModules();
      for (const [id] of [...nodes]) { const el = textElement(nodes.get(id)); if (el && !el.isConnected && /-b-/.test(id)) nodes.delete(id); }
      scan(); needInventory = true;
      refreshScrollEngines();
    }
    return changed;
  }

  // ---------- Arrastrar y soltar bloques ----------
  // El editor (ventana padre) manda posiciones del puntero en px del documento; aquí se calcula el punto seguro más cercano,
  // se dibuja la línea «Soltar aquí» y, al soltar, se responde con { after, before } para colocar el bloque.
  const dnd = { on: false, x: 0, y: 0, inside: false, dragId: '', best: null, timer: 0, cache: null, endC: null };
  function dropCandidates(excludeId) {
    const out = []; const list = (rawPatch.blocks || []).filter(b => b.id !== excludeId);
    const elOf = id => document.querySelector(`[data-cms-block="${CSS.escape(id)}"]`);
    const visibleRect = el => { if (!el || !el.getClientRects().length) return null; const r = el.getBoundingClientRect(); return r; };
    const pushGroup = (after, baseY, baseRect) => {
      const group = list.filter(b => b.after === after).map(b => ({ b, el: elOf(b.id) })).filter(g => g.el);
      const rects = group.map(g => visibleRect(g.el));
      out.push({ after, before: group.length ? group[0].b.id : null, y: baseY, rect: baseRect });
      group.forEach((g, i) => { const r = rects[i]; if (!r) return; out.push({ after, before: i + 1 < group.length ? group[i + 1].b.id : null, y: r.bottom, rect: r }); });
    };
    // Los contenedores seguros no cambian mientras se arrastra: se calculan una vez al empezar y solo se relee su posición.
    if (!dnd.cache || dnd.cache.some(e => e.c && !e.c.isConnected)) {
      dnd.cache = (inventory?.insertPoints || []).map(point => {
        const sec = document.querySelector(`[data-cms-section="${CSS.escape(point.id)}"]`);
        return { id: point.id, c: sec && !sec.closest('[data-cms-block]') ? safeContainer(sec) : null };
      });
      dnd.endC = endContainer();
    }
    for (const e of dnd.cache) { const r = visibleRect(e.c); if (r) pushGroup(e.id, r.bottom, r); }
    const end = dnd.endC; const er = visibleRect(end);
    const endBlocks = list.filter(b => b.after === '').map(b => elOf(b.id)).filter(Boolean);
    if (er || endBlocks.length) {
      const first = endBlocks[0] && visibleRect(endBlocks[0]);
      pushGroup('', first ? first.top : (er ? er.top : innerHeight), first || er);
    }
    return out.sort((a, b) => a.y - b.y);
  }
  function dndBest() {
    if (!dnd.on || !dnd.inside) return null;
    let best = null; let dist = Infinity; let far = null; let farDist = Infinity;
    for (const c of dropCandidates(dnd.dragId)) {
      const d = Math.abs(c.y - dnd.y);
      if (c.y < -4 || c.y > innerHeight + 4) { if (d < farDist) { farDist = d; far = c; } continue; }
      if (d < dist) { dist = d; best = c; }
    }
    // Sin ningún punto a la vista (portadas muy altas): se ofrece el más cercano, marcado en el borde de la pantalla.
    return best || (far ? { ...far, offscreen: far.y < 0 ? 'up' : 'down' } : null);
  }
  function scrollPageBy(dy) {
    const vs = findVirtualScroller(); const lenis = window.ornatPageLenis || window.lenis;
    if (vs) { try { if (lenis && typeof lenis.scrollTo === 'function') { lenis.scrollTo(vs.scrollTop + dy, { immediate: true, force: true }); return; } } catch { /* sigue abajo */ } vs.scrollTop += dy; }
    else scrollBy(0, dy);
  }
  function dndPaint() {
    const best = dndBest(); dnd.best = best;
    if (!best) { ov.drop.style.display = 'none'; ov.dropt.style.display = 'none'; return; }
    const s = 1 / viewScale; const left = Math.max(0, best.rect?.left ?? 0); const width = Math.max(120, Math.min(innerWidth - left, best.rect?.width || innerWidth));
    const y = best.offscreen === 'up' ? 6 * s : best.offscreen === 'down' ? innerHeight - 8 * s : best.y;
    ov.drop.style.cssText = `display:block;left:${left}px;top:${y - 2 * s}px;width:${width}px`;
    ov.dropt.textContent = best.offscreen ? (best.offscreen === 'up' ? 'Soltar aquí (más arriba)' : 'Soltar aquí (más abajo)') : 'Soltar aquí'; ov.dropt.style.display = 'block';
    ov.dropt.style.left = (left + 12 * s) + 'px'; ov.dropt.style.top = Math.max(2 * s, Math.min(innerHeight - 26 * s, y - 30 * s)) + 'px';
  }
  function dndTick() {
    if (!dnd.on) return;
    if (dnd.inside) { const edge = 90; if (dnd.y < edge) scrollPageBy(-Math.ceil((edge - dnd.y) / 3)); else if (dnd.y > innerHeight - edge) scrollPageBy(Math.ceil((dnd.y - (innerHeight - edge)) / 3)); }
    dndPaint();
  }
  function dndStart(m) {
    dndStop();
    dnd.cache = null; dnd.on = true; dnd.dragId = typeof m.dragId === 'string' && /^[a-z0-9]{4,12}$/.test(m.dragId) ? m.dragId : ''; dnd.inside = false;
    document.documentElement.setAttribute('data-cms-dnd', '');
    if (dnd.dragId) document.querySelector(`[data-cms-block="${CSS.escape(dnd.dragId)}"]`)?.setAttribute('data-cms-dragging-block', '');
    if (!inventory?.insertPoints) scan();
    dnd.timer = setInterval(dndTick, 40);
  }
  function dndStop() {
    clearInterval(dnd.timer); dnd.on = false; dnd.best = null; dnd.cache = null;
    document.documentElement.removeAttribute('data-cms-dnd');
    document.querySelectorAll('[data-cms-dragging-block]').forEach(el => el.removeAttribute('data-cms-dragging-block'));
    ov.drop.style.display = 'none'; ov.dropt.style.display = 'none';
  }
  function dndMove(m) { dnd.x = Number(m.x) || 0; dnd.y = Number(m.y) || 0; dnd.inside = m.inside === true; dndPaint(); }
  function dndDrop(m) {
    if (m) dndMove(m);
    const best = dndBest(); dndStop();
    send('dnd-dropped', best ? { ok: true, after: best.after, before: best.before } : { ok: false });
  }

  // ---------- Comentarios: pines anclados ----------
  function anchorElement(id) {
    if (typeof id !== 'string') return null;
    if (id.startsWith('section:') || id.startsWith('item:')) return hiddenElement(id);
    const node = nodes.get(id); const el = node && textElement(node);
    return el?.isConnected ? el : null;
  }
  function positionPins() {
    if (!pinLayer) return;
    for (const pin of pinLayer.children) {
      const data = pins.find(p => p.id === pin.dataset.pin); const el = data && anchorElement(data.anchorId);
      if (!el || el.closest('[data-cms-hidden]') || !seenOnScreen(el)) { pin.style.display = 'none'; continue; }
      const r = el.getBoundingClientRect();
      if (r.width < 1 && r.height < 1) { pin.style.display = 'none'; continue; }
      const x = r.left + Math.max(0, Math.min(1, data.ox)) * r.width; const y = r.top + Math.max(0, Math.min(1, data.oy)) * r.height;
      pin.style.display = 'block'; pin.style.left = x + 'px'; pin.style.top = y + 'px';
    }
  }
  function setPins(list) {
    pins = Array.isArray(list) ? list.slice(0, 500) : [];
    if (!pinLayer) { pinLayer = document.createElement('div'); pinLayer.id = 'cms-pins'; pinLayer.setAttribute('data-cms-editor', 'true'); pinLayer.style.setProperty('--s', String(1 / viewScale)); document.documentElement.append(pinLayer); }
    pinLayer.replaceChildren(...pins.map(p => { const b = document.createElement('button'); b.type = 'button'; b.className = 'cpin' + (p.resolved ? ' resolved' : '') + (p.active ? ' active' : ''); b.dataset.pin = p.id; b.setAttribute('aria-label', `Comentario ${p.n}${p.resolved ? ' (resuelto)' : ''}`); const sp = document.createElement('span'); sp.textContent = String(p.n); b.append(sp); return b; }));
    positionPins(); requestFrame();
  }

  // ---------- Idiomas ----------
  const i18nOn = patch => !!patch.i18n?.enabled || Object.keys(patch.i18n?.en || {}).length > 0;
  function effectivePatch(patch) {
    if (lang !== 'en' || !patch.i18n?.en) return patch;
    const en = patch.i18n.en; const eff = { ...patch, texts: { ...(patch.texts || {}), ...en } };
    if (en['seo:title'] || en['seo:description']) eff.seo = { ...(patch.seo || {}), ...(en['seo:title'] ? { title: en['seo:title'] } : {}), ...(en['seo:description'] ? { description: en['seo:description'] } : {}) };
    return eff;
  }
  function renderLangSwitch(on) {
    let box = document.getElementById('ornat-lang');
    if (!PUB || !on) { box?.remove(); return; }
    if (!box) {
      box = document.createElement('div'); box.id = 'ornat-lang'; box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Idioma / Language');
      box.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483000;display:flex;gap:2px;padding:3px;background:#191c19;border-radius:999px;box-shadow:0 4px 18px rgba(0,0,0,.35);font:600 12px/1 Inter,system-ui,sans-serif';
      for (const code of ['es', 'en']) { const b = document.createElement('button'); b.type = 'button'; b.lang = code; b.textContent = code.toUpperCase(); b.setAttribute('aria-label', code === 'es' ? 'Español' : 'English'); b.style.cssText = 'border:0;border-radius:999px;padding:8px 12px;min-width:40px;min-height:34px;cursor:pointer;font:inherit'; b.addEventListener('click', () => { lang = code; try { localStorage.setItem('ornat-lang', code); } catch { /* optional */ } apply(rawPatch); }); box.append(b); }
      document.body.append(box);
    }
    for (const b of box.children) { const active = b.lang === lang; b.setAttribute('aria-pressed', String(active)); b.style.background = active ? '#98ff03' : 'transparent'; b.style.color = active ? '#17230e' : '#ffffff'; }
  }
  // Runtime del sitio exportado: conmutador ES/EN accesible, ?lang= y localStorage. Se serializa con toString(): debe ser autónomo.
  function i18nRuntime(cfg) {
    const KEY = 'ornat-lang';
    const pick = () => { try { const q = new URLSearchParams(location.search).get('lang'); if (q === 'es' || q === 'en') return q; const s = localStorage.getItem(KEY); if (s === 'es' || s === 'en') return s; } catch (e) { /* sin almacenamiento */ } return 'es'; };
    const writeLeaf = (item, value) => { const el = document.querySelector(item.path); if (!el) return; if (item.index === null) { if (!el.childElementCount) el.textContent = value; } else { const n = el.childNodes[item.index]; if (n && n.nodeType === 3) n.nodeValue = value; } };
    const writeBlock = (item, lang) => { const el = document.querySelector(item.path); if (!el) return; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; let i = 0; const first = item.pieces.findIndex(p => p.trim()); while ((n = w.nextNode())) { if (lang === 'es') n.nodeValue = item.pieces[i] !== undefined ? item.pieces[i] : n.nodeValue; else n.nodeValue = i === (first < 0 ? 0 : first) ? item.en : ''; i++; } };
    let lang = pick();
    const apply = () => {
      for (const item of cfg.items) { if (item.pieces) writeBlock(item, lang); else writeLeaf(item, lang === 'en' ? item.en : item.es); }
      const seo = cfg.seo[lang] || {};
      if (seo.title) document.title = seo.title;
      const meta = document.querySelector('meta[name="description"]'); if (meta && seo.description) meta.setAttribute('content', seo.description);
      document.documentElement.lang = lang;
      const box = document.getElementById('ornat-lang');
      if (box) for (const b of box.children) { const on = b.lang === lang; b.setAttribute('aria-pressed', String(on)); b.style.background = on ? '#98ff03' : 'transparent'; b.style.color = on ? '#17230e' : '#ffffff'; }
    };
    const build = () => {
      if (document.getElementById('ornat-lang')) return;
      const box = document.createElement('div'); box.id = 'ornat-lang'; box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Idioma / Language');
      box.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483000;display:flex;gap:2px;padding:3px;background:#191c19;border-radius:999px;box-shadow:0 4px 18px rgba(0,0,0,.35);font:600 12px/1 system-ui,sans-serif';
      ['es', 'en'].forEach(code => { const b = document.createElement('button'); b.type = 'button'; b.lang = code; b.textContent = code.toUpperCase(); b.setAttribute('aria-label', code === 'es' ? 'Español' : 'English'); b.style.cssText = 'border:0;border-radius:999px;padding:8px 12px;min-width:40px;min-height:34px;cursor:pointer;font:inherit'; b.addEventListener('click', () => { lang = code; try { localStorage.setItem(KEY, code); } catch (e) { /* sin almacenamiento */ } apply(); }); box.append(b); });
      document.body.append(box);
    };
    const run = () => { build(); apply(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true }); else run();
    window.addEventListener('load', () => { apply(); setTimeout(apply, 800); }, { once: true });
  }

  // ---------- Páginas del sitio (para SEO por página) ----------
  function discoverPages() {
    const base = new URL('.', location.href).pathname; const here = location.pathname.replace(/index\.html$/, '');
    const found = new Map(); externalPages = new Map();
    for (const a of document.querySelectorAll('a[href]')) {
      if (found.size >= 40) break;
      if (a.closest('[data-cms-editor],[data-cms-block]')) continue;
      let u; try { u = new URL(a.getAttribute('href'), location.href); } catch { continue; }
      if (u.origin !== location.origin && /^https?:$/.test(u.protocol) && !/\.(?:png|jpe?g|webp|avif|svg|gif|pdf|zip|mp4|webm|js|css|json|xml|txt|ico|woff2?)$/i.test(u.pathname) && u.pathname.length > 1 && externalPages.size < 60) { const key = u.origin + u.pathname.replace(/\/$/, ''); if (!externalPages.has(key)) externalPages.set(key, { href: u.origin + u.pathname, label: label(a) || u.pathname }); continue; }
      if (u.origin !== location.origin || !u.pathname.startsWith(base)) continue;
      if (/\.(?:png|jpe?g|webp|avif|svg|gif|pdf|zip|mp4|webm|js|css|json|xml|txt|ico)$/i.test(u.pathname)) continue;
      let path = u.pathname.replace(/index\.html$/, '');
      if (!/\.[a-z0-9]+$/i.test(path) && !path.endsWith('/')) path += '/';
      if (path === base || path === here || /\.html?$/i.test(path)) continue;
      if (base === '/' && /^\/(cms|control|cuenta|shared|backend|templates|propiedades)\//.test(path)) continue;
      if (!found.has(path)) found.set(path, label(a) || path);
    }
    return [...found].map(([path, text]) => ({ path, label: text }));
  }
  function apply(patch = {}, quiet = false) {
    if (!blocksApi && !blocksFailed && (patch.blocks?.length || document.querySelector('[data-cms-block]'))) { blocksReady.then(() => apply(patch, quiet)); return; }
    if (!structApi && !structFailed && (patch.layout || patch.items)) { structReady.then(() => apply(patch, quiet)); return; }
    if (!styleApi && !styleFailed && (patch.sectionStyles || patch.buttons || Object.keys(patch.texts || {}).some(k => k.startsWith('block-')))) { styleReady.then(() => apply(patch, quiet)); return; }
    rawPatch = patch; patch = effectivePatch(patch);
    flushTemplateMutations();
    if (structApi && (rawPatch.layout || rawPatch.items || structUsed || document.querySelector('[data-cms-sclone],[data-cms-iclone],[data-cms-removed]'))) {
      structUsed = true;
      let structChanged = false;
      try { structChanged = structApi.applyStructure(rawPatch); } catch (error) { send('notification', { level: 'error', message: 'No se pudo aplicar un cambio de estructura de la plantilla.' }); }
      if (structChanged) { if (selected && selected.closest('[data-cms-removed]')) deselect(true); refreshScrollEngines(); scan(); needInventory = true; }
    }
    const blocksChanged = applyBlocks(rawPatch.blocks || []);
    // The parent sends a complete project snapshot, including on undo/reset.
    for (const [node, text] of brandEdits) if (node.isConnected) writeText(node, text);
    for (const id of Object.keys(lastPatch.texts || {})) if (!id.startsWith('block-') && !(id in (patch.texts || {})) && !editing?.ids.includes(id)) writeText(nodes.get(id), originals.get(id)?.text || '');
    for (const key of Object.keys(lastPatch.colors || {})) if (!(key in (patch.colors || {}))) document.documentElement.style.removeProperty(key);
    for (const id of Object.keys(lastPatch.links || {})) if (!(id in (patch.links || {}))) { const el = nodes.get(id); const saved = originals.get(id)?.html.getAttribute('href'); if (el && saved !== null) el.setAttribute('href', saved); }
    for (const id of Object.keys(lastPatch.images || {})) if (!(id in (patch.images || {}))) {
      const el = nodes.get(id); const saved = originals.get(id)?.html;
      if (el && saved) { if (el.dataset.cmsLogoContent) restoreLogo(el, saved); else { ['src', 'srcset', 'sizes', 'alt', 'style'].forEach(key => { const value = saved.getAttribute(key); if (value === null) el.removeAttribute(key); else el.setAttribute(key, value); }); const picture = el.closest('picture'); if (picture) { picture.querySelectorAll('source').forEach(s => s.remove()); for (const source of originals.get(id).pictureSources) picture.insertBefore(source.cloneNode(true), el); } } }
    }
    for (const id of Object.keys(lastPatch.videos || {})) if (!(id in (patch.videos || {}))) {
      const el = nodes.get(id); const saved = originals.get(id);
      if (el?.tagName === 'VIDEO' && saved) { ['src','poster','style'].forEach(key => { const value = saved.html.getAttribute(key); if (value === null) el.removeAttribute(key); else el.setAttribute(key, value); }); el.querySelectorAll('source').forEach(source => source.remove()); for (const source of saved.videoSources) el.append(source.cloneNode(true)); el.load(); if (el.autoplay) el.play()?.catch(() => {}); }
    }
    for (const [id, value] of Object.entries(patch.videos || {})) {
      const el = nodes.get(id); const saved = originals.get(id); const previous = lastPatch.videos?.[id];
      if (el?.tagName !== 'VIDEO' || !saved || !previous || !value || typeof value !== 'object') continue;
      let reload = false;
      if ('src' in previous && !('src' in value)) { const src = saved.html.getAttribute('src'); if (src === null) el.removeAttribute('src'); else el.setAttribute('src', src); el.querySelectorAll('source').forEach(source => source.remove()); for (const source of saved.videoSources) el.append(source.cloneNode(true)); reload = true; }
      if ('poster' in previous && !('poster' in value)) { const poster = saved.html.getAttribute('poster'); if (poster === null) el.removeAttribute('poster'); else el.setAttribute('poster', poster); }
      if ('fit' in previous && !('fit' in value)) el.style.objectFit = saved.html.style.objectFit;
      if ('position' in previous && !('position' in value)) el.style.objectPosition = saved.html.style.objectPosition;
      if (reload) { el.load(); if (el.autoplay) el.play()?.catch(() => {}); }
    }
    if (lastPatch.brand?.logo && !patch.brand?.logo) for (const logo of inventory?.logos || []) { const el = nodes.get(logo.id); const saved = originals.get(logo.id)?.html; if (el && saved) { if (el.tagName === 'IMG') { ['src','srcset','sizes','alt','style'].forEach(key => { const value = saved.getAttribute(key); if (value === null) el.removeAttribute(key); else el.setAttribute(key, value); }); } else restoreLogo(el, saved); } }
    if (lastPatch.seo) { const restored = {}; for (const key of Object.keys(lastPatch.seo)) if (!(key in (patch.seo || {})) && key in initialSEO) restored[key] = initialSEO[key]; seoMetadata(restored); }
    if (lastPatch.typography && !patch.typography) document.querySelector('style[data-cms-typography]')?.remove();
    for (const [id, value] of Object.entries(patch.texts || {})) if (!id.startsWith('block-') && typeof value === 'string' && value.length <= 5000 && !editing?.ids.includes(id)) writeText(nodes.get(id), value);
    for (const [id, value] of Object.entries(patch.images || {})) { const el = nodes.get(id); if (el && value && typeof value === 'object') { if (inventory?.logos.some(logo => logo.id === id) || id.startsWith('icon-')) { const src = safeSource(value.src); if (src) replaceLogo(el, src); } else imagePatch(el, value); } }
    for (const [id, value] of Object.entries(patch.videos || {})) { const el = nodes.get(id); if (el?.tagName === 'VIDEO' && value && typeof value === 'object') videoPatch(el, value); }
    const knownColors = new Set((inventory?.colors || []).map(c => c.key));
    for (const [key, value] of Object.entries(patch.colors || {})) if (knownColors.has(key) && typeof value === 'string' && value.length < 100 && CSS.supports('color', value) && !/[;{}]/.test(value)) document.documentElement.style.setProperty(key, value);
    for (const [id, value] of Object.entries(patch.links || {})) { const el = nodes.get(id); const href = safeLink(value); if (el?.tagName === 'A' && href !== null) el.setAttribute('href', href); }
    if (patch.brand && typeof patch.brand === 'object') {
      if (typeof patch.brand.name === 'string' && patch.brand.name.length <= 80) {
        const rename = node => { if (!node) return; if (!brandEdits.has(node)) brandEdits.set(node, node.textContent); writeText(node, patch.brand.name); };
        document.querySelectorAll('[data-cms-brand-name],.brand-name,.logo-text,.nav-wordmark,.wordmark').forEach(el => { if (!el.childElementCount) rename(el); });
        // Preserve nested brand icons: only edit matching text leaves.
        for (const t of inventory?.texts || []) { const node = nodes.get(t.id); const el = textElement(node); if (el && el.closest('nav,header,footer') && /^(ORNAT(?: UX)?|AURELIA|ELYSE|BAMO)$/i.test(originals.get(t.id)?.text.trim() || '')) rename(node); }
      }
      const src = safeSource(patch.brand.logo);
      if (src) for (const logo of inventory?.logos || []) { const el = nodes.get(logo.id); if (el) replaceLogo(el, src); }
    }
    if (patch.seo && typeof patch.seo === 'object') {
      const values = {};
      if (typeof patch.seo.title === 'string') values.title = patch.seo.title.slice(0, 200);
      if (typeof patch.seo.description === 'string') values.description = patch.seo.description.slice(0, 1000);
      const favicon = safeSource(patch.seo.favicon); if (favicon && !/^data:image\/svg/i.test(favicon)) values.favicon = favicon;
      const ogImage = safeSource(patch.seo.ogImage); if (ogImage) values.ogImage = ogImage;
      const canonical = safeHTTP(patch.seo.canonical); if (canonical) values.canonical = canonical;
      seoMetadata(values);
    }
    if (patch.legal || lastPatch.legal) renderLegal(legalValues(patch.legal));
    if (patch.typography) {
      const fonts = ['Inter', 'Arial', 'Georgia', 'Times New Roman', 'system-ui'];
      let typography = document.querySelector('style[data-cms-typography]');
      if (!typography) { typography = document.createElement('style'); typography.dataset.cmsTypography = 'true'; document.head.append(typography); }
      const body = fonts.includes(patch.typography.body) ? patch.typography.body : null;
      const heading = fonts.includes(patch.typography.heading) ? patch.typography.heading : null;
      typography.textContent = (body ? `body,p,a,button,input,textarea,select{font-family:${JSON.stringify(body)},sans-serif!important}` : '') + (heading ? `h1,h2,h3,h4,h5,h6{font-family:${JSON.stringify(heading)},serif!important}` : '');
    }
    const seq = patch.sequences?.['canvas-frames'];
    if ((seq || lastPatch.sequences) && inventory?.sequences.some(s => s.id === 'canvas-frames' && s.editable)) {
      const next = Array.isArray(seq?.frames) ? seq.frames.slice(0, 600).map(safeSource).filter(Boolean) : [];
      if (next.length !== sequenceSources.length || next.some((src, i) => src !== sequenceSources[i])) { sequenceSources = next; installSequenceRuntime(sequenceSources, 300, true); }
    }
    if (Array.isArray(window.ornatCmsTextures?.slots) && typeof window.ornatCmsTextures.apply === 'function') {
      textureValues = {};
      for (const slot of window.ornatCmsTextures.slots) { const src = safeSource(patch.images?.[slot.id]?.src); if (src) textureValues[slot.id] = src; }
      window.ornatCmsTextures.apply(textureValues);
    }
    applyBlockTexts(patch.texts || {});
    applyStyles(patch.styles && typeof patch.styles === 'object' ? patch.styles : {});
    applyHidden(patch.hidden && typeof patch.hidden === 'object' ? patch.hidden : {}, quiet);
    if (styleApi) { try { if (styleApi.applyAll(patch, lastPatch)) refreshScrollEngines(); } catch { /* estilos opcionales */ } }
    lastPatch = patch;
    document.documentElement.lang = lang; renderLangSwitch(i18nOn(rawPatch));
    dynObserver.takeRecords(); dynLast = new WeakMap();
    if (needInventory) { needInventory = false; send('inventory', { inventory }); }
    send('applied', { placed: blockPlaced, issues: blockIssues, blocksChanged });
    if (selected) send('info', describe());
  }
  let exportMap = null;
  function domPath(el) {
    if (exportMap) {
      let c = exportMap.get(el); const bodyC = exportMap.get(document.body); const parts = [];
      if (!c || !bodyC || !bodyC.contains(c)) return null;
      while (c && c !== bodyC) { const p = c.parentElement; if (!p) return null; parts.unshift(`${c.localName}:nth-child(${[...p.children].indexOf(c) + 1})`); c = p; }
      return 'body' + (parts.length ? ' > ' + parts.join(' > ') : '');
    }
    if (!el?.isConnected || !document.body.contains(el)) return null;
    const parts = [];
    while (el && el !== document.body) {
      parts.unshift(`${el.localName}:nth-child(${[...el.parentElement.children].indexOf(el) + 1})`);
      el = el.parentElement;
    }
    return 'body' + (parts.length ? ' > ' + parts.join(' > ') : '');
  }
  function selectById(id, scroll) {
    if (typeof id !== 'string') return;
    let hit = null;
    if (id.startsWith('section:')) { const el = hiddenElement(id); if (el) hit = { id, el, kind: 'section' }; }
    else if (id.startsWith('item:')) { const el = hiddenElement(id); if (el) hit = { id, el, kind: 'item' }; }
    else {
      const el = textElement(nodes.get(id));
      if (el?.isConnected) hit = promote({ id: fragmentParents.has(el) ? fragmentParents.get(el)[0] : id, el, kind: kindOf(id, el) });
    }
    if (!hit) return;
    if (hit.el.hasAttribute('data-cms-hidden') || hit.el.closest('[data-cms-hidden]')) { send('notification', { level: 'info', message: 'Ese elemento está oculto. Muéstralo con el ojo del panel para verlo en el lienzo.' }); return; }
    select(hit, { scroll });
  }
  function gotoSection(id) {
    const el = hiddenElement('section:' + id); if (!el) return;
    el.scrollIntoView({ behavior: scrollMode(), block: 'start' });
  }
  // Reapply explicit edits after a template's framework mounts. This is independent of the editor.
  function materializeExport(data) {
    function apply() {
      for (const item of data.texts) {
        const el = document.querySelector(item.path); if (!el) continue;
        if (item.index === null) { if (!el.childElementCount) el.textContent = item.value; }
        else { const node = el.childNodes[item.index]; if (node?.nodeType === 3) node.nodeValue = item.value; }
      }
      for (const item of data.media) {
        const el = document.querySelector(item.path); if (!el) continue;
        if (item.kind === 'logo') {
          if (el.localName === 'svg') {
            const image = document.createElementNS('http://www.w3.org/2000/svg', 'image'); const box = el.viewBox?.baseVal;
            image.setAttribute('href', item.src); image.setAttribute('x', box?.x || 0); image.setAttribute('y', box?.y || 0); image.setAttribute('width', box?.width || el.getBoundingClientRect().width || 64); image.setAttribute('height', box?.height || el.getBoundingClientRect().height || 64); image.setAttribute('preserveAspectRatio', 'xMidYMid meet'); el.replaceChildren(image);
          } else if (el.localName === 'img') { el.src = item.src; el.removeAttribute('srcset'); el.style.objectFit = 'contain'; }
          else { let image = el.querySelector('img'); if (!image) { image = document.createElement('img'); image.alt = 'Logo'; el.replaceChildren(image); } image.src = item.src; image.style.cssText = item.logoStyle; }
        } else if (el.localName === 'img') {
          el.src = item.src; el.alt = item.alt; el.removeAttribute('srcset'); el.removeAttribute('sizes'); el.closest('picture')?.querySelectorAll('source').forEach(source => source.remove()); el.style.objectFit = item.fit; el.style.objectPosition = item.position;
        } else { el.style.backgroundImage = `url(${JSON.stringify(item.src)})`; el.style.backgroundSize = item.fit === 'fill' ? '100% 100%' : item.fit; el.style.backgroundPosition = item.position; }
      }
      for (const item of data.videos || []) {
        const el = document.querySelector(item.path); if (!el || el.tagName !== 'VIDEO') continue;
        let reload = false;
        if (item.src && el.getAttribute('src') !== item.src) { el.querySelectorAll('source').forEach(source => source.remove()); el.src = item.src; reload = true; }
        if (item.poster) el.poster = item.poster; else el.removeAttribute('poster');
        el.style.objectFit = item.fit; el.style.objectPosition = item.position;
        if (reload) { el.load(); if (el.autoplay) el.play()?.catch(() => {}); }
      }
      for (const item of data.blocks || []) { const el = document.querySelector(item.path); if (!el) continue; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; let first = true; while ((n = w.nextNode())) { if (!n.nodeValue.trim() && !first) continue; if (!n.nodeValue.trim()) continue; n.nodeValue = first ? item.text : ''; first = false; } }
      for (const item of data.styles || []) { const el = document.querySelector(item.path); if (el) for (const [key, value] of Object.entries(item.props)) el.style.setProperty(key, value, 'important'); }
      for (const item of data.hidden || []) document.querySelector(item.path)?.setAttribute('data-cms-hidden', '');
      for (const [key, value] of Object.entries(data.colors)) document.documentElement.style.setProperty(key, value);
      for (const item of data.links) document.querySelector(item.path)?.setAttribute('href', item.href);
      if (data.seo) { document.title = data.seo.title; const meta = document.querySelector('meta[name="description"]'); if (meta) meta.content = data.seo.description; }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true }); else apply();
    if (document.readyState === 'complete') setTimeout(apply, 800); else window.addEventListener('load', () => { apply(); setTimeout(apply, 800); }, { once: true });
  }
  // El HTML exportado siempre parte del español; si el editor estaba en inglés se vuelve a aplicar al terminar.
  function exportHTML() {
    const prevLang = lang;
    if (lang !== 'es') { lang = 'es'; apply(rawPatch, true); }
    try { buildExport(); } finally { exportMap = null; if (prevLang !== lang) { lang = prevLang; apply(rawPatch, true); } }
  }
  function buildExport() {
    const clone = document.documentElement.cloneNode(true);
    // GSAP will initialize again in the exported page; do not persist its current scroll position.
    const liveElements = [...document.documentElement.querySelectorAll('*')];
    const copyElements = [...clone.querySelectorAll('*')];
    liveElements.forEach((el, i) => { if (el._gsap && copyElements[i]) ['transform', 'translate', 'rotate', 'scale', 'opacity', 'visibility', 'will-change'].forEach(key => copyElements[i].style.removeProperty(key)); });
    // Lo que quitaste se elimina del HTML (no solo se oculta). Las rutas de los cambios se calculan sobre esta copia ya limpia.
    exportMap = new Map(); liveElements.forEach((el, i) => exportMap.set(el, copyElements[i])); exportMap.set(document.documentElement, clone);
    clone.querySelectorAll('[data-cms-removed]').forEach(el => el.remove());
    clone.querySelectorAll('[data-cms-editor],script[src*="/cms/bridge.js"],#ornat-lang').forEach(el => el.remove());
    clone.querySelectorAll('ornat-catalog').forEach(c => c.replaceChildren());
    clone.querySelectorAll('input[name="ornat_website"]').forEach(x => (x.closest('div[aria-hidden="true"]') || x).remove());
    clone.querySelectorAll('[data-cms-block],[data-cms-block-type]').forEach(el => { el.removeAttribute('data-cms-block'); el.removeAttribute('data-cms-block-type'); });
    clone.querySelectorAll('[data-cms-id],[data-cms-section],[data-cms-selected],[data-cms-editing],[data-cms-list],[data-cms-item],[data-cms-sclone],[data-cms-iclone],[data-cms-oi]').forEach(el => { for (const name of ['data-cms-id', 'data-cms-section', 'data-cms-selected', 'data-cms-editing', 'data-cms-list', 'data-cms-item', 'data-cms-sclone', 'data-cms-iclone', 'data-cms-oi']) el.removeAttribute(name); });
    ['data-cms-selecting', 'data-cms-grab', 'data-cms-dragging'].forEach(name => clone.removeAttribute(name));
    let base = clone.querySelector('base');
    if (!base) { base = document.createElement('base'); clone.querySelector('head').prepend(base); }
    base.href = new URL('.', location.href).href;
    if (sequenceSources.length) {
      const runtime = document.createElement('script');
      // JSON escapes '<' so uploaded data never creates a closing script tag.
      const payload = JSON.stringify(sequenceSources).replace(/</g, '\\u003c');
      runtime.textContent = `(${installSequenceRuntime.toString()})(${payload},300,false);`;
      clone.querySelector('head').append(runtime);
    }
    if (clone.querySelector('.ornat-blk') && blocksApi?.blockRuntime) {
      const rt = document.createElement('script');
      rt.textContent = `(()=>{const run=${blocksApi.blockRuntime.toString()};const go=()=>run(true);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',go,{once:true});else go()})();`;
      clone.querySelector('body').append(rt);
    }
    if (Object.keys(textureValues).length) {
      const runtime = document.createElement('script');
      const payload = JSON.stringify(textureValues).replace(/</g, '\\u003c');
      runtime.textContent = `(()=>{const values=${payload};const apply=()=>{if(window.ornatCmsTextures&&typeof window.ornatCmsTextures.apply==='function')window.ornatCmsTextures.apply(values)};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();window.addEventListener('load',apply,{once:true})})();`;
      clone.querySelector('body').append(runtime);
    }
    const changes = { texts: [], media: [], videos: [], colors: {}, links: [], seo: lastPatch.seo ? { title: document.title, description: document.querySelector('meta[name="description"]')?.content || '' } : null };
    const textNodes = new Set(Object.keys(lastPatch.texts || {}).map(id => nodes.get(id)).filter(Boolean));
    if (lastPatch.brand?.name) for (const node of brandEdits.keys()) textNodes.add(node);
    for (const node of textNodes) { const el = textElement(node); const path = domPath(el); if (path && (node.nodeType === Node.TEXT_NODE || !el.childElementCount)) changes.texts.push({ path, index: node.nodeType === Node.TEXT_NODE ? [...el.childNodes].indexOf(node) : null, value: node.textContent }); }
    changes.styles = []; changes.hidden = []; changes.blocks = [];
    for (const [id, value] of Object.entries(lastPatch.texts || {})) { if (!id.startsWith('block-') || typeof value !== 'string') continue; const root = nodes.get(id); if (root && styleApi?.split.isRebuilt(root)) continue; const path = domPath(root); if (path) changes.blocks.push({ path, text: value }); }
    for (const [id, props] of Object.entries(lastPatch.styles || {})) {
      const node = nodes.get(id); const el = node && textElement(node); const path = domPath(el); if (!path) continue;
      const out = {};
      for (const [prop, value] of Object.entries(props || {})) { const css = CSS_PROPS[prop]; const safe = safeStyleValue(prop, value); if (css && safe !== null) out[css] = prop === 'fontFamily' ? FONT_STACKS[value] : safe; }
      if (Object.keys(out).length) changes.styles.push({ path, props: out });
    }
    for (const id of Object.keys(lastPatch.hidden || {})) { const path = domPath(hiddenElement(id)); if (path) changes.hidden.push({ path }); }
    if (changes.hidden.length) { const rule = document.createElement('style'); rule.textContent = '[data-cms-hidden]{display:none!important}'; clone.querySelector('head').append(rule); }
    const imageValues = { ...lastPatch.images };
    if (lastPatch.brand?.logo) for (const logo of inventory?.logos || []) imageValues[logo.id] = { src: lastPatch.brand.logo };
    for (const [id, value] of Object.entries(imageValues)) {
      const el = nodes.get(id); const path = domPath(el); const src = safeSource(value?.src); if (!path || !src) continue;
      let kind = inventory?.logos.some(logo => logo.id === id) ? 'logo' : inventory?.images.find(image => image.id === id)?.kind || 'image'; if (kind === 'icon') kind = 'logo';
      changes.media.push({ path, kind, src, alt: typeof value.alt === 'string' ? value.alt : el.alt || '', fit: ['cover','contain','fill'].includes(value.fit) ? value.fit : 'cover', position: el.style.objectPosition || el.style.backgroundPosition || '50% 50%', logoStyle: el.querySelector('img')?.getAttribute('style') || `width:${el.getBoundingClientRect().width || 120}px;height:${el.getBoundingClientRect().height || 40}px;object-fit:contain;display:inline-block;max-width:100%` });
    }
    for (const key of Object.keys(lastPatch.colors || {})) { const value = document.documentElement.style.getPropertyValue(key); if (value) changes.colors[key] = value; }
    for (const [id, value] of Object.entries(lastPatch.videos || {})) { const el = nodes.get(id); const path = domPath(el); if (path && el.tagName === 'VIDEO') changes.videos.push({ path, src: safeVideo(value.src) || '', poster: el.poster || '', fit: el.style.objectFit || 'cover', position: el.style.objectPosition || '50% 50%' }); }
    for (const id of Object.keys(lastPatch.links || {})) { const el = nodes.get(id); const path = domPath(el); if (path) changes.links.push({ path, href: el.getAttribute('href') }); }
    if (changes.texts.length || changes.media.length || changes.videos.length || changes.styles.length || changes.hidden.length || changes.blocks.length || changes.links.length || Object.keys(changes.colors).length || changes.seo) {
      const runtime = document.createElement('script');
      const payload = JSON.stringify(changes).replace(/</g, '\\u003c');
      runtime.textContent = `(${materializeExport.toString()})(${payload});`;
      clone.querySelector('body').append(runtime);
    }
    if (i18nOn(rawPatch)) {
      const en = rawPatch.i18n?.en || {}; const items = [];
      const seo = { es: { title: document.title, description: document.querySelector('meta[name="description"]')?.content || '' }, en: {} };
      for (const [id, value] of Object.entries(en)) {
        if (id === 'seo:title') { seo.en.title = value; continue; }
        if (id === 'seo:description') { seo.en.description = value; continue; }
        if (typeof value !== 'string' || !value.trim()) continue;
        const node = nodes.get(id); if (!node) continue;
        if (id.startsWith('block-')) {
          const path = domPath(node); if (!path) continue;
          const pieces = []; const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) pieces.push(n.nodeValue);
          items.push({ path, pieces, en: value });
        } else {
          const el = textElement(node); const path = domPath(el); if (!path || (node.nodeType !== Node.TEXT_NODE && el.childElementCount)) continue;
          items.push({ path, index: node.nodeType === Node.TEXT_NODE ? [...el.childNodes].indexOf(node) : null, es: node.textContent, en: value });
        }
      }
      seo.en = { title: seo.en.title || seo.es.title, description: seo.en.description || seo.es.description };
      const rt = document.createElement('script');
      rt.textContent = `(${i18nRuntime.toString()})(${JSON.stringify({ items, seo }).replace(/</g, '\\u003c')});`;
      clone.querySelector('body').append(rt);
      clone.setAttribute('lang', 'es');
      const canonical = document.querySelector('link[rel="canonical"]')?.href || '';
      if (/^https?:\/\//i.test(canonical)) {
        try {
          const u = new URL(canonical); const enUrl = new URL(u.href); enUrl.searchParams.set('lang', 'en');
          for (const [code, href] of [['es', u.href], ['en', enUrl.href], ['x-default', u.href]]) { const l = document.createElement('link'); l.rel = 'alternate'; l.hreflang = code; l.href = href; clone.querySelector('head').append(l); }
        } catch { /* canónica inválida */ }
      }
    }
    for (const [selector, src] of [['ornat-catalog', '/shared/catalog.js'], ['[data-ornat-form]', '/shared/forms.js']]) {
      if (!clone.querySelector(selector)) continue;
      const m = document.createElement('script'); m.type = 'module'; m.src = src; clone.querySelector('body').append(m);
    }
    if (lastPatch.seo || lastPatch.legal) {
      const runtime = document.createElement('script');
      const legal = JSON.stringify(legalValues(lastPatch.legal)).replace(/</g, '\\u003c');
      const metadata = JSON.stringify({ title: document.title, description: document.querySelector('meta[name="description"]')?.content ?? null, favicon: document.querySelector('link[rel~="icon"]')?.getAttribute('href') ?? null, ogImage: document.querySelector('meta[property="og:image"]')?.content ?? null, canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null }).replace(/</g, '\\u003c');
      clone.querySelector('#ornat-legal')?.remove();
      runtime.textContent = `(()=>{const apply=()=>{(${seoMetadata.toString()})(${metadata});(${renderLegal.toString()})(${legal})};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();window.addEventListener('load',()=>{apply();setTimeout(apply,800)},{once:true})})();`;
      clone.querySelector('body').append(runtime);
    }
    send('export', { html: '<!doctype html>\n' + clone.outerHTML, warnings: ['El HTML exportado necesita conexión a internet para cargar los recursos originales de la plantilla.'] });
  }
  function applyValidated(patch) {
    const reject = message => send('notification', { level: 'error', message });
    coreReady.then(core => {
      if (!core?.validatePatch) { reject('No se pudo comprobar el cambio, así que no se aplicó.'); return; }
      try { core.validatePatch(patch && typeof patch === 'object' ? patch : {}); } catch (error) { reject(`Se rechazó el cambio: ${error.message}`); return; }
      try { apply(patch); } catch { reject('No se pudo aplicar ese cambio. Revisa el archivo o el valor e inténtalo de nuevo.'); }
    });
  }
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== parent || event.data?.channel !== CHANNEL) return;
    const m = event.data;
    try {
      if (m.type === 'apply') applyValidated(m.patch);
      else if (m.type === 'request-inventory') send('inventory', { inventory: scan() });
      else if (m.type === 'lang') { lang = m.lang === 'en' ? 'en' : 'es'; apply(rawPatch); }
      else if (m.type === 'pins') setPins(m.pins);
      else if (m.type === 'mode') { commenting = m.commenting === true; document.documentElement.toggleAttribute('data-cms-commenting', commenting); selecting = m.selecting === true; document.documentElement.toggleAttribute('data-cms-selecting', selecting); if (!selecting) { deselect(true); mouse = null; document.documentElement.removeAttribute('data-cms-grab'); } requestFrame(); }
      else if (m.type === 'analytics-mode') analyticsEnabled = m.enabled === true;
      else if (m.type === 'select' || m.type === 'navigate') selectById(m.id, m.type === 'navigate');
      else if (m.type === 'view') { viewScale = Math.max(.1, Math.min(4, Number(m.scale) || 1)); overlay.style.setProperty('--s', String(1 / viewScale)); pinLayer?.style.setProperty('--s', String(1 / viewScale)); lastRectKey = ''; requestFrame(); }
      else if (m.type === 'edit-selected') startEdit();
      else if (m.type === 'commit-edit') { commitEdit(); send('edit-committed', { requestId: m.requestId }); }
      else if (m.type === 'deselect') deselect();
      else if (m.type === 'step') step(m.dir > 0 ? 1 : -1);
      else if (m.type === 'goto-section') gotoSection(String(m.id));
      else if (m.type === 'dnd-start') dndStart(m);
      else if (m.type === 'dnd-move') dndMove(m);
      else if (m.type === 'dnd-drop') dndDrop(m);
      else if (m.type === 'dnd-end') dndStop();
      else if (m.type === 'export') { commitEdit(); exportHTML(); }
    } catch (error) { send('notification', { level: 'error', message: 'No se pudo aplicar ese cambio. Revisa el archivo o el valor e inténtalo de nuevo.' }); }
  });
  document.addEventListener('mousemove', e => { mouse = { x: e.clientX, y: e.clientY }; if (selecting) requestFrame(); }, { capture: true, passive: true });
  document.documentElement.addEventListener('mouseleave', () => { mouse = null; requestFrame(); });
  addEventListener('scroll', requestFrame, { passive: true });
  addEventListener('resize', requestFrame);
  document.addEventListener('pointerdown', e => {
    if (!selecting || e.button !== 0) return;
    if (editing) { if (editing.el.contains(e.target)) e.stopPropagation(); return; }
    const hit = pick(e.clientX, e.clientY);
    if (!hit || !['image', 'background'].includes(hit.kind)) return;
    if (hit.el !== selected) select(hit);
    if (startDrag(e)) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  document.addEventListener('mousedown', e => { if (editing && editing.el.contains(e.target)) e.stopPropagation(); }, true);
  document.addEventListener('pointermove', moveDrag, true);
  document.addEventListener('pointerup', endDrag, true);
  document.addEventListener('pointercancel', endDrag, true);
  document.addEventListener('dblclick', e => {
    if (!selecting) return;
    e.stopImmediatePropagation();
    if (editing) return;
    const hit = pick(e.clientX, e.clientY);
    if (hit && isTextKind(hit.kind) && isTextId(hit.id)) { if (hit.el !== selected) select(hit); startEdit({ caret: 'click' }); }
  }, true);
  document.addEventListener('keydown', e => {
    if (!selecting) return;
    const k = e.key; const mod = e.ctrlKey || e.metaKey;
    if (editing) {
      e.stopPropagation();
      if (e.isComposing) return;
      if (k === 'Escape') { e.preventDefault(); cancelEdit(); }
      else if (k === 'Enter') { if (e.shiftKey && editing.multiline) return; e.preventDefault(); if (e.shiftKey) showNote('Este elemento es de una sola línea.'); else commitEdit(); }
      else if (k === 'Tab') { e.preventDefault(); commitEdit(); }
      else if (k === ' ' && editing.el.closest('button,summary')) { e.preventDefault(); document.execCommand('insertText', false, ' '); }
      else if (mod && k.toLowerCase() === 's') { e.preventDefault(); commitEdit(); send('key', { key: 'save' }); }
      return;
    }
    if (e.target instanceof Element && e.target.closest('input,textarea,select,[contenteditable="true"]')) return;
    if (mod && k.toLowerCase() === 'z') { e.preventDefault(); send('key', { key: e.shiftKey ? 'redo' : 'undo' }); }
    else if (mod && k.toLowerCase() === 'y') { e.preventDefault(); send('key', { key: 'redo' }); }
    else if (mod && k.toLowerCase() === 's') { e.preventDefault(); send('key', { key: 'save' }); }
    else if (!mod && (k === 'Delete' || k === 'Backspace') && selected) { e.preventDefault(); send('key', { key: 'hide' }); }
    else if (k === 'Escape' && selected) { e.preventDefault(); deselect(); }
    else if (k === 'Enter' && selected && isTextKind(selectedKind) && isTextId(selectedId)) { e.preventDefault(); startEdit(); }
    else if ((k === 'ArrowDown' || k === 'ArrowUp') && selected && !mod && !e.altKey) { e.preventDefault(); step(k === 'ArrowDown' ? 1 : -1); }
  }, true);
  document.addEventListener('click', event => {
    const el = event.target instanceof Element ? event.target : event.target.parentElement;
    if (!el) return;
    if (PUB) return;
    const pin = el.closest('.cpin');
    if (pin) { event.preventDefault(); event.stopImmediatePropagation(); send('comment-open', { id: pin.dataset.pin }); return; }
    if (commenting) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.detail === 0) return;
      let hit = pick(event.clientX, event.clientY) || sectionHit(el);
      if (hit?.id.startsWith('block-')) { const piece = textIdsIn(hit.el)[0]; const pe = piece && textElement(nodes.get(piece)); if (pe?.isConnected) hit = { id: piece, el: pe, kind: hit.kind }; }
      if (!hit) return;
      const r = hit.el.getBoundingClientRect();
      send('comment-click', { anchor: { id: hit.id, ox: r.width ? (event.clientX - r.left) / r.width : .5, oy: r.height ? (event.clientY - r.top) / r.height : .5, label: (label(hit.el) || KIND_LABEL[hit.kind] || 'Elemento').slice(0, 80) } });
      return;
    }
    if (selecting) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (suppressClick) { suppressClick = false; return; }
      if (editing && editing.el.contains(el)) return;
      const hit = (event.shiftKey ? sectionHit(el) : (event.detail > 0 && pick(event.clientX, event.clientY)) || resolve(el) || sectionHit(el));
      if (hit) select(hit); else deselect();
    } else {
      if (analyticsEnabled) {
        const width = Math.max(1, innerWidth); const height = Math.max(1, innerHeight);
        send('analytics-event', { event: { eventType: 'click', page: location.pathname, template: /\/templates\/([^/]+)/.exec(location.pathname)?.[1] || 'preview', x: Math.max(0, Math.min(1, event.clientX / width)), y: Math.max(0, Math.min(1, event.clientY / height)), viewportWidth: width, viewportHeight: height, timestamp: new Date().toISOString() } });
      }
      const anchor = el.closest('a[href]');
      if (anchor && !anchor.getAttribute('href').startsWith('#')) { event.preventDefault(); event.stopImmediatePropagation(); send('notification', { level: 'info', message: 'Los enlaces de salida están desactivados en esta demostración. Puedes cambiar su destino desde el editor.' }); }
    }
  }, true);
  document.addEventListener('submit', event => { if (PUB || (!selecting && !commenting && event.target.closest?.('[data-ornat-form]'))) return; event.preventDefault(); event.stopImmediatePropagation(); send('notification', { level: 'info', message: 'Formulario de demostración: no se enviaron datos. Conecta tu servicio de formularios al publicar tu proyecto.' }); }, true);
  const initialSEO = { title: document.title, description: document.querySelector('meta[name="description"]')?.getAttribute('content') ?? null, favicon: document.querySelector('link[rel~="icon"]')?.getAttribute('href') ?? null, ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? null, canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null };
  function ready() { pageReady = true; const inv = scan(); lastSignature = inventorySignature(inv); send('ready', { inventory: inv }); watchDom(); }
  // Templates that build their DOM with JS after load (split text, lazy sections): pick up new content shortly after it appears.
  function watchDom() {
    const schedule = () => {
      if (rescanTimer) return;
      rescanTimer = setTimeout(() => {
        rescanTimer = 0;
        if (editing || drag) { schedule(); return; }
        const inv = scan(); const signature = inventorySignature(inv);
        if (signature !== lastSignature) { lastSignature = signature; send('inventory', { inventory: inv }); }
        if (Object.keys(rawPatch).length) apply(rawPatch, true);
      }, Math.max(900, 2500 - (Date.now() - lastScanAt)));
    };
    new MutationObserver(records => {
      if (editing) return;
      for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1 && !n.closest('[data-cms-editor]') && n.id !== 'ornat-legal' && n.id !== 'ornat-legal-style') { schedule(); return; }
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true }); else ready();
  const settle = () => { if (settled) return; settled = true; send('inventory', { inventory: scan() }); if (rawPatch.layout || rawPatch.items) { try { apply(rawPatch, true); } catch { /* sin estructura */ } } };
  // La estructura (copias, quitados, orden) se aplica cuando la plantilla terminó de construir su DOM: así los ids de lo que crea tarde
  // se asignan en el orden original y son los mismos al volver a abrir el proyecto.
  let loadedAt = 0; let lastAdd = Date.now();
  new MutationObserver(records => { for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1 && !n.closest?.('[data-cms-editor]') && !(n.hasAttribute?.('data-cms-sclone') || n.hasAttribute?.('data-cms-iclone'))) { lastAdd = Date.now(); return; } }).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', () => { loadedAt = Date.now(); }, { once: true });
  const quiet = setInterval(() => { if (settled) { clearInterval(quiet); return; } if (loadedAt && Date.now() - loadedAt > 600 && Date.now() - lastAdd > 1200) { clearInterval(quiet); settle(); } }, 300);
  setTimeout(settle, 12000);
})();
