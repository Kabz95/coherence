import { reportInterpretationStatement } from "../clinical-copy";
import type { Modality, NeuroRun, ReportSection } from "../types";
import { MODALITY_LABELS } from "../types";

/**
 * Generic per-modality report sections. Structural MRI keeps its dedicated
 * builder (structural-summary.ts); every other modality renders its
 * measurements, QC flags, and evidence through this shared path.
 */

const MEASUREMENT_LABELS: Record<string, string> = {
  // structural
  totalIntracranialVolumeMl: "Total intracranial volume (mL)",
  meanCorticalThicknessMm: "Mean cortical thickness (mm)",
  leftHippocampusMl: "Left hippocampus (mL)",
  rightHippocampusMl: "Right hippocampus (mL)",
  leftHemisphereVolumeMl: "Left hemisphere volume (mL)",
  rightHemisphereVolumeMl: "Right hemisphere volume (mL)",
  // diffusion
  meanFA: "Mean fractional anisotropy",
  meanMD: "Mean diffusivity (mm²/s)",
  meanAD: "Mean axial diffusivity (mm²/s)",
  meanRD: "Mean radial diffusivity (mm²/s)",
  // fmri
  meanALFF: "Mean ALFF (standardized)",
  meanFALFF: "Mean fALFF",
  medianTSNR: "Median temporal SNR",
  dvarsSpikeVolumes: "High-motion volumes (DVARS)",
  // electrophysiology
  delta: "Delta relative power",
  theta: "Theta relative power",
  alpha: "Alpha relative power",
  beta: "Beta relative power",
  gamma: "Gamma relative power",
};

const SKIP_KEYS = new Set([
  "qcFlags",
  "acquisitionNotes",
  "voxels",
  "maskVoxels",
  "voxelVolumeMl",
  "method",
  "limitations",
  "trSec",
  "sfreqHz",
  "nChannels",
  "nVolumes",
  "bValues",
  "bandPowers",
  "perChannel",
]);

function prettyLabel(key: string): string {
  return (
    MEASUREMENT_LABELS[key] ??
    key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase())
  );
}

function formatValue(value: unknown): string {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(4).replace(/\.?0+$/, "");
  }
  if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
  if (value === null || value === undefined) return "Not available";
  return String(value);
}

function readModalityMeasurements(run: NeuroRun): Record<string, unknown> {
  const outputs = run.outputs;
  if (!outputs || typeof outputs !== "object") return {};
  const key = run.modality as Modality;
  const bucket = (outputs as Record<string, unknown>)[key];
  if (bucket && typeof bucket === "object") {
    // Flatten one level of nested summary objects (e.g. { bandPowers: {...} }).
    const flat: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(bucket as Record<string, unknown>)) {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        for (const [nk, nv] of Object.entries(v as Record<string, unknown>)) {
          if (!(nk in flat)) flat[nk] = nv;
        }
      } else {
        flat[k] = v;
      }
    }
    return flat;
  }
  return {};
}

export function buildModalityMeasurementRows(run: NeuroRun): { label: string; value: string }[] {
  const measurements = readModalityMeasurements(run);
  return Object.entries(measurements)
    .filter(([key]) => !SKIP_KEYS.has(key))
    .map(([key, value]) => ({ label: prettyLabel(key), value: formatValue(value) }));
}

function readQcFlags(run: NeuroRun): string[] {
  const measurements = readModalityMeasurements(run);
  const flags = measurements.qcFlags;
  if (Array.isArray(flags)) return flags.filter((f): f is string => typeof f === "string");
  const qc = run.outputs?.qc;
  if (qc && typeof qc === "object") {
    return Object.entries(qc as Record<string, unknown>).map(([k, v]) => `${prettyLabel(k)}: ${formatValue(v)}`);
  }
  return [];
}

/** Builds the structured, non-diagnostic sections of a non-structural run report. */
export function buildModalityReportSections(run: NeuroRun): ReportSection[] {
  const modalityLabel = MODALITY_LABELS[run.modality] ?? run.modality;
  const generatedAt = run.report?.generatedAt ?? run.updatedAt;
  const measurementRows = buildModalityMeasurementRows(run);
  const qcFlags = readQcFlags(run);

  return [
    {
      id: "administrative",
      title: "Administrative details",
      body: "Run identification, data inputs, and processing state for this report.",
      rows: [
        { label: "Case", value: run.caseId },
        { label: "Run", value: run.id },
        { label: "Modality", value: modalityLabel },
        { label: "Report generated", value: generatedAt.slice(0, 10) },
        { label: "Pipeline status", value: run.status },
      ],
    },
    {
      id: "inputs",
      title: "Data inputs",
      body:
        run.inputFiles.length > 0
          ? `${run.inputFiles.length} registered input file(s) were attached to this run.`
          : "No input files are attached to this run in the current view.",
      rows: run.inputFiles.map((file) => ({
        label: file.name,
        value: `${(file.sizeBytes / 1024 / 1024).toFixed(1)} MB · uploaded ${file.uploadedAt.slice(0, 10)}`,
      })),
    },
    {
      id: "qc",
      title: "Quality-control summary",
      tone: qcFlags.length ? "caution" : "info",
      body: qcFlags.length
        ? "Automated quality-control flags for clinician review. Flags describe acquisition and processing quality only."
        : "Quality-control flags will appear here when backend processing completes.",
      rows: qcFlags.map((flag, index) => ({ label: `Flag ${index + 1}`, value: flag })),
    },
    {
      id: "measurements",
      title: `${modalityLabel} measurements`,
      body: "Measurement summaries for clinician review. Values are supplementary context, not diagnostic markers.",
      rows: measurementRows,
    },
    {
      id: "interpretation",
      title: "Interpretation statement",
      body: reportInterpretationStatement,
      rows: [],
    },
  ];
}
