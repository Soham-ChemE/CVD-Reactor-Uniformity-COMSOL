"""Build every asset used by docs/index.html and the README hero from the COMSOL exports in data/.

Uses the same sigma (coefficient of variation, r <= 138 mm, ddof = 1) and coverage (radius where c first
falls below 10 % of its peak) definitions as analysis/full_analysis.py, the same surface statistic as
analysis/wafer_3D_sigma.py, and the surrogate / Monte Carlo numbers written by analysis/real_cpk_pipeline_v4.py
into cvd_results.json.

Writes:
  docs/assets/data.js                  window.CVD = {...} (classic script, works from file://)
  docs/assets/fig_*_{dark,light}.svg   page figures
  docs/assets/social-preview.png       1280x640
Run from the repository root:  python docs/build_assets.py
"""
import json, os, glob
import numpy as np
from scipy.spatial import Delaunay
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import tri as mtri

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data"); OUT = os.path.join(ROOT, "docs", "assets"); os.makedirs(OUT, exist_ok=True)
R_TRIM, WAFER_R = 0.138, 0.150

def load(path):
    d = np.loadtxt(path, comments="%", delimiter=","); r, c = d[:, 0], d[:, 1]; m = r <= R_TRIM; o = np.argsort(r[m]); return r[m][o], c[m][o]
def sigma_cv(c): return float(c.std(ddof=1) / c.mean() * 100)
def coverage_radius(r, c, f=0.10):
    below = np.where(c < f * c.max())[0]; return float(r[below[0]] if len(below) else r[-1])
def thin(r, c, n=90):
    idx = np.unique(np.linspace(0, len(r) - 1, n).astype(int)); return [[round(float(r[i]) * 1000, 2), round(float(c[i]), 5)] for i in idx]

RUNS = {"before": ("old_runs/run1_baseline_radial_profile.csv", "10 mm central inlet, u 0.10 m/s"),
        "after": ("fullspan_baseline_u01_T1000_radial_profile.csv", "150 mm full-span inlet, u 0.10 m/s"),
        "optimum": ("fullspan_run12_u007_T1000_radial_profile.csv", "full-span inlet, u 0.07 m/s"),
        "twozone_equal_area": ("multizone_v2_ui005_uo005_T1000_radial_profile.csv", "two zones split at the equal-area radius, 0.05 / 0.05 m/s"),
        "twozone_80mm": ("splitradius_80mm_matched_flow_T1000_radial_profile.csv", "two zones split at r = 80 mm, matched flow"),
        "twozone_eqarea_07_03": ("multizone_run2_ui007_uo003_T1000_radial_profile.csv", "equal-area split, 0.07 / 0.03 m/s"),
        "gap10": ("fullspan_h10mm_u01_T1000_radial_profile.csv", "10 mm gap"), "gap30": ("fullspan_h30mm_u01_T1000_radial_profile.csv", "30 mm gap"),
        "p05atm": ("fullspan_pressure05atm_u005_T1000_radial_profile.csv", "0.5 atm, u 0.05 m/s"), "rdr": ("rdr_500rpm_8layers_radial_profile.csv", "rotating disk, 500 rpm")}
profiles = {}
for k, (f, lab) in RUNS.items():
    r, c = load(os.path.join(DATA, f)); cov = coverage_radius(r, c)
    profiles[k] = {"file": f, "label": lab, "sigma": round(sigma_cv(c), 2), "coverage_pct": round(cov / WAFER_R * 100, 1), "coverage_mm": round(cov * 1000, 1),
                   "c_mean": float(c.mean()), "rc": thin(r, c / c.mean())}
assert abs(profiles["before"]["sigma"] - 179.6) < 0.1 and abs(profiles["optimum"]["sigma"] - 3.3) < 0.1, profiles["before"]["sigma"]

# DOE runs: (u, T) -> file
DOE = [(0.05, 900, "fullspan_run1_u005_T900"), (0.05, 1100, "fullspan_run2_u005_T1100"), (0.2, 900, "fullspan_run3_u02_T900"), (0.2, 1100, "fullspan_run4_u02_T1100"),
       (0.125, 1000, "fullspan_baseline_u0125_T1000"), (0.05, 1000, "fullspan_run6_u005_T1000"), (0.2, 1000, "fullspan_run7_u02_T1000"), (0.125, 900, "fullspan_run8_u0125_T900"),
       (0.125, 1100, "fullspan_run9_u0125_T1100"), (0.1, 1000, "fullspan_baseline_u01_T1000"), (0.02, 1000, "fullspan_run10_u002_T1000"), (0.035, 1000, "fullspan_run11_u0035_T1000"),
       (0.07, 1000, "fullspan_run12_u007_T1000"), (0.05, 1000, "fullspan_recovery_check_u005_T1000")]
doe = []
for u, T, f in DOE:
    r, c = load(os.path.join(DATA, f + "_radial_profile.csv")); doe.append({"u": u, "T": T, "sigma": round(sigma_cv(c), 2), "file": f, "rc": thin(r, c / c.mean(), 60)})
assert len(doe) == 14

# 3D wafer face
d3 = np.loadtxt(os.path.join(DATA, "wafer_3D_radial_profile.csv"), comments="%", delimiter=",")
x, y, c3 = d3[:, 0], d3[:, 1], d3[:, 2]; r3 = np.hypot(x, y)
sig_full = sigma_cv(c3); sig_trim = sigma_cv(c3[r3 <= WAFER_R - 0.005]); tri = Delaunay(np.c_[x, y])
simp = tri.simplices; cen = np.c_[x, y][simp].mean(1); simp = simp[np.hypot(cen[:, 0], cen[:, 1]) <= WAFER_R * 1.001]  # drop slivers outside the disc
wafer3d = {"x": [round(float(v) * 1000, 1) for v in x], "y": [round(float(v) * 1000, 1) for v in y], "c": [round(float(v), 4) for v in c3],
           "tri": [int(v) for v in simp.ravel()], "n": int(len(c3)), "sigma_full": round(sig_full, 2), "sigma_trim": round(sig_trim, 2), "c_mean": float(c3.mean())}

res = json.load(open(os.path.join(ROOT, "cvd_results.json")))
stats = {"sigma_before": profiles["before"]["sigma"], "sigma_after": profiles["after"]["sigma"], "sigma_opt": profiles["optimum"]["sigma"],
         "cov_before": profiles["before"]["coverage_pct"], "cov_after": profiles["after"]["coverage_pct"], "cov_before_mm": profiles["before"]["coverage_mm"],
         "gp_loo_r2": round(res["surrogate"]["gp_loo_r2"], 3), "poly_loo_r2": round(res["surrogate"]["poly_loo_r2"], 3),
         "mc_mean": round(res["mc"]["mean"], 2), "mc_std": round(res["mc"]["std"], 3), "mc_n": 10000, "mc_u": 0.06,
         "sigma3d_full": wafer3d["sigma_full"], "sigma3d_trim": wafer3d["sigma_trim"], "n_nodes": wafer3d["n"], "n_doe": len(doe),
         "da_original": 13, "utilisation_pct": 0.17, "spec_tight": 3.0, "spec_doped": 10.0}
data = {"profiles": profiles, "doe": doe, "wafer3d": wafer3d, "stats": stats, "geometry": {"wafer_mm": 300, "gap_mm": 20, "inlet_before_mm": 10, "inlet_after_mm": 150}}
with open(os.path.join(OUT, "data.js"), "w") as f:
    f.write("// Generated by docs/build_assets.py from the COMSOL exports in data/ and cvd_results.json. Do not edit by hand.\n")
    f.write("window.CVD = " + json.dumps(data, separators=(",", ":")) + ";\n")
print("data.js:", {k: stats[k] for k in ("sigma_before", "sigma_after", "sigma_opt", "cov_before", "cov_after", "gp_loo_r2", "mc_mean", "sigma3d_trim")}, "tris", len(simp))

# ---------------- figures ----------------
THEMES = {"dark": ("#e6edf3", "#8b98a9"), "light": ("#0b1220", "#5b6676")}; DARK = "#0b1220"
def style(ax, INK, MUTED):
    ax.set_facecolor("none")
    for s in ax.spines.values(): s.set_color(MUTED); s.set_linewidth(0.8)
    ax.tick_params(colors=INK, labelsize=9); ax.xaxis.label.set_color(INK); ax.yaxis.label.set_color(INK); ax.title.set_color(INK); ax.grid(True, color=MUTED, alpha=0.2, lw=0.6)
for THEME, (INK, MUTED) in THEMES.items():
    save = lambda fig, name: (fig.savefig(os.path.join(OUT, f"{name}_{THEME}.svg"), transparent=True, bbox_inches="tight"), plt.close(fig), print("wrote", name, THEME))
    fig, ax = plt.subplots(figsize=(6.6, 4.0)); style(ax, INK, MUTED)
    for k, col in [("before", "#f87171"), ("after", "#f59e0b"), ("optimum", "#34d399")]:
        p = profiles[k]; rr, cc = zip(*p["rc"]); ax.plot(rr, cc, color=col, lw=2.2, label=f"{p['label']}: σ = {p['sigma']:.1f} %")
    ax.set_xlabel("Wafer radius (mm)"); ax.set_ylabel("Precursor concentration / mean"); ax.set_xlim(0, 138); ax.legend(fontsize=8, frameon=False, labelcolor=INK); ax.set_title("Wafer-plane precursor profile, T_wafer = 1000 K", fontsize=9); save(fig, "fig_profiles")
    fig, ax = plt.subplots(figsize=(6.6, 3.8)); style(ax, INK, MUTED)
    for T, col in [(900, "#22d3ee"), (1000, "#f59e0b"), (1100, "#f87171")]:
        pts = sorted([(d["u"], d["sigma"]) for d in doe if d["T"] == T]); ax.plot([p[0] for p in pts], [p[1] for p in pts], "o-", color=col, lw=1.8, ms=6, label=f"T_wafer = {T} K")
    ax.set_xlabel("Inlet velocity u_in (m/s)"); ax.set_ylabel("σ (%)"); ax.set_xscale("log"); ax.legend(fontsize=8, frameon=False, labelcolor=INK); ax.set_title("14-run face-centred CCD: velocity sets σ, temperature barely moves it", fontsize=9); save(fig, "fig_doe")
    fig, ax = plt.subplots(figsize=(5.2, 4.6)); style(ax, INK, MUTED); ax.grid(False)
    T = mtri.Triangulation(x * 1000, y * 1000, simp); tc = ax.tripcolor(T, c3 / c3.mean(), shading="gouraud", cmap="viridis"); cb = plt.colorbar(tc, ax=ax); cb.set_label("c / mean", color=INK); cb.ax.tick_params(colors=INK); cb.outline.set_edgecolor(MUTED)
    ax.set_aspect("equal"); ax.set_xlabel("x (mm)"); ax.set_ylabel("y (mm)"); ax.set_title(f"3D model, three exhaust ports: CV {sig_full:.1f} % full face, {sig_trim:.1f} % excluding 5 mm rim", fontsize=8.5)
    fig.savefig(os.path.join(OUT, f"fig_wafer3d_{THEME}.png"), transparent=True, bbox_inches="tight", dpi=150); plt.close(fig); print("wrote fig_wafer3d", THEME, "(png: a gouraud mesh is 19 MB as SVG)")

fig = plt.figure(figsize=(12.8, 6.4), dpi=100); fig.patch.set_facecolor(DARK)
ax = fig.add_axes([0.55, 0.14, 0.42, 0.74]); ax.set_facecolor(DARK)
for k, col in [("before", "#f87171"), ("after", "#f59e0b"), ("optimum", "#34d399")]:
    rr, cc = zip(*profiles[k]["rc"]); ax.plot(rr, cc, color=col, lw=2.6, label=f"σ = {profiles[k]['sigma']:.1f} %")
for s in ax.spines.values(): s.set_color("#1f2a3c")
ax.tick_params(colors="#8b98a9"); ax.set_xlabel("wafer radius (mm)", color="#8b98a9"); ax.set_ylabel("c / mean", color="#8b98a9"); ax.legend(frameon=False, labelcolor="#e6edf3"); ax.set_xlim(0, 138)
fig.text(0.05, 0.74, "CVD reactor uniformity", color="#e6edf3", fontsize=38, fontweight="bold")
fig.text(0.05, 0.62, "COMSOL model of a 300 mm showerhead reactor:\ndiagnose, redesign the inlet, DOE, surrogate, capability", color="#e6edf3", fontsize=17, va="top")
fig.text(0.05, 0.36, f"Non-uniformity {stats['sigma_before']:.0f} % → {stats['sigma_opt']:.1f} %\nCoverage {stats['cov_before']:.0f} % → {stats['cov_after']:.0f} %\nGaussian-process surrogate, LOO R² {stats['gp_loo_r2']:.3f}", color="#22d3ee", fontsize=14, va="top")
fig.text(0.05, 0.10, "Soham Kavathekar  |  github.com/Soham-ChemE", color="#8b98a9", fontsize=12)
fig.savefig(os.path.join(OUT, "social-preview.png"), dpi=100, facecolor=DARK); plt.close(fig); print("wrote social-preview.png")

# ---------------- animated README hero (SVG with CSS keyframes; GitHub renders these through <img>) ----------------
# The wafer-plane profile cycles through the three measured states (10 mm inlet; full-span at 0.10 m/s; full-span at 0.07 m/s)
# by cross-fading three exported profiles, with the sigma readout changing in step. No SMIL, no scripts, no fonts.
PX, PY, PW, PH = 930, 70, 580, 360
def _x(r): return PX + min(r, 138) / 138 * PW
def _y(c): return PY + PH - min(c, 1.6) / 1.6 * PH
states = [("before", "10 mm inlet · 0.10 m/s", "#f87171"), ("after", "150 mm inlet · 0.10 m/s", "#f59e0b"), ("optimum", "150 mm inlet · 0.07 m/s", "#34d399")]
paths = ""; css = ""
for i, (k, lab, col) in enumerate(states):
    rc = profiles[k]["rc"]; d = "M " + " L ".join(f"{_x(r):.1f} {_y(c):.1f}" for r, c in rc)
    area = d + f" L {_x(rc[-1][0]):.1f} {PY + PH} L {_x(rc[0][0]):.1f} {PY + PH} Z"
    paths += f'<g class="pr p{i}"><path d="{area}" fill="{col}" opacity=".12"/><path d="{d}" fill="none" stroke="{col}" stroke-width="3.5" stroke-linejoin="round"/>'
    paths += f'<text class="t rd" x="{PX + 16}" y="{PY + 40}" fill="{col}">σ = {profiles[k]["sigma"]:.1f} %</text><text class="t rl" x="{PX + 16}" y="{PY + 62}">{lab} · coverage {profiles[k]["coverage_pct"]:.0f} %</text></g>'
    css += f".p{i}{{animation-delay:{i * 4:.0f}s}}\n"
lines = [("179.6 % → 3.3 %", "within-wafer non-uniformity, 10 mm inlet to full-span inlet at 0.07 m/s"), ("17 % → 92 %", "wafer coverage; the fix was the gas inlet, not the chemistry"),
         (f"{stats['n_doe']} COMSOL runs", "face-centred design over inlet velocity and wafer temperature"), (f"R² = {stats['gp_loo_r2']:.3f}", "leave-one-out, Gaussian-process surrogate on the 14 runs")]
stat_svg = "".join(f'<g class="st s{i}"><text x="80" y="268" class="big">{a}</text><text x="80" y="300" class="small">{b}</text></g>' for i, (a, b) in enumerate(lines))
svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 500" width="1600" height="500" role="img" aria-label="CVD reactor uniformity: the wafer-plane precursor profile cycling through the 10 mm inlet, the full-span inlet at 0.10 m/s and the full-span inlet at 0.07 m/s, with the non-uniformity readout, next to the headline numbers">
<style>
.t{{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}}
.h{{font-size:54px;font-weight:800;fill:#e6edf3;letter-spacing:-1.5px}}.sub{{font-size:21px;fill:#8b98a9}}.big{{font-size:34px;font-weight:800;fill:#22d3ee}}.small{{font-size:16px;fill:#8b98a9}}.foot{{font-size:15px;fill:#5b6676}}.ax{{font-size:13px;fill:#8b98a9}}.rd{{font-size:30px;font-weight:800}}.rl{{font-size:14px;fill:#8b98a9}}
.pr{{opacity:0;animation:cyc3 12s infinite}}
@keyframes cyc3{{0%{{opacity:0}}6%{{opacity:1}}30%{{opacity:1}}36%{{opacity:0}}100%{{opacity:0}}}}
{css}
.st{{opacity:0;animation:cycle 16s infinite}}.s1{{animation-delay:4s}}.s2{{animation-delay:8s}}.s3{{animation-delay:12s}}
@keyframes cycle{{0%,22%{{opacity:1}}25%,97%{{opacity:0}}100%{{opacity:1}}}}
@media (prefers-reduced-motion:reduce){{.pr,.st{{animation:none}}.p2,.s0{{opacity:1}}}}
</style>
<rect width="1600" height="500" fill="#0b1220"/>
<g class="t">
<text x="80" y="120" class="h">180 % non-uniform.</text><text x="80" y="178" class="h">Then 3.3 %.</text>
<text x="80" y="218" class="sub">COMSOL model of an atmospheric-pressure CVD reactor, poly-Si on a 300 mm wafer</text>
{stat_svg}
<text x="80" y="420" class="foot">Every number from the exported COMSOL wafer-plane profiles in the repository, in one command</text>
<text x="80" y="446" class="foot">Right: precursor concentration over its mean against wafer radius, three states · open the live page for the 3D reactor</text>
<rect x="{PX}" y="{PY}" width="{PW}" height="{PH}" fill="none" stroke="#1f2a3c"/>
<text x="{PX + PW / 2}" y="{PY + PH + 28}" class="ax" text-anchor="middle">wafer radius, 0 → 138 mm</text>
<text x="{PX - 12}" y="{PY + PH / 2}" class="ax" text-anchor="middle" transform="rotate(-90 {PX - 12} {PY + PH / 2})">concentration / mean, 0 → 1.6 (clipped)</text>
{paths}
</g>
</svg>"""
with open(os.path.join(OUT, "hero.svg"), "w", encoding="utf-8") as f: f.write(svg)
print("wrote hero.svg", os.path.getsize(os.path.join(OUT, "hero.svg")), "bytes")
