"use client";

import { useState } from "react";
import {
  SCALE_DEFINITIONS,
  getScaleDefinition,
  maxTotal,
} from "@/lib/scale-definitions";
import type { SymptomScaleEntry } from "@/lib/types";

interface ScaleHistoryProps {
  entries: SymptomScaleEntry[];
}

function formatDate(value?: string): string {
  if (!value) return "Undated";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

/**
 * Per-instrument scale history. Totals are dated points on a plain line;
 * there are no threshold bands, colour zones, or severity labels.
 * Partials are marked and never scored; missing items are named.
 */
export function ScaleHistory({ entries }: ScaleHistoryProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  if (entries.length === 0) {
    return <p className="text-sm text-neutral-500">No scale administrations recorded.</p>;
  }

  return (
    <div className="space-y-6">
      {SCALE_DEFINITIONS.map((definition) => {
        const instrumentEntries = entries
          .filter((entry) => entry.name === definition.name)
          .slice()
          .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
        if (instrumentEntries.length === 0) {
          return (
            <section key={definition.id}>
              <h3 className="text-sm font-semibold text-neutral-100">
                {definition.name} <span className="font-normal text-neutral-500">— {definition.fullName}</span>
              </h3>
              <p className="mt-1 text-sm text-neutral-500">No {definition.name} administrations recorded.</p>
            </section>
          );
        }
        const completed = instrumentEntries.filter((entry) => entry.score !== undefined);
        const max = maxTotal(definition);
        return (
          <section key={definition.id}>
            <h3 className="text-sm font-semibold text-neutral-100">
              {definition.name} <span className="font-normal text-neutral-500">— {definition.fullName}</span>
            </h3>
            {completed.length >= 2 ? (
              <ScaleChart entries={completed} max={max} />
            ) : completed.length === 1 ? (
              <p className="mt-1 text-sm text-neutral-400">
                One administration: total {completed[0]?.score} on {formatDate(completed[0]?.date)}.
              </p>
            ) : (
              <p className="mt-1 text-sm text-neutral-400">
                Only partial administrations so far — no totals to plot.
              </p>
            )}
            <ul className="mt-3 space-y-2">
              {instrumentEntries.map((entry, index) => {
                const key = `${definition.id}-${index}`;
                const expanded = expandedKey === key;
                const missing = (entry.itemResponses ?? [])
                  .map((response, itemIndex) => (response === null ? itemIndex + 1 : undefined))
                  .filter((item): item is number => item !== undefined);
                return (
                  <li key={key} className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
                    <button
                      type="button"
                      onClick={() => setExpandedKey(expanded ? null : key)}
                      className="flex w-full flex-wrap items-center gap-2 text-left text-sm"
                    >
                      <span className="font-semibold text-neutral-100">{formatDate(entry.date)}</span>
                      {entry.score !== undefined ? (
                        <span className="text-neutral-300">Total {entry.score} / {max}</span>
                      ) : (
                        <span className="rounded-full border border-amber-500/50 px-2 py-0.5 text-xs text-amber-300">
                          Partial — not scored
                        </span>
                      )}
                      <span className="text-xs text-neutral-500">
                        completed by {entry.completionSource ?? "unknown"}
                      </span>
                      <span className="ml-auto text-xs text-neutral-500">{expanded ? "Hide items" : "Show items"}</span>
                    </button>
                    {expanded ? (
                      <div className="mt-2">
                        <ol className="space-y-1 text-xs text-neutral-400">
                          {definition.items.map((item) => {
                            const response = entry.itemResponses?.[item.number - 1];
                            const option = definition.responseOptions.find((candidate) => candidate.value === response);
                            return (
                              <li key={item.number} className="flex gap-2">
                                <span className="w-6 shrink-0 text-neutral-500">{item.number}.</span>
                                <span className="flex-1">{item.text}</span>
                                <span className={option ? "text-neutral-300" : "text-amber-300"}>
                                  {option ? `${option.value} — ${option.label}` : "unanswered"}
                                </span>
                              </li>
                            );
                          })}
                        </ol>
                        {missing.length > 0 ? (
                          <p className="mt-1 text-xs text-amber-300">
                            Unanswered items: {missing.join(", ")} — no total computed.
                          </p>
                        ) : null}
                        {entry.notes ? <p className="mt-1 text-xs text-neutral-500">{entry.notes}</p> : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">{definition.copyrightNotice}</p>
          </section>
        );
      })}
    </div>
  );
}

function ScaleChart({ entries, max }: { entries: SymptomScaleEntry[]; max: number }) {
  const width = 560;
  const height = 220;
  const padLeft = 36;
  const padRight = 12;
  const padTop = 16;
  const padBottom = 28;
  const innerWidth = width - padLeft - padRight;
  const innerHeight = height - padTop - padBottom;

  const points = entries
    .map((entry) => ({ entry, value: Number(entry.score) }))
    .filter((point) => !Number.isNaN(point.value));

  const x = (index: number) =>
    points.length === 1 ? padLeft + innerWidth / 2 : padLeft + (index / (points.length - 1)) * innerWidth;
  const y = (value: number) => padTop + innerHeight - (value / max) * innerHeight;
  const polyline = points.map((point, index) => `${x(index)},${y(point.value)}`).join(" ");

  const labelFor = (entry: SymptomScaleEntry) => {
    if (!entry.date) return "Undated";
    const date = new Date(`${entry.date}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? entry.date
      : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="mt-2 w-full max-w-2xl"
      role="img"
      aria-label="Scale totals over time"
    >
      <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + innerHeight} stroke="#3f3f46" />
      <line
        x1={padLeft}
        y1={padTop + innerHeight}
        x2={padLeft + innerWidth}
        y2={padTop + innerHeight}
        stroke="#3f3f46"
      />
      {[0, max].map((tick) => (
        <text key={tick} x={padLeft - 6} y={y(tick) + 4} textAnchor="end" fontSize="10" fill="#71717a">
          {tick}
        </text>
      ))}
      <polyline points={polyline} fill="none" stroke="#38bdf8" strokeWidth="2" />
      {points.map((point, index) => (
        <g key={`${point.entry.date}-${index}`}>
          <circle cx={x(index)} cy={y(point.value)} r="4" fill="#38bdf8" />
          <text x={x(index)} y={y(point.value) - 10} textAnchor="middle" fontSize="11" fill="#e4e4e7">
            {point.value}
          </text>
          <text
            x={x(index)}
            y={padTop + innerHeight + 16}
            textAnchor="middle"
            fontSize="10"
            fill="#71717a"
          >
            {labelFor(point.entry)}
          </text>
        </g>
      ))}
    </svg>
  );
}
