from __future__ import annotations

from jobs.common import add_safe_evidence, create_manifest, input_files_from_run


def run(context) -> object:
    manifest = create_manifest(context.run_id, "qc")
    files = input_files_from_run(context.run_doc)
    manifest.inputs["files"] = files
    manifest.outputs["qcJson"] = f"runs/{context.run_id}/outputs/qc/qc.json"
    manifest.outputs["inputCount"] = len(files)
    if not files:
        manifest.warnings.append("No input files are attached to this run.")
    add_safe_evidence(
        manifest,
        "Input quality-control flag",
        "pending" if files else "no inputs",
        "File inventory and modality-specific QC placeholder",
        "Does not provide clinical interpretation or diagnostic conclusions.",
    )
    return manifest.complete()
