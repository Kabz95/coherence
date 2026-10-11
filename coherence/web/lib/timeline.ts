import { getMockClinicalContext } from "./mock-data";
import type { ClinicalContext, NeuroRun, PatientCase, TimelineEvent } from "./types";

function medicationTitle(name: string, dose?: string, startDate?: string, endDate?: string): string {
  const dosePart = dose ? ` ${dose}` : "";
  if (startDate && endDate) return `${name}${dosePart} — ${startDate} to ${endDate}`;
  if (startDate) return `${name}${dosePart} started ${startDate}`;
  return `${name}${dosePart}`;
}

/**
 * Builds a case's longitudinal timeline from runs and clinician-entered
 * clinical context, newest first. Clinical context may come from the newest
 * run carrying it (Firestore path) or from the demo seed (demo mode).
 */
export function buildCaseTimeline(
  patientCase: PatientCase,
  runs: NeuroRun[],
  clinicalContext?: ClinicalContext,
): TimelineEvent[] {
  const context: ClinicalContext | undefined =
    clinicalContext ??
    [...runs]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((run) => run.clinicalContext)
      .find(Boolean) ??
    getMockClinicalContext(patientCase.id);

  const events: TimelineEvent[] = [
    {
      id: `${patientCase.id}-created`,
      caseId: patientCase.id,
      kind: "case_created",
      title: `Case ${patientCase.displayName} created`,
      detail: patientCase.notes,
      date: patientCase.createdAt,
      source: "system",
    },
  ];

  for (const run of runs) {
    events.push({
      id: `${run.id}-run`,
      caseId: patientCase.id,
      kind: "run",
      title: `Structural MRI run — ${run.status}`,
      detail: `${run.inputFiles.length} input file(s) · ${run.currentStage}`,
      date: run.createdAt,
      runId: run.id,
      source: "pipeline",
    });
  }

  if (context) {
    for (const medication of context.medications) {
      events.push({
        id: `${patientCase.id}-med-${medication.name}-${medication.startDate ?? "nodate"}`,
        caseId: patientCase.id,
        kind: "medication",
        title: medicationTitle(medication.name, medication.dose, medication.startDate, medication.endDate),
        detail: medication.notes,
        date: medication.startDate ? `${medication.startDate}T00:00:00.000Z` : patientCase.createdAt,
        source: "clinician",
      });
    }

    for (const scale of context.symptomScales) {
      events.push({
        id: `${patientCase.id}-scale-${scale.name}-${scale.date ?? "nodate"}`,
        caseId: patientCase.id,
        kind: "symptom_scale",
        title: `${scale.name}: ${scale.score ?? "not scored"}`,
        detail: scale.notes,
        date: scale.date ? `${scale.date}T00:00:00.000Z` : patientCase.createdAt,
        source: "clinician",
      });
    }

    for (const therapy of context.therapies) {
      events.push({
        id: `${patientCase.id}-therapy-${therapy.type}-${therapy.startDate ?? "nodate"}`,
        caseId: patientCase.id,
        kind: "therapy",
        title: `${therapy.type}${therapy.frequency ? ` — ${therapy.frequency}` : ""}`,
        detail: therapy.notes,
        date: therapy.startDate ? `${therapy.startDate}T00:00:00.000Z` : patientCase.createdAt,
        source: "clinician",
      });
    }

    for (const note of context.notes ?? []) {
      events.push({
        id: note.id,
        caseId: patientCase.id,
        kind: "note",
        title: note.author ? `Note — ${note.author}` : "Clinician note",
        detail: note.body,
        date: note.date.includes("T") ? note.date : `${note.date}T00:00:00.000Z`,
        source: "clinician",
      });
    }
  }

  return events.sort((a, b) => b.date.localeCompare(a.date));
}

/** Groups symptom-scale entries by scale name, oldest first, for trend views. */
export function groupSymptomScales(context?: ClinicalContext): Array<{ name: string; points: Array<{ date: string; score: string; notes?: string }> }> {
  if (!context) return [];
  const groups = new Map<string, Array<{ date: string; score: string; notes?: string }>>();
  for (const scale of context.symptomScales) {
    const list = groups.get(scale.name) ?? [];
    list.push({ date: scale.date ?? "", score: scale.score ?? "—", notes: scale.notes });
    groups.set(scale.name, list);
  }
  return [...groups.entries()].map(([name, points]) => ({
    name,
    points: points.sort((a, b) => a.date.localeCompare(b.date)),
  }));
}
