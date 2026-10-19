"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileQuestion,
  FolderOpen,
  LineChart,
  Plus,
  Upload,
} from "lucide-react";
import { CaseCard } from "@/components/case-card";
import { DisclaimerBanner } from "@/components/disclaimer-banner";
import { EmptyState } from "@/components/ui/state";
import { listPatientCases } from "@/lib/cases";
import { listRecentRuns } from "@/lib/runs";
import type { NeuroRun, PatientCase } from "@/lib/types";
import { ProgressBar } from "./progress-bar";

interface AttentionItem {
  key: string;
  title: string;
  detail: string;
  href: string;
  action: string;
}

interface ActivityItem {
  key: string;
  date: string;
  label: string;
  href: string;
  kind: "case" | "question" | "scale" | "run";
}

function formatDate(value: string): string {
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function runQcFlags(run: NeuroRun): string[] {
  const structural = run.outputs?.structural as { qcFlags?: unknown } | undefined;
  return Array.isArray(structural?.qcFlags)
    ? structural.qcFlags.filter((flag): flag is string => typeof flag === "string")
    : [];
}

function buildAttention(cases: PatientCase[], runs: NeuroRun[]): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const patientCase of cases) {
    if (!patientCase.referralQuestion) {
      items.push({
        key: `${patientCase.id}-question`,
        title: patientCase.displayName,
        detail: "No referral question recorded",
        href: `/cases/${patientCase.id}/edit`,
        action: "Record question",
      });
    }
    const scales = patientCase.clinicalContext?.symptomScales ?? [];
    if (scales.length === 0) {
      items.push({
        key: `${patientCase.id}-scales`,
        title: patientCase.displayName,
        detail: "No scale administrations yet",
        href: `/cases/${patientCase.id}?tab=scales`,
        action: "Record scale",
      });
    }
  }
  for (const run of runs) {
    const flags = runQcFlags(run);
    if (run.status === "failed") {
      const stageError = run.stages.find((stage) => stage.status === "failed")?.error;
      items.push({
        key: `${run.id}-failed`,
        title: `Run ${run.id}`,
        detail: stageError ?? "Run failed",
        href: `/cases/${run.caseId}/runs/${run.id}`,
        action: "Review run",
      });
    } else if (flags.length > 0) {
      items.push({
        key: `${run.id}-qc`,
        title: `Run ${run.id}`,
        detail: `${flags.length} QC flag${flags.length === 1 ? "" : "s"}: ${flags.slice(0, 2).join("; ")}${flags.length > 2 ? "…" : ""}`,
        href: `/cases/${run.caseId}/runs/${run.id}`,
        action: "Review flags",
      });
    }
  }
  return items;
}

function buildActivity(cases: PatientCase[], runs: NeuroRun[]): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const patientCase of cases) {
    items.push({
      key: `${patientCase.id}-created`,
      date: patientCase.createdAt,
      label: `Case ${patientCase.displayName} created`,
      href: `/cases/${patientCase.id}`,
      kind: "case",
    });
    if (patientCase.referralQuestion) {
      items.push({
        key: `${patientCase.id}-question`,
        date: patientCase.referralQuestion.date,
        label: `Referral question recorded for ${patientCase.displayName}`,
        href: `/cases/${patientCase.id}?tab=timeline`,
        kind: "question",
      });
    }
    for (const scale of patientCase.clinicalContext?.symptomScales ?? []) {
      items.push({
        key: `${patientCase.id}-scale-${scale.name}-${scale.date ?? "nodate"}-${scale.score ?? "partial"}`,
        date: scale.date ? `${scale.date}T00:00:00` : patientCase.createdAt,
        label: `${scale.name}${scale.score !== undefined ? ` ${scale.score}` : " (partial)"} recorded for ${patientCase.displayName}`,
        href: `/cases/${patientCase.id}?tab=scales`,
        kind: "scale",
      });
    }
  }
  for (const run of runs) {
    if (run.status === "completed") {
      items.push({
        key: `${run.id}-completed`,
        date: run.updatedAt,
        label: `Run ${run.id} completed`,
        href: `/cases/${run.caseId}/runs/${run.id}`,
        kind: "run",
      });
    }
  }
  return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
}

const activityIcon = {
  case: FolderOpen,
  question: FileQuestion,
  scale: LineChart,
  run: CheckCircle2,
} as const;

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

  const attention = useMemo(() => buildAttention(cases, runs), [cases, runs]);
  const activity = useMemo(() => buildActivity(cases, runs), [cases, runs]);

  const counters = useMemo(() => {
    const questions = cases.filter((patientCase) => patientCase.referralQuestion).length;
    const scales = cases.reduce(
      (total, patientCase) => total + (patientCase.clinicalContext?.symptomScales?.length ?? 0),
      0
    );
    const completedRuns = runs.filter((run) => run.status === "completed").length;
    return [
      { label: "Active cases", value: cases.length },
      { label: "Referral questions", value: questions },
      { label: "Scale administrations", value: scales },
      { label: "Runs completed", value: completedRuns },
    ];
  }, [cases, runs]);

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

  return (
    <div className="space-y-6">
      <DisclaimerBanner compact />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Clinical overview</h1>
          <p className="text-sm text-slate-400">What needs attention, and what changed recently.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/cases"
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
          >
            <Plus className="h-4 w-4" aria-hidden /> New case
          </Link>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
          >
            <Upload className="h-4 w-4" aria-hidden /> Register data
          </Link>
        </div>
      </div>

      {cases.length === 0 ? (
        <EmptyState
          title="No cases yet"
          body="Create your first patient case to organize clinical context, scales, and imaging runs."
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
      ) : (
        <>
          {attention.length > 0 ? (
            <section className="rounded-lg border border-amber-300/20 bg-amber-300/[0.04] p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-amber-200">
                <AlertCircle className="h-4 w-4" aria-hidden /> Needs attention
              </h2>
              <ul className="mt-3 divide-y divide-white/5">
                {attention.map((item) => (
                  <li key={item.key} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{item.title}</p>
                      <p className="text-xs text-slate-400">{item.detail}</p>
                    </div>
                    <Link
                      href={item.href}
                      className="inline-flex items-center gap-1 rounded-md border border-amber-300/25 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-300/10"
                    >
                      {item.action} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="flex items-center gap-2 text-sm text-emerald-200/80">
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Nothing needs attention right now.
            </p>
          )}

          <section className="grid gap-4 md:grid-cols-4">
            {counters.map((counter) => (
              <div key={counter.label} className="rounded-lg border border-line bg-panel/75 p-5">
                <div className="text-sm text-slate-400">{counter.label}</div>
                <div className="mt-3 text-3xl font-semibold text-white">{counter.value}</div>
              </div>
            ))}
          </section>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Recent cases</h2>
                <Link href="/cases" className="text-sm text-cyan-200">
                  View all
                </Link>
              </div>
              <div className="grid gap-4">
                {cases.slice(0, 3).map((patientCase) => (
                  <CaseCard
                    key={patientCase.id}
                    patientCase={patientCase}
                    latestRun={runs.find((run) => run.caseId === patientCase.id)}
                  />
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-line bg-panel/75 p-5">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                <ClipboardList className="h-5 w-5" aria-hidden /> Recent activity
              </h2>
              {activity.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400">No clinical activity recorded yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-white/10">
                  {activity.map((item) => {
                    const Icon = activityIcon[item.kind];
                    return (
                      <li key={item.key}>
                        <Link href={item.href} className="flex items-center gap-3 py-3 hover:bg-white/[0.02]">
                          <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                          <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{item.label}</span>
                          <span className="shrink-0 text-xs text-slate-500">{formatDate(item.date)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
