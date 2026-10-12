import type { FirebaseApp } from "firebase/app";
import { isFirebaseConfigured, loadFirebasePublicConfig } from "./config";

let cachedApp: FirebaseApp | null = null;

/** Lazily initializes the Firebase app; throws with setup guidance when unconfigured. */
export async function getFirebaseApp(): Promise<FirebaseApp> {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase is not configured. Copy .env.local.example to .env.local and fill in the public Firebase web app values."
    );
  }

  if (cachedApp) return cachedApp;

  const { getApps, initializeApp } = await import("firebase/app");
  cachedApp = getApps()[0] ?? initializeApp(loadFirebasePublicConfig());

  return cachedApp;
}

/** Lazily loads Auth, Firestore (lite), Storage, and Functions for the app. */
export async function getFirebaseServices() {
  const app = await getFirebaseApp();

  const [{ getAuth }, { getFirestore }, { getStorage }, { getFunctions }] =
    await Promise.all([
      import("firebase/auth"),
      import("firebase/firestore/lite"),
      import("firebase/storage"),
      import("firebase/functions"),
    ]);

  return {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    storage: getStorage(app),
    functions: getFunctions(app, "us-central1"),
  };
}
