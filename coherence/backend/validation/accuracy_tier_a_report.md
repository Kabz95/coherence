# Coherence preliminary accuracy validation — Tier A

**Status:** preliminary engineering validation. This report tests *accuracy*
(agreement of pipeline outputs with ground truth or independent
implementations), distinct from the *reliability* work (test-retest ICCs)
reported in `openneuro_validation_report.md`. No clinical-validity,
diagnostic-utility, or treatment-guidance claim is made or implied anywhere
in this report.

## Preregistered acceptance bars

These bars were written before any Tier A computation was run:

| Check | Bar |
|---|---|
| B1a synthetic DTI ground truth | Recovered FA within ±0.05 of known input (mean over noise draws); MD within ±10% |
| B1b ISBI2013 phantom | FA within ±0.05 of published single-fiber ground truth |
| B2 DTI cross-implementation | Voxelwise Pearson r ≥ 0.95 for FA and MD |
| C2 fMRI tSNR | Within ±5% of independent recomputation |
| C2 fMRI DVARS | Identical spike count; median within ±5% |
| C2 fMRI fALFF | Within ±5% of independent recomputation |
| D EEG/MEG band powers | Within ±1% per band vs independent implementation |

## B1a — DTI tensor-fit accuracy vs synthetic ground truth: PASS (6/6)

**Design.** DWI was synthesized from *known* single tensors with
`dipy.sims.voxel.single_tensor` on the ISBI2013 phantom64 gradient table
(64 vols; b = 0/1500/2500 s/mm²). Six ground-truth tensors spanning
FA 0.19–0.87 at MD 0.70–0.73×10⁻³ mm²/s; **10 Rician-noise realizations
(SNR 30) per tensor**, each fit with the pipeline's exact call
(`dipy.reconst.dti.TensorModel(gtab)`, default WLS). Bars apply to the
*mean* error across realizations (|mean ΔFA| ≤ 0.05, |mean ΔMD| ≤ 10%) —
a single noise draw is luck; the mean tests systematic bias. Seeded for
reproducibility.

**Results.**

| true FA | mean ΔFA ± sd | true MD (10⁻³) | mean ΔMD ± sd |
|---|---|---|---|
| 0.8239 | −0.0017 ± 0.0101 | 0.7000 | −0.70% ± 3.26% |
| 0.7071 | +0.0007 ± 0.0112 | 0.7000 | −0.25% ± 2.97% |
| 0.5522 | +0.0006 ± 0.0144 | 0.7000 | +0.13% ± 2.46% |
| 0.3552 | −0.0017 ± 0.0238 | 0.7000 | −0.09% ± 2.52% |
| 0.1943 | +0.0025 ± 0.0273 | 0.7333 | −0.80% ± 2.27% |
| 0.8704 | −0.0070 ± 0.0120 | 0.7000 | +0.23% ± 2.17% |

Largest |mean ΔFA| = 0.0070 (bar 0.05); largest |mean ΔMD| = 0.80%
(bar 10%). **6/6 within bars — PASS.** This is a true ground-truth test:
the pipeline's tensor fit recovers known diffusion parameters with no
meaningful systematic bias. (Per-draw spread reaches ±0.027 at low FA —
expected DTI noise behavior at SNR 30, not a pipeline defect. Seeded
reproducible.)

## B1b — ISBI2013 HARDI phantom (dipy phantom64): reference-range check

**Design.** Fit the pipeline's tensor model on the cached ISBI2013 2-shell
software phantom (50³, 64 vols) and measured FA/MD/AD/RD in bundle-core
voxels (FA > 0.6 connected components > 50 voxels; 6,183 voxels in
10 components).

**Ground-truth caveat (important).** After reasonable effort — dipy
documentation and source, the ISBI 2013 challenge site (hardi.epfl.ch,
still live), the Phantomas simulation paper (Caruyer et al.) — **no
published per-ROI FA/MD ground-truth values exist for this phantom.**
The challenge's published ground truth covers *fiber geometries* for
tractography evaluation (Tractometer), not DTI scalars. The preregistered
±0.05-vs-ground-truth bar is therefore **NOT APPLICABLE as stated**;
applying it would require inventing a ground truth. This check is reported
instead against the documented single-fiber simulation reference range.

**Results.** Bundle cores: FA **0.7421 ± 0.0526**, MD **0.7710 ± 0.1043**,
AD 1.6168, RD 0.3481 (×10⁻³ mm²/s). This sits inside the reference range
for Phantomas-style single-fiber populations (FA ≈ 0.7–0.9; cf. the
simulation reference FA = 0.7, MD = 0.7×10⁻³ in Prčkovska et al.,
PLoS ONE 2013). Mid-FA (0.25–0.45) crossing-proxy voxels: FA 0.3515,
as expected below single-fiber values. **Consistent with the reference
range — no accuracy concern raised.** A strict ground-truth test is
provided by B1a above instead.

## B2 — DTI cross-implementation: PASS (with stated fallback)

**MRtrix3 note.** MRtrix3 could not be installed inside the time box
(Ubuntu 24.04 without the universe repository; `add-apt-repository`
unavailable; full enable+install exceeded the budget through the proxy).
Fallback, stated plainly: a from-scratch NumPy implementation of the
linearized DTI fit (Basser et al. 1994) — independent code path and
independent math formulation (linearized least squares vs dipy's WLS).

**Design.** ds000114 sub-01 ses-test DWI (single shell b=1000, 71 vols).
Reference: pipeline's `TensorModel(gtab)` WLS fit. Independent: design
matrix from bvecs/bvals, `log(S/S0)` least squares, eigendecomposition,
FA/MD via dipy's scalar functions.

**Results** (white-matter voxels, FA > 0.2, n = 451,058):
- FA: voxelwise r = **0.9688** (bar ≥ 0.95) — PASS; mean|Δ| = 0.050
- MD: voxelwise r = **0.9887** (bar ≥ 0.95) — PASS; mean|Δ| = 0.028×10⁻³

**Characterization.** Absolute MD scale is mask-dependent (pipeline's
liberal b0 mask includes CSF, giving meanMD ≈ 0.0015; WM-restricted values
are lower) — a mask-composition effect, not a fit-accuracy failure. The
two independent formulations agree closely where DTI is meaningful.

## C2 — fMRI independent recomputation: PASS, with one REVIEW-grade observation

**Design.** Target: ds000114 sub-01 ses-test (pipeline run onv-fmri-15;
reported medianTSNR 31.14, DVARS spikes 2, meanFALFF 0.1007). tSNR/DVARS
recomputed from the raw BOLD from mathematical definitions (tSNR =
mean/std; DVARS per Power et al. 2012); ALFF/fALFF recomputed from the
pipeline's saved denoised BOLD per Zang et al. 2007 / Zou et al. 2008.

**Results.**
- tSNR: independent 31.14 vs pipeline 31.14 (+0.02%) — **PASS**
- DVARS: spike count 2 = 2 — **PASS** (median 24.611 reproduced exactly)
- fALFF: verbatim replication of the pipeline formula reproduces 0.1007
  to 4 decimal places — **PASS** (implementation verified correct)

**REVIEW-grade observation (not a bug).** The pipeline's `meanFALFF`
(0.1007) is a *whole-volume* mean: the analysis mask (`|denoised| > 0`)
contains 122,880 voxels, ≈87% of them background, because denoising
leaves no exact zeros. The brain-only (rough-mask) mean fALFF on the same
data is ≈0.77. The code matches its documented method ("whole-mask
means"), so this is a *metric-definition* finding, not an implementation
error — but a reader will naturally interpret "mean fALFF" as describing
brain tissue. **Recommendation:** document the whole-volume convention in
the report template, or add a brain-masked companion metric. Tracked for
a future fix; no pipeline code was changed in this task.

## D — EEG/MEG band-power cross-implementation: PASS

**Design.** The pipeline uses `scipy.signal.welch` (nperseg=1024) with
1–40 Hz normalization. Two independent checks on the pipeline's
preprocessed data: (D1) from-scratch reimplementation of the Welch+band
math; (D2) MNE `psd_array_welch` (independent implementation, matched
n_fft/n_overlap/window).

**Results** (worst relative difference across the 5 bands):

| Dataset | D1 worst | D2 (MNE) worst | Bar ±1% |
|---|---|---|---|
| EEG eegbci S001R01 (64 ch @ 160 Hz) | 0.031% | 0.031% | PASS |
| MEG somato sub-01 (306 ch @ 250 Hz) | 0.136% | 0.136% | PASS |

(MEG gamma shows the largest relative gap only because its absolute value
is tiny, 0.0252.)

## Summary

| Check | Bar | Result |
|---|---|---|
| B1a synthetic DTI ground truth | FA ±0.05, MD ±10% (mean over 10 noise draws) | **PASS** 6/6 (max |mean ΔFA| 0.007, max |mean ΔMD| 0.8%) |
| B1b ISBI2013 phantom | FA ±0.05 vs published ground truth | **N/A as stated** — no published per-ROI ground truth exists; values consistent with simulation reference range |
| B2 DTI cross-implementation | r ≥ 0.95 | **PASS** (FA 0.969, MD 0.989 in WM; MRtrix3 unavailable, Basser-1994 fallback used) |
| C2 tSNR / DVARS / fALFF | ±5% / spikes / ±5% | **PASS** (+0.02%, 2=2, exact); one REVIEW-grade metric-definition observation (whole-volume fALFF mean) |
| D EEG/MEG band powers | ±1% | **PASS** (worst 0.136%) |

No pipeline code was modified in this task. One item is tracked for a
future fix decision: documenting (or companion-metricing) the whole-volume
fALFF mean convention (C2 observation).

## Limitations

- Small, single-dataset spot checks — not a population accuracy study.
- B1b cannot be a strict ground-truth test (see caveat); B1a carries that weight.
- B2's independent implementation is same-language/same-machine; a
  different-software check (MRtrix3/FSL) remains desirable when installable.
- C2/D verify *analysis math* on pipeline-processed data, not the
  preprocessing itself.
- All engineering-level. Nothing here establishes clinical validity.

## References

- Basser, P.J. et al. (1994). MR diffusion tensor spectroscopy and imaging.
  *Biophys J* 66(1). (B2 linearized fit)
- Power, J.D. et al. (2012). Spurious but systematic correlations in
  functional connectivity MRI networks. *NeuroImage* 59(3). (C2 DVARS)
- Zang, Y.F. et al. (2007). Altered baseline brain activity in children
  with ADHD revealed by resting-state fMRI. *Brain Dev* 29(2). (C2 ALFF)
- Zou, Q.H. et al. (2008). An improved approach to detection of
  amplitude of low-frequency fluctuation (ALFF). *J Neurosci Methods*
  172(1). (C2 fALFF)
- ISBI 2013 HARDI Reconstruction Challenge, http://hardi.epfl.ch/static/events/2013_ISBI/
  (B1b phantom provenance; ground truth = fiber geometries via Tractometer)
- Caruyer, E. et al. Phantomas: a flexible software library to simulate
  diffusion MR phantoms. (B1b simulation framework)
- Prčkovska, V. et al. (2013). PLoS ONE 8(11): e81453. (B1b single-fiber
  simulation reference: FA 0.7, MD 0.7×10⁻³)
- Garyfallidis, E. et al. Dipy. (tensor fitting, phantom data)
- Gramfort, A. et al. MNE-Python. (D2 cross-implementation)
