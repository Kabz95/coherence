import { CheckCircle2, Circle, CircleAlert, Clock3, Cpu } from "lucide-react";
import type { RunStage } from "@/lib/types";
import { StatusChip } from "./status-chip";

function iconForStatus(status: RunStage["status"]) {
  if (status === "completed") return <CheckCircle2 className="h-5 w-5 text-emerald-300" />;
  if (status === "failed") return <CircleAlert className="h-5 w-5 text-rose-300" />;
  if (status === "running") return <Clock3 className="h-5 w-5 text-violet" />;
  return <Circle className="h-5 w-5 text-slate-500" />;
}

export function RunTimeline({ stages }: { stages: RunStage[] }) {
  if (!stages.length) {
    return <div className="rounded-lg border border-line bg-panel/70 p-5 text-sm text-slate-300">No pipeline stages have been mapped yet.</div>;
  }

  return (
    <div className="rounded-lg border border-line bg-panel/70 p-5">
      <h2 className="text-base font-semibold text-white">Pipeline timeline</h2>
      <div className="mt-5 grid gap-3">
        {stages.map((stage) => (
          <div key={stage.id} className="grid gap-3 rounded-md border border-white/8 bg-white/[0.03] p-4 md:grid-cols-[1fr_auto]">
            <div className="flex gap-3">
              <div className="mt-0.5">{iconForStatus(stage.status)}</div>
              <div>
                <div className="font-medium text-white">{stage.label}</div>
                <div className="mt-1 text-sm text-slate-400">{stage.jobName}</div>
                {stage.error ? <div className="mt-2 text-sm text-rose-200">{stage.error}</div> : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <StatusChip status={stage.status} />
              <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-300">{stage.region}</span>
              {stage.requiresGpu ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-violet/40 px-2.5 py-1 text-xs text-violet">
                  <Cpu className="h-3.5 w-3.5" /> GPU
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
