"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Chrome, Loader2, Mail, ShieldCheck } from "lucide-react";

import {
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from "@/lib/auth";
import { GENERAL_DISCLAIMER } from "@/lib/clinical-copy";
import { isFirebaseConfigured } from "@/lib/firebase";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const configured = isFirebaseConfigured();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isSignUp = mode === "sign-up";

  async function finish(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");

    try {
      await action();
      router.push("/dashboard");
      router.refresh();
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Authentication failed."
      );
    } finally {
      setBusy(false);
    }
  }

  function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    finish(() =>
      isSignUp
        ? signUpWithEmail(email, password)
        : signInWithEmail(email, password)
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-8 lg:grid-cols-2">
        <section>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-sm text-cyan-100">
            <ShieldCheck className="h-4 w-4" />
            COHERENCE
          </div>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white md:text-5xl">
            {isSignUp
              ? "Create a clinician workspace account"
              : "Sign in to Coherence"}
          </h1>

          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">
            Authentication protects access to case organization, upload
            registration, run timelines, and structured non-diagnostic reporting.
          </p>

          <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
            {GENERAL_DISCLAIMER}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30">
          {!configured ? (
            <div className="mb-4 rounded-2xl border border-red-300/20 bg-red-300/10 p-4 text-sm text-red-100">
              Firebase config is missing. Add <code>.env.local</code> values
              and restart the dev server before signing in.
            </div>
          ) : null}

          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <label className="block">
              <span className="text-sm text-slate-300">Email</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                autoComplete="email"
                type="email"
                required
                disabled={busy || !configured}
              />
            </label>

            <label className="block">
              <span className="text-sm text-slate-300">Password</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                type="password"
                minLength={6}
                required
                disabled={busy || !configured}
              />
            </label>

            {error ? (
              <div className="rounded-xl border border-red-300/20 bg-red-300/10 p-3 text-sm text-red-100">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={busy || !configured}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Mail className="h-4 w-4" />
              {busy ? "Working..." : isSignUp ? "Create account" : "Sign in"}
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-slate-500">
            <div className="h-px flex-1 bg-white/10" />
            or
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <button
            type="button"
            onClick={() => finish(signInWithGoogle)}
            disabled={busy || !configured}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Chrome className="h-4 w-4" />
            Continue with Google
          </button>

          <p className="mt-5 text-center text-sm text-slate-400">
            {isSignUp ? "Already have an account?" : "Need an account?"}{" "}
            <Link
              href={isSignUp ? "/sign-in" : "/sign-up"}
              className="font-medium text-cyan-200 hover:text-cyan-100"
            >
              {isSignUp ? "Sign in" : "Create one"}
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}