"""Multimodal coregistration: resample a moving image into a reference space.

Uses nibabel's affine resampling (resample_from_to) — a rigid, affine-level
alignment based on image headers. This is NOT a nonlinear registration and
does not replace dedicated coregistration review. Source localization remains
out of scope.

Inputs are chosen from the run's converted files: the caller may pass
reference/moving names via run metadata, otherwise the first two NIfTI
inputs are used (reference = first).
"""

from __future__ import annotations

from jobs.common import add_safe_evidence, create_manifest, input_files_from_run
from jobs.imaging import (
    fetch_artifact,
    load_nifti,
    resolve_input_file,
    upload_artifact,
    upstream_manifest_outputs,
    workspace,
)


def _candidate_files(context):
    upstream = upstream_manifest_outputs(context, "converter")
    if upstream and upstream.get("convertedFiles"):
        return [{"name": e["name"], "storagePath": e.get("gcsPath", ""), "sourceName": e.get("sourceName")} for e in upstream["convertedFiles"]]
    return input_files_from_run(context.run_doc)


def run(context) -> object:
    import nibabel as nib
    import numpy as np
    from nibabel.processing import resample_from_to

    manifest = create_manifest(context.run_id, "coregistration")
    files = [f for f in _candidate_files(context) if str(f.get("name", "")).lower().endswith((".nii", ".nii.gz"))]
    if len(files) < 2:
        manifest.warnings.append("Coregistration needs at least two NIfTI inputs; skipping.")
        add_safe_evidence(
            manifest, "Coregistration status", "skipped",
            "Affine resampling requires reference + moving images",
            "Coordinate alignment must be reviewed before any multimodal use.",
        )
        return manifest.complete()

    work = workspace("coregistration")
    try:
        ref_local = resolve_input_file(context, files[0], work / "inputs")
        mov_local = resolve_input_file(context, files[1], work / "inputs")
    except Exception as exc:
        return manifest.fail(f"Could not download coregistration inputs: {exc}")

    ref_img, _ = load_nifti(ref_local)
    mov_img, mov_data = load_nifti(mov_local)
    manifest.inputs["reference"] = files[0].get("name")
    manifest.inputs["moving"] = files[1].get("name")

    resampled = resample_from_to(mov_img, (ref_img.shape[:3], ref_img.affine), order=1)
    out_path = work / "coregistered-moving.nii.gz"
    nib.save(resampled, str(out_path))
    out_gcs = upload_artifact(context, "coregistration", out_path, "coregistered-moving.nii.gz", "application/gzip")

    manifest.outputs["coregisteredImage"] = out_gcs
    manifest.outputs["method"] = "nibabel affine resampling (order=1) of moving into reference space"
    manifest.warnings.append(
        "Affine header-based alignment only; not a nonlinear registration. "
        "Review alignment before any multimodal interpretation."
    )
    add_safe_evidence(
        manifest, "Coregistration status", "completed",
        manifest.outputs["method"],
        "Affine-level alignment; must be reviewed before source-localization or multimodal use.",
    )
    return manifest.complete()
