"""EEG analysis: Welch power-spectral-density band powers.

Computes mean PSD per channel (Welch) and relative band powers for the
canonical bands: delta (1-4 Hz), theta (4-8), alpha (8-13), beta (13-30),
gamma (30-40). Writes `band-power-summary.json` with per-band means and the
full per-channel table.

Band powers are non-diagnostic descriptive summaries; they are sensitive to
preprocessing choices and recording conditions.
"""

from __future__ import annotations

from jobs.common import add_safe_evidence, create_manifest
from jobs.imaging import fetch_artifact, gcs_prefix, upstream_manifest_outputs, workspace
from lib.storage import write_json


BANDS = {
    "delta": (1.0, 4.0),
    "theta": (4.0, 8.0),
    "alpha": (8.0, 13.0),
    "beta": (13.0, 30.0),
    "gamma": (30.0, 40.0),
}


def run(context) -> object:
    import numpy as np
    from scipy import signal

    manifest = create_manifest(context.run_id, "eeg_analysis")
    work = workspace("eeg_analysis")

    prep = upstream_manifest_outputs(context, "eeg_prep") or {}
    prepped_ref = prep.get("preprocessedEegFile")
    if not prepped_ref:
        return manifest.fail("No preprocessed EEG from eeg_prep.")

    local = work / "preprocessed-eeg.npz"
    try:
        fetch_artifact(prepped_ref, local, context.config.gcs_bucket)
    except Exception as exc:
        return manifest.fail(f"Could not fetch preprocessed EEG: {exc}")

    z = np.load(local, allow_pickle=True)
    data = z["data"].astype(float)  # channels x times
    sfreq = float(z["sfreq"])
    ch_names = [str(c) for c in z["channels"]]
    manifest.inputs.update({"nChannels": len(ch_names), "sfreqHz": sfreq})

    freqs, psd = signal.welch(data, fs=sfreq, nperseg=min(1024, data.shape[1]), axis=1)
    total = psd.sum(axis=1, keepdims=True) + 1e-18

    band_means: dict[str, float] = {}
    per_channel = []
    for i, ch in enumerate(ch_names):
        row = {"channel": ch}
        for band, (lo, hi) in BANDS.items():
            idx = (freqs >= lo) & (freqs < hi)
            row[band] = round(float(psd[i][idx].sum() / total[i][0]), 4)
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
    prefix = gcs_prefix(context, "eeg_analysis")
    write_json(context.config.gcs_bucket, f"{prefix}/band-power-summary.json", summary)
    manifest.outputs["bandPowerSummaryJson"] = f"{prefix}/band-power-summary.json"
    manifest.outputs["bandPowers"] = band_means

    for band, value in band_means.items():
        add_safe_evidence(
            manifest, "EEG band power", f"{band}: {value}",
            summary["method"], summary["limitations"],
        )
    return manifest.complete()
