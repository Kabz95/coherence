import { Pill } from "lucide-react";
import { clinicianEnteredDiagnosisCopy } from "@/lib/clinical-copy";
import type { MedicationEntry } from "@/lib/types";
import { EmptyState } from "../ui/state";

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Medication history as a dated list. Clinician-entered context only. */
export function MedicationTimeline({ medications }: { medications: MedicationEntry[] }) {
  if (!medications.length) {
    return (
      <EmptyState
        title="No medications recorded"
        body="Medication entries recorded by the clinician will appear here with start and end dates."
        icon={<Pill className="h-8 w-8" />}
      />
    );
  }

  return (
    <section aria-label="Medication timeline" className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-lg font-semibold text-white">Medication timeline</h2>
      <p className="mt-1 text-xs text-slate-500">{clinicianEnteredDiagnosisCopy}</p>
      <ol className="mt-5 space-y-4">
        {medications.map((medication, index) => (
          <li key={`${medication.name}-${medication.startDate ?? index}`} className="flex gap-4 rounded-xl border border-white/10 bg-black/25 p-4">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-violet-300/10 text-violet-200">
              <Pill className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h3 className="font-medium text-white">{medication.name}</h3>
                {medication.dose ? <span className="text-sm text-slate-300">{medication.dose}</span> : null}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {formatDate(medication.startDate)} → {medication.endDate ? formatDate(medication.endDate) : "ongoing"}
              </p>
              {medication.notes ? <p className="mt-2 text-sm leading-6 text-slate-300">{medication.notes}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default MedicationTimeline;
