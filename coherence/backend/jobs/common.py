from __future__ import annotations

import importlib.util
import shutil
from typing import Any

from lib.clinical_safety import evidence_item
from lib.manifests import JobManifest


JOB_META: dict[str, dict[str, str]] = {
    "converter": {"jobName": "coherence-converter", "modality": "shared", "stage": "converter"},
    "qc": {"jobName": "coherence-qc", "modality": "shared", "stage": "qc"},
    "structural_prep": {"jobName": "coherence-structural-prep", "modality": "structural_mri", "stage": "structural-prep"},
    "structural_analysis": {"jobName": "coherence-structural-analysis", "modality": "structural_mri", "stage": "structural-analysis"},
    "structural_3d_prep": {"jobName": "coherence-structural-3d-prep", "modality": "structural_mri", "stage": "structural-3d-prep"},
    "diffusion_prep": {"jobName": "coherence-diffusion-prep", "modality": "diffusion_mri", "stage": "diffusion-prep"},
    "diffusion_analysis": {"jobName": "coherence-diffusion-analysis", "modality": "diffusion_mri", "stage": "diffusion-analysis"},
    "diffusion_3d_prep": {"jobName": "coherence-diffusion-3d-prep", "modality": "diffusion_mri", "stage": "diffusion-3d-prep"},
    "eeg_ingest": {"jobName": "coherence-eeg-ingest", "modality": "eeg", "stage": "eeg-ingest"},
    "eeg_prep": {"jobName": "coherence-eeg-prep", "modality": "eeg", "stage": "eeg-prep"},
    "eeg_analysis": {"jobName": "coherence-eeg-analysis", "modality": "eeg", "stage": "eeg-analysis"},
    "eeg_visualization_prep": {"jobName": "coherence-eeg-visualization-prep", "modality": "eeg", "stage": "eeg-visualization-prep"},
    "report_builder": {"jobName": "coherence-report-builder", "modality": "shared", "stage": "report-builder"},
    "longitudinal_analysis": {"jobName": "coherence-longitudinal-analysis", "modality": "shared", "stage": "longitudinal-analysis"},
    "coregistration": {"jobName": "coherence-coregistration", "modality": "multimodal", "stage": "coregistration"},
}


def create_manifest(run_id: str, job_kind: str) -> JobManifest:
    meta = JOB_META[job_kind]
    return JobManifest(
        runId=run_id,
        jobKind=job_kind,
        jobName=meta["jobName"],
        modality=meta["modality"],
        stage=meta["stage"],
    )


def module_available(name: str) -> bool:
    return importlib.util.find_spec(name) is not None


def binary_available(name: str) -> bool:
    return shutil.which(name) is not None


def add_placeholder(manifest: JobManifest, output_name: str, reason: str) -> JobManifest:
    manifest.outputs[output_name] = None
    manifest.warnings.append(reason)
    return manifest


def add_safe_evidence(manifest: JobManifest, source: str, value: str, method: str, limitations: str, unit: str | None = None) -> None:
    manifest.evidenceItems.append(evidence_item(source=source, value=value, method=method, limitations=limitations, unit=unit))


def input_files_from_run(run_doc: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not run_doc:
        return []
    files = run_doc.get("inputFiles", [])
    return files if isinstance(files, list) else []


def first_matching_file(files: list[dict[str, Any]], suffixes: tuple[str, ...]) -> dict[str, Any] | None:
    for item in files:
        name = str(item.get("name", "")).lower()
        path = str(item.get("storagePath", "")).lower()
        if name.endswith(suffixes) or path.endswith(suffixes):
            return item
    return None
