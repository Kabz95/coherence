import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CaseCard } from "@/components/case-card";
import { DisclaimerBanner } from "@/components/disclaimer-banner";
import { StatusChip } from "@/components/status-chip";
import { listPatientCases } from "@/lib/cases";
import { listRecentRuns } from "@/lib/runs";

export default async function DashboardPage() {
  const [cases, runs] = await Promise.all([listPatientCases(), listRecentRuns()]);
  const running = runs.filter((run) => run.status === "running").length;
  const completed = runs.filter((run) => run.status === "completed").length;

  return (
    <AppShell>
      <div className="space-y-6">
        <DisclaimerBanner compact />
        <section className="grid gap-4 md:grid-cols-4">
          {[
            ["Cases", cases.length],
            ["Runs", runs.length],
            ["Running", running],
            ["Completed", completed]
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-line bg-panel/75 p-5">
              <div className="text-sm text-slate-400">{label}</div>
              <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
            </div>
          ))}
        </section>
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Recent cases</h2>
              <Link href="/cases" className="text-sm text-cyan-200">View all</Link>
            </div>
            <div className="grid gap-4">
              {cases.slice(0, 3).map((patientCase) => (
                <CaseCard key={patientCase.id} patientCase={patientCase} latestRun={runs.find((run) => run.caseId === patientCase.id)} />
              ))}
            </div>
          </section>
          <section className="rounded-lg border border-line bg-panel/75 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Recent runs</h2>
              <Link href="/upload" className="rounded-md bg-cyan-300 px-3 py-2 text-sm font-medium text-slate-950">Upload data</Link>
            </div>
            <div className="mt-4 divide-y divide-white/10">
              {runs.map((run) => (
                <Link key={run.id} href={`/cases/${run.caseId}/runs/${run.id}`} className="flex items-center justify-between gap-3 py-4">
                  <div>
                    <div className="font-medium text-white">{run.id}</div>
                    <div className="mt-1 text-sm capitalize text-slate-400">{run.modality.replace("_", " ")}</div>
                  </div>
                  <StatusChip status={run.status} />
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
