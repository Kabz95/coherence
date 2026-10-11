import type { RunStage } from "./types";

const DEFAULT_ESTIMATE_SECONDS = 300;

export interface StageProgress {
  stage: RunStage;
  percent: number;
  remainingSeconds: number;
  elapsedSeconds: number;
  estimateSeconds: number;
}

export interface PipelineProgress {
  percent: number;
  remainingSeconds: number;
  completedSteps: number;
  totalSteps: number;
  activeStep?: StageProgress;
  stages: StageProgress[];
}

function parseTimestamp(value?: string): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function secondsBetween(startMs: number | null, nowMs: number): number {
  if (!startMs) return 0;
  return Math.max(0, Math.floor((nowMs - startMs) / 1000));
}

export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "0 min";

  const seconds = Math.ceil(totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.ceil((seconds % 3600) / 60);

  if (hours <= 0) return `${Math.max(1, minutes)} min`;
  if (minutes <= 0 || minutes === 60) return `${hours + (minutes === 60 ? 1 : 0)} hr`;
  return `${hours} hr ${minutes} min`;
}

export function calculateStageProgress(stage: RunStage, nowMs: number): StageProgress {
  const estimateSeconds = Math.max(30, stage.estimatedDurationSeconds ?? DEFAULT_ESTIMATE_SECONDS);
  const startedMs = parseTimestamp(stage.startedAt);
  const completedMs = parseTimestamp(stage.completedAt);
  const elapsedSeconds = secondsBetween(startedMs, completedMs ?? nowMs);

  if (stage.status === "completed" || stage.status === "skipped") {
    return { stage, percent: 100, remainingSeconds: 0, elapsedSeconds, estimateSeconds };
  }

  if (stage.status === "failed") {
    return { stage, percent: 100, remainingSeconds: 0, elapsedSeconds, estimateSeconds };
  }

  if (stage.status === "running") {
    const percent = Math.min(95, Math.max(8, Math.round((elapsedSeconds / estimateSeconds) * 100)));
    return {
      stage,
      percent,
      remainingSeconds: Math.max(0, estimateSeconds - elapsedSeconds),
      elapsedSeconds,
      estimateSeconds,
    };
  }

  if (stage.status === "queued") {
    return { stage, percent: 4, remainingSeconds: estimateSeconds, elapsedSeconds: 0, estimateSeconds };
  }

  return { stage, percent: 0, remainingSeconds: estimateSeconds, elapsedSeconds: 0, estimateSeconds };
}

export function calculatePipelineProgress(stages: RunStage[], nowMs: number = Date.now()): PipelineProgress {
  const stageProgress = stages.map((stage) => calculateStageProgress(stage, nowMs));
  const totalWeight = stageProgress.reduce((sum, item) => sum + item.estimateSeconds, 0) || 1;
  const weightedProgress = stageProgress.reduce((sum, item) => sum + item.estimateSeconds * item.percent, 0);
  const completedSteps = stageProgress.filter((item) => item.stage.status === "completed" || item.stage.status === "skipped").length;
  const remainingSeconds = stageProgress.reduce((sum, item) => {
    if (item.stage.status === "completed" || item.stage.status === "skipped" || item.stage.status === "failed") return sum;
    return sum + item.remainingSeconds;
  }, 0);

  return {
    percent: Math.round(weightedProgress / totalWeight),
    remainingSeconds,
    completedSteps,
    totalSteps: stages.length,
    activeStep: stageProgress.find((item) => item.stage.status === "running") ?? stageProgress.find((item) => item.stage.status === "queued"),
    stages: stageProgress,
  };
}
