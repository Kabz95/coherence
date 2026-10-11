"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LongitudinalPanel } from "@/components/longitudinal-panel";
import { StatusChip } from "@/components/status-chip";
import { ProgressBar } from "@/components/progress-bar";
import { clinicianEnteredDiagnosisCopy } from "@/lib/clinical-copy";
import { deletePatientCase, getPatientCase } from "@/lib/cases";
import { listRunsForCase } from "@/lib/runs";
import type { ClinicalContext, NeuroRun, PatientCase } from "@/lib/types";

export function CaseDetailClient({ caseIdOverride }: { caseIdOverride?: string }) {
  const router = useRouter();
  const params = useParams<{ caseId: string }>();
  const caseId = caseIdOverride ?? params.caseId;
  const [patientCase, setPatientCase] = useState<PatientCase | null>(null);
  const [runs, setRuns] = useState<NeuroRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [nextCase, nextRuns] = await Promise.all([getPatientCase(caseId), listRunsForCase(caseId)]);
        if (!mounted) return;
        setPatientCase(nextCase);
        setRuns(nextRuns);
      } catch (nextError) {
        if (mounted) {
          setError(nextError instanceof Error ? nextError.message : "Unable to load case.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [caseId]);

  if (loading) return <ProgressBar label="Loading case" detail="Fetching case and runs" />;

  if (error || !patientCase) {
    return <div className="rounded-lg border border-rose-300/30 bg-rose-300/10 p-5 text-sm text-rose-100">{error || "Case not found."}</div>;
  }

  const context = runs[0]?.clinicalContext;

  async function handleDeleteCase() {
    if (!patientCase) return;
    const confirmed = window.confirm(`Delete ${patientCase.displayName}? This also deletes its run documents and uploaded run input files where accessible.`);
    if (!confirmed) return;

    setDeleting(true);
    setError("");

    try {
      await deletePatientCase(caseId);
      router.push("/cases");
      router.refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to delete case.");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line bg-panel/75 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">{patientCase.displayName}</h1>
            <p className="mt-2 text-sm text-slate-300">Birth year: {patientCase.birthYear ?? "omitted"} - Sex: {patientCase.sex ?? "not specified"}</p>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{patientCase.notes ?? "No case notes entered."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/upload" className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-medium text-slate-950">Start new run</Link>
            <button
              type="button"
              onClick={handleDeleteCase}
              disabled={deleting}
              className="rounded-md border border-rose-300/35 bg-rose-300/10 px-4 py-2 text-sm font-medium text-rose-100 hover:bg-rose-300/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete case"}
            </button>
          </div>
        </div>
        {deleting ? <div className="mt-4"><ProgressBar label="Deleting case" detail="Removing case, runs, and accessible input files" /></div> : null}
      </section>
      <section className="rounded-lg border border-line bg-panel/75 p-5">
        <h2 className="text-lg font-semibold text-white">Clinical context</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">{clinicianEnteredDiagnosisCopy}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <ContextList title="Established diagnoses" items={context?.establishedDiagnoses ?? []} />
          <ContextList title="Medications" items={formatMedications(context)} />
          <ContextList title="Therapies" items={(context?.therapies ?? []).map((item) => item.type)} />
          <ContextList title="Symptom scales" items={(context?.symptomScales ?? []).map((item) => `${item.name}${item.score ? `: ${item.score}` : ""}`)} />
        </div>
      </section>
      <LongitudinalPanel />
      <section className="rounded-lg border border-line bg-panel/75 p-5">
        <h2 className="text-lg font-semibold text-white">Runs</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr><th className="py-2 pr-4">Run</th><th className="py-2 pr-4">Modality</th><th className="py-2 pr-4">Stage</th><th className="py-2 pr-4">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {runs.length ? runs.map((run) => (
                <tr key={run.id}>
                  <td className="py-3 pr-4"><Link href={`/cases/${caseId}/runs/${run.id}`} className="text-cyan-200">{run.id}</Link></td>
                  <td className="py-3 pr-4 capitalize text-slate-300">{run.modality.replace("_", " ")}</td>
                  <td className="py-3 pr-4 text-slate-300">{run.currentStage}</td>
                  <td className="py-3 pr-4"><StatusChip status={run.status} /></td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="py-6 text-center text-slate-400">No runs for this case yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function formatMedications(context?: ClinicalContext): string[] {
  return (context?.medications ?? []).map((item) => `${item.name}${item.dose ? `, ${item.dose}` : ""}`);
}

function ContextList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-sm font-medium text-white">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm text-slate-300">
        {items.length ? items.map((item) => <li key={item}>{item}</li>) : <li className="text-slate-500">No entries</li>}
      </ul>
    </div>
  );
}
