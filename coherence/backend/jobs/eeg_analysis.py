from __future__ import annotations

from jobs.common import add_safe_evidence, create_manifest, module_available


def run(context) -> object:
    manifest = create_manifest(context.run_id, "eeg_analysis")
    manifest.outputs["bandPowerSummary"] = f"runs/{context.run_id}/outputs/eeg_analysis/band-power-summary.json"
    manifest.outputs["spectrogramData"] = f"runs/{context.run_id}/outputs/eeg_analysis/spectrogram.json"
    manifest.outputs["eventAnnotationSummary"] = f"runs/{context.run_id}/outputs/eeg_analysis/events.json"
    manifest.outputs["connectivityMetrics"] = f"runs/{context.run_id}/outputs/eeg_analysis/connectivity-placeholder.json"
    manifest.outputs["eegSummaryJson"] = f"runs/{context.run_id}/outputs/eeg_analysis/summary.json"
    manifest.outputs["evidenceLedgerJson"] = f"runs/{context.run_id}/outputs/eeg_analysis/evidence-ledger.json"
    if not module_available("mne"):
        manifest.warnings.append("MNE-Python is not importable.")
    add_safe_evidence(manifest, "EEG band-power summary", "pending", "MNE/numpy/scipy spectral analysis path", "Band-power summaries are non-diagnostic and sensitive to preprocessing choices.")
    return manifest.complete()
