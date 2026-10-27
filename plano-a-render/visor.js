// ORNAT · Plano a render — visor 3D interactivo (rasterizado) y exportaciones (.glb, PNG isométricos).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { construirModelo, camaraIsometrica, cajaDe, capas } from './escena.js';
import { cargarHDRI } from './render-local.js';

export class Visor {
  constructor(canvas, { onError = () => {} } = {}) {
    this.canvas = canvas; this.onError = onError;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.escena = new THREE.Scene(); this.escena.background = new THREE.Color('#ece7dd');
    this.persp = new THREE.PerspectiveCamera(42, 1, 0.1, 500); this.persp.position.set(18, 16, 22);
    this.orto = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 500);
    this.camara = this.persp; this.controles = new OrbitControls(this.persp, canvas); this.controles.enableDamping = true;
    this.sol = new THREE.DirectionalLight('#fff3e2', 2.4); this.sol.castShadow = true; this.sol.shadow.mapSize.set(2048, 2048); this.sol.shadow.bias = -0.0004; this.sol.shadow.normalBias = 0.02; this.sol.shadow.radius = 3;
    this.escena.add(this.sol, this.sol.target, new THREE.HemisphereLight('#fffaf0', '#b9b2a6', 0.35));
    this.info = null; this.modo = '3d'; this.plantaId = null; this.estado = { mobiliario: true, lamina: false };
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    cargarHDRI().then(t => { if (this.destruido) return; this.env = this.pmrem.fromEquirectangular(t).texture; this.escena.environment = this.env; this.escena.environmentIntensity = 0.75; this.pedir(); }).catch(e => this.onError(e));
    this.ro = new ResizeObserver(() => this.ajustar()); this.ro.observe(canvas);
    this.controles.addEventListener('change', () => this.pedir());
    this.bucle = () => { this.raf = 0; if (this.controles.update()) this.pedir(); this.renderer.render(this.escena, this.camara); };
    this.ajustar();
  }
  pedir() { if (!this.raf && !this.destruido) this.raf = requestAnimationFrame(this.bucle); }
  ajustar() { const w = this.canvas.clientWidth || 640, h = this.canvas.clientHeight || 400; this.renderer.setSize(w, h, false); this.persp.aspect = w / h; this.persp.updateProjectionMatrix(); if (this.modo !== '3d') this.encuadrar(); this.pedir(); }

  /** Reconstruye el modelo (cambio de geometría o de estilo). */
  cargar(proyecto, opciones) {
    if (this.info) { this.escena.remove(this.info.grupo); this.info.grupo.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); }
    this.info = construirModelo(proyecto, { ...opciones, mobiliario: true });
    this.escena.add(this.info.grupo); this.aplicarVista(); return this.info;
  }
  set(modo, plantaId = this.plantaId) { this.modo = modo; this.plantaId = plantaId; this.aplicarVista(); }
  capas(estado) { Object.assign(this.estado, estado); this.aplicarVista(); }
  aplicarVista() {
    if (!this.info) return;
    const { plantas, grupo } = this.info; const sel = plantas.find(p => p.id === this.plantaId) || plantas[0];
    const unaSola = this.modo !== '3d';
    for (const p of plantas) p.grupo.visible = unaSola ? p === sel : true;
    capas(grupo, { techos: false, mobiliario: this.modo === 'comparar' ? false : this.estado.mobiliario, lamina: this.modo === 'comparar' });
    // en "comparar" los pisos se ocultan para ver la lámina debajo de los muros
    grupo.traverse(o => { if (o.name === 'Pisos') o.visible = this.modo !== 'comparar'; });
    const b = cajaDe(unaSola ? sel.grupo : grupo); const c = b.getCenter(new THREE.Vector3()); const r = Math.max(4, b.getSize(new THREE.Vector3()).length() / 2);
    this.sol.position.copy(c).add(new THREE.Vector3(-0.55, 0.75, 0.4).multiplyScalar(r * 2.2)); this.sol.target.position.copy(c);
    Object.assign(this.sol.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 0.5, far: r * 6 }); this.sol.shadow.camera.updateProjectionMatrix();
    if (this.modo === '3d') {
      this.camara = this.persp; this.controles.object = this.persp; this.controles.enableRotate = true;
      if (!this._encuadrado3d) { this.persp.position.copy(c).add(new THREE.Vector3(0.9, 0.85, 1.05).normalize().multiplyScalar(r * 2.3)); this._encuadrado3d = true; }
      this.controles.target.copy(c);
    } else this.encuadrar(sel);
    this.controles.update(); this.pedir();
  }
  encuadrar(sel) {
    if (!this.info) return; const p = sel || this.info.plantas.find(x => x.id === this.plantaId) || this.info.plantas[0];
    const w = this.canvas.clientWidth || 640, h = this.canvas.clientHeight || 400;
    const cam = this.modo === 'comparar' ? camaraPlanta(cajaDe(p.grupo), w / h) : camaraIsometrica(cajaDe(p.grupo), w / h);
    this.orto.copy(cam); this.orto.updateProjectionMatrix(); this.camara = this.orto; this.controles.object = this.orto; this.controles.target.copy(cam.userData.objetivo);
    this.controles.enableRotate = this.modo !== 'comparar';
  }
  /** Captura PNG de la vista actual o de un isométrico de una planta a la resolución pedida. */
  async capturaIsometrico(plantaId, ancho = 1800, alto = 1200) {
    const prevModo = this.modo, prevPl = this.plantaId; this.set('iso', plantaId);
    const p = this.info.plantas.find(x => x.id === plantaId) || this.info.plantas[0];
    const cam = camaraIsometrica(cajaDe(p.grupo), ancho / alto, 1.06);
    const rt = document.createElement('canvas'); rt.width = ancho; rt.height = alto;
    const r2 = new THREE.WebGLRenderer({ canvas: rt, antialias: true, preserveDrawingBuffer: true }); r2.setPixelRatio(1); r2.setSize(ancho, alto, false);
    r2.toneMapping = THREE.ACESFilmicToneMapping; r2.outputColorSpace = THREE.SRGBColorSpace; r2.shadowMap.enabled = true; r2.shadowMap.type = THREE.PCFShadowMap;
    const pm = new THREE.PMREMGenerator(r2); const env = pm.fromEquirectangular(await cargarHDRI()); const prevEnv = this.escena.environment; this.escena.environment = env.texture;
    r2.render(this.escena, cam);
    const blob = await new Promise(res => rt.toBlob(res, 'image/png'));
    this.escena.environment = prevEnv; env.dispose(); pm.dispose(); r2.dispose(); r2.forceContextLoss();
    this.set(prevModo, prevPl); return blob;
  }
  /** Exporta el modelo (sin la lámina ni los plafones) a .glb binario. */
  async exportarGLB() {
    const grupo = this.info.grupo; const vis = []; grupo.traverse(o => vis.push([o, o.visible]));
    for (const p of this.info.plantas) p.grupo.visible = true;
    capas(grupo, { techos: false, mobiliario: true, lamina: false }); grupo.traverse(o => { if (o.name === 'Pisos') o.visible = true; });
    try {
      const out = await new GLTFExporter().parseAsync(grupo, { binary: true, onlyVisible: true, maxTextureSize: 1024 });
      return new Blob([out], { type: 'model/gltf-binary' });
    } finally { for (const [o, v] of vis) o.visible = v; this.pedir(); }
  }
  destruir() {
    this.destruido = true; this.ro.disconnect(); cancelAnimationFrame(this.raf); this.controles.dispose();
    if (this.info) this.info.grupo.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
    this.env?.dispose(); this.pmrem.dispose(); this.renderer.dispose(); this.renderer.forceContextLoss(); // libera el contexto WebGL (el navegador limita cuántos hay vivos)
  }
}

/** Cámara cenital ortográfica (para comparar con el plano). */
function camaraPlanta(caja3, aspecto) {
  const c = caja3.getCenter(new THREE.Vector3()); const s = caja3.getSize(new THREE.Vector3());
  let w = s.x * 1.12, h = s.z * 1.12; if (w / h > aspecto) h = w / aspecto; else w = h * aspecto;
  const cam = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 400); cam.position.set(c.x, c.y + 60, c.z + 0.001); cam.up.set(0, 0, -1); cam.lookAt(c); cam.updateProjectionMatrix(); cam.userData.objetivo = c; return cam;
}
