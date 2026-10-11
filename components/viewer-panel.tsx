"use client";

import { useState } from "react";
import { Activity, Brain, Network, ScanLine } from "lucide-react";

const tabs = [
  { id: "mri2d", label: "2D MRI", icon: ScanLine },
  { id: "mri3d", label: "3D MRI", icon: Brain },
  { id: "diffusion", label: "Diffusion / connectome", icon: Network },
  { id: "eeg", label: "EEG", icon: Activity }
] as const;

export function ViewerPanel() {
  const [active, setActive] = useState<(typeof tabs)[number]["id"]>("mri2d");
  const activeTab = tabs.find((tab) => tab.id === active) ?? tabs[0];
  const Icon = activeTab.icon;

  return (
    <section className="rounded-lg border border-line bg-panel/75 p-5">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Viewer panels">
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active === tab.id}
              onClick={() => setActive(tab.id)}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                active === tab.id ? "border-cyan-300 bg-cyan-300/10 text-cyan-50" : "border-white/10 bg-white/[0.03] text-slate-300"
              }`}
            >
              <TabIcon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="mt-5 min-h-[320px] rounded-lg border border-white/10 bg-[radial-gradient(circle_at_center,rgba(103,232,249,0.14),rgba(8,13,27,0.95)_52%)] p-6">
        <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center">
          <Icon className="h-14 w-14 text-cyan-200" aria-hidden />
          <h3 className="mt-4 text-lg font-semibold text-white">{activeTab.label} viewer placeholder</h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
            Future integration point for rendered assets. This panel is reserved for NiiVue volume/surface views, connectome visualizations, and MNE-derived EEG traces or spectrograms.
          </p>
          {/* TODO: Mount NiiVue, connectome canvas, or EEG chart components here when backend assets are available. */}
        </div>
      </div>
    </section>
  );
}
