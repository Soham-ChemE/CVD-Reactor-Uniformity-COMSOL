import numpy as np
import math

k_s_1000 = 1.338e-2
R_wafer  = 0.150

def coverage_check(r_in, H, u_in, k_s, R_wafer, threshold=0.10):
    Q = u_in * 2*math.pi*r_in*H
    r = np.linspace(r_in, R_wafer, 2000)
    c = np.exp(-math.pi*k_s*(r**2 - r_in**2)/Q)
    c_norm = c / c.max()
    below = np.where(c_norm < threshold)[0]
    r_cov = r[below[0]] if len(below) else R_wafer
    return r_cov

print("=" * 60)
print("SWEEP 1: inlet radius (fixed u_in=0.1, H=0.02, k_s @1000K)")
print("=" * 60)
print(f'{"r_in (mm)":>10} {"r_cov (mm)":>12} {"% of wafer":>11}')
for r_in_mm in [5, 10, 20, 40, 60, 80, 100, 120, 140, 150]:
    r_in = r_in_mm / 1000
    if r_in >= R_wafer:
        print(f'{r_in_mm:>10} {"full span":>12} {"100.0%":>11}')
        continue
    r_cov = coverage_check(r_in, 0.02, 0.1, k_s_1000, R_wafer)
    pct = r_cov / R_wafer * 100
    print(f'{r_in_mm:>10} {r_cov*1000:>12.1f} {pct:>10.1f}%')

print()
print("=" * 60)
print("SWEEP 2: gap height H (fixed r_in=10mm, u_in=0.1, k_s @1000K)")
print("=" * 60)
print(f'{"H (mm)":>10} {"r_cov (mm)":>12} {"% of wafer":>11}')
for H_mm in [5, 10, 20, 40, 60, 80, 100]:
    H = H_mm / 1000
    r_cov = coverage_check(0.010, H, 0.1, k_s_1000, R_wafer)
    pct = r_cov / R_wafer * 100
    print(f'{H_mm:>10} {r_cov*1000:>12.1f} {pct:>10.1f}%')

print()
print("=" * 60)
print("SWEEP 3: inlet velocity u_in (fixed r_in=10mm, H=0.02, k_s @1000K)")
print("=" * 60)
print(f'{"u_in (m/s)":>10} {"r_cov (mm)":>12} {"% of wafer":>11}')
for u_in in [0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0]:
    r_cov = coverage_check(0.010, 0.02, u_in, k_s_1000, R_wafer)
    pct = r_cov / R_wafer * 100
    print(f'{u_in:>10.2f} {r_cov*1000:>12.1f} {pct:>10.1f}%')

print()
print("Reminder: this model is OPTIMISTIC vs real CFD for small r_in.")
print("Real COMSOL coverage at r_in=10mm was 16.9%, not 55.7%.")
print("Trends are informative; absolute numbers are not final.")
