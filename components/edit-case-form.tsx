"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getPatientCase, updatePatientCase } from "@/lib/cases";
import { clinicianEnteredDiagnosisCopy } from "@/lib/clinical-copy";
import { COMMON_MEDICATIONS, DIAGNOSIS_OPTIONS } from "@/lib/clinical-vocab";
import type { ClinicalNote, MedicationEntry, TherapyEntry } from "@/lib/types";
import { useAuth } from "./auth-provider";
import { ProgressBar } from "./progress-bar";
import { ErrorState } from "./ui/state";

const SEX_OPTIONS = ["Female", "Male", "Other", "Prefer not to say"] as const;
const BIRTH_YEAR_MIN = 1900;
const CURRENT_YEAR = new Date().getFullYear();
const BIRTH_YEARS: number[] = Array.from(
  { length: CURRENT_YEAR - BIRTH_YEAR_MIN + 1 },
  (_, index) => CURRENT_YEAR - index
);

const DISPLAY_NAME_MAX = 120;
const NOTES_MAX = 2000;

const inputClass =
  "w-full rounded-md border border-white/10 bg-midnight px-3 py-2 text-sm text-white";
const labelClass = "mb-1 block text-sm font-medium text-slate-200";
const sectionClass = "rounded-2xl border border-white/10 bg-white/[0.03] p-6";
const removeClass =
  "rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:border-rose-300/50 hover:text-rose-200";

interface MedicationDraft extends MedicationEntry {
  key: string;
}

interface TherapyDraft extends TherapyEntry {
  key: string;
}

let draftKey = 0;
function nextKey() {
  draftKey += 1;
  return `draft-${Date.now()}-${draftKey}`;
}

function emptyMedication(): MedicationDraft {
  return { key: nextKey(), name: "", dose: "", startDate: "", endDate: "" };
}

function emptyTherapy(): TherapyDraft {
  return { key: nextKey(), type: "", frequency: "", startDate: "", endDate: "" };
}

export function EditCaseForm({ caseId }: { caseId: string }) {
  const router = useRouter();
  const { identityEmail } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [sex, setSex] = useState("");
  const [notes, setNotes] = useState("");
  const [diagnoses, setDiagnoses] = useState<string[]>([]);
  const [otherDiagnoses, setOtherDiagnoses] = useState<string[]>([]);
  const [otherInput, setOtherInput] = useState("");
  const [medications, setMedications] = useState<MedicationDraft[]>([]);
  const [therapies, setTherapies] = useState<TherapyDraft[]>([]);
  // Preserved verbatim on save: the edit form does not manage these fields.
  const [preservedNotes, setPreservedNotes] = useState<ClinicalNote[]>([]);
  const [preservedClinicianNotes, setPreservedClinicianNotes] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const patientCase = await getPatientCase(caseId);
        if (cancelled) return;
        if (!patientCase) {
          setLoadError("Case not found. It may have been deleted.");
          return;
        }
        setDisplayName(patientCase.displayName);
        setBirthYear(patientCase.birthYear ? String(patientCase.birthYear) : "");
        setSex(patientCase.sex ?? "");
        setNotes(patientCase.notes ?? "");
        const context = patientCase.clinicalContext;
        // Existing free-text values are never silently recoded: listed terms
        // are checked, anything else stays visible as an "other" entry.
        setDiagnoses((context?.establishedDiagnoses ?? []).filter((d) => DIAGNOSIS_OPTIONS.includes(d)));
        setOtherDiagnoses((context?.establishedDiagnoses ?? []).filter((d) => !DIAGNOSIS_OPTIONS.includes(d)));
        setMedications(
          (context?.medications ?? []).map((med) => ({ ...med, key: nextKey() }))
        );
        setTherapies(
          (context?.therapies ?? []).map((therapy) => ({ ...therapy, key: nextKey() }))
        );
        setPreservedNotes(context?.notes ?? []);
        setPreservedClinicianNotes(context?.clinicianNotes);
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Unable to load case.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  function toggleDiagnosis(option: string) {
    setDiagnoses((current) =>
      current.includes(option) ? current.filter((item) => item !== option) : [...current, option]
    );
  }

  function addOtherDiagnosis() {
    const value = otherInput.trim();
    if (!value) return;
    if (diagnoses.includes(value) || otherDiagnoses.includes(value)) {
      setMessage(`"${value}" is already recorded.`);
      return;
    }
    setOtherDiagnoses((current) => [...current, value]);
    setOtherInput("");
    setMessage("");
  }

  function updateMedication(key: string, patch: Partial<MedicationDraft>) {
    setMedications((current) => current.map((med) => (med.key === key ? { ...med, ...patch } : med)));
  }

  function updateTherapy(key: string, patch: Partial<TherapyDraft>) {
    setTherapies((current) => current.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!identityEmail) {
      setMessage("Please sign in before editing a case.");
      return;
    }

    if (!displayName.trim()) {
      setMessage("Enter a display name or case code.");
      return;
    }

    if (!sex || !birthYear) {
      setMessage("Select sex and birth year.");
      return;
    }

    const parsedBirthYear = Number(birthYear);
    if (Number.isNaN(parsedBirthYear) || parsedBirthYear < BIRTH_YEAR_MIN || parsedBirthYear > CURRENT_YEAR) {
      setMessage("Birth year must be a valid year.");
      return;
    }

    for (const med of medications) {
      if (!med.name.trim()) {
        setMessage("Every medication entry needs a name, or remove the empty row.");
        return;
      }
      if (!med.dose?.trim()) {
        setMessage(`Dose is required for ${med.name.trim()}.`);
        return;
      }
      if (med.startDate && med.endDate && med.endDate < med.startDate) {
        setMessage(`End date cannot precede start date for ${med.name.trim()}.`);
        return;
      }
    }

    for (const therapy of therapies) {
      if (!therapy.type.trim()) {
        setMessage("Every therapy entry needs a type, or remove the empty row.");
        return;
      }
      if (therapy.startDate && therapy.endDate && therapy.endDate < therapy.startDate) {
        setMessage(`End date cannot precede start date for ${therapy.type.trim()}.`);
        return;
      }
    }

    const establishedDiagnoses = [...diagnoses, ...otherDiagnoses];

    setBusy(true);
    try {
      await updatePatientCase(caseId, {
        displayName: displayName.trim(),
        birthYear: parsedBirthYear,
        sex,
        notes: notes.trim(),
        clinicalContext: {
          establishedDiagnoses,
          medications: medications.map(({ key: _key, ...med }) => ({
            name: med.name.trim(),
            dose: med.dose?.trim() || undefined,
            startDate: med.startDate || undefined,
            endDate: med.endDate || undefined
          })),
          therapies: therapies.map(({ key: _key, ...therapy }) => ({
            type: therapy.type.trim(),
            frequency: therapy.frequency?.trim() || undefined,
            startDate: therapy.startDate || undefined,
            endDate: therapy.endDate || undefined
          })),
          symptomScales: [],
          ...(preservedClinicianNotes ? { clinicianNotes: preservedClinicianNotes } : {}),
          ...(preservedNotes.length ? { notes: preservedNotes } : {})
        }
      });
      router.push(`/cases/${caseId}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save changes.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <ProgressBar label="Loading case" detail="Fetching case record" />;
  if (loadError) return <ErrorState body={loadError} />;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className={sectionClass}>
        <h2 className="text-lg font-semibold text-white">Case details</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className={labelClass} htmlFor="edit-display-name">Display name or case code</label>
            <input
              id="edit-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className={inputClass}
              maxLength={DISPLAY_NAME_MAX}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="edit-birth-year">Birth year</label>
              <select
                id="edit-birth-year"
                value={birthYear}
                onChange={(event) => setBirthYear(event.target.value)}
                required
                className={inputClass}
              >
                <option value="" disabled>Select birth year…</option>
                {BIRTH_YEARS.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="edit-sex">Sex</label>
              <select
                id="edit-sex"
                value={sex}
                onChange={(event) => setSex(event.target.value)}
                required
                className={inputClass}
              >
                <option value="" disabled>Select sex…</option>
                {SEX_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="edit-notes">Notes <span className="font-normal text-slate-500">(optional)</span></label>
            <textarea
              id="edit-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className={`${inputClass} min-h-28`}
              maxLength={NOTES_MAX}
            />
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        <h2 className="text-lg font-semibold text-white">Established diagnoses</h2>
        <p className="mt-1 text-xs text-slate-500">{clinicianEnteredDiagnosisCopy}</p>
        <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
          {DIAGNOSIS_OPTIONS.map((option) => (
            <label key={option} className="flex cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-200 hover:border-cyan-300/40">
              <input
                type="checkbox"
                checked={diagnoses.includes(option)}
                onChange={() => toggleDiagnosis(option)}
                className="h-4 w-4 accent-cyan-300"
              />
              {option}
            </label>
          ))}
        </div>
        <div className="mt-4">
          <span className={labelClass}>Other diagnoses</span>
          {otherDiagnoses.length > 0 ? (
            <ul className="mb-2 flex flex-wrap gap-2">
              {otherDiagnoses.map((other) => (
                <li key={other} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-1 text-sm text-slate-200">
                  {other}
                  <button
                    type="button"
                    aria-label={`Remove ${other}`}
                    onClick={() => setOtherDiagnoses((current) => current.filter((item) => item !== other))}
                    className="text-slate-400 hover:text-rose-200"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex gap-2">
            <input
              value={otherInput}
              onChange={(event) => setOtherInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addOtherDiagnosis();
                }
              }}
              className={inputClass}
              maxLength={DISPLAY_NAME_MAX}
              placeholder="Unlisted diagnosis, then Add"
              aria-label="Other diagnosis"
            />
            <button type="button" onClick={addOtherDiagnosis} className="shrink-0 rounded-md border border-white/10 px-4 py-2 text-sm text-slate-200 hover:border-cyan-300/40">
              Add
            </button>
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Medications</h2>
          <button
            type="button"
            onClick={() => setMedications((current) => [...current, emptyMedication()])}
            className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-slate-200 hover:border-cyan-300/40"
          >
            + Add medication
          </button>
        </div>
        {medications.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">None recorded.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {medications.map((med) => (
              <li key={med.key} className="rounded-xl border border-white/10 bg-black/25 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass} htmlFor={`med-name-${med.key}`}>Name</label>
                    <input
                      id={`med-name-${med.key}`}
                      value={med.name}
                      onChange={(event) => updateMedication(med.key, { name: event.target.value })}
                      list="common-medications"
                      className={inputClass}
                      maxLength={DISPLAY_NAME_MAX}
                      placeholder="Start typing…"
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor={`med-dose-${med.key}`}>Dose</label>
                    <input
                      id={`med-dose-${med.key}`}
                      value={med.dose ?? ""}
                      onChange={(event) => updateMedication(med.key, { dose: event.target.value })}
                      className={inputClass}
                      maxLength={60}
                      placeholder="e.g. 50 mg daily"
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor={`med-start-${med.key}`}>Start date <span className="font-normal text-slate-500">(optional)</span></label>
                    <input
                      id={`med-start-${med.key}`}
                      type="date"
                      value={med.startDate ?? ""}
                      onChange={(event) => updateMedication(med.key, { startDate: event.target.value })}
                      className={`${inputClass} [color-scheme:dark]`}
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor={`med-end-${med.key}`}>End date <span className="font-normal text-slate-500">(optional)</span></label>
                    <input
                      id={`med-end-${med.key}`}
                      type="date"
                      value={med.endDate ?? ""}
                      onChange={(event) => updateMedication(med.key, { endDate: event.target.value })}
                      className={`${inputClass} [color-scheme:dark]`}
                    />
                  </div>
                </div>
                <div className="mt-3 text-right">
                  <button
                    type="button"
                    onClick={() => setMedications((current) => current.filter((item) => item.key !== med.key))}
                    className={removeClass}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <datalist id="common-medications">
          {COMMON_MEDICATIONS.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </section>

      <section className={sectionClass}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Therapies</h2>
          <button
            type="button"
            onClick={() => setTherapies((current) => [...current, emptyTherapy()])}
            className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-slate-200 hover:border-cyan-300/40"
          >
            + Add therapy
          </button>
        </div>
        {therapies.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">None recorded.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {therapies.map((therapy) => (
              <li key={therapy.key} className="rounded-xl border border-white/10 bg-black/25 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass} htmlFor={`therapy-type-${therapy.key}`}>Type</label>
                    <input
                      id={`therapy-type-${therapy.key}`}
                      value={therapy.type}
                      onChange={(event) => updateTherapy(therapy.key, { type: event.target.value })}
                      className={inputClass}
                      maxLength={DISPLAY_NAME_MAX}
                      placeholder="e.g. CBT, DBT skills group"
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor={`therapy-freq-${therapy.key}`}>Frequency <span className="font-normal text-slate-500">(optional)</span></label>
                    <input
                      id={`therapy-freq-${therapy.key}`}
                      value={therapy.frequency ?? ""}
                      onChange={(event) => updateTherapy(therapy.key, { frequency: event.target.value })}
                      className={inputClass}
                      maxLength={60}
                      placeholder="e.g. weekly"
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor={`therapy-start-${therapy.key}`}>Start date <span className="font-normal text-slate-500">(optional)</span></label>
                    <input
                      id={`therapy-start-${therapy.key}`}
                      type="date"
                      value={therapy.startDate ?? ""}
                      onChange={(event) => updateTherapy(therapy.key, { startDate: event.target.value })}
                      className={`${inputClass} [color-scheme:dark]`}
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor={`therapy-end-${therapy.key}`}>End date <span className="font-normal text-slate-500">(optional)</span></label>
                    <input
                      id={`therapy-end-${therapy.key}`}
                      type="date"
                      value={therapy.endDate ?? ""}
                      onChange={(event) => updateTherapy(therapy.key, { endDate: event.target.value })}
                      className={`${inputClass} [color-scheme:dark]`}
                    />
                  </div>
                </div>
                <div className="mt-3 text-right">
                  <button
                    type="button"
                    onClick={() => setTherapies((current) => current.filter((item) => item.key !== therapy.key))}
                    className={removeClass}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? "Saving..." : "Save changes"}
        </button>
        {busy ? <ProgressBar label="Saving case" detail="Updating Firestore" /> : null}
      </div>
      {message ? <p className="text-sm text-gold">{message}</p> : null}
    </form>
  );
}
