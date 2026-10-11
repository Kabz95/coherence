"""Canonical component-to-codebase map for Coherence's five brain-data modalities.

Implements the open-source strategy of the Architecture Blueprint (Part II,
Chapters 4-5; reuse matrix): integrate established open-source projects
through adapters rather than rebuilding scientific primitives.

Per the blueprint's editorial rules, every entry carries an explicit
implementation status:
  - "implemented": runs in this repo's backend today and is smoke-tested.
  - "partial":     built-in honest implementation exists; the flagship
                  external pipeline is wired as an optional hook / documented
                  reference but not yet the default.
  - "proposed":    not built; the reference pipeline is named for the roadmap.

License notes are informational, not legal advice; verify each release
independently (Blueprint Appendix D).
"""

from __future__ import annotations

MODALITIES = ("sMRI", "dMRI", "fMRI", "EEG", "MEG")

PIPELINE_MAP: dict[str, dict] = {
    "sMRI": {
        "label": "Structural MRI",
        "reference_pipelines": [
            {"name": "FastSurfer", "role": "Deep-learning structural segmentation + morphometry", "license": "Apache 2.0", "url": "https://deep-mi.org/FastSurfer/"},
            {"name": "FreeSurfer", "role": "Cortical surface reconstruction + subcortical segmentation", "license": "Custom (separate license key required)", "url": "https://surfer.nmr.mgh.harvard.edu/"},
        ],
        "builtin": "jobs structural_prep/analysis: RAS reorientation, percentile normalization, Otsu rough brain mask, mask volumetry",
        "builtin_status": "partial",
        "external_hook": "structural_analysis runs FastSurfer (run_fastsurfer.sh) when the binary is present; falls back to built-in mask volumetry otherwise.",
        "io": ["NiBabel", "pydicom", "dcm2niix"],
    },
    "dMRI": {
        "label": "Diffusion MRI",
        "reference_pipelines": [
            {"name": "QSIPrep", "role": "BIDS-app diffusion preprocessing pipeline", "license": "BSD-3-Clause", "url": "https://qsiprep.readthedocs.io/"},
            {"name": "MRtrix3", "role": "Diffusion analysis, CSD, tractography", "license": "Mozilla Public License 2.0", "url": "https://www.mrtrix.org/"},
            {"name": "DIPY", "role": "Diffusion tensor / biophysical modelling", "license": "BSD-3-Clause", "url": "https://dipy.org/"},
        ],
        "builtin": "jobs diffusion_prep/analysis: bval/bvec validation, b0 mask, DIPY single-tensor DTI fit (FA/MD/AD/RD)",
        "builtin_status": "partial",
        "external_hook": "No eddy/motion correction built in (requires FSL eddy); QSIPrep/MRtrix3 are the documented upgrade path.",
        "io": ["NiBabel"],
    },
    "fMRI": {
        "label": "Functional MRI",
        "reference_pipelines": [
            {"name": "fMRIPrep", "role": "BIDS-native minimal-preprocessing pipeline (community default)", "license": "BSD-3-Clause", "url": "https://fmriprep.org/"},
            {"name": "Nilearn", "role": "Python statistics, ML, and connectivity on NIfTI", "license": "BSD-3-Clause", "url": "https://nilearn.github.io/"},
        ],
        "builtin": "jobs fmri_ingest/prep/analysis: BIDS-sidecar TR read, DVARS + tSNR QC, CompCor-lite denoising, ALFF maps",
        "builtin_status": "implemented",
        "external_hook": "fMRIPrep is the reference for production-grade preprocessing (motion correction, distortion correction, normalization); the built-in is an honest lite path.",
        "io": ["NiBabel"],
    },
    "EEG": {
        "label": "Electroencephalography",
        "reference_pipelines": [
            {"name": "MNE-Python", "role": "I/O, preprocessing, source estimation, time-frequency analysis", "license": "BSD-3-Clause", "url": "https://mne.tools/"},
            {"name": "MNE-BIDS-Pipeline", "role": "Automated BIDS batch processing for EEG/MEG", "license": "BSD-3-Clause", "url": "https://mne.tools/mne-bids-pipeline/"},
        ],
        "builtin": "jobs eeg_ingest/prep/analysis: MNE ingest, 1-40 Hz filter + notch + resample, bad-channel flags, Welch band powers",
        "builtin_status": "implemented",
        "external_hook": "MNE-BIDS-Pipeline is the documented batch/automation upgrade path.",
        "io": ["MNE-Python readers (EDF/BDF/FIF)", "CSV fallback"],
    },
    "MEG": {
        "label": "Magnetoencephalography",
        "reference_pipelines": [
            {"name": "MNE-Python", "role": "I/O, preprocessing, source estimation (MEG-native)", "license": "BSD-3-Clause", "url": "https://mne.tools/"},
            {"name": "MNE-BIDS-Pipeline", "role": "Automated BIDS batch processing for EEG/MEG", "license": "BSD-3-Clause", "url": "https://mne.tools/mne-bids-pipeline/"},
        ],
        "builtin": "jobs meg_ingest/prep/analysis: shared electrophysiology core with EEG (jobs/ephys.py), MNE-native MEG channels",
        "builtin_status": "implemented",
        "external_hook": "MEG is ingested as imported recordings (Blueprint Ch. 16.3); source localization remains out of scope.",
        "io": ["MNE-Python readers (FIF/4D/BTI)"],
    },
}

# Blueprint Ch. 11 candidates: QC flagships to evaluate before adopting.
QC_REFERENCES = [
    {"name": "MRIQC", "role": "Structural/functional MRI quality metrics", "license": "Apache 2.0"},
    {"name": "autoreject", "role": "Automated EEG/MEG artifact rejection", "license": "BSD-3-Clause"},
]

# Blueprint Ch. 24: browser viewer selection.
VIEWER_REFERENCE = {"name": "NiiVue", "role": "Volume/mesh/tractography browser viewer", "license": "BSD-2-Clause"}


def modality_pipeline_summary() -> list[dict]:
    """Return the map as a list suitable for manifests and reports."""
    return [
        {
            "modality": key,
            "label": value["label"],
            "builtin": value["builtin"],
            "status": value["builtin_status"],
            "referencePipelines": [p["name"] for p in value["reference_pipelines"]],
        }
        for key, value in PIPELINE_MAP.items()
    ]
