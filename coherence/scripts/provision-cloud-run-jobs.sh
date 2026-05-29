#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-studio-4574323897-75b04}"
IMAGE="${IMAGE:-gcr.io/studio-4574323897-75b04/neuro-backend:latest}"
BUCKET="${GCS_BUCKET:-studio-4574323897-75b04.firebasestorage.app}"
CPU_REGION="${CPU_REGION:-us-central1}"
GPU_REGION="${GPU_REGION:-us-east4}"

deploy_job() {
  local name="$1"
  local kind="$2"
  local region="$3"
  echo "Deploying ${name} in ${region} for JOB_KIND=${kind}"
  gcloud run jobs deploy "${name}" \
    --project="${PROJECT_ID}" \
    --region="${region}" \
    --image="${IMAGE}" \
    --command=python \
    --args=worker.py \
    --set-env-vars="JOB_KIND=${kind},PROJECT_ID=${PROJECT_ID},GCS_BUCKET=${BUCKET},RUNS_COLLECTION=neuroRuns"
}

deploy_job coherence-converter converter "${CPU_REGION}"
deploy_job coherence-qc qc "${CPU_REGION}"
deploy_job coherence-structural-prep structural_prep "${CPU_REGION}"
deploy_job coherence-structural-analysis structural_analysis "${GPU_REGION}"
deploy_job coherence-structural-3d-prep structural_3d_prep "${GPU_REGION}"
deploy_job coherence-report-builder report_builder "${CPU_REGION}"
deploy_job coherence-diffusion-prep diffusion_prep "${CPU_REGION}"
deploy_job coherence-diffusion-analysis diffusion_analysis "${GPU_REGION}"
deploy_job coherence-diffusion-3d-prep diffusion_3d_prep "${GPU_REGION}"
deploy_job coherence-eeg-ingest eeg_ingest "${CPU_REGION}"
deploy_job coherence-eeg-prep eeg_prep "${CPU_REGION}"
deploy_job coherence-eeg-analysis eeg_analysis "${CPU_REGION}"
deploy_job coherence-eeg-visualization-prep eeg_visualization_prep "${CPU_REGION}"
deploy_job coherence-longitudinal-analysis longitudinal_analysis "${CPU_REGION}"
deploy_job coherence-coregistration coregistration "${GPU_REGION}"

echo "Done. Ensure the Firebase Functions service account has run.jobs.run permissions for these jobs."
