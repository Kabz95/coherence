"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { FlaskConical, LockKeyhole } from "lucide-react";

import { useAuth } from "./auth-provider";

export function AuthGate({ children }: { children: ReactNode }) {
  const { demoMode, initializing, user, demoUser, signInAsDemo } = useAuth();
  const signedIn = Boolean(user ?? demoUser);

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        Checking authentication...
      </div>
    );
  }

  // Symposium demo path: a local demo clinician session unlocks the seeded
  // workspace without any backend configuration.
  if (demoMode && !signedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <div className="max-w-xl rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-200">
            <FlaskConical className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-white">Demo workspace</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Firebase is not configured, so Coherence is running in demo mode with
            seeded symposium cases. Continue with the demo clinician account to
            walk the full demo path — no real patient data is involved.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={signInAsDemo}
              className="rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
            >
              Continue with demo account
            </button>
            <Link
              href="/sign-in"
              className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-slate-200 hover:bg-white/10"
            >
              About sign-in
            </Link>
          </div>
          <p className="mt-5 text-xs text-slate-500">
            To use real authentication and live data, add your Firebase web config
            to <code>.env.local</code> and restart the dev server.
          </p>
        </div>
      </div>
    );
  }

  if (!signedIn) {
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
