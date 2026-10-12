"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GitCompareArrows } from "lucide-react";
import { compareStructuralRuns } from "@/lib/reports/structural-summary";
import { TERMINAL_RUN_STATUSES } from "@/lib/types";
import type { NeuroRun } from "@/lib/types";
import { EmptyState } from "../ui/state";

function qcFlagsOf(run: NeuroRun): string[] {
  const raw = run.outputs?.structural;
  if (!raw || typeof raw !== "object") return [];
  const flags = (raw as Record<string, unknown>).qcFlags;
  return Array.isArray(flags) ? flags.filter((flag): flag is string => typeof flag === "string") : [];
}

function shortDate(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Longitudinal run comparison: pick two structural timepoints and compare
 * measurements, QC flags, and pipeline state side by side. Supplementary,
 * non-diagnostic context only.
 */
export function LongitudinalComparison({
  runs,
  caseId,
  focusRunId,
}: {
  runs: NeuroRun[];
  caseId: string;
  focusRunId?: string;
}) {
  const structuralRuns = useMemo(
    () =>
      runs
        .filter((run) => run.modality === "structural_mri")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [runs],
  );

  const defaultLatest =
    structuralRuns.find((run) => run.id === focusRunId) ??
    structuralRuns.find((run) => (TERMINAL_RUN_STATUSES as readonly string[]).includes(run.status)) ??
    structuralRuns[0];

  const [latestId, setLatestId] = useState(defaultLatest?.id ?? "");
  const [priorId, setPriorId] = useState(
    structuralRuns.find((run) => run.id !== defaultLatest?.id)?.id ?? "",
  );

  const latest = structuralRuns.find((run) => run.id === latestId);
  const prior = structuralRuns.find((run) => run.id === priorId);
  const deltas = latest && prior && latest.id !== prior.id ? compareStructuralRuns(prior, latest) : [];

  if (structuralRuns.length < 2) {
    return (
      <EmptyState
        title="Not enough timepoints yet"
        body="Longitudinal comparison needs at least two structural MRI runs for a case. Create another run to unlock this view."
        icon={<GitCompareArrows className="h-8 w-8" />}
        action={
          <Link
            href={`/upload?caseId=${caseId}`}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
          >
            Start new run
          </Link>
        }
      />
    );
  }

  return (
    <section aria-label="Longitudinal comparison" className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-lg font-semibold text-white">Longitudinal comparison</h2>
      <p className="mt-1 text-sm leading-6 text-slate-400">
        Compare structural measurements across two timepoints. Deltas are presented
        with measurement-uncertainty context and are not diagnostic conclusions.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-white">Latest timepoint</span>
          <select
            value={latestId}
            onChange={(event) => setLatestId(event.target.value)}
            className="mt-2 w-full rounded-lg border border-white/10 bg-midnight px-3 py-2 text-sm text-white"
          >
            {structuralRuns.map((run) => (
              <option key={run.id} value={run.id}>
                {run.id} · {shortDate(run.createdAt)} · {run.status}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-white">Prior timepoint</span>
          <select
            value={priorId}
            onChange={(event) => setPriorId(event.target.value)}
            className="mt-2 w-full rounded-lg border border-white/10 bg-midnight px-3 py-2 text-sm text-white"
          >
            {structuralRuns.map((run) => (
              <option key={run.id} value={run.id}>
                {run.id} · {shortDate(run.createdAt)} · {run.status}
              </option>
            ))}
          </select>
        </label>
      </div>

      {latest && prior && latest.id !== prior.id ? (
        <div className="mt-6 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            {( [["Latest", latest], ["Prior", prior]] as Array<[string, NeuroRun]> ).map(([label, run]) => {
              return (
                <div key={run.id} className="rounded-xl border border-white/10 bg-black/25 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                  <Link href={`/cases/${caseId}/runs/${run.id}`} className="mt-1 block font-medium text-cyan-200 hover:text-cyan-100">
                    {run.id}
                  </Link>
                  <dl className="mt-3 space-y-1 text-sm text-slate-300">
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Date</dt><dd>{shortDate(run.createdAt)}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Status</dt><dd className="capitalize">{run.status}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Inputs</dt><dd>{run.inputFiles.length} file(s)</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Evidence items</dt><dd>{run.outputs?.evidenceLedger?.length ?? 0}</dd></div>
                  </dl>
                </div>
              );
            })}
          </div>

          {deltas.length ? (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-black/30 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3">Measurement</th>
                    <th className="px-4 py-3">Prior</th>
                    <th className="px-4 py-3">Latest</th>
                    <th className="px-4 py-3">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {deltas.map((delta) => (
                    <tr key={delta.label} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-3 font-medium text-white">{delta.label}</td>
                      <td className="px-4 py-3 text-slate-300">{delta.prior}</td>
                      <td className="px-4 py-3 text-slate-300">{delta.latest}</td>
                      <td className="px-4 py-3 text-cyan-100">{delta.change}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-400">No comparable measurements are available for this pair yet.</p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {( [["Latest QC flags", latest], ["Prior QC flags", prior]] as Array<[string, NeuroRun]> ).map(([label, run]) => {
              const flags = qcFlagsOf(run);
              return (
                <div key={label} className="rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-4">
                  <h3 className="text-sm font-semibold text-amber-100/90">{label}</h3>
                  {flags.length ? (
                    <ul className="mt-2 space-y-1 text-sm text-amber-100/80">
                      {flags.map((flag) => (
                        <li key={flag}>• {flag}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">No QC flags recorded.</p>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-xs leading-5 text-slate-500">
            Small changes may sit within expected measurement variability. Compare
            acquisition quality flags before interpreting any shift; Coherence does
            not generate diagnostic conclusions from longitudinal deltas.
          </p>
        </div>
      ) : (
        <p className="mt-6 text-sm text-slate-400">Select two different timepoints to compare.</p>
      )}
    </section>
  );
}

export default LongitudinalComparison;
