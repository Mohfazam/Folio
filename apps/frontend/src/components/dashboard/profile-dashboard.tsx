"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import Link from "next/link";
import { useDashboardProfile } from "@/components/dashboard/dashboard-shell";

type AccountDetails = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  provider: string;
  createdAt: string | null;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  phoneConfirmedAt: string | null;
};

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : value.slice(0, 2)).toUpperCase() || "U";
}

function dateLabel(value: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 border-b border-[#ECEBE4] py-4 last:border-b-0">
      <p className="font-['Space_Grotesk'] text-[10px] font-semibold uppercase tracking-[0.09em] text-[#858782]">{label}</p>
      <p className={`mt-1.5 break-words text-[13px] text-[#24251F] ${mono ? "font-mono text-[11px]" : "font-['Space_Grotesk']"}`}>{value || "Not provided"}</p>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-[9px] border border-[#E9E8E1] bg-white p-5 sm:p-6">
      <div className="mb-2">
        <h2 className="font-['Newsreader'] text-[22px] text-[#1B1C18]">{title}</h2>
        <p className="mt-1 font-['Space_Grotesk'] text-[11px] leading-5 text-[#777A74]">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function ProfileDashboard({ account }: { account: AccountDetails }) {
  const workspace = useDashboardProfile();
  const displayName = account.name || workspace.displayName;
  const emailVerified = Boolean(account.emailConfirmedAt);
  const phoneVerified = Boolean(account.phoneConfirmedAt);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-['Space_Grotesk'] text-[10px] font-semibold uppercase tracking-[0.12em] text-[#858782]">Account</p>
          <h1 className="mt-1 font-['Newsreader'] text-[32px] leading-tight text-[#1B1C18]">Your profile</h1>
          <p className="mt-2 max-w-xl font-['Space_Grotesk'] text-[12px] leading-5 text-[#777A74]">Your personal account details and the workspace you currently belong to.</p>
        </div>
        <Link href="/dashboard/settings" className="rounded-[5px] border border-[#DCDCD4] px-3.5 py-2.5 font-['Space_Grotesk'] text-[11px] font-semibold text-[#34352F] transition-colors hover:bg-[#F5F4ED]">Account settings</Link>
      </div>

      <section className="flex flex-wrap items-center gap-4 rounded-[10px] border border-[#E9E8E1] bg-[#FBFAF6] p-5 sm:p-6">
        {account.avatarUrl ? (
          <Image src={account.avatarUrl} alt="Profile picture" width={68} height={68} unoptimized className="h-[68px] w-[68px] rounded-full border border-[#E3E2DA] object-cover" />
        ) : (
          <div className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-[#1B1C18] font-['Space_Grotesk'] text-[19px] font-semibold text-white">{initials(displayName)}</div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-['Newsreader'] text-[25px] text-[#1B1C18]">{displayName}</h2>
          <p className="mt-1 truncate font-['Space_Grotesk'] text-[12px] text-[#777A74]">{account.email}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className={`rounded-full px-2.5 py-1 font-['Space_Grotesk'] text-[10px] font-semibold ${emailVerified ? "bg-[#E7F2E8] text-[#31613B]" : "bg-[#F5EBDD] text-[#8B5B24]"}`}>{emailVerified ? "Email verified" : "Email not verified"}</span>
            <span className="rounded-full bg-[#ECEBE4] px-2.5 py-1 font-['Space_Grotesk'] text-[10px] font-semibold text-[#55574F]">{account.provider} sign-in</span>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Personal information" description="Details associated with your sign-in account.">
          <Detail label="Full name" value={displayName} />
          <Detail label="Email address" value={account.email} />
          <Detail label="Phone number" value={account.phone ?? "Not provided"} />
          <Detail label="Phone verification" value={account.phone ? (phoneVerified ? "Verified" : "Not verified") : "No phone number added"} />
        </Section>

        <Section title="Account information" description="Authentication and account activity details.">
          <Detail label="Account ID" value={account.id} mono />
          <Detail label="Sign-in method" value={account.provider} />
          <Detail label="Account created" value={dateLabel(account.createdAt)} />
          <Detail label="Last sign-in" value={dateLabel(account.lastSignInAt)} />
        </Section>

        <Section title="Workspace membership" description="Your current Folioo workspace context.">
          <Detail label="Workspace name" value={workspace.workspaceName} />
          <Detail label="Workspace ID" value={workspace.workspaceId ?? "Not available"} mono />
          <Detail label="Workspace timezone" value={workspace.timezone} />
          <Detail label="Current plan" value={workspace.planName ?? (workspace.isTrial ? "Trial" : "Workspace plan")} />
        </Section>

        <Section title="Verification & security" description="Current verification information provided by your authentication account.">
          <Detail label="Email status" value={emailVerified ? `Verified on ${dateLabel(account.emailConfirmedAt)}` : "Email confirmation pending"} />
          <Detail label="Phone status" value={!account.phone ? "No phone number on account" : phoneVerified ? `Verified on ${dateLabel(account.phoneConfirmedAt)}` : "Phone confirmation pending"} />
          <div className="pt-4">
            <Link href="/dashboard/settings" className="inline-flex rounded-[5px] bg-[#1B1C18] px-3.5 py-2.5 font-['Space_Grotesk'] text-[11px] font-semibold text-white transition-colors hover:bg-[#34352F]">Manage account settings</Link>
          </div>
        </Section>
      </div>
      <p className="font-['Space_Grotesk'] text-[10px] leading-5 text-[#92948D]">Profile details are read from your authenticated account and workspace. Editing personal identity details is not enabled here yet.</p>
    </div>
  );
}
