"use client";

import type { User } from "firebase/auth";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { getFirebaseServices, isFirebaseConfigured } from "@/lib/firebase";

interface AuthContextValue {
  configured: boolean;
  initializing: boolean;
  user: User | null;
}

const AuthContext = createContext<AuthContextValue>({
  configured: false,
  initializing: true,
  user: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isFirebaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(configured);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let mounted = true;

    async function subscribe() {
      if (!configured) {
        setInitializing(false);
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
  }, [configured]);

  const value = useMemo(
    () => ({ configured, initializing, user }),
    [configured, initializing, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
