import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: "apps/worker/.env" });

function optional(key: string, fallback: string): string {
  return (process.env[key] || fallback).trim();
}

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.warn(`[worker-env] ⚠️ Missing recommended env var: ${key}`);
    return "";
  }
  return value.trim();
}

export const env = {
  nodeEnv: optional("NODE_ENV", "development"),
  port: parseInt(optional("PORT", "5050"), 10) || 5050,
  pollIntervalMs: parseInt(optional("POLL_INTERVAL_MS", "20000"), 10) || 20000,
  backendUrl: optional("BACKEND_URL", "http://localhost:4000").replace(/\/+$/, ""),
  workerSecret: optional("BACKEND_WORKER_SECRET", process.env.WORKER_SECRET || ""),
  plivoAuthId: required("PLIVO_AUTH_ID"),
  plivoAuthToken: required("PLIVO_AUTH_TOKEN"),
};
