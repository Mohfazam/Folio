"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { saveAgentSettingsAction, saveWorkspaceSettingsAction } from "@/app/(dashboard)/dashboard/actions";
import { dashboardKeys } from "@/lib/query/keys";

type Section = "general" | "account" | "calling" | "notifications" | "team" | "plan" | "security" | "integrations";
type RecordValue = Record<string, unknown>;
type SaveStatus = "idle" | "saving" | "saved" | "error";

const AUTO_SAVE_DELAY_MS = 1000;

const TABS: { id: Section; label: string }[] = [
  { id: "general", label: "General" },
  { id: "account", label: "Account" },
  { id: "calling", label: "Calling" },
  { id: "notifications", label: "Notifications" },
  { id: "team", label: "Team" },
  { id: "plan", label: "Plan & usage" },
  { id: "security", label: "Security" },
  { id: "integrations", label: "Integrations" },
];

const inputClass = "mt-1.5 w-full rounded-md border border-[#E5E4DC] bg-white px-3 py-2.5 text-[13px] text-[#252620] outline-none transition focus:border-[#8B806A] focus:ring-2 focus:ring-[#8B806A]/10";
const labelClass = "text-[11px] font-semibold uppercase tracking-[0.07em] text-[#777970]";
function str(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function Field({ label, value, onChange, placeholder, multiline = false, hint }: { label: string; value: string; onChange?: (value: string) => void; placeholder?: string; multiline?: boolean; hint?: string }) {
  return <label className="block"><span className={labelClass}>{label}</span>{multiline ? <textarea rows={3} className={inputClass} value={value} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder} /> : <input className={inputClass} value={value} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder} />}{hint ? <span className="mt-1 block text-[11px] text-[#92938B]">{hint}</span> : null}</label>;
}
function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="block"><span className={labelClass}>{label}</span><select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}
function SectionHeading({ title, description }: { title: string; description: string }) { return <div className="mb-6"><h2 className="font-['Newsreader'] text-[27px] text-[#1B1C18]">{title}</h2><p className="mt-1 text-[12px] text-[#777970]">{description}</p></div>; }
function Placeholder({ title, description, items }: { title: string; description: string; items: string[] }) { return <><SectionHeading title={title} description={description} /><div className="rounded-lg border border-[#E9E8E1] bg-white"><div className="divide-y divide-[#F0EFE9]">{items.map((item) => <div key={item} className="flex items-center justify-between gap-4 px-4 py-4"><div><p className="text-[13px] font-medium text-[#34352F]">{item}</p><p className="mt-1 text-[11px] text-[#92938B]">This control will be available when the required backend integration is implemented.</p></div><span className="rounded-full bg-[#F5F4ED] px-2.5 py-1 text-[10px] font-semibold text-[#777970]">Coming soon</span></div>)}</div></div></>; }

export function SettingsDashboard({ account, initialSettings }: {
  account: { name: string; email: string };
  initialSettings: { profile: RecordValue; agent: RecordValue; voices: string[]; languages: string[]; error: string | null };
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [section, setSection] = useState<Section>("general");
  const [profile, setProfile] = useState<RecordValue>(initialSettings.profile);
  const [agent, setAgent] = useState<RecordValue>(initialSettings.agent);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(initialSettings.error ? "error" : "idle");
  const [error, setError] = useState<string | null>(initialSettings.error);
  const [success, setSuccess] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const profileRef = useRef<RecordValue>(profile);
  const agentRef = useRef<RecordValue>(agent);
  profileRef.current = profile;
  agentRef.current = agent;

  const dirtyRef = useRef<boolean>(dirty);
  dirtyRef.current = dirty;

  // Hydrate form fields as soon as cached/background query data arrives without blocking page render
  useEffect(() => {
    if (!dirtyRef.current && Object.keys(initialSettings.profile).length > 0) {
      setProfile(initialSettings.profile);
    }
  }, [initialSettings.profile]);

  useEffect(() => {
    if (!dirtyRef.current && Object.keys(initialSettings.agent).length > 0) {
      setAgent(initialSettings.agent);
    }
  }, [initialSettings.agent]);

  useEffect(() => {
    if (initialSettings.error) {
      setError(initialSettings.error);
    }
  }, [initialSettings.error]);

  const savingRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDebounceTimer = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const performSave = useCallback(async () => {
    if (savingRef.current) return;

    savingRef.current = true;
    setSaving(true);
    setSaveStatus("saving");
    setError(null);

    const currentProfile = profileRef.current;

    const result = await saveWorkspaceSettingsAction({
      industry: currentProfile.industry ?? "education",
      displayName: currentProfile.displayName,
      description: currentProfile.description,
      tagline: currentProfile.tagline,
      website: currentProfile.website,
      address: currentProfile.address,
      operatingHours: currentProfile.operatingHours,
      supportPhone: currentProfile.supportPhone,
    });

    savingRef.current = false;
    setSaving(false);

    if (!result.ok) {
      setSaveStatus("error");
      setError(result.error);
      return;
    }

    setProfile((current) => ({ ...current, ...currentProfile }));
    setDirty(false);
    setSaveStatus("saved");
    setSuccess("Changes saved automatically.");
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.businessProfile() });
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.workspaceSetup() });
    router.refresh();
  }, [queryClient]);

  const scheduleAutoSave = useCallback(() => {
    clearDebounceTimer();
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      if (dirtyRef.current) {
        void performSave();
      }
    }, AUTO_SAVE_DELAY_MS);
  }, [clearDebounceTimer, performSave]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => {
      setSuccess(null);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    return () => {
      clearDebounceTimer();
    };
  }, [clearDebounceTimer]);

  const updateProfile = (key: string, value: string) => {
    setProfile((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setSuccess(null);
    setError(null);
    setSaveStatus("idle");
    scheduleAutoSave();
  };

  const saveNow = () => {
    clearDebounceTimer();
    void performSave();
  };

  const isEditableSection = section === "general";

  return (
    <div className="min-h-full bg-[#FBFAF6] px-4 py-6 sm:px-7 sm:py-8 lg:px-9">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-[0.14em] text-[#8A806D]">WORKSPACE CONTROL</p>
            <h1 className="mt-1 font-['Newsreader'] text-[34px] leading-tight text-[#1B1C18]">Settings</h1>
            <p className="mt-1 text-[12px] text-[#777970]">Manage your workspace, account and operational preferences.</p>
          </div>
          <div className="flex items-center gap-3 text-right">
            {isEditableSection && saveStatus !== "idle" ? (
              <span
                role="status"
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  saveStatus === "saving"
                    ? "bg-[#F1F0E8] text-[#65675F]"
                    : saveStatus === "saved"
                      ? "bg-[#EDF5EC] text-[#356B3D]"
                      : "bg-[#FBECE9] text-[#A33A32]"
                }`}
              >
                {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : "Save failed"}
              </span>
            ) : null}
            <div>
              <p className="text-[11px] text-[#777970]">Workspace</p>
              <p className="text-[13px] font-semibold text-[#34352F]">{str(profile.displayName, "Your institution")}</p>
            </div>
          </div>
        </div>

        {/* Clean horizontal section tabs (no duplicate vertical sidebar) */}
        <div
          role="tablist"
          aria-label="Settings sections"
          className="mb-6 flex flex-wrap gap-1.5 border-b border-[#E9E8E1] pb-3"
        >
          {TABS.map((tab) => {
            const active = section === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  clearDebounceTimer();
                  setSection(tab.id);
                  setError(null);
                  setSuccess(null);
                  setSaveStatus("idle");
                }}
                className={`rounded-md px-3.5 py-2 font-['Space_Grotesk'] text-[12px] transition ${
                  active
                    ? "bg-[#1B1C18] font-semibold text-white"
                    : "bg-white text-[#565B5B] border border-[#E9E8E1] hover:bg-[#F5F4ED] hover:text-[#1B1C18]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <main className="min-w-0 rounded-lg border border-[#E9E8E1] bg-white p-5 sm:p-7">
          {section === "general" ? (
            <>
              <SectionHeading title="General & workspace" description="Update the institution details used across your Foolioo workspace." />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Institution name" value={str(profile.displayName)} onChange={(v) => updateProfile("displayName", v)} placeholder="Your institution name" />
                <SelectField label="Industry" value={str(profile.industry, "education")} options={["education", "general", "healthcare", "professional_services", "retail"]} onChange={(v) => updateProfile("industry", v)} />
                <Field label="Tagline" value={str(profile.tagline)} onChange={(v) => updateProfile("tagline", v)} placeholder="A short description of your institution" />
                <Field label="Website" value={str(profile.website)} onChange={(v) => updateProfile("website", v)} placeholder="https://example.edu" />
                <div className="sm:col-span-2">
                  <Field label="Institution description" value={str(profile.description)} onChange={(v) => updateProfile("description", v)} multiline placeholder="Describe your institution, courses and services." />
                </div>
                <div className="sm:col-span-2">
                  <Field label="Address" value={str(profile.address)} onChange={(v) => updateProfile("address", v)} placeholder="Institution address" />
                </div>
                <Field label="Support phone" value={str(profile.supportPhone)} onChange={(v) => updateProfile("supportPhone", v)} placeholder="+91..." />
                <Field label="Operating hours" value={str(profile.operatingHours)} onChange={(v) => updateProfile("operatingHours", v)} placeholder="Monday to Saturday, 9 AM to 6 PM" />
              </div>
              <p className="mt-5 text-[11px] text-[#92938B]">Workspace ID: {str(profile.clientId, "Managed by Foolioo")}</p>
            </>
          ) : null}

          {section === "account" ? (
            <>
              <SectionHeading title="Account & profile" description="Read-only details for your signed-in identity and workspace session." />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-[#E9E8E1] bg-[#FBFAF6] p-4">
                  <p className={labelClass}>Display name</p>
                  <p className="mt-2 font-['Space_Grotesk'] text-[14px] font-medium text-[#1B1C18]">{account.name || "Not set"}</p>
                  <p className="mt-1 text-[11px] text-[#858782]">Synced from your signed-in profile</p>
                </div>
                <div className="rounded-lg border border-[#E9E8E1] bg-[#FBFAF6] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className={labelClass}>Email address</p>
                    <span className="rounded-full bg-[#ECEBE4] px-2 py-0.5 text-[10px] font-semibold text-[#55574F]">Read-only</span>
                  </div>
                  <p className="mt-2 break-all font-['Space_Grotesk'] text-[14px] font-medium text-[#1B1C18]">{account.email || "Not available"}</p>
                  <p className="mt-1 text-[11px] text-[#858782]">Email address cannot be changed</p>
                </div>
                <div className="rounded-lg border border-[#E9E8E1] bg-[#FBFAF6] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className={labelClass}>Authentication</p>
                    <span className="rounded-full bg-[#E7F2E8] px-2 py-0.5 text-[10px] font-semibold text-[#31613B]">Active</span>
                  </div>
                  <p className="mt-2 font-['Space_Grotesk'] text-[14px] font-medium text-[#1B1C18]">Supabase Auth</p>
                  <p className="mt-1 text-[11px] text-[#858782]">Managed securely by your sign-in provider</p>
                </div>
                <div className="rounded-lg border border-[#E9E8E1] bg-[#FBFAF6] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className={labelClass}>Account ID</p>
                    <span className="rounded-full bg-[#ECEBE4] px-2 py-0.5 text-[10px] font-semibold text-[#55574F]">Protected</span>
                  </div>
                  <p className="mt-2 font-mono text-[13px] text-[#34352F]">Hidden for security</p>
                  <p className="mt-1 text-[11px] text-[#858782]">Internal account identifier</p>
                </div>
              </div>
              <div className="mt-5 rounded-md border border-[#ECEBE4] bg-[#F8F7F2] px-4 py-3 text-[12px] text-[#65675F]">
                Account identity fields are read-only and managed through your authentication provider.
              </div>
            </>
          ) : null}

          {section === "calling" ? <Placeholder title="Calling configuration" description="Set the operational rules for outbound calls." items={["Default caller ID and verified numbers", "Allowed calling days and time window", "Timezone for scheduled campaigns", "Retry attempts and retry interval", "Call recording and retention preferences", "Consent and do-not-call handling"]} /> : null}
          {section === "notifications" ? <Placeholder title="Notifications" description="Choose which workspace events should notify you." items={["Campaign completed or paused", "Calls failed or could not connect", "Low credit balance", "New follow-up created or overdue", "Daily performance summary"]} /> : null}
          {section === "team" ? <Placeholder title="Team & permissions" description="Manage who can access this institution's workspace." items={["Invite team members", "Assign owner, admin and member roles", "Review pending invitations", "Revoke workspace access"]} /> : null}
          {section === "plan" ? (
            <>
              <SectionHeading title="Plan & usage" description="Review your subscription and usage. Billing actions are not yet connected." />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-[#E9E8E1] p-4">
                  <p className={labelClass}>Current plan</p>
                  <p className="mt-2 font-['Newsreader'] text-[25px] text-[#252620]">Workspace plan</p>
                  <p className="mt-1 text-[11px] text-[#777970]">Plan details are managed by your workspace administrator.</p>
                </div>
                <div className="rounded-md border border-[#E9E8E1] p-4">
                  <p className={labelClass}>Credits</p>
                  <p className="mt-2 font-['Newsreader'] text-[25px] text-[#252620]">Usage dashboard</p>
                  <p className="mt-1 text-[11px] text-[#777970]">See current consumption in Analytics.</p>
                </div>
              </div>
              <div className="mt-4 rounded-md bg-[#F8F7F2] p-4 text-[12px] text-[#65675F]">Self-service upgrades, invoices and payment methods are not connected yet. No billing controls are shown as active.</div>
            </>
          ) : null}
          {section === "security" ? <Placeholder title="Security & privacy" description="Review account security and workspace data controls." items={["Active sessions and sign out everywhere", "Password and multi-factor authentication", "Call recording retention period", "Workspace data export", "Account deletion and data removal"]} /> : null}
          {section === "integrations" ? <Placeholder title="Integrations" description="Connect external tools to your Foolioo workspace." items={["CRM integrations", "Webhook endpoints and delivery logs", "API keys and access scopes", "Telephony provider status", "Speech provider status"]} /> : null}

          {error ? <p role="alert" className="mt-5 rounded-md bg-[#FBECE9] px-3 py-2.5 text-[12px] text-[#A33A32]">{error}</p> : null}
      {success ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
        >
          <div className="pointer-events-auto inline-flex max-w-[92vw] items-center gap-2.5 rounded-full border border-[#2C2E28] bg-[#1B1C18] px-4 py-2.5 font-['Space_Grotesk'] text-[12px] font-medium text-white shadow-[0_12px_32px_rgba(27,28,24,0.24)] transition-all duration-200">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#4ADE80]" aria-hidden="true" />
            <span>{success}</span>
          </div>
        </div>
      ) : null}
        </main>
      </div>

      {isEditableSection && dirty ? (
        <div
          role="region"
          aria-label="Unsaved settings changes"
          className="fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-xl border border-[#DFDDD2] bg-white/95 px-4 py-2.5 shadow-[0_12px_32px_rgba(27,28,24,0.14)] backdrop-blur-sm transition-all"
        >
          <span className="hidden text-[12px] font-medium text-[#5C5E56] sm:inline">
            Auto-saving shortly...
          </span>
          <button
            type="button"
            onClick={() => {
              clearDebounceTimer();
              setProfile(initialSettings.profile);
              setAgent(initialSettings.agent);
              setDirty(false);
              setSaveStatus("idle");
              setError(null);
              setSuccess(null);
            }}
            disabled={saving}
            className="rounded-lg border border-[#E5E4DC] bg-[#FBFAF6] px-3 py-2 text-[12px] font-medium text-[#444748] transition hover:bg-[#F1F0E8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={saveNow}
            disabled={saving}
            className="rounded-lg bg-[#1B1C18] px-4 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:bg-[#34352F] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save now"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
