from __future__ import annotations

from jobs.common import add_safe_evidence, create_manifest, first_matching_file, input_files_from_run, module_available


def run(context) -> object:
    manifest = create_manifest(context.run_id, "diffusion_prep")
    files = input_files_from_run(context.run_doc)
    manifest.inputs["files"] = files
    manifest.outputs["bvalBvecMetadata"] = f"runs/{context.run_id}/outputs/diffusion_prep/bval-bvec-metadata.json"
    manifest.outputs["brainMask"] = f"runs/{context.run_id}/outputs/diffusion_prep/brain_mask.nii.gz"
    manifest.outputs["preparedDiffusionImage"] = f"runs/{context.run_id}/outputs/diffusion_prep/dwi_prepared.nii.gz"
    manifest.outputs["qcJson"] = f"runs/{context.run_id}/outputs/diffusion_prep/qc.json"
    if not first_matching_file(files, (".bval",)):
        manifest.warnings.append("No .bval file found.")
    if not first_matching_file(files, (".bvec",)):
        manifest.warnings.append("No .bvec file found.")
    if not module_available("dipy"):
        manifest.warnings.append("DIPY is not importable.")
    add_safe_evidence(manifest, "Diffusion preparation", "pending", "DIPY/nibabel-compatible validation", "Correction quality depends on acquisition and available metadata.")
    return manifest.complete()
