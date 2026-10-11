import { httpsCallable } from "firebase/functions";
import { getFirebaseServices, isFirebaseConfigured } from "./firebase";

export interface StartRunPipelineResult {
  runId: string;
  caseId?: string;
  modality?: string;
  launched?: Array<{ jobKind: string; jobName: string; region: string; operationName?: string | null }>;
  failed?: Array<{ jobKind: string; jobName: string; region: string; error: string }>;
  missing?: Array<{ jobKind: string; jobName: string; region: string; error: string }>;
  provisioned?: Array<{ jobKind: string; jobName: string; region: string; operationName?: string | null }>;
  alreadyStarted?: boolean;
}

export async function startRunPipeline(runId: string): Promise<StartRunPipelineResult> {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured. Add .env.local values before starting a pipeline.");
  }

  const { functions } = await getFirebaseServices();
  const callable = httpsCallable<{ runId: string }, StartRunPipelineResult>(functions, "startRunPipeline");
  const result = await callable({ runId });
  return result.data;
}
