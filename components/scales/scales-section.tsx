"use client";

import { useState } from "react";
import { updatePatientCase } from "@/lib/cases";
import type { PatientCase, SymptomScaleEntry } from "@/lib/types";
import { RecordScaleForm } from "./record-scale-form";
import { ScaleHistory } from "./scale-history";

interface ScalesSectionProps {
  patientCase: PatientCase;
  entries: SymptomScaleEntry[];
  onSaved: () => void;
}

/**
 * Scales tab: record new administrations and review per-instrument history.
 * Editing a recorded administration is intentionally not offered inline —
 * corrections belong in the edit-case view's history model, not silent edits.
 */
export function ScalesSection({ patientCase, entries, onSaved }: ScalesSectionProps) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSave(entry: SymptomScaleEntry) {
    setSaving(true);
    setSaveError(null);
    try {
      const context = patientCase.clinicalContext ?? {
        establishedDiagnoses: [],
        medications: [],
        therapies: [],
        symptomScales: [],
      };
      await updatePatientCase(patientCase.id, {
        clinicalContext: {
          ...context,
          symptomScales: [...(context.symptomScales ?? []), entry],
        },
      });
      onSaved();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save the scale.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <RecordScaleForm onSave={handleSave} saving={saving} />
      {saveError ? <p className="text-xs text-red-400">{saveError}</p> : null}
      <ScaleHistory entries={entries} />
    </div>
  );
}
