"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Activity,
  CalendarPlus,
  FileText,
  Pill,
  ScanLine,
  Stethoscope,
} from "lucide-react";
import type { TimelineEvent, TimelineEventKind } from "@/lib/types";
import { EmptyState } from "../ui/state";

const kindMeta: Record<TimelineEventKind, { label: string; icon: typeof Pill; tint: string }> = {
  case_created: { label: "Case", icon: CalendarPlus, tint: "text-slate-300" },
  run: { label: "Imaging run", icon: ScanLine, tint: "text-cyan-200" },
  medication: { label: "Medication", icon: Pill, tint: "text-violet-200" },
  symptom_scale: { label: "Symptom scale", icon: Activity, tint: "text-emerald-200" },
  therapy: { label: "Therapy", icon: Stethoscope, tint: "text-amber-200" },
  note: { label: "Clinician note", icon: FileText, tint: "text-slate-200" },
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Vertical case timeline: runs, medication changes, symptom-scale scores,
 * therapies, and clinician notes in one longitudinal view, newest first.
 */
export function CaseTimeline({ events, caseId }: { events: TimelineEvent[]; caseId: string }) {
  const [filter, setFilter] = useState<TimelineEventKind | "all">("all");

  const visible = useMemo(
    () => (filter === "all" ? events : events.filter((event) => event.kind === filter)),
    [events, filter],
  );

  if (!events.length) {
    return (
      <EmptyState
        title="No timeline events yet"
        body="Timeline events appear here as runs are created and clinical context is recorded."
      />
    );
  }

  return (
    <section aria-label="Case timeline" className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Case timeline</h2>
        <div className="flex flex-wrap gap-2">
          {(["all", "run", "medication", "symptom_scale", "therapy", "note"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setFilter(kind)}
              aria-pressed={filter === kind}
              className={`rounded-full border px-3 py-1 text-xs ${
                filter === kind
                  ? "border-cyan-300 bg-cyan-300/15 text-cyan-100"
                  : "border-white/10 text-slate-400 hover:border-white/25 hover:text-slate-200"
              }`}
            >
              {kind === "all" ? "All" : kindMeta[kind].label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-slate-400">No events of this type yet.</p>
      ) : (
        <ol className="relative mt-6 space-y-6 border-l border-white/10 pl-6">
          {visible.map((event) => {
            const meta = kindMeta[event.kind];
            const Icon = meta.icon;
            return (
              <li key={event.id} className="relative">
                <span className="absolute -left-[31px] flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-midnight">
                  <Icon className={`h-4 w-4 ${meta.tint}`} aria-hidden />
                </span>
                <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-medium text-white">{event.title}</h3>
                    <time className="text-xs text-slate-400">{formatDate(event.date)}</time>
                  </div>
                  {event.detail ? <p className="mt-2 text-sm leading-6 text-slate-300">{event.detail}</p> : null}
                  <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                    <span className="rounded-full bg-white/5 px-2 py-0.5">{meta.label}</span>
                    <span className="capitalize">{event.source}</span>
                    {event.runId ? (
                      <Link href={`/cases/${caseId}/runs/${event.runId}`} className="text-cyan-200 hover:text-cyan-100">
                        Open run →
                      </Link>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export default CaseTimeline;
