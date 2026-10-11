from __future__ import annotations

from jobs.common import create_manifest


def run(context) -> object:
    manifest = create_manifest(context.run_id, "diffusion_3d_prep")
    manifest.outputs["tractographyVisualizationManifest"] = f"runs/{context.run_id}/outputs/diffusion_3d_prep/tractography-manifest.json"
    manifest.outputs["connectomeGraphJson"] = f"runs/{context.run_id}/outputs/diffusion_3d_prep/connectome-graph.json"
    manifest.outputs["regionToRegionMatrixJson"] = f"runs/{context.run_id}/outputs/diffusion_3d_prep/region-matrix.json"
    manifest.outputs["previewAssets"] = []
    manifest.warnings.append("Streamline and connectome visualization require diffusion analysis outputs.")
    return manifest.complete()
