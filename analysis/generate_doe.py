"""
Generate a real Central Composite Design (CCD) for the 3D multi-zone DOE.
Uses pyDOE3 - a real, published DOE library, not hand-picked points.
"""
from pyDOE3 import ccdesign
import numpy as np

# Factors, in coded units (-1 to +1), will be mapped to real ranges below
# 3 factors: u_inner, u_outer, T_wafer
factor_names = ["u_inner", "u_outer", "T_wafer"]

# Real physical ranges (edit these once full-span geometry is validated
# and a sensible baseline operating point is known)
ranges = {
    "u_inner": (0.02, 0.20),   # m/s
    "u_outer": (0.02, 0.20),   # m/s
    "T_wafer": (900, 1100),    # K
}

# face-centered CCD (alpha=1, so all points stay within the box -
# avoids extrapolating outside your tested velocity range, which matters
# given the 3.41 m/s convergence failure already documented)
design_coded = ccdesign(3, center=(1, 1), alpha='o', face='ccf')

print(f"Design has {design_coded.shape[0]} runs, {design_coded.shape[1]} factors")
print()

def decode(coded_col, lo, hi):
    # coded: -1, 0, +1 -> real range
    return lo + (coded_col + 1) / 2 * (hi - lo)

real_design = np.zeros_like(design_coded)
for i, name in enumerate(factor_names):
    lo, hi = ranges[name]
    real_design[:, i] = decode(design_coded[:, i], lo, hi)

print(f"{'run':>4} {'u_inner':>9} {'u_outer':>9} {'T_wafer':>9}")
print("-" * 36)
for i, row in enumerate(real_design):
    print(f"{i+1:>4} {row[0]:>9.4f} {row[1]:>9.4f} {row[2]:>9.1f}")

print()
print(f"Total runs required: {len(real_design)}")
print("Ranges used:")
for name, (lo, hi) in ranges.items():
    print(f"  {name}: {lo} to {hi}")
print()
print("NOTE: velocity range capped at 0.20 m/s max - deliberately excludes")
print("3.41 m/s literature-optimum region since that was already shown to")
print("break convergence on this mesh. If mesh is refined later, this")
print("range can be widened and re-generated.")

np.savetxt("doe_design.csv", real_design, delimiter=",",
           header=",".join(factor_names), comments="")
print()
print("Saved to doe_design.csv")
