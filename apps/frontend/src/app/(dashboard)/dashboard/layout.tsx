import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOnboardingState } from "../../../lib/auth/backend";
import {
  DashboardShell,
  type DashboardProfile,
} from "@/components/dashboard/dashboard-shell";
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-page-skeleton";

type AuthMePayload = {
  ok: true;
  user?: {
    displayName?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
  };
  client?: {
    id?: string;
    name?: string | null;
    timezone?: string | null;
    planTier?: string | null;
    status?: string | null;
    trialEndsAt?: string | Date | null;
  } | null;
};

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getGreeting(timezone: string): DashboardProfile["greeting"] {
  let hour = new Date().getHours();

  try {
    hour = Number(
      new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        hourCycle: "h23",
        timeZone: timezone,
      }).format(new Date()),
    );
  } catch {
    // Keep the server's local hour if the workspace timezone is invalid.
  }

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function daysUntil(dateValue: string | Date | null | undefined): number | null {
  if (!dateValue) return null;
  const timestamp = new Date(dateValue).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.ceil((timestamp - Date.now()) / 86_400_000));
}

class BackendResponseError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "BackendResponseError";
  }
}

async function loadAuthMe(accessToken: string): Promise<AuthMePayload> {
  const baseUrl = (process.env.BACKEND_API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:4000").replace(/\/+$/, "");

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
      throw new BackendResponseError(
        `Unable to load the Neon workspace profile (${response.status})${backendMessage ? `: ${backendMessage}` : "."}`,
        response.status,
      );
    }

    if (
      typeof payload !== "object" ||
      payload === null ||
      !("ok" in payload) ||
      payload.ok !== true ||
      !("user" in payload) ||
      typeof payload.user !== "object" ||
      payload.user === null
    ) {
      throw new Error("The backend returned an invalid workspace profile response.");
    }

    return payload as AuthMePayload;
  } catch (error) {
    console.error("[dashboard/layout] Unable to load workspace profile:", error);
    throw error;
  }
}

async function loadAuthMeWithRefresh(
  supabase: Awaited<ReturnType<typeof createClient>>,
  accessToken: string,
): Promise<AuthMePayload> {
  try {
    return await loadAuthMe(accessToken);
  } catch (error) {
    // Recover once from an expired access token. Do not retry other failures.
    if (!(error instanceof BackendResponseError) || error.status !== 401) {
      throw error;
    }

    const { data, error: refreshError } = await supabase.auth.refreshSession();
    const refreshedToken = data.session?.access_token;

    if (refreshError || !refreshedToken) {
      throw new Error("Your sign-in session has expired. Please sign in again.");
    }

    try {
      return await loadAuthMe(refreshedToken);
    } catch (retryError) {
      if (retryError instanceof BackendResponseError && retryError.status === 401) {
        throw new Error(
          "The backend rejected the refreshed sign-in token. Check that the frontend and backend use the same Supabase project URL and publishable/anon key, and restart the backend after changing its environment variables.",
        );
      }
      throw retryError;
    }
  }
}

async function DashboardContent({ children }: { children: ReactNode }) {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) redirect("/sign-in");

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) redirect("/sign-in");

  // These independent backend reads share the same verified session and run concurrently.
  const [onboarding, authMe] = await Promise.all([
    getOnboardingState(session.access_token),
    loadAuthMeWithRefresh(supabase, session.access_token),
  ]);
  if (!onboarding || onboarding.status !== "completed") redirect("/onboarding");
  const client = authMe.client ?? null;
  const timezone = asText(client?.timezone) ?? "Asia/Kolkata";
  const displayName =
    asText(authMe.user?.displayName) ??
    asText(authMe.user?.email)?.split("@")[0] ??
    "there";
  const email = asText(authMe.user?.email) ?? "";
  const trialEndsAt = client?.trialEndsAt ?? null;
  const rawPlan = asText(client?.planTier);
  const isTrial = client?.status === "trialing" || rawPlan === "trial";
  const trialEndTimestamp = trialEndsAt
    ? new Date(trialEndsAt).getTime()
    : Number.NaN;
  const trialExpired =
    isTrial && Number.isFinite(trialEndTimestamp) && trialEndTimestamp <= Date.now();

  const profile: DashboardProfile = {
    displayName,
    email,
    avatarUrl: asText(authMe.user?.avatarUrl),
    workspaceName: asText(client?.name) ?? "Your workspace",
    workspaceId: asText(client?.id),
    timezone,
    greeting: getGreeting(timezone),
    planName: rawPlan ? rawPlan.charAt(0).toUpperCase() + rawPlan.slice(1) : null,
    trialDaysLeft: daysUntil(trialEndsAt),
    trialEndsAt: Number.isFinite(trialEndTimestamp) ? new Date(trialEndTimestamp).toISOString() : null,
    trialExpired,
    isTrial,
  };

  return (
    <DashboardShell profile={profile}>
      {children}
    </DashboardShell>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense fallback={<DashboardPageSkeleton variant="overview" showSidebar />}>
      <DashboardContent>{children}</DashboardContent>
    </Suspense>
  );
}
