"use client";

import Link from "next/link";
import { Activity, LogOut, Plus, UploadCloud, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { isDemoMode } from "@/lib/demo";
import { useAuth } from "./auth-provider";

export function Topbar() {
  const router = useRouter();
  const demoMode = isDemoMode();
  const { identityEmail, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    router.push("/sign-in");
  }

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-midnight/90 px-4 py-3 backdrop-blur md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-copper-100/55">Coherence workspace</p>
          <h1 className="text-lg font-semibold text-white">Neuroimaging decision-support shell</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${demoMode ? "border-gold/35 bg-gold/10 text-gold" : "border-emerald-400/35 bg-emerald-400/10 text-emerald-100"}`}>
            <Activity className="h-3.5 w-3.5" aria-hidden />
            {demoMode ? "Demo mode" : "Firebase ready"}
          </span>
          {identityEmail ? (
            <span className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 md:inline-flex">
              <UserRound className="h-3.5 w-3.5" aria-hidden />
              {identityEmail}
            </span>
          ) : null}
          <Link href="/cases" className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10">
            <Plus className="h-4 w-4" aria-hidden />
            New case
          </Link>
          <Link href="/upload" className="inline-flex items-center gap-2 rounded-md bg-copper-300 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-copper-200">
            <UploadCloud className="h-4 w-4" aria-hidden />
            Upload
          </Link>
          {identityEmail ? (
            <button type="button" onClick={handleSignOut} className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10">
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </button>
          ) : (
            <Link href="/sign-in" className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
