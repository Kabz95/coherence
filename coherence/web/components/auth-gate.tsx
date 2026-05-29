"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { LockKeyhole, ShieldAlert } from "lucide-react";

import { useAuth } from "./auth-provider";

export function AuthGate({ children }: { children: ReactNode }) {
  const { configured, initializing, user } = useAuth();

  if (!configured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <div className="max-w-xl rounded-3xl border border-amber-300/20 bg-amber-300/10 p-6">
          <ShieldAlert className="h-8 w-8 text-amber-200" />
          <h1 className="mt-4 text-2xl font-semibold text-white">
            Firebase configuration required
          </h1>
          <p className="mt-3 text-sm text-amber-100">
            Add the public Firebase web app config to .env.local, then restart the dev server
            before using authenticated clinician workspace features.
          </p>
        </div>
      </div>
    );
  }

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        Checking authentication...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <div className="max-w-xl rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-200">
            <LockKeyhole className="h-6 w-6" />
          </div>

          <h1 className="mt-4 text-2xl font-semibold text-white">
            Sign in required
          </h1>

          <p className="mt-3 text-sm text-slate-300">
            Coherence workspaces can contain sensitive clinical context. Sign in
            before viewing cases, runs, uploads, or reports.
          </p>

          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/sign-in"
              className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
            >
              Sign in
            </Link>

            <Link
              href="/sign-up"
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
            >
              Create account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
