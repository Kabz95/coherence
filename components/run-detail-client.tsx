"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, GitCompareArrows, RefreshCw, RotateCcw, TimerReset } from "lucide-react";
import { calculatePipelineProgress, formatDuration } from "@/lib/pipeline-progress";
import { refreshRunPipeline, restartRunPipeline } from "@/lib/pipeline";
import { buildStructuralReportSections } from "@/lib/reports/structural-summary";
import { buildModalityReportSections } from "@/lib/reports/modality-summary";
import { getNeuroRun } from "@/lib/runs";
import type { NeuroRun } from "@/lib/types";
import { ProgressBar } from "./progress-bar";
import { RunTimeline } from "./run-timeline";
import { PipelineViewer } from "./viewer/pipeline-viewer";
import { EmptyState } from "./ui/state";

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
  const [actionBusy, setActionBusy] = useState<"refresh" | "restart" | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
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

  const hasFailedStage = visibleStages.some((stage) => stage.status === "failed");
  const showRestart = hasFailedStage || run?.status === "failed";
  const isComplete = run?.status === "completed";

  const handleRefresh = async () => {
    if (!runId || actionBusy) return;
    setActionBusy("refresh");
    setActionMessage("");
    setActionError("");
    try {
      const result = await refreshRunPipeline(runId);
      if (result.complete) setActionMessage("Pipeline refreshed — all stages are complete.");
      else if (result.launched?.length) setActionMessage("Pipeline refreshed — the next stage was launched.");
      else if (result.alreadyStarted) setActionMessage("Pipeline refreshed — a stage is already running.");
      else setActionMessage("Pipeline refreshed — nothing needed to advance.");
      await loadRun(false);
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : "Refresh failed.");
    } finally {
      setActionBusy(null);
    }
  };

  const handleRestart = async () => {
    if (!runId || actionBusy) return;
    if (!window.confirm("Restart the pipeline from the failed stage? Completed stages keep their outputs.")) return;
    setActionBusy("restart");
    setActionMessage("");
    setActionError("");
    try {
      const result = await restartRunPipeline(runId);
      if (result.restarted === false) setActionMessage("Nothing to restart — no failed stages were found.");
      else if (result.complete) setActionMessage("Pipeline restarted — all stages are now complete.");
      else if (result.launched?.length) setActionMessage("Pipeline restarted — the failed stage was relaunched.");
      else setActionMessage("Pipeline restarted.");
      await loadRun(false);
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : "Restart failed.");
    } finally {
      setActionBusy(null);
    }
  };

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
        <p className="text-sm text-copper-200">Run detail</p>
        <h2 className="mt-1 text-2xl font-semibold text-white">{runId}</h2>
        <p className="mt-2 text-sm text-slate-300">
          Case: <span className="text-white">{caseId}</span>
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/reports/${runId}`}
            className="inline-flex items-center gap-2 rounded-xl bg-copper-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-copper-200"
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
      {!loading && !error && !run ? (
        <EmptyState
          title="Run not found"
          body="This run could not be loaded. It may have been deleted, or the demo data may not include it."
          action={
            <Link
              href={`/cases/${caseId}`}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
            >
              Back to case
            </Link>
          }
        />
      ) : null}

      <section className="rounded-lg border border-copper-300/20 bg-panel/80 p-5">
        <p className="text-sm text-copper-200">Pipeline orchestrator</p>
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
              className="h-full rounded-full bg-copper-300 transition-all duration-500"
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
            <span className="inline-flex items-center gap-2 text-copper-100">
              <TimerReset className="h-4 w-4" />
              Estimated remaining: {formatDuration(progress.remainingSeconds)}
            </span>
          </div>
        </div>

        {run ? (
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={actionBusy !== null || isComplete}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${actionBusy === "refresh" ? "animate-spin" : ""}`} />
              {actionBusy === "refresh" ? "Refreshing…" : "Refresh pipeline"}
            </button>
            {showRestart ? (
              <button
                type="button"
                onClick={handleRestart}
                disabled={actionBusy !== null}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-2 text-sm font-medium text-rose-100 hover:bg-rose-300/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw className={`h-4 w-4 ${actionBusy === "restart" ? "animate-spin" : ""}`} />
                {actionBusy === "restart" ? "Restarting…" : "Restart pipeline"}
              </button>
            ) : null}
            {actionMessage ? <span className="text-sm text-emerald-200">{actionMessage}</span> : null}
            {actionError ? <span className="text-sm text-rose-200">{actionError}</span> : null}
          </div>
        ) : null}
      </section>

      {run ? <RunTimeline stages={visibleStages} /> : null}

      {run ? <PipelineViewer run={run} /> : null}

      {run ? <RunReportSummary run={run} caseId={caseId} /> : null}

      <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
        Coherence provides supplementary, non-diagnostic neuroimaging and
        neurophysiology summaries for clinician review. It does not establish,
        confirm, predict, or rule out any DSM or ICD diagnosis.
      </div>
    </div>
  );
}

function RunReportSummary({ run, caseId }: { run: NeuroRun; caseId: string }) {
  const sections = useMemo(
    () => (run.modality === "structural_mri" ? buildStructuralReportSections(run) : buildModalityReportSections(run)),
    [run],
  );
  const measurements = sections.find((section) => section.id === "measurements");
  const qc = sections.find((section) => section.id === "qc");
  const hasReport = Boolean(run.report);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Report summary</h2>
          <p className="mt-1 text-sm text-slate-400">
            {hasReport
              ? "Structured non-diagnostic summary generated from this run's outputs."
              : "The full report will be available when pipeline processing completes."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/cases/${caseId}?tab=longitudinal&focusRun=${run.id}`}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
          >
            <GitCompareArrows className="h-4 w-4" />
            Compare with prior timepoint
          </Link>
          {hasReport ? (
            <Link
              href={`/reports/${run.id}`}
              className="inline-flex items-center gap-2 rounded-xl bg-copper-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-copper-200"
            >
              <FileText className="h-4 w-4" />
              Full report
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {measurements?.rows?.length ? (
          <div className="rounded-xl border border-white/10 bg-black/25 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Key measurements</h3>
            <dl className="mt-3 space-y-2">
              {measurements.rows.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-3 text-sm">
                  <dt className="text-slate-400">{row.label}</dt>
                  <dd className="text-right text-slate-100">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
        {qc?.rows?.length ? (
          <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-200/80">Quality-control flags</h3>
            <ul className="mt-3 space-y-2 text-sm text-amber-100/90">
              {qc.rows.map((row) => (
                <li key={row.label}>• {row.value}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default RunDetailClient;
