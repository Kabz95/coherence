from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class JobManifest:
    runId: str
    jobKind: str
    jobName: str
    modality: str
    stage: str
    status: str = "running"
    startedAt: str = field(default_factory=utc_now)
    completedAt: str | None = None
    inputs: dict[str, Any] = field(default_factory=dict)
    outputs: dict[str, Any] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    evidenceItems: list[dict[str, Any]] = field(default_factory=list)

    def complete(self) -> "JobManifest":
        self.status = "completed"
        self.completedAt = utc_now()
        return self

    def fail(self, error: str) -> "JobManifest":
        self.status = "failed"
        self.completedAt = utc_now()
        self.errors.append(error)
        return self

    def to_dict(self) -> dict[str, Any]:
        return {
            "runId": self.runId,
            "jobKind": self.jobKind,
            "jobName": self.jobName,
            "modality": self.modality,
            "stage": self.stage,
            "status": self.status,
            "startedAt": self.startedAt,
            "completedAt": self.completedAt,
            "inputs": self.inputs,
            "outputs": self.outputs,
            "warnings": self.warnings,
            "errors": self.errors,
            "evidenceItems": self.evidenceItems,
        }


def manifest_path(run_id: str, job_kind: str, case_id: str | None = None) -> str:
    if case_id:
        return f"cases/{case_id}/runs/{run_id}/outputs/{job_kind}/manifest.json"
    return f"runs/{run_id}/outputs/{job_kind}/manifest.json"
