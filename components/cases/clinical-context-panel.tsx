import { Pill, Stethoscope } from "lucide-react";
import { clinicianEnteredDiagnosisCopy } from "@/lib/clinical-copy";
import type { ClinicalContext } from "@/lib/types";

/** Case summary: clinician-entered diagnoses, medications, therapies, notes. */
export function ClinicalContextPanel({ context }: { context?: ClinicalContext }) {
  if (!context) {
    return (
      <section className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-6 text-sm text-slate-400">
        No clinical context has been recorded for this case yet.
      </section>
    );
  }

  return (
    <section aria-label="Clinical context" className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-semibold text-white">Clinical context</h2>
        <p className="mt-1 text-xs text-slate-500">{clinicianEnteredDiagnosisCopy}</p>

        <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-slate-400">Established diagnoses</h3>
        {context.establishedDiagnoses.length ? (
          <ul className="mt-2 space-y-1 text-sm text-slate-200">
            {context.establishedDiagnoses.map((diagnosis) => (
              <li key={diagnosis}>• {diagnosis}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-500">None recorded.</p>
        )}

        {context.clinicianNotes ? (
          <p className="mt-4 rounded-xl bg-black/25 p-4 text-sm leading-6 text-slate-300">{context.clinicianNotes}</p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center gap-2">
            <Pill className="h-4 w-4 text-violet-200" />
            <h3 className="font-semibold text-white">Medications</h3>
          </div>
          {context.medications.length ? (
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {context.medications.map((medication, index) => (
                <li key={`${medication.name}-${index}`} className="rounded-lg bg-black/25 px-3 py-2">
                  <span className="text-white">{medication.name}</span>
                  {medication.dose ? <span className="text-slate-400"> · {medication.dose}</span> : null}
                  <span className="block text-xs text-slate-500">
                    {medication.startDate ?? "—"} → {medication.endDate ?? "ongoing"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">None recorded.</p>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-amber-200" />
            <h3 className="font-semibold text-white">Therapies</h3>
          </div>
          {context.therapies.length ? (
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {context.therapies.map((therapy, index) => (
                <li key={`${therapy.type}-${index}`} className="rounded-lg bg-black/25 px-3 py-2">
                  <span className="text-white">{therapy.type}</span>
                  {therapy.frequency ? <span className="text-slate-400"> · {therapy.frequency}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">None recorded.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export default ClinicalContextPanel;
