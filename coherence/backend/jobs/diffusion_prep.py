"""Diffusion preparation: validate and stage DWI inputs for DTI fitting.

Steps:
1. Locate the DWI NIfTI plus .bval / .bvec companions on the run.
2. Validate: volume count matches bval/bvec rows; at least one b=0 volume;
   b-vectors are unit length (within tolerance).
3. Build a b0 mask (mean b0 volume -> rough brain mask) for tensor fitting.
4. Write `dwi-prep.json` with gradient metadata and the b0 mask path.

No eddy/motion correction is performed here (requires FSL eddy); the
limitation is recorded on the manifest and in evidence.
"""

from __future__ import annotations

from jobs.common import add_safe_evidence, create_manifest, input_files_from_run, module_available
from jobs.imaging import (
    gcs_prefix,
    load_nifti,
    resolve_input_file,
    rough_brain_mask,
    upload_artifact,
    upstream_manifest_outputs,
    workspace,
)
from lib.storage import write_json


def _read_bval_bvec(bval_path, bvec_path):
    bvals = [float(x) for x in bval_path.read_text().split()]
    rows = [line.split() for line in bvec_path.read_text().strip().splitlines() if line.strip()]
    bvecs = [[float(v) for v in row] for row in rows]
    # bvec files are 3 x N (rows = x/y/z components)
    if len(bvecs) == 3 and all(len(r) == len(bvals) for r in bvecs):
        bvecs = [list(col) for col in zip(*bvecs)]
    return bvals, bvecs


def run(context) -> object:
    import numpy as np

    manifest = create_manifest(context.run_id, "diffusion_prep")

    # DWI: prefer converter outputs; bval/bvec always come from raw run inputs
    # (the converter only normalizes NIfTI/DICOM, not gradient tables).
    upstream = upstream_manifest_outputs(context, "converter")
    if upstream and upstream.get("convertedFiles"):
        dwi_files = [{"name": e["name"], "storagePath": e.get("gcsPath", ""), "sourceName": e.get("sourceName")} for e in upstream["convertedFiles"]]
    else:
        dwi_files = input_files_from_run(context.run_doc)
    raw_files = input_files_from_run(context.run_doc)

    work = workspace("diffusion_prep")
    dwi_meta = dwi_local = None
    bval_meta = bvec_meta = None
    bval_local = bvec_local = None
    for f in dwi_files:
        lower = str(f.get("name", "")).lower()
        if lower.endswith((".nii", ".nii.gz")) and dwi_local is None:
            try:
                dwi_local = resolve_input_file(context, f, work / "inputs")
                dwi_meta = f
            except Exception as exc:
                manifest.warnings.append(f"Could not download '{f.get('name')}': {exc}")
    for f in raw_files:
        lower = str(f.get("name", "")).lower()
        try:
            if lower.endswith(".bval") and bval_meta is None:
                bval_local = resolve_input_file(context, f, work / "inputs")
                bval_meta = f
            elif lower.endswith(".bvec") and bvec_meta is None:
                bvec_local = resolve_input_file(context, f, work / "inputs")
                bvec_meta = f
        except Exception as exc:
            manifest.warnings.append(f"Could not download '{f.get('name')}': {exc}")

    if dwi_local is None:
        return manifest.fail("No diffusion NIfTI input found.")
    if bval_meta is None or bvec_meta is None:
        manifest.warnings.append("Missing .bval/.bvec companions; DTI fitting will be skipped downstream.")
        add_safe_evidence(
            manifest, "Diffusion preparation", "incomplete",
            "Gradient table validation", "DTI fitting requires bval/bvec companions.",
        )
        return manifest.complete()

    img, data = load_nifti(dwi_local)
    n_volumes = data.shape[3] if data.ndim == 4 else 1
    bvals, bvecs = _read_bval_bvec(bval_local, bvec_local)

    checks = {
        "nVolumes": int(n_volumes),
        "nBvals": len(bvals),
        "nBvecs": len(bvecs),
        "bValues": sorted(set(round(b) for b in bvals)),
    }
    if not (len(bvals) == len(bvecs) == n_volumes):
        return manifest.fail(
            f"Gradient table mismatch: {n_volumes} volumes vs {len(bvals)} bvals vs {len(bvecs)} bvecs."
        )
    norms = [float(np.linalg.norm(v)) for v in bvecs]
    checks["bvecNormRange"] = [round(min(norms), 3), round(max(norms), 3)]
    if any(abs(n - 1.0) > 0.05 and b > 50 for n, b in zip(norms, bvals)):
        manifest.warnings.append("Some b-vectors deviate from unit length; check gradient table.")
    b0_idx = [i for i, b in enumerate(bvals) if b < 50]
    checks["b0Count"] = len(b0_idx)
    if not b0_idx:
        return manifest.fail("No b=0 volume found; cannot build a b0 reference.")

    # b0 mask for downstream fitting
    b0_mean = np.asanyarray(data[..., b0_idx].mean(axis=3) if data.ndim == 4 else data, dtype=np.float64)
    mask = rough_brain_mask(b0_mean.astype(np.float32))
    import nibabel as nib

    mask_path = work / "dwi-b0-mask.nii.gz"
    nib.save(nib.Nifti1Image(mask.astype(np.uint8), img.affine, img.header), str(mask_path))
    mask_gcs = upload_artifact(context, "diffusion_prep", mask_path, "dwi-b0-mask.nii.gz", "application/gzip")

    manifest.warnings.append("No eddy-current/motion correction performed (requires FSL eddy); results carry this limitation.")

    prep_payload = {
        "dwiName": dwi_meta.get("name"),
        "checks": checks,
        "b0Mask": mask_gcs,
        "maskVoxels": int(mask.sum()),
        "eddyCorrection": "not performed",
    }
    prefix = gcs_prefix(context, "diffusion_prep")
    write_json(context.config.gcs_bucket, f"{prefix}/dwi-prep.json", prep_payload)
    manifest.outputs["dwiPrepJson"] = f"{prefix}/dwi-prep.json"
    manifest.outputs["b0Mask"] = mask_gcs
    manifest.outputs["b0Count"] = len(b0_idx)
    manifest.outputs["bValues"] = checks["bValues"]

    add_safe_evidence(
        manifest, "Diffusion preparation",
        f"{n_volumes} volumes, b-values {checks['bValues']}",
        "bval/bvec validation + b0 rough brain mask",
        "No eddy/motion correction; tensor fits inherit acquisition artifacts.",
    )
    if not module_available("dipy"):
        manifest.warnings.append("DIPY is not importable; diffusion_analysis will be unable to fit tensors.")
    return manifest.complete()
