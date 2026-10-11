import { getFirebaseServices, isFirebaseConfigured } from "./firebase";

export async function signUpWithEmail(email: string, password: string) {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured. Add .env.local values before signing up.");
  }

  const [{ createUserWithEmailAndPassword }, { auth }] = await Promise.all([
    import("firebase/auth"),
    getFirebaseServices()
  ]);

  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signInWithEmail(email: string, password: string) {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured. Add .env.local values before signing in.");
  }

  const [{ signInWithEmailAndPassword }, { auth }] = await Promise.all([
    import("firebase/auth"),
    getFirebaseServices()
  ]);

  return signInWithEmailAndPassword(auth, email, password);
}

export async function signInWithGoogle() {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured. Add .env.local values before signing in.");
  }

  const [{ GoogleAuthProvider, signInWithPopup }, { auth }] = await Promise.all([
    import("firebase/auth"),
    getFirebaseServices()
  ]);

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return signInWithPopup(auth, provider);
}

export async function signOutOfCoherence() {
  if (!isFirebaseConfigured()) {
    return;
  }

  const [{ signOut }, { auth }] = await Promise.all([
    import("firebase/auth"),
    getFirebaseServices()
  ]);

  await signOut(auth);
}
