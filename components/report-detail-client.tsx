"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ReportPreview } from "@/components/report-preview";
import { ProgressBar } from "@/components/progress-bar";
import { getPatientCase } from "@/lib/cases";
import { getNeuroRun } from "@/lib/runs";
import type { NeuroRun, PatientCase } from "@/lib/types";

export function ReportDetailClient({ runIdOverride }: { runIdOverride?: string }) {
  const params = useParams<{ runId: string }>();
  const runId = runIdOverride ?? params.runId;
  const [run, setRun] = useState<NeuroRun | null>(null);
  const [patientCase, setPatientCase] = useState<PatientCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const nextRun = await getNeuroRun(runId);
        const nextCase = nextRun ? await getPatientCase(nextRun.caseId) : null;
        if (!mounted) return;
        setRun(nextRun);
        setPatientCase(nextCase);
      } catch (nextError) {
        if (mounted) setError(nextError instanceof Error ? nextError.message : "Unable to load report.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [runId]);

  if (loading) return <ProgressBar label="Loading report" detail="Fetching report inputs" />;
  if (error || !run) return <div className="rounded-lg border border-rose-300/30 bg-rose-300/10 p-5 text-sm text-rose-100">{error || "Report not found."}</div>;

  return <ReportPreview run={run} patientCase={patientCase} />;
}
