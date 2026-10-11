# Coherence

Coherence is a clinician-facing neuroimaging decision-support shell for organizing neuroimaging and EEG-derived measurements, quality-control flags, longitudinal comparisons, visualization assets, and structured reports.

## Clinical Safety Statement

Coherence provides supplementary, non-diagnostic neuroimaging and neurophysiology summaries for clinician review. It does not establish, confirm, predict, or rule out any DSM or ICD diagnosis. Outputs must be interpreted alongside clinical history, psychiatric assessment, symptom scales, functional outcomes, and clinician judgment.

This initial application shell does not implement diagnosis logic, machine-learning predictions, or automated clinical claims.

## Structure

```text
coherence/
  web/
    app/
    components/
    lib/
    package.json
```

## Setup

```bash
cd coherence/web
npm install
cp .env.local.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Firebase Environment Variables

Create `coherence/web/.env.local` using:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=studio-4574323897-75b04.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=studio-4574323897-75b04
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=studio-4574323897-75b04.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Only public Firebase web app config belongs in this file. Do not place admin credentials or private keys in the frontend.

When these variables are absent, the app runs in safe mock mode and disables file upload.

## Authentication

Enable these providers in Firebase Console before using the sign-in flow:

- Authentication -> Sign-in method -> Email/Password
- Authentication -> Sign-in method -> Google

The app includes:

- `/sign-up` for email/password account creation
- `/sign-in` for email/password or Google sign-in
- Workspace auth gating for dashboard, cases, upload, runs, and reports
- Sign out from the top bar

For development, publish the included `firestore.rules` file or paste its contents into Firestore Database -> Rules. These rules require a signed-in user for `patientCases` and `neuroRuns`. They are a starting point only; before clinical or PHI use, replace broad authenticated access with clinician role and case-assignment checks.

Publish the included `storage.rules` file or paste its contents into Storage -> Rules before testing file upload. These development rules allow signed-in users to read and write run input files under `cases/{caseId}/runs/{runId}/inputs/{fileName}`.

## Commands

```bash
npm run dev
npm run build
npm run start
```

## Firebase Deployment Note

Use Firebase Hosting with a Next.js-compatible deployment path or deploy the Next.js app to a managed runtime that supports App Router. Configure the same public environment variables in the deployment environment.

This repo includes `.firebaserc` and `firebase.json` for Firebase CLI deployment to project `studio-4574323897-75b04`.

```bash
npx firebase-tools experiments:enable webframeworks
npx firebase-tools deploy --project studio-4574323897-75b04
```

For a long-running full-stack Next.js deployment, Firebase currently recommends App Hosting. Use the Firebase console App Hosting flow when you are ready to connect this repo to GitHub and manage rollouts there.

## Backend Job Integration Note

The app maps runs to the intended Cloud Run job names and regions, but it does not trigger jobs from the browser. Cloud Run Jobs must be invoked by a secure backend API, Cloud Function, or orchestrator that can validate authorization, protect PHI workflows, and hold any privileged credentials outside the client.

The `functions/` package provides that secure trigger layer:

- `startRunPipeline`: authenticated callable function that launches the Cloud Run Jobs for a run.
- `queueUploadedRun`: Firestore trigger that automatically queues a pipeline when a run reaches `uploaded` with input files.

The Cloud Functions service account must have permission to run Cloud Run Jobs. Grant the deployed function service account appropriate least-privilege IAM, typically Cloud Run Developer plus service-account-user permissions for the runtime service account used by the jobs.

Configured project context:

- Project ID: `studio-4574323897-75b04`
- Storage bucket: `studio-4574323897-75b04.firebasestorage.app`
- CPU jobs region: `us-central1`
- GPU jobs region: `us-east4`
- Backend image: `gcr.io/studio-4574323897-75b04/neuro-backend:latest`

## Backend Worker

The backend lives in `backend/` and supports two container modes:

- API service mode: `uvicorn main:app --host 0.0.0.0 --port 8080`
- Cloud Run Job mode: `python worker.py`

The container default runs `backend/entrypoint.py`. If `JOB_KIND` is present, it starts `worker.py`; otherwise it starts the FastAPI service. This prevents Cloud Run Jobs from accidentally starting the API server and leaving web runs stuck at `Pipeline queued`.

Cloud Run Jobs select behavior with `JOB_KIND`. The worker reads `RUN_ID`, `PROJECT_ID`, `GCS_BUCKET`, and `RUNS_COLLECTION`, updates Firestore where credentials permit, and writes a manifest to:

```text
cases/{caseId}/runs/{runId}/outputs/{jobKind}/manifest.json
```

If `caseId` is unavailable, it writes to:

```text
runs/{runId}/outputs/{jobKind}/manifest.json
```

Local smoke commands:

```bash
cd backend
JOB_KIND=smoke_test python worker.py
JOB_KIND=qc RUN_ID=test-run python worker.py
JOB_KIND=converter RUN_ID=test-run python worker.py
JOB_KIND=report_builder RUN_ID=test-run python worker.py
```

On Windows PowerShell:

```powershell
cd backend
$env:JOB_KIND="smoke_test"; python worker.py
$env:JOB_KIND="qc"; $env:RUN_ID="test-run"; python worker.py
$env:JOB_KIND="converter"; $env:RUN_ID="test-run"; python worker.py
$env:JOB_KIND="report_builder"; $env:RUN_ID="test-run"; python worker.py
```

Local runs without Google credentials write manifest JSON files under `backend/local_outputs/`.

Cloud Run update example:

```bash
gcloud run jobs update coherence-qc \
  --region=us-central1 \
  --image=gcr.io/studio-4574323897-75b04/neuro-backend:latest \
  --command=python \
  --args=worker.py
```

Cloud Run execute example:

```bash
gcloud run jobs execute coherence-qc \
  --region=us-central1 \
  --wait
```

The first backend goal is safe execution: container builds, `JOB_KIND` routing works, manifests are written, and the web app can display job status. HD-BET, FastSurfer, DIPY, and MNE internals can then be deepened job by job without adding diagnostic logic.

Provision all intended Cloud Run Jobs from the existing backend image:

```bash
PROJECT_ID=studio-4574323897-75b04 ./scripts/provision-cloud-run-jobs.sh
```

On Windows PowerShell:

```powershell
.\scripts\provision-cloud-run-jobs.ps1
```

Build, push, and update jobs from Windows PowerShell:

```powershell
.\scripts\deploy-backend-jobs.ps1
```

If a run shows `Backend jobs not provisioned`, the Firebase orchestrator could not find one or more Cloud Run Jobs in the expected region. Provision the missing jobs, then start the run again.

## Pipeline Implementations

Every job in `backend/jobs/` is a real, runnable implementation (`run(context) -> JobManifest`), not a placeholder. All methods are standard, honestly labelled, and non-diagnostic: measurements carry their method and limitations in the manifest evidence ledger, and the report builder runs a clinical-safety copy scan before finalizing.

**Shared** (`jobs/imaging.py`): temp workspaces, GCS artifact upload/download, NIfTI load/RAS-reorient, Otsu thresholding, rough brain masking (Otsu + largest component + hole fill — a volume *estimate*, not a segmentation), hemisphere splitting, slice-montage / trace / spectrogram renderers, and upstream-manifest chaining.

| Job | What it really does |
| --- | --- |
| `converter` | NIfTI validation + RAS reorient + float32; DICOM ZIP via dcm2niix (or best-effort pydicom slice stacking); single DICOM slice support |
| `qc` | Header checks, NaN/Inf/zero-fraction, intensity stats, axial slice-dropout detection, SNR proxy inside rough mask; per-file pass/warn/fail |
| `structural_prep` | Percentile intensity normalization + rough brain mask → `prepped-t1.nii.gz`, `brain-mask.nii.gz` |
| `structural_analysis` | Mask volumetry: total/hemisphere volumes (mL), mean mask intensity, with per-metric method + limitations. **FastSurfer hook**: when `run_fastsurfer.sh` is installed, segmentation-only FastSurfer runs and `aseg.stats` upgrades the intracranial volume; otherwise the built-in is kept with a warning |
| `structural_3d_prep` | Slice montage PNG, orthogonal-MIP volume preview PNG, downsampled NIfTI for the future viewer |
| `diffusion_prep` | bval/bvec validation (volume counts, unit vectors, b0 presence), b0 rough mask |
| `diffusion_analysis` | DIPY single-tensor DTI fit → FA/MD/AD/RD maps + whole-mask means (no eddy correction; recorded as a limitation) |
| `diffusion_3d_prep` | FA montage preview |
| `fmri_ingest` | 4D BOLD validation; TR from BIDS sidecar `RepetitionTime` or run metadata |
| `fmri_prep` | DVARS + tSNR QC, CompCor-lite denoise (detrend, top-5 high-variance PCs, 0.01–0.1 Hz band-pass). No motion/distortion correction (fMRIPrep is the reference) |
| `fmri_analysis` | ALFF / fALFF maps (0.01–0.08 Hz FFT amplitude) + whole-mask means |
| `fmri_visualization_prep` | Carpet plot PNG + mean-BOLD montage |
| `eeg_ingest` / `meg_ingest` | EDF/BDF/CSV (EEG) or FIF/DS/CSV (MEG) via MNE; channel inventory, sampling rate, duration |
| `eeg_prep` / `meg_prep` | Band-pass 1–40 Hz, 50/60 Hz notch, resample ≤250 Hz, variance-based bad-channel flagging (MNE or scipy path) |
| `eeg_analysis` / `meg_analysis` | Welch PSD → relative delta/theta/alpha/beta/gamma band powers per channel |
| `eeg_visualization_prep` / `meg_visualization_prep` | Multi-channel trace PNG + mean-PSD spectrogram PNG |
| `coregistration` | Affine resampling of a moving image into reference space (nibabel); not a nonlinear registration |
| `longitudinal_analysis` | Deltas vs the most recent comparable prior run of the same case, with comparability notes |
| `report_builder` | Aggregates all manifests → `outputs.structural`, `outputs.visualizationAssets`, `outputs.evidenceLedger`, and the run `report`; publishes them to Firestore |

Cortical thickness and subcortical segmentation are deliberately **not** fabricated — they require surface reconstruction (e.g. FastSurfer) and are absent from the metrics rather than estimated.

### Offline pipeline smoke test

`backend/tests/smoke_test.py` generates synthetic data (T1 phantom, DWI + bval/bvec, EEG CSV) and runs all three chains end to end without Google credentials (GCS/Firestore calls fall back to `backend/local_outputs/`):

```bash
cd backend
python tests/smoke_test.py            # full-size synthetic data
python tests/smoke_test.py --quick    # smaller, faster
```

Covers all five modality chains (structural, diffusion, EEG, fMRI, MEG) with
synthetic data: T1 phantom, DWI + bval/bvec, EEG CSV, BOLD + BIDS sidecar,
MEG FIF (via MNE).

The canonical per-modality pipeline map lives in `backend/jobs/pipelines.py`:
sMRI → FastSurfer/FreeSurfer, dMRI → QSIPrep/MRtrix3/DIPY, fMRI →
fMRIPrep/Nilearn, EEG/MEG → MNE-Python/MNE-BIDS-Pipeline — each entry
carrying its implementation status (`implemented` / `partial` / `proposed`)
and license notes, per the Architecture Blueprint (`docs/coherence-architecture-blueprint-v1.0.docx`,
Part II Chapters 4–5 and the reuse matrix).
