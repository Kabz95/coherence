"use client";

import { TimerReset } from "lucide-react";
import { calculatePipelineProgress, formatDuration } from "@/lib/pipeline-progress";
import type { NeuroRun } from "@/lib/types";
import { StatusChip } from "./status-chip";

function barColor(status: string): string {
  if (status === "completed" || status === "skipped") return "bg-emerald-300";
  if (status === "failed") return "bg-rose-300";
  if (status === "running") return "bg-cyan-300";
  if (status === "queued") return "bg-gold";
  return "bg-slate-600";
}

export function PipelineProgressTracker({ run, nowMs }: { run: NeuroRun; nowMs: number }) {
  const progress = calculatePipelineProgress(run.stages, nowMs);

  if (!run.stages.length) {
    return (
      <section className="rounded-lg border border-line bg-panel/75 p-5 text-sm text-slate-300">
        No pipeline progress data is available yet.
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-cyan-300/20 bg-panel/80 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">Pipeline progress</h2>
          <p className="mt-1 text-sm text-slate-400">
            Estimated progress from backend stage status and conservative runtime windows.
          </p>
        </div>
        <div className="grid gap-1 text-right text-sm">
          <span className="text-2xl font-semibold text-white">{progress.percent}%</span>
          <span className="text-slate-400">
            {progress.completedSteps}/{progress.totalSteps} steps complete
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
          <span>Active step: {progress.activeStep?.stage.label ?? "None"}</span>
          <span className="inline-flex items-center gap-2 text-cyan-100">
            <TimerReset className="h-4 w-4" />
            Estimated remaining: {formatDuration(progress.remainingSeconds)}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        {progress.stages.map((item) => (
          <div key={item.stage.id} className="rounded-md border border-white/8 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium text-white">{item.stage.label}</div>
                <div className="mt-1 text-xs text-slate-400">{item.stage.jobName}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip status={item.stage.status} />
                <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-300">
                  {item.percent}%
                </span>
              </div>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div className={`h-full rounded-full ${barColor(item.stage.status)} transition-all duration-500`} style={{ width: `${item.percent}%` }} />
            </div>

            <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-400">
              <span>Elapsed: {formatDuration(item.elapsedSeconds)}</span>
              <span>Time left: {formatDuration(item.remainingSeconds)}</span>
              <span>Estimate: {formatDuration(item.estimateSeconds)}</span>
            </div>
            {item.stage.error ? <p className="mt-2 text-sm text-rose-200">{item.stage.error}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
