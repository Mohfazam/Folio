import { connection } from "next/server";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { SettingsDashboard } from "@/components/dashboard/settings-dashboard";

async function SettingsContent() {
  await connection();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <SettingsDashboard account={{ name: typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "", email: user?.email ?? "" }} />;
}

export default function SettingsPage() {
  return <Suspense fallback={<div className="p-8 text-sm text-[#747878]">Loading settings...</div>}><SettingsContent /></Suspense>;
}
