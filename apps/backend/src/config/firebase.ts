import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

let firebaseApp: App | null = null;
let adminAuth: Auth | null = null;

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

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
 * Verifies a Firebase ID token from an incoming Authorization header (Bearer <token>).
 */
export async function verifyFirebaseToken(idToken: string) {
  if (!adminAuth) {
    throw new Error("Firebase Admin Auth is not initialized");
  }
  return adminAuth.verifyIdToken(idToken);
}
