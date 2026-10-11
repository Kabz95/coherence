export type Modality = "structural_mri" | "diffusion_mri" | "eeg" | "multimodal";

export type RunStatus = "draft" | "uploaded" | "queued" | "running" | "completed" | "failed";

export type StageStatus = "pending" | "queued" | "running" | "completed" | "failed" | "skipped";

export interface PatientCase {
  id: string;
  displayName: string;
  birthYear?: number;
  sex?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClinicalContext {
  establishedDiagnoses: string[];
  medications: MedicationEntry[];
  therapies: TherapyEntry[];
  symptomScales: SymptomScaleEntry[];
  clinicianNotes?: string;
}

export interface MedicationEntry {
  name: string;
  dose?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

export interface TherapyEntry {
  type: string;
  frequency?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

export interface SymptomScaleEntry {
  name: string;
  score?: string;
  date?: string;
  notes?: string;
}

export interface NeuroRun {
  id: string;
  caseId: string;
  modality: Modality;
  inputFiles: InputFile[];
  status: RunStatus;
  currentStage: string;
  stages: RunStage[];
  createdAt: string;
  updatedAt: string;
  clinicalContext?: ClinicalContext;
  outputs?: RunOutputs;
  report?: ReportSummary;
}

export interface InputFile {
  id: string;
  name: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  modality: Modality;
  uploadedAt: string;
}

export interface RunStage {
  id: string;
  label: string;
  jobName: string;
  region: string;
  requiresGpu: boolean;
  status: StageStatus;
  estimatedDurationSeconds?: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface RunOutputs {
  structural?: Record<string, unknown>;
  diffusion?: Record<string, unknown>;
  eeg?: Record<string, unknown>;
  visualizationAssets?: Record<string, string>;
  qc?: Record<string, unknown>;
  evidenceLedger?: EvidenceItem[];
}

export interface EvidenceItem {
  id: string;
  source: string;
  value: string;
  unit?: string;
  method: string;
  limitations: string;
  generatedAt: string;
}

export interface ReportSummary {
  generatedAt: string;
  limitations: string[];
  interpretationStatement: string;
}
