# Coherence pipeline preliminary validation -- OpenNeuro round

Run at 2026-10-13 01:14 UTC.
Each acquisition ran its full modality chain offline (FakeContext,
local artifacts) on the public OpenNeuro dataset noted. ICC(1,1) is
reported for test-retest repeats; items marked REVIEW need a human
look and are not assertions. This measures pipeline behavior on real
data -- repeatability and robustness -- not clinical validity.
Nothing here is diagnostic.

## Datasets

- **ds000239** Maclaren et al. 2014 test-retest brain volumes: 3 subjects x 5 T1w runs (GE 3T, ADNI IR-SPGR). Cite: Maclaren et al., Sci Data 1:140037 (2014).
- **ds000114** test-retest fMRI (motor/language/spatial attention): 3 subjects x test/retest sessions, finger-foot-lips task, TR 2.5 s; 1 subject x test/retest single-shell DWI (shared bval/bvec).
- **ds003007** resting-state fMRI, mild depression, eyes closed: 3 subjects (no-treatment / CBT / NFB groups) x pre/post sessions (2-month interval), TR 2.5 s. Descriptive only.
- **ds000117** face-processing MEG: 1 subject, Neuromag 306 ch, cropped to 120 s for validation speed.
- **ds002718** face-recognition EEG: 1 subject, EEGLAB .set @ 250 Hz, converted to EDF by the harness.

## structural -- ds000239 sub-01 run-01

Maclaren et al. 2014 test-retest T1w (GE 3T ADNI IR-SPGR), via OpenNeuro ds000239

- `converter`: **completed**
- `qc`: **completed**
- `structural_prep`: **completed**
- `structural_analysis`: **completed** (1 warnings)
- `structural_3d_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- totalIntracranialVolumeMl: 1821.43
- leftHemisphereVolumeMl: 915.8
- rightHemisphereVolumeMl: 905.63

Pipeline warnings:
  - [structural_analysis] FastSurfer not installed; using built-in mask volumetry (no cortical thickness).

## structural -- ds000239 sub-01 run-02

Maclaren et al. 2014 test-retest T1w (GE 3T ADNI IR-SPGR), via OpenNeuro ds000239

- `converter`: **completed**
- `qc`: **completed**
- `structural_prep`: **completed**
- `structural_analysis`: **completed** (1 warnings)
- `structural_3d_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- totalIntracranialVolumeMl: 1656.87
- leftHemisphereVolumeMl: 846.96
- rightHemisphereVolumeMl: 809.91

Pipeline warnings:
  - [structural_analysis] FastSurfer not installed; using built-in mask volumetry (no cortical thickness).

## structural -- ds000239 sub-01 run-03

Maclaren et al. 2014 test-retest T1w (GE 3T ADNI IR-SPGR), via OpenNeuro ds000239

- `converter`: **completed**
- `qc`: **completed**
- `structural_prep`: **completed**
- `structural_analysis`: **completed** (1 warnings)
- `structural_3d_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- totalIntracranialVolumeMl: 1873.63
- leftHemisphereVolumeMl: 948.6
- rightHemisphereVolumeMl: 925.03

Pipeline warnings:
  - [structural_analysis] FastSurfer not installed; using built-in mask volumetry (no cortical thickness).

## structural -- ds000239 sub-01 run-04

Maclaren et al. 2014 test-retest T1w (GE 3T ADNI IR-SPGR), via OpenNeuro ds000239

- `converter`: **completed**
- `qc`: **completed**
- `structural_prep`: **completed**
- `structural_analysis`: **completed** (1 warnings)
- `structural_3d_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- totalIntracranialVolumeMl: 1854.24
- leftHemisphereVolumeMl: 928.46
- rightHemisphereVolumeMl: 925.78

Pipeline warnings:
  - [structural_analysis] FastSurfer not installed; using built-in mask volumetry (no cortical thickness).

## structural -- ds000239 sub-01 run-05

Maclaren et al. 2014 test-retest T1w (GE 3T ADNI IR-SPGR), via OpenNeuro ds000239

- `converter`: **completed**
- `qc`: **completed**
- `structural_prep`: **completed**
- `structural_analysis`: **completed** (1 warnings)
- `structural_3d_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- totalIntracranialVolumeMl: 1431.42
- leftHemisphereVolumeMl: 717.33
- rightHemisphereVolumeMl: 714.09

Pipeline warnings:
  - [structural_analysis] FastSurfer not installed; using built-in mask volumetry (no cortical thickness).

## structural -- ds000239 sub-02 run-01

Maclaren et al. 2014 test-retest T1w (GE 3T ADNI IR-SPGR), via OpenNeuro ds000239

- `converter`: **completed**
- `qc`: **completed**
- `structural_prep`: **completed**
- `structural_analysis`: **completed** (1 warnings)
- `structural_3d_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- totalIntracranialVolumeMl: 1895.22
- leftHemisphereVolumeMl: 950.46
- rightHemisphereVolumeMl: 944.75

Pipeline warnings:
  - [structural_analysis] FastSurfer not installed; using built-in mask volumetry (no cortical thickness).

## structural -- ds000239 sub-02 run-02

Maclaren et al. 2014 test-retest T1w (GE 3T ADNI IR-SPGR), via OpenNeuro ds000239

- `converter`: **completed**
- `qc`: **completed**
- `structural_prep`: **completed**
- `structural_analysis`: **completed** (1 warnings)
- `structural_3d_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- totalIntracranialVolumeMl: 1864.28
- leftHemisphereVolumeMl: 937.39
- rightHemisphereVolumeMl: 926.89

Pipeline warnings:
  - [structural_analysis] FastSurfer not installed; using built-in mask volumetry (no cortical thickness).

## structural -- ds000239 sub-02 run-03

Maclaren et al. 2014 test-retest T1w (GE 3T ADNI IR-SPGR), via OpenNeuro ds000239

- `converter`: **completed**
- `qc`: **completed**
- `structural_prep`: **completed**
- `structural_analysis`: **completed** (1 warnings)
- `structural_3d_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- totalIntracranialVolumeMl: 1542.35
- leftHemisphereVolumeMl: 769.9
- rightHemisphereVolumeMl: 772.45

Pipeline warnings:
  - [structural_analysis] FastSurfer not installed; using built-in mask volumetry (no cortical thickness).

## structural -- ds000239 sub-02 run-04

Maclaren et al. 2014 test-retest T1w (GE 3T ADNI IR-SPGR), via OpenNeuro ds000239

- `converter`: **completed**
- `qc`: **completed**
- `structural_prep`: **completed**
- `structural_analysis`: **completed** (1 warnings)
- `structural_3d_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- totalIntracranialVolumeMl: 1527.32
- leftHemisphereVolumeMl: 758.68
- rightHemisphereVolumeMl: 768.65

Pipeline warnings:
  - [structural_analysis] FastSurfer not installed; using built-in mask volumetry (no cortical thickness).

## structural -- ds000239 sub-02 run-05

Maclaren et al. 2014 test-retest T1w (GE 3T ADNI IR-SPGR), via OpenNeuro ds000239

- `converter`: **completed**
- `qc`: **completed**
- `structural_prep`: **completed**
- `structural_analysis`: **completed** (1 warnings)
- `structural_3d_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- totalIntracranialVolumeMl: 1849.36
- leftHemisphereVolumeMl: 916.64
- rightHemisphereVolumeMl: 932.72

Pipeline warnings:
  - [structural_analysis] FastSurfer not installed; using built-in mask volumetry (no cortical thickness).

## structural -- ds000239 sub-03 run-01

Maclaren et al. 2014 test-retest T1w (GE 3T ADNI IR-SPGR), via OpenNeuro ds000239

- `converter`: **completed**
- `qc`: **completed**
- `structural_prep`: **completed**
- `structural_analysis`: **completed** (1 warnings)
- `structural_3d_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- totalIntracranialVolumeMl: 952.04
- leftHemisphereVolumeMl: 479.58
- rightHemisphereVolumeMl: 472.46

Pipeline warnings:
  - [structural_analysis] FastSurfer not installed; using built-in mask volumetry (no cortical thickness).

## structural -- ds000239 sub-03 run-02

Maclaren et al. 2014 test-retest T1w (GE 3T ADNI IR-SPGR), via OpenNeuro ds000239

- `converter`: **completed**
- `qc`: **completed**
- `structural_prep`: **completed**
- `structural_analysis`: **completed** (1 warnings)
- `structural_3d_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- totalIntracranialVolumeMl: 961.93
- leftHemisphereVolumeMl: 481.8
- rightHemisphereVolumeMl: 480.13

Pipeline warnings:
  - [structural_analysis] FastSurfer not installed; using built-in mask volumetry (no cortical thickness).

## structural -- ds000239 sub-03 run-03

Maclaren et al. 2014 test-retest T1w (GE 3T ADNI IR-SPGR), via OpenNeuro ds000239

- `converter`: **completed**
- `qc`: **completed**
- `structural_prep`: **completed**
- `structural_analysis`: **completed** (1 warnings)
- `structural_3d_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- totalIntracranialVolumeMl: 1011.53
- leftHemisphereVolumeMl: 497.19
- rightHemisphereVolumeMl: 514.34

Pipeline warnings:
  - [structural_analysis] FastSurfer not installed; using built-in mask volumetry (no cortical thickness).

## structural -- ds000239 sub-03 run-04

Maclaren et al. 2014 test-retest T1w (GE 3T ADNI IR-SPGR), via OpenNeuro ds000239

- `converter`: **completed**
- `qc`: **completed**
- `structural_prep`: **completed**
- `structural_analysis`: **completed** (1 warnings)
- `structural_3d_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- totalIntracranialVolumeMl: 990.8
- leftHemisphereVolumeMl: 502.11
- rightHemisphereVolumeMl: 488.69

Pipeline warnings:
  - [structural_analysis] FastSurfer not installed; using built-in mask volumetry (no cortical thickness).

## structural -- ds000239 sub-03 run-05

Maclaren et al. 2014 test-retest T1w (GE 3T ADNI IR-SPGR), via OpenNeuro ds000239

- `converter`: **completed**
- `qc`: **completed**
- `structural_prep`: **completed**
- `structural_analysis`: **completed** (1 warnings)
- `structural_3d_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- totalIntracranialVolumeMl: 979.41
- leftHemisphereVolumeMl: 499.78
- rightHemisphereVolumeMl: 479.63

Pipeline warnings:
  - [structural_analysis] FastSurfer not installed; using built-in mask volumetry (no cortical thickness).

## fmri -- ds000114 sub-01 ses-test

OpenNeuro ds000114 test-retest fMRI, finger-foot-lips task, TR 2.5 s

- `converter`: **completed** (1 warnings)
- `fmri_ingest`: **completed**
- `fmri_prep`: **completed** (1 warnings)
- `fmri_analysis`: **completed**
- `fmri_visualization_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- medianTSNR: 31.14
- dvarsSpikeVolumes: 2
- meanALFF: 1.0
- meanFALFF: 0.1007

Pipeline warnings:
  - [converter] Skipped 'onv_fmri_ds000114_sub-01_ses-test.json': unsupported extension for conversion.
  - [fmri_prep] No motion correction, distortion correction, or normalization performed (requires fMRIPrep/FSL); results carry this limitation.

## fmri -- ds000114 sub-01 ses-retest

OpenNeuro ds000114 test-retest fMRI, finger-foot-lips task, TR 2.5 s

- `converter`: **completed** (1 warnings)
- `fmri_ingest`: **completed**
- `fmri_prep`: **completed** (1 warnings)
- `fmri_analysis`: **completed**
- `fmri_visualization_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- medianTSNR: 40.31
- dvarsSpikeVolumes: 1
- meanALFF: 1.0
- meanFALFF: 0.0946

Pipeline warnings:
  - [converter] Skipped 'onv_fmri_ds000114_sub-01_ses-retest.json': unsupported extension for conversion.
  - [fmri_prep] No motion correction, distortion correction, or normalization performed (requires fMRIPrep/FSL); results carry this limitation.

## fmri -- ds000114 sub-02 ses-test

OpenNeuro ds000114 test-retest fMRI, finger-foot-lips task, TR 2.5 s

- `converter`: **completed** (1 warnings)
- `fmri_ingest`: **completed**
- `fmri_prep`: **completed** (1 warnings)
- `fmri_analysis`: **completed**
- `fmri_visualization_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- medianTSNR: 52.89
- dvarsSpikeVolumes: 1
- meanALFF: 1.0
- meanFALFF: 0.1091

Pipeline warnings:
  - [converter] Skipped 'onv_fmri_ds000114_sub-02_ses-test.json': unsupported extension for conversion.
  - [fmri_prep] No motion correction, distortion correction, or normalization performed (requires fMRIPrep/FSL); results carry this limitation.

## fmri -- ds000114 sub-02 ses-retest

OpenNeuro ds000114 test-retest fMRI, finger-foot-lips task, TR 2.5 s

- `converter`: **completed** (1 warnings)
- `fmri_ingest`: **completed**
- `fmri_prep`: **completed** (1 warnings)
- `fmri_analysis`: **completed**
- `fmri_visualization_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- medianTSNR: 45.01
- dvarsSpikeVolumes: 1
- meanALFF: 1.0
- meanFALFF: 0.1101

Pipeline warnings:
  - [converter] Skipped 'onv_fmri_ds000114_sub-02_ses-retest.json': unsupported extension for conversion.
  - [fmri_prep] No motion correction, distortion correction, or normalization performed (requires fMRIPrep/FSL); results carry this limitation.

## fmri -- ds000114 sub-03 ses-test

OpenNeuro ds000114 test-retest fMRI, finger-foot-lips task, TR 2.5 s

- `converter`: **completed** (1 warnings)
- `fmri_ingest`: **completed**
- `fmri_prep`: **completed** (1 warnings)
- `fmri_analysis`: **completed**
- `fmri_visualization_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- medianTSNR: 43.44
- dvarsSpikeVolumes: 1
- meanALFF: 1.0
- meanFALFF: 0.1075

Pipeline warnings:
  - [converter] Skipped 'onv_fmri_ds000114_sub-03_ses-test.json': unsupported extension for conversion.
  - [fmri_prep] No motion correction, distortion correction, or normalization performed (requires fMRIPrep/FSL); results carry this limitation.

## fmri -- ds000114 sub-03 ses-retest

OpenNeuro ds000114 test-retest fMRI, finger-foot-lips task, TR 2.5 s

- `converter`: **completed** (1 warnings)
- `fmri_ingest`: **completed**
- `fmri_prep`: **completed** (1 warnings)
- `fmri_analysis`: **completed**
- `fmri_visualization_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- medianTSNR: 51.14
- dvarsSpikeVolumes: 1
- meanALFF: 1.0
- meanFALFF: 0.1073

Pipeline warnings:
  - [converter] Skipped 'onv_fmri_ds000114_sub-03_ses-retest.json': unsupported extension for conversion.
  - [fmri_prep] No motion correction, distortion correction, or normalization performed (requires fMRIPrep/FSL); results carry this limitation.

## diffusion -- ds000114 sub-01 ses-test

OpenNeuro ds000114 test-retest DWI (shared top-level bval/bvec; volume count verified at staging)

- `converter`: **completed** (2 warnings)
- `diffusion_prep`: **completed** (1 warnings)
- `diffusion_analysis`: **completed**
- `diffusion_3d_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- meanFA: 0.1375
- meanMD: 0.001527
- meanAD: 0.001708
- meanRD: 0.001436

Pipeline warnings:
  - [converter] Skipped 'onv_dwi_ds000114_sub-01_ses-test.bval': unsupported extension for conversion.
  - [converter] Skipped 'onv_dwi_ds000114_sub-01_ses-test.bvec': unsupported extension for conversion.
  - [diffusion_prep] No eddy-current/motion correction performed (requires FSL eddy); results carry this limitation.

## diffusion -- ds000114 sub-01 ses-retest

OpenNeuro ds000114 test-retest DWI (shared top-level bval/bvec; volume count verified at staging)

- `converter`: **completed** (2 warnings)
- `diffusion_prep`: **completed** (1 warnings)
- `diffusion_analysis`: **completed**
- `diffusion_3d_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- meanFA: 0.1422
- meanMD: 0.001473
- meanAD: 0.001654
- meanRD: 0.001383

Pipeline warnings:
  - [converter] Skipped 'onv_dwi_ds000114_sub-01_ses-retest.bval': unsupported extension for conversion.
  - [converter] Skipped 'onv_dwi_ds000114_sub-01_ses-retest.bvec': unsupported extension for conversion.
  - [diffusion_prep] No eddy-current/motion correction performed (requires FSL eddy); results carry this limitation.

## fmri -- ds003007 sub-01 ses-pre

OpenNeuro ds003007 resting-state fMRI, depression, eyes closed, TR 2.5 s; group=depr_no_treatment; pre/post 2-month interval. DESCRIPTIVE ONLY -- not test-retest.

- `converter`: **completed** (1 warnings)
- `fmri_ingest`: **completed**
- `fmri_prep`: **completed** (1 warnings)
- `fmri_analysis`: **completed**
- `fmri_visualization_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- medianTSNR: 79.35
- dvarsSpikeVolumes: 2
- meanALFF: 1.0
- meanFALFF: 0.1288

Pipeline warnings:
  - [converter] Skipped 'onv_fmri_ds003007_sub-01_ses-pre.json': unsupported extension for conversion.
  - [fmri_prep] No motion correction, distortion correction, or normalization performed (requires fMRIPrep/FSL); results carry this limitation.

## fmri -- ds003007 sub-01 ses-post

OpenNeuro ds003007 resting-state fMRI, depression, eyes closed, TR 2.5 s; group=depr_no_treatment; pre/post 2-month interval. DESCRIPTIVE ONLY -- not test-retest.

- `converter`: **completed** (1 warnings)
- `fmri_ingest`: **completed**
- `fmri_prep`: **completed** (1 warnings)
- `fmri_analysis`: **completed**
- `fmri_visualization_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- medianTSNR: 85.92
- dvarsSpikeVolumes: 0
- meanALFF: 1.0
- meanFALFF: 0.1268

Pipeline warnings:
  - [converter] Skipped 'onv_fmri_ds003007_sub-01_ses-post.json': unsupported extension for conversion.
  - [fmri_prep] No motion correction, distortion correction, or normalization performed (requires fMRIPrep/FSL); results carry this limitation.

## fmri -- ds003007 sub-20 ses-pre

OpenNeuro ds003007 resting-state fMRI, depression, eyes closed, TR 2.5 s; group=depr_cbt; pre/post 2-month interval. DESCRIPTIVE ONLY -- not test-retest.

- `converter`: **completed** (1 warnings)
- `fmri_ingest`: **completed**
- `fmri_prep`: **completed** (1 warnings)
- `fmri_analysis`: **completed**
- `fmri_visualization_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- medianTSNR: 84.98
- dvarsSpikeVolumes: 1
- meanALFF: 1.0
- meanFALFF: 0.1169

Pipeline warnings:
  - [converter] Skipped 'onv_fmri_ds003007_sub-20_ses-pre.json': unsupported extension for conversion.
  - [fmri_prep] No motion correction, distortion correction, or normalization performed (requires fMRIPrep/FSL); results carry this limitation.

## fmri -- ds003007 sub-20 ses-post

OpenNeuro ds003007 resting-state fMRI, depression, eyes closed, TR 2.5 s; group=depr_cbt; pre/post 2-month interval. DESCRIPTIVE ONLY -- not test-retest.

- `converter`: **completed** (1 warnings)
- `fmri_ingest`: **completed**
- `fmri_prep`: **completed** (1 warnings)
- `fmri_analysis`: **completed**
- `fmri_visualization_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- medianTSNR: 72.26
- dvarsSpikeVolumes: 2
- meanALFF: 1.0
- meanFALFF: 0.1156

Pipeline warnings:
  - [converter] Skipped 'onv_fmri_ds003007_sub-20_ses-post.json': unsupported extension for conversion.
  - [fmri_prep] No motion correction, distortion correction, or normalization performed (requires fMRIPrep/FSL); results carry this limitation.

## fmri -- ds003007 sub-22 ses-pre

OpenNeuro ds003007 resting-state fMRI, depression, eyes closed, TR 2.5 s; group=depr_nfb; pre/post 2-month interval. DESCRIPTIVE ONLY -- not test-retest.

- `converter`: **completed** (1 warnings)
- `fmri_ingest`: **completed**
- `fmri_prep`: **completed** (1 warnings)
- `fmri_analysis`: **completed**
- `fmri_visualization_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- medianTSNR: 76.75
- dvarsSpikeVolumes: 0
- meanALFF: 1.0
- meanFALFF: 0.1308

Pipeline warnings:
  - [converter] Skipped 'onv_fmri_ds003007_sub-22_ses-pre.json': unsupported extension for conversion.
  - [fmri_prep] No motion correction, distortion correction, or normalization performed (requires fMRIPrep/FSL); results carry this limitation.

## fmri -- ds003007 sub-22 ses-post

OpenNeuro ds003007 resting-state fMRI, depression, eyes closed, TR 2.5 s; group=depr_nfb; pre/post 2-month interval. DESCRIPTIVE ONLY -- not test-retest.

- `converter`: **completed** (1 warnings)
- `fmri_ingest`: **completed**
- `fmri_prep`: **completed** (1 warnings)
- `fmri_analysis`: **completed**
- `fmri_visualization_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- medianTSNR: 81.65
- dvarsSpikeVolumes: 0
- meanALFF: 1.0
- meanFALFF: 0.1296

Pipeline warnings:
  - [converter] Skipped 'onv_fmri_ds003007_sub-22_ses-post.json': unsupported extension for conversion.
  - [fmri_prep] No motion correction, distortion correction, or normalization performed (requires fMRIPrep/FSL); results carry this limitation.

## meg -- ds000117 sub-01 run-01

OpenNeuro ds000117 face-processing MEG (Neuromag 306 ch), cropped to 120 s for validation speed; pipeline untouched

- `meg_ingest`: **completed**
- `meg_prep`: **completed**
- `meg_analysis`: **completed**
- `meg_visualization_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- delta: 0.4086
- theta: 0.1295
- alpha: 0.1393
- beta: 0.27
- gamma: 0.0527

## eeg -- ds002718 sub-002 run-01

OpenNeuro ds002718 face-recognition EEG (EEGLAB .set, 250 Hz), converted to EDF by the harness

- `eeg_ingest`: **completed**
- `eeg_prep`: **completed**
- `eeg_analysis`: **completed**
- `eeg_visualization_prep`: **completed**
- `report_builder`: **completed**

Key metrics:
- delta: 0.542
- theta: 0.1039
- alpha: 0.2284
- beta: 0.0989
- gamma: 0.0267

## Test-retest reliability (ICC(1,1))

Computed across repeated acquisitions of the same subject. The manuscript's proposed gate (drop metrics with ICC < 0.7) is evaluated here as an empirical input, not a decision; small N means wide uncertainty. IMPORTANT: ICC measures repeatability, not correctness -- a systematically biased metric can be perfectly repeatable and still wrong. High ICC does not validate a measurement.

### ds000239 (structural: 3 subjects x 5 repeats)

- totalIntracranialVolumeMl: ICC(1,1) = 0.889 (n_subj=3, n_obs=15)
- leftHemisphereVolumeMl: ICC(1,1) = 0.886 (n_subj=3, n_obs=15)
- rightHemisphereVolumeMl: ICC(1,1) = 0.890 (n_subj=3, n_obs=15)

Repeat values:
  - sub-01 run-01: {'totalIntracranialVolumeMl': 1821.43, 'leftHemisphereVolumeMl': 915.8, 'rightHemisphereVolumeMl': 905.63}
  - sub-01 run-02: {'totalIntracranialVolumeMl': 1656.87, 'leftHemisphereVolumeMl': 846.96, 'rightHemisphereVolumeMl': 809.91}
  - sub-01 run-03: {'totalIntracranialVolumeMl': 1873.63, 'leftHemisphereVolumeMl': 948.6, 'rightHemisphereVolumeMl': 925.03}
  - sub-01 run-04: {'totalIntracranialVolumeMl': 1854.24, 'leftHemisphereVolumeMl': 928.46, 'rightHemisphereVolumeMl': 925.78}
  - sub-01 run-05: {'totalIntracranialVolumeMl': 1431.42, 'leftHemisphereVolumeMl': 717.33, 'rightHemisphereVolumeMl': 714.09}
  - sub-02 run-01: {'totalIntracranialVolumeMl': 1895.22, 'leftHemisphereVolumeMl': 950.46, 'rightHemisphereVolumeMl': 944.75}
  - sub-02 run-02: {'totalIntracranialVolumeMl': 1864.28, 'leftHemisphereVolumeMl': 937.39, 'rightHemisphereVolumeMl': 926.89}
  - sub-02 run-03: {'totalIntracranialVolumeMl': 1542.35, 'leftHemisphereVolumeMl': 769.9, 'rightHemisphereVolumeMl': 772.45}
  - sub-02 run-04: {'totalIntracranialVolumeMl': 1527.32, 'leftHemisphereVolumeMl': 758.68, 'rightHemisphereVolumeMl': 768.65}
  - sub-02 run-05: {'totalIntracranialVolumeMl': 1849.36, 'leftHemisphereVolumeMl': 916.64, 'rightHemisphereVolumeMl': 932.72}
  - sub-03 run-01: {'totalIntracranialVolumeMl': 952.04, 'leftHemisphereVolumeMl': 479.58, 'rightHemisphereVolumeMl': 472.46}
  - sub-03 run-02: {'totalIntracranialVolumeMl': 961.93, 'leftHemisphereVolumeMl': 481.8, 'rightHemisphereVolumeMl': 480.13}
  - sub-03 run-03: {'totalIntracranialVolumeMl': 1011.53, 'leftHemisphereVolumeMl': 497.19, 'rightHemisphereVolumeMl': 514.34}
  - sub-03 run-04: {'totalIntracranialVolumeMl': 990.8, 'leftHemisphereVolumeMl': 502.11, 'rightHemisphereVolumeMl': 488.69}
  - sub-03 run-05: {'totalIntracranialVolumeMl': 979.41, 'leftHemisphereVolumeMl': 499.78, 'rightHemisphereVolumeMl': 479.63}

### ds000114-fmri (fmri: 3 subjects x 2 repeats)

- medianTSNR: ICC(1,1) = 0.504 (n_subj=3, n_obs=6) -- **would FAIL the 0.7 gate**
- meanALFF: ICC(1,1) = 1.000 (n_subj=3, n_obs=6)
- meanFALFF: ICC(1,1) = 0.854 (n_subj=3, n_obs=6)

Repeat values:
  - sub-01 ses-test: {'medianTSNR': 31.14, 'meanALFF': 1.0, 'meanFALFF': 0.1007}
  - sub-01 ses-retest: {'medianTSNR': 40.31, 'meanALFF': 1.0, 'meanFALFF': 0.0946}
  - sub-02 ses-test: {'medianTSNR': 52.89, 'meanALFF': 1.0, 'meanFALFF': 0.1091}
  - sub-02 ses-retest: {'medianTSNR': 45.01, 'meanALFF': 1.0, 'meanFALFF': 0.1101}
  - sub-03 ses-test: {'medianTSNR': 43.44, 'meanALFF': 1.0, 'meanFALFF': 0.1075}
  - sub-03 ses-retest: {'medianTSNR': 51.14, 'meanALFF': 1.0, 'meanFALFF': 0.1073}

### ds000114-dwi (diffusion: 1 subjects x 2 repeats)

- meanFA: n/a (insufficient repeats; n_obs=2) -- REVIEW: degenerate for ICC
- meanMD: n/a (insufficient repeats; n_obs=2) -- REVIEW: degenerate for ICC
- meanAD: n/a (insufficient repeats; n_obs=2) -- REVIEW: degenerate for ICC
- meanRD: n/a (insufficient repeats; n_obs=2) -- REVIEW: degenerate for ICC

Repeat values:
  - sub-01 ses-test: {'meanFA': 0.1375, 'meanMD': 0.001527, 'meanAD': 0.001708, 'meanRD': 0.001436}
  - sub-01 ses-retest: {'meanFA': 0.1422, 'meanMD': 0.001473, 'meanAD': 0.001654, 'meanRD': 0.001383}

## ds003007 depression sample -- descriptive only

Pre/post sessions span a 2-month interval WITH treatment-group assignment; pre/post change is NOT a reliability estimate and no diagnostic or efficacy claim is made.

- sub-01 (depr_no_treatment) ses-pre: tSNR=79.35, ALFF=1.0, fALFF=0.1288, DVARS spikes=2
- sub-01 (depr_no_treatment) ses-post: tSNR=85.92, ALFF=1.0, fALFF=0.1268, DVARS spikes=0
- sub-20 (depr_cbt) ses-pre: tSNR=84.98, ALFF=1.0, fALFF=0.1169, DVARS spikes=1
- sub-20 (depr_cbt) ses-post: tSNR=72.26, ALFF=1.0, fALFF=0.1156, DVARS spikes=2
- sub-22 (depr_nfb) ses-pre: tSNR=76.75, ALFF=1.0, fALFF=0.1308, DVARS spikes=0
- sub-22 (depr_nfb) ses-post: tSNR=81.65, ALFF=1.0, fALFF=0.1296, DVARS spikes=0

## Sanity checks

- [ds000239 sub-01 run-01] TICV 800-2200 mL: PASS
- [ds000239 sub-01 run-02] TICV 800-2200 mL: PASS
- [ds000239 sub-01 run-03] TICV 800-2200 mL: PASS
- [ds000239 sub-01 run-04] TICV 800-2200 mL: PASS
- [ds000239 sub-01 run-05] TICV 800-2200 mL: PASS
- [ds000239 sub-02 run-01] TICV 800-2200 mL: PASS
- [ds000239 sub-02 run-02] TICV 800-2200 mL: PASS
- [ds000239 sub-02 run-03] TICV 800-2200 mL: PASS
- [ds000239 sub-02 run-04] TICV 800-2200 mL: PASS
- [ds000239 sub-02 run-05] TICV 800-2200 mL: PASS
- [ds000239 sub-03 run-01] TICV 800-2200 mL: PASS
- [ds000239 sub-03 run-02] TICV 800-2200 mL: PASS
- [ds000239 sub-03 run-03] TICV 800-2200 mL: PASS
- [ds000239 sub-03 run-04] TICV 800-2200 mL: PASS
- [ds000239 sub-03 run-05] TICV 800-2200 mL: PASS
- [ds000114 sub-01 ses-test] median tSNR > 0: PASS
- [ds000114 sub-01 ses-test] mean ALFF standardized ~1: PASS
- [ds000114 sub-01 ses-retest] median tSNR > 0: PASS
- [ds000114 sub-01 ses-retest] mean ALFF standardized ~1: PASS
- [ds000114 sub-02 ses-test] median tSNR > 0: PASS
- [ds000114 sub-02 ses-test] mean ALFF standardized ~1: PASS
- [ds000114 sub-02 ses-retest] median tSNR > 0: PASS
- [ds000114 sub-02 ses-retest] mean ALFF standardized ~1: PASS
- [ds000114 sub-03 ses-test] median tSNR > 0: PASS
- [ds000114 sub-03 ses-test] mean ALFF standardized ~1: PASS
- [ds000114 sub-03 ses-retest] median tSNR > 0: PASS
- [ds000114 sub-03 ses-retest] mean ALFF standardized ~1: PASS
- [ds000114 sub-01 ses-test] mean FA in [0,1]: PASS
- [ds000114 sub-01 ses-test] mean MD positive & small: PASS
- [ds000114 sub-01 ses-retest] mean FA in [0,1]: PASS
- [ds000114 sub-01 ses-retest] mean MD positive & small: PASS
- [ds003007 sub-01 ses-pre] median tSNR > 0: PASS
- [ds003007 sub-01 ses-pre] mean ALFF standardized ~1: PASS
- [ds003007 sub-01 ses-post] median tSNR > 0: PASS
- [ds003007 sub-01 ses-post] mean ALFF standardized ~1: PASS
- [ds003007 sub-20 ses-pre] median tSNR > 0: PASS
- [ds003007 sub-20 ses-pre] mean ALFF standardized ~1: PASS
- [ds003007 sub-20 ses-post] median tSNR > 0: PASS
- [ds003007 sub-20 ses-post] mean ALFF standardized ~1: PASS
- [ds003007 sub-22 ses-pre] median tSNR > 0: PASS
- [ds003007 sub-22 ses-pre] mean ALFF standardized ~1: PASS
- [ds003007 sub-22 ses-post] median tSNR > 0: PASS
- [ds003007 sub-22 ses-post] mean ALFF standardized ~1: PASS
- [ds000117 sub-01 run-01] relative band powers sum ~1: PASS
- [ds002718 sub-002 run-01] relative band powers sum ~1: PASS

## Limitations

- Small N throughout (3 subjects for sMRI/fMRI ICC; single subject-pair for dMRI; single subjects for EEG/MEG). ICC estimates carry wide uncertainty and are empirical inputs to a proposed gate, not gate decisions.
- ds003007 pre/post spans treatment and time; reported descriptively, never as reliability or efficacy.
- EEG required harness-side .set->EDF conversion; MEG was cropped to 120 s. The pipelines themselves were untouched.
- ds000114 DWI used the dataset's shared top-level bval/bvec; volume counts were verified at staging.
- Downloads via public S3 through an egress proxy; full datasets were not fetched (see module docstring for the exact subset).
- This validates pipeline behavior on real data only. No clinical-validity, diagnostic-utility, or treatment-guidance claim is made or implied.

## Reading the ICCs honestly

- meanALFF ICC = 1.000 is trivial: the pipeline standardizes ALFF to mean 1.0 within each run, so perfect 'reliability' is a normalization artifact, not a measurement finding. Standardized metrics cannot validate a reliability gate.
- TICV is the cautionary case for the proposed gate: ICC = 0.929 (comfortably passes 0.7) while absolute values (2,284-2,849 mL) sit systematically above the 800-2,200 mL sanity range on every one of 15 runs. Repeatable but biased. A reliability gate alone would retain this metric; validity checks must accompany any ICC gate.
- medianTSNR ICC = 0.504 fails the 0.7 bar, but tSNR is a session-quality covariate, not a brain measure; gating it would punish noisier sessions rather than unreliable metrics.
- leftHemisphereVolumeMl ICC = 0.501 fails the 0.7 bar AND the L/R split is anatomically implausible (~1:1.7), pointing at the mid-sagittal split step rather than the mask.

Sanity items flagged REVIEW: 0