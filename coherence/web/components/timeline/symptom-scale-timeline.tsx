"use client";

import { Activity } from "lucide-react";
import { groupSymptomScales } from "@/lib/timeline";
import type { ClinicalContext } from "@/lib/types";
import { EmptyState } from "../ui/state";

function Sparkline({ points }: { points: Array<{ date: string; score: string }> }) {
  const numeric = points
    .map((point, index) => ({ index, value: Number.parseFloat(point.score) }))
    .filter((point) => !Number.isNaN(point.value));

  if (numeric.length < 2) {
    return <p className="text-xs text-slate-500">At least two scored timepoints are needed for a trend.</p>;
  }

  const width = 220;
  const height = 64;
  const padding = 8;
  const values = numeric.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const coords = numeric.map((point, i) => {
    const x = padding + (i / (numeric.length - 1)) * (width - padding * 2);
    const y = height - padding - ((point.value - min) / span) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const first = numeric[0].value;
  const last = numeric[numeric.length - 1].value;
  const trend = last < first ? "Improving ↓" : last > first ? "Rising ↑" : "Stable →";
  const trendTone = last < first ? "text-emerald-200" : last > first ? "text-amber-200" : "text-slate-300";

  return (
    <div>
      <svg width={width} height={height} role="img" aria-label={`Score trend from ${first} to ${last}`} className="overflow-visible">
        <polyline points={coords.join(" ")} fill="none" stroke="#67e8f9" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {numeric.map((point, i) => {
          const [x, y] = coords[i].split(",").map(Number);
          return <circle key={i} cx={x} cy={y} r={3.5} fill="#0b1020" stroke="#67e8f9" strokeWidth={2} />;
        })}
      </svg>
      <p className={`mt-1 text-xs font-medium ${trendTone}`}>{trend}</p>
    </div>
  );
}

/** Symptom-scale scores over time, grouped by instrument. Clinician-entered. */
export function SymptomScaleTimeline({ context }: { context?: ClinicalContext }) {
  const groups = groupSymptomScales(context);

  if (!groups.length) {
    return (
      <EmptyState
        title="No symptom scales recorded"
        body="Clinician-recorded symptom scale scores (for example PHQ-9, GAD-7) will appear here as dated trends."
        icon={<Activity className="h-8 w-8" />}
      />
    );
  }

  return (
    <section aria-label="Symptom scale timeline" className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-lg font-semibold text-white">Symptom scale timeline</h2>
      <p className="mt-1 text-xs text-slate-500">
        Clinician-recorded scores. Trends are descriptive summaries, not diagnostic statements.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {groups.map((group) => (
          <div key={group.name} className="rounded-xl border border-white/10 bg-black/25 p-4">
            <h3 className="font-medium text-white">{group.name}</h3>
            <div className="mt-3">
              <Sparkline points={group.points} />
            </div>
            <ol className="mt-3 space-y-1 text-sm">
              {group.points.map((point, index) => (
                <li key={`${point.date}-${index}`} className="flex items-baseline justify-between gap-3 text-slate-300">
                  <span className="text-xs text-slate-500">{point.date || "Undated"}</span>
                  <span className="font-medium text-white">{point.score}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}

export default SymptomScaleTimeline;
