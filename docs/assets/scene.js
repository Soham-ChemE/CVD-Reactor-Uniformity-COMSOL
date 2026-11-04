/* Hero and 3D scenes for the CVD reactor page. Data: window.CVD from assets/data.js (exported COMSOL wafer-plane profiles and the
   6,012-node 3D wafer face). The hero height map morphs with scroll through the three measured states: 10 mm inlet (179.6 %),
   full-span inlet at 0.10 m/s (6.1 %), full-span at 0.07 m/s (3.3 %). */
import { THREE, createStage, cameraPath } from './three-kit.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const D = window.CVD, S = window.SITE, reduced = S.reduced, phone = S.phone;
const viridis = t => { const s = [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]]; t = Math.max(0, Math.min(1, t)) * (s.length - 1); const i = Math.floor(t), f = t - i, a = s[i], b = s[Math.min(i + 1, s.length - 1)]; return [(a[0] + (b[0] - a[0]) * f) / 255, (a[1] + (b[1] - a[1]) * f) / 255, (a[2] + (b[2] - a[2]) * f) / 255]; };
const textSprite = (txt, color, w = 2.4) => { const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d'); g.font = '600 40px -apple-system,Segoe UI,Roboto,Helvetica,Arial'; g.fillStyle = color; g.textAlign = 'center'; g.fillText(txt, 256, 62); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })); s.scale.set(w, w * 96 / 512, 1); return s; };
const interp = (rc, r) => { let i = 1; while (i < rc.length - 1 && rc[i][0] < r) i++; const a = rc[i - 1], b = rc[i]; const t = (r - a[0]) / ((b[0] - a[0]) || 1); return a[1] + (b[1] - a[1]) * Math.max(0, Math.min(1, t)); };

// ---------- hero: reactor with the wafer-plane concentration as a height map ----------
(function () {
  const canvas = document.getElementById('heroCanvas'); if (!canvas) return;
  const st = createStage(canvas, { fov: 38, bloom: { strength: .3, radius: .45, threshold: .88 }, dof: { aperture: .0004, maxblur: .003 }, exposure: 1.0, envIntensity: .5 });
  if (st.failed) return; const { scene, camera } = st;
  const ctr = new OrbitControls(camera, canvas); ctr.enableDamping = true; ctr.enableZoom = false; ctr.enablePan = false; ctr.autoRotate = !reduced; ctr.autoRotateSpeed = .45; ctr.minPolarAngle = .85; ctr.maxPolarAngle = 1.45;
  const hemi = new THREE.HemisphereLight(0xffffff, 0x223355, .9); scene.add(hemi); const dl = new THREE.DirectionalLight(0xffffff, 1.4); dl.position.set(4, 8, 5); scene.add(dl);
  const g = new THREE.Group(); scene.add(g); const SC = 20; const WR = 0.15 * SC, GAP = 0.02 * SC * 2.5; // 300 mm wafer = 6 units; gap exaggerated 2.5x for legibility
  const chamber = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * SC, 0.2 * SC, GAP + 1.6, 64, 1, true), new THREE.MeshStandardMaterial({ color: 0x8b98a9, transparent: true, opacity: .06, side: THREE.DoubleSide, depthWrite: false })); chamber.position.y = (GAP + 1.6) / 2 - .3; g.add(chamber);
  const wafer = new THREE.Mesh(new THREE.CylinderGeometry(WR, WR, .06, 96), new THREE.MeshStandardMaterial({ color: 0x5b6676, metalness: .7, roughness: .3 })); wafer.position.y = -.03; g.add(wafer);
  const susceptor = new THREE.Mesh(new THREE.CylinderGeometry(WR + .3, WR + .3, .25, 96), new THREE.MeshStandardMaterial({ color: 0x2b3444, roughness: .8, emissive: 0xf97316, emissiveIntensity: .12 })); susceptor.position.y = -.19; g.add(susceptor);
  const inlet = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, .18, 96), new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: .45, roughness: .4 })); inlet.position.y = GAP + .09; g.add(inlet);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * SC, 0.2 * SC, .12, 64), new THREE.MeshStandardMaterial({ color: 0x3a4557, roughness: .7, transparent: true, opacity: .22, depthWrite: false })); head.position.y = GAP + .24; g.add(head);
  const headRing = new THREE.Mesh(new THREE.TorusGeometry(0.2 * SC, .03, 8, 96), new THREE.MeshStandardMaterial({ color: 0x8b98a9, metalness: .6 })); headRing.rotation.x = Math.PI / 2; headRing.position.y = GAP + .24; g.add(headRing);
  const slit = new THREE.Mesh(new THREE.TorusGeometry(0.2 * SC, .05, 8, 96), new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: .5 })); slit.rotation.x = Math.PI / 2; slit.position.y = .35; g.add(slit);
  const labs = []; const lab = (t, x, y, z, w) => { const s = textSprite(t, '#8b98a9', w || 1.8); s.position.set(x, y, z); g.add(s); labs.push([s, t, w || 1.8]); return s; };
  const inletLab = lab('inlet 10 mm', 0, GAP + .95, 0, 2.0); lab(`${(D.geometry || {}).wafer_mm || 300} mm wafer, 1000 K`, 0, -.6, WR + .6, 2.6); lab('exhaust slit', -(0.2 * SC) - .9, .35, 0, 1.6);
  // height map over the wafer: polar grid, height and colour = c / mean
  const NR = phone ? 32 : 48, NT = phone ? 64 : 96; const geo = new THREE.BufferGeometry(); const pos = new Float32Array((NR + 1) * (NT + 1) * 3), col = new Float32Array((NR + 1) * (NT + 1) * 3), idx = [];
  for (let i = 0; i <= NR; i++) for (let j = 0; j <= NT; j++) { const k = i * (NT + 1) + j; const r = i / NR * 138, th = j / NT * Math.PI * 2; pos[3 * k] = Math.cos(th) * r / 1000 * SC; pos[3 * k + 2] = Math.sin(th) * r / 1000 * SC; pos[3 * k + 1] = 0; if (i < NR && j < NT) { const a = k, b = k + 1, c = k + NT + 1, d = k + NT + 2; idx.push(a, c, b, b, c, d); } }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(idx);
  const surf = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .5, metalness: .05, transparent: true, opacity: .96, emissive: 0xffffff, emissiveIntensity: .06 })); g.add(surf);
  // the three measured states: before (10 mm), after at 0.10 m/s (6.1 %), optimum at 0.07 m/s (3.3 %)
  const prof = [D.profiles.before.rc, D.profiles.after.rc, (D.doe.find(d => Math.abs(d.u - 0.07) < 1e-6 && d.T === 1000) || D.profiles.after).rc];
  const H = prof.map(rc => { const h = []; for (let i = 0; i <= NR; i++) h.push(interp(rc, i / NR * 138)); return h; });
  const SIG = [D.stats.sigma_before, D.stats.sigma_after, D.stats.sigma_opt], COV = [D.stats.cov_before, D.stats.cov_after, D.stats.cov_after], U = [0.10, 0.10, 0.07];
  const HS = .85; const hmap = v => HS * (1 - Math.exp(-v / 1.2));
  const ro = { sigma: document.getElementById('roSigma'), inlet: document.getElementById('roInlet'), cov: document.getElementById('roCov'), bar: document.getElementById('roBar'), hint: document.getElementById('roHint'), u: document.getElementById('roU') };
  let morph = -1;
  function setMorph(p) { // p in [0, 2]: 0 -> state 0, 1 -> state 1, 2 -> state 2
    const a = Math.min(1, Math.floor(p)), f = p - a; const b = Math.min(2, a + 1);
    for (let i = 0; i <= NR; i++) { const v = H[a][i] + (H[b][i] - H[a][i]) * f; const y = hmap(v); const c = viridis(Math.min(1, v / 1.6)); for (let j = 0; j <= NT; j++) { const k = i * (NT + 1) + j; pos[3 * k + 1] = y; col[3 * k] = c[0]; col[3 * k + 1] = c[1]; col[3 * k + 2] = c[2]; } }
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; geo.computeVertexNormals();
    const w = p < 1 ? 10 + 140 * p : 150; inlet.scale.set(w / 1000 * SC / 2, 1, w / 1000 * SC / 2);
    const sig = SIG[a] + (SIG[b] - SIG[a]) * f, cov = COV[a] + (COV[b] - COV[a]) * f, u = U[a] + (U[b] - U[a]) * f;
    if (ro.sigma) { ro.sigma.textContent = sig.toFixed(1) + ' %'; ro.inlet.textContent = Math.round(w) + ' mm'; ro.cov.textContent = Math.round(cov) + ' %'; ro.bar.style.width = (50 * p) + '%'; if (ro.u) ro.u.textContent = u.toFixed(2) + ' m/s'; ro.hint.textContent = p < .02 ? 'scroll to widen the inlet' : p < .98 ? 'widening the inlet…' : p < 1.05 ? 'full-span inlet at 0.10 m/s' : p < 1.95 ? 'slowing the inlet toward 0.07 m/s…' : 'full-span inlet at 0.07 m/s: σ = 3.3 %'; }
    const ni = p < .5 ? 'inlet 10 mm (original)' : 'inlet 150 mm (full span)'; if (inletLab.userData.t !== ni) { inletLab.userData.t = ni; const s = textSprite(ni, '#f59e0b', 2.0); inletLab.material.map.dispose(); inletLab.material.map = s.material.map; inletLab.material.needsUpdate = true; }
    morph = p; st.dirty = true;
  }
  // gas streamlines: inlet -> wafer -> exhaust slit; speed follows the inlet velocity
  const NPART = phone ? 90 : 170, pg = new THREE.SphereGeometry(.028, 6, 5), pmat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: .8, transparent: true, opacity: .6 }); const parts = new THREE.InstancedMesh(pg, pmat, NPART); g.add(parts);
  const rnd = (() => { let s = 3; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })(); const P = []; for (let i = 0; i < NPART; i++) P.push({ t: rnd(), th: rnd() * Math.PI * 2, f: rnd() }); const m4 = new THREE.Matrix4();
  function stepParts(dt) { const p0 = Math.max(0, morph); const w = (p0 < 1 ? 10 + 140 * p0 : 150) / 1000 * SC / 2; const speed = p0 < 1 ? .35 : .35 * (1 - .3 * (p0 - 1)); for (let n = 0; n < NPART; n++) { const p = P[n]; p.t += dt * speed; if (p.t > 1) { p.t = 0; p.th = rnd() * Math.PI * 2; p.f = rnd(); } const r0 = p.f * w; let x, y, z; if (p.t < .4) { const u = p.t / .4; y = GAP - (GAP - .12) * u; x = Math.cos(p.th) * r0; z = Math.sin(p.th) * r0; } else { const u = (p.t - .4) / .6; const r = r0 + (0.2 * SC - r0) * u; y = .12 + .25 * u; x = Math.cos(p.th) * r; z = Math.sin(p.th) * r; } m4.makeTranslation(x, y, z); parts.setMatrixAt(n, m4); } parts.instanceMatrix.needsUpdate = true; }
  st.onTheme = () => { hemi.intensity = .9 * st.lights; dl.intensity = 1.4 * st.lights; st.dirty = true; }; st.onTheme();
  // layout and the scroll-scrubbed camera: overview, then low across the wafer, then above the showerhead looking down at the flat map
  const wide = () => st.wide !== false;
  function layout() { const w = wide(); g.position.set(w ? 2.2 : 0, w ? -.6 : .9, 0); g.scale.setScalar(w ? 1 : .72); }
  const pathWide = cameraPath([[7.5, 2.4, 7.5], [8.4, 1.2, 3.0], [5.2, 4.6, 4.8], [2.4, 6.4, 1.6]], [[2.2, .3, 0], [2.2, .1, 0], [2.2, .3, 0], [2.2, 0, 0]]);
  const pathNarrow = cameraPath([[0, 3.6, 10.5], [4.5, 2.6, 6.5], [1.5, 6.5, 5.5], [0, 8.5, 2.0]], [[0, 1.2, 0], [0, 1.0, 0], [0, 1.1, 0], [0, .9, 0]]);
  const pos3 = new THREE.Vector3(), tgt3 = new THREE.Vector3(); let dragging = false, lastT = -1;
  canvas.addEventListener('pointerdown', () => dragging = true); addEventListener('pointerup', () => setTimeout(() => dragging = false, 2500)); ctr.addEventListener('change', () => st.dirty = true);
  layout(); setMorph(reduced ? 2 : 0); (wide() ? pathWide : pathNarrow).at(reduced ? 1 : 0, pos3, tgt3); camera.position.copy(pos3); ctr.target.copy(tgt3); ctr.update();
  st.loop((t, dtMs) => {
    const dt = Math.min(.05, dtMs / 1000); const T = S.hero.t; let changed = false; layout();
    // morph: 10 mm -> 150 mm over the first 55 % of the track, then 0.10 -> 0.07 m/s up to 90 %
    const p = reduced ? 2 : Math.max(0, Math.min(2, T < .55 ? T / .55 : 1 + (T - .55) / .35));
    if (Math.abs(p - morph) > 1e-3) { setMorph(p); changed = true; }
    (wide() ? pathWide : pathNarrow).at(reduced ? 1 : T, pos3, tgt3);
    if (!dragging && camera.position.distanceToSquared(pos3) > 1e-6) { camera.position.lerp(pos3, reduced ? 1 : .08); changed = true; }
    ctr.target.lerp(tgt3, .08); ctr.autoRotate = !reduced && T < .06 && !dragging; if (ctr.autoRotate || dragging) changed = true; ctr.update();
    if (!reduced) { stepParts(dt); changed = true; }
    st.setBloom(.25 + .2 * S.hero.glow); if (st.bokeh) st.bokeh.uniforms.focus.value = camera.position.distanceTo(ctr.target);
    if (Math.abs(T - lastT) > 1e-4) { lastT = T; changed = true; }
    return changed;
  });
})();

// ---------- 3D wafer face from the three-port model ----------
(function () {
  const canvas = document.getElementById('waferCanvas'); if (!canvas) return;
  const st = createStage(canvas, { fov: 36, envIntensity: .6 }); if (st.failed) return; const { scene, camera } = st; camera.position.set(0, 4.2, 6.2);
  const ctr = new OrbitControls(camera, canvas); ctr.enableDamping = true; ctr.enableZoom = false; ctr.enablePan = false; ctr.autoRotate = !reduced; ctr.autoRotateSpeed = .8; ctr.maxPolarAngle = 1.4;
  const hemi2 = new THREE.HemisphereLight(0xffffff, 0x223355, .9); scene.add(hemi2); const dl = new THREE.DirectionalLight(0xffffff, 1.2); dl.position.set(3, 6, 4); scene.add(dl); st.onTheme = () => { hemi2.intensity = .9 * st.lights; dl.intensity = 1.2 * st.lights; st.dirty = true; }; st.onTheme();
  const W = D.wafer3d, n = W.n, SC = 20, HS = 2.2; const pos = new Float32Array(n * 3), col = new Float32Array(n * 3); const cm = W.c_mean;
  let lo = 1e9, hi = -1e9; for (let i = 0; i < n; i++) { const v = W.c[i] / cm; lo = Math.min(lo, v); hi = Math.max(hi, v); }
  for (let i = 0; i < n; i++) { const v = W.c[i] / cm; pos[3 * i] = W.x[i] / 1000 * SC; pos[3 * i + 2] = -W.y[i] / 1000 * SC; pos[3 * i + 1] = (v - lo) / (hi - lo) * HS; const c = viridis((v - lo) / (hi - lo)); col[3 * i] = c[0]; col[3 * i + 1] = c[1]; col[3 * i + 2] = c[2]; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(W.tri); geo.computeVertexNormals();
  scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .55 })));
  const base = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, .08, 96), new THREE.MeshStandardMaterial({ color: 0x5b6676, metalness: .5, roughness: .4 })); base.position.y = -.06; scene.add(base);
  const lo_s = textSprite(`c/mean ${lo.toFixed(2)} → ${hi.toFixed(2)}, height and colour`, '#8b98a9', 3.6); lo_s.position.set(0, -.5, 3.4); scene.add(lo_s);
  ctr.addEventListener('change', () => st.dirty = true);
  st.loop(() => { ctr.update(); return ctr.autoRotate; });
})();
