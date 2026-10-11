"use client";

import { useEffect, useState } from "react";
import { CaseCard } from "@/components/case-card";
import { CreateCaseForm } from "@/components/create-case-form";
import { deletePatientCase, listPatientCases } from "@/lib/cases";
import { listRecentRuns } from "@/lib/runs";
import type { NeuroRun, PatientCase } from "@/lib/types";
import { ProgressBar } from "./progress-bar";

export function CasesPageClient() {
  const [cases, setCases] = useState<PatientCase[]>([]);
  const [runs, setRuns] = useState<NeuroRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingCaseId, setDeletingCaseId] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [nextCases, nextRuns] = await Promise.all([listPatientCases(), listRecentRuns()]);
        if (!mounted) return;
        setCases(nextCases);
        setRuns(nextRuns);
      } catch (nextError) {
        if (mounted) setError(nextError instanceof Error ? nextError.message : "Unable to load cases.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleDeleteCase(caseId: string, displayName: string) {
    const confirmed = window.confirm(`Delete ${displayName}? This also deletes its run documents and uploaded run input files where accessible.`);
    if (!confirmed) return;

    setDeletingCaseId(caseId);
    setError("");

    try {
      await deletePatientCase(caseId);
      setCases((current) => current.filter((patientCase) => patientCase.id !== caseId));
      setRuns((current) => current.filter((run) => run.caseId !== caseId));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to delete case.");
    } finally {
      setDeletingCaseId("");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
      <section className="rounded-lg border border-line bg-panel/75 p-5">
        <h2 className="text-lg font-semibold text-white">Create case</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">Create a patient case shell for clinician-entered context and future processing runs.</p>
        <CreateCaseForm />
      </section>
      <section>
        <h1 className="mb-4 text-2xl font-semibold text-white">Patient cases</h1>
        {loading ? <ProgressBar label="Loading cases" detail="Fetching Firestore records" /> : null}
        {error ? <div className="rounded-lg border border-rose-300/30 bg-rose-300/10 p-5 text-sm text-rose-100">{error}</div> : null}
        <div className="grid gap-4">
          {cases.map((patientCase) => (
            <div key={patientCase.id} className="relative">
              <CaseCard patientCase={patientCase} latestRun={runs.find((run) => run.caseId === patientCase.id)} />
              <button
                type="button"
                onClick={() => handleDeleteCase(patientCase.id, patientCase.displayName)}
                disabled={deletingCaseId === patientCase.id}
                className="absolute bottom-4 right-4 rounded-md border border-rose-300/35 bg-rose-300/10 px-3 py-1.5 text-xs font-medium text-rose-100 hover:bg-rose-300/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingCaseId === patientCase.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          ))}
        </div>
        {deletingCaseId ? <div className="mt-4"><ProgressBar label="Deleting case" detail="Removing related runs" /></div> : null}
      </section>
    </div>
  );
}
