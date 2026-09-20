import numpy as np
import os

# ---- CONFIG ----
FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
FILENAME = "wafer_3D_radial_profile.csv"   # the 3D wafer surface export
WAFER_R = 0.150            # wafer radius (m)
EDGE_EXCLUDE = 0.005       # exclusion zone at the rim (m). 0.005 = 5 mm. Set 0.0 for full face.
# ----------------

path = os.path.join(FOLDER, FILENAME)

# COMSOL surface export: 3 comma-separated columns -> x, y, c ; comment lines start with %
data = np.loadtxt(path, comments='%', delimiter=',')
x, y, c = data[:, 0], data[:, 1], data[:, 2]
r = np.sqrt(x**2 + y**2)

def sigma_cv(vals):
    return (vals.std(ddof=1) / vals.mean()) * 100

sig_full = sigma_cv(c)
mask = r <= (WAFER_R - EDGE_EXCLUDE)
sig_trim = sigma_cv(c[mask])

print(f"File: {FILENAME}")
print(f"Wafer nodes: {len(c)}")
print("-" * 55)
print(f"c mean:            {c.mean():.5f} mol/m^3")
print(f"c min / max:       {c.min():.5f} / {c.max():.5f} mol/m^3")
print("-" * 55)
print(f"sigma_full  (whole wafer face):        {sig_full:6.2f} %")
print(f"sigma_trim  (excl. outer {EDGE_EXCLUDE*1000:.0f} mm rim):    {sig_trim:6.2f} %   [{int(mask.sum())} nodes]")
print("-" * 55)
print("Compare against the 2D benchmark of 3.3%.")
print()
print("NOTE: this is a SURFACE (over-area) coefficient of variation.")
print("The 3.3% baseline was a 1D radial-line CV -- both are 'sigma' but")
print("not identical; the surface CV also captures port-to-port variation.")
