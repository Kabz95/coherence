import os
from dataclasses import dataclass


@dataclass(frozen=True)
class WorkerConfig:
    job_kind: str
    run_id: str | None
    project_id: str
    gcs_bucket: str
    runs_collection: str
    case_id: str | None
    job_name: str | None


def get_config() -> WorkerConfig:
    return WorkerConfig(
        job_kind=os.getenv("JOB_KIND", "smoke_test").strip(),
        run_id=os.getenv("RUN_ID") or None,
        project_id=os.getenv("PROJECT_ID", "studio-4574323897-75b04"),
        gcs_bucket=os.getenv("GCS_BUCKET", "studio-4574323897-75b04.firebasestorage.app"),
        runs_collection=os.getenv("RUNS_COLLECTION", "neuroRuns"),
        case_id=os.getenv("CASE_ID") or None,
        job_name=os.getenv("CLOUD_RUN_JOB") or os.getenv("JOB_NAME") or None,
    )
