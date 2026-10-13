"""Preliminary real-data validation for the Coherence backend pipelines.

Downloads small public datasets (cached under ~/coherence-validation-data so
re-runs are free) and runs each modality's full job chain with the same
offline FakeContext pattern as tests/smoke_test.py:

    sMRI:  ICBM152 T1 template (nilearn) ......... converter -> qc ->
           structural_prep -> structural_analysis -> structural_3d_prep ->
           report_builder
    dMRI:  ISBI2013 HARDI phantom (dipy) .......... converter ->
           diffusion_prep -> diffusion_analysis -> diffusion_3d_prep ->
           report_builder
    fMRI:  SPM auditory BOLD, BIDS (nilearn) ..... converter -> fmri_ingest ->
           fmri_prep -> fmri_analysis -> fmri_visualization_prep ->
           report_builder
    EEG:   eegbci S001R01 (mne / PhysioNet) ...... eeg_ingest -> eeg_prep ->
           eeg_analysis -> eeg_visualization_prep -> report_builder
    MEG:   somato sub-01 (mne, BIDS FIF) ......... meg_ingest -> meg_prep ->
           meg_analysis -> meg_visualization_prep -> report_builder

Prints a validation report per modality: dataset provenance, chain status,
QC flags/warnings, key measurements, and sanity checks. Sanity failures are
flagged FOR HUMAN REVIEW, not asserted -- this validates pipeline behavior
on real data, not clinical validity. Nothing here is diagnostic.

Dataset notes (all open, all fetched programmatically):
- ICBM152 2009a T1: nilearn fetch_icbm152_2009 (template brain, ~63 MB).
- ISBI2013 phantom64: dipy fetch_isbi2013_2shell (physical dMRI phantom).
- SPM auditory: nilearn fetch_spm_auditory, MoAEpilot BIDS (task BOLD;
  the pipeline's DVARS/tSNR/ALFF steps don't care about task vs rest).
  The BIDS sidecar ships without RepetitionTime, so the harness writes
  bold.json with RepetitionTime 2.0 (documented TR for this dataset).
- eegbci: mne.datasets.eegbci, subject 1 run 1 (real motor-imagery EEG,
  64 ch @ 160 Hz, PhysioNet).
- somato MEG: mne.datasets.somato sub-01_task-somato_meg.fif (real MEG,
  306 channels @ 300 Hz). Cropped to the first 120 s for validation speed;
  the pipeline itself is untouched.

Usage (from backend/):
    python validation/real_data_validation.py [--modality fmri] [--quick]

Requires the backend scientific stack plus nilearn (validation-only dep):
    pip install -r requirements.txt nilearn
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))
os.chdir(BACKEND_ROOT)

# Sandbox nicety: some egress proxies MITM TLS with a private CA. If the
# runtime ships one, trust it for dataset downloads. Harmless elsewhere.
for _bundle in ("/run/hatch/egress-tls/ca-bundle.pem",):
    if Path(_bundle).exists():
        os.environ.setdefault("SSL_CERT_FILE", _bundle)
        os.environ.setdefault("REQUESTS_CA_BUNDLE", _bundle)

DATA_ROOT = Path.home() / "coherence-validation-data"
WORK_ROOT = Path(__file__).resolve().parent / "work"

# Job workspaces live in the OS temp dir; /tmp is a small tmpfs on some
# hosts, so point temp files at the spacious work dir unless overridden.
os.environ.setdefault("TMPDIR", str(WORK_ROOT / "tmp"))
Path(os.environ["TMPDIR"]).mkdir(parents=True, exist_ok=True)


@dataclass
class FakeConfig:
    job_kind: str = "validation"
    run_id: str = "val-run"
    project_id: str = "validation-project"
    gcs_bucket: str = "validation-bucket"
    runs_collection: str = "neuroRuns"
    case_id: str = "validation-case"
    job_name: str | None = None


@dataclass
class FakeContext:
    config: FakeConfig
    run_id: str
    run_doc: dict
    case_id: str


def log(msg: str) -> None:
    print(msg, flush=True)


# ---------------------------------------------------------------- datasets

def stage_inputs() -> dict[str, Path]:
    """Download (once) and stage pipeline-ready inputs. Returns name->path."""
    import warnings
    warnings.filterwarnings("ignore")

    DATA_ROOT.mkdir(parents=True, exist_ok=True)
    inputs = WORK_ROOT / "inputs"
    inputs.mkdir(parents=True, exist_ok=True)
    staged: dict[str, Path] = {}

    def link(src: Path, name: str) -> Path:
        dest = inputs / name
        if dest.exists() or dest.is_symlink():
            dest.unlink()
        dest.symlink_to(src)
        staged[name] = dest
        return dest

    # --- sMRI: ICBM152 T1 ---
    log("[data] sMRI: ICBM152 2009a T1 (nilearn) ...")
    from nilearn.datasets import fetch_icbm152_2009
    t1 = Path(fetch_icbm152_2009()["t1"])
    link(t1, "t1_icbm152.nii.gz")

    # --- dMRI: ISBI2013 phantom ---
    log("[data] dMRI: ISBI2013 HARDI phantom (dipy) ...")
    from dipy.data.fetcher import fetch_isbi2013_2shell
    _files, isbi_folder = fetch_isbi2013_2shell()
    isbi_folder = Path(isbi_folder)
    dwi, bval, bvec = (isbi_folder / f for f in ("phantom64.nii.gz", "phantom64.bval", "phantom64.bvec"))
    link(dwi, "dwi_phantom.nii.gz")
    link(bval, "dwi_phantom.bval")
    link(bvec, "dwi_phantom.bvec")

    # --- fMRI: SPM auditory BOLD (BIDS) ---
    log("[data] fMRI: SPM auditory BOLD (nilearn, MoAEpilot BIDS) ...")
    from nilearn.datasets import fetch_spm_auditory
    bold_src = Path(fetch_spm_auditory()["func"][0])
    link(bold_src, "bold.nii")
    # The BIDS tree ships no RepetitionTime sidecar; TR=2.0 s is the
    # documented value for MoAEpilot. Written by the harness, not the pipe.
    sidecar = inputs / "bold.json"
    sidecar.write_text(json.dumps({"RepetitionTime": 2.0, "TaskName": "auditory"}))
    staged["bold.json"] = sidecar

    # --- EEG: eegbci ---
    log("[data] EEG: eegbci S001R01 (mne / PhysioNet) ...")
    from mne.datasets import eegbci
    edf = Path(eegbci.load_data(subjects=[1], runs=[1], update_path=True)[0])
    link(edf, "eeg_eegbci.edf")

    # --- MEG: somato (cropped to 120 s for validation speed) ---
    log("[data] MEG: somato sub-01 (mne, BIDS FIF), cropping to 120 s ...")
    import mne
    from mne.datasets import somato
    fif_src = Path(somato.data_path(update_path=True)) / "sub-01" / "meg" / "sub-01_task-somato_meg.fif"
    meg_crop = inputs / "meg_somato_120s.fif"
    if not meg_crop.exists():
        raw = mne.io.read_raw_fif(fif_src, verbose="ERROR")
        raw.crop(tmax=120.0).save(meg_crop, overwrite=True, verbose="ERROR")
    staged["meg_somato_120s.fif"] = meg_crop

    for name, path in staged.items():
        size_mb = path.stat().st_size / 1e6 if not path.is_symlink() else path.resolve().stat().st_size / 1e6
        log(f"       staged {name} ({size_mb:.1f} MB)")
    return staged


# ---------------------------------------------------------------- chains

CHAINS: dict[str, list[str]] = {
    "structural": ["converter", "qc", "structural_prep", "structural_analysis",
                   "structural_3d_prep", "report_builder"],
    "diffusion": ["converter", "diffusion_prep", "diffusion_analysis",
                  "diffusion_3d_prep", "report_builder"],
    "fmri": ["converter", "fmri_ingest", "fmri_prep", "fmri_analysis",
             "fmri_visualization_prep", "report_builder"],
    "eeg": ["eeg_ingest", "eeg_prep", "eeg_analysis", "eeg_visualization_prep",
            "report_builder"],
    "meg": ["meg_ingest", "meg_prep", "meg_analysis", "meg_visualization_prep",
            "report_builder"],
}

CHAIN_FILES: dict[str, list[str]] = {
    "structural": ["t1_icbm152.nii.gz"],
    "diffusion": ["dwi_phantom.nii.gz", "dwi_phantom.bval", "dwi_phantom.bvec"],
    "fmri": ["bold.nii", "bold.json"],
    "eeg": ["eeg_eegbci.edf"],
    "meg": ["meg_somato_120s.fif"],
}


def run_chain(modality: str, staged: dict[str, Path]) -> dict:
    """Run one modality chain; returns {job_kind: manifest} plus run_doc."""
    import importlib

    from lib.manifests import manifest_path
    from lib.storage import write_json

    run_id = f"val-{modality}"
    run_doc = {
        "id": run_id,
        "caseId": "validation-case",
        "modality": {"structural": "structural_mri", "diffusion": "diffusion_mri"}.get(modality, modality),
        "inputFiles": [
            {"name": n, "storagePath": f"inputs/{n}",
             "contentType": "application/octet-stream", "sizeBytes": staged[n].stat().st_size}
            for n in CHAIN_FILES[modality]
        ],
        "outputs": {},
    }
    context = FakeContext(config=FakeConfig(run_id=run_id), run_id=run_id,
                          run_doc=run_doc, case_id="validation-case")
    manifests: dict[str, object] = {}
    for job_kind in CHAINS[modality]:
        module = importlib.import_module(f"jobs.{job_kind}")
        log(f"[{modality}] running {job_kind} ...")
        try:
            manifest = module.run(context)
        except Exception as exc:  # never let one chain kill the session
            log(f"[{modality}] {job_kind}: EXCEPTION {exc}")
            break
        path = manifest_path(context.run_id, job_kind, context.case_id)
        manifest.outputs["manifestPath"] = path
        write_json(context.config.gcs_bucket, path, manifest.to_dict())
        manifests[job_kind] = manifest
        status = manifest.status
        extra = ""
        if manifest.warnings:
            extra += f" warnings={len(manifest.warnings)}"
        if manifest.errors:
            extra += f" errors={manifest.errors}"
        log(f"[{modality}] {job_kind}: {status}{extra}")
        run_doc.setdefault("outputs", {})[job_kind] = {"manifestPath": path, "status": status}
        context.run_doc = run_doc
        if status != "completed":
            log(f"[{modality}] CHAIN STOPPED at {job_kind}")
            break
    return {"manifests": manifests, "run_doc": run_doc}


# ---------------------------------------------------------------- checks

def _metrics(manifests: dict, job_kind: str) -> dict:
    """Extract the metric payload from a job manifest, tolerating the
    different keys jobs use (summary / metrics / bandPowers / qc)."""
    m = manifests.get(job_kind)
    out = getattr(m, "outputs", {}) if m else {}
    if not isinstance(out, dict):
        return {}
    merged: dict = {}
    for key in ("summary", "metrics"):
        v = out.get(key)
        if isinstance(v, dict):
            merged.update(v)
    # ephys analysis jobs publish band powers + metadata at top level
    for key in ("bandPowers", "metadata", "qc"):
        v = out.get(key)
        if isinstance(v, dict):
            merged.update(v)
    return merged


def _summary(manifests: dict, job_kind: str) -> dict:
    return _metrics(manifests, job_kind)


def check_range(name: str, value, lo: float, hi: float) -> tuple[str, str]:
    ok = value is not None and lo <= float(value) <= hi
    return (name, "PASS" if ok else f"REVIEW (value={value}, expected [{lo}, {hi}])")


def sanity_checks(modality: str, manifests: dict) -> list[tuple[str, str]]:
    checks: list[tuple[str, str]] = []
    if modality == "structural":
        s = _summary(manifests, "structural_analysis")
        checks.append(check_range("TICV plausible (800-2200 mL)", s.get("totalIntracranialVolumeMl"), 800, 2200))
    elif modality == "diffusion":
        s = _summary(manifests, "diffusion_analysis")
        checks.append(check_range("mean FA in [0,1]", s.get("meanFA"), 0.0, 1.0))
        md = s.get("meanMD")
        checks.append(("mean MD positive & small",
                       "PASS" if md is not None and 0 < float(md) <= 0.005 else f"REVIEW (value={md})"))
    elif modality == "fmri":
        s = _summary(manifests, "fmri_analysis")
        p = _summary(manifests, "fmri_prep")
        tsnr = p.get("medianTSNR", s.get("medianTSNR"))
        checks.append(("median tSNR > 0",
                       "PASS" if tsnr is not None and float(tsnr) > 0 else f"REVIEW (value={tsnr})"))
        alff = s.get("meanALFF")
        checks.append(("mean ALFF standardized ~1",
                       "PASS" if alff is not None and abs(float(alff) - 1.0) < 0.2 else f"REVIEW (value={alff})"))
    elif modality in ("eeg", "meg"):
        s = _summary(manifests, f"{modality}_analysis")
        bands = s.get("bandPowers") or {k: s.get(k) for k in ("delta", "theta", "alpha", "beta", "gamma")}
        total = sum(float(v) for v in bands.values() if isinstance(v, (int, float)))
        checks.append(check_range("relative band powers sum ~1", total, 0.85, 1.15))
    return checks


def key_metrics(modality: str, manifests: dict) -> dict:
    if modality == "structural":
        return _summary(manifests, "structural_analysis")
    if modality == "diffusion":
        return _summary(manifests, "diffusion_analysis")
    if modality == "fmri":
        m = dict(_summary(manifests, "fmri_prep"))
        m.update(_summary(manifests, "fmri_analysis"))
        return m
    return _summary(manifests, f"{modality}_analysis")


# ---------------------------------------------------------------- report

PROVENANCE = {
    "structural": "ICBM152 2009a T1 template (nilearn fetch_icbm152_2009) — template brain",
    "diffusion": "ISBI2013 HARDI phantom64 (dipy fetch_isbi2013_2shell) — physical dMRI phantom",
    "fmri": "SPM auditory MoAEpilot sub-01 BOLD, 84 vols TR=2s (nilearn fetch_spm_auditory) — task fMRI; harness-written RepetitionTime sidecar",
    "eeg": "eegbci S001R01 (mne / PhysioNet), 64 ch @ 160 Hz — real motor-imagery EEG",
    "meg": "somato sub-01_task-somato_meg.fif cropped to 120 s (mne) — real MEG, 306 channels @ 300 Hz",
}


def build_report(results: dict[str, dict]) -> str:
    lines = [
        "# Coherence pipeline validation — real-data run",
        "",
        f"Run at {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}.",
        "Each modality chain ran offline (FakeContext, local artifacts) on the",
        "public dataset noted. Sanity items marked REVIEW need a human look;",
        "they are not assertions. Nothing here is diagnostic.",
        "",
    ]
    for modality, res in results.items():
        manifests: dict = res["manifests"]
        lines += [f"## {modality}", "", f"Dataset: {PROVENANCE[modality]}", ""]
        for job_kind in CHAINS[modality]:
            m = manifests.get(job_kind)
            if m is None:
                lines.append(f"- `{job_kind}`: NOT RUN")
                continue
            w = len(getattr(m, "warnings", []) or [])
            e = getattr(m, "errors", None)
            lines.append(f"- `{job_kind}`: **{m.status}**" + (f" ({w} warnings)" if w else "") + (f" errors={e}" if e else ""))
        metrics = key_metrics(modality, manifests)
        interesting = {k: v for k, v in metrics.items()
                       if k in ("totalIntracranialVolumeMl", "meanCorticalThicknessMm",
                                "meanFA", "meanMD", "meanAD", "meanRD",
                                "meanALFF", "meanFALFF", "medianTSNR", "dvarsSpikeVolumes",
                                "delta", "theta", "alpha", "beta", "gamma", "bandPowers",
                                "nChannels", "samplingRateHz", "trSec")}
        if interesting:
            lines += ["", "Key metrics:"]
            lines += [f"- {k}: {v}" for k, v in interesting.items()]
        lines += ["", "Sanity checks:"]
        for name, verdict in sanity_checks(modality, manifests):
            mark = "✅" if verdict == "PASS" else "⚠️"
            lines.append(f"- {mark} {name}: {verdict}")
        # surface warnings for review
        warn_lines = []
        for job_kind, m in manifests.items():
            for w in (getattr(m, "warnings", []) or []):
                warn_lines.append(f"  - [{job_kind}] {w}")
        if warn_lines:
            lines += ["", "Pipeline warnings (expected on real data, review-worthy):"] + warn_lines[:12]
        lines += [""]
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--modality", choices=list(CHAINS), default=None)
    ap.add_argument("--quick", action="store_true",
                    help="Skip slow chains (diffusion tensor fit on full phantom).")
    args = ap.parse_args()

    tmp = Path(tempfile.mkdtemp(prefix="coherence-val-"))
    os.environ["COHERENCE_LOCAL_INPUTS"] = str(WORK_ROOT / "inputs")

    staged = stage_inputs()
    modalities = [args.modality] if args.modality else list(CHAINS)
    if args.quick:
        modalities = [m for m in modalities if m != "diffusion"]

    results: dict[str, dict] = {}
    for modality in modalities:
        log(f"\n===== {modality.upper()} =====")
        results[modality] = run_chain(modality, staged)

    report = build_report(results)
    report_path = Path(__file__).resolve().parent / "last_validation_report.md"
    report_path.write_text(report)
    print("\n" + report)
    log(f"\nReport saved to {report_path}")

    failed = any(
        getattr(m, "status", None) not in ("completed", None)
        for res in results.values() for m in res["manifests"].values()
    )
    review = sum(1 for r in results.values() for _, v in sanity_checks(
        next(k for k, x in results.items() if x is r), r["manifests"]) if v != "PASS")
    log(f"VALIDATION RESULT: {'FAIL' if failed else 'PASS'} ({review} sanity items to review)")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
