import type { FirebaseApp } from "firebase/app";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function isFirebaseConfigured(): boolean {
  return Object.values(firebaseConfig).every(Boolean);
}

let cachedApp: FirebaseApp | null = null;

export async function getFirebaseApp(): Promise<FirebaseApp> {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase is not configured. Copy .env.local.example to .env.local and fill in the public Firebase web app values."
    );
  }

  if (cachedApp) return cachedApp;

  const { getApps, initializeApp } = await import("firebase/app");
  cachedApp = getApps()[0] ?? initializeApp(firebaseConfig);

  return cachedApp;
}

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