import type { NeuroRun, PatientCase } from "@/lib/types";
import { UnifiedReport } from "./reports/unified-report";

/**
 * Backwards-compatible report preview: renders the unified non-diagnostic
 * report for a run.
 */
export function ReportPreview({ run, patientCase }: { run: NeuroRun; patientCase?: PatientCase | null }) {
  return <UnifiedReport run={run} patientCase={patientCase} />;
}

export default ReportPreview;
