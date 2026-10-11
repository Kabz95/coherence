"""fMRI analysis: amplitude of low-frequency fluctuations (ALFF/fALFF).

Computes voxel-wise ALFF (total amplitude in 0.01-0.08 Hz) and fALFF
(fractional ALFF: band amplitude / total amplitude) from the denoised BOLD,
plus whole-mask means. ALFF/fALFF are standard, descriptive resting-state
summaries — non-diagnostic and sensitive to preprocessing and motion.

Writes ``alff-summary.json`` with per-metric method + limitations.
"""

from __future__ import annotations

from jobs.common import add_safe_evidence, create_manifest
from jobs.imaging import fetch_artifact, gcs_prefix, load_nifti, upstream_manifest_outputs, workspace
from lib.storage import write_json


def run(context) -> object:
    import nibabel as nib
    import numpy as np

    manifest = create_manifest(context.run_id, "fmri_analysis")
    work = workspace("fmri_analysis")

    prep = upstream_manifest_outputs(context, "fmri_prep") or {}
    den_ref = prep.get("denoisedBold")
    if not den_ref:
        return manifest.fail("No denoised BOLD from fmri_prep.")

    ingest = upstream_manifest_outputs(context, "fmri_ingest") or {}
    tr = (ingest.get("metadata") or {}).get("repetitionTimeSec")
    if not tr:
        return manifest.fail("TR unknown; ALFF requires the repetition time (BIDS sidecar).")

    try:
        den_local = work / "denoised-bold.nii.gz"
        fetch_artifact(den_ref, den_local, context.config.gcs_bucket)
        img, data = load_nifti(den_local)
    except Exception as exc:
        return manifest.fail(f"Could not fetch denoised BOLD: {exc}")

    bold = np.asanyarray(data, dtype=np.float64)
    n_vol = bold.shape[3]
    mask = np.abs(bold).sum(axis=3) > 0
    vox = bold[mask]

    freqs = np.fft.rfftfreq(n_vol, d=tr)
    spectra = np.abs(np.fft.rfft(vox, axis=1))
    band = (freqs >= 0.01) & (freqs <= 0.08)
    if not band.any():
        return manifest.fail("Frequency resolution too coarse for the 0.01-0.08 Hz ALFF band.")

    alff_vox = spectra[:, band].sum(axis=1) / band.sum()
    falff_vox = spectra[:, band].sum(axis=1) / (spectra.sum(axis=1) + 1e-9)

    alff_map = np.zeros(bold.shape[:3], dtype=np.float32)
    falff_map = np.zeros(bold.shape[:3], dtype=np.float32)
    alff_map[mask] = (alff_vox / (alff_vox.mean() + 1e-9)).astype(np.float32)  # standardized mALFF
    falff_map[mask] = falff_vox.astype(np.float32)

    def _save(arr, name):
        p = work / name
        nib.save(nib.Nifti1Image(arr, img.affine, img.header), str(p))
        from jobs.imaging import upload_artifact

        return upload_artifact(context, "fmri_analysis", p, name, "application/gzip")

    alff_gcs = _save(alff_map, "alff-map.nii.gz")
    falff_gcs = _save(falff_map, "falff-map.nii.gz")

    summary = {
        "meanALFF": round(float(alff_map[mask].mean()), 4),
        "meanFALFF": round(float(falff_map[mask].mean()), 4),
        "voxels": int(mask.sum()),
        "trSec": tr,
        "method": "FFT amplitude in 0.01-0.08 Hz (ALFF, mean-standardized); fALFF = band/total amplitude",
        "limitations": (
            "Descriptive resting-state summaries. No motion correction was performed; "
            "residual motion inflates ALFF. Not diagnostic."
        ),
    }
    prefix = gcs_prefix(context, "fmri_analysis")
    write_json(context.config.gcs_bucket, f"{prefix}/alff-summary.json", summary)
    manifest.outputs["alffMap"] = alff_gcs
    manifest.outputs["falffMap"] = falff_gcs
    manifest.outputs["alffSummaryJson"] = f"{prefix}/alff-summary.json"
    manifest.outputs["summary"] = summary

    for label, value in [("mean ALFF (standardized)", summary["meanALFF"]), ("mean fALFF", summary["meanFALFF"])]:
        add_safe_evidence(manifest, "fMRI measurement", str(value), summary["method"], summary["limitations"])
    return manifest.complete()
