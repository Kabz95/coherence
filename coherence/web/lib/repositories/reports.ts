import { getNeuroRun, listRunsForCase } from "../runs";
import type { NeuroRun, PatientCase } from "../types";

export interface CaseReport {
  run: NeuroRun;
  patientCaseId: string;
}

/**
 * Reports are derived from runs: a report exists wherever a run carries a
 * report summary. This keeps one write path (the run document) and avoids a
 * second source of truth.
 */
export async function getReportForRun(runId: string): Promise<CaseReport | null> {
  const run = await getNeuroRun(runId);
  if (!run || !run.report) return null;
  return { run, patientCaseId: run.caseId };
}

export async function listReportsForCase(caseId: string): Promise<CaseReport[]> {
  const runs = await listRunsForCase(caseId);
  return runs
    .filter((run) => run.report)
    .map((run) => ({ run, patientCaseId: run.caseId }));
}

export function reportTitle(run: NeuroRun, patientCase?: PatientCase | null): string {
  const caseLabel = patientCase?.displayName ?? run.caseId;
  const date = run.report?.generatedAt?.slice(0, 10) ?? run.createdAt.slice(0, 10);
  return `Structural report — ${caseLabel} — ${date}`;
}
