"use client";

import { useState } from "react";
import { Box, Layers, Lock, ScanLine } from "lucide-react";
import { StatusChip } from "../status-chip";
import type { NeuroRun } from "@/lib/types";

type StructuralTab = "slices" | "volume";

const ROADMAP_TABS = [
  { id: "diffusion", label: "Diffusion / connectome" },
  { id: "eeg", label: "EEG" },
] as const;

function AssetStatus({ run }: { run: NeuroRun }) {
  const assets = run.outputs?.visualizationAssets ?? {};
  const keys = Object.keys(assets);
  if (!keys.length) {
    return (
      <p className="mt-3 text-xs text-slate-500">
        No rendered viewer assets are attached to this run yet. When the backend
        visualization jobs complete, slice montages and volume renders appear here.
      </p>
    );
  }
  return (
    <p className="mt-3 text-xs text-slate-500">
      {keys.length} rendered asset(s) attached: {keys.join(", ")}.
    </p>
  );
}

/**
 * Structural-first viewer shell. Mounts real rendered assets when the backend
 * provides them (visualizationAssets URLs) and otherwise presents the
 * integration surface with clear asset status. Diffusion and EEG tabs are
 * marked as roadmap, per the structural-MRI-first MVP rule.
 */
export function StructuralViewer({ run }: { run: NeuroRun }) {
  const [tab, setTab] = useState<StructuralTab>("slices");
  const assets = run.outputs?.visualizationAssets ?? {};
  const sliceAsset = assets["slice_montage"] ?? assets["mri2d"];
  const volumeAsset = assets["volume_render"] ?? assets["mri3d"];

  return (
    <section aria-label="Structural MRI viewer" className="rounded-2xl border border-white/10 bg-panel/80 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Structural viewer</h2>
          <p className="mt-1 text-sm text-slate-400">
            Run <span className="text-slate-200">{run.id}</span>
          </p>
        </div>
        <StatusChip status={run.status} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Viewer views">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "slices"}
          onClick={() => setTab("slices")}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
            tab === "slices"
              ? "border-cyan-300 bg-cyan-300/10 text-cyan-50"
              : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-cyan-300/40"
          }`}
        >
          <ScanLine className="h-4 w-4" />
          2D slices
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "volume"}
          onClick={() => setTab("volume")}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
            tab === "volume"
              ? "border-cyan-300 bg-cyan-300/10 text-cyan-50"
              : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-cyan-300/40"
          }`}
        >
          <Box className="h-4 w-4" />
          3D volume
        </button>
        {ROADMAP_TABS.map((roadmap) => (
          <span
            key={roadmap.id}
            title="Roadmap — not part of the structural-MRI-first MVP"
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-slate-500"
          >
            <Lock className="h-4 w-4" />
            {roadmap.label}
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-400">
              Roadmap
            </span>
          </span>
        ))}
      </div>

      <div className="mt-4 min-h-[340px] overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_center,rgba(103,232,249,0.12),rgba(8,13,27,0.95)_55%)]">
        {tab === "slices" ? (
          sliceAsset ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sliceAsset} alt="Structural MRI slice montage" className="h-full max-h-[480px] w-full object-contain" />
          ) : (
            <div className="flex min-h-[340px] flex-col items-center justify-center p-8 text-center">
              <Layers className="h-12 w-12 text-cyan-200/70" aria-hidden />
              <h3 className="mt-4 text-base font-semibold text-white">2D slice viewer</h3>
              <p className="mt-2 max-w-lg text-sm leading-6 text-slate-300">
                Axial, coronal, and sagittal slice montages will render here once the
                structural visualization job attaches rendered assets to this run.
              </p>
            </div>
          )
        ) : volumeAsset ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={volumeAsset} alt="Structural MRI volume render" className="h-full max-h-[480px] w-full object-contain" />
        ) : (
          <div className="flex min-h-[340px] flex-col items-center justify-center p-8 text-center">
            <Box className="h-12 w-12 text-cyan-200/70" aria-hidden />
            <h3 className="mt-4 text-base font-semibold text-white">3D volume viewer</h3>
            <p className="mt-2 max-w-lg text-sm leading-6 text-slate-300">
              Interactive volume and surface renders (NiiVue integration point) will
              mount here once the 3D structural assets job attaches outputs to this run.
            </p>
          </div>
        )}
      </div>

      <AssetStatus run={run} />

      <p className="mt-3 text-xs leading-5 text-slate-500">
        Viewer outputs are supplementary, non-diagnostic visual summaries for clinician
        review. They do not establish, confirm, predict, or rule out any diagnosis.
      </p>
    </section>
  );
}

export default StructuralViewer;
