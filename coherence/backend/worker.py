from __future__ import annotations

import importlib
import importlib.util
import os
import sys
from dataclasses import dataclass
from typing import Any

from lib.config import WorkerConfig, get_config
from lib.firestore import get_run, update_run
from lib.logging import log_event
from lib.manifests import JobManifest, manifest_path, utc_now
from lib.storage import write_json


JOB_MODULES = {
    "converter": "jobs.converter",
    "qc": "jobs.qc",
    "structural_prep": "jobs.structural_prep",
    "structural_analysis": "jobs.structural_analysis",
    "structural_3d_prep": "jobs.structural_3d_prep",
    "diffusion_prep": "jobs.diffusion_prep",
    "diffusion_analysis": "jobs.diffusion_analysis",
    "diffusion_3d_prep": "jobs.diffusion_3d_prep",
    "eeg_ingest": "jobs.eeg_ingest",
    "eeg_prep": "jobs.eeg_prep",
    "eeg_analysis": "jobs.eeg_analysis",
    "eeg_visualization_prep": "jobs.eeg_visualization_prep",
    "report_builder": "jobs.report_builder",
    "longitudinal_analysis": "jobs.longitudinal_analysis",
    "coregistration": "jobs.coregistration",
}


@dataclass
class JobContext:
    config: WorkerConfig
    run_id: str
    run_doc: dict[str, Any] | None
    case_id: str | None


def job_kind_to_stage_prefix(job_kind: str) -> str:
    return job_kind.replace("_", "-")


def stage_matches_job(stage: dict[str, Any], job_kind: str, job_name: str | None) -> bool:
    stage_id = str(stage.get("id") or "")
    stage_name = str(stage.get("jobName") or "")
    stage_key = job_kind_to_stage_prefix(job_kind)
    return stage_id.startswith(stage_key) or stage_name == job_name or stage_key in stage_name


def updated_stages(
    run_doc: dict[str, Any] | None,
    job_kind: str,
    job_name: str | None,
    status: str,
    error: str | None = None,
) -> list[dict[str, Any]] | None:
    stages = (run_doc or {}).get("stages")
    if not isinstance(stages, list):
        return None

    now = utc_now()
    next_stages: list[dict[str, Any]] = []
    for stage in stages:
        if not isinstance(stage, dict) or not stage_matches_job(stage, job_kind, job_name):
            next_stages.append(stage)
            continue

        next_stage = {**stage, "status": status}
        if status == "running":
            next_stage["startedAt"] = next_stage.get("startedAt") or now
            next_stage.pop("completedAt", None)
            next_stage.pop("error", None)
        if status == "completed":
            next_stage["completedAt"] = now
            next_stage.pop("error", None)
        if status == "failed":
            next_stage["completedAt"] = now
            next_stage["error"] = error or "Cloud Run Job failed."
        next_stages.append(next_stage)

    return next_stages


def run_update_with_stage(
    config: WorkerConfig,
    run_doc: dict[str, Any] | None,
    data: dict[str, Any],
    stage_status: str,
    error: str | None = None,
) -> None:
    stages = updated_stages(run_doc, config.job_kind, config.job_name, stage_status, error)
    if stages is not None:
        data["stages"] = stages
    update_run(config.project_id, config.runs_collection, config.run_id or "", data)


def import_status(module_name: str) -> str:
    return "available" if importlib.util.find_spec(module_name) else "missing"


def smoke_test(config: WorkerConfig) -> int:
    log_event(
        "smoke_test.environment",
        JOB_KIND=config.job_kind,
        RUN_ID=config.run_id,
        PROJECT_ID=config.project_id,
        GCS_BUCKET=config.gcs_bucket,
        RUNS_COLLECTION=config.runs_collection,
        CASE_ID=config.case_id,
        CLOUD_RUN_JOB=config.job_name,
    )
    for module_name in ["numpy", "pandas", "scipy", "nibabel", "pydicom", "mne", "pyedflib", "dipy", "matplotlib", "PIL"]:
        log_event("smoke_test.import", module=module_name, status=import_status(module_name))
    return 0


def load_job(job_kind: str):
    module_path = JOB_MODULES.get(job_kind)
    if not module_path:
        raise ValueError(f"Unsupported JOB_KIND '{job_kind}'. Supported values: {', '.join(sorted(JOB_MODULES))}, smoke_test")
    module = importlib.import_module(module_path)
    return module.run


def main() -> int:
    config = get_config()
    log_event(
        "worker.start",
        JOB_KIND=config.job_kind,
        RUN_ID=config.run_id,
        PROJECT_ID=config.project_id,
        GCS_BUCKET=config.gcs_bucket,
        RUNS_COLLECTION=config.runs_collection,
        CASE_ID=config.case_id,
        CLOUD_RUN_JOB=config.job_name,
    )

    if config.job_kind == "smoke_test":
        return smoke_test(config)

    if not config.run_id:
        log_event("worker.missing_run_id", error="RUN_ID is required for all non-smoke-test jobs.")
        return 2

    run_doc = get_run(config.project_id, config.runs_collection, config.run_id)
    run_update_with_stage(
        config,
        run_doc,
        {"status": "running", "currentStage": config.job_kind, "updatedAt": utc_now()},
        "running",
    )
    case_id = config.case_id or (run_doc or {}).get("caseId")
    context = JobContext(config=config, run_id=config.run_id, run_doc=run_doc, case_id=case_id)

    try:
        job = load_job(config.job_kind)
        manifest: JobManifest = job(context)
        path = manifest_path(config.run_id, config.job_kind, case_id)
        manifest.outputs["manifestPath"] = path
        write_json(config.gcs_bucket, path, manifest.to_dict())
        overall_status = "completed" if config.job_kind == "report_builder" and manifest.status == "completed" else "running"
        if manifest.status != "completed":
            overall_status = "failed"
        run_update_with_stage(
            config,
            run_doc,
            {
                "status": overall_status,
                "currentStage": "Report ready" if overall_status == "completed" else config.job_kind,
                "updatedAt": utc_now(),
                "outputs": {config.job_kind: {"manifestPath": path, "status": manifest.status}},
            },
            "completed" if manifest.status == "completed" else "failed",
            "; ".join(manifest.errors) if manifest.errors else None,
        )
        log_event("worker.complete", jobKind=config.job_kind, runId=config.run_id, manifestPath=path, status=manifest.status)
        return 0 if manifest.status == "completed" else 1
    except Exception as exc:
        log_event("worker.failed", jobKind=config.job_kind, runId=config.run_id, error=str(exc))
        run_update_with_stage(
            config,
            run_doc,
            {"status": "failed", "currentStage": config.job_kind, "updatedAt": utc_now(), "lastError": str(exc)},
            "failed",
            str(exc),
        )
        return 1


if __name__ == "__main__":
    sys.exit(main())
