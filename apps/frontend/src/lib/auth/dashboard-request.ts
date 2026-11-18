import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type DashboardAuthContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  accessToken: string;
  userId: string;
  email: string | null;
  displayName: string | null;
};

/**
 * Request-scoped, verified dashboard identity.
 * getClaims verifies the JWT signature and can use the cached project JWKS;
 * getSession is used only to obtain the bearer token forwarded to our API.
 * React cache deduplicates this work across the dashboard layout and its page.
 */
export const getDashboardAuthContext = cache(async (): Promise<DashboardAuthContext | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims as Record<string, unknown> | undefined;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;

  if (error || !claims || !userId) return null;

  // getClaims refreshes an expiring SSR session. Read the session afterwards
  // only to obtain the current access token, never to establish identity.
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return null;

  const userMetadata = typeof claims.user_metadata === "object" && claims.user_metadata !== null && !Array.isArray(claims.user_metadata)
    ? claims.user_metadata as Record<string, unknown>
    : {};
  const displayName = [userMetadata.full_name, userMetadata.name, userMetadata.display_name]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0) ?? null;

  return {
    supabase,
    accessToken,
    userId,
    email: typeof claims.email === "string" ? claims.email : null,
    displayName,
  };
});

export type AuthMePayload = {
  ok: true;
  user?: {
    id?: string;
    displayName?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
    phoneNumber?: string | null;
    phoneVerified?: boolean;
    authProvider?: string | null;
    createdAt?: string | Date | null;
    lastLoginAt?: string | Date | null;
    emailVerified?: boolean;
  };
  client?: {
    id?: string;
    name?: string | null;
    timezone?: string | null;
    planTier?: string | null;
    status?: string | null;
    trialEndsAt?: string | Date | null;
  } | null;
  hasVerifiedPhone?: boolean;
};

export type AuthMeResult =
  | { ok: true; data: AuthMePayload }
  | { ok: false; status: number; error: string };

/** Shared request cache so the layout and Overview do not call /api/auth/me twice. */
export const getWorkspaceAuthMe = cache(async (accessToken: string): Promise<AuthMeResult> => {
  const baseUrl = (
    process.env.BACKEND_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://localhost:4000"
  ).replace(/\/+$/, "");

  try {
    const response = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const payload: unknown = await response.json().catch(() => null);
    const backendMessage =
      typeof payload === "object" && payload !== null && "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : null;

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: backendMessage ?? `Unable to load the Neon workspace profile (${response.status}).`,
      };
    }

    if (
      typeof payload !== "object" || payload === null ||
      !("ok" in payload) || payload.ok !== true ||
      !("user" in payload) || typeof payload.user !== "object" || payload.user === null
    ) {
      return { ok: false, status: response.status, error: "The backend returned an invalid workspace profile response." };
    }

    return { ok: true, data: payload as AuthMePayload };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Unable to reach the workspace backend.",
    };
  }
});

export type WorkspaceSettingsData = {
  businessProfile: Record<string, unknown> | null;
  agentSettings: Record<string, unknown> | null;
  availableVoices: unknown[];
  availableLanguages: unknown[];
};

export type WorkspaceSettingsResult =
  | { ok: true; data: WorkspaceSettingsData }
  | { ok: false; status: number; error: string };

/** Fetch Settings data before the page renders instead of starting a second client-side loading phase. */
export const getWorkspaceSettingsData = cache(async (accessToken: string): Promise<WorkspaceSettingsResult> => {
  const baseUrl = (
    process.env.BACKEND_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://localhost:4000"
  ).replace(/\/+$/, "");
  const headers = { Authorization: `Bearer ${accessToken}` };

  try {
    const [profileResponse, agentResponse] = await Promise.all([
      fetch(`${baseUrl}/api/business-profile`, { headers, cache: "no-store" }),
      fetch(`${baseUrl}/api/agent-settings`, { headers, cache: "no-store" }),
    ]);
    const [profilePayload, agentPayload] = await Promise.all([
      profileResponse.json().catch(() => null) as Promise<unknown>,
      agentResponse.json().catch(() => null) as Promise<unknown>,
    ]);

    const asRecord = (value: unknown): Record<string, unknown> | null =>
      typeof value === "object" && value !== null && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
    const profileRecord = asRecord(profilePayload);
    const agentRecord = asRecord(agentPayload);

    if (!profileResponse.ok && profileResponse.status !== 404) {
      return {
        ok: false,
        status: profileResponse.status,
        error: typeof profileRecord?.error === "string" ? profileRecord.error : `Business profile request failed (${profileResponse.status}).`,
      };
    }
    if (!agentResponse.ok || agentRecord?.ok !== true) {
      return {
        ok: false,
        status: agentResponse.status,
        error: typeof agentRecord?.error === "string" ? agentRecord.error : `Agent settings request failed (${agentResponse.status}).`,
      };
    }

    return {
      ok: true,
      data: {
        businessProfile: profileResponse.status === 404 || !profileRecord || profileRecord.ok !== true
          ? null
          : asRecord(profileRecord.businessProfile),
        agentSettings: asRecord(agentRecord.agentSettings),
        availableVoices: Array.isArray(agentRecord.availableVoices) ? agentRecord.availableVoices : [],
        availableLanguages: Array.isArray(agentRecord.availableLanguages) ? agentRecord.availableLanguages : [],
      },
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Unable to load workspace settings.",
    };
  }
});
