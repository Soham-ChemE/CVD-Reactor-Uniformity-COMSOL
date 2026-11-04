# Claims audit: CVD reactor uniformity README and live page

Every number in `README.md` and `docs/index.html` traced to the export and script that produce it, with the value
from re-running `./reproduce.sh` on a clean clone on 2026-11-04 (Python 3.13, numpy 2.5, scipy 1.18, scikit-learn 1.9).
σ is the coefficient of variation (sample standard deviation over mean) of the wafer-plane precursor concentration for
r ≤ 138 mm; coverage is the radius at which the concentration first falls below 10 % of its peak, as a fraction of the
150 mm wafer radius. Both definitions are in `analysis/full_analysis.py` and are reused unchanged by `docs/build_assets.py`.

| Claim | Where it is computed | Reproduced value | Status |
|---|---|---|---|
| 300 mm single-wafer showerhead reactor, 2D axisymmetric, flow + heat + species + surface kinetics from published silane work | `README.md` model table; `models/*.mph` (COMSOL 6.4); `docs/Open_Questions_Resolved.md` | as described; kinetics from Hashimoto et al. 1990, diffusivity base value from Han et al. 2024 | model files not re-solved here (no COMSOL licence); exports are used as committed |
| Non-uniformity 179.6 % (180 %) with the 10 mm inlet | `analysis/full_analysis.py` on `data/old_runs/run1_baseline_radial_profile.csv` | 179.6 % | matches |
| Coverage 16.9 % (17 %); precursor consumed within 25 mm | same (coverage radius 25.4 mm = 16.9 % of 150 mm) | 25.42 mm, 16.9 % | matches |
| Mass-transfer limited, Damköhler above 10 | `docs/CVD_Action_Plan_2D_3D.md` line 76 (Da ≈ 13 at original conditions, Da = k_s·L/(u·H)) | Da ≈ 13 | documented in the methodology notes, not computed by a script in the repo |
| Precursor utilisation 0.17 % in the baseline | `docs/run1_utilization.rtf` (COMSOL inlet and outlet flux integrals) | 3.1261e-5 vs 3.1207e-5 mol/s → 0.17 % | from the COMSOL note, not recomputed |
| Inlet widened 10 → 150 mm gives σ 6.1 % and 92 % coverage | `full_analysis.py` on `data/fullspan_baseline_u01_T1000_radial_profile.csv` | 6.1 %, 91.9 % | matches |
| 14-run face-centred CCD reaches 3.3 % at 0.07 m/s | `data/doe_design_v2.csv` + axial extensions; `fullspan_run12_u007_T1000_radial_profile.csv` | 14 runs listed in `cvd_results.json` `doe`; 3.3 % | matches |
| σ 15.7 % at 0.20 m/s; rises again below 0.035 m/s; ±100 K moves σ by < 0.2 points | `cvd_results.json` `doe` | 15.7 % (0.20, 1000 K); 4.3 % at 0.035, 7.7 % at 0.02; at 0.05 m/s: 3.29 / 3.38 / 3.44 % for 900 / 1000 / 1100 K | matches |
| Two-zone inlet split at 80 mm: 24.8 %; equal-area split: 8.7 % (0.07 / 0.03) and 3.2 % (equal velocities) | `full_analysis.py` on the `splitradius_80mm_*` and `multizone_*` exports | 24.8 %, 8.7 %, 3.2 % | matches |
| 10 mm gap degrades σ to 10 %; 30 mm changes little; 0.5 atm mildly worse; rotating disk 14.7 % | same on `fullspan_h10mm`, `fullspan_h30mm`, `fullspan_pressure05atm`, `rdr_500rpm_8layers` | 10.0 %, 6.2 %, 4.1 % (vs 3.4 % at 1 atm), 14.7 % | matches |
| Gaussian-process surrogate leave-one-out R² 0.944; polynomial 0.917 | `analysis/real_cpk_pipeline_v4.py` | 0.9443; 0.9174 | matches |
| 10,000 Monte Carlo draws with MFC ±1 % and Type K class 2 ±5.5 K at 0.06 m/s: expected σ 3.34 %, spread 0.006 % | same | mean 3.338 %, std 0.0059 % | matches |
| Against 3 % (undoped) and 10 % (doped) Waterloo QNC specs: just above the tight limit, far inside the loose one | same | Cpk −19.2 at 3 %, 378 at 10 % | matches; the README states both caveats (input-uncertainty only; LPCVD 100 mm source) |
| 3D model with asymmetric exhaust: 5.9 % (5 mm rim excluded), 7.9 % full face, 6,012 nodes | `analysis/wafer_3D_sigma.py` on `data/wafer_3D_radial_profile.csv` | 5.89 %, 7.85 %, 6012 nodes | matches |
| Frozen-field thickness σ equals concentration σ (3.32 %) by construction | `analysis/growth_approximation.py` | 3.32 % | matches |

## Changes made in this pass

| Old | New | Reason |
|---|---|---|
| README hero was a static banner | hero block linking to the live page, with the banner retained below | requested structure |
| "Reproduce" listed a `pip install` line and four scripts | `requirements.txt` and `./reproduce.sh` (adds `docs/build_assets.py`) | one-command reproduction from a clean clone, verified |
| no results table at the top | results table with the before / after / optimum / 3D / surrogate / Monte Carlo numbers and their source files | requested structure |
| no citation block | citation block | requested structure |

No numeric claim in the README needed correction; every value reproduced exactly.

## Not verifiable from the repository

- The COMSOL models themselves were not re-solved (no licence in the reproduction environment); every number is computed from the committed exports, which carry the COMSOL 6.4 headers and dates.
- The Damköhler number (≈ 13) and the 0.17 % utilisation are documented in the methodology notes and a COMSOL flux note, not recomputed by a script.
- The film-thickness spec limits (3 % and 10 %) are quoted from the University of Waterloo QNC facility page cited in the analysis script.
