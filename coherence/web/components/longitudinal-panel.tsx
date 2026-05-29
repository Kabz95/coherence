const trends = [
  "Cortical thickness trend",
  "Regional volume trend",
  "Diffusion connectivity trend",
  "EEG band-power trend"
];

export function LongitudinalPanel() {
  return (
    <section className="rounded-lg border border-line bg-panel/75 p-5">
      <h2 className="text-base font-semibold text-white">Longitudinal progress monitoring</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        Future outputs will support comparison across timepoints with measurement uncertainty. These trend placeholders are not diagnostic conclusions.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {trends.map((trend, index) => (
          <div key={trend} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
            <div className="text-sm font-medium text-white">{trend}</div>
            <div className="mt-4 h-16 rounded bg-gradient-to-r from-cyan-300/20 via-violet/15 to-gold/20" />
            <div className="mt-3 text-xs text-slate-400">Timepoint {index + 1} comparison placeholder</div>
          </div>
        ))}
      </div>
    </section>
  );
}
