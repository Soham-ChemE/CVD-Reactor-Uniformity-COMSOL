"""
Analytical (frozen-field) film growth approximation.

HONEST LIMITATION: assumes the flow/concentration field stays fixed as
the film grows -- does not capture feedback from the growing film
changing the gap height (that's what true ALE would capture, and it
did not converge in this project -- see ALE_Debugging_Request.md).
This is a standard first-order approximation, valid for thin films /
early growth, not a substitute for a converged transient simulation.

Uses your REAL radial concentration profile from the actual optimum run.
"""
import numpy as np

R_TRIM = 0.138
molar_density_Si = 82926.8  # mol/m^3, silicon (rho=2329 kg/m3, M=28.085 g/mol)
k_s = 1.338e-2  # m/s, at T=1000K, Hashimoto et al. 1990

# Point this at your actual best run's CSV
import os; CSV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "fullspan_run12_u007_T1000_radial_profile.csv")

data = np.loadtxt(CSV_PATH, comments='%', delimiter=',')
r, c = data[:, 0], data[:, 1]
mask = r <= R_TRIM
r, c = r[mask], c[mask]
order = np.argsort(r)
r, c = r[order], c[order]

# local growth velocity at every radial point
v_growth = k_s * c / molar_density_Si  # m/s

print(f"Loaded {len(r)} points from {CSV_PATH}")
print(f"Growth velocity range: {v_growth.min():.3e} to {v_growth.max():.3e} m/s")
print()

# thickness at several projected times
times_s = [100, 1000, 3000, 10000]
print(f"{'time(s)':>10} {'min thick(nm)':>15} {'max thick(nm)':>15} {'thickness sigma(%)':>20}")
for t in times_s:
    thickness_m = v_growth * t
    thickness_nm = thickness_m * 1e9
    mean_t = thickness_nm.mean()
    std_t = thickness_nm.std(ddof=1)
    sigma_pct = (std_t / mean_t) * 100 if mean_t > 0 else float('nan')
    print(f"{t:>10} {thickness_nm.min():>15.4f} {thickness_nm.max():>15.4f} {sigma_pct:>20.2f}")

print()
print("Compare thickness sigma(%) above to the concentration sigma this run")
print("already showed (3.3%) -- if they match closely, it confirms the")
print("frozen-field approximation: thickness uniformity mirrors concentration")
print("uniformity exactly, since thickness = v_growth * t is just a linear")
print("scaling of c(r) at every radius, for every t.")
print()
print("HONEST CAVEAT: this will NOT show any time-evolution of the pattern")
print("(no self-correction, no drift) because the frozen-field assumption")
print("makes thickness a pure linear scaling of the SAME concentration shape")
print("at every t. A converged ALE model could show something genuinely")
print("different -- this approximation cannot, by construction.")
