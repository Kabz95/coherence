from __future__ import annotations

from jobs.common import add_safe_evidence, create_manifest, module_available


def run(context) -> object:
    manifest = create_manifest(context.run_id, "eeg_prep")
    manifest.outputs["preprocessedEegFile"] = f"runs/{context.run_id}/outputs/eeg_prep/preprocessed_raw.fif"
    manifest.outputs["preprocessingQcJson"] = f"runs/{context.run_id}/outputs/eeg_prep/qc.json"
    manifest.outputs["channelQualityJson"] = f"runs/{context.run_id}/outputs/eeg_prep/channel-quality.json"
    manifest.outputs["processingOptions"] = {
        "filtering": "placeholder",
        "notchFilter": "optional",
        "reReference": "optional",
        "badChannelDetection": "placeholder",
        "artifactSummary": "placeholder",
    }
    if not module_available("mne"):
        manifest.warnings.append("MNE-Python is not importable; EEG preprocessing outputs are placeholders.")
    add_safe_evidence(manifest, "EEG preprocessing", "pending", "MNE-compatible filtering and QC stage", "Artifact flags require clinician/technologist review.")
    return manifest.complete()
