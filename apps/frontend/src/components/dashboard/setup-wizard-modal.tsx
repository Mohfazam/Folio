"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createCampaignAction,
  createTestCallAction,
  getTestCallStatusAction,
  importContactsAction,
  launchCampaignAction,
  saveAgentSettingsAction,
  saveRoutingRulesAction,
} from "@/app/(dashboard)/dashboard/actions";

type SetupAction = "voice" | "contacts" | "test-call" | "campaign" | "routing" | "launch";
type RecordValue = Record<string, unknown>;
type Snapshot = { items: RecordValue[]; total: number | null; itemsKnown: boolean };
type LoadResult<T> = { state: "ready"; data: T } | { state: "error"; error: string; status?: number };

type SetupData = {
  businessProfile: LoadResult<RecordValue | null>;
  agentSettings: LoadResult<RecordValue>;
  routingRules: LoadResult<RecordValue>;
  teamMembers: LoadResult<Snapshot>;
  clients: LoadResult<Snapshot>;
  contacts: LoadResult<Snapshot>;
  campaigns: LoadResult<Snapshot>;
  knowledgeBase: LoadResult<Snapshot>;
  authProfile: LoadResult<RecordValue>;
  launchContacts: LoadResult<Snapshot>;
};

type ActionResult = { ok: true; data?: RecordValue } | { ok: false; error: string; status?: number };

const INPUT = "h-10 w-full rounded-[4px] border border-[#DCDDD6] bg-white px-3 font-['Space_Grotesk'] text-[13px] text-[#1B1C18] outline-none transition-colors placeholder:text-[#A0A19A] focus:border-[#7852D6]";
const TEXTAREA = "w-full rounded-[4px] border border-[#DCDDD6] bg-white px-3 py-2.5 font-['Space_Grotesk'] text-[13px] leading-5 text-[#1B1C18] outline-none transition-colors placeholder:text-[#A0A19A] focus:border-[#7852D6]";
const LABEL = "flex flex-col gap-1.5 font-['Space_Grotesk'] text-[12px] font-medium text-[#444748]";

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textValue(record: RecordValue | null | undefined, key: string, fallback = ""): string {
  const value = record?.[key];
  return typeof value === "string" ? value : fallback;
}

function recordValue(record: RecordValue | null | undefined, key: string): RecordValue {
  return isRecord(record?.[key]) ? record[key] as RecordValue : {};
}

function listValue(record: RecordValue | null | undefined, key: string): string[] {
  const value = record?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function items(result: LoadResult<Snapshot>): RecordValue[] {
  return result.state === "ready" ? result.data.items : [];
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <span className="font-['Space_Grotesk'] text-[11px] font-normal leading-4 text-[#85877F]">{children}</span>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="border-b border-[#ECEBE5] pb-2 pt-1 font-['Space_Grotesk'] text-[10px] font-bold tracking-[0.09em] text-[#747878]">{children}</p>;
}

export function SetupWizardModal({
  action,
  data,
  onClose,
  onComplete,
}: {
  action: SetupAction;
  data: SetupData;
  onClose: () => void;
  onComplete: () => void;
}) {
  const profile = data.businessProfile.state === "ready" ? data.businessProfile.data : null;
  const agentPayload = data.agentSettings.state === "ready" ? data.agentSettings.data : {};
  const agent = isRecord(agentPayload.agentSettings) ? agentPayload.agentSettings : recordValue(recordValue(profile, "metadata"), "aiAgentSettings");
  const routingPayload = data.routingRules.state === "ready" ? data.routingRules.data : {};
  const routing = isRecord(routingPayload.routingRules) ? routingPayload.routingRules : {};
  const team = items(data.teamMembers);
  const client = items(data.clients)[0] ?? {};
  const authPayload = data.authProfile.state === "ready" ? data.authProfile.data : {};
  const authUser = recordValue(authPayload, "user");
  const hasVerifiedPhone = authPayload.hasVerifiedPhone === true && textValue(authUser, "phoneNumber") !== "";
  const verifiedPhone = hasVerifiedPhone ? textValue(authUser, "phoneNumber") : "";
  const launchContactRows = items(data.launchContacts);
  const campaignRows = items(data.campaigns);
  const voices = Array.isArray(agentPayload.availableVoices)
    ? agentPayload.availableVoices.filter(isRecord)
    : [];
  const languages = Array.isArray(agentPayload.availableLanguages)
    ? agentPayload.availableLanguages.filter(isRecord)
    : [{ code: "en-IN", label: "English (India)" }];

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testCallId, setTestCallId] = useState("");
  const [testCallStatus, setTestCallStatus] = useState<RecordValue | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState(() => {
    const first = campaignRows.find((item) => item.status === "draft" || item.status === "paused");
    return textValue(first, "id");
  });
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [launchConfirmed, setLaunchConfirmed] = useState(false);
  const [speechRate, setSpeechRate] = useState(String(agent.speechRate ?? 1));
  const [contactFile, setContactFile] = useState<File | null>(null);
  const [contactImportStage, setContactImportStage] = useState<"select" | "review">("select");
  const [contactImportConfirmed, setContactImportConfirmed] = useState(false);

  const availableContacts = useMemo(() => launchContactRows, [launchContactRows]);

  const submit = async (callback: () => Promise<ActionResult>, successMessage: string) => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await callback();
      if (!result.ok) {
        setError(result.error || "The request could not be completed.");
        return null;
      }
      setSuccess(successMessage);
      onComplete();
      return result.data ?? {};
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The request could not be completed.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!testCallId || !testCallStatus) return;
    const status = textValue(testCallStatus, "status");
    if (["completed", "failed", "exhausted"].includes(status)) return;

    let cancelled = false;
    const timer = window.setInterval(async () => {
      const result = await getTestCallStatusAction(testCallId);
      if (!cancelled && result.ok && result.data && isRecord(result.data.testCall)) {
        setTestCallStatus(result.data.testCall);
      }
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [testCallId, testCallStatus?.status]);

  const titles: Record<SetupAction, string> = {
    voice: "Set up your AI agent",
    contacts: "Add your contacts",
    "test-call": "Place a test call",
    campaign: "Create your first campaign",
    routing: "Set up follow-ups and team handling",
    launch: "Review and launch",
  };

  const renderFooter = (submitLabel: string, disabled = false) => (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#ECEBE5] pt-4">
      <button type="button" onClick={onClose} disabled={busy} className="rounded-[4px] px-4 py-2 font-['Space_Grotesk'] text-[12px] font-medium text-[#444748] hover:bg-[#F5F4ED]">{success ? "Close" : "Cancel"}</button>
      {!success ? <button type="submit" disabled={busy || disabled} className="rounded-[4px] bg-[#1B1C18] px-4 py-2 font-['Space_Grotesk'] text-[12px] font-semibold text-white transition-colors hover:bg-[#34352F] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Saving..." : submitLabel}</button> : null}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-[#1B1C18]/35 p-3 sm:p-5" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <section className="my-5 flex max-h-[min(92vh,900px)] w-full max-w-[680px] flex-col overflow-hidden rounded-[10px] border border-[#E9E8E1] bg-white shadow-[0_20px_64px_rgba(27,28,24,0.2)]" role="dialog" aria-modal="true" aria-labelledby="setup-wizard-title">
        <div className="flex shrink-0 items-start justify-between border-b border-[#ECEBE5] px-5 py-4 sm:px-6">
          <div>
            <p className="font-['Space_Grotesk'] text-[10px] font-bold tracking-[0.09em] text-[#747878]">WORKSPACE SETUP</p>
            <h2 id="setup-wizard-title" className="mt-1 font-['Newsreader'] text-[27px] leading-tight text-[#1B1C18]">{titles[action]}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="flex h-8 w-8 items-center justify-center rounded-full text-[#747878] transition-colors hover:bg-[#F5F4ED] disabled:opacity-50" aria-label="Close dialog">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {action === "voice" ? (
            <form className="flex flex-col gap-4" onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const guardrails = String(form.get("guardrails") ?? "").split("\n").map((item) => item.trim()).filter(Boolean);
              const payload: RecordValue = {
                industry: String(form.get("industry") ?? "general"),
                displayName: String(form.get("displayName") ?? "").trim(),
                description: String(form.get("description") ?? "").trim(),
                agentName: String(form.get("agentName") ?? "").trim(),
                tone: String(form.get("tone") ?? "").trim(),
                language: String(form.get("language") ?? "en-IN").trim(),
                speechRate: Number(form.get("speechRate") ?? 1),
                voiceId: String(form.get("voiceId") ?? "").trim() || null,
                greeting: String(form.get("greeting") ?? "").trim(),
                primaryObjective: String(form.get("primaryObjective") ?? "").trim(),
                handoffInstructions: String(form.get("handoffInstructions") ?? "").trim(),
                pronunciationNotes: String(form.get("pronunciationNotes") ?? "").trim(),
                complianceNotes: String(form.get("complianceNotes") ?? "").trim(),
                guardrails,
              };
              await submit(() => saveAgentSettingsAction(payload), "Your AI agent settings have been saved.");
            }}>
              <p className="font-['Space_Grotesk'] text-[12px] leading-5 text-[#565B5B]">Give your agent the context and instructions it needs to represent your business. You can refine these settings after your first test call.</p>
              <SectionLabel>01 / YOUR BUSINESS</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={LABEL}>Business name
                  <input name="displayName" required defaultValue={textValue(profile, "displayName", textValue(client, "name"))} className={INPUT} maxLength={180} placeholder="Your business name" />
                </label>
                <label className={LABEL}>Industry
                  <select name="industry" defaultValue={textValue(profile, "industry", "general")} className={INPUT}>
                    <option value="general">General business</option>
                    <option value="education">Education</option>
                    <option value="healthcare">Healthcare</option>
                    <option value="healthtech">Health technology</option>
                    <option value="saas_software">Software / SaaS</option>
                    <option value="developer_tools">Developer tools</option>
                    <option value="fintech">Financial technology</option>
                    <option value="ecommerce_retail">E-commerce</option>
                    <option value="retail">Retail</option>
                    <option value="real_estate">Real estate</option>
                    <option value="automotive">Automotive</option>
                    <option value="fitness">Fitness</option>
                    <option value="professional_services">Professional services</option>
                    <option value="beauty_wellness">Beauty and wellness</option>
                  </select>
                </label>
              </div>
              <label className={LABEL}>What does your business do?
                <textarea name="description" required rows={3} defaultValue={textValue(profile, "description")} className={TEXTAREA} maxLength={5000} placeholder="Describe your products, services and the customers you help." />
              </label>

              <SectionLabel>02 / AGENT IDENTITY & SPEAKING STYLE</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={LABEL}>Agent name
                  <input name="agentName" required defaultValue={textValue(agent, "agentName", textValue(profile, "aiPersonaName", "Assistant"))} className={INPUT} maxLength={80} placeholder="For example, Clara" />
                </label>
                <label className={LABEL}>Speaking style
                  <select name="tone" required defaultValue={textValue(agent, "tone", textValue(profile, "toneOfVoice", "Warm, professional, knowledgeable, and concise"))} className={INPUT}>
                    <option>Warm, professional, knowledgeable, and concise</option>
                    <option>Warm, professional and concise</option>
                    <option>Friendly and conversational</option>
                    <option>Clear and business-focused</option>
                    <option>Patient and empathetic</option>
                    <option>Confident and persuasive</option>
                  </select>
                </label>
                <label className={LABEL}>Primary language
                  <select name="language" required defaultValue={textValue(agent, "language", String(languages[0]?.code ?? "en-IN"))} className={INPUT}>
                    {languages.map((language) => <option key={String(language.code)} value={String(language.code)}>{String(language.label)}</option>)}
                  </select>
                  <FieldHint>Only languages enabled in your voice-provider configuration appear here.</FieldHint>
                </label>
                <label className={LABEL}>Speaking speed
                  <div className="flex h-10 items-center gap-3 rounded-[4px] border border-[#DCDDD6] px-3">
                    <input name="speechRate" type="range" min="0.8" max="1.2" step="0.05" value={speechRate} onChange={(event) => setSpeechRate(event.target.value)} className="min-w-0 flex-1 accent-[#7852D6]" />
                    <span className="w-12 text-right font-['Space_Grotesk'] text-[12px] text-[#444748]">{Number(speechRate).toFixed(2)}x</span>
                  </div>
                  <FieldHint>Controls the requested speech rate. The voice runtime must support rate adjustment.</FieldHint>
                </label>
              </div>
              {voices.length > 0 ? (
                <label className={LABEL}>Voice
                  <select name="voiceId" defaultValue={textValue(agent, "voiceId")} className={INPUT}>
                    <option value="">Use provider default</option>
                    {voices.map((voice) => <option key={String(voice.id)} value={String(voice.id)}>{String(voice.label)}{typeof voice.language === "string" ? ` · ${voice.language}` : ""}</option>)}
                  </select>
                </label>
              ) : (
                <div className="rounded-[4px] bg-[#F5F4ED] px-3 py-2.5 font-['Space_Grotesk'] text-[11px] leading-5 text-[#565B5B]">Voice selection is using your configured provider default. Add provider voice IDs to <code>FOOLIOO_VOICE_CATALOG_JSON</code> to offer selectable voices here.</div>
              )}

              <SectionLabel>03 / CONVERSATION BEHAVIOUR</SectionLabel>
              <label className={LABEL}>Opening greeting
                <textarea name="greeting" required rows={2} defaultValue={textValue(agent, "greeting", `Hello, this is ${textValue(agent, "agentName", textValue(profile, "aiPersonaName", "your assistant"))} calling from ${textValue(profile, "displayName", textValue(client, "name", "our business"))}. Is now a good time to talk?`)} className={TEXTAREA} placeholder="A short, natural greeting for the first few seconds of a call." />
              </label>
              <label className={LABEL}>What should the agent achieve during a call?
                <textarea name="primaryObjective" required rows={2} defaultValue={textValue(agent, "primaryObjective")} className={TEXTAREA} placeholder="Explain the purpose of the call and the outcome you want." />
              </label>
              <label className={LABEL}>When should the agent involve a person?
                <textarea name="handoffInstructions" rows={2} defaultValue={textValue(agent, "handoffInstructions")} className={TEXTAREA} placeholder="For example, when a customer requests a person or asks something the agent cannot answer." />
              </label>
              <label className={LABEL}>Pronunciation notes
                <textarea name="pronunciationNotes" rows={2} defaultValue={textValue(agent, "pronunciationNotes")} className={TEXTAREA} placeholder="Names, product terms or words that need a specific pronunciation." />
              </label>

              <SectionLabel>04 / SAFETY & COMPLIANCE</SectionLabel>
              <label className={LABEL}>Rules your agent must follow, one per line
                <textarea name="guardrails" required rows={4} defaultValue={listValue(profile, "guardrails").length ? listValue(profile, "guardrails").join("\n") : "Never invent prices, policies or commitments.\nRespect opt-out requests immediately.\nDo not provide advice outside the approved business information.\nEscalate sensitive or uncertain requests to a person."} className={TEXTAREA} placeholder={'Never invent prices or policy details.\nRespect opt-out requests.'} />
              </label>
              <label className={LABEL}>Required disclosures or compliance notes (optional)
                <textarea name="complianceNotes" rows={3} defaultValue={textValue(profile, "complianceNotes")} className={TEXTAREA} placeholder="Add any disclosures your business requires the agent to say during a call." />
              </label>
              {renderFooter("Save agent setup")}
            </form>
          ) : null}

          {action === "contacts" ? (
            <div className="flex flex-col gap-4">
              <p className="font-['Space_Grotesk'] text-[12px] leading-5 text-[#565B5B]">Upload a contact list. The existing import pipeline validates the records, detects duplicates and applies opt-out rules before contacts become eligible for campaigns.</p>
              <a href="/contact-import-template.csv" download className="w-fit font-['Space_Grotesk'] text-[12px] font-medium text-[#644ABB] underline underline-offset-2">Download contact CSV template</a>
              {contactImportStage === "select" ? (
                <>
                  <label className="flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[6px] border border-dashed border-[#CFCFC7] bg-[#FAF9F5] px-4 py-5 text-center transition-colors hover:border-[#7852D6]">
                    <svg viewBox="0 0 24 24" className="h-7 w-7 text-[#7852D6]" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" /></svg>
                    <span className="font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">Choose your contact file</span>
                    <span className="font-['Space_Grotesk'] text-[11px] text-[#747878]">CSV or Excel · One row per contact</span>
                    <input type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" className="mt-2 max-w-full font-['Space_Grotesk'] text-[11px] text-[#565B5B]" onChange={(event) => { setContactFile(event.target.files?.[0] ?? null); setContactImportConfirmed(false); setError(null); }} />
                  </label>
                  {contactFile ? <div className="flex items-center justify-between gap-3 rounded-[5px] border border-[#E9E8E1] bg-white p-3"><div className="min-w-0"><p className="truncate font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18]">{contactFile.name}</p><p className="mt-1 font-['Space_Grotesk'] text-[10px] text-[#747878]">{(contactFile.size / 1024).toFixed(1)} KB</p></div><button type="button" onClick={() => setContactFile(null)} className="font-['Space_Grotesk'] text-[11px] text-[#644ABB]">Remove</button></div> : null}
                  <div className="rounded-[4px] bg-[#F5F4ED] px-3 py-2.5 font-['Space_Grotesk'] text-[11px] leading-5 text-[#565B5B]">At minimum, include a phone number column. Names and other business fields can be included to personalise conversations. The backend remains responsible for validation and eligibility checks.</div>
                  <div className="flex justify-end border-t border-[#ECEBE5] pt-4"><button type="button" disabled={!contactFile} onClick={() => setContactImportStage("review")} className="rounded-[4px] bg-[#1B1C18] px-4 py-2 font-['Space_Grotesk'] text-[12px] font-semibold text-white hover:bg-[#34352F] disabled:cursor-not-allowed disabled:opacity-50">Review import →</button></div>
                </>
              ) : (
                <>
                  <SectionLabel>REVIEW BEFORE IMPORT</SectionLabel>
                  <div className="rounded-[5px] border border-[#E9E8E1] bg-[#FAF9F5] p-4">
                    <p className="font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">{contactFile?.name}</p>
                    <p className="mt-1 font-['Space_Grotesk'] text-[11px] text-[#747878]">{contactFile ? `${(contactFile.size / 1024).toFixed(1)} KB` : "No file selected"}</p>
                    <p className="mt-3 font-['Space_Grotesk'] text-[12px] leading-5 text-[#565B5B]">Foolioo will process this file using the workspace import pipeline. The import result will report the rows accepted or rejected by the backend. Invalid phone numbers, duplicates and opted-out contacts must remain ineligible for outbound campaigns.</p>
                  </div>
                  <label className="flex items-start gap-2 rounded-[4px] border border-[#E9E8E1] p-3 font-['Space_Grotesk'] text-[11px] leading-5 text-[#565B5B]">
                    <input type="checkbox" checked={contactImportConfirmed} onChange={(event) => setContactImportConfirmed(event.target.checked)} className="mt-1 accent-[#7852D6]" />
                    <span>I confirm that I have permission to contact the people in this file and that opt-out requests are represented correctly.</span>
                  </label>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#ECEBE5] pt-4">
                    <button type="button" disabled={busy} onClick={() => setContactImportStage("select")} className="rounded-[4px] px-3 py-2 font-['Space_Grotesk'] text-[12px] font-medium text-[#444748] hover:bg-[#F5F4ED]">Back</button>
                    <button type="button" disabled={busy || Boolean(success) || !contactFile || !contactImportConfirmed} onClick={async () => {
                      if (!contactFile) return;
                      const result = await submit(() => importContactsAction(contactFile), "Your contact import has been submitted. Check the import result before using this audience in a campaign.");
                      if (result) {
                        const payload = isRecord(result.import) ? result.import : result;
                        const total = payload.totalRows ?? payload.total ?? payload.processed;
                        const valid = payload.validRows ?? payload.valid;
                        const invalid = payload.invalidRows ?? payload.invalid;
                        if (typeof total === "number") setSuccess(`Import submitted. ${total} rows received${typeof valid === "number" ? `, ${valid} valid` : ""}${typeof invalid === "number" ? `, ${invalid} invalid` : ""}.`);
                      }
                    }} className="rounded-[4px] bg-[#1B1C18] px-4 py-2 font-['Space_Grotesk'] text-[12px] font-semibold text-white hover:bg-[#34352F] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Importing..." : "Confirm and import"}</button>
                  </div>
                </>
              )}
            </div>
          ) : null}

          {action === "test-call" ? (
            <div className="flex flex-col gap-4">
              <p className="font-['Space_Grotesk'] text-[12px] leading-5 text-[#565B5B]">Call your own verified phone to hear how your configured agent opens a conversation. This is a real call, capped at two minutes, and uses your workspace voice credits and daily call allowance.</p>
              <form className="flex flex-col gap-4" onSubmit={async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const confirmed = form.get("confirmRealCall") === "on";
                if (!confirmed) {
                  setError("Confirm that you are ready to receive a real test call.");
                  return;
                }
                const phone = String(form.get("phoneNumber") ?? "").trim();
                const result = await submit(() => createTestCallAction(phone, confirmed), "Test call added to the outbound queue. Foolioo will call your verified phone when the worker picks it up.");
                if (result && isRecord(result.testCall)) {
                  setTestCallId(textValue(result.testCall, "id"));
                  setTestCallStatus(result.testCall);
                }
              }}>
                <label className={LABEL}>Your phone number
                  <input name="phoneNumber" required type="tel" defaultValue={verifiedPhone} readOnly={hasVerifiedPhone} className={`${INPUT} ${hasVerifiedPhone ? "bg-[#F5F4ED] text-[#565B5B]" : ""}`} placeholder="Verify your phone number first" pattern="\+[1-9][0-9]{7,14}" />
                  <FieldHint>{hasVerifiedPhone ? "This is the verified phone number on your account. Test calls can only be sent here." : "Your account does not have a verified phone number. Verify it in account settings before placing a test call."}</FieldHint>
                </label>
                <label className="flex items-start gap-2 rounded-[4px] border border-[#E9E8E1] bg-[#FAF9F5] p-3 font-['Space_Grotesk'] text-[11px] leading-5 text-[#565B5B]">
                  <input name="confirmRealCall" type="checkbox" required className="mt-1 accent-[#7852D6]" />
                  <span>I understand that Foolioo will place a real call to my verified number, for up to two minutes, and that voice credits and my daily call allowance will be used.</span>
                </label>
                <div className="flex justify-end">
                  <button type="submit" disabled={busy || !hasVerifiedPhone || Boolean(testCallId)} className="rounded-[4px] bg-[#1B1C18] px-4 py-2 font-['Space_Grotesk'] text-[12px] font-semibold text-white hover:bg-[#34352F] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Queueing call..." : "Call my phone"}</button>
                </div>
              </form>
              {testCallId ? (
                <div className="rounded-[5px] border border-[#E9E8E1] bg-[#FAF9F5] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18]">Test call status</p>
                      <p className="mt-1 font-['Space_Grotesk'] text-[11px] capitalize text-[#747878]">{textValue(testCallStatus, "status", "pending").replaceAll("_", " ")}</p>
                    </div>
                    <button type="button" disabled={busy} onClick={async () => {
                      const result = await getTestCallStatusAction(testCallId);
                      if (result.ok && result.data && isRecord(result.data.testCall)) setTestCallStatus(result.data.testCall);
                      else if (!result.ok) setError(result.error);
                    }} className="rounded-[4px] border border-[#DCDDD6] bg-white px-3 py-2 font-['Space_Grotesk'] text-[11px] font-medium text-[#1B1C18] hover:bg-[#F5F4ED]">Refresh status</button>
                  </div>
                  {isRecord(testCallStatus?.call) ? <p className="mt-2 font-['Space_Grotesk'] text-[11px] text-[#565B5B]">Outcome: {textValue(testCallStatus.call, "outcome", "Recorded")}. {textValue(testCallStatus.call, "summary")}</p> : null}
                </div>
              ) : null}
              <div className="flex justify-end border-t border-[#ECEBE5] pt-4"><button type="button" onClick={onClose} className="rounded-[4px] bg-[#1B1C18] px-4 py-2 font-['Space_Grotesk'] text-[12px] font-medium text-white">Close</button></div>
            </div>
          ) : null}

          {action === "campaign" ? (
            <form className="flex flex-col gap-4" onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const keyTalkingPoints = String(form.get("keyTalkingPoints") ?? "").split("\n").map((item) => item.trim()).filter(Boolean);
              await submit(() => createCampaignAction({
                name: String(form.get("name") ?? "").trim(),
                type: String(form.get("type") ?? "outreach_sales"),
                status: "draft",
                primaryObjective: String(form.get("primaryObjective") ?? "").trim(),
                callOpeningHook: String(form.get("callOpeningHook") ?? "").trim(),
                keyTalkingPoints,
                objectionHandlers: [],
                callToAction: String(form.get("callToAction") ?? "").trim(),
                fallbackOffer: String(form.get("fallbackOffer") ?? "").trim() || undefined,
                targetAudience: String(form.get("targetAudience") ?? "").trim() || undefined,
                language: String(form.get("language") ?? "en-IN"),
                maxDurationSeconds: Number(form.get("maxDurationSeconds") ?? 300),
              }), "Campaign draft saved. Select the audience and confirm the launch in the final setup step.");
            }}>
              <p className="font-['Space_Grotesk'] text-[12px] leading-5 text-[#565B5B]">Start with the outcome you want. Foolioo saves a draft first. No contacts are called until you review and confirm the launch.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={LABEL}>Campaign name
                  <input name="name" required maxLength={120} className={INPUT} placeholder="For example, New enquiries follow-up" />
                </label>
                <label className={LABEL}>Campaign purpose
                  <select name="type" className={INPUT} defaultValue="outreach_sales">
                    <option value="outreach_sales">Reach new enquiries</option>
                    <option value="follow_up">Follow up with leads</option>
                    <option value="reminder">Send a reminder</option>
                    <option value="reactivation">Reconnect with past customers</option>
                    <option value="feedback_survey">Collect feedback</option>
                    <option value="announcement">Share an announcement</option>
                  </select>
                </label>
              </div>
              <label className={LABEL}>What should this campaign achieve?
                <textarea name="primaryObjective" required rows={2} className={TEXTAREA} placeholder="Describe the result you want from these conversations." />
              </label>
              <label className={LABEL}>How should the call begin?
                <textarea name="callOpeningHook" required rows={2} className={TEXTAREA} placeholder="Write a clear, natural opening for the agent." />
              </label>
              <label className={LABEL}>What should the agent cover? One point per line
                <textarea name="keyTalkingPoints" required rows={3} className={TEXTAREA} placeholder={'Introduce the reason for the call.\nAnswer common questions using approved information.\nAsk whether the customer would like the next step.'} />
              </label>
              <label className={LABEL}>What should the customer do next?
                <input name="callToAction" required className={INPUT} placeholder="For example, book a consultation" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={LABEL}>Preferred language
                  <select name="language" defaultValue={textValue(agent, "language", String(languages[0]?.code ?? "en-IN"))} className={INPUT}>
                    {languages.map((language) => <option key={String(language.code)} value={String(language.code)}>{String(language.label)}</option>)}
                  </select>
                </label>
                <label className={LABEL}>Maximum call duration
                  <select name="maxDurationSeconds" defaultValue="300" className={INPUT}>
                    <option value="120">2 minutes</option>
                    <option value="180">3 minutes</option>
                    <option value="300">5 minutes</option>
                    <option value="480">8 minutes</option>
                  </select>
                </label>
              </div>
              <label className={LABEL}>Audience notes (optional)
                <input name="targetAudience" className={INPUT} placeholder="Describe the kind of contacts this campaign is for." />
              </label>
              <label className={LABEL}>If the customer is not ready (optional)
                <input name="fallbackOffer" className={INPUT} placeholder="For example, offer to send more information." />
              </label>
              {renderFooter("Save campaign draft")}
            </form>
          ) : null}

          {action === "routing" ? (
            <form className="flex flex-col gap-4" onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const assign = (key: string) => String(form.get(key) ?? "").trim() || null;
              const routingPayload = {
                routingRules: {
                  callback: { enabled: true, assignToUserId: assign("callbackOwner"), dueInMinutes: Number(form.get("callbackDelay") ?? 30) },
                  highInterest: { enabled: true, assignToUserId: assign("interestOwner") },
                  humanRequested: { enabled: true, assignToUserId: assign("handoffOwner") },
                  noAnswer: { enabled: form.get("retryEnabled") === "on", retryAfterMinutes: Number(form.get("retryDelay") ?? 1440), maxRetries: Number(form.get("maxRetries") ?? 2) },
                },
                callingHoursStart: String(form.get("callingHoursStart") ?? "09:00"),
                callingHoursEnd: String(form.get("callingHoursEnd") ?? "18:00"),
                timezone: String(form.get("timezone") ?? "Asia/Kolkata"),
              };
              await submit(() => saveRoutingRulesAction(textValue(client, "id"), routingPayload), "Follow-up handling and workspace calling hours have been saved.");
            }}>
              <p className="font-['Space_Grotesk'] text-[12px] leading-5 text-[#565B5B]">Choose who should handle important conversations. Foolioo starts with simple defaults. You can change assignments later.</p>
              <SectionLabel>01 / WHO SHOULD HANDLE EACH SITUATION?</SectionLabel>
              {([
                ["callbackOwner", "Customer requests a callback", recordValue(routing, "callback")],
                ["interestOwner", "Customer shows high interest", recordValue(routing, "highInterest")],
                ["handoffOwner", "Customer asks for a person", recordValue(routing, "humanRequested")],
              ] as Array<[string, string, RecordValue]>).map(([name, label, rule]) => (
                <label key={name} className={LABEL}>{label}
                  <select name={name} defaultValue={textValue(rule, "assignToUserId", textValue(team[0], "id"))} className={INPUT}>
                    <option value="">Workspace admin (you)</option>
                    {team.map((member) => <option key={textValue(member, "id")} value={textValue(member, "id")}>{textValue(member, "displayName", textValue(member, "email", "Team member"))}{textValue(member, "email") ? ` · ${textValue(member, "email")}` : ""}</option>)}
                  </select>
                </label>
              ))}
              {team.length === 0 ? <p className="rounded-[4px] bg-[#F5F4ED] p-3 font-['Space_Grotesk'] text-[11px] text-[#565B5B]">No additional team members are registered. These rules will assign work to the workspace admin.</p> : null}
              <SectionLabel>02 / CALLBACK & RETRY BEHAVIOUR</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={LABEL}>Callback target time
                  <select name="callbackDelay" defaultValue={String(recordValue(routing, "callback").dueInMinutes ?? 30)} className={INPUT}>
                    <option value="15">Within 15 minutes</option>
                    <option value="30">Within 30 minutes</option>
                    <option value="60">Within 1 hour</option>
                    <option value="240">Within 4 hours</option>
                    <option value="1440">Within 1 day</option>
                  </select>
                </label>
                <label className={LABEL}>Retry after no answer
                  <select name="retryDelay" defaultValue={String(recordValue(routing, "noAnswer").retryAfterMinutes ?? 1440)} className={INPUT}>
                    <option value="60">1 hour</option>
                    <option value="240">4 hours</option>
                    <option value="1440">Next day</option>
                    <option value="2880">In 2 days</option>
                  </select>
                </label>
                <label className={LABEL}>Maximum retry attempts
                  <select name="maxRetries" defaultValue={String(recordValue(routing, "noAnswer").maxRetries ?? 2)} className={INPUT}>
                    <option value="0">No retries</option>
                    <option value="1">1 retry</option>
                    <option value="2">2 retries</option>
                    <option value="3">3 retries</option>
                    <option value="4">4 retries</option>
                    <option value="5">5 retries</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 self-end pb-2 font-['Space_Grotesk'] text-[12px] text-[#444748]">
                  <input name="retryEnabled" type="checkbox" defaultChecked={recordValue(routing, "noAnswer").enabled !== false} className="accent-[#7852D6]" /> Enable no-answer retries
                </label>
              </div>
              <SectionLabel>03 / WHEN MAY FOOLIOO CALL?</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className={LABEL}>Start time
                  <input name="callingHoursStart" type="time" required defaultValue={String(client.callingHoursStart ?? "09:00:00").slice(0, 5)} className={INPUT} />
                </label>
                <label className={LABEL}>End time
                  <input name="callingHoursEnd" type="time" required defaultValue={String(client.callingHoursEnd ?? "18:00:00").slice(0, 5)} className={INPUT} />
                </label>
                <label className={LABEL}>Timezone
                  <input name="timezone" required defaultValue={textValue(client, "timezone", "Asia/Kolkata")} className={INPUT} placeholder="Asia/Kolkata" />
                </label>
              </div>
              <FieldHint>These hours are stored on your workspace and should be enforced by the outbound queue worker.</FieldHint>
              {renderFooter("Save routing setup")}
            </form>
          ) : null}

          {action === "launch" ? (
            <form className="flex flex-col gap-4" onSubmit={async (event) => {
              event.preventDefault();
              if (!selectedCampaignId) { setError("Choose a saved campaign first."); return; }
              if (selectedContactIds.length === 0) { setError("Select at least one eligible contact."); return; }
              if (!launchConfirmed) { setError("Confirm that you have permission to contact this audience."); return; }
              await submit(() => launchCampaignAction(selectedCampaignId, selectedContactIds), "Campaign launched. The selected eligible contacts have been added to the outbound queue.");
            }}>
              <p className="font-['Space_Grotesk'] text-[12px] leading-5 text-[#565B5B]">Review the audience and campaign before outbound activity begins. Opted-out, invalid, duplicate and system test-call contacts are excluded by the backend.</p>
              <label className={LABEL}>Campaign to launch
                <select value={selectedCampaignId} onChange={(event) => setSelectedCampaignId(event.target.value)} className={INPUT}>
                  <option value="">Select a saved campaign</option>
                  {campaignRows.filter((campaign) => campaign.status === "draft" || campaign.status === "paused").map((campaign) => <option key={textValue(campaign, "id")} value={textValue(campaign, "id")}>{textValue(campaign, "name", "Untitled campaign")} · {textValue(campaign, "status")}</option>)}
                </select>
              </label>
              {data.knowledgeBase.state === "ready" && data.knowledgeBase.data.items.length === 0 ? <div className="rounded-[4px] border border-[#E9D9B9] bg-[#FFFBF2] px-3 py-2.5 font-['Space_Grotesk'] text-[11px] leading-5 text-[#725B34]">Your knowledge base is empty. The agent can use its business profile and campaign instructions, but it will not have approved FAQs or policy articles to reference. Add those under Knowledge & Voice before campaigns that need detailed answers.</div> : null}
              {data.knowledgeBase.state === "error" ? <div className="rounded-[4px] border border-[#F0D8D4] bg-[#FFF9F8] px-3 py-2.5 font-['Space_Grotesk'] text-[11px] leading-5 text-[#8D3028]">Knowledge-base status could not be checked. Review it before launching a campaign that requires approved factual answers.</div> : null}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18]">Choose your audience</p>
                  <p className="mt-0.5 font-['Space_Grotesk'] text-[11px] text-[#747878]">{availableContacts.length.toLocaleString("en-IN")} eligible contacts available{data.launchContacts.state === "ready" && data.launchContacts.data.total !== null ? ` of ${data.launchContacts.data.total.toLocaleString("en-IN")}` : ""}</p>
                </div>
                <button type="button" onClick={() => setSelectedContactIds(selectedContactIds.length === availableContacts.length ? [] : availableContacts.map((contact) => textValue(contact, "id")).filter(Boolean))} className="rounded-[4px] border border-[#DCDDD6] px-3 py-2 font-['Space_Grotesk'] text-[11px] font-medium text-[#444748] hover:bg-[#F5F4ED]">{selectedContactIds.length === availableContacts.length ? "Clear all" : "Select all eligible"}</button>
              </div>
              {data.launchContacts.state === "ready" && data.launchContacts.data.total !== null && data.launchContacts.data.total > availableContacts.length ? <p className="rounded-[4px] bg-[#F5F4ED] px-3 py-2 font-['Space_Grotesk'] text-[11px] leading-5 text-[#565B5B]">This selector shows the first 5,000 eligible contacts. Refine the audience before launching a larger list.</p> : null}
              {data.launchContacts.state === "error" ? <p className="rounded-[5px] border border-[#F0D8D4] bg-[#FFF9F8] p-3 font-['Space_Grotesk'] text-[11px] leading-5 text-[#8D3028]">Eligible contacts could not be loaded. Refresh the dashboard and try again.</p> : availableContacts.length > 0 ? (
                <div className="max-h-[220px] overflow-y-auto rounded-[5px] border border-[#E9E8E1]">
                  {availableContacts.map((contact) => {
                    const id = textValue(contact, "id");
                    return <label key={id} className="flex cursor-pointer items-center gap-3 border-b border-[#ECEBE5] px-3 py-2.5 last:border-0 hover:bg-[#FAF9F5]">
                      <input type="checkbox" checked={selectedContactIds.includes(id)} onChange={(event) => setSelectedContactIds((current) => event.target.checked ? [...current, id] : current.filter((value) => value !== id))} className="accent-[#7852D6]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-['Space_Grotesk'] text-[12px] font-medium text-[#1B1C18]">{textValue(contact, "fullName", textValue(contact, "companyName", "Unnamed contact"))}</span>
                        <span className="block truncate font-['Space_Grotesk'] text-[10px] text-[#747878]">{textValue(contact, "phoneNumber")}</span>
                      </span>
                    </label>;
                  })}
                </div>
              ) : (
                <div className="rounded-[5px] bg-[#F5F4ED] px-3 py-4 font-['Space_Grotesk'] text-[12px] leading-5 text-[#565B5B]">No eligible contacts are available. Import contacts and return here to launch the campaign.</div>
              )}
              <div className="rounded-[5px] border border-[#E9E8E1] bg-[#FAF9F5] p-3">
                <div className="flex items-center justify-between font-['Space_Grotesk'] text-[11px] text-[#565B5B]"><span>Selected audience</span><strong className="text-[#1B1C18]">{selectedContactIds.length}</strong></div>
                <div className="mt-1 flex items-center justify-between font-['Space_Grotesk'] text-[11px] text-[#565B5B]"><span>Daily call capacity remaining</span><strong className="text-[#1B1C18]">{Math.max(0, Number(client.maxCallsPerDay ?? 0) - Number(client.callsMadeToday ?? 0))}</strong></div>
                <p className="mt-2 font-['Space_Grotesk'] text-[10px] leading-4 text-[#85877F]">The backend rechecks workspace ownership, DNC status, duplicate status, credit availability and daily capacity at launch time.</p>
              </div>
              <label className="flex items-start gap-2 rounded-[4px] border border-[#E9E8E1] p-3 font-['Space_Grotesk'] text-[11px] leading-5 text-[#565B5B]">
                <input type="checkbox" checked={launchConfirmed} onChange={(event) => setLaunchConfirmed(event.target.checked)} className="mt-1 accent-[#7852D6]" />
                <span>I confirm this audience has the required permission to be contacted, and I approve adding these contacts to the outbound queue.</span>
              </label>
              {renderFooter("Confirm and launch campaign", !selectedCampaignId || selectedContactIds.length === 0 || !launchConfirmed)}
            </form>
          ) : null}

          {error ? <p className="mt-4 rounded-[4px] border border-[#F0D8D4] bg-[#FFF9F8] px-3 py-2 font-['Space_Grotesk'] text-[12px] leading-5 text-[#8D3028]" role="alert">{error}</p> : null}
          {success ? <p className="mt-4 rounded-[4px] border border-[#CDE4D2] bg-[#F5FBF6] px-3 py-2 font-['Space_Grotesk'] text-[12px] leading-5 text-[#25633A]" role="status">{success}</p> : null}
        </div>
      </section>
    </div>
  );
}
