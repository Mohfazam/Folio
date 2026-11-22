import { NextRequest, NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/lib/auth/dashboard-request";
import { sanitizeUserError } from "@/lib/utils/sanitize-error";

const ALLOWED_GET_PREFIXES = [
  "workspace-setup",
  "analytics/overview",
  "campaigns",
  "contacts",
  "calls",
  "follow-ups",
  "knowledge-base",
  "business-profile",
  "agent-settings",
  "team-members",
  "clients",
  "auth/me",
];

function isAllowedPath(segments: string[]): boolean {
  if (!segments.length) return false;
  if (segments.some((s) => !s || s === "." || s === ".." || s.includes("\\"))) {
    return false;
  }
  const joined = segments.join("/");
  return ALLOWED_GET_PREFIXES.some(
    (prefix) => joined === prefix || joined.startsWith(`${prefix}/`),
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  if (!isAllowedPath(path)) {
    return NextResponse.json(
      { ok: false, error: "Requested endpoint is not allowed." },
      { status: 403 },
    );
  }

  const auth = await getDashboardAuthContext();
  if (!auth) {
    return NextResponse.json(
      { ok: false, error: "Your session has expired. Sign in again." },
      { status: 401 },
    );
  }

  const baseUrl = (
    process.env.BACKEND_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://localhost:4000"
  ).replace(/\/+$/, "");

  const targetPath = `/api/${path.join("/")}`;
  const query = request.nextUrl.search;
  const url = `${baseUrl}${targetPath}${query}`;

  let lastStatus = 500;
  let lastError = "Unable to load workspace data right now. Please try again.";

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
        cache: "no-store",
      });

      const payload: unknown = await response.json().catch(() => null);
      const record =
        typeof payload === "object" && payload !== null && !Array.isArray(payload)
          ? (payload as Record<string, unknown>)
          : null;

      if (response.ok && record && record.ok !== false) {
        return NextResponse.json(record, {
          status: response.status,
          headers: { "Cache-Control": "no-store" },
        });
      }

      lastStatus = response.status;
      lastError = sanitizeUserError(
        record?.error,
        `Unable to load workspace data (${response.status}).`,
      );

      if (response.status >= 500 && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        continue;
      }

      return NextResponse.json(
        { ok: false, error: lastError },
        { status: response.status },
      );
    } catch (error) {
      console.error(`[api/dashboard/proxy] GET ${targetPath} failed:`, error);
      lastStatus = 502;
      lastError = sanitizeUserError(
        error instanceof Error ? error.message : null,
        "Unable to reach the workspace service right now. Please try again.",
      );
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        continue;
      }
    }
  }

  return NextResponse.json({ ok: false, error: lastError }, { status: lastStatus });
}
