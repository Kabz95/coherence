"use client";

import { useEffect, useState } from "react";
import { UploadPanel } from "@/components/upload-panel";
import { listPatientCases } from "@/lib/cases";
import type { PatientCase } from "@/lib/types";
import { ProgressBar } from "./progress-bar";

export function UploadPageClient() {
  const [cases, setCases] = useState<PatientCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const nextCases = await listPatientCases();
        if (mounted) setCases(nextCases);
      } catch (nextError) {
        if (mounted) setError(nextError instanceof Error ? nextError.message : "Unable to load cases.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <ProgressBar label="Loading upload workflow" detail="Fetching available cases" />;
  }

  if (error) {
    return <div className="rounded-lg border border-rose-300/30 bg-rose-300/10 p-5 text-sm text-rose-100">{error}</div>;
  }

  return <UploadPanel cases={cases} />;
}
