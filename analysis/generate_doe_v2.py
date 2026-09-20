"""
Generate a Central Composite Design (CCD) for the full-span single-zone
DOE, centered on the validated baseline: u_in=0.125, T_wafer=1000K -> sigma=6.1%.
"""
from pyDOE3 import ccdesign
import numpy as np

factor_names = ["u_in", "T_wafer"]

# Ranges centered on the validated baseline, same as the original DOE range
ranges = {
    "u_in": (0.05, 0.20),      # m/s
    "T_wafer": (900, 1100),    # K
}

design_coded = ccdesign(2, center=(1, 1), alpha='o', face='ccf')

print(f"Design has {design_coded.shape[0]} runs, {design_coded.shape[1]} factors")
print()

def decode(coded_col, lo, hi):
    return lo + (coded_col + 1) / 2 * (hi - lo)

real_design = np.zeros_like(design_coded)
for i, name in enumerate(factor_names):
    lo, hi = ranges[name]
    real_design[:, i] = decode(design_coded[:, i], lo, hi)

print(f"{'run':>4} {'u_in':>9} {'T_wafer':>9}")
print("-" * 26)
for i, row in enumerate(real_design):
    print(f"{i+1:>4} {row[0]:>9.4f} {row[1]:>9.1f}")

print()
print(f"Total runs required: {len(real_design)}")
print(f"Center point (u_in=0.125, T_wafer=1000) already validated separately: sigma=6.1%")
print(f"Ranges used: u_in {ranges['u_in']}, T_wafer {ranges['T_wafer']}")

np.savetxt("doe_design_v2.csv", real_design, delimiter=",",
           header=",".join(factor_names), comments="")
print()
print("Saved to doe_design_v2.csv")
