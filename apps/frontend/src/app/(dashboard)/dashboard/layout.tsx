import { sanitizeUserError } from "@/lib/utils/sanitize-error";
import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getDashboardAuthContext, getWorkspaceAuthMe, type AuthMePayload, type DashboardAuthContext } from "@/lib/auth/dashboard-request";
import { getOnboardingState } from "../../../lib/auth/backend";
import {
  DashboardShell,
  type DashboardProfile,
} from "@/components/dashboard/dashboard-shell";
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-page-skeleton";
import { QueryProvider } from "@/components/providers/query-provider";

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

async function loadAuthMe(accessToken: string): Promise<AuthMePayload | null> {
  const result = await getWorkspaceAuthMe(accessToken);
  if (!result.ok) {
    if (result.status === 404 || result.status === 403) {
      return null;
    }
    throw new BackendResponseError(
      sanitizeUserError(result.error, "Unable to load your workspace profile right now. Please try again."),
      result.status,
    );
  }
  return result.data;
}

async function loadAuthMeWithRefresh(
  supabase: DashboardAuthContext["supabase"],
  accessToken: string,
): Promise<AuthMePayload | null> {
  try {
    return await loadAuthMe(accessToken);
  } catch (error) {
    // Recover once from an expired access token. Do not retry other failures.
    if (!(error instanceof BackendResponseError) || error.status !== 401) {
      throw error;
    }

    if (!supabase) {
      throw new Error("Your sign-in session has expired. Please sign in again.");
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

  const auth = await getDashboardAuthContext();
  if (!auth) redirect("/sign-in");

  // The JWT is signature-verified once for this server render. Both backend
  // reads use the same token and run concurrently; /api/auth/me is request-cached
  // for child Server Components such as the Overview page.
  const [onboarding, authMe] = await Promise.all([
    getOnboardingState(auth.accessToken).catch(() => null),
    loadAuthMeWithRefresh(auth.supabase, auth.accessToken),
  ]);
  if (!onboarding || onboarding.status !== "completed" || !authMe) redirect("/onboarding");
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
    <QueryProvider>
      <DashboardShell profile={profile}>
        {children}
      </DashboardShell>
    </QueryProvider>
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
