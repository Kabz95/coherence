"""Diffusion analysis: DTI tensor fitting with DIPY.

Fits a diffusion tensor model to the prepared DWI and derives FA, MD, AD, RD
maps plus whole-mask summary statistics. Writes `dti-summary.json` with
per-metric method + limitations. Tractography and connectomes are out of
scope for this job (see diffusion_3d_prep for preview assets).
"""

from __future__ import annotations

from jobs.common import add_safe_evidence, create_manifest, input_files_from_run, module_available
from jobs.imaging import (
    fetch_artifact,
    gcs_prefix,
    load_nifti,
    resolve_input_file,
    upload_artifact,
    upstream_manifest_outputs,
    workspace,
)
from lib.storage import write_json


def run(context) -> object:
    import nibabel as nib
    import numpy as np

    manifest = create_manifest(context.run_id, "diffusion_analysis")

    if not module_available("dipy"):
        return manifest.fail("DIPY is not importable; install dipy to run diffusion tensor fitting.")

    work = workspace("diffusion_analysis")
    prep = upstream_manifest_outputs(context, "diffusion_prep") or {}

    # Locate DWI + gradients: prefer diffusion_prep context, else raw inputs.
    dwi_local = bval_local = bvec_local = None
    mask = None
    files = input_files_from_run(context.run_doc)
    for f in files:
        lower = str(f.get("name", "")).lower()
        try:
            if lower.endswith((".nii", ".nii.gz")) and dwi_local is None:
                dwi_local = resolve_input_file(context, f, work / "inputs")
            elif lower.endswith(".bval") and bval_local is None:
                bval_local = resolve_input_file(context, f, work / "inputs")
            elif lower.endswith(".bvec") and bvec_local is None:
                bvec_local = resolve_input_file(context, f, work / "inputs")
        except Exception as exc:
            manifest.warnings.append(f"Could not download '{f.get('name')}': {exc}")

    if dwi_local is None or bval_local is None or bvec_local is None:
        return manifest.fail("DWI NIfTI + .bval + .bvec are all required for DTI fitting.")

    b0_mask_ref = prep.get("b0Mask")
    if b0_mask_ref:
        try:
            mask_local = work / "b0-mask.nii.gz"
            fetch_artifact(b0_mask_ref, mask_local, context.config.gcs_bucket)
            _, mask_data = load_nifti(mask_local)
            mask = np.asanyarray(mask_data).astype(bool)
        except Exception as exc:
            manifest.warnings.append(f"Could not fetch b0 mask ({exc}); fitting without a mask.")

    from dipy.core.gradients import gradient_table
    from dipy.io.gradients import read_bvals_bvecs
    from dipy.reconst.dti import TensorModel

    img, data = load_nifti(dwi_local)
    dwi = np.asanyarray(data, dtype=np.float64)
    if dwi.ndim != 4:
        return manifest.fail("DWI input must be 4D for tensor fitting.")
    bvals, bvecs = read_bvals_bvecs(str(bval_local), str(bvec_local))
    gtab = gradient_table(bvals=bvals, bvecs=bvecs)

    tenmodel = TensorModel(gtab)
    fit = tenmodel.fit(dwi, mask=mask)
    fa = np.nan_to_num(fit.fa).astype(np.float32)
    md = np.nan_to_num(fit.md).astype(np.float32)
    ad = np.nan_to_num(fit.ad).astype(np.float32)
    rd = np.nan_to_num(fit.rd).astype(np.float32)

    def _save(arr, name):
        p = work / name
        nib.save(nib.Nifti1Image(arr, img.affine, img.header), str(p))
        return upload_artifact(context, "diffusion_analysis", p, name, "application/gzip")

    fa_gcs = _save(fa, "fa.nii.gz")
    md_gcs = _save(md, "md.nii.gz")
    ad_gcs = _save(ad, "ad.nii.gz")
    rd_gcs = _save(rd, "rd.nii.gz")

    region = mask if mask is not None else np.ones(fa.shape, dtype=bool)
    summary = {
        "meanFA": round(float(fa[region].mean()), 4),
        "meanMD": round(float(md[region].mean()), 6),
        "meanAD": round(float(ad[region].mean()), 6),
        "meanRD": round(float(rd[region].mean()), 6),
        "voxels": int(region.sum()),
        "method": "DIPY TensorModel least-squares DTI fit",
        "limitations": (
            "Single-tensor model; no crossing-fibre resolution. No eddy/motion correction "
            "was performed. Values are non-diagnostic summaries for clinician review."
        ),
    }
    prefix = gcs_prefix(context, "diffusion_analysis")
    write_json(context.config.gcs_bucket, f"{prefix}/dti-summary.json", summary)

    manifest.outputs["faMap"] = fa_gcs
    manifest.outputs["mdMap"] = md_gcs
    manifest.outputs["adMap"] = ad_gcs
    manifest.outputs["rdMap"] = rd_gcs
    manifest.outputs["dtiSummaryJson"] = f"{prefix}/dti-summary.json"
    manifest.outputs["summary"] = summary

    for label, value, unit in [("mean FA", summary["meanFA"], None), ("mean MD", summary["meanMD"], "mm^2/s")]:
        add_safe_evidence(
            manifest, "Diffusion measurement", str(value),
            "DIPY single-tensor DTI fit, whole-mask average",
            summary["limitations"], unit=unit,
        )
    return manifest.complete()
