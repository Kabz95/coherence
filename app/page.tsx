import Link from "next/link";
import { ArrowRight, BrainCircuit, LineChart, Layers3 } from "lucide-react";
import { DisclaimerBanner } from "@/components/disclaimer-banner";

const pillars = [
  {
    icon: Layers3,
    title: "Multimodal neuro data",
    body: "Organize structural MRI, diffusion MRI, EEG, and multimodal inputs into clinician-reviewable runs."
  },
  {
    icon: LineChart,
    title: "Longitudinal progress monitoring",
    body: "Compare measurements across timepoints with quality-control flags and measurement uncertainty."
  },
  {
    icon: BrainCircuit,
    title: "Non-diagnostic clinical decision support",
    body: "Produce structured summaries that support clinician judgment without generating DSM or ICD conclusions."
  }
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-midnight text-white">
      <section className="relative overflow-hidden px-6 py-8 md:px-10">
        <div className="relative mx-auto flex min-h-[92vh] max-w-7xl flex-col">
          <header className="flex items-center justify-between">
            <div className="text-lg font-semibold tracking-[0.2em]">COHERENCE</div>
            <Link href="/dashboard" className="rounded-md border border-white/15 px-3 py-2 text-sm text-copper-50 hover:bg-white/10">
              Open dashboard
            </Link>
          </header>
          <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.08fr_0.92fr]">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-copper-100/70">Clinician-facing neuroimaging support</p>
              <h1 className="mt-5 max-w-4xl text-5xl font-semibold leading-tight md:text-7xl">Coherence</h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200">
                A calm, evidence-led workspace for organizing neuroimaging and EEG-derived measurements, quality flags, longitudinal comparisons, and structured non-diagnostic reports.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-md bg-copper-300 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-copper-200">
                  Enter workspace <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/upload" className="rounded-md border border-white/15 px-5 py-3 text-sm font-medium text-white hover:bg-white/10">
                  Register data
                </Link>
              </div>
            </div>
            <div className="rounded-lg border border-line bg-panel p-5 shadow-glow">
              <div className="aspect-[4/3] rounded-md border border-line bg-ink p-6">
                <div className="grid h-full grid-cols-3 gap-3">
                  {Array.from({ length: 12 }).map((_, index) => (
                    <div
                      key={index}
                      className={`rounded border ${index === 4 ? "border-copper-500/50 bg-copper-500/10" : "border-line bg-white/[0.02]"}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-4 pb-6 md:grid-cols-3">
            {pillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div key={pillar.title} className="rounded-lg border border-line bg-panel p-5">
                  <Icon className="h-6 w-6 text-gold" />
                  <h2 className="mt-4 font-semibold">{pillar.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{pillar.body}</p>
                </div>
              );
            })}
          </div>
          <DisclaimerBanner />
        </div>
      </section>
    </main>
  );
}
