"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { Activity, Brain, FileText, LayoutDashboard, Upload } from "lucide-react";
import { AuthGate } from "./auth-gate";

type AppShellProps = {
  children: ReactNode;
};

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cases", label: "Cases", icon: Brain },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/reports/demo", label: "Reports", icon: FileText },
];

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(250,204,21,0.12),transparent_30%)]" />

      <aside className="fixed left-0 top-0 hidden h-screen w-72 border-r border-white/10 bg-black/30 p-5 backdrop-blur-xl lg:block">
        <Link href="/" className="flex items-center gap-3">
          <div className="rounded-2xl bg-cyan-300/10 p-3 text-cyan-200">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-semibold text-white">Coherence</p>
            <p className="text-xs text-slate-400">non-diagnostic neuro support</p>
          </div>
        </Link>

        <nav className="mt-8 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-xs text-amber-100">
          Coherence is supplementary and non-diagnostic. It does not establish,
          confirm, predict, or rule out DSM or ICD diagnoses.
        </div>
      </aside>

      <main className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/80 px-5 py-4 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Clinician workspace</p>
              <h1 className="text-xl font-semibold text-white">Coherence</h1>
            </div>

            <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-300">
              production shell
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl p-5">
          <AuthGate>{children}</AuthGate>
        </div>
      </main>
    </div>
  );
}

export default AppShell;
