"use client";

import { Printer } from "lucide-react";
import { GENERAL_DISCLAIMER } from "@/lib/clinical-copy";
import { buildStructuralReportSections } from "@/lib/reports/structural-summary";
import { buildModalityReportSections } from "@/lib/reports/modality-summary";
import { reportTitle } from "@/lib/repositories/reports";
import type { NeuroRun, PatientCase } from "@/lib/types";
import { EvidenceLedger } from "../evidence-ledger";

const toneStyles: Record<string, string> = {
  neutral: "border-white/10 bg-white/[0.03]",
  caution: "border-amber-300/25 bg-amber-300/[0.07]",
  info: "border-cyan-300/25 bg-cyan-300/[0.07]",
};

/**
 * Unified non-diagnostic report: structured structural sections, evidence
 * ledger, and the interpretation statement, with a print affordance for the
 * symposium walkthrough.
 */
export function UnifiedReport({ run, patientCase }: { run: NeuroRun; patientCase?: PatientCase | null }) {
  const sections =
    run.modality === "structural_mri"
      ? buildStructuralReportSections(run, patientCase)
      : buildModalityReportSections(run);
  const evidence = run.outputs?.evidenceLedger ?? [];

  return (
    <article className="space-y-5">
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-cyan-200/80">Coherence report</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{reportTitle(run, patientCase)}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{GENERAL_DISCLAIMER}</p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <section
            key={section.id}
            className={`rounded-2xl border p-5 ${toneStyles[section.tone ?? "neutral"]}`}
          >
            <h3 className="font-semibold text-white">{section.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">{section.body}</p>
            {section.rows?.length ? (
              <dl className="mt-4 space-y-2">
                {section.rows.map((row) => (
                  <div key={row.label} className="flex flex-col gap-1 rounded-lg bg-black/25 px-3 py-2 sm:flex-row sm:items-baseline sm:justify-between">
                    <dt className="text-xs uppercase tracking-wide text-slate-400">{row.label}</dt>
                    <dd className="text-sm text-slate-100">{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </section>
        ))}
      </div>

      <EvidenceLedger items={evidence} />
    </article>
  );
}

export default UnifiedReport;
