from __future__ import annotations

from jobs.common import add_safe_evidence, create_manifest, module_available


def run(context) -> object:
    manifest = create_manifest(context.run_id, "diffusion_analysis")
    manifest.outputs.update(
        {
            "faMap": f"runs/{context.run_id}/outputs/diffusion_analysis/fa.nii.gz",
            "mdMap": f"runs/{context.run_id}/outputs/diffusion_analysis/md.nii.gz",
            "rdMap": f"runs/{context.run_id}/outputs/diffusion_analysis/rd.nii.gz",
            "adMap": f"runs/{context.run_id}/outputs/diffusion_analysis/ad.nii.gz",
            "tractographyFile": None,
            "connectivityMatrix": f"runs/{context.run_id}/outputs/diffusion_analysis/connectivity-matrix.json",
            "diffusionSummaryJson": f"runs/{context.run_id}/outputs/diffusion_analysis/summary.json",
            "evidenceLedgerJson": f"runs/{context.run_id}/outputs/diffusion_analysis/evidence-ledger.json",
        }
    )
    if module_available("dipy"):
        manifest.outputs["processor"] = "DIPY tensor fitting path available"
    else:
        manifest.warnings.append("DIPY is not importable; diffusion metric maps are placeholders.")
    add_safe_evidence(manifest, "Diffusion metric", "pending", "DIPY tensor fitting for FA/MD/RD/AD", "Metrics are supplementary measurements and require acquisition/QC review.")
    return manifest.complete()
