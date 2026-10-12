"""Quality control: real integrity and acquisition-quality checks on NIfTI inputs.

Checks per file:
- Header: dimensions, voxel sizes, datatype, affine validity.
- Data: NaN/Inf counts, zero-voxel fraction, intensity statistics.
- Slice dropout: axial slices whose mean intensity collapses relative to the
  volume median (a motion/susceptibility proxy, not a motion measurement).
- SNR proxy: mean/std inside a rough brain mask.

Writes `qc.json`; verdicts are pass / warn / fail and describe data quality
only — never clinical interpretation.
"""

from __future__ import annotations

from pathlib import Path

from jobs.common import add_safe_evidence, create_manifest, input_files_from_run
from jobs.imaging import (
    download_first_matching,
    gcs_prefix,
    intensity_stats,
    load_nifti,
    rough_brain_mask,
    upstream_manifest_outputs,
    workspace,
)
from lib.storage import write_json


def _qc_one(path: Path, name: str) -> dict:
    import numpy as np

    img, data = load_nifti(path)
    checks: dict = {"file": name}
    verdict = "pass"
    flags: list[str] = []

    # Header checks
    shape = list(data.shape)
    checks["shape"] = shape
    zooms = [float(z) for z in img.header.get_zooms()[:3]]
    checks["voxelSizeMm"] = zooms
    checks["dtype"] = str(data.dtype)
    if min(shape[:3]) < 32:
        flags.append("Very small spatial dimensions; verify this is a head volume.")
        verdict = "warn"
    if any(z <= 0 or z > 8 for z in zooms):
        flags.append(f"Unusual voxel size {zooms}; check acquisition.")
        verdict = "warn"
    try:
        _ = np.linalg.inv(img.affine)
    except Exception:
        flags.append("Affine is singular; spatial metadata is unreliable.")
        verdict = "fail"

    vol = data[..., 0] if data.ndim == 4 else data
    vol = np.asanyarray(vol, dtype=np.float64)

    # Data integrity
    n_nan = int(np.isnan(vol).sum())
    n_inf = int(np.isinf(vol).sum())
    checks["nanVoxels"] = n_nan
    checks["infVoxels"] = n_inf
    if n_nan or n_inf:
        flags.append(f"{n_nan} NaN and {n_inf} Inf voxels present.")
        verdict = "fail" if (n_nan + n_inf) > vol.size * 0.01 else "warn"

    zero_frac = float((vol == 0).sum() / vol.size)
    checks["zeroFraction"] = round(zero_frac, 4)
    if zero_frac > 0.6:
        flags.append("More than 60% of voxels are zero; background dominates the field of view.")
        verdict = "warn"

    stats = intensity_stats(vol)
    checks["intensity"] = {k: round(v, 3) if isinstance(v, float) else v for k, v in stats.items()}

    # Slice dropout proxy (axial)
    axial_means = vol.mean(axis=(0, 1))
    median = float(np.median(axial_means)) if axial_means.size else 0.0
    dropout = [int(i) for i, m in enumerate(axial_means) if median > 0 and m < 0.2 * median]
    checks["dropoutSliceCount"] = len(dropout)
    if dropout:
        flags.append(f"{len(dropout)} axial slice(s) show collapsed signal (possible dropout/motion).")
        verdict = "warn" if verdict == "pass" else verdict

    # SNR proxy inside a rough mask
    try:
        mask = rough_brain_mask(vol.astype(np.float32))
        masked = vol[mask]
        snr = float(masked.mean() / masked.std()) if masked.size and masked.std() > 0 else 0.0
        checks["snrProxy"] = round(snr, 2)
        checks["maskVoxels"] = int(mask.sum())
        if snr < 5:
            flags.append("Low SNR proxy inside the estimated brain region.")
            verdict = "warn" if verdict == "pass" else verdict
    except Exception as exc:
        flags.append(f"SNR proxy unavailable: {exc}")

    checks["verdict"] = verdict
    checks["flags"] = flags
    return checks


def run(context) -> object:
    manifest = create_manifest(context.run_id, "qc")
    files = input_files_from_run(context.run_doc)

    # Prefer converter outputs; fall back to raw run inputs.
    targets: list[tuple[str, Path]] = []
    work = workspace("qc")
    upstream = upstream_manifest_outputs(context, "converter")
    if upstream and upstream.get("convertedFiles"):
        from jobs.imaging import resolve_input_file

        for entry in upstream["convertedFiles"]:
            fake_meta = {"name": entry["name"], "storagePath": entry.get("gcsPath", ""), "sourceName": entry.get("sourceName")}
            try:
                # converted files live under the converter prefix; resolve via GCS path
                local = resolve_input_file(context, fake_meta, work / "converted")
                targets.append((entry["name"], local))
            except Exception as exc:
                manifest.warnings.append(f"Could not fetch converted file '{entry['name']}': {exc}")
    else:
        for file_meta in files:
            name = str(file_meta.get("name", "")).lower()
            if name.endswith((".nii", ".nii.gz")):
                try:
                    local = resolve_input_file(context, file_meta, work / "inputs")
                    targets.append((str(file_meta.get("name")), local))
                except Exception as exc:
                    manifest.warnings.append(f"Could not download '{file_meta.get('name')}': {exc}")

    if not targets:
        manifest.warnings.append("No NIfTI inputs available for QC.")
        add_safe_evidence(
            manifest, "Input quality-control flag", "no inputs",
            "File inventory check", "Does not provide clinical interpretation or diagnostic conclusions.",
        )
        return manifest.complete()

    results = []
    worst = "pass"
    for name, path in targets:
        try:
            result = _qc_one(path, name)
        except Exception as exc:
            result = {"file": name, "verdict": "fail", "flags": [f"QC crashed on this file: {exc}"]}
        results.append(result)
        if result["verdict"] == "fail":
            worst = "fail"
        elif result["verdict"] == "warn" and worst == "pass":
            worst = "warn"

    prefix = gcs_prefix(context, "qc")
    payload = {"files": results, "overallVerdict": worst}
    write_json(context.config.gcs_bucket, f"{prefix}/qc.json", payload)
    manifest.outputs["qcJson"] = f"{prefix}/qc.json"
    manifest.outputs["overallVerdict"] = worst
    manifest.outputs["inputCount"] = len(results)

    for result in results:
        add_safe_evidence(
            manifest,
            "Quality-control flag",
            f"{result['file']}: {result['verdict']}",
            "NIfTI header, intensity, slice-dropout, and SNR-proxy checks",
            "Describes acquisition/data quality only. " + (" ".join(result.get("flags", [])[:2])),
        )
    add_safe_evidence(
        manifest, "Quality-control summary", worst,
        "Aggregate of per-file QC verdicts",
        "Does not provide clinical interpretation or diagnostic conclusions.",
    )
    return manifest.complete()
