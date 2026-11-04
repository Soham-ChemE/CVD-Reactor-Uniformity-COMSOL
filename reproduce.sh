#!/usr/bin/env bash
# One-command reproduction of every number in README.md, docs/CLAIMS.md and docs/index.html from the COMSOL exports in data/.
# Needs: pip install -r requirements.txt   (no COMSOL licence needed; the .mph files are provided for inspection only)
set -euo pipefail
cd "$(dirname "$0")"
python analysis/full_analysis.py          # sigma and coverage for every exported wafer-plane profile
python analysis/wafer_3D_sigma.py         # 3D wafer-face statistics (6,012 nodes)
python analysis/real_cpk_pipeline_v4.py   # Gaussian-process and polynomial surrogates, LOO R2, 10,000-draw Monte Carlo, Cpk
python make_cvd_figs.py                   # figures/fig1..fig5 and cvd_results.json
python docs/build_assets.py --no-page               # docs/assets/data.js, SVG/PNG figures and the social preview for the live page
echo "Done. Compare the printed values with docs/CLAIMS.md."
# python docs/build_assets.py --snap --qa --lighthouse   # static fallbacks for the 3D body scenes, both-theme screenshots, Lighthouse (needs playwright + lighthouse)
