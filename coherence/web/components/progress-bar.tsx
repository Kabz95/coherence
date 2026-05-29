export function ProgressBar({ label = "Working", detail }: { label?: string; detail?: string }) {
  return (
    <div className="rounded-md border border-cyan-300/25 bg-cyan-300/10 p-3" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-xs text-cyan-50">
        <span className="font-medium">{label}</span>
        {detail ? <span className="text-cyan-100/70">{detail}</span> : null}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-950/70">
        <div className="h-full w-1/3 animate-[progress_1.25s_ease-in-out_infinite] rounded-full bg-cyan-300" />
      </div>
    </div>
  );
}
