import numpy as np
import os
import glob

FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
R_TRIM = 0.138
WAFER_R = 0.150

def load(path):
    data = np.loadtxt(path, comments='%', delimiter=',')
    r, c = data[:, 0], data[:, 1]
    mask = r <= R_TRIM
    order = np.argsort(r[mask])
    return r[mask][order], c[mask][order]

def sigma_cv(c):
    return (c.std(ddof=1) / c.mean()) * 100

def coverage_radius(r, c, threshold_frac=0.10):
    c_max = c.max()
    below = np.where(c < threshold_frac * c_max)[0]
    return r[below[0]] if len(below) else r[-1]

patterns = ["*radial_profile.csv", "*radial.csv"]
files = []
for p in patterns:
    files.extend(glob.glob(os.path.join(FOLDER, p)))
files = sorted(set(files))

print(f"{'file':<45} {'sigma %':>9} {'r_cov(mm)':>10} {'%wafer':>8}")
print("-" * 76)

for path in files:
    fn = os.path.basename(path)
    try:
        r, c = load(path)
        sig = sigma_cv(c)
        r_cov = coverage_radius(r, c)
        pct = r_cov / WAFER_R * 100
        print(f"{fn:<45} {sig:>9.1f} {r_cov*1000:>10.2f} {pct:>7.1f}%")
    except Exception as e:
        print(f"{fn:<45} ERROR: {e}")

print()
print(f"Trim: r <= {R_TRIM*1000:.0f}mm (excludes corner singularity)")
print(f"sigma = coefficient of variation, lower = better")
print(f"r_cov = radius where c first drops below 10% of peak")
