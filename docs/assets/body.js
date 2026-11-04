/* Body scenes for the CVD page, drawn by the shared Viz renderer (assets/viz.js) from window.CVD (assets/data.js):
   1. reactor: the axisymmetric chamber as an exploded cross-section (showerhead inlet, gap, wafer and susceptor, chamber wall,
      exhaust slit) that assembles on scroll, with the inlet widening from 10 to 150 mm;
   2. profiles: the three wafer-plane concentration profiles (10 mm inlet, full span at 0.10 and 0.07 m/s) as ribbons;
   3. doe: the fourteen DOE wafer-plane profiles as ribbons stacked by inlet velocity, the sticky steps highlighting the run in view;
   4. response: non-uniformity against inlet velocity at 900, 1000 and 1100 K as ribbons on a log axis;
   5. checks: the two-zone architectures and sensitivity runs as a bar field. */
import { Viz } from './viz.js';
import { THREE } from './three-kit.js';
const D = window.CVD; const f = (v, d = 0) => (+v).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });

/* ---------- 1. reactor cross-section ---------- */
Viz.view('[data-viz="reactor"]', v => {
  const G = D.geometry; const SC = 1 / 60; const WR = G.wafer_mm / 2 * SC, gap = G.gap_mm * SC * 2.5;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(WR + 1.0, WR + 1.0, gap + 1.6, 64, 1, true, Math.PI * .15, Math.PI * 1.7), Viz.mat('steel', { metalness: .6, roughness: .4, side: THREE.DoubleSide, opacity: .45 })); wall.position.y = .4;
  const wafer = new THREE.Mesh(new THREE.CylinderGeometry(WR, WR, .06, 96), Viz.mat('violet', { metalness: .5, roughness: .35 })); wafer.position.y = 0;
  const susc = new THREE.Mesh(new THREE.CylinderGeometry(WR + .3, WR + .3, .25, 96), Viz.mat('grey', { roughness: .6 })); susc.position.y = -.16;
  const head = new THREE.Mesh(new THREE.CylinderGeometry(G.inlet_before_mm / 2 * SC, G.inlet_before_mm / 2 * SC, .3, 64), Viz.mat('blue', { metalness: .4, roughness: .4, emissive: 'blue', emissiveIntensity: .15 })); head.position.y = gap + .15;
  const plenum = new THREE.Mesh(new THREE.CylinderGeometry(WR + .4, WR + .4, .3, 64), Viz.mat('steel', { metalness: .6, roughness: .4 })); plenum.position.y = gap + .5;
  const exhaust = new THREE.Mesh(new THREE.TorusGeometry(WR + .95, .09, 12, 64), Viz.mat('hot', { emissive: 'hot', emissiveIntensity: .3 })); exhaust.rotation.x = Math.PI / 2; exhaust.position.y = .25;
  const ex = Viz.exploded(v, [{ mesh: susc, from: [0, -1.6, 0], delay: 0, span: .25 }, { mesh: wafer, from: [0, -1.2, 0], delay: .12, span: .25 }, { mesh: exhaust, from: [2, 0, 0], delay: .28, span: .25 }, { mesh: wall, from: [0, 1.2, 0], delay: .38, span: .3 }, { mesh: plenum, from: [0, 2.2, 0], delay: .5, span: .3 }, { mesh: head, from: [0, 1.6, 0], delay: .55, span: .3 }]);
  const labels = [[`300 mm wafer on the susceptor`, [0, -.55, WR + .4], .15], [`${G.gap_mm} mm wafer-to-inlet gap`, [WR + .7, gap / 2, .6], .45], ['sidewall exhaust slit', [WR + 1.3, .45, -.6], .4], ['showerhead inlet: 10 mm → 150 mm', [0, gap + 1.0, .8], .7]];
  const labs = labels.map(([t, p, d]) => { const s = Viz.label(v, t, p, { px: 20, scale: .09 }); s.userData.d = d; return s; });
  const cls = () => { v.pal && head.material.color.set(v.pal.blue); };
  v.update = vv => { ex.draw(vv.p); const w = G.inlet_before_mm + (G.inlet_after_mm - G.inlet_before_mm) * Math.max(0, Math.min(1, (vv.p - .78) / .2)); const r = w / 2 * SC; head.scale.set(r / (G.inlet_before_mm / 2 * SC), 1, r / (G.inlet_before_mm / 2 * SC)); labs.forEach(l => l.material.opacity = Math.max(0, (vv.p - l.userData.d - .15) * 4)); labs[3].material.opacity *= 1; return false; };
  v.hover = () => null; cls();
  v.spin = .1; v.tilt = .25;
}, { camera: [0, 2.2, 7.4], target: [0, .4, 0], fov: 34 });

/* ---------- 2. the three profiles ---------- */
Viz.view('[data-viz="profiles"]', v => {
  const P = D.profiles; const keys = [['before', 'rose'], ['after', 'warm'], ['optimum', 'green']];
  const ymax = Math.max(...keys.flatMap(([k]) => P[k].rc.map(p => p[1] / P[k].c_mean)));
  const A = Viz.axes(v, { size: [4.4, 2.2, 2.0], x: { lo: 0, hi: 150, ticks: [0, 50, 100, 150], label: 'wafer radius, mm' }, y: { lo: 0, hi: ymax, ticks: [0, 1, 2, 4, 6], fmt: t => `${t}×`, label: 'c / mean' }, z: { lo: -.5, hi: 2.5, ticks: [] } });
  const rbs = keys.map(([k, col], i) => { const rc = P[k].rc; const rb = Viz.ribbon(v, A, rc.map(p => p[0]), rc.map(p => p[1] / P[k].c_mean), { color: col, width: .26, z: i, name: P[k].label, unit: '' }); rb.mesh.userData.key = k; const lab = Viz.label(v, `${P[k].label}\nσ = ${P[k].sigma} %`, [A.map(155, 0, i).x + .6, A.map(0, rc[rc.length - 1][1] / P[k].c_mean).y + .25, A.map(0, 0, i).z], { px: 20, scale: .085, color: col, weight: 700 }); return { rb, lab }; });
  const mean = Viz.line(v, [[A.map(0, 1, -.5).x, A.map(0, 1).y, A.map(0, 0, -.5).z], [A.map(150, 1, -.5).x, A.map(0, 1).y, A.map(0, 0, 2.5).z]], 'muted');
  v.update = vv => { rbs.forEach((r, i) => { const p = Math.max(0, Math.min(1, vv.p * 1.3 - i * .12)); r.rb.draw(p); r.lab.material.opacity = p > .95 ? 1 : 0; }); return false; };
  v.hover = hit => { const k = hit.object.userData.key; if (!k) return null; const i = Viz.ribbonIndex(hit, A); const rc = P[k].rc; return `<b>${P[k].label}</b>r = ${f(rc[i][0])} mm: c / mean = ${f(rc[i][1] / P[k].c_mean, 2)} · σ ${P[k].sigma} %, coverage ${P[k].coverage_pct} %`; };
  v.rot = -.35; v.tilt = .12;
}, { camera: [0, 2.0, 7.4], target: [0, -.1, 0], fov: 32 });

/* ---------- 3. the DOE runs, stacked by velocity ---------- */
const doeView = Viz.view('[data-viz="doe"]', v => {
  const runs = [...D.doe].sort((a, b) => a.u - b.u || a.T - b.T); const us = [...new Set(runs.map(r => r.u))].sort((a, b) => a - b);
  const norm = rc => { const m = rc.reduce((a, p) => a + p[1], 0) / rc.length; return rc.map(p => [p[0], p[1] / m]); };
  const A = Viz.axes(v, { size: [3.6, 2.0, 3.4], x: { lo: 0, hi: 150, ticks: [0, 75, 150], label: 'radius, mm' }, y: { lo: 0, hi: 1.6, ticks: [0, 1], fmt: t => `${t}×`, label: 'c / mean' }, z: { lo: -.5, hi: us.length - .5, ticks: [] } });
  const Tcol = { 900: 'cyan', 1000: 'green', 1100: 'warm' };
  const rbs = runs.map(r => { const rc = norm(r.rc); const z = us.indexOf(r.u) + (r.T - 1000) / 100 * .28; const rb = Viz.ribbon(v, A, rc.map(p => p[0]), rc.map(p => p[1]), { color: Tcol[r.T] || 'green', width: .14, z, name: `${r.u} m/s, ${r.T} K`, skirt: false }); rb.mesh.userData.run = r; return { rb, r }; });
  us.forEach((u, i) => Viz.label(v, `${u} m/s`, [A.map(160, 0, i).x + .2, A.map(0, 0).y + .05, A.map(0, 0, i).z], { px: 19, scale: .08, bg: false }));
  const title = Viz.label(v, '14 runs · colour: 900 / 1000 / 1100 K', [0, A.map(0, 1.6).y + .3, A.map(0, 0, -.5).z], { px: 20, scale: .085, bg: false, color: 'ink', weight: 700 });
  v.sel = null;
  v.update = vv => { rbs.forEach(({ rb, r }) => { rb.draw(vv.p); const on = !vv.sel || (Math.abs(r.u - vv.sel[0]) < 1e-6 && (vv.sel[1] === null || r.T === vv.sel[1])); rb.mesh.material.opacity = on ? 1 : .18; rb.mesh.material.transparent = true; rb.mesh.material.emissiveIntensity = on ? .45 : .05; }); return false; };
  v.hover = hit => { const r = hit.object.userData.run; if (!r) return null; return `<b>u = ${r.u} m/s, T = ${r.T} K</b>σ = ${r.sigma} % · ${r.file}`; };
  v.rot = -.55; v.tilt = .18;
}, { camera: [0, 2.6, 8.0], target: [0, -.2, 0], fov: 32 });
document.addEventListener('cvd-step', e => { if (doeView) { const [u, T] = e.detail.split('|'); doeView.sel = [+u, T === '*' ? null : +T]; doeView.dirty = true; } });

/* ---------- 4. response: sigma against velocity at three temperatures ---------- */
Viz.view('[data-viz="response"]', v => {
  const Ts = [900, 1000, 1100], cols = ['cyan', 'green', 'warm']; const lg = Math.log10;
  const A = Viz.axes(v, { size: [4.4, 2.2, 1.8], x: { lo: lg(.02), hi: lg(.2), ticks: [lg(.02), lg(.05), lg(.1), lg(.2)], fmt: t => `${+Math.pow(10, t).toFixed(3)}`, label: 'inlet velocity, m/s (log)' }, y: { lo: 0, hi: 17, ticks: [0, 5, 10, 15], label: 'σ, %' }, z: { lo: -.5, hi: 2.5, ticks: [] } });
  const sets = Ts.map((T, i) => { const pts = D.doe.filter(r => r.T === T).sort((a, b) => a.u - b.u); if (pts.length < 2) return null; const rb = Viz.ribbon(v, A, pts.map(r => lg(r.u)), pts.map(r => r.sigma), { color: cols[i], width: .2, z: i, name: `${T} K`, unit: '%' }); rb.mesh.userData.pts = pts; pts.forEach(r => { const p = A.map(lg(r.u), r.sigma, i); const m = new THREE.Mesh(new THREE.SphereGeometry(.05, 12, 10), Viz.mat(cols[i], { emissive: cols[i], emissiveIntensity: .6 })); m.position.copy(p); v.rig.add(m); }); const lab = Viz.label(v, `${T} K`, [A.map(lg(.22), 0, i).x + .2, A.map(0, pts[pts.length - 1].sigma).y + .1, A.map(0, 0, i).z], { px: 20, scale: .085, color: cols[i], weight: 700 }); return { rb, lab }; }).filter(Boolean);
  const opt = D.doe.reduce((a, r) => r.sigma < a.sigma ? r : a); const P = A.map(lg(opt.u), opt.sigma, Ts.indexOf(opt.T)); const tag = Viz.label(v, `optimum ${opt.sigma} % at ${opt.u} m/s`, [P.x, P.y + .45, P.z], { px: 22, scale: .095, color: 'ink', weight: 700 });
  v.update = vv => { sets.forEach((s, i) => { const p = Math.max(0, Math.min(1, vv.p * 1.3 - i * .1)); s.rb.draw(p); s.lab.material.opacity = p > .95 ? 1 : 0; }); tag.material.opacity = Math.max(0, vv.p * 2 - 1); return false; };
  v.hover = hit => { const pts = hit.object.userData.pts; if (!pts) return null; const i = Viz.ribbonIndex(hit, A); const r = pts[Math.min(pts.length - 1, Math.round(i))]; return `<b>u = ${r.u} m/s, T = ${r.T} K</b>σ = ${r.sigma} %`; };
  v.rot = -.3; v.tilt = .1;
}, { camera: [0, 2.0, 7.2], target: [0, -.1, 0], fov: 32 });

/* ---------- 5. architectures and sensitivity checks ---------- */
Viz.view('[data-viz="checks"]', v => {
  const P = D.profiles; const items = [['optimum', 'full span, 0.07 m/s', 'green'], ['twozone_equal_area', 'two zones, equal-area split, 0.05 / 0.05', 'green'], ['twozone_eqarea_07_03', 'equal-area split, 0.07 / 0.03', 'warm'], ['twozone_80mm', 'split at r = 80 mm, matched flow', 'rose'], ['gap30', '30 mm gap', 'cyan'], ['gap10', '10 mm gap', 'warm'], ['p05atm', '0.5 atm at 0.05 m/s', 'cyan'], ['rdr', 'rotating disk, 500 rpm', 'rose']].filter(([k]) => P[k]);
  const A = Viz.axes(v, { size: [4.6, 2.2, 1.2], x: { lo: -.5, hi: items.length - .5, ticks: [] }, y: { lo: 0, hi: 26, ticks: [0, 5, 10, 15, 20, 25], label: 'σ, %' }, z: { lo: -.5, hi: .5, ticks: [] } });
  const bars = items.map(([k, name, col], i) => ({ x: i, z: 0, y: P[k].sigma, color: col, name, key: k }));
  const B = Viz.bars(v, A, bars, { width: .5, depth: .5 });
  bars.forEach((b, i) => { const p = A.map(i, b.y, 0); b.lab = Viz.label(v, `${P[b.key].sigma} %`, [p.x, p.y + .18, p.z], { px: 19, scale: .085 }); b.nm = Viz.label(v, b.name.replace(', ', ',\n'), [p.x, A.map(0, 0).y - .32, .45], { px: 17, scale: .075, bg: false }); });
  v.update = vv => { B.draw(vv.p); bars.forEach(b => b.lab.material.opacity = Math.max(0, vv.p * 2 - 1)); return false; };
  v.hover = hit => { const b = bars[hit.instanceId]; return b ? `<b>${P[b.key].label}</b>σ = ${P[b.key].sigma} %, coverage ${P[b.key].coverage_pct} % · ${P[b.key].file}` : null; };
  v.rot = -.25; v.tilt = .12;
}, { camera: [0, 2.0, 7.6], target: [0, -.2, 0], fov: 32 });
