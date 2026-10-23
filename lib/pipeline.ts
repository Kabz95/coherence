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

export interface RefreshRunPipelineResult extends StartRunPipelineResult {
  refreshed?: boolean;
  advanced?: boolean;
  complete?: boolean;
  status?: string;
}

export interface RestartRunPipelineResult extends StartRunPipelineResult {
  restarted?: boolean;
  resetStages?: string[];
  reason?: string;
  complete?: boolean;
}

async function callPipelineFunction<T>(name: string, runId: string): Promise<T> {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured. Add .env.local values before managing a pipeline.");
  }

  const { functions } = await getFirebaseServices();
  const callable = httpsCallable<{ runId: string }, T>(functions, name);
  const result = await callable({ runId });
  return result.data;
}

export function refreshRunPipeline(runId: string): Promise<RefreshRunPipelineResult> {
  return callPipelineFunction<RefreshRunPipelineResult>("refreshRunPipeline", runId);
}

export function restartRunPipeline(runId: string): Promise<RestartRunPipelineResult> {
  return callPipelineFunction<RestartRunPipelineResult>("restartRunPipeline", runId);
}
