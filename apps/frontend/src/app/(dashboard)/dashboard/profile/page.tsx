import { connection } from "next/server";
import { redirect } from "next/navigation";
import {
  getDashboardAuthContext,
  getWorkspaceAuthMe,
  type AuthMeResult,
} from "@/lib/auth/dashboard-request";
import { ProfileDashboard } from "@/components/dashboard/profile-dashboard";

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asDateString(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function providerLabel(value: string | null): string {
  if (!value) return "Email";
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function loadProfileResult(
  accessToken: string,
): Promise<AuthMeResult> {
  return getWorkspaceAuthMe(accessToken);
}

async function ProfileContent() {
  await connection();

  // Reuse the same request-scoped verified identity and workspace profile
  // request used by the dashboard layout. This avoids separate getUser()
  // and getSession() calls when navigating to the Profile page.
  const auth = await getDashboardAuthContext();
  if (!auth) redirect("/sign-in");

  let result = await loadProfileResult(auth.accessToken);

  // The layout normally resolves this case already. Keep a one-time refresh
  // fallback for the edge case where this component receives an expired token.
  if (!result.ok && result.status === 401 && auth.supabase) {
    const { data, error } = await auth.supabase.auth.refreshSession();
    const refreshedToken = data.session?.access_token;
    if (!error && refreshedToken) {
      result = await loadProfileResult(refreshedToken);
    }
  }

  if (!result.ok) {
    throw new Error(`Unable to load account profile (${result.status}): ${result.error}`);
  }

  const user = result.data.user;
  if (!user) redirect("/sign-in");

  return (
    <ProfileDashboard
      account={{
        id: asText(user.id) ?? auth.userId,
        name: asText(user.displayName) ?? auth.displayName ?? "",
        email: asText(user.email) ?? auth.email ?? "",
        phone: asText(user.phoneNumber),
        avatarUrl: asText(user.avatarUrl),
        provider: providerLabel(asText(user.authProvider)),
        createdAt: asDateString(user.createdAt),
        lastSignInAt: asDateString(user.lastLoginAt),
        emailVerified: user.emailVerified === true,
        phoneVerified: user.phoneVerified === true,
      }}
    />
  );
}

export default function ProfilePage() {
  return <ProfileContent />;
}
