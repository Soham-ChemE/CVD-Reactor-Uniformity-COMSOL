# Open Questions — Resolution Status
Companion to `Open_Questions_Geometry_Materials.md`. That file predates this project's sourcing work; this is the closure record. 10 of 13 questions are resolved with citations. 3 remain genuinely open because the underlying numbers are proprietary — those are handled as declared modeling choices, not gaps to keep chasing.

| # | Question | Status | Resolution | Source |
|---|---|---|---|---|
| 1 | Inlet width vs wafer | **Resolved** | r=150mm, matches gas-head OD = wafer OD ratio | US6022811A, verified primary text |
| 2 | Chamber height | **Resolved as a decision** | No crisp silane-APCVD value exists — sweep 10/20/40mm as a DOE factor instead of citing one number. This is the correct resolution, not an unsourced gap. | Tungsten CVD paper (Wang et al. 2025) flags height as dominant factor |
| 3 | Exhaust slit dimensions | **Open — proprietary** | Declared modeling choice: thin slit at r=150mm, matching chamber height. State explicitly as a simplification. | N/A — not published |
| 4 | Inlet plenum depth | **Resolved** | Non-critical to wafer-plane physics; keep fixed | Physics reasoning |
| 5 | Equal-area zone split | **Resolved as a decision** | 106.07mm is a neutral starting point, not claimed optimal — the DOE finds the real optimum | Own calculation + explicit framing |
| 6 | 2 vs 3 zones | **Resolved** | Dual-zone is standard and real; model 2-zone, mention 3-zone as a known extension | General CVD literature |
| 7 | Carrier gas Ar vs N2/H2 | **Resolved** | N2, all four properties re-sourced (viscosity independently verified by hand) | Multiple cross-checked sources |
| 8 | k_s below 973K | **Resolved** | 900K is a ~70K single-mechanism Arrhenius extrapolation; stated openly, not hidden | Hashimoto et al. 1990 range explicitly noted |
| 9 | D_F temperature dependence | **Resolved** | Fuller T^1.75 exponent, applied to Han et al. 2024 base (2.0×10⁻⁵ at 298K) | Verified against rigorous Chapman-Enskog |
| 10 | Dilution ratio | **Resolved (as a mapping, not a hard number)** | ~20-30% SiH4 in N2, explicitly not claimed as a precise APCVD-specific figure | Standard polysilicon CVD literature |
| 11 | 1 atm vs sub-atmospheric | **Resolved** | 1 atm is legitimate for APCVD, matches Hashimoto's conditions | APCVD definition + Hashimoto 1990 |
| 12 | Wafer rotation 500-1500 RPM | **Still open — do not use** | That RPM range is characteristic of rotating-disk reactors, a different architecture from this static-showerhead model. Likely doesn't belong here at all, but this has not been independently confirmed — if rotation is ever added, it needs its own citation for THIS reactor class first, not reuse of the rotating-disk number. | Unverified — flagged, not resolved |
| 13 | Hole diameter/pitch (3D) | **Open — proprietary, deferred** | Not needed yet; Track 2's unit-cell → porous-media approach sidesteps needing the exact pitch | Deferred to 3D phase |

## Net
- **10/13 resolved** with real citations or explicitly-framed modeling decisions
- **2/13 open by nature** (exhaust slit, hole pitch) — proprietary, correctly handled as declared simplifications
- **1/13 flagged, not adopted** (rotation) — kept out of the model rather than used on an unverified borrowed number

This table is what should go in the GitHub repo's methodology section — it demonstrates the sourcing discipline directly rather than requiring a reader to piece it together from memos.
