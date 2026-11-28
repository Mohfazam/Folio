import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: "apps/calling/.env" }); // Shares Plivo & Gemini creds with calling service

function required(key: string, fallback?: string): string {
  const value = process.env[key] || fallback;
  if (!value) {
    throw new Error(`[messenger/config] Missing required env var: ${key}`);
  }
  return value.trim();
}

function optional(key: string, fallback: string): string {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

export const env = {
  port: parseInt(optional("PORT", optional("MESSENGER_PORT", "3002")), 10),
  internalSecret: optional("MESSENGER_INTERNAL_SECRET", optional("BACKEND_WORKER_SECRET", "folio-messenger-internal-secret")),
  plivoAuthId: required("PLIVO_AUTH_ID"),
  plivoAuthToken: required("PLIVO_AUTH_TOKEN"),
  plivoPhoneNumber: required("PLIVO_PHONE_NUMBER"),
  geminiApiKey: required("GEMINI_API_KEY"),
  backendUrl: optional("BACKEND_URL", "http://localhost:3001"),
};
