import { ReactNode } from "react";
import { AuthGate } from "./auth-gate";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-midnight text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(103,232,249,0.12),transparent_28%),radial-gradient(circle_at_85%_0%,rgba(184,167,255,0.13),transparent_25%)]" />
      <div className="relative flex">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <Topbar />
          <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">
            <AuthGate>{children}</AuthGate>
          </main>
        </div>
      </div>
    </div>
  );
}
