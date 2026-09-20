import numpy as np
import os

FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
WAFER_R = 0.150
R_TRIM = 0.138

runs = {
    "single_baseline_u0.1_T1000":  "run1_baseline_radial_profile.csv",
    "single_u0.05_T900":           "doe_run1_u005_T900_radial_profile.csv",
    "single_u0.2_T900":            "doe_run2_u02_T900_radial_profile.csv",
    "single_u0.05_T1100":          "doe_run3_u005_T1100_radial_profile.csv",
    "single_u0.2_T1100":           "doe_run4_u02_T1100_radial_profile.csv",
    "single_center_u0.125_T1000":  "doe_center_u0125_T1000_radial_profile.csv",
    "multi_in0.05_out0.15_T1000":  "multizone_ui005_uo015_T1000_radial.csv",
    "multi_in0.15_out0.05_T1000":  "multizone_ui015_uo005_T1000_radial.csv",
}

def load(fn):
    path = os.path.join(FOLDER, fn)
    data = np.loadtxt(path, comments='%', delimiter=',')
    r, c = data[:, 0], data[:, 1]
    mask = r <= R_TRIM
    order = np.argsort(r[mask])
    return r[mask][order], c[mask][order]

def coverage_radius(r, c, threshold_frac=0.10):
    c_max = c.max()
    threshold = threshold_frac * c_max
    below = np.where(c < threshold)[0]
    if len(below) == 0:
        return r[-1]
    first_drop = below[0]
    return r[first_drop]

print(f"{'run':<30} {'c_max':>10} {'r_cov (mm)':>12} {'% of wafer':>11}")
print("-" * 66)

for name, fn in runs.items():
    try:
        r, c = load(fn)
        r_cov = coverage_radius(r, c, threshold_frac=0.10)
        pct = (r_cov / WAFER_R) * 100
        print(f"{name:<30} {c.max():>10.6f} {r_cov*1000:>12.2f} {pct:>10.1f}%")
    except Exception as e:
        print(f"{name:<30} ERROR: {e}")

print()
print("r_cov = radius at which concentration first drops below 10% of peak")
print(f"Wafer radius = {WAFER_R*1000:.0f} mm")
