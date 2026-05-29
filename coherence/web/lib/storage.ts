import { getFirebaseServices, isFirebaseConfigured } from "./firebase";
import type { InputFile, Modality } from "./types";

export function buildStoragePath(caseId: string, runId: string, fileName: string): string {
  const safeName = fileName.replace(/[^\w.\-()+ ]/g, "_");
  return `cases/${caseId}/runs/${runId}/inputs/${safeName}`;
}

export async function uploadInputFile(caseId: string, runId: string, file: File, modality: Modality): Promise<InputFile> {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase Storage is not configured. Add public Firebase web app values to .env.local before uploading files.");
  }

  const { ref, uploadBytes } = await import("firebase/storage");
  const { storage } = await getFirebaseServices();
  const storagePath = buildStoragePath(caseId, runId, file.name);
  await uploadBytes(ref(storage, storagePath), file, { contentType: file.type || "application/octet-stream" });

  return {
    id: crypto.randomUUID(),
    name: file.name,
    storagePath,
    contentType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    modality,
    uploadedAt: new Date().toISOString()
  };
}
