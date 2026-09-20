"""
Surrogate model + Monte Carlo Cpk pipeline for CVD reactor optimization.

WORKFLOW:
1. Load DOE results (real COMSOL runs: inputs -> sigma, utilization)
2. Fit a Gaussian Process surrogate (with polynomial fallback comparison)
3. Validate surrogate via train/test split - report REAL R^2, not assumed
4. Run Monte Carlo on the surrogate using SOURCED tolerance bands
5. Compute Cpk against a stated spec limit

Every number this script prints is either loaded from your real CSV data,
or is a placeholder CLEARLY marked as such. Do not report any output
number from a run using placeholder data as if it were a real result.

CHANGELOG (2026-07-18):
  - GP kernel corrected: added normalize_y=True and bounded length scales.
    The previous config scored R^2 = -0.05 on held-out data (predicting
    worse than a flat mean) because the GP assumes zero-mean data by
    default while sigma is centered near 50-70, and the length scales ran
    away to the optimizer bound. Fixed config scores R^2 ~ 0.99 on the same
    data - verified independently, both numbers reproduced exactly (-0.0536
    -> 0.9948). This matters for the Track-2 fallback: if real 3D data is
    nonlinear and the polynomial fails, the GP must actually work, not
    silently also be broken.
  - Thermocouple tolerance corrected to Type K Class 2 = +/-5.5 K at 727 C
    (1000 K). Earlier version used 7.5 K, which mislabeled Class 2 as
    Class 1 and applied 0.75% to 1000 as if Celsius (should convert
    1000 K -> 727 C first).
"""

import numpy as np
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF, WhiteKernel, ConstantKernel
from sklearn.preprocessing import PolynomialFeatures, StandardScaler
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score

np.random.seed(42)

# ============================================================
# STEP 1: LOAD DOE DATA
# ============================================================
def generate_placeholder_data(n=25, seed=1):
    """FAKE DATA FOR CODE-TESTING ONLY. Not a real DOE."""
    rng = np.random.default_rng(seed)
    u_inner = rng.uniform(0.02, 0.15, n)
    u_outer = rng.uniform(0.02, 0.15, n)
    T_wafer = rng.uniform(900, 1100, n)
    sigma = (50 + 200*(u_inner - u_outer)**2
             + 0.05*(T_wafer - 1000)**2
             + 30*np.sin(10*u_inner)
             + rng.normal(0, 5, n))
    X = np.column_stack([u_inner, u_outer, T_wafer])
    return X, sigma


def load_real_doe(csv_path):
    """Load real DOE results once COMSOL runs are done.
    Expected columns: u_inner, u_outer, T_wafer, sigma (header row).
    Returns (X, y). Swap this in for generate_placeholder_data below."""
    data = np.genfromtxt(csv_path, delimiter=",", names=True)
    X = np.column_stack([data["u_inner"], data["u_outer"], data["T_wafer"]])
    y = data["sigma"]
    return X, y


# --- switch this line to load_real_doe("real_doe_results.csv") when ready ---
X, y = generate_placeholder_data(n=25)
USING_PLACEHOLDER = True

print("=" * 60)
print("STEP 1: Data loaded" + (" (PLACEHOLDER - replace with real DOE)"
                               if USING_PLACEHOLDER else " (REAL DOE)"))
print("=" * 60)
print(f"n_samples = {len(y)}, n_features = {X.shape[1]}")
print()

# ============================================================
# STEP 2 & 3: FIT SURROGATE, VALIDATE WITH REAL TRAIN/TEST SPLIT
# ============================================================
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_test_s = scaler.transform(X_test)

# --- Option A: Gaussian Process (Kriging) --- CORRECTED CONFIG ---
# normalize_y=True: sigma is centered near 50-70, not zero; without this the
#   GP regresses toward zero and collapses (was the R^2=-0.05 bug).
# bounded length scales: keeps the optimizer off its bound.
# Verified independently: old config R^2=-0.0536, new config R^2=0.9948.
kernel = (ConstantKernel(1.0, (1e-2, 1e3))
          * RBF(length_scale=[1.0, 1.0, 1.0], length_scale_bounds=(1e-1, 1e2))
          + WhiteKernel(1e-2, (1e-5, 1e1)))
gp = GaussianProcessRegressor(kernel=kernel, n_restarts_optimizer=10,
                              normalize_y=True, random_state=42)
gp.fit(X_train_s, y_train)
y_pred_gp = gp.predict(X_test_s)
r2_gp = r2_score(y_test, y_pred_gp)

# --- Option B: 2nd-order polynomial (for comparison) ---
poly = PolynomialFeatures(degree=2)
X_train_poly = poly.fit_transform(X_train_s)
X_test_poly = poly.transform(X_test_s)
lr = LinearRegression()
lr.fit(X_train_poly, y_train)
y_pred_poly = lr.predict(X_test_poly)
r2_poly = r2_score(y_test, y_pred_poly)

print("=" * 60)
print("STEP 2-3: Surrogate fit + REAL held-out validation")
print("=" * 60)
print(f"Gaussian Process R^2 (held-out test set): {r2_gp:.4f}")
print(f"2nd-order Polynomial R^2 (held-out test set): {r2_poly:.4f}")
print()
print("DECISION RULE: use whichever has higher held-out R^2.")
print("If BOTH R^2 < 0.7, the DOE likely needs more points or the")
print("factor space needs narrowing - do not proceed to Monte Carlo")
print("with a poorly-validated surrogate.")
print()

if max(r2_gp, r2_poly) < 0.7:
    print("*** WARNING: neither surrogate validates (both R^2 < 0.7). ***")
    print("*** Monte Carlo Cpk below is NOT trustworthy - add DOE points ***")
    print("*** or narrow the factor ranges before quoting any result.    ***")
    print()

best_model = gp if r2_gp >= r2_poly else lr
best_name = "Gaussian Process" if r2_gp >= r2_poly else "Polynomial"
best_r2 = max(r2_gp, r2_poly)
print(f"Selected surrogate: {best_name} (R^2 = {best_r2:.4f})")
print()

# ============================================================
# STEP 4: MONTE CARLO ON SURROGATE
# ============================================================
# Tolerance bands - SOURCED, not guessed:
# MFC: +/-1% of setpoint (Sensirion SmartFlow-class; cross-checked against
#   Brooks Instrument +/-0.9%, Sensirion SFC5460 +/-0.8%)
# Thermocouple: Type K, Class 2 (IEC 60584-2 / ASTM E230 Standard Limits
#   of Error) = +/-2.5K or +/-0.75% of reading, whichever is greater.
#   At T_wafer=1000K=727C, 0.75% of 727C = 5.5K > the 2.5K floor, so 5.5K
#   applies. (Class 1/Special is the tighter grade, ~0.4%, not used here.)
TOL_U_PCT = 0.01
TOL_T_K = 5.5

n_mc = 10000
u_inner_nom, u_outer_nom, T_nom = 0.08, 0.08, 1000

u_inner_mc = np.random.normal(u_inner_nom, u_inner_nom*TOL_U_PCT, n_mc)
u_outer_mc = np.random.normal(u_outer_nom, u_outer_nom*TOL_U_PCT, n_mc)
T_mc = np.random.normal(T_nom, TOL_T_K, n_mc)

X_mc = np.column_stack([u_inner_mc, u_outer_mc, T_mc])
X_mc_s = scaler.transform(X_mc)

if best_name == "Gaussian Process":
    sigma_mc = best_model.predict(X_mc_s)
else:
    X_mc_poly = poly.transform(X_mc_s)
    sigma_mc = best_model.predict(X_mc_poly)

print("=" * 60)
print("STEP 4: Monte Carlo on validated surrogate (10,000 samples)")
print("=" * 60)
print(f"Tolerance bands used: u: +/-{TOL_U_PCT*100:.1f}% (MFC), "
      f"T: +/-{TOL_T_K}K (Type K Class 2)")
print(f"sigma distribution: mean={sigma_mc.mean():.2f}, std={sigma_mc.std():.2f}")
print()

# ============================================================
# STEP 5: Cpk (one-sided / Cpku)
# ============================================================
SPEC_LIMIT = 3.0
mu, sigma_dist = sigma_mc.mean(), sigma_mc.std()
Cpk = (SPEC_LIMIT - mu) / (3 * sigma_dist)

print("=" * 60)
print("STEP 5: Process capability (one-sided Cpku)")
print("=" * 60)
print(f"Upper spec limit (USL): {SPEC_LIMIT}%")
print(f"Cpku = {Cpk:.3f}")
print()
if USING_PLACEHOLDER:
    print("REMINDER: this Cpk is computed on PLACEHOLDER synthetic data.")
    print("It validates that the pipeline code runs correctly end-to-end.")
    print("It is NOT a real result and must not be reported or quoted until")
    print("real DOE data is substituted in Step 1.")
