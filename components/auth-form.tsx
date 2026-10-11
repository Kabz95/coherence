"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Chrome, Mail, ShieldCheck } from "lucide-react";
import { signInWithEmail, signInWithGoogle, signUpWithEmail } from "@/lib/auth";
import { isFirebaseConfigured } from "@/lib/firebase";
import { GENERAL_DISCLAIMER } from "@/lib/clinical-copy";
import { ProgressBar } from "./progress-bar";

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
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    finish(() => (isSignUp ? signUpWithEmail(email, password) : signInWithEmail(email, password)));
  }

  return (
    <main className="min-h-screen bg-midnight px-4 py-8 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(103,232,249,0.14),transparent_28%),radial-gradient(circle_at_80%_5%,rgba(245,199,107,0.1),transparent_24%)]" />
      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section>
          <Link href="/" className="text-lg font-semibold tracking-[0.2em]">COHERENCE</Link>
          <h1 className="mt-8 text-4xl font-semibold leading-tight md:text-5xl">
            {isSignUp ? "Create a clinician workspace account" : "Sign in to Coherence"}
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300">
            Authentication protects access to case organization, upload registration, run timelines, and structured non-diagnostic reporting.
          </p>
          <div className="mt-6 rounded-lg border border-gold/35 bg-gold/10 p-4 text-sm leading-6 text-amber-50">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 flex-none text-gold" />
              <p>{GENERAL_DISCLAIMER}</p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-panel/80 p-6 shadow-glow">
          {!configured ? (
            <div className="mb-5 rounded-md border border-gold/35 bg-gold/10 p-3 text-sm text-gold">
              Firebase config is missing. Add `.env.local` values and restart the dev server before signing in.
            </div>
          ) : null}

          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="text-sm font-medium text-white">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-md border border-white/10 bg-midnight px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                autoComplete="email"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="text-sm font-medium text-white">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-md border border-white/10 bg-midnight px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                minLength={6}
                required
              />
            </div>

            {error ? <div className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3 text-sm text-rose-100">{error}</div> : null}

            <button
              type="submit"
              disabled={!configured || busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Mail className="h-4 w-4" />
              {busy ? "Working..." : isSignUp ? "Create account" : "Sign in with email"}
            </button>
            {busy ? <ProgressBar label={isSignUp ? "Creating account" : "Signing in"} detail="Contacting Firebase Auth" /> : null}
          </form>

          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-slate-500">
            <div className="h-px flex-1 bg-white/10" />
            or
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <button
            type="button"
            disabled={!configured || busy}
            onClick={() => finish(signInWithGoogle)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Chrome className="h-4 w-4" />
            Continue with Google
          </button>

          <p className="mt-5 text-center text-sm text-slate-300">
            {isSignUp ? "Already have an account?" : "Need an account?"}{" "}
            <Link href={isSignUp ? "/sign-in" : "/sign-up"} className="text-cyan-200">
              {isSignUp ? "Sign in" : "Create one"}
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
