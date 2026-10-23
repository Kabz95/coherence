"use client";

import { Printer } from "lucide-react";
import { GENERAL_DISCLAIMER } from "@/lib/clinical-copy";
import { buildStructuralReportSections } from "@/lib/reports/structural-summary";
import { buildModalityReportSections } from "@/lib/reports/modality-summary";
import { reportTitle } from "@/lib/repositories/reports";
import type { NeuroRun, PatientCase, ReportBlock } from "@/lib/types";
import { EvidenceLedger } from "../evidence-ledger";

const toneStyles: Record<string, string> = {
  neutral: "border-paper-line bg-white",
  caution: "border-amber-300 bg-amber-50",
  info: "border-teal-700/25 bg-teal-50",
};

function ReportRows({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <dl className="mt-4 space-y-2">
      {rows.map((row) => (
        <div key={row.label} className="flex flex-col gap-1 rounded-md bg-paper-subtle px-3 py-2 sm:flex-row sm:items-baseline sm:justify-between">
          <dt className="text-xs uppercase tracking-wide text-slate-500">{row.label}</dt>
          <dd className="text-sm font-medium text-slate-900">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ReportBlockView({ block }: { block: ReportBlock }) {
  return (
    <div className="mt-4">
      {block.heading ? <h4 className="text-sm font-semibold text-slate-900">{block.heading}</h4> : null}
      {block.paragraphs?.map((paragraph, index) => (
        <p key={index} className="mt-2 text-sm leading-6 text-slate-600">{paragraph}</p>
      ))}
      {block.bullets?.length ? (
        <ul className="mt-2 space-y-1.5 text-sm leading-6 text-slate-600">
          {block.bullets.map((bullet, index) => (
            <li key={index} className="flex gap-2">
              <span aria-hidden className="text-teal-700">•</span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {block.rows?.length ? <ReportRows rows={block.rows} /> : null}
    </div>
  );
}

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
    <article className="report-paper space-y-5 rounded-lg bg-paper p-6 text-slate-800 shadow-glow sm:p-8">
      <section className="rounded-lg border border-paper-line bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-teal-700">Coherence report</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">{reportTitle(run, patientCase)}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{GENERAL_DISCLAIMER}</p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 print:hidden"
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
            className={`rounded-lg border p-5 ${toneStyles[section.tone ?? "neutral"]} ${
              section.blocks?.length ? "md:col-span-2" : ""
            }`}
          >
            <h3 className="font-semibold text-slate-900">{section.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{section.body}</p>
            {section.rows?.length ? <ReportRows rows={section.rows} /> : null}
            {section.blocks?.map((block, index) => <ReportBlockView key={index} block={block} />)}
          </section>
        ))}
      </div>

      <EvidenceLedger items={evidence} />
    </article>
  );
}

export default UnifiedReport;
