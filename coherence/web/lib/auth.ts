import { getFirebaseServices, isFirebaseConfigured } from "./firebase";

function requireFirebaseConfigured(action: string) {
  if (!isFirebaseConfigured()) {
    throw new Error(`Firebase is not configured. Add .env.local values before ${action}.`);
  }
}

export async function signUpWithEmail(email: string, password: string) {
  requireFirebaseConfigured("signing up");

  const [{ createUserWithEmailAndPassword }, { auth }] = await Promise.all([
    import("firebase/auth"),
    getFirebaseServices(),
  ]);

  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signInWithEmail(email: string, password: string) {
  requireFirebaseConfigured("signing in");

  const [{ signInWithEmailAndPassword }, { auth }] = await Promise.all([
    import("firebase/auth"),
    getFirebaseServices(),
  ]);

  return signInWithEmailAndPassword(auth, email, password);
}

export async function signInWithGoogle() {
  requireFirebaseConfigured("signing in");

  const [{ GoogleAuthProvider, signInWithPopup }, { auth }] = await Promise.all([
    import("firebase/auth"),
    getFirebaseServices(),
  ]);

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  return signInWithPopup(auth, provider);
}

export async function signOutOfCoherence() {
  if (!isFirebaseConfigured()) return;

  const [{ signOut }, { auth }] = await Promise.all([
    import("firebase/auth"),
    getFirebaseServices(),
  ]);

  await signOut(auth);
}