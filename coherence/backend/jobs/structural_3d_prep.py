"""Structural viewer assets: rendered images for the web viewer shell.

Produces:
- `slice-montage.png`: axial/coronal/sagittal montage of the prepped T1.
- `volume-preview.png`: orthogonal maximum-intensity projections (a lightweight
  stand-in until the NiiVue integration mounts real volumes).
- `volume-downsampled.nii.gz`: half-resolution NIfTI reserved for the future
  interactive viewer.

Records `visualizationAssets` consumed by the report builder, which merges
them into the run's `outputs.visualizationAssets` for the web viewer.
"""

from __future__ import annotations

from jobs.common import add_safe_evidence, create_manifest
from jobs.imaging import (
    download_first_matching,
    fetch_artifact,
    load_nifti,
    save_slice_montage,
    upload_artifact,
    upstream_manifest_outputs,
    workspace,
)


def _orthogonal_mip_figure(data, out_path, title=""):
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import numpy as np

    fig, axes = plt.subplots(1, 3, figsize=(12, 4))
    views = [
        ("axial MIP", np.max(data, axis=2)),
        ("coronal MIP", np.max(data, axis=1)),
        ("sagittal MIP", np.max(data, axis=0)),
    ]
    for ax, (label, view) in zip(axes, views):
        ax.imshow(np.rot90(view), cmap="gray")
        ax.set_title(label, fontsize=10)
        ax.axis("off")
    fig.suptitle(title, fontsize=12)
    fig.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=110, bbox_inches="tight")
    plt.close(fig)
    return out_path


def run(context) -> object:
    import nibabel as nib
    import numpy as np

    manifest = create_manifest(context.run_id, "structural_3d_prep")
    work = workspace("structural_3d_prep")

    prep = upstream_manifest_outputs(context, "structural_prep")
    prepped_ref = (prep or {}).get("preppedT1")

    try:
        if prepped_ref:
            local = work / "prepped-t1.nii.gz"
            fetch_artifact(prepped_ref, local, context.config.gcs_bucket)
            manifest.inputs["preppedT1"] = prepped_ref
        else:
            raise RuntimeError("no upstream prepped image")
    except Exception as exc:
        manifest.warnings.append(f"Upstream prep artifact unavailable ({exc}); using run inputs.")
        from jobs.common import input_files_from_run

        files = input_files_from_run(context.run_doc)
        meta, local = download_first_matching(context, files, (".nii", ".nii.gz"), work / "inputs")
        if meta is None or local is None:
            return manifest.fail("No NIfTI input available for viewer asset preparation.")
        manifest.inputs["sourceFile"] = meta.get("name")

    img, data = load_nifti(local)
    vol = np.asanyarray(data[..., 0] if data.ndim == 4 else data, dtype=np.float32)

    montage_path = save_slice_montage(vol, work / "slice-montage.png", title=f"Structural slices — {context.run_id}")
    mip_path = _orthogonal_mip_figure(vol, work / "volume-preview.png", title=f"Volume preview — {context.run_id}")

    # Half-resolution volume for the future interactive viewer.
    zoomed = vol[::2, ::2, ::2]
    affine = img.affine.copy()
    affine[:3, :3] = img.affine[:3, :3] * 2.0
    down_path = work / "volume-downsampled.nii.gz"
    nib.save(nib.Nifti1Image(zoomed, affine, img.header), str(down_path))

    montage_gcs = upload_artifact(context, "structural_3d_prep", montage_path, "slice-montage.png", "image/png")
    mip_gcs = upload_artifact(context, "structural_3d_prep", mip_path, "volume-preview.png", "image/png")
    down_gcs = upload_artifact(context, "structural_3d_prep", down_path, "volume-downsampled.nii.gz", "application/gzip")

    visualization_assets = {
        "slice_montage": montage_gcs,
        "volume_render": mip_gcs,
        "volume_nifti": down_gcs,
    }
    manifest.outputs["visualizationAssets"] = visualization_assets
    manifest.outputs["sliceMontage"] = montage_gcs
    manifest.outputs["volumePreview"] = mip_gcs
    manifest.outputs["volumeNifti"] = down_gcs

    add_safe_evidence(
        manifest, "Viewer asset", "slice-montage.png",
        "Orthogonal slice montage rendered from the prepared T1",
        "Rendered preview for clinician review; not a diagnostic image.",
    )
    return manifest.complete()
