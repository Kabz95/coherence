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
