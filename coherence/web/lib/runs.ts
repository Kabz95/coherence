import { getFirebaseServices, isFirebaseConfigured } from "./firebase";
import { buildStagesForModality } from "./job-map";
import { mockRuns } from "./mock-data";
import type { ClinicalContext, InputFile, Modality, NeuroRun, RunStatus } from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

function isOrchestratorStage(stage: NeuroRun["stages"][number]): boolean {
  return stage.id?.startsWith("orchestrator") || stage.jobName === "coherence-pipeline-orchestrator";
}

function normalizeRun(id: string, data: Record<string, unknown>): NeuroRun {
  const stages = Array.isArray(data.stages) ? (data.stages as NeuroRun["stages"]).filter((stage) => !isOrchestratorStage(stage)) : [];

  return {
    id,
    caseId: String(data.caseId ?? ""),
    modality: (data.modality ?? "structural_mri") as Modality,
    inputFiles: Array.isArray(data.inputFiles) ? (data.inputFiles as InputFile[]) : [],
    status: (data.status ?? "draft") as RunStatus,
    currentStage: String(data.currentStage ?? "Draft"),
    stages,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : nowIso(),
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : nowIso(),
    clinicalContext: data.clinicalContext as ClinicalContext | undefined,
    outputs: data.outputs as NeuroRun["outputs"],
    report: data.report as NeuroRun["report"]
  };
}

export interface CreateRunInput {
  caseId: string;
  modality: Modality;
  inputFiles?: InputFile[];
  clinicalContext?: ClinicalContext;
}

export async function createNeuroRun(input: CreateRunInput): Promise<NeuroRun> {
  const stages = buildStagesForModality(input.modality);
  const run: Omit<NeuroRun, "id"> = {
    caseId: input.caseId,
    modality: input.modality,
    inputFiles: input.inputFiles ?? [],
    status: input.inputFiles?.length ? "uploaded" : "draft",
    currentStage: stages[0]?.label ?? "Draft",
    stages,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    clinicalContext: input.clinicalContext
  };

  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured. Add public Firebase web app values before creating runs.");
  }

  const { addDoc, collection, serverTimestamp } = await import("firebase/firestore/lite");
  const { db } = await getFirebaseServices();
  const ref = await addDoc(collection(db, "neuroRuns"), {
    ...run,
    serverCreatedAt: serverTimestamp(),
    serverUpdatedAt: serverTimestamp()
  });

  // TODO: Trigger Cloud Run jobs from a secure backend API or Cloud Function. Browsers must not invoke Cloud Run Jobs directly.
  return { ...run, id: ref.id };
}

export async function getNeuroRun(runId: string): Promise<NeuroRun | null> {
  if (!isFirebaseConfigured()) {
    return null;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    const { doc, getDoc } = await import("firebase/firestore/lite");
    const { db } = await getFirebaseServices();
    const snapshot = await getDoc(doc(db, "neuroRuns", runId));
    return snapshot.exists() ? normalizeRun(snapshot.id, snapshot.data()) : null;
  } catch (error) {
    console.warn("Unable to read neuro run from Firestore.", error);
    throw error;
  }
}

export async function listRunsForCase(caseId: string): Promise<NeuroRun[]> {
  if (!isFirebaseConfigured()) {
    return [];
  }

  if (typeof window === "undefined") {
    return [];
  }

  try {
    const { collection, getDocs, query, where } = await import("firebase/firestore/lite");
    const { db } = await getFirebaseServices();
    const snapshot = await getDocs(query(collection(db, "neuroRuns"), where("caseId", "==", caseId)));
    return snapshot.docs
      .map((runDoc) => normalizeRun(runDoc.id, runDoc.data()))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch (error) {
    console.warn("Unable to read case runs from Firestore.", error);
    throw error;
  }
}

export async function listRecentRuns(): Promise<NeuroRun[]> {
  if (!isFirebaseConfigured()) {
    return [];
  }

  if (typeof window === "undefined") {
    return [];
  }

  try {
    const { collection, getDocs, orderBy, query } = await import("firebase/firestore/lite");
    const { db } = await getFirebaseServices();
    const snapshot = await getDocs(query(collection(db, "neuroRuns"), orderBy("updatedAt", "desc")));
    return snapshot.docs.map((runDoc) => normalizeRun(runDoc.id, runDoc.data()));
  } catch (error) {
    console.warn("Unable to read recent runs from Firestore.", error);
    throw error;
  }
}

export async function updateRunStatus(runId: string, status: RunStatus, currentStage: string): Promise<void> {
  if (!isFirebaseConfigured()) {
    return;
  }

  const { doc, serverTimestamp, updateDoc } = await import("firebase/firestore/lite");
  const { db } = await getFirebaseServices();
  await updateDoc(doc(db, "neuroRuns", runId), {
    status,
    currentStage,
    updatedAt: nowIso(),
    serverUpdatedAt: serverTimestamp()
  });
}

export async function attachInputFilesToRun(runId: string, inputFiles: InputFile[]): Promise<void> {
  if (!isFirebaseConfigured()) {
    return;
  }

  const { doc, serverTimestamp, updateDoc } = await import("firebase/firestore/lite");
  const { db } = await getFirebaseServices();
  await updateDoc(doc(db, "neuroRuns", runId), {
    inputFiles,
    status: "uploaded",
    currentStage: "Input conversion",
    updatedAt: nowIso(),
    serverUpdatedAt: serverTimestamp()
  });
}

export async function deleteNeuroRun(runId: string): Promise<void> {
  if (!isFirebaseConfigured()) {
    return;
  }

  const run = await getNeuroRun(runId);
  const [{ deleteDoc, doc }, { deleteObject, ref }, { db, storage }] = await Promise.all([
    import("firebase/firestore/lite"),
    import("firebase/storage"),
    getFirebaseServices()
  ]);

  await Promise.all(
    (run?.inputFiles ?? []).map(async (file) => {
      try {
        await deleteObject(ref(storage, file.storagePath));
      } catch (error) {
        console.warn(`Unable to delete storage object ${file.storagePath}.`, error);
      }
    })
  );

  await deleteDoc(doc(db, "neuroRuns", runId));
}

export async function clearRunOrchestration(runId: string): Promise<void> {
  if (!isFirebaseConfigured()) {
    return;
  }

  const { deleteField, doc, serverTimestamp, updateDoc } = await import("firebase/firestore/lite");
  const { db } = await getFirebaseServices();
  await updateDoc(doc(db, "neuroRuns", runId), {
    status: "uploaded",
    currentStage: "Restarting pipeline",
    orchestration: deleteField(),
    updatedAt: nowIso(),
    serverUpdatedAt: serverTimestamp()
  });
}
