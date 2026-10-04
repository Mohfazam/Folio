import "dotenv/config";

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value.trim();
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  port: parseInt(process.env.PORT?.trim() ?? "4000", 10),
  /** Base URL of the /apps/calling service (e.g. "https://calling.fly.dev") */
  callingServiceUrl: process.env.CALLING_SERVICE_URL?.trim() ?? "http://localhost:3000",
};
