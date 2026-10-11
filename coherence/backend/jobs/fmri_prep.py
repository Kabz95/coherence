"""fMRI preparation: QC metrics and lite denoising for resting-state BOLD.

Steps:
1. Brain mask from the mean BOLD (rough mask; fMRI-grade masking needs
   dedicated tools).
2. QC: DVARS (RMS of successive volume differences inside the mask — the
   standard motion-proxy time series) and tSNR (temporal mean/std) map.
3. Denoise (CompCor-lite): linear detrend, then regress out the top 5
   principal components of high-temporal-variance voxels, then band-pass
   0.01-0.1 Hz when the TR supports it.

This is NOT fMRIPrep: no motion correction, distortion correction, or
normalization is performed. Those limitations are recorded on the manifest.
The reference production pipeline is fMRIPrep.
"""

from __future__ import annotations

from jobs.common import add_safe_evidence, create_manifest
from jobs.imaging import (
    fetch_artifact,
    gcs_prefix,
    load_nifti,
    resolve_input_file,
    rough_brain_mask,
    upload_artifact,
    upstream_manifest_outputs,
    workspace,
)
from lib.storage import write_json


def _dvars(bold_2d: "np.ndarray") -> "np.ndarray":
    import numpy as np

    diff = np.diff(bold_2d, axis=1)
    return np.sqrt((diff ** 2).mean(axis=0))


def run(context) -> object:
    import nibabel as nib
    import numpy as np

    manifest = create_manifest(context.run_id, "fmri_prep")
    work = workspace("fmri_prep")

    ingest = upstream_manifest_outputs(context, "fmri_ingest") or {}
    metadata = ingest.get("metadata") or {}
    tr = metadata.get("repetitionTimeSec")

    # Re-resolve the BOLD file from converter outputs or raw inputs.
    upstream = upstream_manifest_outputs(context, "converter")
    if upstream and upstream.get("convertedFiles"):
        files = [{"name": e["name"], "storagePath": e.get("gcsPath", "")} for e in upstream["convertedFiles"]]
    else:
        from jobs.common import input_files_from_run

        files = input_files_from_run(context.run_doc)

    bold_local = None
    for f in files:
        if str(f.get("name", "")).lower().endswith((".nii", ".nii.gz")):
            try:
                bold_local = resolve_input_file(context, f, work / "inputs")
                manifest.inputs["sourceFile"] = f.get("name")
                break
            except Exception as exc:
                manifest.warnings.append(f"Could not download '{f.get('name')}': {exc}")
    if bold_local is None:
        return manifest.fail("No BOLD NIfTI available for fMRI preparation.")

    img, data = load_nifti(bold_local)
    bold = np.asanyarray(data, dtype=np.float64)
    n_vol = bold.shape[3]
    mean_bold = bold.mean(axis=3)
    mask = rough_brain_mask(mean_bold.astype(np.float32))
    vox = bold[mask]  # voxels x time

    # QC: DVARS + tSNR
    dvars = _dvars(vox)
    tsnr_map = np.zeros(mean_bold.shape, dtype=np.float32)
    tsnr_map[mask] = (vox.mean(axis=1) / (vox.std(axis=1) + 1e-9)).astype(np.float32)
    median_tsnr = float(np.median(tsnr_map[mask])) if mask.sum() else 0.0
    dvars_thresh = float(np.median(dvars) + 3 * np.std(dvars)) if dvars.size else 0.0
    n_spikes = int((dvars > dvars_thresh).sum()) if dvars.size else 0

    # Denoise: detrend -> CompCor-lite -> bandpass
    from scipy import signal

    detrended = signal.detrend(vox, axis=1, type="linear")
    stds = detrended.std(axis=1)
    hi_var = stds > np.percentile(stds, 80)
    n_comp = 0
    if hi_var.sum() > 10:
        centered = detrended[hi_var] - detrended[hi_var].mean(axis=1, keepdims=True)
        _, _, vt = np.linalg.svd(centered, full_matrices=False)
        n_comp = min(5, vt.shape[0])
        comps = vt[:n_comp].T  # time x components
        beta, *_ = np.linalg.lstsq(comps, detrended.T, rcond=None)
        detrended = (detrended.T - comps @ beta).T
    cleaned = detrended
    filt_desc = "detrend + CompCor-lite (top-5 high-variance PCs regressed)"
    if tr and tr > 0:
        nyq = 1.0 / (2.0 * tr)
        if nyq > 0.1:
            sos = signal.butter(4, [0.01 / nyq, 0.1 / nyq], btype="band", output="sos")
            cleaned = signal.sosfiltfilt(sos, detrended, axis=1)
            filt_desc += f"; band-pass 0.01-0.1 Hz (TR {tr} s)"
        else:
            manifest.warnings.append(f"TR {tr} s gives Nyquist {nyq:.3f} Hz < 0.1 Hz; band-pass skipped.")
    else:
        manifest.warnings.append("TR unknown; temporal band-pass skipped.")

    denoised = np.zeros_like(bold, dtype=np.float32)
    denoised[mask] = cleaned.astype(np.float32)
    den_path = work / "denoised-bold.nii.gz"
    nib.save(nib.Nifti1Image(denoised, img.affine, img.header), str(den_path))
    den_gcs = upload_artifact(context, "fmri_prep", den_path, "denoised-bold.nii.gz", "application/gzip")

    tsnr_path = work / "tsnr-map.nii.gz"
    nib.save(nib.Nifti1Image(tsnr_map, img.affine, img.header), str(tsnr_path))
    tsnr_gcs = upload_artifact(context, "fmri_prep", tsnr_path, "tsnr-map.nii.gz", "application/gzip")

    manifest.warnings.append(
        "No motion correction, distortion correction, or normalization performed "
        "(requires fMRIPrep/FSL); results carry this limitation."
    )

    payload = {
        "nVolumes": int(n_vol),
        "trSec": tr,
        "maskVoxels": int(mask.sum()),
        "medianTSNR": round(median_tsnr, 2),
        "dvarsMedian": round(float(np.median(dvars)) if dvars.size else 0.0, 3),
        "dvarsSpikeVolumes": n_spikes,
        "nCompCorComponents": n_comp,
        "filtering": filt_desc,
        "motionCorrection": "not performed",
    }
    prefix = gcs_prefix(context, "fmri_prep")
    write_json(context.config.gcs_bucket, f"{prefix}/fmri-prep.json", payload)
    manifest.outputs["fmriPrepJson"] = f"{prefix}/fmri-prep.json"
    manifest.outputs["denoisedBold"] = den_gcs
    manifest.outputs["tsnrMap"] = tsnr_gcs
    manifest.outputs["qc"] = {k: payload[k] for k in ("medianTSNR", "dvarsMedian", "dvarsSpikeVolumes")}

    add_safe_evidence(
        manifest, "fMRI quality", f"median tSNR {median_tsnr:.1f}, DVARS spikes {n_spikes}/{n_vol}",
        "DVARS + temporal SNR inside rough BOLD mask",
        "QC describes data quality only; no motion correction was performed.",
    )
    return manifest.complete()
