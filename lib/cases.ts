import { getFirebaseServices, isFirebaseConfigured } from "./firebase";
import { mockCases } from "./mock-data";
import type { PatientCase } from "./types";

function timestampFallback(): string {
  return new Date().toISOString();
}

function normalizeCase(id: string, data: Record<string, unknown>): PatientCase {
  return {
    id,
    displayName: String(data.displayName ?? "Untitled case"),
    birthYear: typeof data.birthYear === "number" ? data.birthYear : undefined,
    sex: typeof data.sex === "string" ? data.sex : undefined,
    notes: typeof data.notes === "string" ? data.notes : undefined,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : timestampFallback(),
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : timestampFallback()
  };
}

export async function createPatientCase(input: Omit<PatientCase, "id" | "createdAt" | "updatedAt">): Promise<PatientCase> {
  const now = timestampFallback();

  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured. Add public Firebase web app values before creating cases.");
  }

  const { addDoc, collection, serverTimestamp } = await import("firebase/firestore/lite");
  const { db } = await getFirebaseServices();
  const ref = await addDoc(collection(db, "patientCases"), {
    ...input,
    createdAt: now,
    updatedAt: now,
    serverCreatedAt: serverTimestamp(),
    serverUpdatedAt: serverTimestamp()
  });

  return { ...input, id: ref.id, createdAt: now, updatedAt: now };
}

export async function listPatientCases(): Promise<PatientCase[]> {
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
