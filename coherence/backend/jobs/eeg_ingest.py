"""EEG ingest: register and validate EEG source files.

Supported inputs: EDF (.edf), BDF (.bdf) via MNE-Python; CSV with a header
row (time + channel columns) via a lightweight fallback reader.

Outputs: `eeg-metadata.json` (channels, sampling rate, duration, units) and a
normalized working copy for the prep job. No signal interpretation happens here.
"""

from __future__ import annotations

from jobs.common import add_safe_evidence, create_manifest, input_files_from_run, module_available
from jobs.imaging import gcs_prefix, resolve_input_file, upload_artifact, workspace
from lib.storage import write_json


def _ingest_with_mne(local_path, work):
    import mne

    raw = mne.io.read_raw(str(local_path), preload=True, verbose="ERROR")
    picks = mne.pick_types(raw.info, eeg=True, exclude=[])
    eeg_raw = raw.copy().pick(picks if len(picks) else None)
    metadata = {
        "nChannels": len(eeg_raw.ch_names),
        "channelNames": eeg_raw.ch_names,
        "samplingRateHz": float(eeg_raw.info["sfreq"]),
        "durationSeconds": round(float(eeg_raw.times[-1]) if len(eeg_raw.times) else 0.0, 2),
        "units": "V",
        "reader": "mne",
    }
    fif_path = work / "ingested-raw.fif"
    eeg_raw.save(fif_path, overwrite=True, verbose="ERROR")
    return metadata, fif_path


def _ingest_csv(local_path, work):
    import numpy as np
    import pandas as pd

    df = pd.read_csv(local_path)
    cols = list(df.columns)
    time_col = cols[0]
    channel_cols = cols[1:]
    times = df[time_col].to_numpy(dtype=float)
    sfreq = float(1.0 / np.median(np.diff(times))) if len(times) > 1 else 0.0
    data = df[channel_cols].to_numpy(dtype=float).T  # channels x times
    npz_path = work / "ingested-eeg.npz"
    np.savez_compressed(npz_path, data=data, times=times, channels=np.array(channel_cols), sfreq=sfreq)
    metadata = {
        "nChannels": len(channel_cols),
        "channelNames": channel_cols,
        "samplingRateHz": round(sfreq, 2),
        "durationSeconds": round(float(times[-1] - times[0]) if len(times) else 0.0, 2),
        "units": "unknown (CSV)",
        "reader": "csv-fallback",
    }
    return metadata, npz_path


def run(context) -> object:
    manifest = create_manifest(context.run_id, "eeg_ingest")
    files = input_files_from_run(context.run_doc)
    manifest.inputs["files"] = [{"name": f.get("name"), "storagePath": f.get("storagePath")} for f in files]

    target = None
    for f in files:
        lower = str(f.get("name", "")).lower()
        if lower.endswith((".edf", ".bdf", ".csv")):
            target = f
            break
    if target is None:
        return manifest.fail("No EDF, BDF, or CSV EEG input found on this run.")

    work = workspace("eeg_ingest")
    try:
        local = resolve_input_file(context, target, work / "inputs")
    except Exception as exc:
        return manifest.fail(f"Could not download EEG input: {exc}")

    lower = str(target.get("name", "")).lower()
    try:
        if lower.endswith(".csv"):
            metadata, working = _ingest_csv(local, work)
        elif module_available("mne"):
            metadata, working = _ingest_with_mne(local, work)
        else:
            return manifest.fail("MNE-Python is not importable; cannot ingest EDF/BDF.")
    except Exception as exc:
        return manifest.fail(f"EEG ingest failed: {exc}")

    metadata["sourceName"] = target.get("name")
    working_gcs = upload_artifact(context, "eeg_ingest", working, f"ingested/{working.name}", "application/octet-stream")

    prefix = gcs_prefix(context, "eeg_ingest")
    write_json(context.config.gcs_bucket, f"{prefix}/eeg-metadata.json", metadata)
    manifest.outputs["eegMetadataJson"] = f"{prefix}/eeg-metadata.json"
    manifest.outputs["normalizedIntermediateFile"] = working_gcs
    manifest.outputs["metadata"] = metadata

    add_safe_evidence(
        manifest, "EEG ingest",
        f"{metadata['nChannels']} channels @ {metadata['samplingRateHz']} Hz, {metadata['durationSeconds']} s",
        f"Channel inventory via {metadata['reader']}",
        "Registration only; no signal interpretation or diagnostic inference.",
    )
    return manifest.complete()
