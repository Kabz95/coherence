import { isFirebaseConfigured } from "./firebase";

/**
 * Demo mode lets the symposium build run end-to-end with zero backend setup.
 * When no Firebase web config is present, repositories serve the seeded
 * demo cases and auth offers a local demo clinician session.
 */
export function isDemoMode(): boolean {
  return !isFirebaseConfigured();
}

const DEMO_SESSION_KEY = "coherence.demoSession.v1";

export interface DemoSession {
  email: string;
  displayName: string;
  signedInAt: string;
}

export const DEMO_CLINICIAN: DemoSession = {
  email: "demo.clinician@coherence.local",
  displayName: "Demo Clinician",
  signedInAt: new Date().toISOString(),
};

export function readDemoSession(): DemoSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(DEMO_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoSession;
    return parsed?.email ? parsed : null;
  } catch {
    return null;
  }
}

export function writeDemoSession(session: DemoSession): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
}

export function clearDemoSession(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(DEMO_SESSION_KEY);
}

export function startDemoSession(): DemoSession {
  const session: DemoSession = {
    ...DEMO_CLINICIAN,
    signedInAt: new Date().toISOString(),
  };
  writeDemoSession(session);
  return session;
}
