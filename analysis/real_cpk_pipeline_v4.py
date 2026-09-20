"""
Real Cpk pipeline v4 - correctly sourced spec limits, honest labeling
of what the Monte Carlo sigma actually represents.

SPEC SOURCE: University of Waterloo QNC LPCVD Poly-Si facility page,
fetched directly 2026-07-18:
  "Uniformity for a 300 nm polysilicon film should be 3% within wafer...
   Uniformity for a 300 nm doped Polysilicon film should be 10% within
   wafer..."
CAVEAT: that tool is LPCVD (not APCVD, different pressure regime) and
100mm wafers (not 300mm). Same chemistry family, not a perfect match -
state this explicitly whenever these specs are cited.

HONEST NOTE ON PROCESS SIGMA: COMSOL is a deterministic solver - the
same inputs always give the same outputs. There is no run-to-run
hardware variability to measure from repeated solves, unlike a real
fab process. The Monte Carlo sigma below reflects PROPAGATED INPUT
UNCERTAINTY (what happens if real MFC/thermocouple readings drift
within their spec) - not measured empirical process repeatability.
Label it that way; do not call it "process sigma" as if it came from
real repeated trials.
"""
import numpy as np
import os
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF, WhiteKernel, ConstantKernel
from sklearn.preprocessing import PolynomialFeatures, StandardScaler
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import LeaveOneOut
from sklearn.metrics import r2_score

np.random.seed(42)
R_TRIM = 0.138
FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")

FILE_MAP = {
    "fullspan_baseline_u0125_T1000_radial_profile.csv": (0.125, 1000),
    "fullspan_baseline_u01_T1000_radial_profile.csv":   (0.1,   1000),
    "fullspan_recovery_check_u005_T1000_radial_profile.csv": (0.05, 1000),
    "fullspan_run10_u002_T1000_radial_profile.csv":     (0.02,  1000),
    "fullspan_run11_u0035_T1000_radial_profile.csv":    (0.035, 1000),
    "fullspan_run12_u007_T1000_radial_profile.csv":     (0.07,  1000),
    "fullspan_run1_u005_T900_radial_profile.csv":       (0.05,  900),
    "fullspan_run2_u005_T1100_radial_profile.csv":      (0.05,  1100),
    "fullspan_run3_u02_T900_radial_profile.csv":        (0.2,   900),
    "fullspan_run4_u02_T1100_radial_profile.csv":       (0.2,   1100),
    "fullspan_run6_u005_T1000_radial_profile.csv":      (0.05,  1000),
    "fullspan_run7_u02_T1000_radial_profile.csv":       (0.2,   1000),
    "fullspan_run8_u0125_T900_radial_profile.csv":      (0.125, 900),
    "fullspan_run9_u0125_T1100_radial_profile.csv":     (0.125, 1100),
}

def load_sigma(path):
    data = np.loadtxt(path, comments='%', delimiter=',')
    r, c = data[:, 0], data[:, 1]
    mask = r <= R_TRIM
    c = c[mask]
    return (c.std(ddof=1) / c.mean()) * 100

rows = []
print("=" * 60)
print("STEP 1: Loading sigma with EXPLICIT (verified) u_in/T mapping")
print("=" * 60)
for fn, (u, T) in FILE_MAP.items():
    path = os.path.join(FOLDER, fn)
    if not os.path.exists(path):
        print(f"  MISSING FILE (skipped): {fn}")
        continue
    sigma = load_sigma(path)
    rows.append((u, T, sigma))
    print(f"  u_in={u:>6.3f}  T={T:>5.0f}K  ->  sigma={sigma:>6.2f}%")

X = np.array([[r[0], r[1]] for r in rows])
y = np.array([r[2] for r in rows])
print(f"\nTotal points: {len(rows)}\n")

scaler = StandardScaler()
X_s = scaler.fit_transform(X)
loo = LeaveOneOut()

poly = PolynomialFeatures(degree=2)
y_pred_poly = np.zeros_like(y)
for train_idx, test_idx in loo.split(X_s):
    Xp_train = poly.fit_transform(X_s[train_idx])
    Xp_test = poly.transform(X_s[test_idx])
    lr = LinearRegression().fit(Xp_train, y[train_idx])
    y_pred_poly[test_idx] = lr.predict(Xp_test)
r2_poly_loo = r2_score(y, y_pred_poly)

kernel = (ConstantKernel(1.0, (1e-2, 1e3))
          * RBF(length_scale=[1.0, 1.0], length_scale_bounds=(1e-1, 1e2))
          + WhiteKernel(1e-2, (1e-5, 1e1)))
y_pred_gp = np.zeros_like(y)
for train_idx, test_idx in loo.split(X_s):
    gp = GaussianProcessRegressor(kernel=kernel, n_restarts_optimizer=5,
                                   normalize_y=True, random_state=42)
    gp.fit(X_s[train_idx], y[train_idx])
    y_pred_gp[test_idx] = gp.predict(X_s[test_idx])
r2_gp_loo = r2_score(y, y_pred_gp)

print("=" * 60)
print("STEP 2-3: Leave-One-Out cross-validation")
print("=" * 60)
print(f"Polynomial LOO-CV R^2: {r2_poly_loo:.4f}")
print(f"Gaussian Process LOO-CV R^2: {r2_gp_loo:.4f}")

best_name = "Polynomial" if r2_poly_loo >= r2_gp_loo else "Gaussian Process"
print(f"Selected: {best_name}\n")

if best_name == "Polynomial":
    Xp_full = poly.fit_transform(X_s)
    final_model = LinearRegression().fit(Xp_full, y)
    def predict(X_new_s):
        return final_model.predict(poly.transform(X_new_s))
else:
    final_model = GaussianProcessRegressor(kernel=kernel, n_restarts_optimizer=10,
                                            normalize_y=True, random_state=42)
    final_model.fit(X_s, y)
    def predict(X_new_s):
        return final_model.predict(X_new_s)

TOL_U_PCT = 0.01
TOL_T_K = 5.5
n_mc = 10000
u_in_nom, T_nom = 0.06, 1000

u_in_mc = np.random.normal(u_in_nom, u_in_nom*TOL_U_PCT, n_mc)
T_mc = np.random.normal(T_nom, TOL_T_K, n_mc)
X_mc = np.column_stack([u_in_mc, T_mc])
X_mc_s = scaler.transform(X_mc)
sigma_mc = predict(X_mc_s)

mu, sd = sigma_mc.mean(), sigma_mc.std()

print("=" * 60)
print("STEP 4: Monte Carlo - INPUT UNCERTAINTY ONLY (not empirical repeatability)")
print("=" * 60)
print(f"Centered on u_in={u_in_nom}, T={T_nom}K")
print(f"Predicted mean sigma: {mu:.3f}%, input-uncertainty std: {sd:.4f}%")
print()

print("=" * 60)
print("STEP 5: Process capability against THREE sourced spec limits")
print("=" * 60)
specs = {
    "Undoped poly (tight, Waterloo QNC)": 3.0,
    "Unoptimized furnace baseline (literature)": 5.5,
    "Doped poly (Waterloo QNC)": 10.0,
}
for name, USL in specs.items():
    Cpk = (USL - mu) / (3 * sd)
    verdict = "CAPABLE" if Cpk >= 1.33 else ("marginal/out of spec" if Cpk < 0 else "capable but not robust")
    print(f"{name:<42} USL={USL:>5.1f}%  Cpku={Cpk:>10.2f}   [{verdict}]")

print()
print("CAVEAT: Waterloo spec is LPCVD/100mm wafer, not APCVD/300mm - same")
print("chemistry family (SiH4, N2, doped w/ PH3), different pressure regime")
print("and wafer size. Cite with that caveat, not as an exact process match.")
print()
print("CAVEAT: sigma above is propagated INPUT uncertainty (MFC + thermocouple")
print("tolerance), not measured empirical run-to-run repeatability - COMSOL is")
print("deterministic and has no hardware-style noise to replicate-test.")
