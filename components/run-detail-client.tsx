"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EvidenceLedger } from "@/components/evidence-ledger";
import { RunTimeline } from "@/components/run-timeline";
import { StatusChip } from "@/components/status-chip";
import { ViewerPanel } from "@/components/viewer-panel";
import { ProgressBar } from "@/components/progress-bar";
import { PipelineProgressTracker } from "@/components/pipeline-progress-tracker";
import { getPatientCase } from "@/lib/cases";
import { clearRunOrchestration, deleteNeuroRun, getNeuroRun } from "@/lib/runs";
import { startRunPipeline } from "@/lib/pipeline";
import type { NeuroRun, PatientCase } from "@/lib/types";

export function RunDetailClient({ caseIdOverride, runIdOverride }: { caseIdOverride?: string; runIdOverride?: string }) {
  const router = useRouter();
  const params = useParams<{ caseId: string; runId: string }>();
  const caseId = caseIdOverride ?? params.caseId;
  const runId = runIdOverride ?? params.runId;
  const [patientCase, setPatientCase] = useState<PatientCase | null>(null);
  const [run, setRun] = useState<NeuroRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [pipelineAction, setPipelineAction] = useState<"retry" | "restart" | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [nextCase, nextRun] = await Promise.all([getPatientCase(caseId), getNeuroRun(runId)]);
        if (!mounted) return;
        setPatientCase(nextCase);
        setRun(nextRun);
      } catch (nextError) {
        if (mounted) setError(nextError instanceof Error ? nextError.message : "Unable to load run.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [caseId, runId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!run || !["uploaded", "queued", "running"].includes(run.status)) return;

    let mounted = true;
    const timer = window.setInterval(async () => {
      try {
        const nextRun = await getNeuroRun(runId);
        if (mounted) setRun(nextRun);
      } catch (nextError) {
        if (mounted) setError(nextError instanceof Error ? nextError.message : "Unable to refresh run.");
      }
    }, 15000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [run?.status, runId]);

  if (loading) return <ProgressBar label="Loading run" detail="Fetching run details" />;
  if (error || !run) return <div className="rounded-lg border border-rose-300/30 bg-rose-300/10 p-5 text-sm text-rose-100">{error || "Run not found."}</div>;

  async function refreshRun() {
    setRefreshing(true);
    setError("");

    try {
      const nextRun = await getNeuroRun(runId);
      setRun(nextRun);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to refresh run.");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleDeleteRun() {
    if (!run) return;
    const confirmed = window.confirm(`Delete run ${run.id}? Uploaded input files for this run will be deleted where accessible.`);
    if (!confirmed) return;

    setDeleting(true);
    setError("");

    try {
      await deleteNeuroRun(run.id);
      router.push(`/cases/${caseId}`);
      router.refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to delete run.");
      setDeleting(false);
    }
  }

  async function handleRetryPipeline() {
    if (!run) return;

    setRetrying(true);
    setPipelineAction("retry");
    setError("");

    try {
      await startRunPipeline(run.id);
      const nextRun = await getNeuroRun(run.id);
      setRun(nextRun);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to retry pipeline.");
    } finally {
      setRetrying(false);
      setPipelineAction(null);
    }
  }

  async function handleRestartPipeline() {
    if (!run) return;
    const confirmed = window.confirm(`Restart pipeline for run ${run.id}? This clears the current orchestration state and launches the configured backend jobs again.`);
    if (!confirmed) return;

    setRetrying(true);
    setPipelineAction("restart");
    setError("");

    try {
      await clearRunOrchestration(run.id);
      await startRunPipeline(run.id);
      const nextRun = await getNeuroRun(run.id);
      setRun(nextRun);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to restart pipeline.");
    } finally {
      setRetrying(false);
      setPipelineAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line bg-panel/75 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">{run.id}</h1>
            <p className="mt-2 text-sm text-slate-300">{patientCase?.displayName ?? run.caseId} - {run.modality.replace("_", " ")}</p>
            <p className="mt-2 text-sm text-slate-400">Current stage: {run.currentStage}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusChip status={run.status} />
            <button
              type="button"
              onClick={refreshRun}
              disabled={refreshing || retrying || deleting}
              className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            <Link href={`/reports/${run.id}`} className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-medium text-slate-950">Open report</Link>
            {run.status === "failed" ? (
              <button
                type="button"
                onClick={handleRetryPipeline}
                disabled={retrying}
                className="rounded-md border border-cyan-300/35 bg-cyan-300/10 px-4 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {retrying ? "Retrying..." : "Retry pipeline"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleRestartPipeline}
              disabled={retrying || deleting}
              className="rounded-md border border-gold/35 bg-gold/10 px-4 py-2 text-sm font-medium text-gold hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {retrying ? "Restarting..." : "Restart pipeline"}
            </button>
            <button
              type="button"
              onClick={handleDeleteRun}
              disabled={deleting}
              className="rounded-md border border-rose-300/35 bg-rose-300/10 px-4 py-2 text-sm font-medium text-rose-100 hover:bg-rose-300/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete run"}
            </button>
          </div>
        </div>
        {refreshing ? <div className="mt-4"><ProgressBar label="Refreshing run" detail="Fetching latest pipeline state" /></div> : null}
        {retrying ? (
          <div className="mt-4">
            <ProgressBar
              label={pipelineAction === "restart" ? "Restarting pipeline" : "Retrying pipeline"}
              detail="Resolving and launching Cloud Run Jobs"
            />
          </div>
        ) : null}
        {deleting ? <div className="mt-4"><ProgressBar label="Deleting run" detail="Removing run metadata and input files" /></div> : null}
      </section>
      <PipelineProgressTracker run={run} nowMs={nowMs} />
      <RunTimeline stages={run.stages} />
      <section className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <div className="space-y-6">
          <div className="rounded-lg border border-line bg-panel/75 p-5">
            <h2 className="text-base font-semibold text-white">Uploaded files</h2>
            <div className="mt-4 space-y-3">
              {run.inputFiles.length ? run.inputFiles.map((file) => (
                <div key={file.id} className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm">
                  <div className="font-medium text-white">{file.name}</div>
                  <div className="mt-1 text-slate-400">{(file.sizeBytes / 1024 / 1024).toFixed(1)} MB - {file.contentType}</div>
                </div>
              )) : <p className="text-sm text-slate-400">No files attached to this run yet.</p>}
            </div>
          </div>
          <div className="rounded-lg border border-line bg-panel/75 p-5">
            <h2 className="text-base font-semibold text-white">QC placeholder</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">Quality-control flags will summarize acquisition, conversion, and analysis readiness without diagnostic conclusions.</p>
          </div>
        </div>
        <ViewerPanel />
      </section>
      <EvidenceLedger items={run.outputs?.evidenceLedger ?? []} />
    </div>
  );
}
