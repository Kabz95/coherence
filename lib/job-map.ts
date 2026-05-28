import type { Modality, RunStage } from "./types";

export const PROJECT_ID = "studio-4574323897-75b04";
export const CPU_REGION = "us-central1";
export const GPU_REGION = "us-east4";
export const GCS_BUCKET = "studio-4574323897-75b04.firebasestorage.app";

export interface JobDefinition {
  jobName: string;
  label: string;
  modality: Modality | "shared";
  stage: string;
  region: string;
  requiresGpu: boolean;
  estimatedDurationSeconds: number;
  description: string;
}

export const JOB_DEFINITIONS: JobDefinition[] = [
  { jobName: "coherence-converter", label: "Input conversion", modality: "shared", stage: "converter", region: CPU_REGION, requiresGpu: false, estimatedDurationSeconds: 180, description: "Normalize supported source files into analysis-ready working assets." },
  { jobName: "coherence-qc", label: "Quality control", modality: "shared", stage: "qc", region: CPU_REGION, requiresGpu: false, estimatedDurationSeconds: 120, description: "Generate quality-control flags and input integrity checks." },
  { jobName: "coherence-structural-prep", label: "Structural preparation", modality: "structural_mri", stage: "structural-prep", region: CPU_REGION, requiresGpu: false, estimatedDurationSeconds: 600, description: "Prepare structural MRI volumes for measurement workflows." },
  { jobName: "coherence-structural-analysis", label: "Structural measurements", modality: "structural_mri", stage: "structural-analysis", region: GPU_REGION, requiresGpu: true, estimatedDurationSeconds: 7200, description: "Produce structural measurement summaries for clinician review." },
  { jobName: "coherence-structural-3d-prep", label: "3D structural assets", modality: "structural_mri", stage: "structural-3d-prep", region: GPU_REGION, requiresGpu: true, estimatedDurationSeconds: 300, description: "Prepare future 3D viewer assets." },
  { jobName: "coherence-report-builder", label: "Report builder", modality: "shared", stage: "report-builder", region: CPU_REGION, requiresGpu: false, estimatedDurationSeconds: 120, description: "Build structured non-diagnostic reports from outputs and evidence ledger entries." },
  { jobName: "coherence-pipeline-orchestrator", label: "Pipeline orchestration", modality: "shared", stage: "orchestrator", region: CPU_REGION, requiresGpu: false, estimatedDurationSeconds: 60, description: "Coordinate pipeline stage state and backend execution." },
  { jobName: "coherence-diffusion-prep", label: "Diffusion preparation", modality: "diffusion_mri", stage: "diffusion-prep", region: CPU_REGION, requiresGpu: false, estimatedDurationSeconds: 600, description: "Prepare diffusion MRI inputs, including bval and bvec companion files." },
  { jobName: "coherence-diffusion-analysis", label: "Diffusion measurements", modality: "diffusion_mri", stage: "diffusion-analysis", region: GPU_REGION, requiresGpu: true, estimatedDurationSeconds: 1800, description: "Generate diffusion/connectome measurement summaries." },
  { jobName: "coherence-diffusion-3d-prep", label: "Diffusion viewer assets", modality: "diffusion_mri", stage: "diffusion-3d-prep", region: GPU_REGION, requiresGpu: true, estimatedDurationSeconds: 300, description: "Prepare tract and connectome visualization assets." },
  { jobName: "coherence-eeg-ingest", label: "EEG ingest", modality: "eeg", stage: "eeg-ingest", region: CPU_REGION, requiresGpu: false, estimatedDurationSeconds: 180, description: "Register EEG source files and metadata." },
  { jobName: "coherence-eeg-prep", label: "EEG preparation", modality: "eeg", stage: "eeg-prep", region: CPU_REGION, requiresGpu: false, estimatedDurationSeconds: 600, description: "Prepare EEG signals for future trace and spectrogram outputs." },
  { jobName: "coherence-eeg-analysis", label: "EEG measurements", modality: "eeg", stage: "eeg-analysis", region: CPU_REGION, requiresGpu: false, estimatedDurationSeconds: 600, description: "Create EEG-derived non-diagnostic measurement summaries." },
  { jobName: "coherence-eeg-visualization-prep", label: "EEG visualization assets", modality: "eeg", stage: "eeg-visualization-prep", region: CPU_REGION, requiresGpu: false, estimatedDurationSeconds: 180, description: "Prepare future trace and spectrogram viewer assets." },
  { jobName: "coherence-longitudinal-analysis", label: "Longitudinal comparison", modality: "shared", stage: "longitudinal-analysis", region: CPU_REGION, requiresGpu: false, estimatedDurationSeconds: 180, description: "Compare measurements across timepoints with uncertainty context." },
  { jobName: "coherence-coregistration", label: "Multimodal coregistration", modality: "multimodal", stage: "coregistration", region: GPU_REGION, requiresGpu: true, estimatedDurationSeconds: 600, description: "Prepare aligned multimodal assets for future integrated views." }
];

export function jobsForModality(modality: Modality): JobDefinition[] {
  const shared = JOB_DEFINITIONS.filter((job) => job.modality === "shared");
  const modalityJobs = JOB_DEFINITIONS.filter((job) => job.modality === modality);

  if (modality === "multimodal") {
    const multimodalJobs = JOB_DEFINITIONS.filter(
      (job) => job.modality === "structural_mri" || job.modality === "diffusion_mri" || job.modality === "eeg" || job.modality === "multimodal"
    );
    return [...shared, ...multimodalJobs];
  }

  return [...shared, ...modalityJobs];
}

export function buildStagesForModality(modality: Modality): RunStage[] {
  return jobsForModality(modality).map((job, index) => ({
    id: `${job.stage}-${index + 1}`,
    label: job.label,
    jobName: job.jobName,
    region: job.region,
    requiresGpu: job.requiresGpu,
    estimatedDurationSeconds: job.estimatedDurationSeconds,
    status: index === 0 ? "queued" : "pending"
  }));
}
