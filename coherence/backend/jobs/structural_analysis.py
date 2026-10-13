"""Structural measurements from the prepared T1 and rough brain mask.

Real, honestly-labelled metrics (method: background-adaptive scalp-stripped
mask volumetry):
- totalIntracranialVolumeMl: mask voxel count x voxel volume (rough estimate)
- leftHemisphereVolumeMl / rightHemisphereVolumeMl: mid-sagittal split of the
  RAS-oriented mask
- meanMaskIntensity: mean normalized intensity inside the mask
- maskVoxels, voxelVolumeMl: supporting metadata

Writes `summary-metrics.json` with per-metric method + limitations, consumed
by the report builder. Cortical thickness and subcortical volumetry require
surface reconstruction (e.g. FastSurfer) and are NOT fabricated here.
"""

from __future__ import annotations

from jobs.common import add_safe_evidence, create_manifest
from jobs.imaging import (
    download_first_matching,
    fetch_artifact,
    gcs_prefix,
    hemisphere_volumes_ml,
    intensity_stats,
    load_nifti,
    rough_brain_mask,
    upstream_manifest_outputs,
    voxel_volume_ml,
    workspace,
)
from lib.storage import write_json


def run(context) -> object:
    import numpy as np

    manifest = create_manifest(context.run_id, "structural_analysis")
    work = workspace("structural_analysis")

    # Prefer structural_prep artifacts; fall back to computing inline.
    prep = upstream_manifest_outputs(context, "structural_prep")
    prepped_ref = (prep or {}).get("preppedT1")
    mask_ref = (prep or {}).get("brainMask")

    try:
        if prepped_ref:
            prepped_local = work / "prepped-t1.nii.gz"
            fetch_artifact(prepped_ref, prepped_local, context.config.gcs_bucket)
            img, data = load_nifti(prepped_local)
            vol = np.asanyarray(data, dtype=np.float64)
            manifest.inputs["preppedT1"] = prepped_ref
        else:
            raise RuntimeError("no upstream prepped image")
        if mask_ref:
            mask_local = work / "brain-mask.nii.gz"
            fetch_artifact(mask_ref, mask_local, context.config.gcs_bucket)
            _, mask_data = load_nifti(mask_local)
            mask = np.asanyarray(mask_data).astype(bool)
            manifest.inputs["brainMask"] = mask_ref
        else:
            raise RuntimeError("no upstream mask")
    except Exception as exc:
        manifest.warnings.append(f"Upstream prep artifacts unavailable ({exc}); computing inline.")
        from jobs.common import input_files_from_run

        files = input_files_from_run(context.run_doc)
        meta, local = download_first_matching(context, files, (".nii", ".nii.gz"), work / "inputs")
        if meta is None or local is None:
            return manifest.fail("No NIfTI input available for structural analysis.")
        img, data = load_nifti(local)
        vol = np.asanyarray(data[..., 0] if data.ndim == 4 else data, dtype=np.float64)
        lo, hi = np.percentile(vol[np.isfinite(vol)], [0.5, 99.5])
        vol = np.clip((vol - lo) / max(hi - lo, 1e-9), 0, 1).astype(np.float32)
        zooms = img.header.get_zooms()[:3]
        voxel_mm = float(np.prod(zooms) ** (1.0 / 3.0))
        mask = rough_brain_mask(vol, skull_strip=True, affine=img.affine, voxel_mm=voxel_mm)
        manifest.inputs["sourceFile"] = meta.get("name")

    voxel_ml = voxel_volume_ml(img)
    mask_voxels = int(mask.sum())
    hemis = hemisphere_volumes_ml(mask, voxel_ml, affine=img.affine)
    stats = intensity_stats(vol, mask)

    metrics = {
        "totalIntracranialVolumeMl": round(mask_voxels * voxel_ml, 2),
        "leftHemisphereVolumeMl": round(hemis["leftHemisphereVolumeMl"], 2),
        "rightHemisphereVolumeMl": round(hemis["rightHemisphereVolumeMl"], 2),
        "meanMaskIntensity": round(stats["mean"], 4),
        "maskVoxels": mask_voxels,
        "voxelVolumeMl": round(voxel_ml, 5),
    }
    methods = {
        "totalIntracranialVolumeMl": {
            "method": "Background-adaptive rough brain mask volumetry with scalp-strip (voxel count x voxel volume)",
            "limitations": "Rough estimate, not a FreeSurfer-grade segmentation; conservative by design (net ~6 mm inside the head surface; inferior 15 mm excluded); compare only same-protocol timepoints.",
        },
        "leftHemisphereVolumeMl": {
            "method": "Mid-sagittal split of the rough mask at its centroid along the affine-derived left-right axis",
            "limitations": "Hemisphere split is geometric, not anatomical; does not correct for head rotation.",
        },
        "rightHemisphereVolumeMl": {
            "method": "Mid-sagittal split of the rough mask at its centroid along the affine-derived left-right axis",
            "limitations": "Hemisphere split is geometric, not anatomical; does not correct for head rotation.",
        },
        "meanMaskIntensity": {
            "method": "Mean of percentile-normalized intensity inside the rough mask",
            "limitations": "Acquisition-dependent; not comparable across scanners or protocols.",
        },
    }

    prefix = gcs_prefix(context, "structural_analysis")
    _maybe_run_fastsurfer(context, manifest, metrics, methods, work)
    payload = {"metrics": metrics, "methods": methods}
    write_json(context.config.gcs_bucket, f"{prefix}/summary-metrics.json", payload)
    manifest.outputs["summaryMetricsJson"] = f"{prefix}/summary-metrics.json"
    manifest.outputs["metrics"] = metrics

    for key, meta_info in methods.items():
        if key in metrics:
            add_safe_evidence(
                manifest, "Structural measurement", str(metrics[key]),
                meta_info["method"], meta_info["limitations"],
                unit="mL" if key.endswith("Ml") else None,
            )
    return manifest.complete()


def _maybe_run_fastsurfer(context, manifest, metrics: dict, methods: dict, work) -> None:
    """Optional FastSurfer hook (Blueprint Ch. 13).

    If ``run_fastsurfer.sh`` is installed in the image, run segmentation-only
    FastSurfer on the prepped T1 and upgrade the volume metrics with real
    segmentation outputs parsed from ``stats/aseg.stats``. Any failure falls
    back to the built-in mask volumetry with a warning — never a crash.
    """
    from jobs.common import binary_available

    if not binary_available("run_fastsurfer.sh"):
        manifest.warnings.append("FastSurfer not installed; using built-in mask volumetry (no cortical thickness).")
        return

    import re
    import subprocess

    t1_path = work / "fastsurfer-input.nii.gz"
    try:
        import nibabel as nib  # noqa: F401  (kept for future surface handling)

        from jobs.imaging import fetch_artifact, load_nifti, upstream_manifest_outputs

        prep = upstream_manifest_outputs(context, "structural_prep")
        prepped_ref = (prep or {}).get("preppedT1")
        if not prepped_ref:
            raise RuntimeError("no prepped T1 available")
        fetch_artifact(prepped_ref, t1_path, context.config.gcs_bucket)
        img, _ = load_nifti(t1_path)

        out_dir = work / "fastsurfer"
        result = subprocess.run(
            ["run_fastsurfer.sh", "--seg_only", "--t1", str(t1_path), "--sd", str(out_dir), "--sid", "subject"],
            capture_output=True, text=True, timeout=3600,
        )
        stats_path = out_dir / "subject" / "stats" / "aseg.stats"
        if result.returncode != 0 or not stats_path.exists():
            raise RuntimeError(f"FastSurfer seg_only failed: {result.stderr[-1000:]}")

        parsed: dict[str, float] = {}
        for line in stats_path.read_text().splitlines():
            m = re.match(r"#\s*Measure\s+(\S+),?\s+([\d.eE+-]+)", line)
            if m:
                parsed[m.group(1)] = float(m.group(2))

        upgraded = False
        if "EstimatedTotalIntraCranialVol" in parsed:
            metrics["totalIntracranialVolumeMl"] = round(parsed["EstimatedTotalIntraCranialVol"] / 1000.0, 2)
            methods["totalIntracranialVolumeMl"] = {
                "method": "FastSurfer segmentation (aseg.stats EstimatedTotalIntraCranialVol)",
                "limitations": "Segmentation quality depends on acquisition; review before longitudinal comparison.",
            }
            upgraded = True
        manifest.outputs["fastSurferStats"] = str(stats_path)
        manifest.outputs["fastSurferUsed"] = upgraded
        if upgraded:
            manifest.warnings.append("FastSurfer segmentation available; total intracranial volume upgraded from segmentation.")
    except Exception as exc:
        manifest.warnings.append(f"FastSurfer hook failed ({exc}); kept built-in mask volumetry.")
