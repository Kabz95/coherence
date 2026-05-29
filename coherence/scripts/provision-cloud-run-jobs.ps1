param(
  [string]$ProjectId = "studio-4574323897-75b04",
  [string]$Image = "gcr.io/studio-4574323897-75b04/neuro-backend:latest",
  [string]$Bucket = "studio-4574323897-75b04.firebasestorage.app",
  [string]$CpuRegion = "us-central1",
  [string]$GpuRegion = "us-east4"
)

$ErrorActionPreference = "Stop"

$jobs = @(
  @{ Name = "coherence-converter"; Kind = "converter"; Region = $CpuRegion },
  @{ Name = "coherence-qc"; Kind = "qc"; Region = $CpuRegion },
  @{ Name = "coherence-structural-prep"; Kind = "structural_prep"; Region = $CpuRegion },
  @{ Name = "coherence-structural-analysis"; Kind = "structural_analysis"; Region = $GpuRegion },
  @{ Name = "coherence-structural-3d-prep"; Kind = "structural_3d_prep"; Region = $GpuRegion },
  @{ Name = "coherence-report-builder"; Kind = "report_builder"; Region = $CpuRegion },
  @{ Name = "coherence-diffusion-prep"; Kind = "diffusion_prep"; Region = $CpuRegion },
  @{ Name = "coherence-diffusion-analysis"; Kind = "diffusion_analysis"; Region = $GpuRegion },
  @{ Name = "coherence-diffusion-3d-prep"; Kind = "diffusion_3d_prep"; Region = $GpuRegion },
  @{ Name = "coherence-eeg-ingest"; Kind = "eeg_ingest"; Region = $CpuRegion },
  @{ Name = "coherence-eeg-prep"; Kind = "eeg_prep"; Region = $CpuRegion },
  @{ Name = "coherence-eeg-analysis"; Kind = "eeg_analysis"; Region = $CpuRegion },
  @{ Name = "coherence-eeg-visualization-prep"; Kind = "eeg_visualization_prep"; Region = $CpuRegion },
  @{ Name = "coherence-longitudinal-analysis"; Kind = "longitudinal_analysis"; Region = $CpuRegion },
  @{ Name = "coherence-coregistration"; Kind = "coregistration"; Region = $GpuRegion }
)

foreach ($job in $jobs) {
  Write-Host "Deploying $($job.Name) in $($job.Region) for JOB_KIND=$($job.Kind)"
  gcloud run jobs deploy $job.Name `
    --project=$ProjectId `
    --region=$job.Region `
    --image=$Image `
    --command=python `
    --args=worker.py `
    --set-env-vars="JOB_KIND=$($job.Kind),PROJECT_ID=$ProjectId,GCS_BUCKET=$Bucket,RUNS_COLLECTION=neuroRuns"
}

Write-Host "Done. Ensure the Firebase Functions service account has run.jobs.run permissions for these jobs."
