from __future__ import annotations

from jobs.common import add_safe_evidence, create_manifest
from lib.clinical_safety import GENERAL_DISCLAIMER


def run(context) -> object:
    manifest = create_manifest(context.run_id, "report_builder")
    manifest.outputs["structuredReportJson"] = f"runs/{context.run_id}/outputs/report_builder/report.json"
    manifest.outputs["sections"] = [
        "Administrative details",
        "Data inputs",
        "Quality-control summary",
        "Structural MRI measurement summary",
        "Diffusion measurement summary",
        "EEG measurement summary",
        "Longitudinal comparison",
        "Evidence ledger",
        "Limitations",
        "Non-diagnostic interpretation statement",
    ]
    manifest.outputs["disclaimer"] = GENERAL_DISCLAIMER
    manifest.warnings.append("Report builder assembles provided outputs only and does not invent findings.")
    add_safe_evidence(manifest, "Report assembly", "non-diagnostic summary", "Manifest and output aggregation", "Depends on upstream outputs and does not generate clinical claims.")
    return manifest.complete()
