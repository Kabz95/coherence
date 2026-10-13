"""Shared electrophysiology core for the EEG and MEG pipelines.

Implements the MNE-Python-based processing both modalities share (Blueprint
Ch. 14, Ch. 16.3: MNE-Python is the first electrophysiology adapter; MEG is
ingested as imported recordings). The thin ``eeg_*`` / ``meg_*`` job modules
delegate here with their modality parameter.

Pipeline per modality: ingest -> prep -> analysis -> visualization_prep.
"""

from __future__ import annotations

from jobs.common import add_safe_evidence, create_manifest, input_files_from_run, module_available
from jobs.imaging import (
    fetch_artifact,
    gcs_prefix,
    resolve_input_file,
    save_spectrogram_plot,
    save_trace_plot,
    upload_artifact,
    upstream_manifest_outputs,
    workspace,
)
from lib.storage import write_json


MODALITY_SUFFIXES = {
    "eeg": (".edf", ".bdf", ".csv"),
    "meg": (".fif", ".fif.gz", ".ds", ".csv"),
}

BANDS = {
    "delta": (1.0, 4.0),
    "theta": (4.0, 8.0),
    "alpha": (8.0, 13.0),
    "beta": (13.0, 30.0),
    "gamma": (30.0, 40.0),
}


def _ingest_with_mne(local_path, work, modality):
    import mne

    raw = mne.io.read_raw(str(local_path), preload=True, verbose="ERROR")
    if modality == "meg":
        picks = mne.pick_types(raw.info, meg=True, exclude=[])
    else:
        picks = mne.pick_types(raw.info, eeg=True, exclude=[])
    ephys_raw = raw.copy().pick(picks if len(picks) else None)
    metadata = {
        "nChannels": len(ephys_raw.ch_names),
        "channelNames": ephys_raw.ch_names,
        "samplingRateHz": float(ephys_raw.info["sfreq"]),
        "durationSeconds": round(float(ephys_raw.times[-1]) if len(ephys_raw.times) else 0.0, 2),
        "units": "V" if modality == "eeg" else "T",
        "reader": "mne",
    }
    fif_path = work / "ingested-raw.fif"
    ephys_raw.save(fif_path, overwrite=True, verbose="ERROR")
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
    data = df[channel_cols].to_numpy(dtype=float).T
    npz_path = work / "ingested-eeg.npz"
    np.savez_compressed(npz_path, data=data, times=times, channels=np.array(channel_cols), sfreq=sfreq)
    return {
        "nChannels": len(channel_cols),
        "channelNames": channel_cols,
        "samplingRateHz": round(sfreq, 2),
        "durationSeconds": round(float(times[-1] - times[0]) if len(times) else 0.0, 2),
        "units": "unknown (CSV)",
        "reader": "csv-fallback",
    }, npz_path


def ingest(context, job_kind: str, modality: str):
    manifest = create_manifest(context.run_id, job_kind)
    files = input_files_from_run(context.run_doc)
    manifest.inputs["files"] = [{"name": f.get("name"), "storagePath": f.get("storagePath")} for f in files]

    suffixes = MODALITY_SUFFIXES[modality]
    target = next((f for f in files if str(f.get("name", "")).lower().endswith(suffixes)), None)
    if target is None:
        return manifest.fail(f"No {modality.upper()} input found (expected one of {suffixes}).")

    work = workspace(job_kind)
    try:
        local = resolve_input_file(context, target, work / "inputs")
    except Exception as exc:
        return manifest.fail(f"Could not download {modality.upper()} input: {exc}")

    lower = str(target.get("name", "")).lower()
    try:
        if lower.endswith(".csv"):
            metadata, working = _ingest_csv(local, work)
        elif module_available("mne"):
            metadata, working = _ingest_with_mne(local, work, modality)
        else:
            return manifest.fail("MNE-Python is not importable; cannot ingest this format.")
    except Exception as exc:
        return manifest.fail(f"{modality.upper()} ingest failed: {exc}")

    metadata["sourceName"] = target.get("name")
    working_gcs = upload_artifact(context, job_kind, working, f"ingested/{working.name}", "application/octet-stream")

    prefix = gcs_prefix(context, job_kind)
    write_json(context.config.gcs_bucket, f"{prefix}/{modality}-metadata.json", metadata)
    manifest.outputs[f"{modality}MetadataJson"] = f"{prefix}/{modality}-metadata.json"
    manifest.outputs["normalizedIntermediateFile"] = working_gcs
    manifest.outputs["metadata"] = metadata

    add_safe_evidence(
        manifest, f"{modality.upper()} ingest",
        f"{metadata['nChannels']} channels @ {metadata['samplingRateHz']} Hz, {metadata['durationSeconds']} s",
        f"Channel inventory via {metadata['reader']}",
        "Registration only; no signal interpretation or diagnostic inference.",
    )
    return manifest.complete()


def _prep_mne(data, sfreq, ch_names, modality):
    import mne

    ch_types = "mag" if modality == "meg" else "eeg"
    info = mne.create_info(ch_names=ch_names, sfreq=sfreq, ch_types=ch_types)
    raw = mne.io.RawArray(data, info, verbose="ERROR")
    raw.filter(1.0, 40.0, fir_design="firwin", verbose="ERROR")
    for line_freq in (60.0, 50.0):
        raw.notch_filter(line_freq, verbose="ERROR")
    if sfreq > 250:
        raw.resample(250.0, verbose="ERROR")
    return raw.get_data(), float(raw.info["sfreq"])


def _prep_numpy(data, sfreq):
    import numpy as np
    from scipy import signal

    nyq = sfreq / 2.0
    hi = min(40.0, 0.9 * nyq)
    sos = signal.butter(4, [1.0 / nyq, hi / nyq], btype="band", output="sos")
    filtered = signal.sosfiltfilt(sos, data, axis=1)
    for line in (60.0, 50.0):
        if line < nyq:
            b, a = signal.iirnotch(line, 30.0, fs=sfreq)
            filtered = signal.filtfilt(b, a, filtered, axis=1)
    if sfreq > 250:
        n = int(filtered.shape[1] * 250.0 / sfreq)
        filtered = signal.resample(filtered, n, axis=1)
        sfreq = 250.0
    return filtered, float(sfreq)


def prep(context, job_kind: str, modality: str):
    import numpy as np

    manifest = create_manifest(context.run_id, job_kind)
    work = workspace(job_kind)

    ingest_job = f"{modality}_ingest"
    upstream = upstream_manifest_outputs(context, ingest_job) or {}
    working_ref = upstream.get("normalizedIntermediateFile")
    if not working_ref:
        return manifest.fail(f"No ingested {modality.upper()} working copy from {ingest_job}.")

    working_local = work / "working-input"
    try:
        fetch_artifact(working_ref, working_local, context.config.gcs_bucket)
    except Exception as exc:
        return manifest.fail(f"Could not fetch ingested {modality.upper()}: {exc}")
    src = working_local
    if working_ref.endswith(".npz") and src.suffix != ".npz":
        src = src.with_suffix(".npz")
        working_local.rename(src)
    elif working_ref.endswith(".fif") and "fif" not in src.suffixes:
        src = src.with_name(src.name + ".fif")
        working_local.rename(src)

    if src.suffix == ".npz":
        z = np.load(src, allow_pickle=True)
        data, sfreq, ch_names, kind = z["data"].astype(float), float(z["sfreq"]), [str(c) for c in z["channels"]], "npz"
    else:
        import mne

        raw = mne.io.read_raw_fif(src, preload=True, verbose="ERROR")
        data, sfreq, ch_names, kind = raw.get_data(), float(raw.info["sfreq"]), raw.ch_names, "fif"
    manifest.inputs["nChannels"] = len(ch_names)
    manifest.inputs["samplingRateHz"] = sfreq

    if kind == "fif" and module_available("mne"):
        cleaned, new_sfreq = _prep_mne(data, sfreq, ch_names, modality)
        method = "MNE FIR band-pass 1-40 Hz + 50/60 Hz notch + resample<=250 Hz"
    else:
        cleaned, new_sfreq = _prep_numpy(data, sfreq)
        method = "scipy Butterworth band-pass 1-40 Hz + notch + resample<=250 Hz"

    variances = np.var(cleaned, axis=1)
    median_var = float(np.median(variances)) if variances.size else 0.0
    bad_channels = [name for name, var in zip(ch_names, variances)
                    if median_var > 0 and (var > 5 * median_var or var < 0.2 * median_var)]

    out_path = work / f"preprocessed-{modality}.npz"
    np.savez_compressed(out_path, data=cleaned, sfreq=new_sfreq, channels=np.array(ch_names))
    out_gcs = upload_artifact(context, job_kind, out_path, f"preprocessed-{modality}.npz", "application/octet-stream")

    qc_payload = {
        "method": method,
        "inputSfreqHz": sfreq,
        "outputSfreqHz": new_sfreq,
        "nChannels": len(ch_names),
        "badChannels": bad_channels,
        "medianChannelVariance": median_var,
    }
    prefix = gcs_prefix(context, job_kind)
    write_json(context.config.gcs_bucket, f"{prefix}/prep-qc.json", qc_payload)
    manifest.outputs["preprocessedFile"] = out_gcs
    manifest.outputs["prepQcJson"] = f"{prefix}/prep-qc.json"
    manifest.outputs["badChannels"] = bad_channels

    add_safe_evidence(
        manifest, f"{modality.upper()} preprocessing",
        f"{len(ch_names)} channels, {len(bad_channels)} flagged",
        method, "Flagged channels need technologist/clinician review; filtering choices affect downstream spectra.",
    )
    return manifest.complete()


def analyze(context, job_kind: str, modality: str):
    import numpy as np
    from scipy import signal

    manifest = create_manifest(context.run_id, job_kind)
    work = workspace(job_kind)

    prep_job = f"{modality}_prep"
    upstream = upstream_manifest_outputs(context, prep_job) or {}
    prepped_ref = upstream.get("preprocessedFile")
    if not prepped_ref:
        return manifest.fail(f"No preprocessed {modality.upper()} from {prep_job}.")

    local = work / f"preprocessed-{modality}.npz"
    try:
        fetch_artifact(prepped_ref, local, context.config.gcs_bucket)
    except Exception as exc:
        return manifest.fail(f"Could not fetch preprocessed {modality.upper()}: {exc}")

    z = np.load(local, allow_pickle=True)
    data = z["data"].astype(float)
    sfreq = float(z["sfreq"])
    ch_names = [str(c) for c in z["channels"]]
    manifest.inputs.update({"nChannels": len(ch_names), "sfreqHz": sfreq})

    freqs, psd = signal.welch(data, fs=sfreq, nperseg=min(1024, data.shape[1]), axis=1)
    # Relative epsilon: MEG data lives at ~1e-13 T, so an absolute 1e-18 guard
    # would swallow the true total power. Guard only against exact zeros.
    # The normalizer is the 1-40 Hz band power (matching the documented method
    # and the BANDS tiling), NOT broadband power: sub-1 Hz drift that survives
    # the high-pass must not leak into the denominator.
    band_total_idx = (freqs >= 1.0) & (freqs < 40.0)
    totals = psd[:, band_total_idx].sum(axis=1, keepdims=True)
    safe_totals = np.where(totals > 0, totals, 1e-300)

    band_means: dict[str, float] = {}
    per_channel = []
    for i, ch in enumerate(ch_names):
        row = {"channel": ch}
        for band, (lo, hi) in BANDS.items():
            idx = (freqs >= lo) & (freqs < hi)
            row[band] = round(float(psd[i][idx].sum() / safe_totals[i][0]), 4)
        per_channel.append(row)
    for band in BANDS:
        band_means[band] = round(float(np.mean([r[band] for r in per_channel])), 4)

    summary = {
        "bandPowers": band_means,
        "perChannel": per_channel,
        "nChannels": len(ch_names),
        "sfreqHz": sfreq,
        "method": "Welch PSD, relative band powers (band power / total 1-40 Hz power)",
        "limitations": (
            "Descriptive spectral summaries only. Sensitive to preprocessing, "
            "recording conditions, and artefacts. Not diagnostic."
        ),
    }
    prefix = gcs_prefix(context, job_kind)
    write_json(context.config.gcs_bucket, f"{prefix}/band-power-summary.json", summary)
    manifest.outputs["bandPowerSummaryJson"] = f"{prefix}/band-power-summary.json"
    manifest.outputs["bandPowers"] = band_means

    for band, value in band_means.items():
        add_safe_evidence(manifest, f"{modality.upper()} band power", f"{band}: {value}",
                          summary["method"], summary["limitations"])
    return manifest.complete()


def visualize(context, job_kind: str, modality: str):
    import numpy as np
    from scipy import signal

    manifest = create_manifest(context.run_id, job_kind)
    work = workspace(job_kind)

    prep_job = f"{modality}_prep"
    upstream = upstream_manifest_outputs(context, prep_job) or {}
    prepped_ref = upstream.get("preprocessedFile")
    if not prepped_ref:
        manifest.warnings.append(f"No preprocessed {modality.upper()} from {prep_job}; no preview assets produced.")
        return manifest.complete()

    local = work / f"preprocessed-{modality}.npz"
    try:
        fetch_artifact(prepped_ref, local, context.config.gcs_bucket)
    except Exception as exc:
        return manifest.fail(f"Could not fetch preprocessed {modality.upper()}: {exc}")

    z = np.load(local, allow_pickle=True)
    data = z["data"].astype(float)
    sfreq = float(z["sfreq"])
    ch_names = [str(c) for c in z["channels"]]

    seconds = min(10, int(data.shape[1] / sfreq))
    n_samples = int(seconds * sfreq)
    times = np.arange(n_samples) / sfreq
    trace_path = save_trace_plot(
        times, data[:, :n_samples], ch_names, work / f"{modality}-trace.png",
        title=f"{modality.upper()} trace (first {seconds}s) — {context.run_id}",
    )
    freqs, psd = signal.welch(data, fs=sfreq, nperseg=min(1024, data.shape[1]), axis=1)
    spec_path = save_spectrogram_plot(
        psd, freqs, work / f"{modality}-spectrogram.png",
        title=f"Mean power spectral density — {context.run_id}",
    )

    trace_gcs = upload_artifact(context, job_kind, trace_path, f"{modality}-trace.png", "image/png")
    spec_gcs = upload_artifact(context, job_kind, spec_path, f"{modality}-spectrogram.png", "image/png")

    manifest.outputs["tracePng"] = trace_gcs
    manifest.outputs["spectrogramPng"] = spec_gcs
    manifest.outputs["visualizationAssets"] = {f"{modality}_trace": trace_gcs, f"{modality}_spectrogram": spec_gcs}
    add_safe_evidence(
        manifest, "Viewer asset", f"{modality}-trace.png",
        f"Multi-channel trace preview of the preprocessed {modality.upper()} recording",
        "Rendered preview for clinician review; not a diagnostic tracing.",
    )
    return manifest.complete()
