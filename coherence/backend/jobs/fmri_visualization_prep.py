"""fMRI visualization prep: carpet plot + mean-BOLD montage for the viewer shell.

The carpet plot (voxel x time heatmap, sorted by mean intensity) is the
standard quick-look QC view for resting-state fMRI.
"""

from __future__ import annotations

from jobs.common import add_safe_evidence, create_manifest
from jobs.imaging import fetch_artifact, load_nifti, save_slice_montage, upload_artifact, upstream_manifest_outputs, workspace


def _save_carpet_plot(bold, mask, out_path, title=""):
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import numpy as np

    vox = bold[mask]
    order = np.argsort(vox.mean(axis=1))
    clipped = np.clip(vox[order], *np.percentile(vox, [1, 99]))
    fig, ax = plt.subplots(figsize=(12, 6))
    ax.imshow(clipped, aspect="auto", cmap="gray", interpolation="nearest")
    ax.set_xlabel("Volume")
    ax.set_ylabel("Voxel (sorted by mean)")
    ax.set_title(title or "Carpet plot")
    fig.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=110, bbox_inches="tight")
    plt.close(fig)
    return out_path


def run(context) -> object:
    import numpy as np

    manifest = create_manifest(context.run_id, "fmri_visualization_prep")
    work = workspace("fmri_visualization_prep")

    prep = upstream_manifest_outputs(context, "fmri_prep") or {}
    den_ref = prep.get("denoisedBold")
    if not den_ref:
        manifest.warnings.append("No denoised BOLD from fmri_prep; no preview assets produced.")
        return manifest.complete()

    try:
        den_local = work / "denoised-bold.nii.gz"
        fetch_artifact(den_ref, den_local, context.config.gcs_bucket)
        _, data = load_nifti(den_local)
    except Exception as exc:
        return manifest.fail(f"Could not fetch denoised BOLD: {exc}")

    bold = np.asanyarray(data, dtype=np.float32)
    mask = np.abs(bold).sum(axis=3) > 0
    mean_bold = bold.mean(axis=3)

    carpet = _save_carpet_plot(bold, mask, work / "fmri-carpet.png", title=f"Carpet plot — {context.run_id}")
    montage = save_slice_montage(mean_bold, work / "bold-montage.png", title=f"Mean BOLD — {context.run_id}")

    carpet_gcs = upload_artifact(context, "fmri_visualization_prep", carpet, "fmri-carpet.png", "image/png")
    montage_gcs = upload_artifact(context, "fmri_visualization_prep", montage, "bold-montage.png", "image/png")

    manifest.outputs["carpetPlot"] = carpet_gcs
    manifest.outputs["boldMontage"] = montage_gcs
    manifest.outputs["visualizationAssets"] = {"fmri_carpet": carpet_gcs, "fmri_montage": montage_gcs}
    add_safe_evidence(
        manifest, "Viewer asset", "fmri-carpet.png",
        "Carpet plot (voxel x time) of the denoised BOLD series",
        "Rendered QC preview for clinician review; not a diagnostic image.",
    )
    return manifest.complete()
