import { asDict, readStageOutputs } from "../live-outputs";
import type { RegionalVolumeTable } from "../live-outputs";
import type { NeuroRun, ReportBlock, ReportSection } from "../types";

/**
 * Readers for the report the live backend composes into run.report.summary
 * (plus the normative and longitudinal stage records). The unified report
 * historically rendered only its own fixed sections; these readers surface
 * the backend's synthesis, brain state, diagnosis reviews, normative
 * results, QC, and safety validation.
 *
 * Field shapes were established by schema-level inspection of a completed
 * run (2026-10-23). Every read is type-guarded: a field that is absent or
 * differently shaped is skipped, never guessed. A few nested payloads were
 * only observed at the key level (normative results, the QC object), so
 * those go through the tolerant scalar/label extractors below and render
 * only what verifiably parses.
 */

type Dict = Record<string, unknown>;
type Row = { label: string; value: string };

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function strList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function prettyLabel(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

function formatScalar(value: unknown): string | undefined {
  if (typeof value === "number") return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(3).replace(/\.?0+$/, "");
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return undefined;
}

/** Rows for the scalar entries of an object (one level of nesting flattened). */
function scalarRows(dict: Dict | null, cap = 14): Row[] {
  if (!dict) return [];
  const rows: Row[] = [];
  const push = (key: string, value: unknown) => {
    const formatted = formatScalar(value);
    if (formatted !== undefined) rows.push({ label: prettyLabel(key), value: formatted });
  };
  for (const [key, value] of Object.entries(dict)) {
    if (rows.length >= cap) break;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [nestedKey, nestedValue] of Object.entries(value as Dict)) {
        if (rows.length >= cap) break;
        push(`${key} ${nestedKey}`, nestedValue);
      }
    } else if (Array.isArray(value)) {
      const strings = strList(value);
      if (strings.length) rows.push({ label: prettyLabel(key), value: strings.join(", ") });
    } else {
      push(key, value);
    }
  }
  return rows;
}

/** Label strings from a mixed list: plain strings pass; objects contribute their name-like field. */
function labelList(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value] : [];
  if (!Array.isArray(value)) return [];
  const labels: string[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      if (item.trim()) labels.push(item);
      continue;
    }
    const entry = asDict(item);
    if (!entry) continue;
    const label =
      str(entry.name) ?? str(entry.region) ?? str(entry.label) ?? str(entry.circuit) ?? str(entry.displayName) ?? str(entry.title);
    if (label) labels.push(label);
  }
  return labels;
}

/** Short "key: value" strings from a mixed payload, for findings-style fields. */
function findingList(value: unknown): string[] {
  const labels = labelList(value);
  if (labels.length) return labels;
  const dict = asDict(value);
  if (dict) {
    return scalarRows(dict, 8).map((row) => `${row.label}: ${row.value}`);
  }
  const single = str(value);
  return single ? [single] : [];
}

export interface DiagnosisReview {
  diagnosis: string;
  framework?: string;
  concordance?: string;
  clinicalReasoning?: string;
  decisionUse?: string;
  reviewImplications?: string;
}

export interface PsychiatricSynthesis {
  summary?: string;
  decisionSupport: string[];
  diagnosisReviews: DiagnosisReview[];
}

export interface BrainState {
  clinicalMeaning?: string;
  statements: string[];
  warnings: string[];
}

export interface RegionRelevance {
  diagnosis: string;
  evidenceStrength?: string;
  status?: string;
  relationshipToThisRun?: string;
  reviewFocus?: string;
  psychiatricReview?: string;
  regions: string[];
  findings: string[];
}

export interface NormativeReport {
  modelSource?: string;
  modelVersion?: string;
  adapter?: string;
  status?: string;
  scoredFeatureCount?: number;
  matchedFeatureCount?: number;
  approvedModelCount?: number;
  inputRowCount?: number;
  limitations: string[];
  resultRows: Row[];
}

export interface BackendReport {
  narrative: string[];
  synthesis?: PsychiatricSynthesis;
  brainState?: BrainState;
  regionRelevance: RegionRelevance[];
  normative?: NormativeReport;
  qcRows: Row[];
  safety?: { passed?: boolean; violations: string[] };
  longitudinalNote?: string;
}

function reportSummary(run: NeuroRun): Dict | null {
  return asDict(asDict(run.report)?.summary);
}

function readSynthesis(summary: Dict): PsychiatricSynthesis | undefined {
  const morphometric = asDict(summary.morphometricReport);
  const raw = asDict(morphometric?.psychiatricSynthesis);
  if (!raw) return undefined;
  const reviews: DiagnosisReview[] = [];
  if (Array.isArray(raw.diagnosisReviews)) {
    for (const item of raw.diagnosisReviews) {
      const entry = asDict(item);
      if (!entry) continue;
      const diagnosis = str(entry.diagnosis) ?? str(entry.normalizedDiagnosis);
      if (!diagnosis) continue;
      reviews.push({
        diagnosis,
        framework: str(entry.framework),
        concordance: str(entry.concordance),
        clinicalReasoning: str(entry.clinicalReasoning),
        decisionUse: str(entry.decisionUse),
        reviewImplications: str(entry.reviewImplications),
      });
    }
  }
  const synthesis: PsychiatricSynthesis = {
    summary: str(raw.summary),
    decisionSupport: strList(raw.psychiatricDecisionSupport),
    diagnosisReviews: reviews,
  };
  if (!synthesis.summary && !synthesis.decisionSupport.length && !synthesis.diagnosisReviews.length) return undefined;
  return synthesis;
}

function readBrainState(summary: Dict): BrainState | undefined {
  const morphometric = asDict(summary.morphometricReport);
  const raw = asDict(morphometric?.structuralBrainState);
  if (!raw) return undefined;
  const state: BrainState = {
    clinicalMeaning: str(raw.clinicalMeaning),
    statements: strList(raw.statements),
    warnings: strList(raw.warnings),
  };
  if (!state.clinicalMeaning && !state.statements.length && !state.warnings.length) return undefined;
  return state;
}

function readRegionRelevance(summary: Dict): RegionRelevance[] {
  const raw = summary.diagnosisRegionRelevance;
  if (!Array.isArray(raw)) return [];
  const entries: RegionRelevance[] = [];
  for (const item of raw) {
    const entry = asDict(item);
    if (!entry) continue;
    const diagnosis = str(entry.diagnosis) ?? str(entry.normalizedDiagnosis) ?? str(entry.sourceDiagnosis);
    if (!diagnosis) continue;
    entries.push({
      diagnosis,
      evidenceStrength: str(entry.evidenceStrength),
      status: str(entry.status),
      relationshipToThisRun: str(entry.relationshipToThisRun),
      reviewFocus: str(entry.reviewFocus),
      psychiatricReview: str(entry.psychiatricReview),
      regions: labelList(entry.regionsAndCircuits),
      findings: findingList(entry.measuredRegionalFindings),
    });
  }
  return entries;
}

const NORMATIVE_SCORE_KEYS: Array<[string, string]> = [
  ["zScore", "z"],
  ["z", "z"],
  ["score", "score"],
  ["centile", "centile"],
  ["percentile", "centile"],
  ["deviation", "deviation"],
  ["value", "value"],
];

function normativeResultRows(results: unknown): Row[] {
  const rows: Row[] = [];
  if (Array.isArray(results)) {
    for (const item of results) {
      const entry = asDict(item);
      if (!entry) continue;
      const label = str(entry.feature) ?? str(entry.region) ?? str(entry.name) ?? str(entry.measure) ?? str(entry.id);
      if (!label) continue;
      const parts: string[] = [];
      for (const [key, tag] of NORMATIVE_SCORE_KEYS) {
        const value = num(entry[key]);
        if (value !== undefined) parts.push(`${tag} ${value.toFixed(2)}`);
      }
      if (!parts.length) {
        for (const [key, value] of Object.entries(entry)) {
          const numeric = num(value);
          if (numeric !== undefined) parts.push(`${prettyLabel(key)} ${numeric.toFixed(2)}`);
          if (parts.length >= 3) break;
        }
      }
      if (parts.length) rows.push({ label, value: parts.join(" · ") });
      if (rows.length >= 40) break;
    }
    return rows;
  }
  return scalarRows(asDict(results), 40);
}

function readNormative(run: NeuroRun): NormativeReport | undefined {
  const outputs = readStageOutputs(run, "normative_model_apply");
  const raw = asDict(outputs?.normativeOutput);
  if (!raw) return undefined;
  const limitationsRaw = raw.modelLimitations;
  const normative: NormativeReport = {
    modelSource: str(raw.modelSource),
    modelVersion: str(raw.modelVersion),
    adapter: str(raw.adapter),
    status: str(raw.status),
    scoredFeatureCount: num(raw.scoredFeatureCount),
    matchedFeatureCount: num(raw.matchedFeatureCount),
    approvedModelCount: num(raw.approvedModelCount),
    inputRowCount: num(raw.inputRowCount),
    limitations: typeof limitationsRaw === "string" ? [limitationsRaw] : strList(limitationsRaw),
    resultRows: normativeResultRows(raw.results),
  };
  return normative;
}

function readSafety(summary: Dict): BackendReport["safety"] {
  const raw = asDict(summary.reportSafetyValidation);
  if (!raw) return undefined;
  return {
    passed: typeof raw.passed === "boolean" ? raw.passed : undefined,
    violations: strList(raw.violations),
  };
}

/** The backend-composed report content for a run, or null when the run predates it. */
export function readBackendReport(run: NeuroRun): BackendReport | null {
  const summary = reportSummary(run);
  if (!summary) return null;
  const longitudinalOutputs = readStageOutputs(run, "longitudinal_analysis");
  return {
    narrative: strList(summary.backendNarrative),
    synthesis: readSynthesis(summary),
    brainState: readBrainState(summary),
    regionRelevance: readRegionRelevance(summary),
    normative: readNormative(run),
    qcRows: scalarRows(asDict(summary.qc)),
    safety: readSafety(summary),
    longitudinalNote: str(longitudinalOutputs?.trendSummary),
  };
}

/** Report sections built from the backend's composed report (empty when the run has none). */
export function buildBackendReportSections(
  backend: BackendReport | null,
  regionalTable: RegionalVolumeTable | null,
): ReportSection[] {
  const sections: ReportSection[] = [];

  if (regionalTable?.largest.length) {
    sections.push({
      id: "regional-morphometry",
      title: "Regional morphometry",
      body: `Regional volumes from the structural segmentation, largest first. Showing ${regionalTable.largest.length} of ${regionalTable.total} measured regions.`,
      rows: regionalTable.largest.map((entry) => ({
        label: entry.region,
        value: `${(entry.volumeMm3 / 1000).toFixed(2)} mL`,
      })),
    });
  }

  if (backend?.normative) {
    const normative = backend.normative;
    const modelRows: Row[] = [];
    if (normative.modelSource) modelRows.push({ label: "Model source", value: normative.modelSource });
    if (normative.modelVersion) modelRows.push({ label: "Model version", value: normative.modelVersion });
    if (normative.adapter) modelRows.push({ label: "Adapter", value: normative.adapter });
    if (normative.status) modelRows.push({ label: "Status", value: normative.status });
    if (normative.scoredFeatureCount !== undefined) {
      modelRows.push({
        label: "Features scored",
        value:
          normative.matchedFeatureCount !== undefined
            ? `${normative.scoredFeatureCount} of ${normative.matchedFeatureCount} matched`
            : `${normative.scoredFeatureCount}`,
      });
    }
    if (normative.approvedModelCount !== undefined) {
      modelRows.push({ label: "Approved models", value: `${normative.approvedModelCount}` });
    }
    const blocks: ReportBlock[] = [];
    if (modelRows.length) blocks.push({ rows: modelRows });
    if (normative.resultRows.length) blocks.push({ heading: "Results", rows: normative.resultRows });
    if (normative.limitations.length) blocks.push({ heading: "Model limitations", bullets: normative.limitations });
    sections.push({
      id: "normative",
      title: "Normative scoring",
      tone: "info",
      body: "Deviation context from the normative model stage. Research-grade scores for clinician review, not diagnostic findings.",
      blocks,
    });
  }

  if (backend?.brainState) {
    const state = backend.brainState;
    const blocks: ReportBlock[] = [];
    if (state.clinicalMeaning) blocks.push({ paragraphs: [state.clinicalMeaning] });
    if (state.statements.length) blocks.push({ heading: "Statements", bullets: state.statements });
    if (state.warnings.length) blocks.push({ heading: "Warnings", bullets: state.warnings });
    sections.push({
      id: "brain-state",
      title: "Structural brain state",
      body: "The backend's structured summary of this run's structural state.",
      blocks,
    });
  }

  if (backend?.synthesis) {
    const synthesis = backend.synthesis;
    const blocks: ReportBlock[] = [];
    if (synthesis.summary) blocks.push({ paragraphs: [synthesis.summary] });
    if (synthesis.decisionSupport.length) {
      blocks.push({ heading: "Decision support", bullets: synthesis.decisionSupport });
    }
    for (const review of synthesis.diagnosisReviews) {
      const rows: Row[] = [];
      if (review.concordance) rows.push({ label: "Concordance", value: review.concordance });
      if (review.decisionUse) rows.push({ label: "Decision use", value: review.decisionUse });
      if (review.reviewImplications) rows.push({ label: "Review implications", value: review.reviewImplications });
      blocks.push({
        heading: review.framework ? `${review.diagnosis} — ${review.framework}` : review.diagnosis,
        paragraphs: review.clinicalReasoning ? [review.clinicalReasoning] : undefined,
        rows: rows.length ? rows : undefined,
      });
    }
    sections.push({
      id: "synthesis",
      title: "Psychiatric synthesis",
      tone: "info",
      body: "Composed by the backend from this run's measurements and the case's clinical context. Decision support only — it does not establish, confirm, or rule out any diagnosis.",
      blocks,
    });
  }

  if (backend?.regionRelevance.length) {
    const blocks: ReportBlock[] = [];
    for (const entry of backend.regionRelevance) {
      const rows: Row[] = [];
      if (entry.evidenceStrength) rows.push({ label: "Evidence strength", value: entry.evidenceStrength });
      if (entry.status) rows.push({ label: "Status", value: entry.status });
      if (entry.relationshipToThisRun) rows.push({ label: "Relationship to this run", value: entry.relationshipToThisRun });
      if (entry.reviewFocus) rows.push({ label: "Review focus", value: entry.reviewFocus });
      blocks.push({ heading: entry.diagnosis, rows: rows.length ? rows : undefined });
      if (entry.regions.length) {
        blocks.push({ heading: `${entry.diagnosis} — regions and circuits`, bullets: entry.regions });
      }
      if (entry.findings.length) {
        blocks.push({ heading: `${entry.diagnosis} — measured findings`, bullets: entry.findings });
      }
      if (entry.psychiatricReview) {
        blocks.push({ heading: `${entry.diagnosis} — psychiatric review`, paragraphs: [entry.psychiatricReview] });
      }
    }
    sections.push({
      id: "region-relevance",
      title: "Diagnosis–region relevance",
      body: "How this run's measured regions relate to the diagnoses in the case context, per the backend's review. Context for clinician judgment, not evidence for or against a diagnosis.",
      blocks,
    });
  }

  if (backend?.narrative.length) {
    sections.push({
      id: "narrative",
      title: "Report narrative",
      body: "Narrative composed by the backend alongside the structured summary.",
      blocks: [{ paragraphs: backend.narrative }],
    });
  }

  if (backend?.longitudinalNote) {
    sections.push({
      id: "longitudinal",
      title: "Longitudinal note",
      body: backend.longitudinalNote,
    });
  }

  if (backend?.safety) {
    const safety = backend.safety;
    const rows: Row[] = [
      {
        label: "Safety validation",
        value: safety.passed === undefined ? "Recorded" : safety.passed ? "Passed" : "Failed",
      },
      ...safety.violations.map((violation, index) => ({ label: `Violation ${index + 1}`, value: violation })),
    ];
    sections.push({
      id: "safety",
      title: "Safety validation",
      tone: safety.violations.length || safety.passed === false ? "caution" : "info",
      body: safety.violations.length
        ? "The backend's safety validation recorded the following violations for this report."
        : "The backend's safety validation recorded no violations for this report.",
      rows,
    });
  }

  return sections;
}
