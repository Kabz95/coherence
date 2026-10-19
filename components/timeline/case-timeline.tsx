"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Activity,
  CalendarPlus,
  FileText,
  Flag,
  FlaskConical,
  Moon,
  Pill,
  ScanLine,
  Stethoscope,
  Users,
} from "lucide-react";
import type { ReferralQuestion, TimelineEvent, TimelineEventKind } from "@/lib/types";
import { EmptyState } from "../ui/state";

const kindMeta: Record<TimelineEventKind, { label: string; icon: typeof Pill; tint: string }> = {
  case_created: { label: "Case", icon: CalendarPlus, tint: "text-slate-300" },
  run: { label: "Imaging run", icon: ScanLine, tint: "text-cyan-200" },
  medication: { label: "Medication", icon: Pill, tint: "text-violet-200" },
  symptom_scale: { label: "Symptom scale", icon: Activity, tint: "text-emerald-200" },
  therapy: { label: "Therapy", icon: Stethoscope, tint: "text-amber-200" },
  note: { label: "Clinician note", icon: FileText, tint: "text-slate-200" },
  lab: { label: "Laboratory", icon: FlaskConical, tint: "text-teal-200" },
  sleep: { label: "Sleep summary", icon: Moon, tint: "text-indigo-200" },
  life_event: { label: "Life event", icon: Flag, tint: "text-orange-200" },
  collateral: { label: "Collateral", icon: Users, tint: "text-rose-200" },
};

/** Stream groups for the filter bar. Every kind belongs to exactly one stream. */
const STREAMS = {
  all: { label: "All", kinds: null as TimelineEventKind[] | null, empty: "" },
  scales: { label: "Scales", kinds: ["symptom_scale"] as TimelineEventKind[], empty: "No symptom scale scores recorded." },
  treatments: { label: "Meds & therapies", kinds: ["medication", "therapy"] as TimelineEventKind[], empty: "No medication or therapy entries recorded." },
  context: {
    label: "Events & notes",
    kinds: ["life_event", "sleep", "collateral", "note", "case_created"] as TimelineEventKind[],
    empty: "No life events, sleep summaries, collateral entries, or notes recorded.",
  },
  imaging: { label: "Imaging", kinds: ["run"] as TimelineEventKind[], empty: "No imaging runs yet." },
  labs: { label: "Labs", kinds: ["lab"] as TimelineEventKind[], empty: "No laboratory entries recorded." },
} as const;

type StreamId = keyof typeof STREAMS;

/**
 * Key events: measurements, treatments, and context markers. Notes, sleep
 * summaries, therapy episodes, and the case-created marker are available
 * under "All events" but hidden in the denser key-events view.
 */
const KEY_KINDS: readonly TimelineEventKind[] = [
  "run",
  "medication",
  "symptom_scale",
  "lab",
  "life_event",
  "collateral",
];

/** Context markers render visually distinct from measurements: they explain terrain, not data. */
const MARKER_KINDS: readonly TimelineEventKind[] = ["life_event", "sleep", "collateral"];

const SOURCE_LABELS: Record<TimelineEvent["source"], string> = {
  clinician: "Clinician",
  pipeline: "Pipeline",
  system: "System",
  informant: "Informant",
  patient: "Patient",
  device: "Device summary",
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatRange(event: TimelineEvent): string {
  if (!event.endDate || event.endDate.slice(0, 10) === event.date.slice(0, 10)) {
    return formatDate(event.date);
  }
  return `${formatDate(event.date)} → ${formatDate(event.endDate)}`;
}

/**
 * Unified clinical timeline: every stream a case holds — scales, medications,
 * therapies, labs, sleep summaries, life events, collateral entries, notes,
 * and imaging runs — on one chronological axis under the referral question.
 * Description only: the timeline never characterises change as good or bad.
 */
export function CaseTimeline({
  events,
  caseId,
  referralQuestion,
}: {
  events: TimelineEvent[];
  caseId: string;
  referralQuestion?: ReferralQuestion;
}) {
  const [stream, setStream] = useState<StreamId>("all");
  const [keyOnly, setKeyOnly] = useState(false);

  const visible = useMemo(() => {
    const kinds = STREAMS[stream].kinds;
    return events.filter((event) => {
      if (kinds && !kinds.includes(event.kind)) return false;
      if (keyOnly && !KEY_KINDS.includes(event.kind)) return false;
      return true;
    });
  }, [events, stream, keyOnly]);

  if (!events.length && !referralQuestion) {
    return (
      <EmptyState
        title="No timeline events yet"
        body="Timeline events appear here as clinical context is recorded and runs are created."
      />
    );
  }

  return (
    <section aria-label="Unified clinical timeline" className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      {referralQuestion ? (
        <div className="mb-6 rounded-xl border border-cyan-300/25 bg-cyan-300/5 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-cyan-200">Referral question</div>
          <p className="mt-1 text-sm leading-6 text-white">“{referralQuestion.text}”</p>
          <p className="mt-1 text-xs text-slate-500">
            {referralQuestion.author ? `${referralQuestion.author} · ` : ""}{formatDate(referralQuestion.date)}
            {referralQuestion.history.length ? ` · ${referralQuestion.history.length} earlier version${referralQuestion.history.length === 1 ? "" : "s"}` : ""}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Clinical timeline</h2>
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(STREAMS) as StreamId[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setStream(id)}
              aria-pressed={stream === id}
              className={`rounded-full border px-3 py-1 text-xs ${
                stream === id
                  ? "border-cyan-300 bg-cyan-300/15 text-cyan-100"
                  : "border-white/10 text-slate-400 hover:border-white/25 hover:text-slate-200"
              }`}
            >
              {STREAMS[id].label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setKeyOnly((value) => !value)}
            aria-pressed={keyOnly}
            title="Show only measurements, treatments, and context markers"
            className={`rounded-full border px-3 py-1 text-xs ${
              keyOnly
                ? "border-amber-300 bg-amber-300/15 text-amber-100"
                : "border-white/10 text-slate-400 hover:border-white/25 hover:text-slate-200"
            }`}
          >
            Key events only
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-slate-400">
          {STREAMS[stream].empty || "No events recorded."}
        </p>
      ) : (
        <ol className="relative mt-6 space-y-6 border-l border-white/10 pl-6">
          {visible.map((event) => {
            const meta = kindMeta[event.kind];
            const Icon = meta.icon;
            const isMarker = MARKER_KINDS.includes(event.kind);
            return (
              <li key={event.id} className="relative">
                <span className="absolute -left-[31px] flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-midnight">
                  <Icon className={`h-4 w-4 ${meta.tint}`} aria-hidden />
                </span>
                <div
                  className={`rounded-xl p-4 ${
                    isMarker
                      ? "border border-dashed border-white/20 bg-black/15"
                      : "border border-white/10 bg-black/25"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-medium text-white">{event.title}</h3>
                    <time className="text-xs text-slate-400">{formatRange(event)}</time>
                  </div>
                  {event.detail ? <p className="mt-2 text-sm leading-6 text-slate-300">{event.detail}</p> : null}
                  <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                    <span className="rounded-full bg-white/5 px-2 py-0.5">{meta.label}</span>
                    <span>{SOURCE_LABELS[event.source] ?? event.source}</span>
                    {event.endDate && event.endDate.slice(0, 10) !== event.date.slice(0, 10) ? (
                      <span className="rounded-full bg-white/5 px-2 py-0.5">Spans a period</span>
                    ) : null}
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
