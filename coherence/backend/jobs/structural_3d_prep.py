from __future__ import annotations

from jobs.common import create_manifest


def run(context) -> object:
    manifest = create_manifest(context.run_id, "structural_3d_prep")
    manifest.outputs["visualizationManifestJson"] = f"runs/{context.run_id}/outputs/structural_3d_prep/visualization-manifest.json"
    manifest.outputs["niiVueOverlays"] = []
    manifest.outputs["meshSurfaces"] = []
    manifest.outputs["previewThumbnails"] = []
    manifest.warnings.append("Surface and mesh generation requires FastSurfer/FreeSurfer-compatible outputs.")
    return manifest.complete()
