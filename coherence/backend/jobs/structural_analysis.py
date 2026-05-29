from __future__ import annotations

from jobs.common import add_placeholder, add_safe_evidence, binary_available, create_manifest


def run(context) -> object:
    manifest = create_manifest(context.run_id, "structural_analysis")
    manifest.outputs.update(
        {
            "segmentationFiles": [],
            "corticalThicknessTables": [],
            "regionalVolumeTables": [],
            "parcellationOutputs": [],
            "summaryMetricsJson": f"runs/{context.run_id}/outputs/structural_analysis/summary-metrics.json",
            "evidenceLedgerJson": f"runs/{context.run_id}/outputs/structural_analysis/evidence-ledger.json",
        }
    )
    if binary_available("run_fastsurfer.sh") or binary_available("FastSurferCNN"):
        manifest.outputs["processor"] = "FastSurfer available"
    else:
        add_placeholder(manifest, "processor", "FastSurfer is not installed; segmentation and measurement outputs are placeholders.")
    add_safe_evidence(manifest, "Structural measurement", "pending", "FastSurfer-compatible cortical/subcortical pipeline", "No diagnostic inference is generated.")
    return manifest.complete()
