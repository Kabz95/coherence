from __future__ import annotations

from jobs.common import add_safe_evidence, create_manifest, first_matching_file, input_files_from_run, module_available


def run(context) -> object:
    manifest = create_manifest(context.run_id, "eeg_ingest")
    files = input_files_from_run(context.run_doc)
    manifest.inputs["files"] = files
    manifest.outputs["eegMetadataJson"] = f"runs/{context.run_id}/outputs/eeg_ingest/metadata.json"
    manifest.outputs["channelList"] = []
    manifest.outputs["samplingRate"] = None
    manifest.outputs["durationSeconds"] = None
    manifest.outputs["annotationsEvents"] = []
    manifest.outputs["normalizedIntermediateFile"] = f"runs/{context.run_id}/outputs/eeg_ingest/raw.fif"

    if not first_matching_file(files, (".edf", ".bdf", ".csv")):
        manifest.warnings.append("No EDF, BDF, or CSV placeholder input was found.")
    if not module_available("mne"):
        manifest.warnings.append("MNE-Python is not importable.")
    if not module_available("pyedflib"):
        manifest.warnings.append("pyEDFlib is not importable.")

    add_safe_evidence(manifest, "EEG ingest", "pending", "MNE/pyEDFlib-compatible metadata extraction", "No electrophysiological interpretation is generated.")
    return manifest.complete()
