"use client";

import { useMemo, useState } from "react";
import {
  SCALE_DEFINITIONS,
  computeTotal,
  getScaleDefinition,
  type ScaleDefinition,
} from "@/lib/scale-definitions";
import type { SymptomScaleEntry } from "@/lib/types";

interface RecordScaleFormProps {
  onSave: (entry: SymptomScaleEntry) => Promise<void> | void;
  saving?: boolean;
}

/**
 * Definition-driven scale entry. The total is computed from the item
 * responses and is never typed; a partial administration records with no
 * total and names the unanswered items.
 */
export function RecordScaleForm({ onSave, saving = false }: RecordScaleFormProps) {
  const [instrumentName, setInstrumentName] = useState<string>(SCALE_DEFINITIONS[0]?.name ?? "");
  const [responses, setResponses] = useState<Record<number, number>>({});
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [completionSource, setCompletionSource] = useState<"patient" | "clinician">("patient");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const definition: ScaleDefinition | undefined = useMemo(
    () => getScaleDefinition(instrumentName),
    [instrumentName]
  );

  const answeredCount = definition
    ? definition.items.filter((item) => responses[item.number] !== undefined).length
    : 0;
  const isComplete = !!definition && answeredCount === definition.items.length;
  const total = definition
    ? computeTotal(
        definition,
        definition.items.map((item) => responses[item.number])
      )
    : 0;
  const maxTotal = definition
    ? Math.max(...definition.responseOptions.map((option) => option.value)) * definition.items.length
    : 0;
  const canSave = !!definition && answeredCount > 0 && date !== "" && !saving;

  function pickInstrument(name: string) {
    setInstrumentName(name);
    setResponses({});
    setError(null);
  }

  function answer(itemNumber: number, value: number) {
    setResponses((previous) => ({ ...previous, [itemNumber]: value }));
    setError(null);
  }

  async function handleSave() {
    if (!definition) return;
    if (answeredCount === 0) {
      setError("Answer at least one item to record the administration.");
      return;
    }
    if (!date) {
      setError("Choose the date the scale was completed.");
      return;
    }
    const itemResponses = definition.items.map((item) => responses[item.number] ?? null);
    const entry: SymptomScaleEntry = {
      name: definition.name,
      instrumentId: definition.id,
      instrumentVersion: definition.version,
      ...(isComplete ? { score: String(total) } : {}),
      date,
      completionSource,
      itemResponses,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    await onSave(entry);
    setResponses({});
    setNotes("");
    setError(null);
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <h3 className="text-sm font-semibold text-neutral-100">Record scale</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-neutral-400">
          Instrument
          <select
            value={instrumentName}
            onChange={(event) => pickInstrument(event.target.value)}
            className="rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm text-neutral-100"
          >
            {SCALE_DEFINITIONS.map((option) => (
              <option key={option.id} value={option.name}>
                {option.name} — {option.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-400">
          Completion date
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm text-neutral-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-400">
          Completed by
          <select
            value={completionSource}
            onChange={(event) => setCompletionSource(event.target.value as "patient" | "clinician")}
            className="rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm text-neutral-100"
          >
            <option value="patient">Patient</option>
            <option value="clinician">Clinician</option>
          </select>
        </label>
      </div>

      {definition ? (
        <div className="mt-4">
          <p className="text-xs text-neutral-400">{definition.stem}</p>
          <ol className="mt-3 space-y-3">
            {definition.items.map((item) => (
              <li key={item.number} className="rounded-lg border border-neutral-800 p-3">
                <p className="text-sm text-neutral-200">
                  <span className="mr-2 font-semibold text-neutral-400">{item.number}.</span>
                  {item.text}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {definition.responseOptions.map((option) => {
                    const selected = responses[item.number] === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => answer(item.number, option.value)}
                        className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                          selected
                            ? "border-copper-400 bg-copper-500/20 text-copper-200"
                            : "border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
                        }`}
                      >
                        {option.value} — {option.label}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[11px] leading-relaxed text-neutral-500">{definition.copyrightNotice}</p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div
              className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 text-sm text-neutral-100"
              aria-live="polite"
            >
              {isComplete ? (
                <>
                  Total <span className="font-semibold">{total}</span>
                  <span className="text-neutral-500"> / {maxTotal} (computed)</span>
                </>
              ) : (
                <span className="text-neutral-400">
                  {answeredCount} of {definition.items.length} answered — partial administration, no total computed
                </span>
              )}
            </div>
            <input
              type="text"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Notes (optional)"
              maxLength={300}
              className="min-w-52 flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm text-neutral-100"
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="rounded-lg bg-copper-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-copper-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save administration"}
            </button>
          </div>
          {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
