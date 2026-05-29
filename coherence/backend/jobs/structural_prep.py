from __future__ import annotations

from jobs.common import add_placeholder, add_safe_evidence, binary_available, create_manifest, module_available


def run(context) -> object:
    manifest = create_manifest(context.run_id, "structural_prep")
    manifest.outputs["brainExtractedNifti"] = f"runs/{context.run_id}/outputs/structural_prep/brain.nii.gz"
    manifest.outputs["brainMask"] = f"runs/{context.run_id}/outputs/structural_prep/brain_mask.nii.gz"
    manifest.outputs["qcJson"] = f"runs/{context.run_id}/outputs/structural_prep/qc.json"
    manifest.outputs["previewPngs"] = []

    if binary_available("hd-bet"):
        manifest.outputs["processor"] = "HD-BET available"
    else:
        add_placeholder(manifest, "processor", "HD-BET is not installed; brain extraction outputs are placeholders.")

    if not module_available("nibabel"):
        manifest.warnings.append("nibabel is not importable.")

    add_safe_evidence(manifest, "Structural preprocessing", "placeholder", "HD-BET-compatible brain extraction stage", "Skull stripping requires source NIfTI and installed HD-BET models.")
    return manifest.complete()
