"use client";

import type { User } from "firebase/auth";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { clearDemoSession, isDemoMode, readDemoSession, startDemoSession, type DemoSession } from "@/lib/demo";
import { getFirebaseServices, isFirebaseConfigured } from "@/lib/firebase";

interface AuthContextValue {
  configured: boolean;
  demoMode: boolean;
  initializing: boolean;
  /** Firebase user when configured. */
  user: User | null;
  /** Local demo clinician session when in demo mode. */
  demoUser: DemoSession | null;
  /** Signed-in identity for UI purposes: Firebase user or demo session. */
  identityEmail: string | null;
  signInAsDemo: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  configured: false,
  demoMode: true,
  initializing: true,
  user: null,
  demoUser: null,
  identityEmail: null,
  signInAsDemo: () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isFirebaseConfigured();
  const demoMode = isDemoMode();
  const [user, setUser] = useState<User | null>(null);
  const [demoUser, setDemoUser] = useState<DemoSession | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let mounted = true;

    async function subscribe() {
      if (demoMode) {
        if (mounted) {
          setDemoUser(readDemoSession());
          setInitializing(false);
        }
        return;
      }

      try {
        const [{ onAuthStateChanged }, { auth }] = await Promise.all([
          import("firebase/auth"),
          getFirebaseServices(),
        ]);

        if (!mounted) return;

        unsubscribe = onAuthStateChanged(auth, (nextUser) => {
          setUser(nextUser);
          setInitializing(false);
        });
      } catch (error) {
        console.error("Unable to initialize Firebase Auth.", error);
        if (mounted) setInitializing(false);
      }
    }

    subscribe();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [demoMode]);

  const signInAsDemo = useCallback(() => {
    setDemoUser(startDemoSession());
  }, []);

  const signOut = useCallback(async () => {
    if (demoMode) {
      clearDemoSession();
      setDemoUser(null);
      return;
    }
    const [{ signOut: firebaseSignOut }, { auth }] = await Promise.all([
      import("firebase/auth"),
      getFirebaseServices(),
    ]);
    await firebaseSignOut(auth);
  }, [demoMode]);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured,
      demoMode,
      initializing,
      user,
      demoUser,
      identityEmail: user?.email ?? demoUser?.email ?? null,
      signInAsDemo,
      signOut,
    }),
    [configured, demoMode, initializing, user, demoUser, signInAsDemo, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
