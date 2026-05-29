"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const { GoogleAuth } = require("google-auth-library");

admin.initializeApp();

const PROJECT_ID = "studio-4574323897-75b04";
const GCS_BUCKET = "studio-4574323897-75b04.firebasestorage.app";
const RUNS_COLLECTION = "neuroRuns";
const CPU_REGION = "us-central1";
const GPU_REGION = "us-east4";
const ALL_JOB_REGIONS = [CPU_REGION, GPU_REGION];

const JOBS = {
  converter: { jobNames: ["coherence-converter", "job-converter"], regions: [CPU_REGION], modalities: ["structural_mri", "diffusion_mri", "eeg", "multimodal"] },
  qc: { jobNames: ["coherence-qc", "job-qc"], regions: [CPU_REGION], modalities: ["structural_mri", "diffusion_mri", "eeg", "multimodal"] },
  structural_prep: { jobNames: ["coherence-structural-prep", "job-structural-prep"], regions: [GPU_REGION, CPU_REGION], modalities: ["structural_mri", "multimodal"] },
  structural_analysis: { jobNames: ["coherence-structural-analysis", "job-structural-analysis"], regions: [GPU_REGION, CPU_REGION], modalities: ["structural_mri", "multimodal"] },
  structural_3d_prep: { jobNames: ["coherence-structural-3d-prep", "job-structural-3d-prep"], regions: [GPU_REGION, CPU_REGION], modalities: ["structural_mri", "multimodal"] },
  diffusion_prep: { jobNames: ["coherence-diffusion-prep", "job-diffusion-prep"], regions: [GPU_REGION, CPU_REGION], modalities: ["diffusion_mri", "multimodal"] },
  diffusion_analysis: { jobNames: ["coherence-diffusion-analysis", "job-diffusion-analysis"], regions: [GPU_REGION, CPU_REGION], modalities: ["diffusion_mri", "multimodal"] },
  diffusion_3d_prep: { jobNames: ["coherence-diffusion-3d-prep", "job-diffusion-3d-prep"], regions: [GPU_REGION, CPU_REGION], modalities: ["diffusion_mri", "multimodal"] },
  eeg_ingest: { jobNames: ["coherence-eeg-ingest", "job-eeg-ingest"], regions: [CPU_REGION], modalities: ["eeg", "multimodal"] },
  eeg_prep: { jobNames: ["coherence-eeg-prep", "job-eeg-prep"], regions: [CPU_REGION], modalities: ["eeg", "multimodal"] },
  eeg_analysis: { jobNames: ["coherence-eeg-analysis", "job-eeg-analysis"], regions: [CPU_REGION], modalities: ["eeg", "multimodal"] },
  eeg_visualization_prep: { jobNames: ["coherence-eeg-visualization-prep", "job-eeg-visualization-prep"], regions: [CPU_REGION], modalities: ["eeg", "multimodal"] },
  longitudinal_analysis: { jobNames: ["coherence-longitudinal-analysis", "job-longitudinal-analysis"], regions: [CPU_REGION], modalities: ["structural_mri", "diffusion_mri", "eeg", "multimodal"] },
  coregistration: { jobNames: ["coherence-coregistration", "job-coregistration"], regions: [CPU_REGION, GPU_REGION], modalities: ["multimodal"] },
  report_builder: { jobNames: ["coherence-report-builder", "job-report-builder"], regions: [CPU_REGION], modalities: ["structural_mri", "diffusion_mri", "eeg", "multimodal"] },
};

const ACTIVE_STAGE_STATUSES = new Set(["running"]);
const COMPLETE_STAGE_STATUSES = new Set(["completed", "skipped"]);

function jobKindToStagePrefix(jobKind) {
  return jobKind.replace(/_/g, "-");
}

function stageMatchesJob(stage, job) {
  return (
    stage.id?.startsWith(jobKindToStagePrefix(job.jobKind)) ||
    stage.stage === jobKindToStagePrefix(job.jobKind) ||
    job.jobNames.includes(stage.jobName)
  );
}

function updateStagesForLaunch(existingStages, jobs, launched, failed, missing) {
  if (!Array.isArray(existingStages)) {
    return existingStages;
  }

  return existingStages.map((stage) => {
    const job = jobs.find((candidate) => stageMatchesJob(stage, candidate));
    if (!job) return stage;

    const launchedJob = launched.find((candidate) => candidate.jobKind === job.jobKind);
    const failedJob = failed.find((candidate) => candidate.jobKind === job.jobKind);
    const missingJob = missing.find((candidate) => candidate.jobKind === job.jobKind);

    if (failedJob || missingJob) {
      return {
        ...stage,
        status: "failed",
        error: failedJob?.error || missingJob?.error || "Cloud Run Job launch failed.",
      };
    }

    if (launchedJob) {
      return {
        ...stage,
        jobName: launchedJob.jobName,
        region: launchedJob.region,
        status: "running",
        startedAt: new Date().toISOString(),
        error: null,
      };
    }

    return stage;
  });
}

function matchingJobForStage(stage, jobs) {
  return jobs.find((candidate) => stageMatchesJob(stage, candidate));
}

function nextLaunchableStage(stages, jobs) {
  if (!Array.isArray(stages)) {
    return null;
  }

  for (const stage of stages) {
    const status = stage.status || "pending";
    if (status === "failed") return null;
    if (ACTIVE_STAGE_STATUSES.has(status)) return null;
    if (COMPLETE_STAGE_STATUSES.has(status)) continue;

    const job = matchingJobForStage(stage, jobs);
    return job ? { stage, job } : null;
  }

  return null;
}

function allStagesComplete(stages) {
  return Array.isArray(stages) && stages.length > 0 && stages.every((stage) => COMPLETE_STAGE_STATUSES.has(stage.status));
}

function reconcileStagesFromOutputs(stages, jobs, outputs = {}) {
  if (!Array.isArray(stages) || !outputs || typeof outputs !== "object") {
    return { stages, changed: false };
  }

  let changed = false;
  const reconciledStages = stages.map((stage) => {
    const job = matchingJobForStage(stage, jobs);
    const output = job ? outputs[job.jobKind] : null;

    if (!job || !output || output.status !== "completed" || COMPLETE_STAGE_STATUSES.has(stage.status)) {
      return stage;
    }

    changed = true;
    return {
      ...stage,
      status: "completed",
      completedAt: stage.completedAt || new Date().toISOString(),
      error: null,
    };
  });

  return { stages: reconciledStages, changed };
}

function buildOrchestrationJobs(jobs, launched, failed, missing, stages = []) {
  return jobs.map((job) => {
    const launchedJob = launched.find((candidate) => candidate.jobKind === job.jobKind);
    const failedJob = failed.find((candidate) => candidate.jobKind === job.jobKind);
    const missingJob = missing.find((candidate) => candidate.jobKind === job.jobKind);
    const stage = stages.find((candidate) => stageMatchesJob(candidate, job));

    return {
      jobKind: job.jobKind,
      jobNames: job.jobNames,
      regions: job.regions,
      status: failedJob || missingJob ? "failed" : stage?.status || (launchedJob ? "running" : "queued"),
      resolvedJobName: launchedJob?.jobName || null,
      resolvedRegion: launchedJob?.region || null,
      operationName: launchedJob?.operationName || null,
      error: failedJob?.error || missingJob?.error || null,
    };
  });
}

function pipelineForModality(modality) {
  return Object.entries(JOBS)
    .filter(([, job]) => job.modalities.includes(modality))
    .map(([jobKind, job]) => ({ jobKind, ...job }));
}

async function runCloudRunJob({ jobKind, jobName, region, runId, caseId }) {
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const client = await auth.getClient();
  const url = `https://run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${region}/jobs/${jobName}:run`;
  const response = await client.request({
    url,
    method: "POST",
    data: {
      overrides: {
        containerOverrides: [
          {
            env: [
              { name: "JOB_KIND", value: jobKind },
              { name: "RUN_ID", value: runId },
              { name: "CASE_ID", value: caseId || "" },
              { name: "PROJECT_ID", value: PROJECT_ID },
              { name: "GCS_BUCKET", value: GCS_BUCKET },
              { name: "RUNS_COLLECTION", value: RUNS_COLLECTION },
            ],
          },
        ],
      },
    },
  });
  return response.data;
}

async function resolveCloudRunJob(job) {
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const client = await auth.getClient();
  const regions = Array.from(new Set([...(job.regions || []), ...ALL_JOB_REGIONS]));
  const checked = [];

  for (const jobName of job.jobNames) {
    for (const region of regions) {
      const url = `https://run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${region}/jobs/${jobName}`;
      checked.push(`${jobName}:${region}`);
      try {
        await client.request({ url, method: "GET" });
        return { jobName, region, checked };
      } catch (error) {
        const status = error.response && error.response.status;
        if (status !== 404) {
          throw error;
        }
      }
    }
  }

  return { jobName: null, region: null, checked };
}

async function markPipelineQueued(runId, caseId, modality, jobs) {
  await admin.firestore().collection(RUNS_COLLECTION).doc(runId).set(
    {
      status: "queued",
      currentStage: "Pipeline queued",
      orchestration: {
        status: "queued",
        queuedAt: admin.firestore.FieldValue.serverTimestamp(),
        jobCount: jobs.length,
        jobs: jobs.map(({ jobKind, jobNames, regions }) => ({ jobKind, jobNames, regions, status: "queued" })),
      },
      caseId,
      modality,
      updatedAt: new Date().toISOString(),
      serverUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function startPipelineForRun(runId, requestedByUid) {
  const ref = admin.firestore().collection(RUNS_COLLECTION).doc(runId);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new HttpsError("not-found", `Run ${runId} does not exist.`);
  }

  const run = snap.data();
  const modality = run.modality;
  const caseId = run.caseId;
  const orchestrationStatus = run.orchestration && run.orchestration.status;

  if (["queued", "launched"].includes(orchestrationStatus)) {
    return launchNextStageForRun(runId, requestedByUid);
  }

  if (!["structural_mri", "diffusion_mri", "eeg", "multimodal"].includes(modality)) {
    throw new HttpsError("failed-precondition", `Run ${runId} has unsupported modality '${modality}'.`);
  }

  const jobs = pipelineForModality(modality);
  await markPipelineQueued(runId, caseId, modality, jobs);

  return launchNextStageForRun(runId, requestedByUid);
}

async function launchNextStageForRun(runId, requestedByUid) {
  const ref = admin.firestore().collection(RUNS_COLLECTION).doc(runId);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new HttpsError("not-found", `Run ${runId} does not exist.`);
  }

  const run = snap.data();
  const modality = run.modality;
  const caseId = run.caseId;

  if (!["structural_mri", "diffusion_mri", "eeg", "multimodal"].includes(modality)) {
    throw new HttpsError("failed-precondition", `Run ${runId} has unsupported modality '${modality}'.`);
  }

  const jobs = pipelineForModality(modality);
  const reconciliation = reconcileStagesFromOutputs(Array.isArray(run.stages) ? run.stages : [], jobs, run.outputs);
  const stages = reconciliation.stages;
  const priorLaunched = run.orchestration?.launched || [];
  const priorFailed = run.orchestration?.failed || [];
  const priorMissing = run.orchestration?.missing || [];

  if (reconciliation.changed) {
    await ref.set(
      {
        stages,
        orchestration: {
          ...(run.orchestration || {}),
          jobs: buildOrchestrationJobs(jobs, priorLaunched, priorFailed, priorMissing, stages),
        },
        updatedAt: new Date().toISOString(),
        serverUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  if (allStagesComplete(stages)) {
    await ref.set(
      {
        status: "completed",
        currentStage: "Report ready",
        orchestration: {
          ...(run.orchestration || {}),
          status: "completed",
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        updatedAt: new Date().toISOString(),
        serverUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return { runId, caseId, modality, launched: priorLaunched, failed: priorFailed, missing: priorMissing, complete: true };
  }

  const next = nextLaunchableStage(stages, jobs);
  if (!next) {
    return { runId, caseId, modality, launched: priorLaunched, failed: priorFailed, missing: priorMissing, alreadyStarted: true };
  }

  const launched = [];
  const failed = [];
  const missing = [];

  try {
    const resolved = await resolveCloudRunJob(next.job);
    if (!resolved.jobName || !resolved.region) {
      missing.push({
        jobKind: next.job.jobKind,
        jobNames: next.job.jobNames,
        regions: next.job.regions,
        checked: resolved.checked,
        error: `No matching Cloud Run Job found for ${next.job.jobKind}.`,
      });
      logger.error("Cloud Run job not found in any candidate region", { runId, jobKind: next.job.jobKind, checked: resolved.checked });
    } else {
      const launchedJob = { jobKind: next.job.jobKind, jobName: resolved.jobName, region: resolved.region, operationName: null };
      launched.push(launchedJob);
      const runningStages = updateStagesForLaunch(stages, [next.job], launched, failed, missing);

      await ref.set(
        {
          status: "running",
          currentStage: next.stage.label || next.job.jobKind,
          ...(Array.isArray(runningStages) ? { stages: runningStages } : {}),
          orchestration: {
            status: "launched",
            launchedAt: admin.firestore.FieldValue.serverTimestamp(),
            requestedByUid,
            jobs: buildOrchestrationJobs(jobs, [...priorLaunched, ...launched], priorFailed, priorMissing, runningStages),
            launched: [...priorLaunched, ...launched],
            failed: priorFailed,
            missing: priorMissing,
          },
          updatedAt: new Date().toISOString(),
          serverUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      const operation = await runCloudRunJob({ jobKind: next.job.jobKind, jobName: resolved.jobName, region: resolved.region, runId, caseId });
      launchedJob.operationName = operation.name || null;

      await ref.set(
        {
          orchestration: {
            status: "launched",
            jobs: buildOrchestrationJobs(jobs, [...priorLaunched, ...launched], priorFailed, priorMissing, runningStages),
            launched: [...priorLaunched, ...launched],
          },
          serverUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (error) {
    logger.error("Failed to launch Cloud Run job", { runId, jobKind: next.job.jobKind, jobNames: next.job.jobNames, regions: next.job.regions, error: error.message });
    launched.length = 0;
    failed.push({ jobKind: next.job.jobKind, jobNames: next.job.jobNames, regions: next.job.regions, error: error.message });
  }

  const hasLaunchProblems = failed.length > 0 || missing.length > 0;
  if (!hasLaunchProblems) {
    return { runId, caseId, modality, launched, failed, missing };
  }

  const updatedStages = updateStagesForLaunch(stages, [next.job], launched, failed, missing);
  await ref.set(
    {
      status: "failed",
      currentStage: "Backend job not provisioned",
      ...(Array.isArray(updatedStages) ? { stages: updatedStages } : {}),
      orchestration: {
        status: "failed",
        launchedAt: admin.firestore.FieldValue.serverTimestamp(),
        requestedByUid,
        jobs: buildOrchestrationJobs(jobs, [...priorLaunched, ...launched], [...priorFailed, ...failed], [...priorMissing, ...missing], updatedStages),
        launched: [...priorLaunched, ...launched],
        failed: [...priorFailed, ...failed],
        missing: [...priorMissing, ...missing],
      },
      updatedAt: new Date().toISOString(),
      serverUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { runId, caseId, modality, launched, failed, missing };
}

exports.startRunPipeline = onCall(
  {
    region: CPU_REGION,
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in before starting a Coherence run pipeline.");
    }

    const runId = request.data && request.data.runId;
    if (!runId || typeof runId !== "string") {
      throw new HttpsError("invalid-argument", "runId is required.");
    }

    return startPipelineForRun(runId, request.auth.uid);
  }
);

exports.queueUploadedRun = onDocumentWritten(
  {
    document: `${RUNS_COLLECTION}/{runId}`,
    region: CPU_REGION,
    timeoutSeconds: 120,
    memory: "256MiB",
  },
  async (event) => {
    const before = event.data && event.data.before && event.data.before.exists ? event.data.before.data() : null;
    const after = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
    if (!after) return;

    const alreadyStarted = after.orchestration && ["queued", "launched", "failed"].includes(after.orchestration.status);
    const hasInputs = Array.isArray(after.inputFiles) && after.inputFiles.length > 0;

    if (after.status === "uploaded" && hasInputs && !alreadyStarted) {
      try {
        await startPipelineForRun(event.params.runId, "firestore-trigger");
      } catch (error) {
        logger.error("Automatic pipeline queue failed", { runId: event.params.runId, error: error.message });
      }
      return;
    }

    const stages = Array.isArray(after.stages) ? after.stages : [];
    const beforeStages = Array.isArray(before?.stages) ? before.stages : [];
    const hasRunningStage = stages.some((stage) => stage.status === "running");
    const completedCount = stages.filter((stage) => COMPLETE_STAGE_STATUSES.has(stage.status)).length;
    const beforeCompletedCount = beforeStages.filter((stage) => COMPLETE_STAGE_STATUSES.has(stage.status)).length;
    const shouldAdvance =
      hasInputs &&
      after.status === "running" &&
      after.orchestration?.status === "launched" &&
      !hasRunningStage &&
      completedCount > beforeCompletedCount;

    if (shouldAdvance) {
      try {
        await launchNextStageForRun(event.params.runId, "firestore-trigger");
      } catch (error) {
        logger.error("Sequential pipeline advance failed", { runId: event.params.runId, error: error.message });
      }
    }
  }
);
