import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOnboardingState } from "../../../lib/auth/backend";
import {
  DashboardShell,
  type DashboardProfile,
} from "@/components/dashboard/dashboard-shell";

type AuthMePayload = {
  ok?: boolean;
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

async function loadAuthMe(accessToken: string): Promise<AuthMePayload | null> {
  const baseUrl = process.env.BACKEND_API_URL?.trim().replace(/\/+$/, "");
  if (!baseUrl) return null;

  try {
    const response = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!response.ok) return null;
    return (await response.json()) as AuthMePayload;
  } catch (error) {
    console.error("[dashboard/layout] Unable to load workspace profile:", error);
    return null;
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

  // The backend remains authoritative for dashboard access.
  const onboarding = await getOnboardingState(session.access_token);
  if (!onboarding || onboarding.status !== "completed") redirect("/onboarding");

  const authMe = await loadAuthMe(session.access_token);
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const client = authMe?.client ?? null;
  const timezone = asText(client?.timezone) ?? "Asia/Kolkata";
  const displayName =
    asText(authMe?.user?.displayName) ??
    asText(metadata.full_name) ??
    asText(metadata.name) ??
    user.email?.split("@")[0] ??
    "there";
  const email = asText(authMe?.user?.email) ?? user.email ?? "";
  const trialEndsAt = client?.trialEndsAt ?? null;
  const rawPlan = asText(client?.planTier);

  const profile: DashboardProfile = {
    displayName,
    email,
    avatarUrl: asText(authMe?.user?.avatarUrl) ?? asText(metadata.avatar_url),
    workspaceName: asText(client?.name) ?? "Your workspace",
    workspaceId: asText(client?.id),
    timezone,
    greeting: getGreeting(timezone),
    planName: rawPlan ? rawPlan.charAt(0).toUpperCase() + rawPlan.slice(1) : null,
    trialDaysLeft: daysUntil(trialEndsAt),
    isTrial: client?.status === "trialing" || rawPlan === "trial",
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
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#FBF9F2]">
          <p className="font-['Space_Grotesk'] text-sm text-[#747878]">
            Loading your workspace...
          </p>
        </div>
      }
    >
      <DashboardContent>{children}</DashboardContent>
    </Suspense>
  );
}
