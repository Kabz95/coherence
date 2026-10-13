"""Structural preparation: normalize a converted T1 for measurement.

Steps:
1. Load the first converted NIfTI (first volume if 4D).
2. Percentile-clip intensities (0.5-99.5) and rescale to [0, 1].
3. Estimate a rough brain mask (background-adaptive threshold + scalp-strip:
   inferior neck seal, ~10 mm erosion past scalp/skull, ~4 mm regrow).
4. Write `prepped-t1.nii.gz` and `brain-mask.nii.gz`.

The mask is a rough estimate for volume approximation and QC — not a
segmentation. Downstream morphometry claims must carry that limitation.
"""

from __future__ import annotations

from jobs.common import add_safe_evidence, create_manifest, input_files_from_run
from jobs.imaging import (
    download_first_matching,
    gcs_prefix,
    load_nifti,
    rough_brain_mask,
    upload_artifact,
    upstream_manifest_outputs,
    workspace,
)


def _converted_inputs(context) -> list[dict]:
    upstream = upstream_manifest_outputs(context, "converter")
    if upstream and upstream.get("convertedFiles"):
        return [
            {"name": e["name"], "storagePath": e.get("gcsPath", ""), "sourceName": e.get("sourceName")}
            for e in upstream["convertedFiles"]
        ]
    return input_files_from_run(context.run_doc)


def run(context) -> object:
    import nibabel as nib
    import numpy as np

    manifest = create_manifest(context.run_id, "structural_prep")
    files = _converted_inputs(context)

    work = workspace("structural_prep")
    meta, local = download_first_matching(context, files, (".nii", ".nii.gz"), work / "inputs")
    if meta is None or local is None:
        return manifest.fail("No NIfTI input available for structural preparation.")

    manifest.inputs["sourceFile"] = meta.get("name")
    img, data = load_nifti(local)
    vol = np.asanyarray(data[..., 0] if data.ndim == 4 else data, dtype=np.float64)
    if data.ndim == 4:
        manifest.warnings.append("4D input: using the first volume for structural preparation.")

    lo, hi = np.percentile(vol[np.isfinite(vol)], [0.5, 99.5])
    clipped = np.clip(vol, lo, hi)
    norm = (clipped - lo) / max(hi - lo, 1e-9)
    norm = norm.astype(np.float32)

    zooms = img.header.get_zooms()[:3]
    voxel_ml = float(np.prod(zooms) / 1000.0)
    voxel_mm = float(np.prod(zooms) ** (1.0 / 3.0))

    mask_diagnostics: dict = {}
    mask = rough_brain_mask(
        norm,
        skull_strip=True,
        affine=img.affine,
        voxel_mm=voxel_mm,
        diagnostics=mask_diagnostics,
    )
    if mask_diagnostics.get("fov_truncation_suspected"):
        manifest.warnings.append(
            "Truncated FOV suspected (imaged head "
            f"{mask_diagnostics.get('head_vol_ml')} mL); reduced erosion "
            f"({mask_diagnostics.get('erosion_mm_used')} mm) applied as fallback. "
            "TICV is a lower bound -- do not compare to full-FOV timepoints."
        )
    mask_voxels = int(mask.sum())

    prepped_path = work / "prepped-t1.nii.gz"
    nib.save(nib.Nifti1Image(norm, img.affine, img.header), str(prepped_path))
    mask_path = work / "brain-mask.nii.gz"
    nib.save(nib.Nifti1Image(mask.astype(np.uint8), img.affine, img.header), str(mask_path))

    prepped_gcs = upload_artifact(context, "structural_prep", prepped_path, "prepped-t1.nii.gz", "application/gzip")
    mask_gcs = upload_artifact(context, "structural_prep", mask_path, "brain-mask.nii.gz", "application/gzip")

    manifest.outputs["preppedT1"] = prepped_gcs
    manifest.outputs["brainMask"] = mask_gcs
    manifest.outputs["maskVoxels"] = mask_voxels
    manifest.outputs["maskVolumeMl"] = round(mask_voxels * voxel_ml, 2)
    manifest.outputs["intensityClipPercentiles"] = [0.5, 99.5]

    add_safe_evidence(
        manifest, "Structural preparation", f"mask volume {manifest.outputs['maskVolumeMl']} mL",
        "Percentile intensity normalization + Otsu-threshold rough brain mask",
        "The mask is a rough estimate, not a segmentation; downstream volumes inherit this uncertainty.",
        unit="mL",
    )
    return manifest.complete()
