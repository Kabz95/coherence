"use client";

import Link from "next/link";
import { LockKeyhole, ShieldAlert } from "lucide-react";
import { useAuth } from "./auth-provider";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { configured, initializing, user } = useAuth();

  if (!configured) {
    return (
      <div className="mx-auto max-w-2xl rounded-lg border border-gold/35 bg-gold/10 p-6 text-amber-50">
        <ShieldAlert className="h-8 w-8 text-gold" />
        <h1 className="mt-4 text-xl font-semibold">Firebase configuration required</h1>
        <p className="mt-2 text-sm leading-6">
          Add the public Firebase web app config to `.env.local`, then restart the dev server before using authenticated clinician workspace features.
        </p>
      </div>
    );
  }

  if (initializing) {
    return (
      <div className="rounded-lg border border-line bg-panel/75 p-6 text-sm text-slate-300">
        Checking authentication...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl rounded-lg border border-line bg-panel/75 p-6 text-center shadow-glow">
        <LockKeyhole className="mx-auto h-10 w-10 text-cyan-200" />
        <h1 className="mt-4 text-2xl font-semibold text-white">Sign in required</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Coherence workspaces can contain sensitive clinical context. Sign in before viewing cases, runs, uploads, or reports.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/sign-in" className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-medium text-slate-950">
            Sign in
          </Link>
          <Link href="/sign-up" className="rounded-md border border-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
            Create account
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
