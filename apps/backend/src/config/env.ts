import "dotenv/config";

function required(key: string): string {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    throw new Error(`[FATAL] Missing required environment variable: ${key}`);
  }
  return value.trim();
}

function optional(key: string, fallback: string): string {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

const nodeEnv = optional("NODE_ENV", "development");
const isProduction = nodeEnv === "production";
const isTest = nodeEnv === "test";

// Parse allowed origins: can be "*" or a comma-separated list of origins
const rawAllowedOrigins = optional("ALLOWED_ORIGINS", "*");
const parsedAllowedOrigins = rawAllowedOrigins === "*"
  ? ["*"]
  : rawAllowedOrigins.split(",").map((origin) => origin.trim()).filter(Boolean);

export const env = {
  nodeEnv,
  isProduction,
  isTest,
  port: parseInt(optional("PORT", "4000"), 10),
  databaseUrl: required("DATABASE_URL"),
  /** Base URL of the voice engine service (e.g. "https://calling.fly.dev" or Railway URL) */
  callingServiceUrl: optional("CALLING_SERVICE_URL", "http://localhost:3000"),
  /** Publicly reachable URL of this backend (useful for callbacks) */
  backendPublicUrl: optional("BACKEND_PUBLIC_URL", ""),
  /** CORS whitelist configuration */
  allowedOrigins: parsedAllowedOrigins,
  rawAllowedOrigins,
  /** Secrets for machine-to-machine route authorization */
  webhookSecret: process.env.WEBHOOK_SECRET?.trim() || process.env.CALLING_WEBHOOK_SECRET?.trim(),
  workerSecret: process.env.BACKEND_WORKER_SECRET?.trim(),
  /** Firebase Admin Credentials */
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID?.trim(),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL?.trim(),
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.trim(),
  },
};

/**
 * Checks if a given origin is allowed based on the CORS configuration.
 * Always allows requests without an Origin header (such as curl, mobile clients, server-to-server).
 * If ALLOWED_ORIGINS is "*" (default for current pre-frontend state), all origins are permitted.
 * When fixed to a deployed frontend URL, only matched origins are allowed.
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  if (env.allowedOrigins.includes("*")) return true;
  if (env.allowedOrigins.includes(origin)) return true;

  // In non-production environments, allow localhost / 127.0.0.1 for local developer tools
  if (!env.isProduction) {
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
      return true;
    }
  }

  return false;
}

/**
 * Validates critical environment variables on startup.
 * Logs actionable diagnostics or throws in production if critical security tokens are missing.
 */
export function validateEnv(): void {
  if (isNaN(env.port) || env.port <= 0 || env.port > 65535) {
    throw new Error(`[FATAL] Invalid PORT specified: ${process.env.PORT}`);
  }

  if (env.isProduction) {
    if (env.allowedOrigins.includes("*")) {
      console.warn(
        "[security/config] ⚠️ WARNING: ALLOWED_ORIGINS is currently set to wildcard '*'. Once the frontend is deployed, set ALLOWED_ORIGINS to your frontend URL(s) to enforce origin isolation."
      );
    }

    if (!env.webhookSecret) {
      console.warn(
        "[security/config] ⚠️ WARNING: WEBHOOK_SECRET is not configured. Webhook endpoints will reject incoming call completions."
      );
    }

    if (!env.firebase.projectId || !env.firebase.clientEmail || !env.firebase.privateKey) {
      console.warn(
        "[security/config] ⚠️ WARNING: Firebase Admin credentials are incomplete. End-user authentication will fail."
      );
    }
  }
}
