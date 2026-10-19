import { isDemoMode } from "./demo";
import { getFirebaseServices, isFirebaseConfigured } from "./firebase";
import { mockCases } from "./mock-data";
import type {
  ClinicalContext,
  ClinicalNote,
  CollateralEntry,
  LabEntry,
  LifeEvent,
  MedicationEntry,
  PatientCase,
  ReferralQuestion,
  ReferralQuestionVersion,
  SleepSummary,
  TherapyEntry
} from "./types";

function timestampFallback(): string {
  return new Date().toISOString();
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeMedications(value: unknown): MedicationEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      name: typeof item.name === "string" ? item.name : "",
      ...(typeof item.dose === "string" && item.dose ? { dose: item.dose } : {}),
      ...(typeof item.startDate === "string" && item.startDate ? { startDate: item.startDate } : {}),
      ...(typeof item.endDate === "string" && item.endDate ? { endDate: item.endDate } : {}),
      ...(typeof item.notes === "string" && item.notes ? { notes: item.notes } : {})
    }))
    .filter((med) => med.name !== "");
}

function normalizeSleepSource(value: unknown): SleepSummary["source"] {
  if (value === "device" || value === "patient" || value === "clinician") return value;
  return "clinician";
}

function normalizeTherapies(value: unknown): TherapyEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      type: typeof item.type === "string" ? item.type : "",
      ...(typeof item.frequency === "string" && item.frequency ? { frequency: item.frequency } : {}),
      ...(typeof item.startDate === "string" && item.startDate ? { startDate: item.startDate } : {}),
      ...(typeof item.endDate === "string" && item.endDate ? { endDate: item.endDate } : {}),
      ...(typeof item.notes === "string" && item.notes ? { notes: item.notes } : {})
    }))
    .filter((therapy) => therapy.type !== "");
}

/** Defensive parse of the case-level clinical context; unknown shapes become empty. */
function normalizeClinicalContext(value: unknown): ClinicalContext | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const data = value as Record<string, unknown>;
  const notes: ClinicalNote[] = Array.isArray(data.notes)
    ? data.notes
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => ({
          id: typeof item.id === "string" ? item.id : `note-${Math.random().toString(36).slice(2)}`,
          date: typeof item.date === "string" ? item.date : timestampFallback(),
          ...(typeof item.author === "string" ? { author: item.author } : {}),
          body: typeof item.body === "string" ? item.body : ""
        }))
        .filter((note) => note.body !== "")
    : [];
  const labEntries: LabEntry[] = Array.isArray(data.labEntries)
    ? data.labEntries
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => ({
          testName: typeof item.testName === "string" ? item.testName : "",
          date: typeof item.date === "string" ? item.date : "",
          value: typeof item.value === "string" ? item.value : "",
          ...(typeof item.unit === "string" && item.unit ? { unit: item.unit } : {}),
          ...(typeof item.referenceRange === "string" && item.referenceRange ? { referenceRange: item.referenceRange } : {}),
          ...(typeof item.notes === "string" && item.notes ? { notes: item.notes } : {})
        }))
        .filter((lab) => lab.testName !== "" && lab.date !== "")
    : [];
  const sleepSummaries: SleepSummary[] = Array.isArray(data.sleepSummaries)
    ? data.sleepSummaries
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => ({
          startDate: typeof item.startDate === "string" ? item.startDate : "",
          endDate: typeof item.endDate === "string" ? item.endDate : "",
          ...(typeof item.typicalDuration === "string" && item.typicalDuration ? { typicalDuration: item.typicalDuration } : {}),
          ...(typeof item.quality === "string" && item.quality ? { quality: item.quality } : {}),
          ...(typeof item.disruption === "string" && item.disruption ? { disruption: item.disruption } : {}),
          source: normalizeSleepSource(item.source)
        }))
        .filter((sleep) => sleep.startDate !== "" && sleep.endDate !== "")
    : [];
  const lifeEvents: LifeEvent[] = Array.isArray(data.lifeEvents)
    ? data.lifeEvents
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => ({
          date: typeof item.date === "string" ? item.date : "",
          ...(typeof item.endDate === "string" && item.endDate ? { endDate: item.endDate } : {}),
          category: typeof item.category === "string" ? item.category : "",
          ...(typeof item.note === "string" && item.note ? { note: item.note } : {})
        }))
        .filter((event) => event.category !== "" && event.date !== "")
    : [];
  const collateralEntries: CollateralEntry[] = Array.isArray(data.collateralEntries)
    ? data.collateralEntries
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => ({
          ...(typeof item.informantName === "string" && item.informantName ? { informantName: item.informantName } : {}),
          relationship: typeof item.relationship === "string" ? item.relationship : "",
          date: typeof item.date === "string" ? item.date : "",
          ...(typeof item.periodStart === "string" && item.periodStart ? { periodStart: item.periodStart } : {}),
          ...(typeof item.periodEnd === "string" && item.periodEnd ? { periodEnd: item.periodEnd } : {}),
          account: typeof item.account === "string" ? item.account : ""
        }))
        .filter((entry) => entry.relationship !== "" && entry.account !== "")
    : [];
  return {
    establishedDiagnoses: stringList(data.establishedDiagnoses),
    medications: normalizeMedications(data.medications),
    therapies: normalizeTherapies(data.therapies),
    symptomScales: [],
    ...(typeof data.clinicianNotes === "string" && data.clinicianNotes ? { clinicianNotes: data.clinicianNotes } : {}),
    ...(notes.length ? { notes } : {}),
    ...(labEntries.length ? { labEntries } : {}),
    ...(sleepSummaries.length ? { sleepSummaries } : {}),
    ...(lifeEvents.length ? { lifeEvents } : {}),
    ...(collateralEntries.length ? { collateralEntries } : {})
  };
}

function normalizeReferralQuestion(value: unknown): ReferralQuestion | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const data = value as Record<string, unknown>;
  if (typeof data.text !== "string" || !data.text) return undefined;
  const history: ReferralQuestionVersion[] = Array.isArray(data.history)
    ? data.history
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => ({
          text: typeof item.text === "string" ? item.text : "",
          date: typeof item.date === "string" ? item.date : timestampFallback(),
          ...(typeof item.author === "string" ? { author: item.author } : {})
        }))
        .filter((version) => version.text !== "")
    : [];
  return {
    text: data.text,
    date: typeof data.date === "string" ? data.date : timestampFallback(),
    ...(typeof data.author === "string" ? { author: data.author } : {}),
    history
  };
}

function normalizeCase(id: string, data: Record<string, unknown>): PatientCase {
  return {
    id,
    displayName: String(data.displayName ?? "Untitled case"),
    birthYear: typeof data.birthYear === "number" ? data.birthYear : undefined,
    sex: typeof data.sex === "string" ? data.sex : undefined,
    notes: typeof data.notes === "string" ? data.notes : undefined,
    clinicalContext: normalizeClinicalContext(data.clinicalContext),
    referralQuestion: normalizeReferralQuestion(data.referralQuestion),
    createdAt: typeof data.createdAt === "string" ? data.createdAt : timestampFallback(),
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : timestampFallback()
  };
}

export async function createPatientCase(input: Omit<PatientCase, "id" | "createdAt" | "updatedAt">): Promise<PatientCase> {
  if (isDemoMode()) {
    throw new Error("Demo mode is read-only. Configure Firebase to create live cases.");
  }

  const now = timestampFallback();

  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured. Add public Firebase web app values before creating cases.");
  }

  const { addDoc, collection, serverTimestamp } = await import("firebase/firestore/lite");
  const { db } = await getFirebaseServices();
  // Firestore rejects `undefined` field values, so only include optional
  // fields that are actually defined. Never spread `input` straight into
  // addDoc: an empty Notes field arrives as `notes: undefined` and fails
  // the whole write with "Unsupported field value: undefined".
  const payload: Record<string, unknown> = {
    displayName: input.displayName,
    createdAt: now,
    updatedAt: now,
    serverCreatedAt: serverTimestamp(),
    serverUpdatedAt: serverTimestamp()
  };
  if (input.birthYear !== undefined) payload.birthYear = input.birthYear;
  if (input.sex !== undefined) payload.sex = input.sex;
  if (input.notes !== undefined) payload.notes = input.notes;
  if (input.clinicalContext !== undefined) payload.clinicalContext = input.clinicalContext;
  const ref = await addDoc(collection(db, "patientCases"), payload);

  return {
    displayName: input.displayName,
    ...(input.birthYear !== undefined ? { birthYear: input.birthYear } : {}),
    ...(input.sex !== undefined ? { sex: input.sex } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(input.clinicalContext !== undefined ? { clinicalContext: input.clinicalContext } : {}),
    id: ref.id,
    createdAt: now,
    updatedAt: now
  };
}

export interface UpdateCaseInput {
  displayName?: string;
  birthYear?: number;
  sex?: string;
  /** Empty string clears the notes field. */
  notes?: string;
  clinicalContext?: ClinicalContext;
  /** Empty-string text clears the referral question. */
  referralQuestion?: ReferralQuestion;
}

/**
 * Edit a case. Only defined fields are written; empty-string notes clears
 * the field. Always touches updatedAt. The edit-case view is the only
 * caller — case metadata is no longer write-once.
 */
export async function updatePatientCase(caseId: string, input: UpdateCaseInput): Promise<void> {
  if (isDemoMode()) {
    throw new Error("Demo mode is read-only. Configure Firebase to edit live cases.");
  }

  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured. Add public Firebase web app values before editing cases.");
  }

  const { deleteField, doc, serverTimestamp, updateDoc } = await import("firebase/firestore/lite");
  const { db } = await getFirebaseServices();
  const payload: Record<string, unknown> = {
    updatedAt: timestampFallback(),
    serverUpdatedAt: serverTimestamp()
  };
  if (input.displayName !== undefined) payload.displayName = input.displayName;
  if (input.birthYear !== undefined) payload.birthYear = input.birthYear;
  if (input.sex !== undefined) payload.sex = input.sex;
  if (input.notes !== undefined) payload.notes = input.notes === "" ? deleteField() : input.notes;
  if (input.clinicalContext !== undefined) payload.clinicalContext = input.clinicalContext;
  if (input.referralQuestion !== undefined)
    payload.referralQuestion = input.referralQuestion.text === "" ? deleteField() : input.referralQuestion;
  await updateDoc(doc(db, "patientCases", caseId), payload);
}

export async function listPatientCases(): Promise<PatientCase[]> {
  // Symposium demo path: serve the seeded cases when no backend is configured.
  if (isDemoMode()) {
    return [...mockCases].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  if (!isFirebaseConfigured()) {
    return [];
  }

  if (typeof window === "undefined") {
    return [];
  }

  try {
    const { collection, getDocs, orderBy, query } = await import("firebase/firestore/lite");
    const { db } = await getFirebaseServices();
    const snapshot = await getDocs(query(collection(db, "patientCases"), orderBy("updatedAt", "desc")));
    return snapshot.docs.map((caseDoc) => normalizeCase(caseDoc.id, caseDoc.data()));
  } catch (error) {
    console.warn("Unable to read patient cases from Firestore.", error);
    throw error;
  }
}

export async function getPatientCase(caseId: string): Promise<PatientCase | null> {
  if (isDemoMode()) {
    return mockCases.find((patientCase) => patientCase.id === caseId) ?? null;
  }

  if (!isFirebaseConfigured()) {
    return null;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    const { doc, getDoc } = await import("firebase/firestore/lite");
    const { db } = await getFirebaseServices();
    const snapshot = await getDoc(doc(db, "patientCases", caseId));
    return snapshot.exists() ? normalizeCase(snapshot.id, snapshot.data()) : null;
  } catch (error) {
    console.warn("Unable to read patient case from Firestore.", error);
    throw error;
  }
}

export async function touchPatientCase(caseId: string): Promise<void> {
  if (!isFirebaseConfigured()) {
    return;
  }

  const { doc, serverTimestamp, updateDoc } = await import("firebase/firestore/lite");
  const { db } = await getFirebaseServices();
  await updateDoc(doc(db, "patientCases", caseId), {
    updatedAt: timestampFallback(),
    serverUpdatedAt: serverTimestamp()
  });
}

export async function deletePatientCase(caseId: string): Promise<void> {
  if (!isFirebaseConfigured()) {
    return;
  }

  const { deleteNeuroRun, listRunsForCase } = await import("./runs");
  const { deleteDoc, doc } = await import("firebase/firestore/lite");
  const { db } = await getFirebaseServices();
  const runs = await listRunsForCase(caseId);

  await Promise.all(runs.map((run) => deleteNeuroRun(run.id)));
  await deleteDoc(doc(db, "patientCases", caseId));
}
