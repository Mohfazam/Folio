import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getDashboardAuthContext, getWorkspaceSettingsData } from "@/lib/auth/dashboard-request";
import { SettingsDashboard } from "@/components/dashboard/settings-dashboard";

async function SettingsContent() {
  await connection();
  const auth = await getDashboardAuthContext();
  if (!auth) redirect("/sign-in");

  const settingsResult = await getWorkspaceSettingsData(auth.accessToken);
  const settings = settingsResult.ok ? settingsResult.data : null;
  const toOption = (value: unknown, key: "id" | "code"): string => {
    if (typeof value === "string") return value;
    if (typeof value === "object" && value !== null && key in value) {
      const candidate = (value as Record<string, unknown>)[key];
      return typeof candidate === "string" ? candidate : "";
    }
    return "";
  };

  return <SettingsDashboard
    account={{
      name: auth.displayName ?? "",
      email: auth.email ?? "",
    }}
    initialSettings={{
      profile: settings?.businessProfile ?? {},
      agent: settings?.agentSettings ?? {},
      voices: (settings?.availableVoices ?? []).map((item) => toOption(item, "id")).filter(Boolean),
      languages: (settings?.availableLanguages ?? []).map((item) => toOption(item, "code")).filter(Boolean),
      error: settingsResult.ok ? null : settingsResult.error,
    }}
  />;
}

export default function SettingsPage() {
  return <SettingsContent />;
}
