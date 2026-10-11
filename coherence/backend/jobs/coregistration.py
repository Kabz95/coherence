from __future__ import annotations

from jobs.common import add_safe_evidence, create_manifest, module_available


def run(context) -> object:
    manifest = create_manifest(context.run_id, "coregistration")
    manifest.outputs["coregistrationStatusJson"] = f"runs/{context.run_id}/outputs/coregistration/status.json"
    manifest.outputs["coordinateSystemWarnings"] = []
    manifest.outputs["sourceLocalizationManifestPlaceholder"] = f"runs/{context.run_id}/outputs/coregistration/source-localization-manifest.json"
    if not module_available("mne"):
        manifest.warnings.append("MNE-Python is not importable.")
    manifest.warnings.append("Coregistration is a safe placeholder unless required coordinate inputs are available.")
    add_safe_evidence(manifest, "Coregistration status", "placeholder", "MNE/SimpleITK/nibabel-compatible architecture", "Coordinate alignment must be reviewed before source-localization use.")
    return manifest.complete()
