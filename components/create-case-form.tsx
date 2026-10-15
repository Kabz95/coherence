"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createPatientCase } from "@/lib/cases";
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

export function CreateCaseForm() {
  const router = useRouter();
  const { identityEmail } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [sex, setSex] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

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

    setBusy(true);

    try {
      const patientCase = await createPatientCase({
        displayName: displayName.trim(),
        birthYear: parsedBirthYear,
        sex,
        notes: notes.trim() || undefined
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
      <input
        value={displayName}
        onChange={(event) => setDisplayName(event.target.value)}
        className="w-full rounded-md border border-white/10 bg-midnight px-3 py-2 text-sm text-white"
        placeholder="Display name or case code"
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <select
          value={birthYear}
          onChange={(event) => setBirthYear(event.target.value)}
          required
          aria-label="Birth year"
          className="rounded-md border border-white/10 bg-midnight px-3 py-2 text-sm text-white"
        >
          <option value="" disabled>Select birth year…</option>
          {BIRTH_YEARS.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
        <select
          value={sex}
          onChange={(event) => setSex(event.target.value)}
          required
          aria-label="Sex"
          className="rounded-md border border-white/10 bg-midnight px-3 py-2 text-sm text-white"
        >
          <option value="" disabled>Select sex…</option>
          {SEX_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>
      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        className="min-h-28 w-full rounded-md border border-white/10 bg-midnight px-3 py-2 text-sm text-white"
        placeholder="Notes optional"
      />
      <button type="submit" disabled={busy} className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">
        {busy ? "Creating..." : "Create case"}
      </button>
      {busy ? <ProgressBar label="Creating case" detail="Saving to Firestore" /> : null}
      {message ? <p className="text-sm text-gold">{message}</p> : null}
    </form>
  );
}
