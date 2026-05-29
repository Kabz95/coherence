from __future__ import annotations

from jobs.common import create_manifest, module_available


def run(context) -> object:
    manifest = create_manifest(context.run_id, "eeg_visualization_prep")
    manifest.outputs["downsampledTraceJson"] = f"runs/{context.run_id}/outputs/eeg_visualization_prep/trace.json"
    manifest.outputs["spectrogramJson"] = f"runs/{context.run_id}/outputs/eeg_visualization_prep/spectrogram.json"
    manifest.outputs["scalpMapPlaceholderJson"] = f"runs/{context.run_id}/outputs/eeg_visualization_prep/scalp-map-placeholder.json"
    manifest.outputs["eventTimelineJson"] = f"runs/{context.run_id}/outputs/eeg_visualization_prep/event-timeline.json"
    if not module_available("matplotlib"):
        manifest.warnings.append("matplotlib is not importable; static previews are unavailable.")
    return manifest.complete()
