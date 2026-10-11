"""Diffusion viewer assets: FA montage preview for the web viewer shell."""

from __future__ import annotations

from jobs.common import add_safe_evidence, create_manifest
from jobs.imaging import (
    fetch_artifact,
    load_nifti,
    save_slice_montage,
    upload_artifact,
    upstream_manifest_outputs,
    workspace,
)


def run(context) -> object:
    import numpy as np

    manifest = create_manifest(context.run_id, "diffusion_3d_prep")
    work = workspace("diffusion_3d_prep")

    analysis = upstream_manifest_outputs(context, "diffusion_analysis") or {}
    fa_ref = analysis.get("faMap")
    if not fa_ref:
        manifest.warnings.append("No FA map from diffusion_analysis; no preview assets produced.")
        return manifest.complete()

    try:
        fa_local = work / "fa.nii.gz"
        fetch_artifact(fa_ref, fa_local, context.config.gcs_bucket)
        _, fa_data = load_nifti(fa_local)
    except Exception as exc:
        return manifest.fail(f"Could not fetch FA map: {exc}")

    fa = np.asanyarray(fa_data, dtype=np.float32)
    montage = save_slice_montage(fa, work / "fa-montage.png", title=f"FA map — {context.run_id}", cmap="viridis")
    montage_gcs = upload_artifact(context, "diffusion_3d_prep", montage, "fa-montage.png", "image/png")

    manifest.outputs["faMontage"] = montage_gcs
    manifest.outputs["visualizationAssets"] = {"diffusion_montage": montage_gcs}
    add_safe_evidence(
        manifest, "Viewer asset", "fa-montage.png",
        "FA slice montage rendered from the DIPY tensor fit",
        "Rendered preview for clinician review; not a diagnostic image.",
    )
    return manifest.complete()
