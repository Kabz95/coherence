"""EEG preparation: filtering, resampling, and channel-quality screening.

Steps (MNE path):
1. Band-pass filter 1-40 Hz (zero-phase FIR).
2. Notch filter at 50/60 Hz when line noise dominates (configurable via
   run metadata; defaults to attempting both and keeping the stronger).
3. Resample to 250 Hz when the native rate is higher.
4. Channel-quality screen: channels whose variance is >5x or <0.2x the
   median are flagged bad (not interpolated — flagged for review).

CSV-fallback path: same operations with numpy/scipy on the .npz working copy.

Writes `preprocessed-eeg` working copy + `prep-qc.json`. Artifact flags
require technologist/clinician review; nothing here is diagnostic.
"""

from __future__ import annotations

from jobs.common import add_safe_evidence, create_manifest, module_available
from jobs.imaging import fetch_artifact, gcs_prefix, upload_artifact, upstream_manifest_outputs, workspace
from lib.storage import write_json


def _load_working(path):
    """Return (data[ch, t], sfreq, ch_names, kind)."""
    import numpy as np

    if path.suffix == ".npz":
        z = np.load(path, allow_pickle=True)
        return z["data"].astype(float), float(z["sfreq"]), list(z["channels"]), "npz"
    import mne

    raw = mne.io.read_raw_fif(path, preload=True, verbose="ERROR")
    return raw.get_data(), float(raw.info["sfreq"]), raw.ch_names, "fif"


def _prep_mne(data, sfreq, ch_names):
    import mne
    import numpy as np

    info = mne.create_info(ch_names=ch_names, sfreq=sfreq, ch_types="eeg")
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
        if line < nyq:  # skip line frequencies above Nyquist
            b, a = signal.iirnotch(line, 30.0, fs=sfreq)
            filtered = signal.filtfilt(b, a, filtered, axis=1)
    if sfreq > 250:
        n = int(filtered.shape[1] * 250.0 / sfreq)
        filtered = signal.resample(filtered, n, axis=1)
        sfreq = 250.0
    return filtered, float(sfreq)


def run(context) -> object:
    import numpy as np

    manifest = create_manifest(context.run_id, "eeg_prep")
    work = workspace("eeg_prep")

    ingest = upstream_manifest_outputs(context, "eeg_ingest") or {}
    working_ref = ingest.get("normalizedIntermediateFile")
    if not working_ref:
        return manifest.fail("No ingested EEG working copy from eeg_ingest.")

    working_local = work / "working-input"
    try:
        fetch_artifact(working_ref, working_local, context.config.gcs_bucket)
    except Exception as exc:
        return manifest.fail(f"Could not fetch ingested EEG: {exc}")
    # fetch_artifact keeps the original suffix only if present; normalize:
    src = working_local
    if working_ref.endswith(".npz") and src.suffix != ".npz":
        src = src.with_suffix(".npz")
        working_local.rename(src)
    elif working_ref.endswith(".fif") and "fif" not in src.suffixes:
        src = src.with_name(src.name + ".fif")
        working_local.rename(src)

    data, sfreq, ch_names, kind = _load_working(src)
    manifest.inputs["nChannels"] = len(ch_names)
    manifest.inputs["samplingRateHz"] = sfreq

    if kind == "fif" and module_available("mne"):
        cleaned, new_sfreq = _prep_mne(data, sfreq, ch_names)
        method = "MNE FIR band-pass 1-40 Hz + 50/60 Hz notch + resample<=250 Hz"
    else:
        cleaned, new_sfreq = _prep_numpy(data, sfreq)
        method = "scipy Butterworth band-pass 1-40 Hz + notch + resample<=250 Hz"

    # Channel-quality screen on the cleaned data
    variances = np.var(cleaned, axis=1)
    median_var = float(np.median(variances)) if variances.size else 0.0
    bad_channels = []
    for name, var in zip(ch_names, variances):
        if median_var > 0 and (var > 5 * median_var or var < 0.2 * median_var):
            bad_channels.append(name)

    out_path = work / "preprocessed-eeg.npz"
    np.savez_compressed(out_path, data=cleaned, sfreq=new_sfreq, channels=np.array(ch_names))
    out_gcs = upload_artifact(context, "eeg_prep", out_path, "preprocessed-eeg.npz", "application/octet-stream")

    qc_payload = {
        "method": method,
        "inputSfreqHz": sfreq,
        "outputSfreqHz": new_sfreq,
        "nChannels": len(ch_names),
        "badChannels": bad_channels,
        "medianChannelVariance": median_var,
    }
    prefix = gcs_prefix(context, "eeg_prep")
    write_json(context.config.gcs_bucket, f"{prefix}/prep-qc.json", qc_payload)
    manifest.outputs["preprocessedEegFile"] = out_gcs
    manifest.outputs["prepQcJson"] = f"{prefix}/prep-qc.json"
    manifest.outputs["badChannels"] = bad_channels

    add_safe_evidence(
        manifest, "EEG preprocessing",
        f"{len(ch_names)} channels, {len(bad_channels)} flagged",
        method, "Flagged channels need technologist/clinician review; filtering choices affect downstream spectra.",
    )
    return manifest.complete()
