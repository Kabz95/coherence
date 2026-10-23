"use client";

import { useEffect, useRef, useState } from "react";
import { Niivue, SLICE_TYPE } from "@niivue/niivue";

/**
 * Interactive NiiVue volume viewer for a run's brain-only NIfTI volume with
 * its region-label overlay. Loaded lazily (next/dynamic, no SSR) by the
 * structural viewer — WebGL2 is required; when the volume cannot load, the
 * caller keeps its attached-assets fallback panel.
 */

interface NiivueViewerProps {
  volumeUrl: string;
  overlayUrl?: string;
}

type ViewerStatus = "loading" | "ready" | "error";

const VIEW_BUTTONS = [
  { id: "multiplanar", label: "Multiplanar", sliceType: SLICE_TYPE.MULTIPLANAR },
  { id: "render", label: "3D render", sliceType: SLICE_TYPE.RENDER },
  { id: "axial", label: "Axial", sliceType: SLICE_TYPE.AXIAL },
  { id: "coronal", label: "Coronal", sliceType: SLICE_TYPE.CORONAL },
  { id: "sagittal", label: "Sagittal", sliceType: SLICE_TYPE.SAGITTAL },
] as const;

type ViewId = (typeof VIEW_BUTTONS)[number]["id"];

const INITIAL_OVERLAY_OPACITY = 0.55;

export function NiivueViewer({ volumeUrl, overlayUrl }: NiivueViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nvRef = useRef<Niivue | null>(null);
  const [status, setStatus] = useState<ViewerStatus>("loading");
  const [view, setView] = useState<ViewId>("multiplanar");
  const [overlayOn, setOverlayOn] = useState(true);
  const [overlayOpacity, setOverlayOpacity] = useState(INITIAL_OVERLAY_OPACITY);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setView("multiplanar");
    void (async () => {
      try {
        const nv = new Niivue({
          backColor: [0.03, 0.05, 0.11, 1],
          show3Dcrosshair: true,
          isColorbar: false,
        });
        nvRef.current = nv;
        if (!canvasRef.current) return;
        await nv.attachToCanvas(canvasRef.current);
        const volumes: Array<{ url: string; colormap?: string; opacity?: number }> = [
          { url: volumeUrl, colormap: "gray" },
        ];
        if (overlayUrl) {
          volumes.push({ url: overlayUrl, colormap: "hsv", opacity: INITIAL_OVERLAY_OPACITY });
        }
        await nv.loadVolumes(volumes);
        nv.setSliceType(SLICE_TYPE.MULTIPLANAR);
        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      try {
        nvRef.current?.cleanup();
      } catch {
        // Viewer already detached.
      }
      nvRef.current = null;
    };
  }, [volumeUrl, overlayUrl]);

  const applyView = (button: (typeof VIEW_BUTTONS)[number]) => {
    setView(button.id);
    nvRef.current?.setSliceType(button.sliceType);
  };

  const applyOverlayOn = (on: boolean) => {
    setOverlayOn(on);
    nvRef.current?.setOpacity(1, on ? overlayOpacity : 0);
  };

  const applyOverlayOpacity = (value: number) => {
    setOverlayOpacity(value);
    if (overlayOn) nvRef.current?.setOpacity(1, value);
  };

  if (status === "error") {
    return (
      <div className="flex min-h-[340px] flex-col items-center justify-center p-8 text-center">
        <h3 className="text-base font-semibold text-white">Interactive viewer unavailable</h3>
        <p className="mt-2 max-w-lg text-sm leading-6 text-slate-300">
          The brain volume is attached to this run, but the interactive viewer could not load
          it in this browser (WebGL2 is required). The rendered plane previews under 2D slices
          remain available.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3">
      <div className="relative">
        <canvas ref={canvasRef} className="h-[440px] w-full rounded-lg bg-black/40" />
        {status === "loading" ? (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 text-sm text-slate-300">
            Loading volume…
          </div>
        ) : null}
      </div>

      {status === "ready" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1" role="group" aria-label="Volume view">
            {VIEW_BUTTONS.map((button) => (
              <button
                key={button.id}
                type="button"
                onClick={() => applyView(button)}
                aria-pressed={view === button.id}
                className={`rounded-lg border px-2.5 py-1.5 text-xs ${
                  view === button.id
                    ? "border-cyan-300 bg-cyan-300/10 text-cyan-50"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-cyan-300/40"
                }`}
              >
                {button.label}
              </button>
            ))}
          </div>
          {overlayUrl ? (
            <div className="ml-auto flex items-center gap-3 text-xs text-slate-300">
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={overlayOn}
                  onChange={(event) => applyOverlayOn(event.target.checked)}
                  className="h-3.5 w-3.5 accent-cyan-300"
                />
                Region overlay
              </label>
              <label className="inline-flex items-center gap-1.5">
                Opacity
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={overlayOpacity}
                  onChange={(event) => applyOverlayOpacity(Number(event.target.value))}
                  className="w-24 accent-cyan-300"
                />
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="mt-2 text-xs text-slate-500">
        Drag to rotate in 3D render; scroll to move through slices in the planar views.
      </p>
    </div>
  );
}

export default NiivueViewer;
