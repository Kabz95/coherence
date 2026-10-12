import type { Modality } from "@/lib/types";

const labels: Record<Modality, { title: string; description: string }> = {
  structural_mri: { title: "Structural MRI", description: "DICOM ZIP or NIfTI inputs for structural measurement workflows." },
  diffusion_mri: { title: "Diffusion MRI / DTI", description: "Diffusion volumes with bval/bvec companion files for tensor summaries." },
  fmri: { title: "Functional MRI", description: "4D BOLD series with BIDS sidecar for resting-state summaries (ALFF, DVARS, tSNR)." },
  eeg: { title: "EEG", description: "EDF, BDF, or CSV recordings for spectral band-power summaries." },
  meg: { title: "MEG", description: "MEG recordings (FIF/DS) as imported data for spectral band-power summaries." },
  multimodal: { title: "Multimodal case", description: "Coordinate structural, diffusion, fMRI, EEG, MEG, and longitudinal comparison stages." }
};

export function ModalityCard({
  modality,
  selected,
  onSelect,
  disabled,
  badge,
}: {
  modality: Modality;
  selected?: boolean;
  onSelect?: (modality: Modality) => void;
  /** Roadmap modalities are visible but not selectable in the MVP build. */
  disabled?: boolean;
  badge?: string;
}) {
  const meta = labels[modality];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect?.(modality)}
      aria-pressed={selected}
      title={disabled ? badge ?? "Not available in this build" : meta.title}
      className={`h-full rounded-lg border p-4 text-left transition ${
        selected ? "border-cyan-300 bg-cyan-300/10" : "border-line bg-white/[0.03] hover:border-cyan-300/40"
      } ${disabled ? "cursor-not-allowed opacity-55 hover:border-line" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-white">{meta.title}</h3>
        {badge ? (
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-300">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-300">{meta.description}</p>
    </button>
  );
}
