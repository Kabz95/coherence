# Coherence pipeline preliminary validation — real-data run

Run at 2026-10-13 02:29 UTC.
Each modality chain ran offline (FakeContext, local artifacts) on the
public dataset noted. Sanity items marked REVIEW need a human look;
they are not assertions. Nothing here is diagnostic.

## structural

Dataset: ICBM152 2009a T1 template (nilearn fetch_icbm152_2009) — template brain

- `converter`: **completed**
- `qc`: **completed**
- `structural_prep`: **completed**
- `structural_analysis`: **completed** (1 warnings)
- `structural_3d_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- totalIntracranialVolumeMl: 2085.27

Sanity checks:
- ✅ TICV plausible (800-2200 mL): PASS

Pipeline warnings (expected on real data, review-worthy):
  - [structural_analysis] FastSurfer not installed; using built-in mask volumetry (no cortical thickness).

## diffusion

Dataset: ISBI2013 HARDI phantom64 (dipy fetch_isbi2013_2shell) — physical dMRI phantom

- `converter`: **completed** (2 warnings)
- `diffusion_prep`: **completed** (1 warnings)
- `diffusion_analysis`: **completed**
- `diffusion_3d_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- meanFA: 0.1034
- meanMD: 0.000266
- meanAD: 0.000335
- meanRD: 0.000232

Sanity checks:
- ✅ mean FA in [0,1]: PASS
- ✅ mean MD positive & small: PASS

Pipeline warnings (expected on real data, review-worthy):
  - [converter] Skipped 'dwi_phantom.bval': unsupported extension for conversion.
  - [converter] Skipped 'dwi_phantom.bvec': unsupported extension for conversion.
  - [diffusion_prep] No eddy-current/motion correction performed (requires FSL eddy); results carry this limitation.

## fmri

Dataset: SPM auditory MoAEpilot sub-01 BOLD, 84 vols TR=2s (nilearn fetch_spm_auditory) — task fMRI; harness-written RepetitionTime sidecar

- `converter`: **completed** (1 warnings)
- `fmri_ingest`: **completed**
- `fmri_prep`: **completed** (1 warnings)
- `fmri_analysis`: **completed**
- `fmri_visualization_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- medianTSNR: 31.84
- dvarsSpikeVolumes: 0
- meanALFF: 1.0
- meanFALFF: 0.1677
- trSec: 2.0

Sanity checks:
- ✅ median tSNR > 0: PASS
- ✅ mean ALFF standardized ~1: PASS

Pipeline warnings (expected on real data, review-worthy):
  - [converter] Skipped 'bold.json': unsupported extension for conversion.
  - [fmri_prep] No motion correction, distortion correction, or normalization performed (requires fMRIPrep/FSL); results carry this limitation.

## eeg

Dataset: eegbci S001R01 (mne / PhysioNet), 64 ch @ 160 Hz — real motor-imagery EEG

- `eeg_ingest`: **completed**
- `eeg_prep`: **completed**
- `eeg_analysis`: **completed**
- `eeg_visualization_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- delta: 0.584
- theta: 0.1572
- alpha: 0.112
- beta: 0.1246
- gamma: 0.0221

Sanity checks:
- ✅ relative band powers sum ~1: PASS

## meg

Dataset: somato sub-01_task-somato_meg.fif cropped to 120 s (mne) — real MEG, 306 channels @ 300 Hz

- `meg_ingest`: **completed**
- `meg_prep`: **completed**
- `meg_analysis`: **completed**
- `meg_visualization_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- delta: 0.178
- theta: 0.1539
- alpha: 0.3968
- beta: 0.246
- gamma: 0.0252

Sanity checks:
- ✅ relative band powers sum ~1: PASS
