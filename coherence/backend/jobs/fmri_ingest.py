"""fMRI ingest: validate the BOLD series and read acquisition metadata.

Locates the 4D BOLD NIfTI and reads the repetition time (TR) from a BIDS
sidecar JSON (``RepetitionTime``) when present, falling back to run metadata.
Writes ``fmri-metadata.json``. No signal interpretation happens here.

Reference pipeline: fMRIPrep (BIDS-native preprocessing, community default).
"""

from __future__ import annotations

from jobs.common import add_safe_evidence, create_manifest, input_files_from_run
from jobs.imaging import gcs_prefix, load_nifti, resolve_input_file, upstream_manifest_outputs, workspace
from lib.storage import write_json


def _read_tr(context, files, bold_meta) -> float | None:
    import json as _json

    # BIDS sidecar: same stem, .json extension
    stem = str(bold_meta.get("name", "")).split(".nii")[0]
    for f in files:
        if str(f.get("name", "")).lower() == f"{stem.lower()}.json":
            try:
                dest_dir = workspace("fmri_sidecar")
                resolve_input_file(context, f, dest_dir)
                sidecar = dest_dir / str(f.get("name"))
                payload = _json.loads(sidecar.read_text())
                tr = payload.get("RepetitionTime")
                if tr:
                    return float(tr)
            except Exception:
                continue
    tr = (context.run_doc or {}).get("repetitionTimeSec")
    return float(tr) if tr else None


def run(context) -> object:
    manifest = create_manifest(context.run_id, "fmri_ingest")

    upstream = upstream_manifest_outputs(context, "converter")
    if upstream and upstream.get("convertedFiles"):
        files = [{"name": e["name"], "storagePath": e.get("gcsPath", ""), "sourceName": e.get("sourceName")} for e in upstream["convertedFiles"]]
    else:
        files = input_files_from_run(context.run_doc)
    raw_files = input_files_from_run(context.run_doc)

    work = workspace("fmri_ingest")
    bold_meta = bold_local = None
    for f in files:
        if str(f.get("name", "")).lower().endswith((".nii", ".nii.gz")):
            try:
                bold_local = resolve_input_file(context, f, work / "inputs")
                bold_meta = f
                break
            except Exception as exc:
                manifest.warnings.append(f"Could not download '{f.get('name')}': {exc}")

    if bold_local is None:
        return manifest.fail("No BOLD NIfTI input found on this run.")

    img, data = load_nifti(bold_local)
    if data.ndim != 4 or data.shape[3] < 10:
        return manifest.fail(f"BOLD input must be 4D with >= 10 volumes (got shape {data.shape}).")

    tr = _read_tr(context, raw_files, bold_meta)
    if tr is None:
        manifest.warnings.append("Repetition time unknown (no BIDS sidecar or run metadata); temporal filters will be skipped downstream.")
    elif tr <= 0 or tr > 10:
        manifest.warnings.append(f"Unusual TR value ({tr} s); verify acquisition metadata.")
        tr = None

    metadata = {
        "sourceName": bold_meta.get("name"),
        "shape": [int(d) for d in data.shape],
        "nVolumes": int(data.shape[3]),
        "repetitionTimeSec": tr,
        "durationSec": round(data.shape[3] * tr, 1) if tr else None,
        "voxelSizeMm": [float(z) for z in img.header.get_zooms()[:3]],
        "referencePipeline": "fMRIPrep",
    }
    prefix = gcs_prefix(context, "fmri_ingest")
    write_json(context.config.gcs_bucket, f"{prefix}/fmri-metadata.json", metadata)
    manifest.outputs["fmriMetadataJson"] = f"{prefix}/fmri-metadata.json"
    manifest.outputs["metadata"] = metadata

    add_safe_evidence(
        manifest, "fMRI ingest",
        f"{data.shape[3]} volumes" + (f", TR {tr} s" if tr else ", TR unknown"),
        "4D BOLD validation + BIDS sidecar TR read",
        "Registration only; no signal interpretation or diagnostic inference.",
    )
    return manifest.complete()
