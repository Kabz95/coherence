"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getPatientCase, updatePatientCase } from "@/lib/cases";
import { clinicianEnteredDiagnosisCopy } from "@/lib/clinical-copy";
import { COMMON_MEDICATIONS, DIAGNOSIS_OPTIONS } from "@/lib/clinical-vocab";
import type {
  ClinicalNote,
  CollateralEntry,
  LabEntry,
  LifeEvent,
  MedicationEntry,
  ReferralQuestion,
  SleepSummary,
  TherapyEntry
} from "@/lib/types";
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

interface LabDraft extends LabEntry {
  key: string;
}

interface SleepDraft extends SleepSummary {
  key: string;
}

interface LifeEventDraft extends LifeEvent {
  key: string;
}

interface CollateralDraft extends CollateralEntry {
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

function emptyLab(): LabDraft {
  return { key: nextKey(), testName: "", date: "", value: "" };
}

function emptySleep(): SleepDraft {
  return { key: nextKey(), startDate: "", endDate: "", source: "clinician" };
}

function emptyLifeEvent(): LifeEventDraft {
  return { key: nextKey(), date: "", category: "" };
}

function emptyCollateral(): CollateralDraft {
  return { key: nextKey(), relationship: "", date: "", account: "" };
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
  const [labs, setLabs] = useState<LabDraft[]>([]);
  const [sleepSummaries, setSleepSummaries] = useState<SleepDraft[]>([]);
  const [lifeEvents, setLifeEvents] = useState<LifeEventDraft[]>([]);
  const [collateralEntries, setCollateralEntries] = useState<CollateralDraft[]>([]);
  const [referralText, setReferralText] = useState("");
  const [referralAuthor, setReferralAuthor] = useState("");
  const [referralHistory, setReferralHistory] = useState<ReferralQuestion["history"]>([]);
  // Originally loaded question, for supersede-on-change history.
  const [loadedQuestion, setLoadedQuestion] = useState<ReferralQuestion | undefined>(undefined);
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
        setLabs((context?.labEntries ?? []).map((lab) => ({ ...lab, key: nextKey() })));
        setSleepSummaries((context?.sleepSummaries ?? []).map((sleep) => ({ ...sleep, key: nextKey() })));
        setLifeEvents((context?.lifeEvents ?? []).map((event) => ({ ...event, key: nextKey() })));
        setCollateralEntries((context?.collateralEntries ?? []).map((entry) => ({ ...entry, key: nextKey() })));
        setPreservedNotes(context?.notes ?? []);
        setPreservedClinicianNotes(context?.clinicianNotes);
        const question = patientCase.referralQuestion;
        setReferralText(question?.text ?? "");
        setReferralAuthor(question?.author ?? "");
        setReferralHistory(question?.history ?? []);
        setLoadedQuestion(question);
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

  function updateLab(key: string, patch: Partial<LabDraft>) {
    setLabs((current) => current.map((lab) => (lab.key === key ? { ...lab, ...patch } : lab)));
  }

  function updateSleep(key: string, patch: Partial<SleepDraft>) {
    setSleepSummaries((current) => current.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function updateLifeEvent(key: string, patch: Partial<LifeEventDraft>) {
    setLifeEvents((current) => current.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  }

  function updateCollateral(key: string, patch: Partial<CollateralDraft>) {
    setCollateralEntries((current) => current.map((c) => (c.key === key ? { ...c, ...patch } : c)));
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

    for (const lab of labs) {
      if (!lab.testName.trim() || !lab.date || !lab.value.trim()) {
        setMessage("Every lab entry needs a test name, a date, and a value, or remove the empty row.");
        return;
      }
    }

    for (const sleep of sleepSummaries) {
      if (!sleep.startDate || !sleep.endDate) {
        setMessage("Every sleep summary needs a start and end date, or remove the empty row.");
        return;
      }
      if (sleep.endDate < sleep.startDate) {
        setMessage("Sleep summary end date cannot precede its start date.");
        return;
      }
    }

    for (const lifeEvent of lifeEvents) {
      if (!lifeEvent.category.trim() || !lifeEvent.date) {
        setMessage("Every life event needs a category and a date, or remove the empty row.");
        return;
      }
      if (lifeEvent.endDate && lifeEvent.endDate < lifeEvent.date) {
        setMessage("Life event end date cannot precede its start date.");
        return;
      }
    }

    for (const entry of collateralEntries) {
      if (!entry.relationship.trim() || !entry.account.trim()) {
        setMessage("Every collateral entry needs a relationship and an account, or remove the empty row.");
        return;
      }
    }

    const establishedDiagnoses = [...diagnoses, ...otherDiagnoses];

    // Referral question: a changed question supersedes the loaded one, which
    // is retained in history so the development of the clinical thinking
    // stays visible. Clearing the text removes the question.
    const trimmedQuestion = referralText.trim();
    const trimmedAuthor = referralAuthor.trim() || undefined;
    let referralQuestion: ReferralQuestion;
    if (loadedQuestion && trimmedQuestion && trimmedQuestion !== loadedQuestion.text) {
      referralQuestion = {
        text: trimmedQuestion,
        date: new Date().toISOString(),
        ...(trimmedAuthor ? { author: trimmedAuthor } : {}),
        history: [
          {
            text: loadedQuestion.text,
            date: loadedQuestion.date,
            ...(loadedQuestion.author ? { author: loadedQuestion.author } : {}),
          },
          ...referralHistory,
        ],
      };
    } else {
      referralQuestion = {
        text: trimmedQuestion,
        date: loadedQuestion?.date ?? new Date().toISOString(),
        ...(trimmedAuthor ? { author: trimmedAuthor } : {}),
        history: referralHistory,
      };
    }

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
          labEntries: labs.map(({ key: _key, ...lab }) => ({
            testName: lab.testName.trim(),
            date: lab.date,
            value: lab.value.trim(),
            unit: lab.unit?.trim() || undefined,
            referenceRange: lab.referenceRange?.trim() || undefined,
            notes: lab.notes?.trim() || undefined
          })),
          sleepSummaries: sleepSummaries.map(({ key: _key, ...sleep }) => ({
            startDate: sleep.startDate,
            endDate: sleep.endDate,
            typicalDuration: sleep.typicalDuration?.trim() || undefined,
            quality: sleep.quality?.trim() || undefined,
            disruption: sleep.disruption?.trim() || undefined,
            source: sleep.source
          })),
          lifeEvents: lifeEvents.map(({ key: _key, ...event }) => ({
            date: event.date,
            endDate: event.endDate || undefined,
            category: event.category.trim(),
            note: event.note?.trim() || undefined
          })),
          collateralEntries: collateralEntries.map(({ key: _key, ...entry }) => ({
            informantName: entry.informantName?.trim() || undefined,
            relationship: entry.relationship.trim(),
            date: entry.date,
            periodStart: entry.periodStart || undefined,
            periodEnd: entry.periodEnd || undefined,
            account: entry.account.trim()
          })),
          ...(preservedClinicianNotes ? { clinicianNotes: preservedClinicianNotes } : {}),
          ...(preservedNotes.length ? { notes: preservedNotes } : {})
        },
        referralQuestion
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
            <label key={option} className="flex cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-200 hover:border-copper-300/40">
              <input
                type="checkbox"
                checked={diagnoses.includes(option)}
                onChange={() => toggleDiagnosis(option)}
                className="h-4 w-4 accent-copper-300"
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
            <button type="button" onClick={addOtherDiagnosis} className="shrink-0 rounded-md border border-white/10 px-4 py-2 text-sm text-slate-200 hover:border-copper-300/40">
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
            className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-slate-200 hover:border-copper-300/40"
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
            className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-slate-200 hover:border-copper-300/40"
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

      <section className={sectionClass}>
        <h2 className="text-lg font-semibold text-white">Referral question</h2>
        <p className="mt-1 text-xs text-slate-500">
          The question you are bringing to this case, in your own words. It stays pinned above the
          timeline. Editing it supersedes the previous version, which remains viewable below.
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <label className={labelClass} htmlFor="edit-referral">Question <span className="font-normal text-slate-500">(optional — clearing removes it)</span></label>
            <textarea
              id="edit-referral"
              value={referralText}
              onChange={(event) => setReferralText(event.target.value)}
              className={`${inputClass} min-h-20`}
              maxLength={NOTES_MAX}
              placeholder="e.g. Is there a neuroimaging correlate for this treatment-resistant course?"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="edit-referral-author">Author <span className="font-normal text-slate-500">(optional)</span></label>
            <input
              id="edit-referral-author"
              value={referralAuthor}
              onChange={(event) => setReferralAuthor(event.target.value)}
              className={inputClass}
              maxLength={DISPLAY_NAME_MAX}
              placeholder="Your name or role"
            />
          </div>
          {referralHistory.length > 0 ? (
            <div>
              <span className={labelClass}>Earlier versions</span>
              <ul className="space-y-2">
                {referralHistory.map((version, index) => (
                  <li key={`${version.date}-${index}`} className="rounded-lg bg-black/25 px-3 py-2 text-sm text-slate-400">
                    “{version.text}”
                    <span className="block text-xs text-slate-500">
                      {version.author ? `${version.author} · ` : ""}{version.date.slice(0, 10)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      <section className={sectionClass}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Laboratory entries</h2>
            <p className="mt-1 text-xs text-slate-500">Values are shown with the lab's own reference range. No flagging beyond it.</p>
          </div>
          <button
            type="button"
            onClick={() => setLabs((current) => [...current, emptyLab()])}
            className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-slate-200 hover:border-copper-300/40"
          >
            + Add lab entry
          </button>
        </div>
        {labs.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">None recorded.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {labs.map((lab) => (
              <li key={lab.key} className="rounded-xl border border-white/10 bg-black/25 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass} htmlFor={`lab-name-${lab.key}`}>Test name</label>
                    <input id={`lab-name-${lab.key}`} value={lab.testName} onChange={(event) => updateLab(lab.key, { testName: event.target.value })} className={inputClass} maxLength={DISPLAY_NAME_MAX} placeholder="e.g. TSH" />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor={`lab-date-${lab.key}`}>Date</label>
                    <input id={`lab-date-${lab.key}`} type="date" value={lab.date} onChange={(event) => updateLab(lab.key, { date: event.target.value })} className={`${inputClass} [color-scheme:dark]`} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor={`lab-value-${lab.key}`}>Value</label>
                    <input id={`lab-value-${lab.key}`} value={lab.value} onChange={(event) => updateLab(lab.key, { value: event.target.value })} className={inputClass} maxLength={60} placeholder="e.g. 2.1" />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor={`lab-unit-${lab.key}`}>Unit <span className="font-normal text-slate-500">(optional)</span></label>
                    <input id={`lab-unit-${lab.key}`} value={lab.unit ?? ""} onChange={(event) => updateLab(lab.key, { unit: event.target.value })} className={inputClass} maxLength={30} placeholder="e.g. mIU/L" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass} htmlFor={`lab-range-${lab.key}`}>Reference range <span className="font-normal text-slate-500">(as reported by the lab)</span></label>
                    <input id={`lab-range-${lab.key}`} value={lab.referenceRange ?? ""} onChange={(event) => updateLab(lab.key, { referenceRange: event.target.value })} className={inputClass} maxLength={60} placeholder="e.g. 0.4 – 4.0" />
                  </div>
                </div>
                <div className="mt-3 text-right">
                  <button type="button" onClick={() => setLabs((current) => current.filter((item) => item.key !== lab.key))} className={removeClass}>Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={sectionClass}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Sleep summaries</h2>
            <p className="mt-1 text-xs text-slate-500">Summaries over a period — not raw device streams. Source is recorded.</p>
          </div>
          <button
            type="button"
            onClick={() => setSleepSummaries((current) => [...current, emptySleep()])}
            className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-slate-200 hover:border-copper-300/40"
          >
            + Add sleep summary
          </button>
        </div>
        {sleepSummaries.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">None recorded.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {sleepSummaries.map((sleep) => (
              <li key={sleep.key} className="rounded-xl border border-white/10 bg-black/25 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass} htmlFor={`sleep-start-${sleep.key}`}>Period start</label>
                    <input id={`sleep-start-${sleep.key}`} type="date" value={sleep.startDate} onChange={(event) => updateSleep(sleep.key, { startDate: event.target.value })} className={`${inputClass} [color-scheme:dark]`} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor={`sleep-end-${sleep.key}`}>Period end</label>
                    <input id={`sleep-end-${sleep.key}`} type="date" value={sleep.endDate} onChange={(event) => updateSleep(sleep.key, { endDate: event.target.value })} className={`${inputClass} [color-scheme:dark]`} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor={`sleep-source-${sleep.key}`}>Source</label>
                    <select id={`sleep-source-${sleep.key}`} value={sleep.source} onChange={(event) => updateSleep(sleep.key, { source: event.target.value as SleepDraft["source"] })} className={inputClass}>
                      <option value="clinician">Clinician-entered</option>
                      <option value="patient">Patient-reported</option>
                      <option value="device">Device summary</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor={`sleep-duration-${sleep.key}`}>Typical duration <span className="font-normal text-slate-500">(optional)</span></label>
                    <input id={`sleep-duration-${sleep.key}`} value={sleep.typicalDuration ?? ""} onChange={(event) => updateSleep(sleep.key, { typicalDuration: event.target.value })} className={inputClass} maxLength={60} placeholder="e.g. 5–6 hours" />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor={`sleep-quality-${sleep.key}`}>Quality <span className="font-normal text-slate-500">(optional)</span></label>
                    <input id={`sleep-quality-${sleep.key}`} value={sleep.quality ?? ""} onChange={(event) => updateSleep(sleep.key, { quality: event.target.value })} className={inputClass} maxLength={60} placeholder="e.g. poor, fragmented" />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor={`sleep-disruption-${sleep.key}`}>Disruption <span className="font-normal text-slate-500">(optional)</span></label>
                    <input id={`sleep-disruption-${sleep.key}`} value={sleep.disruption ?? ""} onChange={(event) => updateSleep(sleep.key, { disruption: event.target.value })} className={inputClass} maxLength={120} placeholder="e.g. shift work, new baby" />
                  </div>
                </div>
                <div className="mt-3 text-right">
                  <button type="button" onClick={() => setSleepSummaries((current) => current.filter((item) => item.key !== sleep.key))} className={removeClass}>Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={sectionClass}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Life events</h2>
            <p className="mt-1 text-xs text-slate-500">Context markers — they explain the terrain, they are not data points.</p>
          </div>
          <button
            type="button"
            onClick={() => setLifeEvents((current) => [...current, emptyLifeEvent()])}
            className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-slate-200 hover:border-copper-300/40"
          >
            + Add life event
          </button>
        </div>
        {lifeEvents.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">None recorded.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {lifeEvents.map((event) => (
              <li key={event.key} className="rounded-xl border border-white/10 bg-black/25 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass} htmlFor={`life-cat-${event.key}`}>Category</label>
                    <input id={`life-cat-${event.key}`} value={event.category} onChange={(event2) => updateLifeEvent(event.key, { category: event2.target.value })} className={inputClass} maxLength={DISPLAY_NAME_MAX} placeholder="e.g. Bereavement, job loss, admission" />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor={`life-date-${event.key}`}>Date</label>
                    <input id={`life-date-${event.key}`} type="date" value={event.date} onChange={(event2) => updateLifeEvent(event.key, { date: event2.target.value })} className={`${inputClass} [color-scheme:dark]`} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass} htmlFor={`life-end-${event.key}`}>End date <span className="font-normal text-slate-500">(optional — for events spanning a period)</span></label>
                    <input id={`life-end-${event.key}`} type="date" value={event.endDate ?? ""} onChange={(event2) => updateLifeEvent(event.key, { endDate: event2.target.value })} className={`${inputClass} [color-scheme:dark]`} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass} htmlFor={`life-note-${event.key}`}>Note <span className="font-normal text-slate-500">(optional, in the patient's words where possible)</span></label>
                    <input id={`life-note-${event.key}`} value={event.note ?? ""} onChange={(event2) => updateLifeEvent(event.key, { note: event2.target.value })} className={inputClass} maxLength={500} />
                  </div>
                </div>
                <div className="mt-3 text-right">
                  <button type="button" onClick={() => setLifeEvents((current) => current.filter((item) => item.key !== event.key))} className={removeClass}>Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={sectionClass}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Collateral input</h2>
            <p className="mt-1 text-xs text-slate-500">Attributed to its source — never silently merged with the patient's account.</p>
          </div>
          <button
            type="button"
            onClick={() => setCollateralEntries((current) => [...current, emptyCollateral()])}
            className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-slate-200 hover:border-copper-300/40"
          >
            + Add collateral entry
          </button>
        </div>
        {collateralEntries.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">None recorded.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {collateralEntries.map((entry) => (
              <li key={entry.key} className="rounded-xl border border-white/10 bg-black/25 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass} htmlFor={`col-rel-${entry.key}`}>Relationship to patient</label>
                    <input id={`col-rel-${entry.key}`} value={entry.relationship} onChange={(e) => updateCollateral(entry.key, { relationship: e.target.value })} className={inputClass} maxLength={DISPLAY_NAME_MAX} placeholder="e.g. Partner, mother, GP" />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor={`col-name-${entry.key}`}>Informant name <span className="font-normal text-slate-500">(optional)</span></label>
                    <input id={`col-name-${entry.key}`} value={entry.informantName ?? ""} onChange={(e) => updateCollateral(entry.key, { informantName: e.target.value })} className={inputClass} maxLength={DISPLAY_NAME_MAX} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor={`col-date-${entry.key}`}>Date recorded</label>
                    <input id={`col-date-${entry.key}`} type="date" value={entry.date} onChange={(e) => updateCollateral(entry.key, { date: e.target.value })} className={`${inputClass} [color-scheme:dark]`} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor={`col-period-${entry.key}`}>Period covered <span className="font-normal text-slate-500">(optional)</span></label>
                    <div className="flex items-center gap-2">
                      <input id={`col-period-${entry.key}`} type="date" aria-label="Period start" value={entry.periodStart ?? ""} onChange={(e) => updateCollateral(entry.key, { periodStart: e.target.value })} className={`${inputClass} [color-scheme:dark]`} />
                      <span className="text-slate-500">→</span>
                      <input type="date" aria-label="Period end" value={entry.periodEnd ?? ""} onChange={(e) => updateCollateral(entry.key, { periodEnd: e.target.value })} className={`${inputClass} [color-scheme:dark]`} />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass} htmlFor={`col-account-${entry.key}`}>Their account</label>
                    <textarea id={`col-account-${entry.key}`} value={entry.account} onChange={(e) => updateCollateral(entry.key, { account: e.target.value })} className={`${inputClass} min-h-20`} maxLength={NOTES_MAX} placeholder="What the informant reported, in their terms where possible" />
                  </div>
                </div>
                <div className="mt-3 text-right">
                  <button type="button" onClick={() => setCollateralEntries((current) => current.filter((item) => item.key !== entry.key))} className={removeClass}>Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="rounded-md bg-copper-300 px-4 py-2 text-sm font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? "Saving..." : "Save changes"}
        </button>
        {busy ? <ProgressBar label="Saving case" detail="Updating Firestore" /> : null}
      </div>
      {message ? <p className="text-sm text-gold">{message}</p> : null}
    </form>
  );
}
