import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { google } from "googleapis";

initializeApp();

const PROJECT_ID = "studio-4574323897-75b04";
const GCS_BUCKET = "studio-4574323897-75b04.firebasestorage.app";
const RUNS_COLLECTION = "runs";

const ORCHESTRATOR_JOB = "coherence-pipeline-orchestrator";
const ORCHESTRATOR_REGION = "us-central1";

type StartRunPipelineData = {
  runId?: string;
};

function requireRunId(data: StartRunPipelineData): string {
  if (!data?.runId || typeof data.runId !== "string") {
    throw new HttpsError("invalid-argument", "Missing required runId.");
  }

  return data.runId;
}

async function runCloudRunJob(params: {
  jobName: string;
  region: string;
  runId: string;
  caseId?: string;
}) {
  const auth = await google.auth.getClient({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"]
  });

  google.options({ auth });

  const run = google.run("v2");

  const name = `projects/${PROJECT_ID}/locations/${params.region}/jobs/${params.jobName}`;

  const env = [
    { name: "PROJECT_ID", value: PROJECT_ID },
    { name: "GCS_BUCKET", value: GCS_BUCKET },
    { name: "RUNS_COLLECTION", value: RUNS_COLLECTION },
    { name: "RUN_ID", value: params.runId },
    { name: "JOB_ID", value: params.jobName },
    { name: "JOB_KIND", value: "orchestrator" },
    { name: "MODALITY", value: "multi" },
    { name: "PIPELINE_STAGE", value: "orchestrator" },
    { name: "REQUIRES_GPU", value: "false" },
    { name: "REGION", value: params.region }
  ];

  if (params.caseId) {
    env.push({ name: "CASE_ID", value: params.caseId });
  }

  const response = await run.projects.locations.jobs.run({
    name,
    requestBody: {
      overrides: {
        containerOverrides: [
          {
            env
          }
        ]
      }
    } as any
  });

  return response.data;
}

export const startRunPipeline = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "512MiB"
  },
  async (request) => {
    const runId = requireRunId(request.data as StartRunPipelineData);
    const db = getFirestore();

    const runRef = db.collection(RUNS_COLLECTION).doc(runId);
    const runSnap = await runRef.get();

    if (!runSnap.exists) {
      throw new HttpsError("not-found", `Run ${runId} was not found.`);
    }

    const runData = runSnap.data() || {};
    const caseId = typeof runData.caseId === "string" ? runData.caseId : undefined;

    await runRef.set(
      {
        status: "queued",
        currentStage: "orchestrator",
        orchestration: {
          requestedAt: FieldValue.serverTimestamp(),
          requestedBy: request.auth?.uid || "unauthenticated-dev",
          orchestratorJob: ORCHESTRATOR_JOB,
          orchestratorRegion: ORCHESTRATOR_REGION
        },
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    try {
      const operation = await runCloudRunJob({
        jobName: ORCHESTRATOR_JOB,
        region: ORCHESTRATOR_REGION,
        runId,
        caseId
      });

      await runRef.set(
        {
          status: "queued",
          currentStage: "orchestrator",
          orchestration: {
            launchedAt: FieldValue.serverTimestamp(),
            operationName: operation.name || null,
            done: operation.done || false
          },
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      return {
        ok: true,
        runId,
        launchedJob: ORCHESTRATOR_JOB,
        region: ORCHESTRATOR_REGION,
        operationName: operation.name || null
      };
    } catch (error: any) {
      await runRef.set(
        {
          status: "failed",
          currentStage: "orchestrator",
          orchestration: {
            failedAt: FieldValue.serverTimestamp(),
            error: error?.message || String(error)
          },
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      throw new HttpsError(
        "internal",
        `Failed to start pipeline orchestrator: ${error?.message || String(error)}`
      );
    }
  }
);