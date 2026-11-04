/* Shared WebGL stage for the project pages: renderer with clamped pixel ratio, optional EffectComposer (bloom, depth of field),
   environment lighting, resize handling, render-on-demand, visibility gating, static fallback and GPU cleanup.
   ES module; three.js resolves through the import map in index.html (pinned release). */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export { THREE };
export const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/** Create a stage on a canvas. opts: {fov, near, far, bloom:{strength,radius,threshold}|null, dof:{aperture,maxblur}|null, env:bool, alpha:bool, maxDpr} */
export function createStage(canvas, opts = {}) {
  const S = window.SITE || { reduced: false, phone: matchMedia('(max-width:640px)').matches, isDark: () => true, onFrame: cb => requestAnimationFrame(function l(t) { cb(t / 1000, 16); requestAnimationFrame(l) }) };
  const holder = canvas.parentElement;
  const stage = { canvas, holder, dirty: true, visible: true, disposed: false, S };
  (window.__stages = window.__stages || []).push(stage);
  let renderer;
  const fallback = () => { holder.classList.add('no-webgl'); const fb = holder.querySelector('.fallback'); if (fb && fb.dataset.src) fb.src = fb.dataset.src; stage.failed = true; return stage; };
  // probe first so a machine without WebGL gets the static image without a console error from the renderer
  try { const probe = document.createElement('canvas'); if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return fallback(); } catch (e) { return fallback(); }
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !opts.bloom, alpha: !!opts.alpha, powerPreference: 'high-performance' });
  } catch (e) { return fallback(); }
  const maxDpr = opts.maxDpr || (S.phone ? 1.5 : 2);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, maxDpr));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = opts.exposure || 1.0;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(opts.fov || 40, 2, opts.near || 0.05, opts.far || 500);
  if (opts.env !== false) { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = opts.envIntensity ?? 0.35; }
  // post-processing: size the renderer first, then build the composer, resize only through composer.setSize
  let composer = null, bloom = null, bokeh = null;
  const w0 = holder.clientWidth || 2, h0 = holder.clientHeight || 2; renderer.setSize(w0, h0, false); camera.aspect = w0 / h0; camera.updateProjectionMatrix();
  if (opts.bloom || opts.dof) {
    // multisampled HDR target so the post chain keeps anti-aliasing (WebGL2); EffectComposer sizes it from the renderer's pixel ratio
    const rt = new THREE.WebGLRenderTarget(w0, h0, { type: THREE.HalfFloatType, samples: S.phone ? 2 : 4 });
    composer = new EffectComposer(renderer, rt); composer.addPass(new RenderPass(scene, camera));
    if (opts.bloom) { bloom = new UnrealBloomPass(new THREE.Vector2(w0, h0), opts.bloom.strength ?? .4, opts.bloom.radius ?? .5, opts.bloom.threshold ?? .8); composer.addPass(bloom); }
    if (opts.dof && !S.phone) { bokeh = new BokehPass(scene, camera, { focus: opts.dof.focus ?? 10, aperture: opts.dof.aperture ?? .0008, maxblur: opts.dof.maxblur ?? .006 }); composer.addPass(bokeh); }
    composer.addPass(new OutputPass());
  }
  Object.assign(stage, { renderer, scene, camera, composer, bloom, bokeh });
  const setBg = () => { if (opts.alpha) return; scene.background = new THREE.Color(cssVar('--bg') || (S.isDark() ? '#0b1220' : '#f6f8fb')); stage.dirty = true; };
  setBg(); document.addEventListener('themechange', () => { setBg(); stage.onTheme && stage.onTheme(S.isDark()); });
  // resize
  const fit = () => { const w = holder.clientWidth, h = holder.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); if (composer) composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); stage.dirty = true; stage.wide = w > 820; };
  fit(); new ResizeObserver(fit).observe(holder);
  // only render while on screen
  new IntersectionObserver(es => es.forEach(e => { stage.visible = e.isIntersecting; if (e.isIntersecting) stage.dirty = true; }), { threshold: 0 }).observe(holder);
  stage.render = () => { if (composer) composer.render(); else renderer.render(scene, camera); stage.dirty = false; };
  // frame loop: the page's update callback returns true when something changed
  stage.loop = update => { S.onFrame((t, dt) => { if (stage.disposed || !stage.visible) return; const changed = update(t, dt); if (changed || stage.dirty) stage.render(); }); };
  stage.dispose = () => { if (stage.disposed) return; stage.disposed = true; scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { [].concat(o.material).forEach(m => { for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose(); m.dispose(); }); } }); if (scene.environment) scene.environment.dispose(); if (composer) { composer.passes.forEach(p => p.dispose && p.dispose()); composer.dispose && composer.dispose(); } renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); };
  addEventListener('pagehide', stage.dispose, { once: true });
  return stage;
}

/** A camera that travels a CatmullRom path and looks at a lerped target as t goes 0..1. */
export function cameraPath(points, targets) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal');
  const tg = targets.map(p => new THREE.Vector3(...p));
  const tmp = new THREE.Vector3();
  return { curve, at(t, outPos, outTarget) { curve.getPointAt(Math.min(1, Math.max(0, t)), outPos); const u = Math.min(1, Math.max(0, t)) * (tg.length - 1), i = Math.min(tg.length - 2, Math.floor(u)); outTarget.copy(tg[i]).lerp(tg[i + 1], u - i); return outPos; } };
}
