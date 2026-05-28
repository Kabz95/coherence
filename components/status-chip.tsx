import type { RunStatus, StageStatus } from "@/lib/types";

const styles: Record<RunStatus | StageStatus, string> = {
  draft: "border-slate-500/40 bg-slate-500/10 text-slate-200",
  uploaded: "border-cyan-400/40 bg-cyan-400/10 text-cyan-100",
  queued: "border-gold/50 bg-gold/10 text-gold",
  running: "border-violet/50 bg-violet/10 text-violet",
  completed: "border-emerald-400/40 bg-emerald-400/10 text-emerald-100",
  failed: "border-rose-400/50 bg-rose-400/10 text-rose-100",
  pending: "border-slate-600/50 bg-slate-700/20 text-slate-300",
  skipped: "border-slate-600/50 bg-slate-800/30 text-slate-400"
};

export function StatusChip({ status }: { status: RunStatus | StageStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${styles[status]}`}>
      {status.replace("_", " ")}
    </span>
  );
}
