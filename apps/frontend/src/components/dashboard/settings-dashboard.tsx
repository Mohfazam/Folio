"use client";

import { useEffect, useMemo, useState } from "react";
import { getWorkspaceSettingsAction, saveAgentSettingsAction, saveWorkspaceSettingsAction } from "@/app/(dashboard)/dashboard/actions";

type Section = "general" | "account" | "ai" | "calling" | "notifications" | "team" | "plan" | "security" | "integrations";
type RecordValue = Record<string, unknown>;
const NAV: { id: Section; label: string; group: string; description: string }[] = [
  { id: "general", label: "General & workspace", group: "WORKSPACE", description: "Institution identity and workspace details" },
  { id: "account", label: "Account & profile", group: "WORKSPACE", description: "Your personal account information" },
  { id: "ai", label: "AI calling preferences", group: "AI & CALLING", description: "Configure your voice agent" },
  { id: "calling", label: "Calling configuration", group: "AI & CALLING", description: "Calling hours, retries and recording" },
  { id: "notifications", label: "Notifications", group: "PREFERENCES", description: "Choose which updates matter to you" },
  { id: "team", label: "Team & permissions", group: "PREFERENCES", description: "Workspace members and access roles" },
  { id: "plan", label: "Plan & usage", group: "BILLING", description: "Subscription, credits and usage" },
  { id: "security", label: "Security & privacy", group: "BILLING", description: "Sessions, data and privacy controls" },
  { id: "integrations", label: "Integrations", group: "DEVELOPER", description: "Connected services and API access" },
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

export function SettingsDashboard({ account }: { account: { name: string; email: string } }) {
  const [section, setSection] = useState<Section>("general");
  const [profile, setProfile] = useState<RecordValue>({});
  const [agent, setAgent] = useState<RecordValue>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [voices, setVoices] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    getWorkspaceSettingsAction().then((result) => {
      if (!active) return;
      if (!result.ok) { setError(result.error); setLoading(false); return; }
      const data = result.data ?? {};
      setProfile((data.businessProfile && typeof data.businessProfile === "object" ? data.businessProfile : {}) as RecordValue);
      setAgent((data.agentSettings && typeof data.agentSettings === "object" ? data.agentSettings : {}) as RecordValue);
      setVoices(Array.isArray(data.availableVoices) ? data.availableVoices.map((item) => typeof item === "string" ? item : str((item as RecordValue).id)).filter(Boolean) : []);
      setLanguages(Array.isArray(data.availableLanguages) ? data.availableLanguages.map((item) => typeof item === "string" ? item : str((item as RecordValue).code)).filter(Boolean) : []);
      setLoading(false);
    }).catch((e) => { if (active) { setError(e instanceof Error ? e.message : "Unable to load settings."); setLoading(false); } });
    return () => { active = false; };
  }, []);

  const active = NAV.find((item) => item.id === section)!;
  const updateProfile = (key: string, value: string) => { setProfile((current) => ({ ...current, [key]: value })); setDirty(true); setSuccess(null); };
  const updateAgent = (key: string, value: string) => { setAgent((current) => ({ ...current, [key]: value })); setDirty(true); setSuccess(null); };
  const save = async () => {
    setSaving(true); setError(null); setSuccess(null);
    const result = section === "ai"
      ? await saveAgentSettingsAction({ industry: profile.industry, displayName: profile.displayName, description: profile.description, agentName: agent.agentName ?? profile.aiPersonaName, tone: agent.tone ?? profile.toneOfVoice, language: agent.language ?? "en-IN", speechRate: Number(agent.speechRate ?? 1), voiceId: agent.voiceId ?? "", greeting: agent.greeting, primaryObjective: agent.primaryObjective, handoffInstructions: agent.handoffInstructions ?? "", pronunciationNotes: agent.pronunciationNotes ?? "", complianceNotes: profile.complianceNotes ?? "", guardrails: Array.isArray(profile.guardrails) && profile.guardrails.length ? profile.guardrails : ["Do not invent institutional policies, fees or deadlines."] })
      : await saveWorkspaceSettingsAction({ industry: profile.industry ?? "education", displayName: profile.displayName, description: profile.description, tagline: profile.tagline, website: profile.website, address: profile.address, operatingHours: profile.operatingHours, supportPhone: profile.supportPhone });
    setSaving(false);
    if (!result.ok) { setError(result.error); return; }
    setDirty(false); setSuccess("Your changes have been saved.");
  };

  const groups = useMemo(() => [...new Set(NAV.map((item) => item.group))], []);
  return <div className="min-h-full bg-[#FBFAF6] px-4 py-6 sm:px-7 sm:py-8 lg:px-9">
    <div className="mx-auto max-w-[1320px]">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold tracking-[0.14em] text-[#8A806D]">WORKSPACE CONTROL</p><h1 className="mt-1 font-['Newsreader'] text-[34px] leading-tight text-[#1B1C18]">Settings</h1><p className="mt-1 text-[12px] text-[#777970]">Manage your workspace, AI agent and account preferences.</p></div><div className="text-right"><p className="text-[11px] text-[#777970]">Workspace</p><p className="text-[13px] font-semibold text-[#34352F]">{str(profile.displayName, "Your institution")}</p></div></div>
      <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="h-fit rounded-lg border border-[#E9E8E1] bg-white p-2">
          {groups.map((group) => <div key={group} className="mb-3 last:mb-0"><p className="px-3 pb-1 pt-3 text-[9px] font-bold tracking-[0.12em] text-[#A09F96]">{group}</p>{NAV.filter((item) => item.group === group).map((item) => <button key={item.id} onClick={() => { setSection(item.id); setError(null); setSuccess(null); }} className={`mb-0.5 flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-[12px] transition ${section === item.id ? "bg-[#F1F0E8] font-semibold text-[#252620]" : "text-[#65675F] hover:bg-[#F8F7F2]"}`}><span>{item.label}</span>{section === item.id ? <span className="h-1.5 w-1.5 rounded-full bg-[#8A806D]" /> : null}</button>)}</div>)}
        </aside>
        <main className="min-w-0 rounded-lg border border-[#E9E8E1] bg-white p-5 sm:p-7">
          {loading ? <div className="py-16 text-center text-[13px] text-[#777970]">Loading your workspace settings...</div> : <>
            {section === "general" ? <><SectionHeading title="General & workspace" description="Update the institution details used across your Foolioo workspace."/><div className="grid gap-5 sm:grid-cols-2"><Field label="Institution name" value={str(profile.displayName)} onChange={(v) => updateProfile("displayName", v)} placeholder="Your institution name"/><SelectField label="Industry" value={str(profile.industry, "education")} options={["education", "general", "healthcare", "professional_services", "retail"]} onChange={(v) => updateProfile("industry", v)}/><Field label="Tagline" value={str(profile.tagline)} onChange={(v) => updateProfile("tagline", v)} placeholder="A short description of your institution"/><Field label="Website" value={str(profile.website)} onChange={(v) => updateProfile("website", v)} placeholder="https://example.edu"/><div className="sm:col-span-2"><Field label="Institution description" value={str(profile.description)} onChange={(v) => updateProfile("description", v)} multiline placeholder="Describe your institution, courses and services."/></div><div className="sm:col-span-2"><Field label="Address" value={str(profile.address)} onChange={(v) => updateProfile("address", v)} placeholder="Institution address"/></div><Field label="Support phone" value={str(profile.supportPhone)} onChange={(v) => updateProfile("supportPhone", v)} placeholder="+91..."/><Field label="Operating hours" value={str(profile.operatingHours)} onChange={(v) => updateProfile("operatingHours", v)} placeholder="Monday to Saturday, 9 AM to 6 PM"/></div><p className="mt-5 text-[11px] text-[#92938B]">Workspace ID: {str(profile.clientId, "Managed by Foolioo")}</p></> : null}
            {section === "account" ? <><SectionHeading title="Account & profile" description="Your signed-in identity. Authentication changes are managed securely through your account provider."/><div className="grid gap-5 sm:grid-cols-2"><Field label="Display name" value={account.name || "Not set"} /><Field label="Email address" value={account.email} /><Field label="Authentication" value="Supabase Auth"/><Field label="Account ID" value="Hidden for security"/></div><div className="mt-6 rounded-md bg-[#F8F7F2] p-4 text-[12px] text-[#65675F]">To change your email or password, use the account recovery flow. Profile editing and session management will be added with the account API.</div></> : null}
            {section === "ai" ? <><SectionHeading title="AI calling preferences" description="Control how your AI agent introduces itself and handles conversations."/><div className="grid gap-5 sm:grid-cols-2"><Field label="Agent name" value={str(agent.agentName, str(profile.aiPersonaName))} onChange={(v) => updateAgent("agentName", v)} placeholder="e.g. Aisha"/><Field label="Speaking style" value={str(agent.tone, str(profile.toneOfVoice))} onChange={(v) => updateAgent("tone", v)} placeholder="Warm, professional and concise"/><SelectField label="Default language" value={str(agent.language, languages[0] ?? "en-IN")} options={languages.length ? languages : ["en-IN"]} onChange={(v) => updateAgent("language", v)}/><SelectField label="Voice" value={str(agent.voiceId)} options={["", ...voices]} onChange={(v) => updateAgent("voiceId", v)}/><Field label="Speaking speed" value={str(agent.speechRate, "1")} onChange={(v) => updateAgent("speechRate", v)} hint="Use a value between 0.8 and 1.2."/><div className="sm:col-span-2"><Field label="Opening greeting" value={str(agent.greeting)} onChange={(v) => updateAgent("greeting", v)} multiline placeholder="Your agent's first words on a call"/></div><div className="sm:col-span-2"><Field label="Primary objective" value={str(agent.primaryObjective)} onChange={(v) => updateAgent("primaryObjective", v)} multiline placeholder="What should the agent achieve?"/></div><div className="sm:col-span-2"><Field label="Handoff instructions" value={str(agent.handoffInstructions)} onChange={(v) => updateAgent("handoffInstructions", v)} multiline/></div><div className="sm:col-span-2"><Field label="Pronunciation notes" value={str(agent.pronunciationNotes)} onChange={(v) => updateAgent("pronunciationNotes", v)} multiline/></div></div></> : null}
            {section === "calling" ? <Placeholder title="Calling configuration" description="Set the operational rules for outbound calls." items={["Default caller ID and verified numbers", "Allowed calling days and time window", "Timezone for scheduled campaigns", "Retry attempts and retry interval", "Call recording and retention preferences", "Consent and do-not-call handling"]}/> : null}
            {section === "notifications" ? <Placeholder title="Notifications" description="Choose which workspace events should notify you." items={["Campaign completed or paused", "Calls failed or could not connect", "Low credit balance", "New follow-up created or overdue", "Daily performance summary"]}/> : null}
            {section === "team" ? <Placeholder title="Team & permissions" description="Manage who can access this institution's workspace." items={["Invite team members", "Assign owner, admin and member roles", "Review pending invitations", "Revoke workspace access"]}/> : null}
            {section === "plan" ? <><SectionHeading title="Plan & usage" description="Review your subscription and usage. Billing actions are not yet connected."/><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-md border border-[#E9E8E1] p-4"><p className={labelClass}>Current plan</p><p className="mt-2 font-['Newsreader'] text-[25px] text-[#252620]">Workspace plan</p><p className="mt-1 text-[11px] text-[#777970]">Plan details are managed by your workspace administrator.</p></div><div className="rounded-md border border-[#E9E8E1] p-4"><p className={labelClass}>Credits</p><p className="mt-2 font-['Newsreader'] text-[25px] text-[#252620]">Usage dashboard</p><p className="mt-1 text-[11px] text-[#777970]">See current consumption in Analytics.</p></div></div><div className="mt-4 rounded-md bg-[#F8F7F2] p-4 text-[12px] text-[#65675F]">Self-service upgrades, invoices and payment methods are not connected yet. No billing controls are shown as active.</div></> : null}
            {section === "security" ? <Placeholder title="Security & privacy" description="Review account security and workspace data controls." items={["Active sessions and sign out everywhere", "Password and multi-factor authentication", "Call recording retention period", "Workspace data export", "Account deletion and data removal"]}/> : null}
            {section === "integrations" ? <Placeholder title="Integrations" description="Connect external tools to your Foolioo workspace." items={["CRM integrations", "Webhook endpoints and delivery logs", "API keys and access scopes", "Telephony provider status", "Speech provider status"]}/> : null}
            {error ? <p role="alert" className="mt-5 rounded-md bg-[#FBECE9] px-3 py-2.5 text-[12px] text-[#A33A32]">{error}</p> : null}
            {success ? <p role="status" className="mt-5 rounded-md bg-[#EDF5EC] px-3 py-2.5 text-[12px] text-[#356B3D]">{success}</p> : null}
            {(section === "general" || section === "ai") ? <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[#F0EFE9] pt-5"><span className="text-[11px] text-[#92938B]">{dirty ? "You have unsaved changes." : "Your settings are up to date."}</span><button onClick={save} disabled={saving || !dirty} className="rounded-md bg-[#1B1C18] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#34352F] disabled:cursor-not-allowed disabled:opacity-40">{saving ? "Saving..." : "Save changes"}</button></div> : null}
          </>}
        </main>
      </div>
    </div>
  </div>;
}
