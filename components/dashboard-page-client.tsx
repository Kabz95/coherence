"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { CaseCard } from "@/components/case-card";
import { DisclaimerBanner } from "@/components/disclaimer-banner";
import { StatusChip } from "@/components/status-chip";
import { EmptyState } from "@/components/ui/state";
import { listPatientCases } from "@/lib/cases";
import { listRecentRuns } from "@/lib/runs";
import type { NeuroRun, PatientCase } from "@/lib/types";
import { ProgressBar } from "./progress-bar";

/**
 * Dashboard data must load in the browser, like the Cases page does.
 * The dashboard used to be a server component that called listPatientCases()
 * / listRecentRuns() during server rendering, where those helpers return []
 * (their browser-only guard), so the dashboard always rendered "No cases yet"
 * / "No runs yet" even when cases existed. Loading here runs with the
 * signed-in user's Firestore session, so the counters match the Cases page.
 */
export function DashboardPageClient() {
  const [cases, setCases] = useState<PatientCase[]>([]);
  const [runs, setRuns] = useState<NeuroRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [nextCases, nextRuns] = await Promise.all([listPatientCases(), listRecentRuns()]);
        if (!mounted) return;
        setCases(nextCases);
        setRuns(nextRuns);
      } catch (nextError) {
        if (mounted) setError(nextError instanceof Error ? nextError.message : "Unable to load dashboard.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <DisclaimerBanner compact />
        <ProgressBar label="Loading dashboard" detail="Fetching cases and runs" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <DisclaimerBanner compact />
        <div className="rounded-lg border border-rose-300/30 bg-rose-300/10 p-5 text-sm text-rose-100">{error}</div>
      </div>
    );
  }

  const running = runs.filter((run) => run.status === "running").length;
  const completed = runs.filter((run) => run.status === "completed").length;

  return (
    <div className="space-y-6">
      <DisclaimerBanner compact />
      <section className="grid gap-4 md:grid-cols-4">
        {[
          ["Cases", cases.length],
          ["Runs", runs.length],
          ["Running", running],
          ["Completed", completed]
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-line bg-panel/75 p-5">
            <div className="text-sm text-slate-400">{label}</div>
            <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
          </div>
        ))}
      </section>
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Recent cases</h2>
            <Link href="/cases" className="text-sm text-cyan-200">View all</Link>
          </div>
          <div className="grid gap-4">
            {cases.slice(0, 3).map((patientCase) => (
              <CaseCard key={patientCase.id} patientCase={patientCase} latestRun={runs.find((run) => run.caseId === patientCase.id)} />
            ))}
            {cases.length === 0 ? (
              <EmptyState
                title="No cases yet"
                body="Create your first patient case to organize clinical context and imaging runs."
                icon={<FolderOpen className="h-8 w-8" />}
                action={
                  <Link
                    href="/cases"
                    className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
                  >
                    Go to cases
                  </Link>
                }
              />
            ) : null}
          </div>
        </section>
        <section className="rounded-lg border border-line bg-panel/75 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">Recent runs</h2>
            <Link href="/upload" className="rounded-md bg-cyan-300 px-3 py-2 text-sm font-medium text-slate-950">Upload data</Link>
          </div>
          <div className="mt-4 divide-y divide-white/10">
            {runs.map((run) => (
              <Link key={run.id} href={`/cases/${run.caseId}/runs/${run.id}`} className="flex items-center justify-between gap-3 py-4">
                <div>
                  <div className="font-medium text-white">{run.id}</div>
                  <div className="mt-1 text-sm capitalize text-slate-400">{run.modality.replace("_", " ")}</div>
                </div>
                <StatusChip status={run.status} />
              </Link>
            ))}
            {runs.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No runs yet. Upload data to create the first run.</p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
