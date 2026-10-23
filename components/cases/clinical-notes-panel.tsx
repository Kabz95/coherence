"use client";

import { useState } from "react";
import { FileText, Plus } from "lucide-react";
import { isDemoMode } from "@/lib/demo";
import type { ClinicalNote } from "@/lib/types";
import { EmptyState } from "../ui/state";

function formatDate(value: string): string {
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Dated clinician notes. In live mode notes can be appended to the case's
 * clinical context; in demo mode the panel is read-only.
 */
export function ClinicalNotesPanel({
  notes,
  onAddNote,
}: {
  notes: ClinicalNote[];
  onAddNote?: (body: string) => Promise<void>;
}) {
  const demoMode = isDemoMode();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleAdd() {
    if (!draft.trim() || !onAddNote) return;
    setBusy(true);
    setError("");
    try {
      await onAddNote(draft.trim());
      setDraft("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save note.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Clinical notes" className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-slate-200" />
        <h2 className="text-lg font-semibold text-white">Clinical notes</h2>
      </div>

      {notes.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No notes yet"
            body="Dated clinician notes recorded for this case will appear here."
          />
        </div>
      ) : (
        <ol className="mt-4 space-y-3">
          {[...notes]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((note) => (
              <li key={note.id} className="rounded-xl border border-white/10 bg-black/25 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-white">{note.author ?? "Clinician"}</span>
                  <time className="text-xs text-slate-500">{formatDate(note.date)}</time>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-300">{note.body}</p>
              </li>
            ))}
        </ol>
      )}

      {onAddNote && !demoMode ? (
        <div className="mt-5 rounded-xl border border-white/10 bg-black/25 p-4">
          <label htmlFor="clinical-note-draft" className="text-sm font-medium text-white">
            Add note
          </label>
          <textarea
            id="clinical-note-draft"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            placeholder="Record a dated observation for the clinical record…"
            className="mt-2 w-full rounded-lg border border-white/10 bg-midnight px-3 py-2 text-sm text-white placeholder:text-slate-600"
          />
          {error ? <p className="mt-2 text-sm text-rose-200">{error}</p> : null}
          <button
            type="button"
            onClick={handleAdd}
            disabled={busy || !draft.trim()}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-copper-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-copper-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {busy ? "Saving…" : "Save note"}
          </button>
        </div>
      ) : null}

      {demoMode ? (
        <p className="mt-4 text-xs text-slate-500">Demo mode is read-only; notes cannot be added to the seeded cases.</p>
      ) : null}
    </section>
  );
}

export default ClinicalNotesPanel;
