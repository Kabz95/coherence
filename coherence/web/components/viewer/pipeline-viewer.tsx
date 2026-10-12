"use client";

import { useState } from "react";
import { MODALITY_LABELS } from "@/lib/types";
import type { NeuroRun } from "@/lib/types";
import { buildModalityMeasurementRows } from "@/lib/reports/modality-summary";
import { StructuralViewer } from "./structural-viewer";
import { EmptyState } from "../ui/state";

/**
 * Modality-aware run viewer. Structural MRI keeps its dedicated viewer shell;
 * every other pipeline renders its viewer assets and measurement summaries
 * through this shared path.
 */

const ASSET_TITLES: Record<string, string> = {
  slice_montage: "Slice montage",
  volume_render: "Volume preview",
  volume_nifti: "Downsampled volume (NIfTI)",
  diffusion_montage: "FA montage",
  fmri_carpet: "Carpet plot",
  fmri_montage: "Mean BOLD montage",
  eeg_trace: "EEG trace",
  eeg_spectrogram: "EEG spectrogram",
  meg_trace: "MEG trace",
  meg_spectrogram: "MEG spectrogram",
};

function prettyAssetTitle(key: string): string {
  return ASSET_TITLES[key] ?? key.replace(/_/g, " ");
}

function AssetImage({ title, src }: { title: string; src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-4 text-center text-sm text-slate-400">
        <span>
          {title}
          <br />
          <span className="text-xs text-slate-500">Preview renders when backend processing completes.</span>
        </span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={title}
      onError={() => setFailed(true)}
      className="max-h-[420px] w-full rounded-xl border border-white/10 object-contain bg-black/30"
    />
  );
}

export function PipelineViewer({ run }: { run: NeuroRun }) {
  if (run.modality === "structural_mri") {
    return <StructuralViewer run={run} />;
  }

  const modalityLabel = MODALITY_LABELS[run.modality] ?? run.modality;
  const assets = run.outputs?.visualizationAssets ?? {};
  const entries = Object.entries(assets);
  const measurementRows = buildModalityMeasurementRows(run);

  return (
    <section className="space-y-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div>
        <p className="text-sm text-cyan-200">{modalityLabel} viewer</p>
        <h2 className="mt-1 text-lg font-semibold text-white">Pipeline outputs</h2>
        <p className="mt-1 text-sm text-slate-400">
          Viewer assets and measurement summaries produced by the {modalityLabel} pipeline. Values are
          supplementary context for clinician review, not diagnostic markers.
        </p>
      </div>

      {entries.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {entries.map(([key, url]) => (
            <figure key={key} className="space-y-2">
              <AssetImage title={prettyAssetTitle(key)} src={url} />
              <figcaption className="text-xs text-slate-500">{prettyAssetTitle(key)}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No viewer assets yet"
          body="Image previews appear here when backend processing completes for this run."
        />
      )}

      {measurementRows.length ? (
        <div className="rounded-xl border border-white/10 bg-black/25 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Key measurements</h3>
          <dl className="mt-3 space-y-2">
            {measurementRows.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-3 text-sm">
                <dt className="text-slate-400">{row.label}</dt>
                <dd className="text-right text-slate-100">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </section>
  );
}
