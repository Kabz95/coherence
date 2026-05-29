param(
  [string]$ProjectId = "studio-4574323897-75b04",
  [string]$Image = "gcr.io/studio-4574323897-75b04/neuro-backend:latest"
)

$ErrorActionPreference = "Stop"

Write-Host "Building and pushing backend image: $Image"
gcloud builds submit backend --project=$ProjectId --tag=$Image

Write-Host "Updating Cloud Run Jobs to use worker mode"
& "$PSScriptRoot\provision-cloud-run-jobs.ps1" -ProjectId $ProjectId -Image $Image

Write-Host "Backend image and Cloud Run Jobs are updated."
