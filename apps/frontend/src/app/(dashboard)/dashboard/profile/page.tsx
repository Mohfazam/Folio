import { connection } from "next/server";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileDashboard } from "@/components/dashboard/profile-dashboard";

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function ProfileContent() {
  await connection();
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/sign-in");

  const metadata = user.user_metadata ?? {};
  const appMetadata = user.app_metadata ?? {};
  const identities = Array.isArray(user.identities) ? user.identities : [];
  const provider = asText(appMetadata.provider) ?? asText(identities[0]?.provider) ?? "Email";

  return (
    <ProfileDashboard
      account={{
        id: user.id,
        name: asText(metadata.full_name) ?? asText(metadata.name) ?? asText(metadata.display_name) ?? "",
        email: user.email ?? "",
        phone: user.phone ?? asText(metadata.phone),
        avatarUrl: asText(metadata.avatar_url) ?? asText(metadata.picture),
        provider,
        createdAt: user.created_at ?? null,
        lastSignInAt: user.last_sign_in_at ?? null,
        emailConfirmedAt: user.email_confirmed_at ?? null,
        phoneConfirmedAt: user.phone_confirmed_at ?? null,
      }}
    />
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="p-8 font-['Space_Grotesk'] text-sm text-[#747878]">Loading your profile...</div>}>
      <ProfileContent />
    </Suspense>
  );
}
