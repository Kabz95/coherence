from __future__ import annotations

from jobs.common import add_placeholder, add_safe_evidence, binary_available, create_manifest, first_matching_file, input_files_from_run, module_available


def run(context) -> object:
    manifest = create_manifest(context.run_id, "converter")
    files = input_files_from_run(context.run_doc)
    manifest.inputs["files"] = files
    manifest.outputs["metadataJson"] = f"runs/{context.run_id}/outputs/converter/metadata.json"
    manifest.outputs["conversionLogJson"] = f"runs/{context.run_id}/outputs/converter/conversion-log.json"

    if first_matching_file(files, (".nii", ".nii.gz")):
        manifest.outputs["standardizedNifti"] = "input NIfTI accepted for standardization"
        add_safe_evidence(manifest, "NIfTI validation", "pending", "nibabel validation path", "Header and affine checks require source file download.")
    elif first_matching_file(files, (".zip",)):
        if binary_available("dcm2niix"):
            manifest.outputs["standardizedNifti"] = "dcm2niix conversion path available"
        else:
            add_placeholder(manifest, "standardizedNifti", "dcm2niix binary is not installed in this image.")
    else:
        add_placeholder(manifest, "standardizedNifti", "No DICOM ZIP or NIfTI input file was found on the run document.")

    if not module_available("nibabel"):
        manifest.warnings.append("nibabel is not importable.")
    if not module_available("pydicom"):
        manifest.warnings.append("pydicom is not importable.")

    return manifest.complete()
