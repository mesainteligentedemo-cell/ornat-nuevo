// ORNAT · Plano a render — render fotorrealista LOCAL (en el navegador, sin API).
// Camino principal: path tracing con three-gpu-pathtracer (WebGL2 + float color buffers), entorno HDRI CC0 de Poly Haven
// vendorizado, luz solar, materiales PBR del estilo y profundidad de campo opcional.
// Respaldo: rasterizado de alta calidad (PMREM + sombras PCF suavizadas + GTAO + ACES) cuando el navegador no soporta path tracing.
import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { construirModelo, camaraInterior, camaraIsometrica, cajaDe, capas, kelvin } from './escena.js';

export const HDRI = new URL('./hdri/qwantani_afternoon_puresky_1k.hdr', import.meta.url).href;
export const CALIDADES = { borrador: { muestras: 32, etiqueta: 'Borrador · 32 muestras' }, alta: { muestras: 128, etiqueta: 'Alta · 128 muestras' }, maxima: { muestras: 512, etiqueta: 'Máxima · 512 muestras' } };
export const RESOLUCIONES = { hd: [1280, 720, 'HD · 1280 × 720'], fhd: [1920, 1080, 'Full HD · 1920 × 1080'], qhd: [2560, 1440, '2K · 2560 × 1440'], cuadrado: [1600, 1600, 'Cuadrado · 1600 × 1600'] };

let hdrPromesa = null;
export function cargarHDRI() { return (hdrPromesa ||= new HDRLoader().loadAsync(HDRI).then(t => { t.mapping = THREE.EquirectangularReflectionMapping; return t; })); }

/** ¿Este navegador puede hacer path tracing? (WebGL2 + render a float). Se consulta una vez: crear un contexto WebGL2 cuesta. */
let soporteCache = null;
export function soportePathTracing() { return { ...(soporteCache ||= probarPathTracing()) }; }
function probarPathTracing() {
  try {
    const c = document.createElement('canvas'); const gl = c.getContext('webgl2');
    if (!gl) return { ok: false, motivo: 'Tu navegador no tiene WebGL2.' };
    if (!gl.getExtension('EXT_color_buffer_float')) return { ok: false, motivo: 'Tu tarjeta gráfica no permite render en punto flotante (EXT_color_buffer_float).' };
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { ok: true };
  } catch { return { ok: false, motivo: 'No se pudo iniciar WebGL2.' }; }
}

let ptModulo = null;
const dentroDe = (pts, x, y) => { let d = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d; } return d; };
const RENDERERS = new WeakMap();
const cargarPathTracer = () => (ptModulo ||= import('three-gpu-pathtracer'));
/** Suelta el renderer (y su contexto WebGL) asociado a un canvas de render que sale del DOM. */
export function liberarRender(canvas) { const r = RENDERERS.get(canvas); if (!r) return; RENDERERS.delete(canvas); r.dispose(); r.forceContextLoss(); }

/** Arma la escena de render (modelo, sol, entorno) y la cámara para la vista pedida. */
export async function prepararEscena({ proyecto, estiloPorId, porDefecto, vista, aspecto, dof = false }) {
  const interior = vista.tipo === 'interior';
  const info = construirModelo(proyecto, { estiloPorId, porDefecto, techos: interior, mobiliario: true });
  const escena = new THREE.Scene(); escena.add(info.grupo);
  const hdr = await cargarHDRI();
  escena.environment = hdr; escena.environmentIntensity = interior ? 1.0 : 0.85;
  escena.environmentRotation = new THREE.Euler(0, 1.1, 0); escena.backgroundRotation = new THREE.Euler(0, 1.1, 0);
  let camara, objetivo, estiloVista;
  if (interior) {
    const esp = info.espacios.find(e => e.id === vista.espacioId) || info.espacios.find(e => !e.exterior) || info.espacios[0];
    if (!esp) throw new Error('El proyecto no tiene espacios para renderizar.');
    // solo la planta del espacio y las de abajo (las de arriba no se ven y cuestan muestras)
    const pl = info.plantas.find(p => p.id === esp.plantaId); for (const p of info.plantas) p.grupo.visible = p.y0 <= pl.y0;
    info.grupo.updateMatrixWorld(true); const muebles = []; info.grupo.traverse(o => { if (o.userData?.espacio === esp.id && o.userData?.tipo === 'mobiliario') for (const ch of o.children) { const bb = new THREE.Box3().setFromObject(ch); if (!bb.isEmpty()) muebles.push(bb); } });
    // las hojas de puerta abatibles también estorban a la cámara
    for (const d of esp.puertas.filter(x => x.tipo === 'puerta')) { const r = d.ancho / 2 + 0.15, cx = d.x + d.nx * d.ancho / 2, cz = d.z + d.nz * d.ancho / 2; muebles.push(new THREE.Box3(new THREE.Vector3(cx - r, esp.y0, cz - r), new THREE.Vector3(cx + r, esp.y0 + 2.1, cz + r))); }
    camara = camaraInterior(esp, aspecto, muebles); objetivo = camara.userData.objetivo; escena.background = hdr; escena.backgroundIntensity = 1;
    estiloVista = estiloPorId(proyecto.espacioEstilo?.(esp.id)) || null; info.espacioRender = esp;
  } else {
    const pl = info.plantas.find(p => p.id === vista.plantaId) || info.plantas[0];
    for (const p of info.plantas) p.grupo.visible = vista.plantaId ? p.id === pl.id : true;
    capas(info.grupo, { techos: false });
    camara = camaraIsometrica(cajaDe(vista.plantaId ? pl.grupo : info.grupo), aspecto, 1.08); objetivo = camara.userData.objetivo;
    escena.background = new THREE.Color('#ece7dd');
  }
  // sol (dirección de tarde) — el path tracer lo muestrea con MIS
  const sol = new THREE.DirectionalLight(kelvin(5200), 2.6); sol.position.set(-18, 26, 14); sol.target.position.set(0, 0, 0); escena.add(sol, sol.target);
  sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048); sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.02; sol.shadow.radius = 3;
  const b = cajaDe(info.grupo); const c = b.getCenter(new THREE.Vector3()); const r = b.getSize(new THREE.Vector3()).length() / 2 + 2;
  let dirSol = new THREE.Vector3(-0.55, 0.72, 0.42);
  if (interior) {
    // el sol entra por el vano acristalado más grande del espacio, a 35° de altura y algo oblicuo: manchas de luz en el piso
    const esp = info.espacioRender; const vid = [...esp.ventanas, ...esp.puertas.filter(p => p.tipo === 'corrediza')].sort((a, b2) => b2.ancho - a.ancho)[0];
    if (vid) { const fuera = new THREE.Vector3(-vid.nx, 0, -vid.nz).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.55); dirSol = fuera.multiplyScalar(Math.cos(0.62)).setY(Math.sin(0.62)); }
  }
  sol.position.copy(c).add(dirSol.normalize().multiplyScalar(r * 2)); sol.target.position.copy(c);
  Object.assign(sol.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 0.5, far: r * 5 }); sol.shadow.camera.updateProjectionMatrix();
  if (interior) {
    // luces "portal" en las ventanas y corredizas de la planta: el path tracer las muestrea directo y el interior converge mucho más rápido
    const esp = info.espacioRender; const pl = info.plantas.find(p => p.id === esp.plantaId);
    const vanos = info.espacios.filter(e => e.plantaId === esp.plantaId).flatMap(e => [...e.ventanas, ...e.puertas.filter(p => p.tipo === 'corrediza')]);
    const vistos = new Set();
    for (const v of vanos) {
      const k = `${v.x.toFixed(2)},${v.z.toFixed(2)}`; if (vistos.has(k) || vistos.size >= 10) continue; vistos.add(k);
      const [cx2, cz2] = [v.x, v.z]; const dentro = info.espacios.find(e => e.plantaId === esp.plantaId && !e.exterior && Math.abs((cx2 + v.nx * 0.5)) >= 0 && dentroDe(e.poligono, cx2 + v.nx * 0.5, cz2 + v.nz * 0.5));
      const s2 = dentro ? 1 : -1; const nx = v.nx * s2, nz = v.nz * s2;
      const luz = new THREE.RectAreaLight(new THREE.Color('#e6eeff'), 2.2, v.ancho * 0.96, v.alto * 0.96);
      const off = v.t / 2 + 0.06; luz.position.set(v.x + nx * off, pl.y0 + v.base + v.alto / 2, v.z + nz * off); luz.lookAt(v.x + nx * 5, pl.y0 + v.base + v.alto / 2 - 0.6, v.z + nz * 5);
      escena.add(luz);
    }
  }
  escena.updateMatrixWorld(true);
  if (dof && interior && objetivo) camara.userData.enfoque = camara.position.distanceTo(objetivo);
  return { escena, camara, info, interior, estiloVista };
}

/**
 * Renderiza en `canvas`. Devuelve una promesa con { modo, muestras, ms, motivo } y expone stop() vía `control`.
 * opciones: { proyecto, estiloPorId, porDefecto, exposicion, vista, ancho, alto, muestras, dof, forzarRaster, onProgreso(m, total, modo), control: { detener:false } }
 */
export async function renderizar(canvas, opciones) {
  const { ancho, alto, muestras = 200, exposicion = 1, forzarRaster = false, onProgreso = () => {}, control = {} } = opciones;
  const t0 = performance.now();
  canvas.width = ancho; canvas.height = alto;
  const soporte = forzarRaster ? { ok: false, motivo: 'Elegiste el modo rasterizado.' } : soportePathTracing();
  let renderer = RENDERERS.get(canvas);
  if (!renderer) { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }); RENDERERS.set(canvas, renderer); }
  renderer.setPixelRatio(1); renderer.setSize(ancho, alto, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const prep = await prepararEscena({ ...opciones, aspecto: ancho / alto });
  const expo = (pt) => { renderer.toneMappingExposure = exposicion * (prep.interior ? (pt ? 1.5 : 0.85) : 1.0); }; expo(soporte.ok);
  const liberar = () => { prep.escena.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); renderer.renderLists.dispose(); };
  try {
    if (soporte.ok) {
      try { return { ...(await pathTrace(renderer, prep, muestras, onProgreso, control, opciones.dof, opciones.denoise !== false)), ms: performance.now() - t0 }; }
      catch (e) { console.warn('[plano-a-render] path tracing no disponible, se usa rasterizado:', e?.message || e); soporte.ok = false; soporte.motivo = 'El trazado de rayos falló en este equipo; se usó el rasterizado de alta calidad.'; }
    }
    expo(false); raster(renderer, prep, ancho, alto, onProgreso);
    return { modo: 'raster', muestras: 1, ms: performance.now() - t0, motivo: soporte.motivo };
  } finally { setTimeout(liberar, 0); }
}

async function pathTrace(renderer, { escena, camara, interior }, total, onProgreso, control, dof, denoise) {
  const { WebGLPathTracer, PhysicalCamera } = await cargarPathTracer();
  let cam = camara;
  if (interior) {
    const pc = new PhysicalCamera(camara.fov, camara.aspect, camara.near, camara.far); pc.position.copy(camara.position); pc.quaternion.copy(camara.quaternion);
    if (dof && camara.userData.enfoque) { pc.focusDistance = camara.userData.enfoque * 0.55; pc.fStop = 2.2; pc.apertureBlades = 6; } else { pc.fStop = 64; pc.focusDistance = 10; }
    pc.updateProjectionMatrix(); cam = pc;
  }
  const pt = new WebGLPathTracer(renderer);
  pt.tiles.set(2, 2); pt.minSamples = 1; pt.renderDelay = 0; pt.fadeDuration = 0; pt.dynamicLowRes = false; pt.rasterizeScene = true;
  pt.bounces = interior ? 5 : 3; pt.transmissiveBounces = 2; pt.filterGlossyFactor = 0.6; pt.multipleImportanceSampling = true;
  pt.textureSize.set(1024, 1024);
  // Generador PCG (RANDOM_TYPE 0) en lugar de la lista estratificada (2): en ANGLE/D3D11 la estratificada repite las mismas
  // muestras por píxel y la imagen nunca converge (patrón de laberinto). PCG converge en todos los equipos probados.
  { const m = pt._pathTracer?.material; if (m?.defines) { m.defines.RANDOM_TYPE = 0; m.needsUpdate = true; } }
  onProgreso(0, total, 'preparando'); await frame();
  // BVH síncrono: el worker de three-mesh-bvh tendría que servirse desde este mismo dominio
  pt.setScene(escena, cam);
  const err = renderer.getContext().getError(); if (err && err !== renderer.getContext().CONTEXT_LOST_WEBGL) { /* algunos drivers reportan errores benignos */ }
  // hasta compilar los shaders el path tracer dibuja el rasterizado
  let espera = 0; while (pt.isCompiling && espera < 600) { pt.renderSample(); await frame(); espera++; if (control.detener) break; }
  let ultimo = -1; const inicio = performance.now();
  while (pt.samples < total && !control.detener) {
    pt.renderSample();
    const s = Math.floor(pt.samples);
    if (s !== ultimo) { ultimo = s; const seg = s > 0 ? ((performance.now() - inicio) / 1000 / s) * (total - s) : null; onProgreso(Math.min(s, total), total, 'pathtracing', seg); }
    await frame();
    if (performance.now() - inicio > 15 * 60_000) break; // tope de seguridad
  }
  // vuelve a dibujar el último acumulado sin sumar muestras para que el canvas quede con la imagen final
  pt.pausePathTracing = true; pt.renderSample();
  if (denoise) { // reducción de ruido bilateral sobre la imagen acumulada (ver materialDenoise)
    const n0 = Math.max(1, Math.floor(pt.samples)); const q = new FullScreenQuad(materialDenoise(pt.target.texture, 3.4, 1.6, Math.min(0.2, Math.max(0.06, 0.11 * Math.sqrt(64 / n0))))); renderer.setRenderTarget(null); renderer.autoClear = true; q.render(renderer); q.material.dispose(); q.dispose();
  }
  const n = Math.floor(pt.samples); pt.dispose?.();
  return { modo: 'pathtracing', muestras: n, detenido: !!control.detener };
}
const frame = () => new Promise(r => requestAnimationFrame(() => r()));

// Filtro bilateral "smart denoise" (algoritmo de glslSmartDeNoise, M. Morrone, BSD-2) adaptado: ignora el alfa del acumulador
// del path tracer (el DenoiseMaterial de la librería premultiplica por ese alfa y deja patrones) y compara colores en un espacio
// HDR comprimido para no borrar bordes brillantes. Aplica tono ACES y sRGB del renderer.
function materialDenoise(map, sigma = 3.4, kSigma = 1.6, threshold = 0.11) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, sigma: { value: sigma }, kSigma: { value: kSigma }, threshold: { value: threshold } },
    depthTest: false, depthWrite: false, toneMapped: true,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D map; uniform float sigma; uniform float kSigma; uniform float threshold; varying vec2 vUv;
      vec3 cmp(vec3 c){ return c / (1.0 + c); }
      void main(){
        float radius = floor(kSigma * sigma + 0.5); float radQ = radius * radius; float invS = 0.5 / (sigma * sigma); float invT = 0.5 / (threshold * threshold);
        vec2 size = vec2(textureSize(map, 0)); vec3 c = texture2D(map, vUv).rgb; vec3 cc = cmp(c); vec3 acc = vec3(0.0); float z = 0.0;
        for (float x = -radius; x <= radius; x += 1.0) { float pt = sqrt(radQ - x * x);
          for (float y = -pt; y <= pt; y += 1.0) { vec2 d = vec2(x, y); vec3 w = texture2D(map, vUv + d / size).rgb; vec3 dc = cmp(w) - cc;
            float f = exp(-dot(d, d) * invS) * exp(-dot(dc, dc) * invT); z += f; acc += f * w; } }
        gl_FragColor = vec4(acc / max(z, 1e-6), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

function raster(renderer, { escena, camara }, ancho, alto, onProgreso) {
  onProgreso(0, 1, 'raster');
  const pmrem = new THREE.PMREMGenerator(renderer); const envRT = pmrem.fromEquirectangular(escena.environment); escena.environment = envRT.texture;
  if (escena.background?.isTexture) escena.background = envRT.texture;
  escena.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } if (o.isMesh && o.material?.transmission > 0) { o.material = o.material.clone(); o.material.transmission = 0; o.material.transparent = true; o.material.opacity = 0.25; } });
  const comp = new EffectComposer(renderer); comp.setPixelRatio(1); comp.setSize(ancho, alto);
  comp.addPass(new RenderPass(escena, camara));
  const ao = new GTAOPass(escena, camara, ancho, alto); ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.4, thickness: 1.2, scale: 1.2, samples: 16 }); ao.blendIntensity = 0.85; comp.addPass(ao);
  comp.addPass(new OutputPass());
  comp.render(); comp.render();
  pmrem.dispose(); envRT.dispose?.();
  onProgreso(1, 1, 'raster');
}
