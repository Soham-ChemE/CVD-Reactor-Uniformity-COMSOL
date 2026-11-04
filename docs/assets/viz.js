/* Body scenes: every graph, schematic and process diagram on the page is a WebGL scene drawn by ONE renderer into
   a fixed, transparent, pointer-transparent canvas, scissor-clipped to the rectangle of its placeholder element.
   This is the three.js "webgl_multiple_elements" pattern (one context for any number of views, no per-view canvas,
   no browser context cap): https://github.com/mrdoob/three.js/blob/master/examples/webgl_multiple_elements.html
   Each view assembles or draws progressively as it scrolls into the viewport (progress 0 -> 1), renders only while on
   screen and only when something changed, supports hover readouts (raycast), drag-to-orbit, and both themes.
   Reduced motion or no WebGL: the views are not built and each placeholder shows its static PNG (docs/build_assets.py).
   Helpers: axes, ribbon, bars, surface, tiles, exploded, label, mat. ES module; three.js via the page's import map. */
import { THREE, palette, THEME, roomEnvironment, makeLabel, redrawLabel } from './three-kit.js';

const S = () => window.SITE || { reduced: matchMedia('(prefers-reduced-motion:reduce)').matches, phone: matchMedia('(max-width:640px)').matches, isDark: () => matchMedia('(prefers-color-scheme:dark)').matches, onFrame: cb => requestAnimationFrame(function l(t) { cb(t / 1000, 16); requestAnimationFrame(l) }) };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const NAV_H = 52;

export const Viz = {
  views: [], renderer: null, canvas: null, ready: false, static: false, dark: true, pal: palette(true),

  /* Build the shared renderer; called once by the first view(). Returns false in static mode. */
  init() {
    if (this.renderer || this.static) return !this.static;
    const s = S(); this.S = s; this.dark = s.isDark(); this.pal = palette(this.dark);
    const toStatic = () => { this.static = true; document.documentElement.classList.add('viz-static'); this.applyStatic(); return false; };
    if (s.reduced || (window.VIZ_FORCE_STATIC)) return toStatic();
    try { const p = document.createElement('canvas'); if (!(p.getContext('webgl2') || p.getContext('webgl'))) return toStatic(); } catch (e) { return toStatic(); }
    const canvas = document.createElement('canvas'); canvas.className = 'viz-canvas'; canvas.setAttribute('aria-hidden', 'true'); document.body.appendChild(canvas); this.canvas = canvas;
    let r; try { r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' }); } catch (e) { canvas.remove(); return toStatic(); }
    this.renderer = r; r.setPixelRatio(Math.min(devicePixelRatio || 1, s.phone ? 1.5 : 2)); r.setClearColor(0x000000, 0); r.toneMapping = THREE.ACESFilmicToneMapping; r.autoClear = false;
    this.env = roomEnvironment(r);
    const tip = document.createElement('div'); tip.className = 'viz-tip'; tip.hidden = true; document.body.appendChild(tip); this.tip = tip;
    const fit = () => { const w = innerWidth, h = innerHeight; r.setSize(w, h, false); this.w = w; this.h = h; this.views.forEach(v => v.dirty = true); };
    fit(); addEventListener('resize', fit);
    this.applyTheme(); document.addEventListener('themechange', () => this.applyTheme());
    let lastY = -1, lastW = 0;
    s.onFrame((t, dt) => {
      if (this.disposed) return; const scrolled = scrollY !== lastY || innerWidth !== lastW; lastY = scrollY; lastW = innerWidth;
      let any = false, anyVisible = false; const vh = innerHeight, vw = innerWidth;
      for (const v of this.views) {
        const rc = v.el.getBoundingClientRect(); v.rect = rc;
        v.visible = rc.bottom > NAV_H && rc.top < vh && rc.right > 0 && rc.left < vw && rc.width > 2 && rc.height > 2;
        if (!v.visible) continue; anyVisible = true;
        // scroll progress: starts when the top enters at 92 % of the viewport, completes when the centre reaches 58 %
        const start = vh * .92, end = Math.min(vh * .58 - rc.height / 2, start - vh * .25);
        const target = v.pinned != null ? v.pinned : clamp((start - rc.top) / Math.max(1, start - end), 0, 1);
        if (Math.abs(target - v.p) > 1e-3) { v.p += (target - v.p) * (v.pinned != null ? 1 : .14); if (Math.abs(target - v.p) < 1e-3) v.p = target; v.dirty = true; }
        const changed = v.update ? v.update(v, t, dt) : false; if (changed || v.dirty || scrolled) any = true;
      }
      if (any && anyVisible) this.renderAll();
    });
    this.ready = true; return true;
  },

  applyTheme() {
    const dark = this.S.isDark(), T = THEME[dark ? 'dark' : 'light']; this.dark = dark; this.pal = palette(dark);
    if (this.renderer) this.renderer.toneMappingExposure = T.exposure;
    for (const v of this.views) {
      v.dark = dark; v.pal = this.pal; if (v.scene.environment) v.scene.environmentIntensity = v.envIntensity * T.env;
      v.lights.forEach(l => l.intensity = l.userData.base * T.lights);
      v.scene.traverse(o => { if (o.userData.label) redrawLabel(o, dark); if (o.material && o.material.userData && o.material.userData.pal) { const m = o.material, k = m.userData.pal; m.color.set(this.pal[k] || k); if (m.emissive && m.userData.emissive) m.emissive.set(this.pal[m.userData.emissive] || m.userData.emissive); } });
      v.onTheme && v.onTheme(v, dark); v.dirty = true;
    }
    if (this.static) this.applyStatic();
  },
  applyStatic() { const t = this.S ? (this.S.isDark() ? 'dark' : 'light') : 'dark'; document.querySelectorAll('.viz img.fallback[data-viz-fig]').forEach(i => { i.src = (i.dataset.dir || 'assets/') + i.dataset.vizFig + '_' + t + '.png'; }); },

  renderAll() {
    const r = this.renderer, h = this.h; r.setScissorTest(false); r.clear();
    r.setScissorTest(true);
    for (const v of this.views) {
      if (!v.visible) continue; const rc = v.rect;
      const top = Math.max(rc.top, NAV_H), bottom = Math.min(rc.bottom, h), left = Math.max(rc.left, 0), right = Math.min(rc.right, this.w);
      if (bottom - top < 2 || right - left < 2) continue;
      // the camera keeps the whole element's aspect; the scissor clips to the visible part
      const asp = rc.width / rc.height; if (Math.abs(v.camera.aspect - asp) > 1e-3) { v.camera.aspect = asp; v.camera.updateProjectionMatrix(); }
      r.setViewport(rc.left, h - rc.bottom, rc.width, rc.height); r.setScissor(left, h - bottom, right - left, bottom - top);
      r.render(v.scene, v.camera); v.dirty = false;
    }
    r.setScissorTest(false);
  },

  /* Register a view on element el. build(v) adds objects to v.scene and may set v.update(v,t,dt) -> changed, v.hover(hit) -> html, v.onTheme(v,dark). */
  view(el, build, o = {}) {
    if (typeof el === 'string') el = document.querySelector(el); if (!el) return null;
    if (!this.init()) return null;
    const scene = new THREE.Scene(); scene.environment = this.env; const envIntensity = o.envIntensity ?? .5; scene.environmentIntensity = envIntensity * THEME[this.dark ? 'dark' : 'light'].env;
    const camera = new THREE.PerspectiveCamera(o.fov || 34, 1.6, .05, 200); camera.position.set(...(o.camera || [4, 3, 6])); const target = new THREE.Vector3(...(o.target || [0, 0, 0])); camera.lookAt(target);
    const rig = new THREE.Group(); scene.add(rig);
    const v = { el, scene, camera, rig, target, p: 0, pinned: null, dirty: true, visible: false, dark: this.dark, pal: this.pal, lights: [], pickables: [], envIntensity, name: el.dataset.viz || '', spin: o.spin || 0, orbit: o.orbit !== false, rot: 0, tilt: 0 };
    const hemi = new THREE.HemisphereLight(0xffffff, 0x334466, o.hemi ?? .9), dl = new THREE.DirectionalLight(0xffffff, o.sun ?? 1.3); dl.position.set(4, 8, 6); hemi.userData.base = hemi.intensity; dl.userData.base = dl.intensity; scene.add(hemi, dl); v.lights.push(hemi, dl);
    v.lights.forEach(l => l.intensity = l.userData.base * THEME[this.dark ? 'dark' : 'light'].lights);
    el.classList.add('viz-live');
    // pointer: drag to orbit the rig, hover readouts through a raycaster on v.pickables
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let drag = null;
    const ndcOf = e => { const rc = v.rect || el.getBoundingClientRect(); ndc.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1); return ndc; };
    el.addEventListener('pointerdown', e => { if (!v.orbit) return; drag = { x: e.clientX, y: e.clientY, rot: v.rot, tilt: v.tilt, moved: false }; el.setPointerCapture && el.setPointerCapture(e.pointerId); });
    addEventListener('pointerup', () => drag = null);
    el.addEventListener('pointermove', e => {
      if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true; v.rot = drag.rot + dx * .008; v.tilt = clamp(drag.tilt + dy * .005, -.6, .6); v.dirty = true; this.tip.hidden = true; return; }
      if (!v.hover || !v.pickables.length || this.S.phone) return;
      ray.setFromCamera(ndcOf(e), camera); const hits = ray.intersectObjects(v.pickables, true); const html = hits.length ? v.hover(hits[0], v) : null;
      if (html) { this.tip.innerHTML = html; this.tip.hidden = false; const tw = this.tip.offsetWidth; this.tip.style.left = Math.min(innerWidth - tw - 8, e.clientX + 14) + 'px'; this.tip.style.top = (e.clientY + 14) + 'px'; } else this.tip.hidden = true;
    });
    el.addEventListener('pointerleave', () => { this.tip.hidden = true; });
    this.views.push(v);
    build(v, this);
    const userUpdate = v.update;
    v.update = (vv, t, dt) => { let ch = false; if (vv.spin && !drag) { vv.rot += vv.spin * (dt / 1000); ch = true; } rig.rotation.y = vv.rot; rig.rotation.x = vv.tilt; if (userUpdate) ch = userUpdate(vv, t, dt) || ch; return ch; };
    return v;
  },

  /* Force every view to its final state and render (used by build_assets.py's snapshot pass and by QA). */
  force(p = 1) { for (const v of this.views) { v.pinned = p; v.p = p; v.dirty = true; } },

  /* ---------- materials and labels ---------- */
  mat(key, o = {}) { const pal = this.pal; const m = new THREE.MeshStandardMaterial({ color: pal[key] || key, roughness: o.roughness ?? .45, metalness: o.metalness ?? .15, transparent: !!o.opacity && o.opacity < 1, opacity: o.opacity ?? 1, side: o.side || THREE.FrontSide, emissive: o.emissive ? (pal[o.emissive] || o.emissive) : 0x000000, emissiveIntensity: o.emissiveIntensity ?? .25, flatShading: !!o.flat, depthWrite: o.depthWrite ?? true }); m.userData.pal = key; if (o.emissive) m.userData.emissive = o.emissive; return m; },
  label(v, text, pos, o = {}) { const sp = makeLabel(text, { ...o, dark: v.dark }); sp.position.set(...pos); (o.parent || v.rig).add(sp); return sp; },
  line(v, pts, key = 'line', o = {}) { const g = new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(...p))); const m = new THREE.LineBasicMaterial({ color: this.pal[key] || key, transparent: o.opacity != null, opacity: o.opacity ?? 1 }); m.userData.pal = key; const l = new THREE.Line(g, m); (o.parent || v.rig).add(l); return l; },

  /* ---------- 3D axes box: maps data ranges to a world box of size [sx,sy,sz] centred on the origin ---------- */
  axes(v, spec) {
    const [sx, sy, sz] = spec.size || [4, 2.2, 2.4]; const ax = { x: spec.x, y: spec.y, z: spec.z || { lo: 0, hi: 1 } };
    const map = (x, y, z = 0) => new THREE.Vector3((x - ax.x.lo) / (ax.x.hi - ax.x.lo) * sx - sx / 2, (y - ax.y.lo) / (ax.y.hi - ax.y.lo) * sy - sy / 2, (z - ax.z.lo) / (ax.z.hi - ax.z.lo) * sz - sz / 2);
    const g = new THREE.Group(); v.rig.add(g); const pts = [];
    const x0 = -sx / 2, y0 = -sy / 2, z0 = -sz / 2, z1 = sz / 2, x1 = sx / 2, y1 = sy / 2;
    // floor grid and back wall grid, in the theme line colour
    const nx = (ax.x.ticks || []).length, ny = (ax.y.ticks || []).length;
    for (const tx of ax.x.ticks || []) { const px = map(tx, ax.y.lo, ax.z.lo).x; pts.push([px, y0, z0], [px, y0, z1], [px, y0, z0], [px, y1, z0]); }
    for (const ty of ax.y.ticks || []) { const py = map(ax.x.lo, ty, ax.z.lo).y; pts.push([x0, py, z0], [x1, py, z0], [x0, py, z0], [x0, py, z1]); }
    for (const tz of ax.z.ticks || []) { const pz = map(ax.x.lo, ax.y.lo, tz).z; pts.push([x0, y0, pz], [x1, y0, pz], [x0, y0, pz], [x0, y1, pz]); }
    pts.push([x0, y0, z0], [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x1, y0, z1], [x0, y1, z0], [x1, y1, z0], [x0, y1, z0], [x0, y1, z1]);
    const geo = new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(...p))); const lm = new THREE.LineBasicMaterial({ color: this.pal.line, transparent: true, opacity: .9 }); lm.userData.pal = 'line'; g.add(new THREE.LineSegments(geo, lm));
    const px = spec.px || 22, lab = (t, p, o) => { const s = makeLabel(t, { px, bg: false, color: 'muted', dark: v.dark, scale: spec.labelScale || .09, ...o }); s.position.copy(p); g.add(s); return s; };
    const fx = ax.x.fmt || (t => t), fy = ax.y.fmt || (t => t), fz = ax.z.fmt || (t => t);
    for (const tx of ax.x.ticks || []) lab(fx(tx), map(tx, ax.y.lo, ax.z.lo).add(new THREE.Vector3(0, -.14, .18 + sz * .02)));
    for (const ty of ax.y.ticks || []) lab(fy(ty), map(ax.x.lo, ty, ax.z.lo).add(new THREE.Vector3(-.22 - sx * .02, 0, 0)));
    for (const tz of ax.z.ticks || []) lab(fz(tz), map(ax.x.lo, ax.y.lo, tz).add(new THREE.Vector3(.2 + sx * .03, -.1, 0)), { color: 'ink' });
    if (ax.x.label) lab(ax.x.label, new THREE.Vector3(0, y0 - .42, z1 + .12), { color: 'ink', px: px + 2, weight: 700 });
    if (ax.y.label) lab(ax.y.label, new THREE.Vector3(x0 - .55 - sx * .03, 0, z0), { color: 'ink', px: px + 2, weight: 700 });
    if (ax.z.label) lab(ax.z.label, new THREE.Vector3(x1 + .45 + sx * .04, y0 - .1, 0), { color: 'ink', px: px + 2, weight: 700 });
    return { map, group: g, size: [sx, sy, sz], ax };
  },

  /* ---------- a data series as a 3D ribbon: a band of width w (in z) following (x, y), drawn progressively ---------- */
  ribbon(v, A, xs, ys, o = {}) {
    const z = o.z ?? 0, w = o.width ?? .12, n = xs.length, key = o.color || 'cyan';
    const pos = new Float32Array(n * 2 * 3), idx = []; const p = new THREE.Vector3();
    for (let i = 0; i < n; i++) { A.map(xs[i], ys[i], z).toArray(pos, i * 6); pos[i * 6 + 2] -= w / 2; pos[i * 6 + 3] = pos[i * 6]; pos[i * 6 + 4] = pos[i * 6 + 1]; pos[i * 6 + 5] = pos[i * 6 + 2] + w; if (i) idx.push(i * 2 - 2, i * 2 - 1, i * 2, i * 2 - 1, i * 2 + 1, i * 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = this.mat(key, { side: THREE.DoubleSide, roughness: .35, metalness: .25, emissive: key, emissiveIntensity: .35 }); const mesh = new THREE.Mesh(g, m); mesh.userData = { xs, ys, series: o.name || '', unit: o.unit || '' }; v.rig.add(mesh); v.pickables.push(mesh);
    let skirt = null;
    if (o.skirt !== false) { const sp = new Float32Array(n * 2 * 3), si = []; for (let i = 0; i < n; i++) { const q = A.map(xs[i], ys[i], z); q.toArray(sp, i * 6); const b = A.map(xs[i], A.ax.y.lo, z); b.toArray(sp, i * 6 + 3); if (i) si.push(i * 2 - 2, i * 2 - 1, i * 2, i * 2 - 1, i * 2 + 1, i * 2); } const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setIndex(si); const sm = this.mat(key, { side: THREE.DoubleSide, opacity: o.skirtOpacity ?? .14, depthWrite: false }); skirt = new THREE.Mesh(sg, sm); v.rig.add(skirt); }
    const draw = p => { const k = Math.floor(clamp(p, 0, 1) * (n - 1)); g.setDrawRange(0, k * 6); if (skirt) skirt.geometry.setDrawRange(0, k * 6); }; draw(0);
    return { mesh, skirt, draw, n };
  },
  /* nearest data index for a hover hit on a ribbon */
  ribbonIndex(hit, A) { const xs = hit.object.userData.xs; const lx = (hit.point.x + A.size[0] / 2) / A.size[0] * (A.ax.x.hi - A.ax.x.lo) + A.ax.x.lo; let best = 0, bd = 1e30; for (let i = 0; i < xs.length; i++) { const d = Math.abs(xs[i] - lx); if (d < bd) { bd = d; best = i; } } return best; },

  /* ---------- bar field: instanced boxes at (x, z) data positions, heights y, growing with progress ---------- */
  bars(v, A, items, o = {}) {
    const n = items.length, w = o.width ?? .3, d = o.depth ?? w; const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, .5, 0);
    const m = new THREE.MeshStandardMaterial({ roughness: .4, metalness: .2, vertexColors: false }); const im = new THREE.InstancedMesh(geo, m, n); im.userData.items = items; im.userData.pal = true;
    const M = new THREE.Matrix4(), col = new THREE.Color(); v.rig.add(im); v.pickables.push(im);
    const paint = () => { items.forEach((it, i) => { col.set(this.pal[it.color] || it.color || this.pal.cyan); im.setColorAt(i, col); }); im.instanceColor.needsUpdate = true; };
    const draw = p => { items.forEach((it, i) => { const pi = ease(clamp(p * (1 + .5) - (i / n) * .5, 0, 1)); const b = A.map(it.x, A.ax.y.lo, it.z ?? 0), top = A.map(it.x, it.y, it.z ?? 0); M.makeScale(w, Math.max(1e-4, (top.y - b.y) * pi), d); M.setPosition(b); im.setMatrixAt(i, M); }); im.instanceMatrix.needsUpdate = true; };
    paint(); draw(0); im.userData.paint = paint; v.__barFields = (v.__barFields || []).concat([paint]);
    const oldTheme = v.onTheme; v.onTheme = (vv, dark) => { paint(); oldTheme && oldTheme(vv, dark); };
    return { mesh: im, draw };
  },

  /* ---------- height-field surface over a grid, colours by height, rising with progress ---------- */
  surface(v, A, xs, zs, Z, o = {}) {
    const nx = xs.length, nz = zs.length; const g = new THREE.PlaneGeometry(1, 1, nx - 1, nz - 1); g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position; const base = new Float32Array(pos.count), colors = new Float32Array(pos.count * 3); const stops = (o.stops || ['cool', 'cyan', 'warm', 'hot']).map(k => new THREE.Color(this.pal[k] || k));
    let lo = Infinity, hi = -Infinity; for (const row of Z) for (const z of row) { lo = Math.min(lo, z); hi = Math.max(hi, z); } const vlo = o.lo ?? lo, vhi = o.hi ?? hi;
    const tmp = new THREE.Color();
    const paint = () => { const st = (o.stops || ['cool', 'cyan', 'warm', 'hot']).map(k => new THREE.Color(this.pal[k] || k)); for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i, u = clamp((Z[j][i] - vlo) / ((vhi - vlo) || 1), 0, 1) * (st.length - 1), a = Math.min(st.length - 2, Math.floor(u)); tmp.copy(st[a]).lerp(st[a + 1], u - a); colors[k * 3] = tmp.r; colors[k * 3 + 1] = tmp.g; colors[k * 3 + 2] = tmp.b; } g.attributes.color.needsUpdate = true; };
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i, q = A.map(xs[i], Z[j][i], zs[j]); pos.setXYZ(k, q.x, q.y, q.z); base[k] = q.y; }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); paint();
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .5, metalness: .1, side: THREE.DoubleSide, flatShading: !!o.flat }); const mesh = new THREE.Mesh(g, m); mesh.userData = { xs, zs, Z }; v.rig.add(mesh); v.pickables.push(mesh);
    const wire = o.wire === false ? null : new THREE.LineSegments(new THREE.WireframeGeometry(g), new THREE.LineBasicMaterial({ color: this.pal.ink, transparent: true, opacity: .12 })); if (wire) { wire.material.userData.pal = 'ink'; v.rig.add(wire); }
    const y0 = A.map(0, A.ax.y.lo, 0).y;
    const draw = p => { const e = ease(clamp(p, 0, 1)); for (let k = 0; k < pos.count; k++) pos.setY(k, y0 + (base[k] - y0) * e); pos.needsUpdate = true; g.computeVertexNormals(); if (wire) { wire.geometry.dispose(); wire.geometry = new THREE.WireframeGeometry(g); } };
    draw(0); const oldTheme = v.onTheme; v.onTheme = (vv, dark) => { paint(); oldTheme && oldTheme(vv, dark); };
    return { mesh, draw, wire };
  },

  /* ---------- tile field: a categorical matrix as instanced slabs that drop into place ---------- */
  tiles(v, cells, o = {}) {
    const n = cells.length, w = o.width ?? .9, d = o.depth ?? .9, h = o.height ?? .16; const geo = new THREE.BoxGeometry(w, h, d); geo.translate(0, h / 2, 0);
    const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: .45, metalness: .15 }), n); im.userData.cells = cells; v.rig.add(im); v.pickables.push(im);
    const M = new THREE.Matrix4(), col = new THREE.Color();
    const paint = () => { cells.forEach((c, i) => { col.set(this.pal[c.color] || c.color); im.setColorAt(i, col); }); im.instanceColor.needsUpdate = true; };
    const draw = p => { cells.forEach((c, i) => { const pi = ease(clamp(p * 1.6 - (c.delay ?? i / n) * .6, 0, 1)); M.makeScale(1, Math.max(1e-3, pi * (c.scale ?? 1)), 1); M.setPosition(c.x, (1 - pi) * 1.2, c.z); im.setMatrixAt(i, M); }); im.instanceMatrix.needsUpdate = true; };
    paint(); draw(0); const oldTheme = v.onTheme; v.onTheme = (vv, dark) => { paint(); oldTheme && oldTheme(vv, dark); };
    return { mesh: im, draw };
  },

  /* ---------- exploded assembly: parts fly in from an offset as progress rises, staggered ---------- */
  exploded(v, parts) {
    parts.forEach(pt => { pt.rest = pt.mesh.position.clone(); pt.from = new THREE.Vector3(...(pt.from || [0, 2, 0])); pt.delay = pt.delay ?? 0; pt.span = pt.span ?? .6; if (pt.mesh.parent == null) v.rig.add(pt.mesh); });
    const draw = p => { parts.forEach(pt => { const e = ease(clamp((p - pt.delay) / pt.span, 0, 1)); pt.mesh.position.copy(pt.rest).addScaledVector(pt.from, 1 - e); if (pt.mesh.material && pt.fade !== false) { const ms = [].concat(pt.mesh.material); ms.forEach(m => { if (m.userData.baseOpacity == null) m.userData.baseOpacity = m.opacity; m.opacity = m.userData.baseOpacity * (.15 + .85 * e); m.transparent = true; }); } if (pt.onDraw) pt.onDraw(e); }); };
    draw(0); return { draw, parts };
  },

  /* ---------- count-up number bound to a view's progress ---------- */
  counter(el, target, p, fmt) { if (!el) return; el.textContent = fmt ? fmt(target * ease(p)) : Math.round(target * ease(p)).toLocaleString('en-US'); },

  dispose() { this.disposed = true; for (const v of this.views) v.scene.traverse(o => { o.geometry && o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => { for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose(); m.dispose(); }); }); if (this.renderer) { if (this.renderer.__env) this.renderer.__env.dispose(); this.renderer.dispose(); this.renderer.forceContextLoss && this.renderer.forceContextLoss(); } }
};
addEventListener('pagehide', () => Viz.dispose(), { once: true });
window.__viz = Viz;
export default Viz;
