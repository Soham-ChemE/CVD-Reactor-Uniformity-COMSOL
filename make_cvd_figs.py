"""Figures for the CVD reactor repository, computed directly from the COMSOL exports in data/."""
import os, glob, json, re, numpy as np, matplotlib
matplotlib.use("Agg"); import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Polygon
from matplotlib import font_manager as fm
FONT = "Avenir Next" if "Avenir Next" in {f.name for f in fm.fontManager.ttflist} else "Helvetica Neue"
plt.rcParams.update({"font.family": FONT, "font.size": 12, "axes.titlesize": 13, "axes.labelsize": 12, "legend.fontsize": 10.5, "savefig.dpi": 200, "mathtext.fontset": "custom", "mathtext.rm": FONT, "mathtext.it": FONT + ":italic", "mathtext.bf": FONT + ":bold"})
SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data"); OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "figures") + "/"; os.makedirs(OUT, exist_ok=True)
R_TRIM, WAFER_R = 0.138, 0.150
C = {"bad": "#e5484d", "mid": "#f5a524", "good": "#30a46c", "blue": "#3e63dd", "ink": "#0f172a", "muted": "#64748b", "cyan": "#0ea5c6"}
def load(p):
    d = np.loadtxt(p, comments="%", delimiter=","); r, c = d[:, 0], d[:, 1]; m = r <= R_TRIM; o = np.argsort(r[m]); return r[m][o], c[m][o]
def sigma(c): return c.std(ddof=1) / c.mean() * 100
def cov(r, c):
    b = np.where(c < 0.1 * c.max())[0]; return (r[b[0]] if len(b) else r[-1]) / WAFER_R * 100
res = {}
def label(ax, s): ax.text(-0.08, 1.06, s, transform=ax.transAxes, fontsize=15, fontweight="bold", va="top")

# ---------- Fig 1: radial deposition profiles, baseline vs redesign ----------
runs = [("old_runs/run1_baseline_radial_profile.csv", "10 mm inlet (original), $u_{in}$ 0.1 m/s", C["bad"]),
        ("fullspan_baseline_u01_T1000_radial_profile.csv", "150 mm full-span inlet, $u_{in}$ 0.1 m/s", C["mid"]),
        ("fullspan_run12_u007_T1000_radial_profile.csv", "full-span, $u_{in}$ 0.07 m/s (2D optimum)", C["good"]),
        ("multizone_v2_ui005_uo005_T1000_radial_profile.csv", "two-zone, equal-area split, 0.05 / 0.05 m/s", C["blue"])]
fig, axes = plt.subplots(1, 2, figsize=(14, 5.2))
for f, lab, col in runs:
    r, c = load(os.path.join(SRC, f)); s = sigma(c); cv_ = cov(r, c); res[f] = {"sigma": s, "coverage": cv_}
    for ax, norm in [(axes[0], False), (axes[1], True)]:
        ax.plot(r * 1000, c / (c.mean() if norm else 1), color=col, lw=2.4, label=f"{lab}   σ = {s:.1f}%")
axes[0].set_yscale("log"); axes[0].set_ylabel("precursor concentration at wafer (mol m$^{-3}$, log)"); axes[0].set_xlabel("radius (mm)"); axes[0].set_title("Absolute profiles: the original inlet starves the outer wafer", fontsize=12); axes[0].legend(fontsize=9.5); label(axes[0], "(a)")
axes[1].set_ylabel("concentration / mean"); axes[1].set_xlabel("radius (mm)"); axes[1].set_ylim(0.6, 1.4); axes[1].axhspan(0.97, 1.03, color=C["good"], alpha=0.08); axes[1].text(2, 1.035, "±3% band (undoped poly-Si spec)", fontsize=9.5, color=C["good"]); axes[1].set_title("Normalised: redesigned inlets sit inside the spec band", fontsize=12); axes[1].legend(fontsize=9.5, loc="upper left"); label(axes[1], "(b)")
for ax in axes: ax.axvline(138, color="grey", ls=":", lw=1); ax.set_xlim(0, 150)
fig.tight_layout(); fig.savefig(OUT + "fig1_radial_profiles.png"); plt.close(fig)

# ---------- Fig 2: DOE response, sigma over (u_in, T) ----------
FILE_MAP = {"fullspan_baseline_u0125_T1000": (0.125, 1000), "fullspan_baseline_u01_T1000": (0.1, 1000), "fullspan_recovery_check_u005_T1000": (0.05, 1000), "fullspan_run10_u002_T1000": (0.02, 1000), "fullspan_run11_u0035_T1000": (0.035, 1000), "fullspan_run12_u007_T1000": (0.07, 1000), "fullspan_run1_u005_T900": (0.05, 900), "fullspan_run2_u005_T1100": (0.05, 1100), "fullspan_run3_u02_T900": (0.2, 900), "fullspan_run4_u02_T1100": (0.2, 1100), "fullspan_run6_u005_T1000": (0.05, 1000), "fullspan_run7_u02_T1000": (0.2, 1000), "fullspan_run8_u0125_T900": (0.125, 900), "fullspan_run9_u0125_T1100": (0.125, 1100)}
pts = []
for k, (u, T) in FILE_MAP.items():
    r, c = load(os.path.join(SRC, k + "_radial_profile.csv")); pts.append((u, T, sigma(c)))
pts = np.array(pts); res["doe"] = pts.tolist()
fig, axes = plt.subplots(1, 2, figsize=(14, 5.2))
sc = axes[0].scatter(pts[:, 0], pts[:, 1], c=pts[:, 2], cmap="RdYlGn_r", s=260, edgecolors="k", vmin=3, vmax=16, zorder=3)
for u, T, s in pts: axes[0].annotate(f"{s:.1f}", (u, T), ha="center", va="center", fontsize=9, fontweight="bold", color="white" if s > 9 or s < 4.5 else "black", zorder=4)
plt.colorbar(sc, ax=axes[0], label="σ (%) of wafer-plane concentration"); axes[0].set_xlabel("inlet velocity $u_{in}$ (m/s)"); axes[0].set_ylabel("wafer temperature (K)"); axes[0].set_title("Face-centred CCD on the full-span geometry: σ is set by $u_{in}$, not T", fontsize=12); axes[0].set_ylim(870, 1130); label(axes[0], "(a)")
o = np.argsort(pts[:, 0]); us = pts[o, 0]; ss = pts[o, 2]
for T, col, mk in [(900, C["blue"], "s"), (1000, C["good"], "o"), (1100, C["bad"], "^")]:
    m = pts[:, 1] == T; oo = np.argsort(pts[m, 0]); axes[1].plot(pts[m, 0][oo], pts[m, 2][oo], marker=mk, color=col, lw=2, ms=8, label=f"T = {T} K")
axes[1].axhline(3.0, color="grey", ls="--", lw=1); axes[1].text(0.15, 3.3, "3% spec (undoped poly-Si)", fontsize=9.5, color="grey"); axes[1].set_xlabel("inlet velocity $u_{in}$ (m/s)"); axes[1].set_ylabel("σ (%)"); axes[1].legend(); axes[1].set_title("Uniformity vs inlet velocity: minimum near 0.05 to 0.07 m/s", fontsize=12); label(axes[1], "(b)")
fig.tight_layout(); fig.savefig(OUT + "fig2_doe_response.png"); plt.close(fig)

# ---------- Fig 3: inlet architecture and geometry sensitivity ----------
arch = [("old_runs/run1_baseline_radial_profile.csv", "10 mm inlet\n(original)"), ("fullspan_baseline_u01_T1000_radial_profile.csv", "150 mm\nfull-span"), ("splitradius_80mm_matched_flow_T1000_radial_profile.csv", "two-zone,\ninward split\nr = 80 mm"), ("splitradius_80mm_ui007_uo003_T1000_radial_profile.csv", "two-zone,\nr = 80 mm\n0.07 / 0.03"), ("multizone_run2_ui007_uo003_T1000_radial_profile.csv", "two-zone,\nequal-area\n0.07 / 0.03"), ("multizone_v2_ui005_uo005_T1000_radial_profile.csv", "two-zone,\nequal-area\n0.05 / 0.05"), ("fullspan_run12_u007_T1000_radial_profile.csv", "full-span\n0.07 m/s")]
geo = [("fullspan_h10mm_u01_T1000_radial_profile.csv", "gap 10 mm"), ("fullspan_baseline_u01_T1000_radial_profile.csv", "gap 20 mm\n(baseline)"), ("fullspan_h30mm_u01_T1000_radial_profile.csv", "gap 30 mm"), ("fullspan_pressure05atm_u005_T1000_radial_profile.csv", "0.5 atm,\n0.05 m/s"), ("fullspan_run6_u005_T1000_radial_profile.csv", "1 atm,\n0.05 m/s"), ("rdr_500rpm_8layers_radial_profile.csv", "rotating disk\n500 rpm")]
fig, axes = plt.subplots(1, 2, figsize=(14, 5.4), gridspec_kw={"width_ratios": [1.25, 1]})
for ax, lst, ttl, lab in [(axes[0], arch, "Inlet architecture (all at 1000 K, matched or stated flows)", "(a)"), (axes[1], geo, "Geometry, pressure and reactor-class checks", "(b)")]:
    vals = []
    for f, name in lst: r, c = load(os.path.join(SRC, f)); vals.append(sigma(c)); res[f] = {"sigma": vals[-1], "coverage": cov(r, c)}
    cols = [C["good"] if v < 5 else C["mid"] if v < 12 else C["bad"] for v in vals]
    ax.bar(range(len(vals)), vals, color=cols, edgecolor="k", width=0.65); ax.set_yscale("log"); ax.set_ylim(1, 400)
    for i, v in enumerate(vals): ax.text(i, v * 1.15, f"{v:.1f}%", ha="center", fontsize=10.5, fontweight="bold")
    ax.set_xticks(range(len(vals))); ax.set_xticklabels([n for _, n in lst], fontsize=9); ax.set_ylabel("σ (%) of wafer-plane concentration, log"); ax.axhline(3, color="grey", ls="--", lw=1); ax.set_title(ttl, fontsize=12); label(ax, lab)
fig.tight_layout(); fig.savefig(OUT + "fig3_architecture_sensitivity.png"); plt.close(fig)

# ---------- Fig 4: 3D wafer surface map ----------
d3 = np.loadtxt(os.path.join(SRC, "wafer_3D_radial_profile.csv"), comments="%", delimiter=","); x, y, c3 = d3[:, 0], d3[:, 1], d3[:, 2]; r3 = np.hypot(x, y)
s_full = c3.std(ddof=1) / c3.mean() * 100; m5 = r3 <= WAFER_R - 0.005; s_trim = c3[m5].std(ddof=1) / c3[m5].mean() * 100; res["3D"] = {"sigma_full": s_full, "sigma_trim5mm": s_trim, "nodes": int(len(c3))}
fig, axes = plt.subplots(1, 2, figsize=(14, 5.6), gridspec_kw={"width_ratios": [1, 1.1]})
tc = axes[0].tricontourf(x * 1000, y * 1000, c3 / c3.mean(), levels=24, cmap="viridis"); plt.colorbar(tc, ax=axes[0], label="concentration / mean"); axes[0].set_aspect("equal"); axes[0].set_xlabel("x (mm)"); axes[0].set_ylabel("y (mm)"); axes[0].set_title(f"      3D reactor with three asymmetric exhaust ports: wafer-face map\n      σ = {s_full:.1f}% full face, {s_trim:.1f}% excluding a 5 mm rim ({len(c3):,} nodes)", fontsize=11, loc="left"); label(axes[0], "(a)")
th = np.degrees(np.arctan2(y, x)); mr = (r3 > 0.09) & (r3 < 0.13)
axes[1].scatter(th[mr], c3[mr] / c3.mean(), s=6, alpha=0.5, color=C["blue"]); axes[1].set_xlabel("azimuth (degrees)"); axes[1].set_ylabel("concentration / mean, 90 < r < 130 mm"); axes[1].set_title("Azimuthal variation the 2D axisymmetric model cannot see", fontsize=12); label(axes[1], "(b)")
fig.tight_layout(); fig.savefig(OUT + "fig4_3d_wafer_map.png"); plt.close(fig)

# ---------- Fig 5: surrogate + Monte Carlo Cpk (re-implementation of real_cpk_pipeline_v4 for plotting) ----------
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF, WhiteKernel, ConstantKernel
from sklearn.preprocessing import StandardScaler, PolynomialFeatures
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import LeaveOneOut
from sklearn.metrics import r2_score
np.random.seed(42); X = pts[:, :2]; yv = pts[:, 2]; sc_ = StandardScaler(); Xs = sc_.fit_transform(X)
kernel = ConstantKernel(1.0, (1e-2, 1e3)) * RBF([1.0, 1.0], (1e-1, 1e2)) + WhiteKernel(1e-2, (1e-5, 1e1))
yp_gp = np.zeros_like(yv); yp_poly = np.zeros_like(yv); poly = PolynomialFeatures(2)
for tr, te in LeaveOneOut().split(Xs):
    gp = GaussianProcessRegressor(kernel=kernel, n_restarts_optimizer=5, normalize_y=True, random_state=42).fit(Xs[tr], yv[tr]); yp_gp[te] = gp.predict(Xs[te])
    lr = LinearRegression().fit(poly.fit_transform(Xs[tr]), yv[tr]); yp_poly[te] = lr.predict(poly.transform(Xs[te]))
r2g, r2p = r2_score(yv, yp_gp), r2_score(yv, yp_poly); res["surrogate"] = {"gp_loo_r2": r2g, "poly_loo_r2": r2p}
gp = GaussianProcessRegressor(kernel=kernel, n_restarts_optimizer=10, normalize_y=True, random_state=42).fit(Xs, yv)
u_mc = np.random.normal(0.06, 0.06 * 0.01, 10000); T_mc = np.random.normal(1000, 5.5, 10000); s_mc = gp.predict(sc_.transform(np.column_stack([u_mc, T_mc]))); mu, sd = s_mc.mean(), s_mc.std()
res["mc"] = {"mean": mu, "std": sd, "cpk": {k: (usl - mu) / (3 * sd) for k, usl in [("3.0", 3.0), ("5.5", 5.5), ("10.0", 10.0)]}}
fig, axes = plt.subplots(1, 2, figsize=(14, 5.2))
axes[0].scatter(yv, yp_gp, s=90, color=C["good"], edgecolors="k", label=f"Gaussian process, LOO $R^2$ = {r2g:.3f}", zorder=3); axes[0].scatter(yv, yp_poly, s=70, marker="s", color=C["mid"], edgecolors="k", label=f"2nd-order polynomial, LOO $R^2$ = {r2p:.3f}", zorder=3)
lim = [0, max(yv.max(), yp_poly.max()) * 1.1]; axes[0].plot(lim, lim, "k--", lw=1); axes[0].set_xlabel("COMSOL σ (%)"); axes[0].set_ylabel("surrogate prediction, held-out (%)"); axes[0].legend(); axes[0].set_title("Surrogate validation by leave-one-out over the 14 DOE runs", fontsize=12); label(axes[0], "(a)")
axes[1].hist(s_mc, bins=60, color=C["blue"], alpha=0.8, edgecolor="none"); axes[1].axvline(3.0, color=C["bad"], lw=2, ls="--", label="USL 3% (undoped poly-Si, LPCVD facility spec)"); axes[1].set_xlabel("predicted σ (%) at $u_{in}$ = 0.06 m/s, T = 1000 K"); axes[1].set_ylabel("count (10,000 Monte Carlo draws)"); axes[1].legend(fontsize=9.5); axes[1].set_title(f"Propagated MFC (±1%) and thermocouple (±5.5 K) tolerances\nmean σ = {mu:.2f}%, spread = {sd:.3f}%: sits above the 3% limit, far inside 5.5% and 10%", fontsize=11); label(axes[1], "(b)")
fig.tight_layout(); fig.savefig(OUT + "fig5_surrogate_cpk.png"); plt.close(fig)

# ---------- Fig 6: temperature field export (if present) ----------
tf = os.path.join(SRC, "fullspan_baseline_u01_T1000_temperature.csv")
try:
    dt = np.loadtxt(tf, comments="%", delimiter=",")
    if dt.shape[1] >= 3:
        fig, ax = plt.subplots(figsize=(9, 4.5)); tc = ax.tricontourf(dt[:, 0] * 1000, dt[:, 1] * 1000, dt[:, 2], levels=30, cmap="inferno"); plt.colorbar(tc, ax=ax, label="T (K)"); ax.set_aspect("equal"); ax.set_xlabel("r (mm)"); ax.set_ylabel("z (mm)"); ax.set_title("Gas temperature field, full-span inlet, wafer at 1000 K", fontsize=12); fig.tight_layout(); fig.savefig(OUT + "fig6_temperature_field.png"); plt.close(fig); res["temperature_field"] = True
except Exception as e: res["temperature_field"] = str(e)

# ---------- hero banner ----------
bg = "#0b1220"; fig = plt.figure(figsize=(16, 5.5), dpi=100, facecolor=bg); ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(0, 160); ax.set_ylim(0, 55); ax.axis("off")
for gx in range(0, 161, 8): ax.plot([gx, gx], [0, 55], color="#152037", lw=0.6, zorder=0)
for gy in range(0, 56, 8): ax.plot([0, 160], [gy, gy], color="#152037", lw=0.6, zorder=0)
ax.text(8, 47, "SEMICONDUCTOR PROCESS MODELLING  ·  COMSOL MULTIPHYSICS 6.4", fontsize=11, color="#22d3ee", fontweight="bold", va="center")
ax.text(8, 38, "CVD Reactor Uniformity", fontsize=46, fontweight="bold", color="white", va="center")
ax.text(8, 29.5, "Inlet redesign, DOE and process-capability analysis for poly-Si deposition on a 300 mm wafer", fontsize=15.5, color="#c9d4e2", va="center")
ax.plot([8, 27], [25.6, 25.6], color="#22d3ee", lw=3)
kp = [(f"{res['old_runs/run1_baseline_radial_profile.csv']['sigma']:.0f}% to {res['fullspan_run12_u007_T1000_radial_profile.csv']['sigma']:.1f}%", "non-uniformity, before / after", 30), (f"{res['fullspan_baseline_u01_T1000_radial_profile.csv']['coverage']:.0f}%", "wafer coverage (was 17%)", 22), (f"$R^2$ {r2g:.2f}", "GP surrogate, LOO", 20), ("14-run CCD", "u_in and T decoupled", 24)]
x = 8
for big, small, w in kp:
    ax.add_patch(FancyBboxPatch((x, 5), w, 12, boxstyle="round,pad=0,rounding_size=1.2", facecolor="#111a2e", edgecolor="#243147", lw=1.4)); ax.text(x + 1.6, 13, big, fontsize=15, fontweight="bold", color="white", va="center"); ax.text(x + 1.6, 8.3, small, fontsize=9, color="#9fb0c3", va="center", family="Menlo"); x += w + 2
# right: mini profile plot inset
ins = fig.add_axes([0.715, 0.30, 0.26, 0.52]); ins.set_facecolor("#111a2e")
for f, lab, col in runs[:3]:
    r, c = load(os.path.join(SRC, f)); ins.plot(r * 1000, c / c.mean(), color=col, lw=2.2)
ins.set_ylim(0, 2.6); ins.set_xlim(0, 140); ins.tick_params(colors="#9fb0c3", labelsize=8); [s.set_color("#243147") for s in ins.spines.values()]; ins.set_xlabel("radius (mm)", color="#9fb0c3", fontsize=9); ins.set_ylabel("c / mean", color="#9fb0c3", fontsize=9); ins.set_title("wafer-plane profile: original (red), full-span (amber), optimum (green)", color="#c9d4e2", fontsize=9)
fig.savefig(OUT + "../hero_cvd.png", dpi=100, facecolor=bg); plt.close(fig)
json.dump(res, open(OUT + "../cvd_results.json", "w"), indent=1, default=float); print(json.dumps({k: v for k, v in res.items() if k in ["3D", "surrogate", "mc"]}, indent=1, default=float)); print("figures done")
