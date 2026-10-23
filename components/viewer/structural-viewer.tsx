"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Box, Layers, Lock, ScanLine, X } from "lucide-react";
import { StatusChip } from "../status-chip";
import { getFirebaseServices, isFirebaseConfigured } from "@/lib/firebase";
import { readBrainViewerData, readLiveViewerAssets, resolveRegionByLabel } from "@/lib/live-outputs";
import type { BrainRegionInfo } from "@/lib/live-outputs";
import type { NeuroRun } from "@/lib/types";

type StructuralTab = "slices" | "volume";

// WebGL viewer loads only when the 3D tab needs it (no SSR, lazy chunk).
const NiivueViewer = dynamic(() => import("./niivue-viewer").then((mod) => mod.NiivueViewer), {
  ssr: false,
});

const ROADMAP_TABS = [
  { id: "diffusion", label: "Diffusion / connectome" },
  { id: "eeg", label: "EEG" },
] as const;

function AssetStatus({ run }: { run: NeuroRun }) {
  const assets = run.outputs?.visualizationAssets ?? {};
  const keys = Object.keys(assets);
  if (keys.length) {
    return (
      <p className="mt-3 text-xs text-slate-500">
        {keys.length} rendered asset(s) attached: {keys.join(", ")}.
      </p>
    );
  }
  // Live backend layout: assets ride on the 3D prep stage record instead of
  // outputs.visualizationAssets (see lib/live-outputs.ts).
  const live = readLiveViewerAssets(run);
  const parts: string[] = [];
  if (live.previews.length) {
    parts.push(`${live.previews.length} plane preview(s): ${live.previews.map((preview) => preview.label).join(", ")}`);
  }
  if (live.volumeStoragePath) parts.push(`brain volume (${live.volumeFileName ?? "volume"})`);
  if (live.overlayCount) parts.push(`${live.overlayCount} region overlay(s)`);
  if (parts.length) {
    return (
      <p className="mt-3 text-xs text-slate-500">
        Rendered assets attached: {parts.join(" · ")}.
      </p>
    );
  }
  return (
    <p className="mt-3 text-xs text-slate-500">
      No rendered viewer assets are attached to this run yet. When the backend
      visualization jobs complete, slice montages and volume renders appear here.
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
  // Live backend layout: plane previews and the brain volume ride on the
  // 3D prep stage record (see lib/live-outputs.ts). Preview images live in
  // Firebase Storage, so resolve download URLs for the paths the job left.
  const liveAssets = useMemo(() => readLiveViewerAssets(run), [run]);
  const brainData = useMemo(() => readBrainViewerData(run), [run]);
  // The interactive viewer is the primary surface when a volume exists.
  const [tab, setTab] = useState<StructuralTab>(() =>
    readLiveViewerAssets(run).volumeStoragePath ? "volume" : "slices",
  );
  const assets = run.outputs?.visualizationAssets ?? {};
  const sliceAsset = assets["slice_montage"] ?? assets["mri2d"];
  const volumeAsset = assets["volume_render"] ?? assets["mri3d"];
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  const [selectedRegion, setSelectedRegion] = useState<BrainRegionInfo | null>(null);
  const [pickedLabel, setPickedLabel] = useState<number | null>(null);
  const [hemisphereFilter, setHemisphereFilter] = useState<string>("all");

  const handleLabelPick = (label: number) => {
    const region = brainData ? resolveRegionByLabel(brainData, label) : undefined;
    if (region) {
      setSelectedRegion(region);
      setPickedLabel(null);
    } else {
      setSelectedRegion(null);
      setPickedLabel(label);
    }
  };

  const selectRegion = (region: BrainRegionInfo) => {
    setSelectedRegion(region);
    setPickedLabel(null);
  };
  useEffect(() => {
    let cancelled = false;
    const previews = liveAssets.previews;
    if (!previews.length || !isFirebaseConfigured()) return;
    void (async () => {
      try {
        const { getDownloadURL, ref } = await import("firebase/storage");
        const { storage } = await getFirebaseServices();
        const resolved: Record<string, string> = {};
        await Promise.all(
          previews.map(async (preview) => {
            try {
              resolved[preview.storagePath] = await getDownloadURL(ref(storage, preview.storagePath));
            } catch {
              // Leave unresolved; the tile falls back to its label.
            }
          }),
        );
        if (!cancelled) setPreviewUrls(resolved);
      } catch {
        // Storage unavailable in this shell; the asset inventory still shows.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [liveAssets]);

  // Resolve the volume + primary overlay paths for the interactive viewer.
  const [volumeUrls, setVolumeUrls] = useState<{ volume?: string; overlay?: string }>({});
  useEffect(() => {
    let cancelled = false;
    const volumePath = liveAssets.volumeStoragePath;
    if (!volumePath || !isFirebaseConfigured()) return;
    void (async () => {
      try {
        const { getDownloadURL, ref } = await import("firebase/storage");
        const { storage } = await getFirebaseServices();
        const resolved: { volume?: string; overlay?: string } = {};
        try {
          resolved.volume = await getDownloadURL(ref(storage, volumePath));
        } catch {
          // Leave unresolved; the tab keeps its attached-assets panel.
        }
        const overlayPath = liveAssets.overlayStoragePaths[0];
        if (overlayPath) {
          try {
            resolved.overlay = await getDownloadURL(ref(storage, overlayPath));
          } catch {
            // The volume still renders without the overlay.
          }
        }
        if (!cancelled) setVolumeUrls(resolved);
      } catch {
        // Storage unavailable in this shell; the tab keeps its panel.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [liveAssets]);

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
              ? "border-copper-300 bg-copper-300/10 text-copper-50"
              : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-copper-300/40"
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
              ? "border-copper-300 bg-copper-300/10 text-copper-50"
              : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-copper-300/40"
          }`}
        >
          <Box className="h-4 w-4" />
          Interactive viewer
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

      <div className="mt-4 min-h-[340px] overflow-hidden rounded-lg border border-line bg-[#050607]">
        {tab === "slices" ? (
          sliceAsset ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sliceAsset} alt="Structural MRI slice montage" className="h-full max-h-[480px] w-full object-contain" />
          ) : liveAssets.previews.length ? (
            <div className="grid gap-3 p-4 sm:grid-cols-3">
              {liveAssets.previews.map((preview) => (
                <figure key={preview.storagePath} className="space-y-2">
                  {previewUrls[preview.storagePath] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrls[preview.storagePath]}
                      alt={`${preview.label} structural MRI preview`}
                      className="w-full rounded-lg border border-white/10 bg-black/30 object-contain"
                    />
                  ) : (
                    <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-white/15 p-4 text-center text-xs text-slate-500">
                      {preview.label} preview attached — image unavailable in this view.
                    </div>
                  )}
                  <figcaption className="text-center text-xs text-slate-400">{preview.label}</figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[340px] flex-col items-center justify-center p-8 text-center">
              <Layers className="h-12 w-12 text-copper-200/70" aria-hidden />
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
        ) : liveAssets.volumeStoragePath && volumeUrls.volume ? (
          <NiivueViewer volumeUrl={volumeUrls.volume} overlayUrl={volumeUrls.overlay} onLabelPick={handleLabelPick} />
        ) : liveAssets.volumeStoragePath ? (
          <div className="flex min-h-[340px] flex-col items-center justify-center p-8 text-center">
            <Box className="h-12 w-12 text-copper-200/70" aria-hidden />
            <h3 className="mt-4 text-base font-semibold text-white">Brain volume attached</h3>
            <p className="mt-2 max-w-lg text-sm leading-6 text-slate-300">
              The 3D structural assets job attached the brain-only volume{" "}
              <span className="text-slate-100">{liveAssets.volumeFileName ?? "volume"}</span>
              {liveAssets.overlayCount
                ? ` and ${liveAssets.overlayCount} region overlay(s)`
                : ""}{" "}
              to this run. The interactive viewer appears here once the volume file loads;
              the rendered plane previews are under 2D slices.
            </p>
          </div>
        ) : (
          <div className="flex min-h-[340px] flex-col items-center justify-center p-8 text-center">
            <Box className="h-12 w-12 text-copper-200/70" aria-hidden />
            <h3 className="mt-4 text-base font-semibold text-white">3D volume viewer</h3>
            <p className="mt-2 max-w-lg text-sm leading-6 text-slate-300">
              Interactive volume and surface renders (NiiVue integration point) will
              mount here once the 3D structural assets job attaches outputs to this run.
            </p>
          </div>
        )}
      </div>

      {selectedRegion ? (
        <div className="mt-4 rounded-xl border border-copper-300/25 bg-copper-300/[0.05] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">{selectedRegion.displayName}</h3>
              <p className="mt-0.5 text-xs text-slate-400">
                {[selectedRegion.hemisphere, ...selectedRegion.categories].filter(Boolean).join(" · ") ||
                  "Region findings from the backend viewer data."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedRegion(null)}
              aria-label="Clear selected region"
              className="rounded-md border border-white/10 p-1 text-slate-400 hover:border-copper-300/40 hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {selectedRegion.metrics.length ? (
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              {selectedRegion.metrics.map((metric) => (
                <div key={metric.label} className="flex items-baseline justify-between gap-3 rounded-lg bg-black/25 px-3 py-2 text-sm">
                  <dt className="text-xs uppercase tracking-wide text-slate-400">{metric.label}</dt>
                  <dd className="text-right text-slate-100">{metric.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-400">No metrics were recorded for this region in this run.</p>
          )}
          {selectedRegion.available === false ? (
            <p className="mt-3 text-sm text-amber-200/90">
              Not available for this run{selectedRegion.availabilityReason ? `: ${selectedRegion.availabilityReason}` : "."}
            </p>
          ) : null}
          {selectedRegion.warnings.length ? (
            <ul className="mt-3 space-y-1 text-sm text-amber-200/90">
              {selectedRegion.warnings.map((warning, index) => (
                <li key={index}>• {warning}</li>
              ))}
            </ul>
          ) : null}
          {selectedRegion.evidenceRefCount ? (
            <p className="mt-3 text-xs text-slate-500">
              {selectedRegion.evidenceRefCount} evidence reference(s) recorded for this region.
            </p>
          ) : null}
        </div>
      ) : pickedLabel !== null ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
          Label {pickedLabel} at the crosshair is not matched in this run&apos;s region index.
          Browse the region list below to see findings by region.
        </div>
      ) : null}

      {brainData?.regions.length ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-slate-200">Brain regions</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Tap a region to see its findings — or click a coloured region in the interactive viewer.
          </p>
          {(() => {
            const hemispheres = [...new Set(brainData.regions.map((region) => region.hemisphere).filter(Boolean))] as string[];
            const visible =
              hemisphereFilter === "all"
                ? brainData.regions
                : brainData.regions.filter((region) => region.hemisphere === hemisphereFilter);
            return (
              <>
                {hemispheres.length > 1 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {["all", ...hemispheres].map((hemisphere) => (
                      <button
                        key={hemisphere}
                        type="button"
                        onClick={() => setHemisphereFilter(hemisphere)}
                        aria-pressed={hemisphereFilter === hemisphere}
                        className={`rounded-full border px-2.5 py-1 text-xs capitalize ${
                          hemisphereFilter === hemisphere
                            ? "border-copper-300 bg-copper-300/10 text-copper-50"
                            : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-copper-300/40"
                        }`}
                      >
                        {hemisphere === "all" ? "All" : hemisphere}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="mt-2 grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-3">
                  {visible.map((region) => (
                    <button
                      key={`${region.regionId}-${region.displayName}`}
                      type="button"
                      onClick={() => selectRegion(region)}
                      aria-pressed={selectedRegion === region}
                      className={`rounded-lg border px-2.5 py-1.5 text-left text-xs ${
                        selectedRegion === region
                          ? "border-copper-300 bg-copper-300/15 text-copper-50"
                          : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-copper-300/40"
                      }`}
                    >
                      {region.displayName}
                    </button>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      ) : null}

      <AssetStatus run={run} />

      <p className="mt-3 text-xs leading-5 text-slate-500">
        Viewer outputs are supplementary, non-diagnostic visual summaries for clinician
        review. They do not establish, confirm, predict, or rule out any diagnosis.
      </p>
    </section>
  );
}

export default StructuralViewer;
