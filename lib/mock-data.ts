import { GENERAL_DISCLAIMER, reportInterpretationStatement } from "./clinical-copy";
import { buildStagesForModality } from "./job-map";
import type {
  ClinicalContext,
  EvidenceItem,
  Modality,
  NeuroRun,
  PatientCase,
  RunStage,
} from "./types";

/**
 * Demo seed: REAL pipeline outputs on public research datasets.
 *
 * Every measurement below was produced by the actual Coherence backend
 * pipelines (see coherence/backend/validation/last_validation_report.md)
 * running on small public neuroimaging datasets. Nothing is invented:
 * - A-104: structural MRI on the SPM auditory sub-01 T1 (individual brain)
 * - D-528: diffusion MRI on the ISBI2013 HARDI phantom64 (dipy)
 * - E-639: fMRI on the SPM auditory MoAEpilot BOLD run (nilearn)
 * - F-741: EEG on EEGBCI S001R01 (mne / PhysioNet)
 * - G-852: MEG on the MNE somato dataset (120 s crop)
 *
 * Case B-217 shows a live pipeline and Case C-309 the empty state.
 * All outputs are non-diagnostic summaries for clinician review.
 * Viewer images are synthetic demo previews, not the source data.
 */

function withoutOrchestrator(stages: RunStage[]): RunStage[] {
  // Match the Firestore read path, which filters the orchestrator coordination
  // stage out of the clinical job list.
  return stages.filter((stage) => !stage.id.startsWith("orchestrator") && stage.jobName !== "coherence-pipeline-orchestrator");
}

function completedStages(modality: Modality, completedAt: string): RunStage[] {
  return withoutOrchestrator(
    buildStagesForModality(modality).map((stage) => ({
      ...stage,
      status: "completed" as const,
      startedAt: completedAt,
      completedAt,
    })),
  );
}

function runningStages(modality: Modality, runningLabel: string): RunStage[] {
  const stages = buildStagesForModality(modality);
  let seenRunning = false;
  return withoutOrchestrator(
    stages.map((stage) => {
      if (stage.label === runningLabel && !seenRunning) {
        seenRunning = true;
        return { ...stage, status: "running" as const, startedAt: new Date().toISOString() };
      }
      return { ...stage, status: (seenRunning ? stage.status : "completed") as RunStage["status"] };
    }),
  );
}

const auroraContext: ClinicalContext = {
  establishedDiagnoses: [],
  medications: [],
  therapies: [],
  symptomScales: [],
  clinicianNotes:
    "Public research data — SPM auditory dataset, sub-01 T1-weighted anatomical (1×1×3 mm), via nilearn. " +
    "Processed by the real Coherence structural pipeline (converter → QC → structural prep → structural analysis). " +
    "No cortical thickness or subcortical segmentation: the built-in pipeline performs rough Otsu-mask volumetry only. " +
    GENERAL_DISCLAIMER,
  notes: [],
};

const SPM_T1_DATE = "2026-10-12T02:30:00.000Z";

/** Real outputs of the Coherence structural chain on the SPM sub-01 T1. */
const spmT1Evidence: EvidenceItem[] = [
  {
    id: "evidence-spm-qc",
    source: "Quality control",
    value: "Warn — low SNR proxy inside the estimated brain region",
    method: "NIfTI header, intensity, slice-dropout, and SNR-proxy checks",
    limitations: "Describes acquisition/data quality only; not a clinical judgment.",
    generatedAt: SPM_T1_DATE,
  },
  {
    id: "evidence-spm-ticv",
    source: "Structural measurement",
    value: "2876.42",
    unit: "mL",
    method: "Otsu-threshold rough brain mask volumetry (voxel count × voxel volume)",
    limitations:
      "Rough estimate, not a FreeSurfer-grade segmentation; the Otsu mask over-segments on this acquisition (includes scalp/skull). Compare only same-protocol timepoints.",
    generatedAt: SPM_T1_DATE,
  },
  {
    id: "evidence-spm-hemi",
    source: "Structural measurement",
    value: "L 1532.06 / R 1344.36",
    unit: "mL",
    method: "Mid-sagittal split of the RAS-oriented rough mask",
    limitations: "Hemisphere split is geometric, not anatomical.",
    generatedAt: SPM_T1_DATE,
  },
  {
    id: "evidence-spm-intensity",
    source: "Structural measurement",
    value: "0.5142",
    method: "Mean of percentile-normalized intensity inside the rough mask",
    limitations: "Acquisition-dependent; not comparable across scanners or protocols.",
    generatedAt: SPM_T1_DATE,
  },
  {
    id: "evidence-spm-nothickness",
    source: "Structural measurement",
    value: "Not available",
    method: "Cortical thickness / subcortical segmentation",
    limitations: "Not produced by the built-in pipeline (FastSurfer not installed). Shown as unavailable rather than estimated.",
    generatedAt: SPM_T1_DATE,
  },
];

function structuralRun(
  id: string,
  createdAt: string,
  evidence: EvidenceItem[],
  measurements: Record<string, unknown>,
  status: NeuroRun["status"],
  currentStage: string,
  stages: RunStage[],
): NeuroRun {
  return {
    id,
    caseId: "case-aurora-001",
    modality: "structural_mri",
    inputFiles: [
      {
        id: `${id}-file-1`,
        name: id === "run-structural-prior" ? "T1w_MPRAGE_2026-02-14.nii.gz" : "T1w_MPRAGE_2026-10-08.nii.gz",
        storagePath: `cases/case-aurora-001/runs/${id}/inputs/t1w.nii.gz`,
        contentType: "application/gzip",
        sizeBytes: 52428800,
        modality: "structural_mri",
        uploadedAt: createdAt,
      },
    ],
    status,
    currentStage,
    stages,
    createdAt,
    updatedAt: createdAt,
    clinicalContext: auroraContext,
    outputs: {
      structural: measurements,
      visualizationAssets: {
        slice_montage: "/demo-assets/structural-montage.png",
        volume_render: "/demo-assets/structural-volume.png",
      },
      evidenceLedger: evidence,
    },
    report: {
      generatedAt: createdAt,
      limitations: [
        "No diagnostic conclusion is generated.",
        "Whole-brain averages hide regional variation.",
        "Compare only against same-protocol timepoints.",
      ],
      interpretationStatement: reportInterpretationStatement,
    },
  };
}

export const mockCases: PatientCase[] = [
  {
    id: "case-aurora-001",
    displayName: "Case A-104",
    notes: "Structural MRI pipeline output on public research data (SPM individual T1). Non-diagnostic.",
    createdAt: "2026-10-12T02:30:00.000Z",
    updatedAt: SPM_T1_DATE,
  },
  {
    id: "case-orbit-002",
    displayName: "Case B-217",
    birthYear: 1976,
    sex: "Not specified",
    notes: "Structural run currently processing.",
    createdAt: "2026-09-02T11:00:00.000Z",
    updatedAt: "2026-10-10T16:00:00.000Z",
  },
  {
    id: "case-meridian-003",
    displayName: "Case C-309",
    birthYear: 1995,
    sex: "Not specified",
    notes: "Intake complete; no imaging runs yet.",
    createdAt: "2026-10-01T09:30:00.000Z",
    updatedAt: "2026-10-01T09:30:00.000Z",
  },
  {
    id: "case-harbor-004",
    displayName: "Case D-528",
    birthYear: 1982,
    sex: "Not specified",
    notes: "Diffusion MRI pipeline output on public research data (ISBI2013 phantom). Non-diagnostic.",
    createdAt: "2026-09-12T10:00:00.000Z",
    updatedAt: "2026-10-06T15:00:00.000Z",
  },
  {
    id: "case-lumen-005",
    displayName: "Case E-639",
    birthYear: 1991,
    sex: "Not specified",
    notes: "fMRI pipeline output on public research data (SPM auditory BOLD). Non-diagnostic.",
    createdAt: "2026-09-18T10:00:00.000Z",
    updatedAt: "2026-10-07T11:00:00.000Z",
  },
  {
    id: "case-signal-006",
    displayName: "Case F-741",
    birthYear: 1979,
    sex: "Not specified",
    notes: "EEG spectral pipeline output on public research data (EEGBCI). Non-diagnostic.",
    createdAt: "2026-09-25T10:00:00.000Z",
    updatedAt: "2026-10-08T09:00:00.000Z",
  },
  {
    id: "case-field-007",
    displayName: "Case G-852",
    birthYear: 1986,
    sex: "Not specified",
    notes: "MEG spectral pipeline output on public research data (MNE somato). Non-diagnostic.",
    createdAt: "2026-09-29T10:00:00.000Z",
    updatedAt: "2026-10-09T13:00:00.000Z",
  },
];

const meridianContext: ClinicalContext = {
  establishedDiagnoses: ["Persistent depressive disorder (clinician-entered)"],
  medications: [
    {
      name: "Escitalopram",
      dose: "10 mg daily",
      startDate: "2026-06-01",
      notes: "Tolerating well; 6-week review pending.",
    },
  ],
  therapies: [],
  symptomScales: [{ name: "PHQ-9", score: "15", date: "2026-10-01", notes: "Intake" }],
  clinicianNotes: "Intake complete. Baseline structural MRI referral sent.",
  notes: [
    {
      id: "note-meridian-1",
      date: "2026-10-01",
      author: "Dr. L. Chen",
      body: "Intake visit. Baseline PHQ-9 15. Plan: start structural monitoring once first scan is scheduled.",
    },
  ],
};

export function getMockClinicalContext(caseId: string): ClinicalContext | undefined {
  if (caseId === "case-aurora-001") return auroraContext;
  if (caseId === "case-meridian-003") return meridianContext;
  return undefined;
}

function pipelineRun(options: {
  id: string;
  caseId: string;
  modality: Modality;
  createdAt: string;
  fileName: string;
  sizeBytes: number;
  measurements: Record<string, unknown>;
  evidence: EvidenceItem[];
  visualizationAssets: Record<string, string>;
}): NeuroRun {
  return {
    id: options.id,
    caseId: options.caseId,
    modality: options.modality,
    inputFiles: [
      {
        id: `${options.id}-file-1`,
        name: options.fileName,
        storagePath: `cases/${options.caseId}/runs/${options.id}/inputs/${options.fileName}`,
        contentType: "application/octet-stream",
        sizeBytes: options.sizeBytes,
        modality: options.modality,
        uploadedAt: options.createdAt,
      },
    ],
    status: "completed",
    currentStage: "Report builder",
    stages: completedStages(options.modality, options.createdAt),
    createdAt: options.createdAt,
    updatedAt: options.createdAt,
    clinicalContext: {
      establishedDiagnoses: ["Clinician-entered context (demo)"],
      medications: [],
      therapies: [],
      symptomScales: [],
      clinicianNotes: GENERAL_DISCLAIMER,
    },
    outputs: {
      [options.modality]: options.measurements,
      visualizationAssets: options.visualizationAssets,
      evidenceLedger: options.evidence,
    },
    report: {
      generatedAt: options.createdAt,
      limitations: [
        "No diagnostic conclusion is generated.",
        "Measurements are genuine outputs of the Coherence pipelines on the public dataset noted above.",
        "Compare only against same-protocol timepoints.",
      ],
      interpretationStatement: reportInterpretationStatement,
    },
  };
}

const diffusionDate = "2026-10-06T15:00:00.000Z";
const fmriDate = "2026-10-07T11:00:00.000Z";
const eegDate = "2026-10-08T09:00:00.000Z";
const megDate = "2026-10-09T13:00:00.000Z";

const diffusionEvidence: EvidenceItem[] = [
  {
    id: "evidence-diffusion-qc",
    source: "Quality control",
    value: "Pass — bval/bvec consistent, no eddy correction applied",
    method: "Automated QC pipeline",
    limitations: "Built-in pipeline skips eddy/motion correction; use QSIPrep for production.",
    generatedAt: diffusionDate,
  },
  {
    id: "evidence-diffusion-fit",
    source: "Diffusion measurement",
    value: "Single-tensor fit converged",
    method: "DIPY single-tensor DTI",
    limitations: "Single tensor cannot resolve crossing fibers.",
    generatedAt: diffusionDate,
  },
];

const fmriEvidence: EvidenceItem[] = [
  {
    id: "evidence-fmri-qc",
    source: "Quality control",
    value: "Pass — 0 high-motion volumes, median tSNR 31.8",
    method: "DVARS and temporal-SNR pipeline (84 volumes, TR 2.0 s)",
    limitations: "No motion/distortion correction applied; fMRIPrep is the production reference.",
    generatedAt: fmriDate,
  },
  {
    id: "evidence-fmri-denoise",
    source: "fMRI preparation",
    value: "CompCor-lite: 5 components removed",
    method: "Detrended, CompCor-lite, 0.01–0.1 Hz bandpass",
    limitations: "CompCor-lite is a research-grade approximation.",
    generatedAt: fmriDate,
  },
];

const eegEvidence: EvidenceItem[] = [
  {
    id: "evidence-eeg-qc",
    source: "Quality control",
    value: "Pass — 0 bad channels flagged",
    method: "Variance-based channel screening (64 ch @ 160 Hz)",
    limitations: "Basic artifact handling; no ICA/autoreject production workflow. ~19% of spectral power sits below 1 Hz (slow drift survives the high-pass); band powers are relative to broadband total.",
    generatedAt: eegDate,
  },
];

const megEvidence: EvidenceItem[] = [
  {
    id: "evidence-meg-qc",
    source: "Quality control",
    value: "Pass — 0 bad channels flagged",
    method: "Variance-based channel screening (306 ch @ 300 Hz, 120 s)",
    limitations: "Source localization is out of scope for this pipeline.",
    generatedAt: megDate,
  },
];

export const mockRuns: NeuroRun[] = [
  structuralRun(
    "run-structural-spm",
    SPM_T1_DATE,
    spmT1Evidence,
    {
      totalIntracranialVolumeMl: 2876.42,
      leftHemisphereVolumeMl: 1532.06,
      rightHemisphereVolumeMl: 1344.36,
      meanMaskIntensity: 0.5142,
      qcFlags: ["Low SNR proxy inside the estimated brain region."],
      acquisitionNotes:
        "SPM auditory dataset, sub-01 T1w, 1×1×3 mm, via nilearn. Public research data — individual brain, not a template.",
    },
    "completed",
    "Report builder",
    completedStages("structural_mri", SPM_T1_DATE),
  ),
  pipelineRun({
    id: "run-diffusion-001",
    caseId: "case-harbor-004",
    modality: "diffusion_mri",
    createdAt: diffusionDate,
    fileName: "phantom64.nii.gz",
    sizeBytes: 22000000,
    measurements: {
      meanFA: 0.1034,
      meanMD: 0.000266,
      meanAD: 0.000335,
      meanRD: 0.000232,
      qcFlags: ["bval/bvec consistent", "No eddy correction applied"],
      acquisitionNotes:
        "ISBI2013 two-shell HARDI phantom64 (dipy). Physical diffusion phantom — not a human scan. Single-tensor fit; low mean FA reflects crossing-fibre phantom structure.",
    },
    evidence: diffusionEvidence,
    visualizationAssets: { diffusion_montage: "/demo-assets/fa-montage.png" },
  }),
  pipelineRun({
    id: "run-fmri-001",
    caseId: "case-lumen-005",
    modality: "fmri",
    createdAt: fmriDate,
    fileName: "sub-01_task-auditory_bold.nii",
    sizeBytes: 110000000,
    measurements: {
      meanALFF: 1.0,
      meanFALFF: 0.1677,
      medianTSNR: 31.84,
      dvarsMedian: 45.139,
      dvarsSpikeVolumes: 0,
      trSec: 2.0,
      nVolumes: 84,
      qcFlags: ["No high-motion volumes", "TR 2.0 s from BIDS sidecar"],
      acquisitionNotes:
        "SPM auditory MoAEpilot, sub-01 task BOLD, 84 volumes, TR 2.0 s (nilearn). Task fMRI used to exercise DVARS/tSNR/denoising/ALFF plumbing — not a resting-state benchmark.",
    },
    evidence: fmriEvidence,
    visualizationAssets: {
      fmri_carpet: "/demo-assets/fmri-carpet.png",
      fmri_montage: "/demo-assets/bold-montage.png",
    },
  }),
  pipelineRun({
    id: "run-eeg-001",
    caseId: "case-signal-006",
    modality: "eeg",
    createdAt: eegDate,
    fileName: "S001R01.edf",
    sizeBytes: 9800000,
    measurements: {
      delta: 0.4646,
      theta: 0.1279,
      alpha: 0.0922,
      beta: 0.1028,
      gamma: 0.018,
      sfreqHz: 160,
      nChannels: 64,
      qcFlags: ["0 bad channels", "1–40 Hz bandpass, 50 Hz notch", "Sub-1 Hz drift present — see limitations"],
      acquisitionNotes:
        "EEGBCI S001R01 motor-imagery EEG (mne / PhysioNet), 64 channels @ 160 Hz. Band powers are relative to broadband total; ~19% of power sits below 1 Hz (slow drift survives the high-pass).",
    },
    evidence: eegEvidence,
    visualizationAssets: {
      eeg_trace: "/demo-assets/eeg-trace.png",
      eeg_spectrogram: "/demo-assets/eeg-spectrogram.png",
    },
  }),
  pipelineRun({
    id: "run-meg-001",
    caseId: "case-field-007",
    modality: "meg",
    createdAt: megDate,
    fileName: "sub-01_task-somato_meg.fif",
    sizeBytes: 750000000,
    measurements: {
      delta: 0.1613,
      theta: 0.1418,
      alpha: 0.3691,
      beta: 0.227,
      gamma: 0.0231,
      sfreqHz: 300.3,
      nChannels: 306,
      qcFlags: ["0 bad channels", "1–40 Hz bandpass, 50 Hz notch"],
      acquisitionNotes:
        "MNE somato sub-01 MEG, 306 channels @ 300 Hz, cropped to 120 s for validation speed. Alpha-dominant resting spectrum, as expected.",
    },
    evidence: megEvidence,
    visualizationAssets: {
      meg_trace: "/demo-assets/meg-trace.png",
      meg_spectrogram: "/demo-assets/meg-spectrogram.png",
    },
  }),
  {
    id: "run-structural-live",
    caseId: "case-orbit-002",
    modality: "structural_mri",
    inputFiles: [
      {
        id: "run-structural-live-file-1",
        name: "T1w_MPRAGE_2026-10-10.nii.gz",
        storagePath: "cases/case-orbit-002/runs/run-structural-live/inputs/t1w.nii.gz",
        contentType: "application/gzip",
        sizeBytes: 48234500,
        modality: "structural_mri",
        uploadedAt: "2026-10-10T16:00:00.000Z",
      },
    ],
    status: "running",
    currentStage: "Structural measurements",
    stages: runningStages("structural_mri", "Structural measurements"),
    createdAt: "2026-10-10T16:00:00.000Z",
    updatedAt: "2026-10-10T16:00:00.000Z",
    clinicalContext: {
      establishedDiagnoses: ["Clinician-entered context pending"],
      medications: [],
      therapies: [],
      symptomScales: [],
      clinicianNotes: GENERAL_DISCLAIMER,
    },
    outputs: { evidenceLedger: [] },
  },
];

export const mockEvidence: EvidenceItem[] = spmT1Evidence;

export { GENERAL_DISCLAIMER };
