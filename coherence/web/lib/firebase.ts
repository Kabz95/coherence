/**
 * Backwards-compatible barrel for the Firebase helpers.
 * Canonical implementations live in ./firebase/config.ts and ./firebase/client.ts.
 */
export { isFirebaseConfigured, loadFirebasePublicConfig, FIREBASE_ENV_KEYS } from "./firebase/config";
export type { FirebasePublicConfig } from "./firebase/config";
export { getFirebaseApp, getFirebaseServices } from "./firebase/client";
