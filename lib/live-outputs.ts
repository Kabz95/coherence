import type { NeuroRun, StructuralMeasurements } from "./types";

/**
 * Adapter between the live backend's output records and the shapes the
 * report and viewer components were built against.
 *
 * The backend workers embed each job's manifest at outputs.<job_kind>; the
 * manifest's own `outputs` object holds the job's artifacts (regional
 * measurements, rendered previews, volume files). The report and viewer
 * predate that layout — they read published fields such as
 * outputs.structural and outputs.visualizationAssets, which the live
 * backend does not write. The readers below translate the live records so
 * completed runs display their real data. When the backend contract is
 * unified with the frontend, this module is the one place to remove.
 */

type Dict = Record<string, unknown>;

export function asDict(value: unknown): Dict | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Dict) : null;
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** The artifact object a live job left on its embedded stage manifest. */
function stageOutputs(run: NeuroRun, jobKind: string): Dict | null {
  const outputs = asDict(run.outputs);
  const stage = outputs ? asDict(outputs[jobKind]) : null;
  return stage ? asDict(stage.outputs) : null;
}

/** Public wrapper over the stage-manifest reader, for other report modules. */
export function readStageOutputs(run: NeuroRun, jobKind: string): Dict | null {
  return stageOutputs(run, jobKind);
}

export interface RegionalVolume {
  region: string;
  volumeMm3: number;
}

function regionalVolumes(list: unknown): RegionalVolume[] {
  if (!Array.isArray(list)) return [];
  const volumes: RegionalVolume[] = [];
  for (const item of list) {
    const entry = asDict(item);
    if (!entry) continue;
    const region = typeof entry.region === "string" ? entry.region : null;
    const volumeMm3 = asFiniteNumber(entry.volumeMm3);
    if (region && volumeMm3 !== undefined) volumes.push({ region, volumeMm3 });
  }
  return volumes;
}

function liveRegionalVolumes(run: NeuroRun): RegionalVolume[] {
  const fromStage = regionalVolumes(stageOutputs(run, "structural_analysis")?.regionalMeasurements);
  if (fromStage.length) return fromStage;
  // Fallback: the report builder's morphometric summary embeds regional
  // volume items in the same shape (report.summary.morphometricReport).
  const summary = asDict(asDict(run.report)?.summary);
  const morphometric = asDict(summary?.morphometricReport);
  const regional = asDict(morphometric?.regionalMorphometry);
  return regionalVolumes(regional?.regions);
}

export interface LiveStructuralMeasurements extends StructuralMeasurements {
  /**
   * Brain tissue volume from the backend's NIfTI summary. This is NOT an
   * intracranial volume and is never presented as one.
   */
  estimatedTissueVolumeMl?: number;
}

export function readLiveStructuralMeasurements(run: NeuroRun): LiveStructuralMeasurements {
  const measurements: LiveStructuralMeasurements = {};

  const volumes = new Map(liveRegionalVolumes(run).map((entry) => [entry.region, entry.volumeMm3]));
  const leftHippocampus = volumes.get("Left-Hippocampus");
  if (leftHippocampus !== undefined) measurements.leftHippocampusMl = leftHippocampus / 1000;
  const rightHippocampus = volumes.get("Right-Hippocampus");
  if (rightHippocampus !== undefined) measurements.rightHippocampusMl = rightHippocampus / 1000;

  const summary = asDict(stageOutputs(run, "structural_analysis")?.structuralSummary);
  const summaryTissue = summary ? asFiniteNumber(summary.estimatedTissueVolumeMl) : undefined;
  if (summaryTissue !== undefined) {
    measurements.estimatedTissueVolumeMl = summaryTissue;
  } else {
    const reportSummary = asDict(asDict(run.report)?.summary);
    const morphometric = asDict(reportSummary?.morphometricReport);
    const globalMorphometry = asDict(morphometric?.globalMorphometry);
    const globalTissue = globalMorphometry ? asFiniteNumber(globalMorphometry.estimatedTissueVolumeMl) : undefined;
    if (globalTissue !== undefined) measurements.estimatedTissueVolumeMl = globalTissue;
  }

  return measurements;
}

export interface RegionalVolumeTable {
  /** Largest regions by volume (backend-curated list when present), capped at 20. */
  largest: RegionalVolume[];
  /** Total number of regions measured. */
  total: number;
}

/** The regional volume table for report rendering: top regions + how many were measured. */
export function readRegionalVolumeTable(run: NeuroRun): RegionalVolumeTable | null {
  const summary = asDict(asDict(run.report)?.summary);
  const morphometric = asDict(summary?.morphometricReport);
  const regional = asDict(morphometric?.regionalMorphometry);
  const curatedLargest = regionalVolumes(regional?.largestRegionsByVolume);
  const summarized = regionalVolumes(regional?.regions);
  const regionCount = regional?.regionCount;

  const pool = summarized.length ? summarized : liveRegionalVolumes(run);
  if (!pool.length && !curatedLargest.length) return null;
  const sorted = [...pool].sort((a, b) => b.volumeMm3 - a.volumeMm3);
  return {
    largest: (curatedLargest.length ? curatedLargest : sorted).slice(0, 20),
    total: typeof regionCount === "number" ? regionCount : sorted.length,
  };
}

export interface LiveViewerPreview {
  label: string;
  storagePath: string;
}

export interface LiveViewerAssets {
  previews: LiveViewerPreview[];
  /** Bucket-relative path of the brain-only NIfTI volume, when attached. */
  volumeStoragePath?: string;
  volumeFileName?: string;
  /** Bucket-relative paths of region overlay volumes (label image first). */
  overlayStoragePaths: string[];
  overlayCount: number;
}

/** Normalizes a live-backend file reference (string path/URI, or an object carrying one) to a bucket-relative path. */
function toStoragePath(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return storagePathFromUri(value);
  const entry = asDict(value);
  if (!entry) return undefined;
  for (const key of ["storagePath", "uri", "path", "url"]) {
    const candidate = entry[key];
    if (typeof candidate === "string" && candidate.length > 0) return storagePathFromUri(candidate);
  }
  return undefined;
}

/** gs://<bucket>/<path> → <path>; anything else is returned unchanged. */
export function storagePathFromUri(uri: string): string {
  if (!uri.startsWith("gs://")) return uri;
  const rest = uri.slice("gs://".length);
  const slash = rest.indexOf("/");
  return slash >= 0 ? rest.slice(slash + 1) : rest;
}

export interface BrainRegionInfo {
  regionId: string;
  displayName: string;
  hemisphere?: string;
  categories: string[];
  metrics: Array<{ label: string; value: string }>;
  available?: boolean;
  availabilityReason?: string;
  warnings: string[];
  evidenceRefCount: number;
  meshObjectName?: string;
  /** Numeric voxel-label ids this region may answer to in the label overlay. */
  labelIds: number[];
}

export interface BrainViewerData {
  regions: BrainRegionInfo[];
  selectedMetricDefault?: string;
}

function strValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function strListValue(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function prettyMetricLabel(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

function formatMetricValue(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(3).replace(/\.?0+$/, "");
  }
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const entry = asDict(value);
  if (entry && typeof entry.value === "number" && Number.isFinite(entry.value)) {
    const formatted = formatMetricValue(entry.value);
    const unit = typeof entry.unit === "string" ? ` ${entry.unit}` : "";
    return formatted !== undefined ? `${formatted}${unit}` : undefined;
  }
  return undefined;
}

function numericLabelId(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value.trim());
  return undefined;
}

/**
 * The backend's per-region viewer index (report.summary.morphometricReport
 * .brainViewerData): display names, hemispheres, metrics, and the label ids
 * the region answers to in the viewer's label overlay — the data behind
 * click-a-region findings.
 */
export function readBrainViewerData(run: NeuroRun): BrainViewerData | null {
  const summary = asDict(asDict(run.report)?.summary);
  const morphometric = asDict(summary?.morphometricReport);
  const raw = asDict(morphometric?.brainViewerData);
  if (!raw || !Array.isArray(raw.regions)) return null;

  const regions: BrainRegionInfo[] = [];
  for (const item of raw.regions) {
    const entry = asDict(item);
    if (!entry) continue;
    const displayName = strValue(entry.displayName) ?? strValue(entry.regionId) ?? strValue(entry.name);
    if (!displayName) continue;

    const labelIds: number[] = [];
    const pushId = (value: unknown) => {
      const id = numericLabelId(value);
      if (id !== undefined && id > 0 && !labelIds.includes(id)) labelIds.push(id);
    };
    pushId(entry.regionId);
    const clickTarget = asDict(entry.clickTarget);
    if (clickTarget) {
      pushId(clickTarget.labelId);
      pushId(clickTarget.label);
      pushId(clickTarget.id);
      pushId(clickTarget.value);
    }

    const metricsDict = asDict(entry.metrics);
    const metrics: Array<{ label: string; value: string }> = [];
    if (metricsDict) {
      pushId(metricsDict.labelId);
      pushId(metricsDict.label);
      for (const [key, value] of Object.entries(metricsDict)) {
        const formatted = formatMetricValue(value);
        if (formatted !== undefined) metrics.push({ label: prettyMetricLabel(key), value: formatted });
        if (metrics.length >= 10) break;
      }
    }

    regions.push({
      regionId: strValue(entry.regionId) ?? displayName,
      displayName,
      hemisphere: strValue(entry.hemisphere),
      categories: strListValue(entry.categories),
      metrics,
      available: typeof entry.available === "boolean" ? entry.available : undefined,
      availabilityReason: strValue(entry.availabilityReason),
      warnings: strListValue(entry.warnings),
      evidenceRefCount: Array.isArray(entry.evidenceRefs) ? entry.evidenceRefs.length : 0,
      meshObjectName: strValue(entry.meshObjectName),
      labelIds,
    });
  }
  if (!regions.length) return null;
  return { regions, selectedMetricDefault: strValue(raw.selectedMetricDefault) };
}

/** Resolves a voxel label from the viewer's label overlay to its region, when the index carries the id. */
export function resolveRegionByLabel(data: BrainViewerData, label: number): BrainRegionInfo | undefined {
  return data.regions.find((region) => region.labelIds.includes(label));
}

export function readLiveViewerAssets(run: NeuroRun): LiveViewerAssets {
  const outs = stageOutputs(run, "structural_3d_prep");

  const previews: LiveViewerPreview[] = [];
  const rawPreviews = outs?.previewThumbnails;
  if (Array.isArray(rawPreviews)) {
    for (const item of rawPreviews) {
      const entry = asDict(item);
      if (!entry) continue;
      const storagePath = typeof entry.storagePath === "string" ? entry.storagePath : null;
      const label = typeof entry.label === "string" ? entry.label : "Preview";
      if (storagePath) previews.push({ label, storagePath });
    }
  }

  let volumeStoragePath: string | undefined;
  let volumeFileName: string | undefined;
  const rawVolume = outs?.niiVueVolume;
  if (typeof rawVolume === "string" && rawVolume.length > 0) {
    volumeStoragePath = storagePathFromUri(rawVolume);
    volumeFileName = volumeStoragePath.split("/").pop() ?? rawVolume;
  }

  // Region overlays: the label image (regionLabelOverlayNifti) is the
  // primary overlay; niiVueOverlays may repeat it or add more. Dedupe by
  // path so the count and the viewer agree.
  const overlayStoragePaths: string[] = [];
  const pushOverlay = (path: string | undefined) => {
    if (path && !overlayStoragePaths.includes(path)) overlayStoragePaths.push(path);
  };
  pushOverlay(toStoragePath(outs?.regionLabelOverlayNifti));
  const rawOverlays = outs?.niiVueOverlays;
  if (Array.isArray(rawOverlays)) {
    for (const item of rawOverlays) pushOverlay(toStoragePath(item));
  }

  return { previews, volumeStoragePath, volumeFileName, overlayStoragePaths, overlayCount: overlayStoragePaths.length };
}
