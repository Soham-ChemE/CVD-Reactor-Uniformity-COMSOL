/* Shared WebGL stage for the project pages: renderer with clamped pixel ratio, optional EffectComposer (bloom, depth of field),
   environment lighting, resize handling, render-on-demand, visibility gating, static fallback and GPU cleanup.
   Theme-aware since round 3: tone-mapping exposure, bloom strength and threshold, environment intensity, stage colour and
   the data palette are all chosen per theme, so the light page no longer glares (bloom in light mode is restricted to
   emissive HDR pixels: threshold 1.0 on the half-float target, strength scaled down).
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

/* Data palette per theme. Dark: bright colours on a near-black stage. Light: the same hues darkened so that every data
   colour keeps at least 3:1 contrast against the pale stage (#e3e9f1); checked with the WCAG relative-luminance formula. */
export const PALETTES = {
  dark: { ink: '#e6edf3', muted: '#8b98a9', line: '#2a3649', stage: '#0f172a', card: '#111a2b', hot: '#f97316', warm: '#f59e0b', cool: '#5b7fb5', cyan: '#22d3ee', violet: '#a78bfa', green: '#34d399', rose: '#fb7185', blue: '#60a5fa', yellow: '#fde68a', steel: '#9aa4b1', acrylic: '#cfe3ff', grey: '#64748b', white: '#f8fafc' },
  light: { ink: '#0b1220', muted: '#5b6676', line: '#b9c4d3', stage: '#e3e9f1', card: '#ffffff', hot: '#dc5a0a', warm: '#c26a04', cool: '#2f5590', cyan: '#0e7490', violet: '#6d28d9', green: '#047857', rose: '#be123c', blue: '#1d4ed8', yellow: '#a16207', steel: '#6b7684', acrylic: '#7fa3d6', grey: '#64748b', white: '#1e293b' }
};
export const palette = dark => PALETTES[dark ? 'dark' : 'light'];
/* Per-theme rendering constants. Light mode: lower exposure, bloom only on HDR emissive pixels, dimmer environment. */
export const THEME = {
  dark: { exposure: 1.0, bloomScale: 1.0, bloomThreshold: null, env: 1.0, lights: 1.0 },
  light: { exposure: 0.82, bloomScale: 0.18, bloomThreshold: 1.0, env: 0.55, lights: 0.8 }
};

/* Shared environment map: one PMREM per renderer, reused by every scene drawn with it. */
export function roomEnvironment(renderer) {
  if (renderer.__env) return renderer.__env;
  const pm = new THREE.PMREMGenerator(renderer); renderer.__env = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); return renderer.__env;
}

/** Create a stage on a canvas. opts: {fov, near, far, bloom:{strength,radius,threshold}|null, dof:{aperture,maxblur}|null, env:bool, alpha:bool, maxDpr, exposure, envIntensity, stage:{dark,light}} */
export function createStage(canvas, opts = {}) {
  const S = window.SITE || { reduced: false, phone: matchMedia('(max-width:640px)').matches, isDark: () => true, onFrame: cb => requestAnimationFrame(function l(t) { cb(t / 1000, 16); requestAnimationFrame(l) }) };
  const holder = canvas.parentElement;
  const stage = { canvas, holder, dirty: true, visible: true, disposed: false, S, pal: palette(S.isDark()), dark: S.isDark(), bloomScale: 1 };
  (window.__stages = window.__stages || []).push(stage);
  let renderer;
  const fallback = () => { holder.classList.add('no-webgl'); const fb = holder.querySelector('.fallback'); if (fb && fb.dataset.src) fb.src = fb.dataset.src; stage.failed = true; return stage; };
  // probe first so a machine without WebGL gets the static image without a console error from the renderer
  try { const probe = document.createElement('canvas'); if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return fallback(); } catch (e) { return fallback(); }
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !opts.bloom, alpha: !!opts.alpha, powerPreference: 'high-performance' });
  } catch (e) { return fallback(); }
  // software renderer (SwiftShader, llvmpipe): no environment map (the PMREM pre-filter alone costs seconds in software), no
  // post-processing, a low pixel ratio; the page's reduced path then draws this stage once at its final keyframe
  if (S.softGL) { opts = { ...opts, bloom: null, dof: null, env: false, maxDpr: .75 }; }
  const maxDpr = opts.maxDpr || (S.phone ? 1.5 : 2);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, maxDpr));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(opts.fov || 40, 2, opts.near || 0.05, opts.far || 500);
  const baseEnv = opts.envIntensity ?? 0.35;
  if (opts.env !== false) { scene.environment = roomEnvironment(renderer); }
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
  const baseBloom = opts.bloom ? (opts.bloom.strength ?? .4) : 0, baseThreshold = opts.bloom ? (opts.bloom.threshold ?? .8) : .8;
  /* theme: exposure, bloom, environment, stage colour and palette. Scenes read stage.pal and may hook stage.onTheme(dark). */
  const applyTheme = () => {
    const dark = S.isDark(), T = THEME[dark ? 'dark' : 'light']; stage.dark = dark; stage.pal = palette(dark); stage.lights = T.lights;
    renderer.toneMappingExposure = (opts.exposure || 1.0) * T.exposure;
    stage.bloomScale = T.bloomScale; if (bloom) { bloom.strength = baseBloom * T.bloomScale; bloom.threshold = T.bloomThreshold ?? baseThreshold; }
    if (scene.environment) scene.environmentIntensity = baseEnv * T.env;
    if (!opts.alpha) { const c = opts.stage ? (dark ? opts.stage.dark : opts.stage.light) : stage.pal.stage; scene.background = new THREE.Color(c); }
    stage.dirty = true;
  };
  stage.setBloom = s => { if (bloom) bloom.strength = s * stage.bloomScale; };
  applyTheme(); document.addEventListener('themechange', () => { applyTheme(); stage.onTheme && stage.onTheme(S.isDark()); });
  // resize
  const fit = () => { const w = holder.clientWidth, h = holder.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); if (composer) composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); stage.dirty = true; stage.wide = w > 820; };
  fit(); new ResizeObserver(fit).observe(holder);
  // only render while on screen
  new IntersectionObserver(es => es.forEach(e => { stage.visible = e.isIntersecting; if (e.isIntersecting) stage.dirty = true; }), { threshold: 0 }).observe(holder);
  stage.render = () => { if (composer) composer.render(); else renderer.render(scene, camera); stage.dirty = false; };
  // frame loop: the page's update callback returns true when something changed
  stage.loop = update => { S.onFrame((t, dt) => { if (stage.disposed || !stage.visible) return; const changed = update(t, dt); if (changed || stage.dirty) stage.render(); }); };
  stage.dispose = () => { if (stage.disposed) return; stage.disposed = true; scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { [].concat(o.material).forEach(m => { for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose(); m.dispose(); }); } }); if (renderer.__env) { renderer.__env.dispose(); renderer.__env = null; } if (composer) { composer.passes.forEach(p => p.dispose && p.dispose()); composer.dispose && composer.dispose(); } renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); };
  addEventListener('pagehide', stage.dispose, { once: true });
  return stage;
}

/** A camera that travels a CatmullRom path and looks at a lerped target as t goes 0..1. */
export function cameraPath(points, targets) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal');
  const tg = targets.map(p => new THREE.Vector3(...p));
  return { curve, at(t, outPos, outTarget) { curve.getPointAt(Math.min(1, Math.max(0, t)), outPos); const u = Math.min(1, Math.max(0, t)) * (tg.length - 1), i = Math.min(tg.length - 2, Math.floor(u)); outTarget.copy(tg[i]).lerp(tg[i + 1], u - i); return outPos; } };
}

/** Text as a sprite (canvas texture). Redrawn by Viz on theme change; standalone users call label.redraw(). */
export function makeLabel(text, o = {}) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: o.depthTest ?? false, sizeAttenuation: o.attenuate ?? true }));
  sp.userData.label = { text, o }; sp.renderOrder = 10; redrawLabel(sp, o.dark ?? (window.SITE ? window.SITE.isDark() : true)); return sp;
}
export function redrawLabel(sp, dark) {
  const { text, o } = sp.userData.label, pal = palette(dark); const px = o.px || 26, pad = o.pad ?? 8, weight = o.weight || 600;
  const c = document.createElement('canvas'), g = c.getContext('2d'); g.font = `${weight} ${px}px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif`;
  const lines = String(text).split('\n'), w = Math.ceil(Math.max(...lines.map(l => g.measureText(l).width))) + pad * 2, h = Math.ceil(lines.length * px * 1.25) + pad * 2;
  c.width = w * 2; c.height = h * 2; g.scale(2, 2); g.font = `${weight} ${px}px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif`; g.textBaseline = 'top';
  if (o.bg !== false) { g.fillStyle = o.bg || (dark ? 'rgba(15,23,42,.72)' : 'rgba(255,255,255,.8)'); const r = 8; g.beginPath(); g.roundRect(0, 0, w, h, r); g.fill(); }
  g.fillStyle = o.color ? (pal[o.color] || o.color) : pal.ink; lines.forEach((l, i) => g.fillText(l, pad, pad + i * px * 1.25));
  if (sp.material.map) sp.material.map.dispose(); const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; sp.material.map = tex; sp.material.needsUpdate = true;
  const s = o.scale || 1; sp.scale.set(s * w / px, s * h / px, 1); sp.userData.size = [w, h]; return sp;
}
