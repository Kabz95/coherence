"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createPatientCase } from "@/lib/cases";
import { useAuth } from "./auth-provider";
import { ProgressBar } from "./progress-bar";

export function CreateCaseForm() {
  const router = useRouter();
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [sex, setSex] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!user) {
      setMessage("Please sign in before creating a case.");
      return;
    }

    if (!displayName.trim()) {
      setMessage("Enter a display name or case code.");
      return;
    }

    const parsedBirthYear = birthYear.trim() ? Number(birthYear) : undefined;
    if (parsedBirthYear && (Number.isNaN(parsedBirthYear) || parsedBirthYear < 1900 || parsedBirthYear > new Date().getFullYear())) {
      setMessage("Birth year must be a valid year.");
      return;
    }

    setBusy(true);

    try {
      const patientCase = await createPatientCase({
        displayName: displayName.trim(),
        birthYear: parsedBirthYear,
        sex: sex.trim() || undefined,
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
        <input
          value={birthYear}
          onChange={(event) => setBirthYear(event.target.value)}
          inputMode="numeric"
          className="rounded-md border border-white/10 bg-midnight px-3 py-2 text-sm text-white"
          placeholder="Birth year optional"
        />
        <input
          value={sex}
          onChange={(event) => setSex(event.target.value)}
          className="rounded-md border border-white/10 bg-midnight px-3 py-2 text-sm text-white"
          placeholder="Sex optional"
        />
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
