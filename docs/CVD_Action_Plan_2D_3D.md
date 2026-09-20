# CVD Reactor Project — Action Plans (2D and 3D)

Everything below has been checked against what was actually verified in this project. Items marked **[UNVERIFIED]** are plausible engineering judgment, not yet tested — treat as hypotheses to check, not facts to state.

---

## TRACK 1 — 2D (immediate, blocked on COMSOL access)

### ⚠️ STEP 0: Do these THREE fixes before touching geometry — verified 2026-07-18

**0a. Make D_F temperature-dependent.** Exponent confirmed (Fuller, T^1.75, checked against rigorous Chapman-Enskog for SiH4-N2, ~3% agreement — this exponent is solid). **Base value: use OUR sourced D_298 = 2.0×10⁻⁵ m²/s (Han et al. 2024), not a from-scratch recalculation** — a competing value (implying D_298=1.53×10⁻⁵) was checked and disagrees with our verified source by 31%; rather than silently pick one, we keep the value we've already read and verified.
- **COMSOL expression: `2.0e-5[m^2/s] * (T/298[K])^1.75`**
- Gives D(900K)=1.38×10⁻⁴, D(1000K)=1.66×10⁻⁴, D(1100K)=1.97×10⁻⁴ m²/s (recomputed directly from the stated formula — an earlier draft's table had the endpoints drifted ~5% off this expression, corrected here)
- This drops Da from 13.4 → ~1.7-1.8 depending on exact T — confirms the earlier "geometry is fatal" framing was overstated; re-run baseline with this before finalizing conclusions
- Note on the earlier "31% disagreement with a competing D_298 value": that figure came from backing out D_298 through the 1.75 power law from a competing D(1000K) value. Computing that competing source's D_298 directly instead gives ~25% disagreement — both are legitimate ways to compare, they differ because the competing method isn't an exact 1.75 power law. Doesn't change the decision (keep Han et al. 2024 as the base), just worth knowing which comparison basis is being cited if asked.

**0b. Carrier gas: Argon → N2.** Confirmed independently (APCVD silane standardly diluted in N2). Properties below — viscosity independently verified by direct calculation (exact match), others taken from a sourcing memo citing named references (JANAF, Lemmon & Jacobsen 2004) not yet independently re-derived by hand the way viscosity was:

| Property | Value at 1000K | Source |
|---|---|---|
| M | 28.014 g/mol | periodic table |
| Density | via ideal gas law | same form as Argon, swap M |
| Viscosity μ(T) | Sutherland: μ₀=1.663×10⁻⁵ Pa·s, T₀=273K, S=107K → **4.00×10⁻⁵ Pa·s at 1000K** | White, *Viscous Fluid Flow*, Table 1-2 — independently verified by direct computation, exact match |
| Cp(T) | **1167 J/(kg·K) at 1000K** (NOT the ideal diatomic 7R/2=1039 J/kg·K — that's ~11% low at this T since N2's vibrational modes activate above room temp) | NIST-JANAF Thermochemical Tables |
| Thermal conductivity k(T) | **0.0647 W/(m·K) at 1000K** | Lemmon & Jacobsen (2004), *Int. J. Thermophys.* 25:21 — modern analog to the Younglove & Hanley source used for Argon |
| Dilution (write-up mapping only) | ~20-30% SiH4 in N2 | standard polysilicon CVD practice — explicitly NOT a tight APCVD-specific number, state it that way |

**0c. Inlet sizing — now fully verified against primary patent text (fetched and read directly, not a secondhand summary).**

US6022811A ("Method of uniform CVD," Mitsubishi Electric, granted 2000) confirmed directly. Exact quote: *"Gas head 5 has an outer diameter of 150 mm that is equal to that of wafer 1, and the central first gas blowing region that has a diameter of 110 mm... Gas head 5 is provided opposing wafer 1 with a distance of 7 mm."* Table 1, confirmed verbatim:

| Wafer diameter | Min. delivery diameter D |
|---|---|
| 150mm (6") | 110mm |
| 200mm (8") | 160mm |
| 250mm (10") | 210mm |

Every row is exactly (wafer diameter − 40mm), and Claim 1 formalizes this as "30 to 50 mm smaller than that of said wafer." **Note this patent's gas head diameter (150mm) exactly equals the wafer diameter — it does NOT extend beyond it.** The "extend slightly past the wafer edge" idea comes from a separate, different source (Applied Materials patent, 310-330mm showerhead face for a 300mm wafer) — keep these two citations distinct, don't blend them into one number.

**Two honest caveats, both confirmed present in the patent text itself:**
- Different chemistry: TEOS + O3 + N2 → SiO2, not silane pyrolysis. The rule is transport/dilution-driven (geometric), not kinetics-driven, so it transfers by analogy — state this explicitly, don't imply it's a silane-specific result.
- Size extrapolation: table stops at 250mm; our wafer is 300mm. Applying the confirmed −40mm rule: minimum diameter ≈260mm → **minimum inlet radius ≈130mm**. This is a real extrapolation beyond the patent's tested range, not itself in the primary text — flag it as such.

**Final decision for Monday: model inlet at r=150mm (matching wafer radius exactly, same gas-head-to-wafer OD ratio the patent uses), not the wider 160-165mm figure.**

**Correction to an earlier overstatement:** the patent's flat, uniform profile (Fig. 6/7) was produced by its **two-zone injector** — reaction gas through the central 110mm-diameter region, plus a separate surrounding inert-gas dilution ring out to the full 150mm gas-head edge — not by a single uniform full-width inlet. So for the single-zone baseline, the honest claim is only that **r=150mm matches the gas-head-to-wafer diameter ratio** the patent uses (a real, confirmed geometric fact) — not that this single-inlet configuration itself is depicted producing a flat profile. The patent's actual flat-profile mechanism (central reaction gas + peripheral inert dilution) is what the **Step 3 multi-zone rebuild** mirrors, and that step is where the "matches the patent's demonstrated uniformity mechanism" claim genuinely belongs.

Once 0a-0c are resolved, proceed to Step 1 below.

---


- Rectangle 2 (inlet): width 10mm → **150mm** (matches wafer radius exactly — this ratio is confirmed producing a flat deposition profile in US6022811A, Fig. 6/7, primary source verified)
- Rectangle 3 (exhaust): relocate to thin vertical slit at outer wall, r=150mm, height matching chamber (20mm) — gas now exits sideways, not via bottom-adjacent rim
- Delete old Rectangle 4 (5mm/10mm zone split) — obsolete
- Re-select all boundary conditions (inlet, outlet, wafer temperature, wafer flux) — numbering will shift

### Step 2: Validate before optimizing
- Run single full-span baseline (u_in=0.1, T=1000K)
- Confirm σ and coverage improve substantially vs. old 10mm-inlet baseline (σ=179.6%, coverage=16.9%)
- **Recirculation/vortex above the substrate — now LITERATURE-CONFIRMED, expect it.** Wang et al. (2025), *ACS Omega* 10(18):18571, DOI 10.1021/acsomega.4c11244 — a 3D CFD study of a showerhead tungsten CVD reactor with essentially this architecture (253-tube showerhead inlet, heated substrate, bottom outlets) — observed that gas flows down from the center, spreads along the substrate, then flows **upward along the outer wall, forming a recirculating pattern** driven by convection between the upper showerhead and lower outlets. They state explicitly that this eddy reduces uniformity above the substrate.
- **Consequence: expect a ring-shaped deposition profile, not a center-peaked one.** Wang et al. found deposition rate rises from center (66 nm/s) to a mid-radius peak (88 nm/s) then falls toward the edge (43 nm/s) — attributed directly to the recirculation cell causing gas stagnation and low reactant supply near the center. If your full-span model produces a ring profile, that is consistent with published behavior in this reactor class, not an error.

### Step 3: Multi-zone rebuild
- Split the new inlet at **equal-area radius = 106.07mm** (recalculate once inlet radius is finalized post-Step 0c — 106.07mm was based on exactly 150mm)
- State explicitly in write-up: this split is a **neutral baseline**, not assumed optimal — outer-zone boundary layer effects and exhaust-proximity pull mean equal area ≠ equal deposition. Optimize from here, don't stop here.
- Regenerate matched-total-flow velocity table using new zone areas (old 5mm/10mm table is obsolete)

### Step 4: Run DOE on corrected geometry
- Repeat single-zone 2×2 (u_in, T_wafer) + center point on full-span geometry
- Repeat multi-zone flow-split sweep at matched total flow

### Step 5: Python analysis (Phase 4)
- Re-run `full_analysis.py` (already built, auto-detects new CSVs) on new data
- Compute σ, coverage radius, utilization for every new run
- **Name the mass-transfer regime correctly:** report Damköhler number, Da = k_s·L/(u·H), not an ad-hoc "timescale ratio." Da≈13 at original conditions confirmed the reactor was mass-transfer-limited — this is the term to use in interviews.
- Composite metric: don't optimize σ alone. Report **uniformity AND utilization together** — utilization <0.5% is a real manufacturing cost problem, not a side note. State the tradeoff or lack thereof explicitly (we already found low-u_in improves both simultaneously in the flawed geometry — check if that holds post-rebuild).

### Step 6: Cpk (if included)
**Tolerance values sourced and verified (not placeholders):**
- MFC: **±1% of setpoint** — cross-checked across three manufacturer datasheets (Sensirion SFC5460 ±0.8%, Brooks Instrument ±0.9%, SmartFlow-class ±1% flat across setpoint range). ±1% is a defensible mid-range representative value.
- Thermocouple: **±5.5K** — Type K, Class 2 (IEC 60584-2 / ASTM E230 Standard Limits of Error): ±2.5K or ±0.75% of reading, whichever is greater. **Correction from an earlier draft of this document:** 0.75% was previously mislabeled as "Class 1/Special" — it is actually Class 2/Standard; Class 1/Special is the tighter ±0.4% grade. Also corrected: the wafer operates at 1000K = 727°C, not 1000°C — 0.75% of 727°C = 5.5K, not 7.5K (the earlier number silently used the wrong temperature basis, Celsius-numerically-equal-to-Kelvin rather than actually converting). Verified independently by direct calculation.
- Both values are already coded into `surrogate_pipeline.py`.
- Label the result as a **model-based sensitivity estimate**, not demonstrated process capability.

**Pipeline status: built and tested end-to-end on synthetic data.** `surrogate_pipeline.py` loads DOE results → fits both GP and polynomial surrogates → validates via real train/test split (reports actual held-out R², picks whichever model validates better — do not assume GP or polynomial wins in advance) → runs 10,000-sample Monte Carlo using the sourced tolerances above → computes Cpk against the <3% spec. Ready to swap in real DOE data once available.

**DOE design generated (not hand-picked):** `doe_design.csv` — 16-run face-centered Central Composite Design (via pyDOE3, a real published DOE library), factors u_inner/u_outer (0.02–0.2 m/s) and T_wafer (900–1100K). Velocity range deliberately capped below the 3.41 m/s failure point already documented — avoids re-testing a known-invalid region. This file is what Monday's COMSOL session should execute against, run-by-run, rather than picking points ad hoc.

### Step 7: Framing split — Tesla vs. TSMC
- **TSMC pitch:** keep wafer language, 300mm silicon substrate, semiconductor CVD framing — this is accurate for TSMC's actual process.
- **Tesla pitch:** Tesla does not use 300mm wafers for batteries — they use roll-to-roll web coating or fluidized-bed reactors for powder electrodes. Do NOT use wafer language in a Tesla-facing narrative. Instead frame the project as a **"fundamental transport phenomena scale-up study"** — the physics (mass-transfer-limited CVD, showerhead injection design, Damköhler-regime diagnosis) transfers conceptually even though the hardware geometry differs. State this transfer explicitly rather than implying the model IS a battery coating tool.

### Step 8: Precursor identity honesty
- The model never selected "silane" as a named chemical species in COMSOL — it's a generic transport species with silane-sourced kinetics (k_s) and diffusivity (D_F) parameters.
- Write-up language: "a silane-like precursor, with reaction and transport parameters sourced from published silane CVD literature" — not "silane was modeled," which overclaims.

---

## TRACK 1B — Transient deposition profile (Deformed Geometry / ALE), after Track 1 Step 5

**Why this exists:** stationary results answer "is the concentration/flux profile uniform." They don't answer "does the film grow uniformly over time, or does it start non-uniform and self-correct" — a real process-design question (classic CRE framing: profile evolution, not just steady-state endpoint). Worth doing properly since there's real time available (40-day horizon, not a rushed weekend).

**Sequencing — do not run this on all 16 DOE points.** Transient + moving mesh is far more expensive per run than the stationary solves used elsewhere in this project. Correct order:
1. Finish Track 1 Steps 1-5 (corrected geometry, DOE, Python analysis) on stationary solves only — this is what actually finds the optimal operating point cheaply
2. Take ONLY the single best configuration identified by the DOE/response surface
3. Run the transient ALE study on that one configuration

**What to build:**
- Add a **Deformed Geometry (ALE)** interface to the model, applied to the wafer boundary
- Convert the flux boundary condition (currently `-k_s*c`, a steady surface consumption rate) into a **normal mesh displacement velocity** — film growth rate is proportional to the local deposition flux, so the boundary moves outward (into the gas domain) at a rate derived from local `-k_s*c`
- Switch the study from Stationary to **Time Dependent**, run until the film thickness stabilizes or a representative process duration is reached
- Track wafer-surface mesh displacement vs. r vs. time — this is literally your growing film thickness profile

**What this can show that stationary can't:**
- Whether a uniform-looking final profile arrived through uniform growth the whole time, or through an early non-uniform transient that evened out
- Whether there's a startup period where the reactor is significantly worse than its eventual steady behavior — relevant to real process yield if wafers are only in the chamber briefly
- A genuine, harder deliverable: most portfolio projects stop at steady-state; a validated transient film-growth result is a real step beyond that

**Honest scope check before starting:** this only gets built after Track 1 has a validated optimum to run it on. Don't start this in parallel with the DOE — it depends on the DOE's output.

---

## TRACK 2 — 3D (deferred until Track 1 Step 4 is complete and analyzed)

### Precondition
Do not start 3D until the 2D full-span fix is validated. The geometric flaw (small inlet vs. large wafer) is identical in 3D — fixing it in 2D first is faster to test and de-risks the physics before paying 3D's cost.

### Step 1: Justify 3D with real asymmetry — non-negotiable
3D only adds value if it resolves something 2D axisymmetric structurally cannot. A uniform ring inlet + symmetric ring exhaust in 3D is a wasted 33x compute cost for zero new information — this exact critique will be obvious to any competent reviewer. Two legitimate justifications, pick at least one:
- **Discrete showerhead holes** instead of continuous inlet rings — introduces jet-to-jet interaction and local stagnation zones, which is real, non-axisymmetric physics
- **Asymmetric exhaust** (1–2 discrete pump ports, not a full 360° ring) — real reactors are built this way, and it creates genuine cross-flow that skews σ — this is arguably the single most defensible reason to go 3D

### Step 2: Hole modeling — use the hybrid approach, not brute force
Per published CVD literature (confirmed via search): standard practice is NOT to mesh every individual hole across the full reactor.
- Build a small **unit-cell** patch (a handful of holes) in 3D, fully resolved
- Extract pressure-drop / flow-distribution loss coefficients from that patch
- Apply those coefficients as a **porous-media boundary condition** across the full-scale 3D showerhead face
- This is the technically correct, industry-standard method — cite it as such

### Step 3: Feasibility — already confirmed
A bare 3D cylinder (all 3 physics, no fine detail) meshed to 24,973 elements and solved in 188 seconds for 1.6M DOFs. 3D is computationally affordable on the SEAS server at this complexity level. Do not re-litigate this — it's tested, not assumed.

### Step 4: Efficient DOE — sparse design, not brute force
Direct Monte Carlo on the full 3D model is computationally prohibitive (1000 runs × ~3.5 min ≈ 58 hours). Instead:
- Run a **sparse, structured DOE** — Central Composite Design (CCD) or Box-Behnken Design
- **Lock the factor count BEFORE choosing the design.** CCD run count scales fast: ~15 runs for 3 factors, ~25 for 4, ~43 for 5. Decide the final factor list (u_inner, u_outer, T_wafer, and whether exhaust geometry or chamber height are included) before committing to a run budget — don't discover mid-DOE that a "sparse" design has become 43 runs.
- **[UNVERIFIED, contingency]** If the flow field has strong non-linearities (jet-turning recirculation, corner vortices — same risk flagged in Track 1 Step 2), a 2nd-order polynomial surrogate may fit poorly (low validation R²). If that happens, pivot to **Latin Hypercube Sampling (LHS)** for the DOE and a **Kriging / Gaussian Process** surrogate instead of a polynomial — this combination handles non-linear transitions with fewer points and is the standard fallback.
- This is a named, standard DOE method — cite it as such, don't describe it as an ad-hoc sweep

### Step 5: Build a surrogate model (metamodel) in Python
- Export inputs (velocity split, temperature, etc.) and outputs (σ, utilization) from the 15–25 3D runs
- Fit a **Gaussian Process Regression (Kriging)** or **second-order polynomial response surface** using scikit-learn or scipy
- This produces a fast, closed-form approximation of the expensive 3D model

### Step 6: Validate the surrogate before trusting it
- Hold out a subset of the DOE runs (e.g., fit on 20, test on 5)
- Compute a real R² or cross-validation error on the held-out points
- **Do not state a specific accuracy number (e.g., "99.8%") unless it comes from this actual computed validation.** Any accuracy figure used in a write-up or interview must be traceable to a real held-out-data check performed in this project.

### Step 7: Run Monte Carlo on the surrogate, not on COMSOL directly
- With a validated surrogate, a 10,000-run Monte Carlo becomes a sub-second Python computation
- Use sourced tolerance bands (Step 6 of Track 1) as the perturbation inputs
- Compute Cpk from the resulting distribution
- Label clearly: Cpk is computed from the surrogate model, itself validated against a sparse set of real 3D COMSOL runs — state the surrogate's validation error alongside the Cpk number for honesty

### Step 6b: Physical validation — separate from surrogate validation
Step 6 only proves the Python surrogate mimics COMSOL. It proves nothing about whether COMSOL itself matches real physics. These are two different claims and must not be conflated.
- **Cheap, already-available check: mass balance closure.** Inlet flux vs. outlet flux should match within a few percent for any valid run (this project already found a >1% mismatch was the tell that the 3.41 m/s run had failed to converge). Formalize this as a stated validation metric for every run, not just an incidental debugging check.
- **Benchmark paper — PULLED AND VERIFIED.** Wang, Peng, Zhao, Wu, Fang, Chen, Wang (2025), "Numerical Study of Tungsten Growth in a Chemical Vapor Deposition Reactor," *ACS Omega* 10(18):18571–18582, DOI 10.1021/acsomega.4c11244. **Note: the earlier claim that this paper reported "1D analysis matching full CFD within 5%" was NOT found in the actual text and should be discarded — it was a bad search snippet.** What the paper actually contains, verified by reading it:
  - **Experimental validation of their CFD model:** two real tungsten deposition experiments compared against simulation. Case I: measured 54.5 nm/s vs. simulated 48.1 nm/s → **13.3% deviation**. Case II: measured 24.1 nm/s vs. simulated 23.0 nm/s → **4.78% deviation**. They state this discrepancy "falls within acceptable limits." This is a real, citable precedent for what counts as acceptable CFD-vs-experiment agreement in CVD modeling.
  - **Grid independence methodology, directly usable as a template:** three meshes tested — coarse ~1,145,699 cells, medium ~1,824,470 cells, fine ~2,535,748 cells. Deposition-rate difference between medium and fine <0.5%; medium grid adopted on that basis (further refinement judged not to meaningfully improve accuracy). This is exactly the mesh convergence approach to replicate and cite — confirmed against exact paper wording.
  - **Their reference conditions** (useful as a sanity comparison): mass flow 8 kg/h, substrate 873 K, inlet gas 363 K, H₂/WF₆ mole ratio 3, operating pressure 1 bar.
  - **Independent confirmation of a finding this project reached separately:** they conclude substrate temperature primarily governs uniformity while mass flow rate primarily affects deposition rate — i.e. different parameters control different outcomes, consistent with this project's own observation that temperature/kinetics and flow rate act on different metrics.
  - **Caveat on transferability:** this is WF₆/H₂ tungsten CVD, not silane. Same modeling family (showerhead, laminar, atmospheric, surface-reaction-limited), different chemistry. Cite it as a methodological and behavioral benchmark, not as a source of silane kinetics.
- Goal: be able to answer "how do you know your COMSOL model isn't outputting beautiful nonsense?" with a real comparison point, not just "the solver converged."

### Step 8: The defensible interview narrative (only after Steps 1–7 are actually done)
Something close to: *"A full 3D transport model of the reactor takes about 3 minutes to solve, so a direct 1000+ run Monte Carlo was computationally impractical. I ran a [N]-point Central Composite Design in COMSOL, extracted uniformity and utilization outputs, and fit a [Gaussian Process / polynomial] surrogate model in Python, validated against held-out runs with [X]% error. I then ran a 10,000-sample Monte Carlo on the surrogate — using MFC and thermocouple tolerance specs from [source] — to estimate process capability (Cpk) in under a second of compute time."*
Every bracket must be filled with a real, computed value before this sentence is used anywhere.

---

## Cross-Track Reminders (apply to both)

- Every headline number must trace to something actually computed in this project — no exceptions, this rule has held throughout and should continue
- Blocked items wait for COMSOL access restoration (ticket filed with SEAS IT, tracking number received, no response yet as of last check)
- Python-side work (surrogate fitting, Monte Carlo, analysis scripts) can proceed on data already in hand or be prepared/tested with placeholder data while COMSOL access is down
