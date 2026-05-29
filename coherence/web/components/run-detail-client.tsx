"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Brain, FileText, GitBranch, Radio, TimerReset } from "lucide-react";
import { calculatePipelineProgress, formatDuration } from "@/lib/pipeline-progress";
import { getNeuroRun } from "@/lib/runs";
import type { NeuroRun } from "@/lib/types";
import { ProgressBar } from "./progress-bar";
import { RunTimeline } from "./run-timeline";

type RunDetailClientProps = {
  caseId?: string;
  runId?: string;
};

function orchestrationLabel(run: NeuroRun | null): string {
  if (!run) return "Loading run state";
  if (run.status === "queued") return "Pipeline queued";
  if (run.status === "running") return "Pipeline orchestrating jobs";
  if (run.status === "completed") return "Pipeline complete";
  if (run.status === "failed") return "Pipeline needs attention";
  return "Pipeline ready";
}

function useNow(intervalMs = 15000) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return nowMs;
}

export function RunDetailClient({ caseId: caseIdOverride, runId: runIdOverride }: RunDetailClientProps) {
  const params = useParams<{ caseId?: string; runId?: string }>();
  const routeCaseId = Array.isArray(params.caseId) ? params.caseId[0] : params.caseId;
  const routeRunId = Array.isArray(params.runId) ? params.runId[0] : params.runId;
  const caseId = caseIdOverride && caseIdOverride !== "_" ? caseIdOverride : routeCaseId ?? "";
  const runId = runIdOverride && runIdOverride !== "_" ? runIdOverride : routeRunId ?? "";
  const [run, setRun] = useState<NeuroRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const nowMs = useNow();
  const visibleStages = useMemo(() => run?.stages ?? [], [run]);
  const progress = useMemo(() => calculatePipelineProgress(visibleStages, nowMs), [visibleStages, nowMs]);
  const shouldPoll = run?.status === "queued" || run?.status === "running" || run?.status === "uploaded";

  const loadRun = useCallback(async (showLoading = false) => {
    if (!runId) {
      setLoading(false);
      return;
    }

    if (showLoading) setLoading(true);
    try {
      const nextRun = await getNeuroRun(runId);
      setRun(nextRun);
      setError("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load run.");
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    loadRun(true);
  }, [loadRun]);

  useEffect(() => {
    if (!shouldPoll) return;
    const timer = window.setInterval(() => loadRun(false), 10000);
    return () => window.clearInterval(timer);
  }, [loadRun, shouldPoll]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/20">
        <p className="text-sm text-cyan-200">Run detail</p>
        <h2 className="mt-1 text-2xl font-semibold text-white">{runId}</h2>
        <p className="mt-2 text-sm text-slate-300">
          Case: <span className="text-white">{caseId}</span>
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/reports/${runId}`}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
          >
            <FileText className="h-4 w-4" />
            View report
          </Link>

          <Link
            href={`/cases/${caseId}`}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
          >
            Back to case
          </Link>
        </div>
      </div>

      {loading ? <ProgressBar label="Loading run" detail="Fetching pipeline state" /> : null}
      {error ? <div className="rounded-lg border border-rose-300/30 bg-rose-300/10 p-5 text-sm text-rose-100">{error}</div> : null}

      <section className="rounded-lg border border-cyan-300/20 bg-panel/80 p-5">
        <p className="text-sm text-cyan-200">Pipeline orchestrator</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">{orchestrationLabel(run)}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
              The orchestrator coordinates the run and advances the backend jobs below in sequence. It is not counted as one of the clinical processing jobs.
            </p>
          </div>
          <div className="grid gap-1 text-right text-sm">
            <span className="text-2xl font-semibold text-white">{progress.percent}%</span>
            <span className="text-slate-400">
              {progress.completedSteps}/{progress.totalSteps} jobs complete
            </span>
          </div>
        </div>

        <div className="mt-5">
          <div className="h-3 overflow-hidden rounded-full border border-white/10 bg-white/[0.05]">
            <div
              className="h-full rounded-full bg-cyan-300 transition-all duration-500"
              style={{ width: `${progress.percent}%` }}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress.percent}
              aria-label="Estimated whole pipeline progress"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
            <span>Active job: {progress.activeStep?.stage.label ?? run?.currentStage ?? "None"}</span>
            <span className="inline-flex items-center gap-2 text-cyan-100">
              <TimerReset className="h-4 w-4" />
              Estimated remaining: {formatDuration(progress.remainingSeconds)}
            </span>
          </div>
        </div>
      </section>

      {run ? <RunTimeline stages={visibleStages} /> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <Brain className="h-5 w-5 text-cyan-200" />
          <h3 className="mt-3 font-semibold text-white">2D MRI</h3>
          <p className="mt-2 text-sm text-slate-400">Preview panel placeholder.</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <Activity className="h-5 w-5 text-violet-200" />
          <h3 className="mt-3 font-semibold text-white">3D MRI</h3>
          <p className="mt-2 text-sm text-slate-400">NiiVue-ready placeholder.</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <GitBranch className="h-5 w-5 text-amber-200" />
          <h3 className="mt-3 font-semibold text-white">Diffusion</h3>
          <p className="mt-2 text-sm text-slate-400">Connectome placeholder.</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <Radio className="h-5 w-5 text-emerald-200" />
          <h3 className="mt-3 font-semibold text-white">EEG</h3>
          <p className="mt-2 text-sm text-slate-400">Trace/spectrogram placeholder.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
        Coherence provides supplementary, non-diagnostic neuroimaging and
        neurophysiology summaries for clinician review. It does not establish,
        confirm, predict, or rule out any DSM or ICD diagnosis.
      </div>
    </div>
  );
}

export default RunDetailClient;
