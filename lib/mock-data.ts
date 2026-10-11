import { GENERAL_DISCLAIMER, reportInterpretationStatement } from "./clinical-copy";
import { buildStagesForModality } from "./job-map";
import type { EvidenceItem, NeuroRun, PatientCase } from "./types";

const now = new Date().toISOString();

export const mockCases: PatientCase[] = [
  {
    id: "case-aurora-001",
    displayName: "Case A-104",
    birthYear: 1988,
    sex: "Not specified",
    notes: "Longitudinal monitoring case with clinician-entered context.",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "case-orbit-002",
    displayName: "Case B-217",
    birthYear: 1976,
    sex: "Not specified",
    notes: "Multimodal intake awaiting additional records.",
    createdAt: now,
    updatedAt: now
  }
];

export const mockEvidence: EvidenceItem[] = [
  {
    id: "evidence-qc-1",
    source: "QC placeholder",
    value: "Pending",
    method: "Automated quality-control flag placeholder",
    limitations: "No source data has been processed in this development view.",
    generatedAt: now
  },
  {
    id: "evidence-structural-1",
    source: "Structural measurement placeholder",
    value: "Awaiting analysis",
    unit: "n/a",
    method: "Future structural MRI measurement pipeline",
    limitations: "Measurement uncertainty and acquisition quality must be reviewed by the clinician.",
    generatedAt: now
  }
];

export const mockRuns: NeuroRun[] = [
  {
    id: "run-structural-demo",
    caseId: "case-aurora-001",
    modality: "structural_mri",
    inputFiles: [
      {
        id: "file-1",
        name: "structural_T1w_demo.nii.gz",
        storagePath: "cases/case-aurora-001/runs/run-structural-demo/inputs/structural_T1w_demo.nii.gz",
        contentType: "application/gzip",
        sizeBytes: 52428800,
        modality: "structural_mri",
        uploadedAt: now
      }
    ],
    status: "running",
    currentStage: "Quality control",
    stages: buildStagesForModality("structural_mri").map((stage, index) => ({
      ...stage,
      status: index === 0 ? "completed" : index === 1 ? "running" : stage.status
    })),
    createdAt: now,
    updatedAt: now,
    clinicalContext: {
      establishedDiagnoses: ["Clinician-entered context placeholder"],
      medications: [{ name: "Medication context placeholder", notes: "Entered by clinician, not inferred by Coherence." }],
      therapies: [{ type: "Therapy context placeholder" }],
      symptomScales: [{ name: "Symptom scale placeholder", score: "Not scored in demo" }],
      clinicianNotes: GENERAL_DISCLAIMER
    },
    outputs: {
      evidenceLedger: mockEvidence
    },
    report: {
      generatedAt: now,
      limitations: ["No diagnostic conclusion is generated.", "Viewer outputs are placeholders until backend assets are available."],
      interpretationStatement: reportInterpretationStatement
    }
  },
  {
    id: "run-multimodal-demo",
    caseId: "case-orbit-002",
    modality: "multimodal",
    inputFiles: [],
    status: "queued",
    currentStage: "Pipeline orchestration",
    stages: buildStagesForModality("multimodal"),
    createdAt: now,
    updatedAt: now,
    outputs: { evidenceLedger: mockEvidence }
  }
];
