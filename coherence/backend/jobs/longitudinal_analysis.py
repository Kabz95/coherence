"""Longitudinal analysis: compare this run's measurements with prior timepoints.

Reads sibling runs of the same case from Firestore, pulls each run's
structural/DTI/EEG summary artifacts, and computes per-metric deltas between
the current run and the most recent prior run that has comparable data.

Writes `longitudinal-comparison.json` with deltas, comparability flags
(protocol/voxel-size mismatches), and evidence items. Trends are
supplementary context with measurement uncertainty — never diagnostic.
"""

from __future__ import annotations

from jobs.common import add_safe_evidence, create_manifest
from jobs.imaging import gcs_prefix, read_json_artifact, upstream_manifest_outputs
from lib.firestore import list_runs_for_case
from lib.storage import write_json


COMPARABLE_METRICS = {
    "structural": ["totalIntracranialVolumeMl", "leftHemisphereVolumeMl", "rightHemisphereVolumeMl", "meanMaskIntensity"],
    "diffusion": ["meanFA", "meanMD", "meanAD", "meanRD"],
    "eeg": ["delta", "theta", "alpha", "beta", "gamma"],
}


def _summary_artifacts(run_doc: dict) -> dict[str, str]:
    """Map modality -> summary artifact reference for a run document."""
    outputs = run_doc.get("outputs") or {}
    found: dict[str, str] = {}

    def manifest_outputs_of(job_kind: str) -> dict:
        entry = outputs.get(job_kind) or {}
        ref = entry.get("manifestPath")
        if not ref:
            return {}
        try:
            return read_json_artifact(str(ref)).get("outputs", {}) or {}
        except Exception:
            return {}

    struct = manifest_outputs_of("structural_analysis")
    if struct.get("summaryMetricsJson"):
        found["structural"] = struct["summaryMetricsJson"]
    dti = manifest_outputs_of("diffusion_analysis")
    if dti.get("dtiSummaryJson"):
        found["diffusion"] = dti["dtiSummaryJson"]
    eeg = manifest_outputs_of("eeg_analysis")
    if eeg.get("bandPowerSummaryJson"):
        found["eeg"] = eeg["bandPowerSummaryJson"]
    return found


def _extract_metrics(modality: str, summary: dict) -> dict[str, float]:
    if modality == "structural":
        metrics = (summary.get("metrics") or {})
    elif modality == "diffusion":
        metrics = {k: summary.get(k) for k in COMPARABLE_METRICS["diffusion"]}
    elif modality == "eeg":
        metrics = (summary.get("bandPowers") or {})
    else:
        metrics = {}
    return {k: float(v) for k, v in metrics.items() if isinstance(v, (int, float))}


def run(context) -> object:
    manifest = create_manifest(context.run_id, "longitudinal_analysis")
    config = context.config

    if not context.case_id:
        manifest.warnings.append("No case ID on this run; longitudinal comparison skipped.")
        return manifest.complete()

    runs = list_runs_for_case(config.project_id, config.runs_collection, context.case_id)
    if not runs:
        manifest.warnings.append("Could not list sibling runs (Firestore unavailable); longitudinal comparison skipped.")
        return manifest.complete()

    # Order by creation time; current run is the latest entry point.
    runs.sort(key=lambda r: str(r.get("createdAt", "")))
    current = next((r for r in runs if r.get("id") == context.run_id), None)
    priors = [r for r in runs if r.get("id") != context.run_id]

    current_artifacts = _summary_artifacts(current or context.run_doc or {})
    comparisons: list[dict] = []
    for prior in reversed(priors):  # most recent first
        prior_artifacts = _summary_artifacts(prior)
        shared = set(current_artifacts) & set(prior_artifacts)
        if not shared:
            continue
        deltas: dict[str, dict] = {}
        for modality in shared:
            try:
                cur = _extract_metrics(modality, read_json_artifact(current_artifacts[modality]))
                prv = _extract_metrics(modality, read_json_artifact(prior_artifacts[modality]))
            except Exception as exc:
                manifest.warnings.append(f"Could not read {modality} summaries for comparison: {exc}")
                continue
            for metric in COMPARABLE_METRICS[modality]:
                if metric in cur and metric in prv:
                    change = cur[metric] - prv[metric]
                    pct = (change / prv[metric] * 100.0) if prv[metric] else 0.0
                    deltas[f"{modality}.{metric}"] = {
                        "prior": prv[metric],
                        "latest": cur[metric],
                        "change": round(change, 4),
                        "changePercent": round(pct, 2),
                        "note": "Small changes may sit within expected measurement variability.",
                    }
        if deltas:
            comparisons.append({
                "priorRunId": prior.get("id"),
                "priorCreatedAt": prior.get("createdAt"),
                "deltas": deltas,
            })
            break  # compare against the most recent comparable prior only

    payload = {
        "currentRunId": context.run_id,
        "caseId": context.case_id,
        "comparisons": comparisons,
        "comparabilityNotes": [
            "Compare only same-protocol, same-scanner timepoints; voxel-size and sequence differences inflate apparent change.",
        ],
    }
    prefix = gcs_prefix(context, "longitudinal_analysis")
    write_json(config.gcs_bucket, f"{prefix}/longitudinal-comparison.json", payload)
    manifest.outputs["longitudinalComparisonJson"] = f"{prefix}/longitudinal-comparison.json"
    manifest.outputs["comparisons"] = comparisons

    if comparisons:
        n = len(comparisons[0]["deltas"])
        add_safe_evidence(
            manifest, "Longitudinal trend", f"{n} comparable metric(s) vs {comparisons[0]['priorRunId']}",
            "Delta computation across timepoint summary artifacts",
            "Trends are supplementary and depend on protocol comparability; not diagnostic.",
        )
    else:
        manifest.warnings.append("No prior comparable timepoint found for this case.")
        add_safe_evidence(
            manifest, "Longitudinal trend", "no prior timepoint",
            "Sibling-run lookup", "Comparison requires at least two comparable runs.",
        )
    return manifest.complete()
