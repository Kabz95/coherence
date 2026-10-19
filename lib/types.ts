export type Modality = "structural_mri" | "diffusion_mri" | "fmri" | "eeg" | "meg" | "multimodal";

/** Human-readable labels for every modality, used across upload, run, and report views. */
export const MODALITY_LABELS: Record<Modality, string> = {
  structural_mri: "Structural MRI",
  diffusion_mri: "Diffusion MRI",
  fmri: "Functional MRI",
  eeg: "EEG",
  meg: "MEG",
  multimodal: "Multimodal",
};

export type RunStatus = "draft" | "uploaded" | "queued" | "running" | "completed" | "failed";

export type StageStatus = "pending" | "queued" | "running" | "completed" | "failed" | "skipped";

/** Canonical status vocabularies used by filters, chips, and the demo timeline. */
export const RUN_STATUSES: readonly RunStatus[] = [
  "draft",
  "uploaded",
  "queued",
  "running",
  "completed",
  "failed",
] as const;

export const STAGE_STATUSES: readonly StageStatus[] = [
  "pending",
  "queued",
  "running",
  "completed",
  "failed",
  "skipped",
] as const;

/** Terminal states: the run will not advance further without clinician action. */
export const TERMINAL_RUN_STATUSES: readonly RunStatus[] = ["completed", "failed"] as const;

export const ACTIVE_RUN_STATUSES: readonly RunStatus[] = ["uploaded", "queued", "running"] as const;

export interface PatientCase {
  id: string;
  displayName: string;
  birthYear?: number;
  sex?: string;
  notes?: string;
  /**
   * Canonical clinical context, captured at case level. Runs snapshot this
   * onto themselves at creation so historical runs keep the context that was
   * true at the time; the case remains the editable source.
   */
  clinicalContext?: ClinicalContext;
  /**
   * The clinician's referral question in their own words, pinned above the
   * unified timeline. One current question per case; superseded versions
   * remain viewable in history.
   */
  referralQuestion?: ReferralQuestion;
  createdAt: string;
  updatedAt: string;
}

/** The clinician's question for the case, with its own edit history. */
export interface ReferralQuestion {
  text: string;
  date: string;
  author?: string;
  history: ReferralQuestionVersion[];
}

export interface ReferralQuestionVersion {
  text: string;
  date: string;
  author?: string;
}

/** A laboratory result or physical-health measurement, clinician-entered. */
export interface LabEntry {
  testName: string;
  date: string;
  value: string;
  unit?: string;
  /** The laboratory's own reference range, recorded at entry — never flagged beyond it. */
  referenceRange?: string;
  notes?: string;
}

/** A sleep/activity summary covering a period. Source is part of the fact. */
export interface SleepSummary {
  startDate: string;
  endDate: string;
  typicalDuration?: string;
  quality?: string;
  disruption?: string;
  source: "clinician" | "patient" | "device";
}

/** A dated life event / psychosocial context marker. Context, not data. */
export interface LifeEvent {
  date: string;
  endDate?: string;
  category: string;
  note?: string;
}

/** Informant/collateral input. Attributed, never merged with the patient's account. */
export interface CollateralEntry {
  informantName?: string;
  relationship: string;
  date: string;
  periodStart?: string;
  periodEnd?: string;
  account: string;
}

export interface ClinicalContext {
  establishedDiagnoses: string[];
  medications: MedicationEntry[];
  therapies: TherapyEntry[];
  symptomScales: SymptomScaleEntry[];
  clinicianNotes?: string;
  /** Dated clinician notes, newest last. */
  notes?: ClinicalNote[];
  /** New-domain streams for the unified timeline; captured case-level. */
  labEntries?: LabEntry[];
  sleepSummaries?: SleepSummary[];
  lifeEvents?: LifeEvent[];
  collateralEntries?: CollateralEntry[];
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

/** A dated clinician note attached to a case's clinical context. */
export interface ClinicalNote {
  id: string;
  date: string;
  author?: string;
  body: string;
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
  fmri?: Record<string, unknown>;
  eeg?: Record<string, unknown>;
  meg?: Record<string, unknown>;
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

/**
 * A single point on a case's longitudinal story: a run, a medication change,
 * a symptom-scale score, a therapy episode, or a clinician note.
 * Everything on the timeline is clinician-entered context or pipeline output —
 * nothing here is a Coherence-generated diagnosis.
 */
export type TimelineEventKind =
  | "case_created"
  | "run"
  | "medication"
  | "symptom_scale"
  | "therapy"
  | "note"
  | "lab"
  | "sleep"
  | "life_event"
  | "collateral";

export const TIMELINE_EVENT_KINDS: readonly TimelineEventKind[] = [
  "case_created",
  "run",
  "medication",
  "symptom_scale",
  "therapy",
  "note",
  "lab",
  "sleep",
  "life_event",
  "collateral",
] as const;

export interface TimelineEvent {
  id: string;
  caseId: string;
  kind: TimelineEventKind;
  title: string;
  detail?: string;
  /** ISO date string; the timeline sorts on this. */
  date: string;
  /** For period events (sleep summaries, therapy episodes, life events): renders as a span. */
  endDate?: string;
  runId?: string;
  /** Who the fact came from — part of the fact itself. */
  source: "clinician" | "pipeline" | "system" | "informant" | "patient" | "device";
}

/** Structured structural-MRI measurements attached to a run's outputs. */
export interface StructuralMeasurements {
  totalIntracranialVolumeMl?: number;
  meanCorticalThicknessMm?: number;
  leftHippocampusMl?: number;
  rightHippocampusMl?: number;
  qcFlags?: string[];
  acquisitionNotes?: string;
}

/** One rendered section of the unified structural report. */
export interface ReportSection {
  id: string;
  title: string;
  body: string;
  /** Optional key/value rows rendered as a definition list. */
  rows?: Array<{ label: string; value: string }>;
  tone?: "neutral" | "caution" | "info";
}

/** Longitudinal delta between two timepoints of the same measurement. */
export interface MeasurementDelta {
  label: string;
  prior?: string;
  latest?: string;
  change?: string;
  unit?: string;
  note: string;
}
