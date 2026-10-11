"""EEG visualization prep: trace and spectrogram previews for the viewer shell."""

from __future__ import annotations

from jobs.common import add_safe_evidence, create_manifest
from jobs.imaging import (
    fetch_artifact,
    save_spectrogram_plot,
    save_trace_plot,
    upload_artifact,
    upstream_manifest_outputs,
    workspace,
)


def run(context) -> object:
    import numpy as np
    from scipy import signal

    manifest = create_manifest(context.run_id, "eeg_visualization_prep")
    work = workspace("eeg_visualization_prep")

    prep = upstream_manifest_outputs(context, "eeg_prep") or {}
    prepped_ref = prep.get("preprocessedEegFile")
    if not prepped_ref:
        manifest.warnings.append("No preprocessed EEG from eeg_prep; no preview assets produced.")
        return manifest.complete()

    local = work / "preprocessed-eeg.npz"
    try:
        fetch_artifact(prepped_ref, local, context.config.gcs_bucket)
    except Exception as exc:
        return manifest.fail(f"Could not fetch preprocessed EEG: {exc}")

    z = np.load(local, allow_pickle=True)
    data = z["data"].astype(float)
    sfreq = float(z["sfreq"])
    ch_names = [str(c) for c in z["channels"]]

    seconds = min(10, int(data.shape[1] / sfreq))
    n_samples = int(seconds * sfreq)
    times = np.arange(n_samples) / sfreq
    trace_path = save_trace_plot(
        times, data[:, :n_samples], ch_names, work / "eeg-trace.png",
        title=f"EEG trace (first {seconds}s) — {context.run_id}",
    )
    freqs, psd = signal.welch(data, fs=sfreq, nperseg=min(1024, data.shape[1]), axis=1)
    spec_path = save_spectrogram_plot(
        psd, freqs, work / "eeg-spectrogram.png",
        title=f"Mean power spectral density — {context.run_id}",
    )

    trace_gcs = upload_artifact(context, "eeg_visualization_prep", trace_path, "eeg-trace.png", "image/png")
    spec_gcs = upload_artifact(context, "eeg_visualization_prep", spec_path, "eeg-spectrogram.png", "image/png")

    manifest.outputs["tracePng"] = trace_gcs
    manifest.outputs["spectrogramPng"] = spec_gcs
    manifest.outputs["visualizationAssets"] = {"eeg_trace": trace_gcs, "eeg_spectrogram": spec_gcs}
    add_safe_evidence(
        manifest, "Viewer asset", "eeg-trace.png",
        "Multi-channel trace preview of the preprocessed recording",
        "Rendered preview for clinician review; not a diagnostic tracing.",
    )
    return manifest.complete()
