import Link from "next/link";
import { CalendarDays, UserRound } from "lucide-react";
import type { NeuroRun, PatientCase } from "@/lib/types";
import { StatusChip } from "./status-chip";

export function CaseCard({ patientCase, latestRun }: { patientCase: PatientCase; latestRun?: NeuroRun }) {
  return (
    <Link href={`/cases/${patientCase.id}`} className="block rounded-lg border border-line bg-panel/80 p-5 shadow-glow transition hover:border-cyan-300/45 hover:bg-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">{patientCase.displayName}</h2>
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-300">
            <span className="inline-flex items-center gap-1.5"><UserRound className="h-4 w-4" />{patientCase.sex ?? "Sex not specified"}</span>
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{patientCase.birthYear ?? "Birth year omitted"}</span>
          </div>
        </div>
        {latestRun ? <StatusChip status={latestRun.status} /> : <span className="text-xs text-slate-400">No runs</span>}
      </div>
      <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-300">{patientCase.notes ?? "No case notes entered."}</p>
    </Link>
  );
}
