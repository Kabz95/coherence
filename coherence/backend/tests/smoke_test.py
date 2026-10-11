"""Offline smoke test for the Coherence backend pipelines.

Generates synthetic data (T1 phantom, DWI + bval/bvec, EEG CSV) and runs the
full job chains with a fake context:

    structural: converter -> qc -> structural_prep -> structural_analysis
                -> structural_3d_prep -> report_builder
    diffusion:  diffusion_prep -> diffusion_analysis -> diffusion_3d_prep
                (requires dipy)
    eeg:        eeg_ingest -> eeg_prep -> eeg_analysis -> eeg_visualization_prep

GCS/Firestore calls fall back to local_outputs/ and log warnings, so the test
runs fully offline. Run from backend/:  python tests/smoke_test.py [--quick]
"""

from __future__ import annotations

import os
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))
os.chdir(BACKEND_ROOT)

QUICK = "--quick" in sys.argv


@dataclass
class FakeConfig:
    job_kind: str = "smoke"
    run_id: str = "smoke-run"
    project_id: str = "smoke-project"
    gcs_bucket: str = "smoke-bucket"
    runs_collection: str = "neuroRuns"
    case_id: str = "smoke-case"
    job_name: str | None = None


@dataclass
class FakeContext:
    config: FakeConfig
    run_id: str
    run_doc: dict
    case_id: str


def make_synthetic_data(out_dir: Path) -> dict:
    import nibabel as nib
    import numpy as np

    out_dir.mkdir(parents=True, exist_ok=True)

    # --- Synthetic T1 phantom: ellipsoid "brain" with noise ---
    rng = np.random.default_rng(42)
    shape = (64, 64, 48) if not QUICK else (32, 32, 24)
    zz, yy, xx = np.mgrid[0:shape[0], 0:shape[1], 0:shape[2]]
    cx, cy, cz = shape[0] / 2, shape[1] / 2, shape[2] / 2
    rx, ry, rz = shape[0] * 0.44, shape[1] * 0.38, shape[2] * 0.42
    ellipsoid = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 + ((zz - cz) / rz) ** 2 <= 1
    t1 = np.zeros(shape, dtype=np.float32)
    t1[ellipsoid] = 100.0 + rng.normal(0, 8, size=ellipsoid.sum())
    # a brighter "ventricle-ish" core
    core = ((xx - cx) / (rx * 0.3)) ** 2 + ((yy - cy) / (ry * 0.3)) ** 2 + ((zz - cz) / (rz * 0.4)) ** 2 <= 1
    t1[core] = 40.0 + rng.normal(0, 5, size=core.sum())
    t1_path = out_dir / "t1.nii.gz"
    nib.save(nib.Nifti1Image(t1, np.eye(4)), str(t1_path))

    # --- Synthetic DWI: 4D + bval/bvec ---
    dshape = (16, 16, 8, 12) if not QUICK else (12, 12, 6, 8)
    n_vol = dshape[3]
    bvals = [0, 0] + [1000] * (n_vol - 2)
    bvecs = [[0, 0, 1]] * 2
    for _ in range(n_vol - 2):
        v = rng.normal(size=3)
        bvecs.append(list(v / np.linalg.norm(v)))
    dwi = np.zeros(dshape, dtype=np.float32)
    for v in range(n_vol):
        atten = np.exp(-bvals[v] * 0.001) if bvals[v] else 1.0
        dwi[..., v] = (120.0 * atten + rng.normal(0, 6, size=dshape[:3])).astype(np.float32)
    dwi_path = out_dir / "dwi.nii.gz"
    nib.save(nib.Nifti1Image(dwi, np.eye(4)), str(dwi_path))
    (out_dir / "dwi.bval").write_text(" ".join(str(b) for b in bvals))
    (out_dir / "dwi.bvec").write_text("\n".join(" ".join(f"{c:.6f}" for c in row) for row in zip(*bvecs)))

    # --- Synthetic EEG CSV: time + 4 channels ---
    sfreq, seconds = 100.0, 10.0
    t = np.arange(0, seconds, 1 / sfreq)
    eeg = np.column_stack([
        t,
        np.sin(2 * np.pi * 10 * t) + 0.3 * rng.normal(size=t.size),   # alpha-ish
        np.sin(2 * np.pi * 22 * t) + 0.3 * rng.normal(size=t.size),   # beta-ish
        np.sin(2 * np.pi * 3 * t) + 0.3 * rng.normal(size=t.size),    # delta-ish
        0.5 * rng.normal(size=t.size),                                 # noisy
    ])
    header = "time,Cz,Fz,Pz,Oz"
    np.savetxt(out_dir / "eeg.csv", eeg, delimiter=",", header=header, comments="", fmt="%.6f")

    return {"t1": t1_path, "dwi": dwi_path, "eeg": out_dir / "eeg.csv"}


def run_chain(job_kinds: list[str], run_doc: dict, label: str) -> dict:
    import importlib

    from lib.manifests import manifest_path
    from lib.storage import write_json

    context = FakeContext(config=FakeConfig(), run_id="smoke-run", run_doc=run_doc, case_id="smoke-case")
    for job_kind in job_kinds:
        module = importlib.import_module(f"jobs.{job_kind}")
        print(f"[{label}] running {job_kind} ...", flush=True)
        manifest = module.run(context)
        path = manifest_path(context.run_id, job_kind, context.case_id)
        manifest.outputs["manifestPath"] = path
        write_json(context.config.gcs_bucket, path, manifest.to_dict())
        status = manifest.status
        print(f"[{label}] {job_kind}: {status}"
              + (f" warnings={len(manifest.warnings)}" if manifest.warnings else "")
              + (f" errors={manifest.errors}" if manifest.errors else ""))
        # worker.py behaviour: register manifest on the run doc for downstream jobs
        run_doc.setdefault("outputs", {})[job_kind] = {"manifestPath": path, "status": status}
        context.run_doc = run_doc
        if status != "completed":
            print(f"[{label}] CHAIN STOPPED at {job_kind}")
            break
    return run_doc


def main() -> int:
    tmp = Path(tempfile.mkdtemp(prefix="coherence-smoke-"))
    inputs = make_synthetic_data(tmp / "inputs")
    os.environ["COHERENCE_LOCAL_INPUTS"] = str(tmp / "inputs")
    failures = 0

    def fresh_run_doc(names: list[str]) -> dict:
        return {
            "id": "smoke-run",
            "caseId": "smoke-case",
            "modality": "structural_mri",
            "inputFiles": [
                {"name": n, "storagePath": f"inputs/{n}", "contentType": "application/octet-stream", "sizeBytes": 1}
                for n in names
            ],
            "outputs": {},
        }

    # Structural chain
    run_doc = fresh_run_doc(["t1.nii.gz"])
    run_chain(["converter", "qc", "structural_prep", "structural_analysis", "structural_3d_prep", "report_builder"], run_doc, "structural")
    print("structural outputs registered:", sorted(run_doc.get("outputs", {}).keys()))
    # Offline: update_run can't reach Firestore, so validate the report artifact.
    report_path = BACKEND_ROOT / "local_outputs/cases/smoke-case/runs/smoke-run/outputs/report_builder/report.json"
    if not report_path.exists():
        print("!! report.json artifact missing"); failures += 1
    else:
        import json
        report = json.loads(report_path.read_text())
        struct = report.get("structural", {})
        print("report structural metrics:", struct)
        print("report limitations:", len(report.get("limitations", [])),
              "| evidence items:", len(report.get("evidenceLedger", [])),
              "| viewer assets:", list(report.get("visualizationAssets", {}).keys()))
        if not struct.get("totalIntracranialVolumeMl"):
            print("!! totalIntracranialVolumeMl missing from report"); failures += 1
        if not report.get("interpretationStatement"):
            print("!! interpretationStatement missing"); failures += 1

    # Diffusion chain (needs dipy)
    try:
        import dipy  # noqa: F401
        run_doc_dwi = fresh_run_doc(["dwi.nii.gz", "dwi.bval", "dwi.bvec"])
        run_doc_dwi["modality"] = "diffusion_mri"
        run_chain(["converter", "diffusion_prep", "diffusion_analysis", "diffusion_3d_prep"], run_doc_dwi, "diffusion")
        summ = ((run_doc_dwi.get("outputs", {}).get("diffusion_analysis") or {}))
        print("diffusion outputs registered:", sorted(run_doc_dwi.get("outputs", {}).keys()))
    except ImportError:
        print("[diffusion] skipped: dipy not installed")

    # EEG chain
    run_doc_eeg = fresh_run_doc(["eeg.csv"])
    run_doc_eeg["modality"] = "eeg"
    run_chain(["eeg_ingest", "eeg_prep", "eeg_analysis", "eeg_visualization_prep"], run_doc_eeg, "eeg")
    print("eeg outputs registered:", sorted(run_doc_eeg.get("outputs", {}).keys()))

    print("SMOKE RESULT:", "FAIL" if failures else "PASS")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
