import type { Request } from "express";
import { matchesSecret } from "./auth.js";

export function isLocalPublicDemoDevelopmentRequest(req: Request): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    req.get("x-public-demo-local-development") === "true" &&
    matchesSecret(
      process.env.PUBLIC_DEMO_PROXY_SECRET?.trim(),
      req.get("x-public-demo-proxy-secret")?.trim(),
    )
  );
}
