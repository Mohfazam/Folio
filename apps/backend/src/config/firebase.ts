import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { env } from "./env.js";

let firebaseApp: App | null = null;
let adminAuth: Auth | null = null;

const { projectId, clientEmail } = env.firebase;
let privateKey = env.firebase.privateKey;

if (!getApps().length) {
  if (projectId && clientEmail && privateKey) {
    // Replace escaped newlines if passed in string form
    privateKey = privateKey.replace(/\\n/g, "\n");

    try {
      firebaseApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      adminAuth = getAuth(firebaseApp);
      console.log("[firebase] 🔒 Firebase Admin SDK initialized successfully");
    } catch (err) {
      console.error("[firebase] ❌ Failed to initialize Firebase Admin SDK:", err);
    }
  } else {
    console.warn("[firebase] ⚠️ Firebase Admin credentials not set in environment");
  }
} else {
  firebaseApp = getApps()[0]!;
  adminAuth = getAuth(firebaseApp);
}

export { firebaseApp, adminAuth };

/**
 * Returns whether Firebase Admin SDK is ready to verify authentication tokens.
 */
export function isFirebaseConfigured(): boolean {
  return adminAuth !== null;
}

/**
 * Verifies a Firebase ID token from an incoming Authorization header (Bearer <token>).
 */
export async function verifyFirebaseToken(idToken: string) {
  if (!adminAuth) {
    throw new Error("Firebase Admin Auth is not initialized");
  }
  return adminAuth.verifyIdToken(idToken);
}
