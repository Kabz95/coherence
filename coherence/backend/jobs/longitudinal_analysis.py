from __future__ import annotations

from jobs.common import add_safe_evidence, create_manifest, module_available


def run(context) -> object:
    manifest = create_manifest(context.run_id, "longitudinal_analysis")
    manifest.outputs["structuralTrendJson"] = f"runs/{context.run_id}/outputs/longitudinal_analysis/structural-trend.json"
    manifest.outputs["diffusionTrendJson"] = f"runs/{context.run_id}/outputs/longitudinal_analysis/diffusion-trend.json"
    manifest.outputs["eegTrendJson"] = f"runs/{context.run_id}/outputs/longitudinal_analysis/eeg-trend.json"
    manifest.outputs["comparabilityFlags"] = f"runs/{context.run_id}/outputs/longitudinal_analysis/comparability-flags.json"
    manifest.outputs["scannerProtocolWarnings"] = []
    manifest.outputs["evidenceLedgerJson"] = f"runs/{context.run_id}/outputs/longitudinal_analysis/evidence-ledger.json"
    if not module_available("pandas"):
        manifest.warnings.append("pandas is not importable.")
    add_safe_evidence(manifest, "Longitudinal trend", "pending", "pandas/numpy/scipy comparison across timepoints", "Trends are supplementary and depend on protocol comparability.")
    return manifest.complete()
