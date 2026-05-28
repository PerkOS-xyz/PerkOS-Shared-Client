/**
 * Lazy, singleton Firebase client SDK init.
 *
 * Unlike the original `PerkOS/app/lib/firebase.ts`, this version does NOT
 * read `process.env.NEXT_PUBLIC_*` directly — the consumer passes config
 * explicitly so the package works inside Next.js, Vite, CLI tools, Tauri, etc.
 *
 * Usage:
 *   import { initFirebase } from "@perkos/shared-client";
 *   const { app, auth, db } = initFirebase({
 *     apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
 *     projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
 *     appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
 *     // …
 *   });
 *
 * The first call initialises the underlying `FirebaseApp`. Subsequent calls
 * reuse it (Firebase itself dedupes by name, but we cache the wrappers too
 * so Auth/Firestore handles stay stable across hot reloads).
 */

import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp,
  type FirebaseOptions,
} from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

export type FirebaseConfig = {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
};

export type FirebaseHandles = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
};

let cached: FirebaseHandles | null = null;

function assertConfig(config: FirebaseConfig): void {
  if (!config.apiKey || !config.projectId) {
    throw new Error(
      "Missing Firebase web config. apiKey and projectId are required."
    );
  }
}

/**
 * Initialise (or fetch the cached) Firebase client SDK handles.
 *
 * The function is idempotent — passing the same config multiple times will
 * return the same handles. Passing a different config after the first call
 * is silently ignored; if you need to switch projects, restart the runtime.
 */
export function initFirebase(config: FirebaseConfig): FirebaseHandles {
  if (cached) return cached;

  assertConfig(config);

  const options: FirebaseOptions = {
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
    measurementId: config.measurementId,
  };

  const app = getApps().length > 0 ? getApp() : initializeApp(options);
  const auth = getAuth(app);
  const db = getFirestore(app);

  cached = { app, auth, db };
  return cached;
}

/**
 * Returns the cached handles set up by `initFirebase`.
 * Throws if `initFirebase` hasn't been called yet — call it once at app
 * startup before reaching for `getFirebase()` anywhere else.
 */
export function getFirebase(): FirebaseHandles {
  if (!cached) {
    throw new Error(
      "Firebase not initialised. Call initFirebase(config) at app startup."
    );
  }
  return cached;
}

/**
 * Test-only escape hatch — clears the cached handles so a subsequent
 * `initFirebase` call rebuilds them with a fresh config.
 */
export function _resetFirebaseForTests(): void {
  cached = null;
}
