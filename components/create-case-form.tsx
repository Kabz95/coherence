"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createPatientCase } from "@/lib/cases";
import { clinicianEnteredDiagnosisCopy } from "@/lib/clinical-copy";
import { DIAGNOSIS_OPTIONS } from "@/lib/clinical-vocab";
import { useAuth } from "./auth-provider";
import { ProgressBar } from "./progress-bar";

/** Fixed option set for the Sex dropdown. Stored verbatim in Firestore. */
const SEX_OPTIONS = ["Female", "Male", "Other", "Prefer not to say"] as const;

/** Year-of-birth dropdown floor; top is the current year, newest first. */
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

export function CreateCaseForm() {
  const router = useRouter();
  const { identityEmail } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [sex, setSex] = useState("");
  const [notes, setNotes] = useState("");
  const [diagnoses, setDiagnoses] = useState<string[]>([]);
  const [otherDiagnosis, setOtherDiagnosis] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function toggleDiagnosis(option: string) {
    setDiagnoses((current) =>
      current.includes(option) ? current.filter((item) => item !== option) : [...current, option]
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!identityEmail) {
      setMessage("Please sign in before creating a case.");
      return;
    }

    if (!displayName.trim()) {
      setMessage("Enter a display name or case code.");
      return;
    }

    // Dropdowns: the "Select…" placeholder has value "" and must not submit.
    // (The selects are also `required`, so browsers block this natively;
    // these checks are the backstop for programmatic submits.)
    if (!sex) {
      setMessage("Select sex.");
      return;
    }

    if (!birthYear) {
      setMessage("Select a birth year.");
      return;
    }

    const parsedBirthYear = Number(birthYear);
    if (Number.isNaN(parsedBirthYear) || parsedBirthYear < BIRTH_YEAR_MIN || parsedBirthYear > CURRENT_YEAR) {
      setMessage("Birth year must be a valid year.");
      return;
    }

    const establishedDiagnoses = [...diagnoses];
    const trimmedOther = otherDiagnosis.trim();
    if (trimmedOther && !establishedDiagnoses.includes(trimmedOther)) {
      establishedDiagnoses.push(trimmedOther);
    }

    setBusy(true);

    try {
      const patientCase = await createPatientCase({
        displayName: displayName.trim(),
        birthYear: parsedBirthYear,
        sex,
        notes: notes.trim() || undefined,
        clinicalContext: {
          establishedDiagnoses,
          medications: [],
          therapies: [],
          symptomScales: []
        }
      });
      router.refresh();
      router.push(`/cases/${patientCase.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create case. Check Firebase Auth and Firestore rules.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 space-y-4">
      <div>
        <label className={labelClass} htmlFor="case-display-name">Display name or case code</label>
        <input
          id="case-display-name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          className={inputClass}
          maxLength={DISPLAY_NAME_MAX}
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="case-birth-year">Birth year</label>
          <select
            id="case-birth-year"
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
          <label className={labelClass} htmlFor="case-sex">Sex</label>
          <select
            id="case-sex"
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
        <label className={labelClass} htmlFor="case-notes">Notes <span className="font-normal text-slate-500">(optional)</span></label>
        <textarea
          id="case-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className={`${inputClass} min-h-28`}
          maxLength={NOTES_MAX}
        />
      </div>
      <fieldset>
        <legend className={labelClass}>Established diagnoses <span className="font-normal text-slate-500">(optional, select all that apply)</span></legend>
        <p className="mb-2 text-xs text-slate-500">{clinicianEnteredDiagnosisCopy}</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
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
        <label className={`${labelClass} mt-3`} htmlFor="case-diagnosis-other">Other diagnosis <span className="font-normal text-slate-500">(free text, if not listed above)</span></label>
        <input
          id="case-diagnosis-other"
          value={otherDiagnosis}
          onChange={(event) => setOtherDiagnosis(event.target.value)}
          className={inputClass}
          maxLength={DISPLAY_NAME_MAX}
          placeholder="Enter unlisted diagnosis"
        />
      </fieldset>
      <button type="submit" disabled={busy} className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">
        {busy ? "Creating..." : "Create case"}
      </button>
      {busy ? <ProgressBar label="Creating case" detail="Saving to Firestore" /> : null}
      {message ? <p className="text-sm text-gold">{message}</p> : null}
    </form>
  );
}
