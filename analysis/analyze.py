import numpy as np
import os

FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
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
    return r[mask], c[mask]

print(f"{'run':<30} {'mean c':>12} {'std':>12} {'sigma %':>10} {'n':>6}")
print("-" * 74)

for name, fn in runs.items():
    try:
        r, c = load(fn)
        mean, std = c.mean(), c.std(ddof=1)
        sigma = (std / mean) * 100
        print(f"{name:<30} {mean:>12.6f} {std:>12.6f} {sigma:>10.2f} {len(r):>6}")
    except Exception as e:
        print(f"{name:<30} ERROR: {e}")
