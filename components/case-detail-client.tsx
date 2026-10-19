"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, FileText, FlaskConical, Plus, Stethoscope } from "lucide-react";
import { getPatientCase } from "@/lib/cases";
import { getMockClinicalContext } from "@/lib/mock-data";
import { appendClinicalNoteToRun, listRunsForCase } from "@/lib/runs";
import { buildCaseTimeline } from "@/lib/timeline";
import type { ClinicalContext, ClinicalNote, NeuroRun, PatientCase } from "@/lib/types";
import { ClinicalContextPanel } from "./cases/clinical-context-panel";
import { ClinicalNotesPanel } from "./cases/clinical-notes-panel";
import { LongitudinalComparison } from "./cases/longitudinal-comparison";
import { CaseTimeline } from "./timeline/case-timeline";
import { MedicationTimeline } from "./timeline/medication-timeline";
import { SymptomScaleTimeline } from "./timeline/symptom-scale-timeline";
import { StatusChip } from "./status-chip";
import { EmptyState, ErrorState } from "./ui/state";
import { ProgressBar } from "./progress-bar";

const TABS = [
  { id: "overview", label: "Overview", icon: FileText },
  { id: "timeline", label: "Timeline", icon: CalendarDays },
  { id: "clinical", label: "Clinical context", icon: Stethoscope },
  { id: "longitudinal", label: "Longitudinal", icon: FlaskConical },
] as const;

type TabId = (typeof TABS)[number]["id"];

function resolveContext(patientCase: PatientCase, runs: NeuroRun[]): ClinicalContext | undefined {
  // Case-level context is the canonical source (editable). Runs carry a
  // snapshot taken at creation, so fall back to the newest run's context
  // for cases created before case-level capture existed. Clinician notes
  // are still attached to runs by the notes feature, so they are merged
  // into the view rather than hidden behind the case-level record.
  const runContext = [...runs]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((run) => run.clinicalContext)
    .find(Boolean);
  const caseContext = patientCase.clinicalContext;
  if (!caseContext) return runContext ?? getMockClinicalContext(patientCase.id);
  const runNotes = runContext?.notes ?? [];
  if (!runNotes.length) return caseContext;
  return { ...caseContext, notes: [...(caseContext.notes ?? []), ...runNotes] };
}

export function CaseDetailClient({ caseId }: { caseId: string }) {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabId) || "overview";
  const focusRunId = searchParams.get("focusRun") ?? undefined;

  const [tab, setTab] = useState<TabId>(TABS.some((t) => t.id === initialTab) ? initialTab : "overview");
  const [patientCase, setPatientCase] = useState<PatientCase | null>(null);
  const [runs, setRuns] = useState<NeuroRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [noteRefresh, setNoteRefresh] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextCase, nextRuns] = await Promise.all([getPatientCase(caseId), listRunsForCase(caseId)]);
      setPatientCase(nextCase);
      setRuns(nextRuns);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load case.");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load, noteRefresh]);

  const context = useMemo(() => (patientCase ? resolveContext(patientCase, runs) : undefined), [patientCase, runs]);
  const events = useMemo(
    () => (patientCase ? buildCaseTimeline(patientCase, runs, context) : []),
    [patientCase, runs, context],
  );
  const contextRunId = useMemo(
    () =>
      [...runs]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .find((run) => run.clinicalContext)?.id,
    [runs],
  );

  async function handleAddNote(body: string) {
    if (!contextRunId) throw new Error("No run with clinical context is available to attach the note to.");
    const note: ClinicalNote = {
      id: `note-${Date.now()}`,
      date: new Date().toISOString(),
      author: "Clinician",
      body,
    };
    await appendClinicalNoteToRun(contextRunId, note);
    setNoteRefresh((value) => value + 1);
  }

  if (loading) return <ProgressBar label="Loading case" detail="Fetching case record and runs" />;
  if (error) return <ErrorState body={error} onRetry={load} />;
  if (!patientCase) {
    return (
      <EmptyState
        title="Case not found"
        body="This case could not be loaded. It may have been deleted."
        action={
          <Link href="/cases" className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/10">
            Back to cases
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/20">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <p className="text-sm text-cyan-200">Patient case</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">{patientCase.displayName}</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              {patientCase.notes ?? "Clinician-entered context, neuro-data runs, longitudinal monitoring, and report access."}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Diagnoses shown here are clinical context entered by a clinician, not generated by Coherence.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Link
              href={`/cases/${patientCase.id}/edit`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 hover:border-cyan-300/40"
            >
              Edit case
            </Link>
            <Link
              href={`/upload?caseId=${patientCase.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
            >
              <Plus className="h-4 w-4" />
              Start new run
            </Link>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Case sections">
          {TABS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm ${
                  tab === item.id
                    ? "border-cyan-300 bg-cyan-300/15 text-cyan-50"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-cyan-300/40"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "overview" ? (
        <div className="space-y-6">
          <ClinicalContextPanel context={context} />
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Runs ({runs.length})</h3>
              <Link href={`/upload?caseId=${patientCase.id}`} className="text-sm text-cyan-200 hover:text-cyan-100">
                + New run
              </Link>
            </div>
            {runs.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="No runs yet"
                  body="Create the first structural MRI run for this case to begin pipeline processing and longitudinal tracking."
                  action={
                    <Link
                      href={`/upload?caseId=${patientCase.id}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
                    >
                      <Plus className="h-4 w-4" />
                      Start new run
                    </Link>
                  }
                />
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {runs.map((run) => (
                  <li key={run.id}>
                    <Link
                      href={`/cases/${patientCase.id}/runs/${run.id}`}
                      className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/25 p-4 hover:border-cyan-300/40"
                    >
                      <div>
                        <div className="font-medium text-white">{run.id}</div>
                        <div className="mt-1 text-sm capitalize text-slate-400">
                          {run.modality.replace(/_/g, " ")} · {run.createdAt.slice(0, 10)} · {run.inputFiles.length} file(s)
                        </div>
                      </div>
                      <StatusChip status={run.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {tab === "timeline" ? (
        <div className="space-y-6">
          <CaseTimeline events={events} caseId={patientCase.id} />
          <MedicationTimeline medications={context?.medications ?? []} />
          <SymptomScaleTimeline context={context} />
        </div>
      ) : null}

      {tab === "clinical" ? (
        <div className="space-y-6">
          <ClinicalContextPanel context={context} />
          <ClinicalNotesPanel notes={context?.notes ?? []} onAddNote={contextRunId ? handleAddNote : undefined} />
        </div>
      ) : null}

      {tab === "longitudinal" ? (
        <LongitudinalComparison runs={runs} caseId={patientCase.id} focusRunId={focusRunId} />
      ) : null}
    </div>
  );
}

export default CaseDetailClient;
