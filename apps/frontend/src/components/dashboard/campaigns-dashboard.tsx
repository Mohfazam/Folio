"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createCampaignAction, getCampaignLiveStatsAction, getLaunchEligibleContactsAction, importContactsAction, launchCampaignAction, updateCampaignStatusAction } from "@/app/(dashboard)/dashboard/actions";
import { createContactAction } from "@/app/(dashboard)/dashboard/contacts/actions";

type CampaignStats = {
  totalCalls?: number;
  connectedCalls?: number;
  highInterestCalls?: number;
  pendingCalls?: number;
  inProgressCalls?: number;
  failedCalls?: number;
  completedQueueCalls?: number;
};

type Campaign = {
  id: string;
  name: string;
  type: string;
  status: string;
  primaryObjective: string;
  createdAt: string | null;
  stats: CampaignStats;
};

type Props = {
  initialCampaigns: Campaign[];
  initialError: string | null;
};

type LaunchContact = {
  id: string;
  fullName: string | null;
  phoneNumber: string;
};

type ContactEntryMode = "single" | "bulk" | null;

type StatusFilter = "all" | "draft" | "active" | "paused" | "completed";

type CampaignType =
  | "outreach_sales"
  | "follow_up"
  | "reminder"
  | "reactivation"
  | "feedback_survey"
  | "announcement";

const INPUT = "mt-1.5 h-11 w-full rounded-[6px] border border-[#DCDDD6] bg-white px-3.5 font-['Space_Grotesk'] text-[13px] text-[#1B1C18] outline-none transition-colors placeholder:text-[#A0A19A] focus:border-[#7852D6] focus:ring-2 focus:ring-[#7852D6]/10";
const TEXTAREA = "mt-1.5 w-full rounded-[6px] border border-[#DCDDD6] bg-white px-3.5 py-3 font-['Space_Grotesk'] text-[13px] leading-5 text-[#1B1C18] outline-none transition-colors placeholder:text-[#A0A19A] focus:border-[#7852D6] focus:ring-2 focus:ring-[#7852D6]/10";
const LABEL = "block font-['Space_Grotesk'] text-[12px] font-semibold text-[#444748]";

const STATUS_STYLES: Record<string, string> = {
  draft: "border-[#E5E1D5] bg-[#F7F5EF] text-[#696B62]",
  active: "border-[#CDE5D4] bg-[#EFF8F1] text-[#34734B]",
  paused: "border-[#F0DFB8] bg-[#FFFAEC] text-[#8A6826]",
  completed: "border-[#D9DDE7] bg-[#F2F4F8] text-[#59647C]",
};

const TYPE_LABELS: Record<string, string> = {
  outreach_sales: "New enquiries",
  follow_up: "Lead follow-up",
  reminder: "Reminder",
  reactivation: "Reactivation",
  feedback_survey: "Feedback survey",
  announcement: "Announcement",
};

function formatNumber(value: number | undefined) {
  return new Intl.NumberFormat("en-IN").format(value ?? 0);
}

function formatDate(value: string | null) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[8px] border border-[#ECEBE5] bg-[#FFFEFB] px-4 py-4 sm:px-5">
      <p className="font-['Space_Grotesk'] text-[11px] font-medium text-[#747878]">{label}</p>
      <p className="mt-2 font-['Newsreader'] text-[30px] leading-none tracking-[-0.5px] text-[#1B1C18]">{value}</p>
      <p className="mt-2 font-['Space_Grotesk'] text-[10px] text-[#92938C]">{detail}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 font-['Space_Grotesk'] text-[10px] font-semibold capitalize ${STATUS_STYLES[normalized] ?? STATUS_STYLES.draft}`}>
      {normalized || "draft"}
    </span>
  );
}

function FormSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-[8px] border border-[#ECEBE5] bg-white p-4 sm:p-5">
      <div className="mb-5 border-b border-[#F0EFE9] pb-4">
        <h2 className="font-['Space_Grotesk'] text-[14px] font-semibold text-[#1B1C18]">{title}</h2>
        <p className="mt-1 font-['Space_Grotesk'] text-[11px] leading-5 text-[#85877F]">{description}</p>
      </div>
      {children}
    </section>
  );
}

function CampaignForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    const form = new FormData(event.currentTarget);
    const keyTalkingPoints = String(form.get("keyTalkingPoints") ?? "")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    if (keyTalkingPoints.length === 0) {
      setError("Add at least one talking point for the voice agent.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const result = await createCampaignAction({
        name: String(form.get("name") ?? "").trim(),
        type: String(form.get("type") ?? "outreach_sales") as CampaignType,
        primaryObjective: String(form.get("primaryObjective") ?? "").trim(),
        callOpeningHook: String(form.get("callOpeningHook") ?? "").trim(),
        keyTalkingPoints:
          String(form.get("language") ?? "auto") === "auto"
            ? [
                "At the beginning of the call, ask the customer which language they would prefer to speak. Offer English, Hindi, Telugu, Tamil, Kannada, and Malayalam. Continue the conversation in the language they choose. Do not assume their preferred language.",
                ...keyTalkingPoints,
              ]
            : keyTalkingPoints,
        objectionHandlers: [],
        callToAction: String(form.get("callToAction") ?? "").trim(),
        fallbackOffer: String(form.get("fallbackOffer") ?? "").trim() || undefined,
        targetAudience: String(form.get("targetAudience") ?? "").trim() || undefined,
        language: String(form.get("language") ?? "auto"),
        maxDurationSeconds: Number(form.get("maxDurationSeconds") ?? 300),
      });

      if (!result.ok) {
        setError(result.error || "Your campaign draft could not be saved.");
        return;
      }

      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your campaign draft could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[920px]">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <button type="button" onClick={onCancel} className="mb-3 inline-flex items-center gap-2 font-['Space_Grotesk'] text-[11px] font-semibold text-[#7852D6] hover:text-[#6040B4]">
            <span aria-hidden="true">←</span> Back to campaigns
          </button>
          <p className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.12em] text-[#9A8ABF]">Campaign builder</p>
          <h1 className="mt-1 font-['Newsreader'] text-[34px] leading-tight tracking-[-0.8px] text-[#1B1C18] sm:text-[40px]">Create a campaign</h1>
          <p className="mt-2 max-w-[620px] font-['Space_Grotesk'] text-[12px] leading-5 text-[#747878]">Set the goal and conversation outline. Your campaign is saved as a draft. No contacts are called until you review and confirm a launch.</p>
        </div>
        <span className="rounded-full border border-[#E8E3F2] bg-[#F7F4FC] px-3 py-1.5 font-['Space_Grotesk'] text-[10px] font-semibold text-[#705AA8]">DRAFT FIRST</span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormSection title="Campaign basics" description="Give this campaign a clear name and choose what it is meant to do.">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={LABEL}>Campaign name
              <input name="name" required maxLength={120} className={INPUT} placeholder="e.g. New enquiries follow-up" />
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
          <label className={`${LABEL} mt-4`}>What should this campaign achieve?
            <textarea name="primaryObjective" required rows={3} maxLength={2000} className={TEXTAREA} placeholder="Describe the result you want from these conversations." />
          </label>
          <label className={`${LABEL} mt-4`}>Who is this campaign for? <span className="font-normal text-[#92938C]">Optional</span>
            <input name="targetAudience" className={INPUT} placeholder="e.g. People who enquired about the admissions process this month" />
          </label>
        </FormSection>

        <FormSection title="Conversation plan" description="Give the agent a clear opening, useful talking points and one next step.">
          <label className={LABEL}>How should the call begin?
            <textarea name="callOpeningHook" required rows={3} maxLength={2000} className={TEXTAREA} placeholder="Write a clear, natural opening for the agent." />
          </label>
          <label className={`${LABEL} mt-4`}>What should the agent cover? <span className="font-normal text-[#92938C]">One point per line</span>
            <textarea name="keyTalkingPoints" required rows={5} maxLength={4000} className={TEXTAREA} placeholder={'Introduce the reason for the call.\nAnswer common questions using approved information.\nAsk whether the customer would like the next step.'} />
          </label>
          <label className={`${LABEL} mt-4`}>What should the customer do next?
            <input name="callToAction" required maxLength={500} className={INPUT} placeholder="e.g. Book a consultation" />
          </label>
          <label className={`${LABEL} mt-4`}>If the customer is not ready <span className="font-normal text-[#92938C]">Optional</span>
            <input name="fallbackOffer" maxLength={500} className={INPUT} placeholder="e.g. Offer to send more information by email" />
          </label>
        </FormSection>

        <FormSection title="Call settings" description="Choose how the agent handles language preferences and set the maximum duration for each call.">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={LABEL}>Language preference
              <select name="language" defaultValue="auto" className={INPUT}>
                <option value="auto">Ask customer (Recommended)</option>
                <option value="en-IN">English (India)</option>
                <option value="hi-IN">Hindi</option>
                <option value="te-IN">Telugu</option>
                <option value="ta-IN">Tamil</option>
                <option value="kn-IN">Kannada</option>
                <option value="ml-IN">Malayalam</option>
              </select>
              <span className="mt-2 block font-['Space_Grotesk'] text-[10px] font-normal leading-4 text-[#85877F]">
                Ask customer lets the agent ask which supported language they prefer, then continue the conversation in that language.
              </span>
            </label>
            <label className={LABEL}>Maximum call duration
              <select name="maxDurationSeconds" defaultValue="300" className={INPUT}>
                <option value="120">2 minutes</option>
                <option value="180">3 minutes</option>
                <option value="300">5 minutes</option>
                <option value="480">8 minutes</option>
                <option value="600">10 minutes</option>
                <option value="900">15 minutes</option>
              </select>
            </label>
          </div>
        </FormSection>

        {error ? <div role="alert" className="rounded-[6px] border border-[#F0D8D4] bg-[#FFF8F7] px-4 py-3 font-['Space_Grotesk'] text-[12px] leading-5 text-[#A33A32]">{error}</div> : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ECEBE5] pt-4">
          <p className="max-w-[500px] font-['Space_Grotesk'] text-[10px] leading-4 text-[#85877F]">Saving creates a draft only. You can review the audience and approve outbound activity separately.</p>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} disabled={busy} className="rounded-[5px] border border-[#DCDDD6] bg-white px-4 py-2.5 font-['Space_Grotesk'] text-[12px] font-semibold text-[#444748] hover:bg-[#F7F6F1] disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={busy} className="rounded-[5px] bg-[#1B1C18] px-5 py-2.5 font-['Space_Grotesk'] text-[12px] font-semibold text-white transition-colors hover:bg-[#34352F] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Saving draft…" : "Save campaign draft"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

type LiveCampaignSnapshot = {
  status: string;
  stats: CampaignStats;
};

export function CampaignsDashboard({ initialCampaigns, initialError }: Props) {
  const router = useRouter();
  const [liveCampaigns, setLiveCampaigns] = useState<Record<string, LiveCampaignSnapshot>>({});
  const liveStatsRequestInFlight = useRef(false);

  // Merge changing counters into the server-rendered campaign records without
  // refreshing the full Next.js route.
  const campaigns = useMemo(
    () => initialCampaigns.map((campaign) => {
      const live = liveCampaigns[campaign.id];
      return live
        ? { ...campaign, status: live.status, stats: live.stats }
        : campaign;
    }),
    [initialCampaigns, liveCampaigns],
  );
  const hasActiveCampaigns = campaigns.some((campaign) => campaign.status === "active");

  // A server refresh after a user mutation is authoritative. Drop old live
  // snapshots so they cannot overwrite freshly returned campaign statuses.
  useEffect(() => {
    setLiveCampaigns({});
  }, [initialCampaigns]);

  useEffect(() => {
    if (!hasActiveCampaigns) return;

    let disposed = false;

    const refreshLiveStats = async () => {
      if (disposed || document.visibilityState !== "visible" || liveStatsRequestInFlight.current) return;

      liveStatsRequestInFlight.current = true;
      try {
        const result = await getCampaignLiveStatsAction();
        if (!disposed && result.ok && Array.isArray(result.data?.campaigns)) {
          const next: Record<string, LiveCampaignSnapshot> = {};

          for (const value of result.data.campaigns) {
            if (!value || typeof value !== "object") continue;
            const row = value as Record<string, unknown>;
            if (typeof row.id !== "string") continue;

            const rawStats = row.stats && typeof row.stats === "object"
              ? row.stats as Record<string, unknown>
              : {};
            const toCount = (value: unknown) =>
              typeof value === "number" && Number.isFinite(value) ? value : 0;

            next[row.id] = {
              status: typeof row.status === "string" ? row.status : "draft",
              stats: {
                totalCalls: toCount(rawStats.totalCalls),
                connectedCalls: toCount(rawStats.connectedCalls),
                highInterestCalls: toCount(rawStats.highInterestCalls),
                pendingCalls: toCount(rawStats.pendingCalls),
                inProgressCalls: toCount(rawStats.inProgressCalls),
                failedCalls: toCount(rawStats.failedCalls),
                completedQueueCalls: toCount(rawStats.completedQueueCalls),
              },
            };
          }

          setLiveCampaigns(next);
        }
      } catch (error) {
        console.error("[campaigns] Live statistics refresh failed:", error);
      } finally {
        liveStatsRequestInFlight.current = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshLiveStats();
    };

    // Fetch once immediately, then poll every 15 seconds while active.
    void refreshLiveStats();
    const timer = window.setInterval(() => void refreshLiveStats(), 15000);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [hasActiveCampaigns]);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [launchingCampaign, setLaunchingCampaign] = useState<Campaign | null>(null);
  const [eligibleContacts, setEligibleContacts] = useState<LaunchContact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [loadingAudience, setLoadingAudience] = useState(false);
  const [launchBusy, setLaunchBusy] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [contactEntryMode, setContactEntryMode] = useState<ContactEntryMode>(null);
  const [contactBusy, setContactBusy] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactNotice, setContactNotice] = useState<string | null>(null);
  const [contactFile, setContactFile] = useState<File | null>(null);
  const [contactPermissionConfirmed, setContactPermissionConfirmed] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [dailyStart, setDailyStart] = useState("09:00");
  const [dailyEnd, setDailyEnd] = useState("18:00");

  const refreshEligibleContacts = async (selectNewContacts = false): Promise<LaunchContact[]> => {
    const previousIds = new Set(eligibleContacts.map((contact) => contact.id));
    const result = await getLaunchEligibleContactsAction();
    if (!result.ok) {
      throw new Error(result.error || "Eligible contacts could not be refreshed.");
    }

    const rows = Array.isArray(result.data?.contacts) ? result.data.contacts : [];
    const parsed: LaunchContact[] = rows.flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const item = row as Record<string, unknown>;
      if (typeof item.id !== "string" || typeof item.phoneNumber !== "string") return [];
      return [{
        id: item.id,
        phoneNumber: item.phoneNumber,
        fullName: typeof item.fullName === "string" ? item.fullName : null,
      }];
    });

    setEligibleContacts(parsed);
    const newlyEligible = parsed.filter((contact) => !previousIds.has(contact.id));
    if (selectNewContacts && newlyEligible.length > 0) {
      setSelectedContactIds((current) => Array.from(new Set([...current, ...newlyEligible.map((contact) => contact.id)])));
    }
    return newlyEligible;
  };

  const openLaunch = async (campaign: Campaign) => {
    setLaunchingCampaign(campaign);
    setStartDate("");
    setLaunchError(null);
    setContactEntryMode(null);
    setContactError(null);
    setContactNotice(null);
    setContactFile(null);
    setContactPermissionConfirmed(false);
    setLoadingAudience(true);
    setSelectedContactIds([]);
    try {
      await refreshEligibleContacts(false);
    } catch (error) {
      setLaunchError(error instanceof Error ? error.message : "Eligible contacts could not be loaded.");
    } finally {
      setLoadingAudience(false);
    }
  };

  const handleAddSingleContact = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (contactBusy) return;
    if (!contactPermissionConfirmed) {
      setContactError("Confirm that you have permission to contact this person.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const fullName = String(form.get("fullName") ?? "").trim();
    const phoneNumber = String(form.get("phoneNumber") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    if (!phoneNumber) {
      setContactError("Enter a phone number.");
      return;
    }

    setContactBusy(true);
    setContactError(null);
    setContactNotice(null);
    try {
      const result = await createContactAction({ fullName, phoneNumber, email });
      if (!result.ok) {
        setContactError(result.error || "The contact could not be added.");
        return;
      }

      setContactEntryMode(null);
      setContactPermissionConfirmed(false);
      try {
        const newlyEligible = await refreshEligibleContacts(true);
        if (newlyEligible.length > 0) {
          setContactNotice(`${newlyEligible.length} contact added and selected for this campaign.`);
        } else {
          setContactError("The contact was submitted, but it was not added to the eligible audience. It may already exist or have an invalid phone number.");
        }
      } catch {
        setContactNotice("Contact saved. Close and reopen the launch window to refresh the eligible audience.");
      }
    } catch (error) {
      setContactError(error instanceof Error ? error.message : "The contact could not be added.");
    } finally {
      setContactBusy(false);
    }
  };

  const handleBulkContactImport = async () => {
    if (!contactFile || !contactPermissionConfirmed || contactBusy) return;
    if (contactFile.size > 5 * 1024 * 1024) {
      setContactError("The selected file exceeds the 5 MB upload limit.");
      return;
    }
    const extension = contactFile.name.toLowerCase().split(".").pop();
    if (extension !== "csv" && extension !== "xlsx") {
      setContactError("Use a CSV or XLSX file. XLS files are not supported.");
      return;
    }

    setContactBusy(true);
    setContactError(null);
    setContactNotice(null);
    try {
      const result = await importContactsAction(contactFile);
      if (!result.ok) {
        setContactError(result.error || "The contact list could not be imported.");
        return;
      }

      const data = result.data ?? {};
      const inserted = typeof data.inserted === "number" ? data.inserted : 0;
      const duplicates = typeof data.duplicates === "number" ? data.duplicates : 0;
      const failed = typeof data.failed === "number" ? data.failed : 0;
      setContactEntryMode(null);
      setContactFile(null);
      setContactPermissionConfirmed(false);
      try {
        const newlyEligible = await refreshEligibleContacts(true);
        setContactNotice(`Import complete: ${inserted} added, ${duplicates} duplicates, ${failed} rejected. ${newlyEligible.length} new eligible contacts selected.`);
      } catch {
        setContactNotice(`Import complete: ${inserted} added, ${duplicates} duplicates, ${failed} rejected. Close and reopen the launch window to refresh the eligible audience.`);
      }
    } catch (error) {
      setContactError(error instanceof Error ? error.message : "The contact list could not be imported.");
    } finally {
      setContactBusy(false);
    }
  };

  const submitLaunch = async () => {
    if (!launchingCampaign || !selectedContactIds.length || launchBusy) return;
    if (dailyStart >= dailyEnd) {
      setLaunchError("The daily calling end time must be later than the start time.");
      return;
    }
    // When a launch date is selected, the campaign becomes eligible to start
    // at the beginning of its daily calling window. No separate launch-time
    // field is needed because Daily calls start already defines that time.
    const scheduled = startDate
      ? new Date(`${startDate}T${dailyStart}:00`)
      : new Date();

    if (Number.isNaN(scheduled.getTime()) || (startDate && scheduled.getTime() < Date.now() - 60_000)) {
      setLaunchError("Choose a future launch date, or leave it empty to start as soon as possible.");
      return;
    }
    setLaunchBusy(true);
    setLaunchError(null);
    const result = await launchCampaignAction(launchingCampaign.id, selectedContactIds, {
      startAt: scheduled.toISOString(), dailyStart, dailyEnd,
    });
    setLaunchBusy(false);
    if (!result.ok) {
      setLaunchError(result.error);
      return;
    }
    setNotice(`Campaign queued for ${selectedContactIds.length} contacts. Calls will run only during ${dailyStart}–${dailyEnd} workspace time.`);
    setLaunchingCampaign(null);
    router.refresh();
  };

  const changeCampaignStatus = async (campaign: Campaign, status: "active" | "paused") => {
    const result = await updateCampaignStatusAction(campaign.id, status);
    if (!result.ok) {
      setNotice(`Could not ${status === "paused" ? "pause" : "resume"} campaign: ${result.error}`);
      return;
    }
    setNotice(status === "paused" ? "Campaign paused. No new calls will start until you resume it." : "Campaign resumed. Pending calls will continue inside the configured calling windows.");
    router.refresh();
  };

  const filteredCampaigns = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return campaigns.filter((campaign) => {
      const matchesStatus = statusFilter === "all" || campaign.status.toLowerCase() === statusFilter;
      const matchesQuery = !normalizedQuery || `${campaign.name} ${campaign.primaryObjective} ${TYPE_LABELS[campaign.type] ?? campaign.type}`.toLowerCase().includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });
  }, [campaigns, query, statusFilter]);

  const activeCount = campaigns.filter((campaign) => campaign.status === "active").length;
  const draftCount = campaigns.filter((campaign) => campaign.status === "draft").length;
  const totalCalls = campaigns.reduce((sum, campaign) => sum + (campaign.stats.totalCalls ?? 0), 0);

  const handleCreated = () => {
    setCreating(false);
    setNotice("Campaign draft saved. Review your audience before launching outbound calls.");
    router.refresh();
  };

  if (creating) {
    return <CampaignForm onCancel={() => setCreating(false)} onCreated={handleCreated} />;
  }

  return (
    <div className="space-y-6">
      {launchingCampaign ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#171812]/45 p-4" role="dialog" aria-modal="true" aria-labelledby="launch-campaign-title">
          <div className="max-h-[90vh] w-full max-w-[760px] overflow-y-auto rounded-[10px] border border-[#ECEBE5] bg-[#FFFEFB] p-5 shadow-xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div><p className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.12em] text-[#9A8ABF]">Outbound campaign</p><h2 id="launch-campaign-title" className="mt-1 font-['Newsreader'] text-[30px] text-[#1B1C18]">Launch {launchingCampaign.name}</h2><p className="mt-1 text-[12px] leading-5 text-[#747878]">Choose who to call and when the agent is allowed to place calls.</p></div>
              <button type="button" onClick={() => setLaunchingCampaign(null)} className="rounded border border-[#E5E4DC] px-3 py-1.5 text-[12px]">Close</button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <label className={LABEL}>
                Start date
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={INPUT}
                />
                <span className="mt-1 block text-[10px] font-normal text-[#92938C]">Choose the launch date.</span>
              </label>
              <label className={LABEL}>
                Daily calls start
                <input
                  type="time"
                  value={dailyStart}
                  onChange={(e) => setDailyStart(e.target.value)}
                  className={INPUT}
                />
              </label>
              <label className={LABEL}>
                Daily calls end
                <input
                  type="time"
                  value={dailyEnd}
                  onChange={(e) => setDailyEnd(e.target.value)}
                  className={INPUT}
                />
              </label>
            </div>
            <p className="mt-2 font-['Space_Grotesk'] text-[10px] leading-4 text-[#92938C]">
              Leave the start date empty to launch as soon as possible. On the selected date, calls can begin at your daily calls start time.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[7px] border border-[#ECEBE5] bg-white px-4 py-3">
              <div>
                <p className="text-[12px] font-semibold text-[#1B1C18]">Need to add contacts?</p>
                <p className="text-[10px] text-[#85877F]">Add one person manually or upload a CSV / Excel list without leaving this window.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { setContactEntryMode(contactEntryMode === "single" ? null : "single"); setContactError(null); setContactNotice(null); setContactPermissionConfirmed(false); setContactFile(null); }} className="rounded-[5px] border border-[#DCDDD6] bg-white px-3 py-2 font-['Space_Grotesk'] text-[10px] font-semibold text-[#444748] hover:bg-[#F7F6F1]">+ Add one contact</button>
                <button type="button" onClick={() => { setContactEntryMode(contactEntryMode === "bulk" ? null : "bulk"); setContactError(null); setContactNotice(null); setContactPermissionConfirmed(false); setContactFile(null); }} className="rounded-[5px] bg-[#1B1C18] px-3 py-2 font-['Space_Grotesk'] text-[10px] font-semibold text-white hover:bg-[#34352F]">↑ Upload contacts</button>
              </div>
            </div>

            {contactEntryMode === "single" ? (
              <form onSubmit={handleAddSingleContact} className="mt-3 rounded-[7px] border border-[#DCD5ED] bg-[#FCFBFF] p-4">
                <div className="mb-3">
                  <p className="font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18]">Add an individual contact</p>
                  <p className="mt-1 font-['Space_Grotesk'] text-[10px] leading-4 text-[#747878]">The person will be added to your workspace and selected for this campaign if eligible.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className={LABEL}>Name <span className="font-normal text-[#92938C]">Optional</span><input name="fullName" maxLength={160} className={INPUT} placeholder="Full name" /></label>
                  <label className={LABEL}>Phone number<input name="phoneNumber" type="tel" required className={INPUT} placeholder="+91 98765 43210" /></label>
                  <label className={LABEL}>Email <span className="font-normal text-[#92938C]">Optional</span><input name="email" type="email" className={INPUT} placeholder="name@example.com" /></label>
                </div>
                <label className="mt-3 flex items-start gap-2 rounded-[5px] border border-[#E9E8E1] bg-white p-3 font-['Space_Grotesk'] text-[10px] leading-5 text-[#565B5B]">
                  <input type="checkbox" checked={contactPermissionConfirmed} onChange={(event) => setContactPermissionConfirmed(event.target.checked)} className="mt-1 accent-[#7852D6]" />
                  <span>I confirm that this person has given permission to be contacted and has not opted out.</span>
                </label>
                {contactError ? <p role="alert" className="mt-3 rounded border border-[#F0D8D4] bg-[#FFF8F7] px-3 py-2 text-[10px] leading-4 text-[#A33A32]">{contactError}</p> : null}
                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" disabled={contactBusy} onClick={() => { setContactEntryMode(null); setContactError(null); setContactPermissionConfirmed(false); }} className="rounded-[5px] border border-[#DCDDD6] bg-white px-3 py-2 text-[10px] font-semibold text-[#444748] disabled:opacity-50">Cancel</button>
                  <button type="submit" disabled={contactBusy || !contactPermissionConfirmed} className="rounded-[5px] bg-[#1B1C18] px-4 py-2 text-[10px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{contactBusy ? "Adding…" : "Add and select contact"}</button>
                </div>
              </form>
            ) : null}

            {contactEntryMode === "bulk" ? (
              <div className="mt-3 rounded-[7px] border border-[#DCD5ED] bg-[#FCFBFF] p-4">
                <div className="mb-3">
                  <p className="font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18]">Upload a contact list</p>
                  <p className="mt-1 font-['Space_Grotesk'] text-[10px] leading-4 text-[#747878]">CSV or XLSX, maximum 5 MB and 500 contact rows. The required column is phoneNumber.</p>
                </div>
                <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-[6px] border border-dashed border-[#CFCFC7] bg-white px-4 py-5 text-center hover:border-[#7852D6]">
                  <span className="font-['Space_Grotesk'] text-[11px] font-semibold text-[#1B1C18]">{contactFile ? contactFile.name : "Choose CSV or Excel file"}</span>
                  <span className="font-['Space_Grotesk'] text-[10px] text-[#85877F]">phoneNumber is required. fullName and email are optional.</span>
                  <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(event) => { setContactFile(event.target.files?.[0] ?? null); setContactError(null); setContactPermissionConfirmed(false); }} />
                </label>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <a href="/contact-import-template.csv" download className="font-['Space_Grotesk'] text-[10px] font-semibold text-[#644ABB] underline underline-offset-2">Download CSV template</a>
                  {contactFile ? <button type="button" onClick={() => { setContactFile(null); setContactPermissionConfirmed(false); }} className="font-['Space_Grotesk'] text-[10px] font-semibold text-[#A33A32]">Remove file</button> : null}
                </div>
                <label className="mt-3 flex items-start gap-2 rounded-[5px] border border-[#E9E8E1] bg-white p-3 font-['Space_Grotesk'] text-[10px] leading-5 text-[#565B5B]">
                  <input type="checkbox" checked={contactPermissionConfirmed} onChange={(event) => setContactPermissionConfirmed(event.target.checked)} className="mt-1 accent-[#7852D6]" />
                  <span>I confirm that I have permission to contact the people in this file and that opt-out requests are represented correctly.</span>
                </label>
                {contactError ? <p role="alert" className="mt-3 rounded border border-[#F0D8D4] bg-[#FFF8F7] px-3 py-2 text-[10px] leading-4 text-[#A33A32]">{contactError}</p> : null}
                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" disabled={contactBusy} onClick={() => { setContactEntryMode(null); setContactError(null); setContactFile(null); setContactPermissionConfirmed(false); }} className="rounded-[5px] border border-[#DCDDD6] bg-white px-3 py-2 text-[10px] font-semibold text-[#444748] disabled:opacity-50">Cancel</button>
                  <button type="button" disabled={!contactFile || !contactPermissionConfirmed || contactBusy} onClick={handleBulkContactImport} className="rounded-[5px] bg-[#1B1C18] px-4 py-2 text-[10px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{contactBusy ? "Importing…" : "Import and select contacts"}</button>
                </div>
              </div>
            ) : null}

            {contactNotice ? <p role="status" className="mt-3 rounded border border-[#D7E8DA] bg-[#F1F8F2] px-3 py-2.5 font-['Space_Grotesk'] text-[10px] leading-4 text-[#397A55]">{contactNotice}</p> : null}

            <div className="mt-3 rounded-[7px] border border-[#ECEBE5] bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-[#ECEBE5] px-4 py-3"><div><p className="text-[12px] font-semibold text-[#1B1C18]">Eligible contacts</p><p className="text-[10px] text-[#85877F]">Select the audience for this campaign.</p></div><button type="button" disabled={!eligibleContacts.length} onClick={() => setSelectedContactIds(selectedContactIds.length === eligibleContacts.length ? [] : eligibleContacts.map((c) => c.id))} className="text-[11px] font-semibold text-[#7852D6]">{selectedContactIds.length === eligibleContacts.length && eligibleContacts.length ? "Clear all" : "Select all"}</button></div>
              <div className="max-h-[230px] overflow-y-auto">
                {loadingAudience ? <p className="px-4 py-8 text-center text-[12px] text-[#85877F]">Loading eligible contacts…</p> : eligibleContacts.length ? eligibleContacts.map((contact) => <label key={contact.id} className="flex cursor-pointer items-center gap-3 border-b border-[#F0EFE9] px-4 py-3 last:border-0"><input type="checkbox" checked={selectedContactIds.includes(contact.id)} onChange={(e) => setSelectedContactIds((current) => e.target.checked ? [...current, contact.id] : current.filter((id) => id !== contact.id))} className="h-4 w-4 accent-[#7852D6]" /><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-medium text-[#1B1C18]">{contact.fullName || "Unnamed contact"}</span><span className="block text-[10px] text-[#85877F]">{contact.phoneNumber}</span></span></label>) : <p className="px-4 py-8 text-center text-[12px] text-[#85877F]">{launchError || "No eligible contacts found. Import contacts or remove opt-out and invalid statuses."}</p>}
              </div>
              <div className="border-t border-[#ECEBE5] px-4 py-2 text-[10px] text-[#85877F]">{selectedContactIds.length} of {eligibleContacts.length} selected</div>
            </div>
            {launchError ? (
              <div role="alert" className="mt-4 flex flex-col gap-2 rounded border border-[#F0D8D4] bg-[#FFF8F7] px-3.5 py-3">
                <p className="text-[11px] leading-5 text-[#A33A32]">{launchError}</p>
                {launchError.toLowerCase().includes("follow-up and team-handling rules") || launchError.toLowerCase().includes("routing rules") ? (
                  <div className="rounded-[5px] border border-[#E9E1D4] bg-white p-3">
                    <p className="mb-2 text-[10px] leading-5 text-[#747878]">Before launching, choose who receives callback requests, who handles requests to speak to a person, and whether unanswered calls should be retried. You can configure these rules in workspace setup.</p>
                    <button
                      type="button"
                      onClick={() => router.push("/dashboard?setup=routing")}
                      className="inline-flex items-center gap-1 rounded bg-[#7852D6] px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-[#644ABB]"
                    >
                      Configure call handling →
                    </button>
                  </div>
                ) : null}
                {launchError.includes("AI agent") ? (
                  <div>
                    <button
                      type="button"
                      onClick={() => router.push("/dashboard/ai-studio")}
                      className="inline-flex items-center gap-1 rounded bg-[#7852D6] px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-[#644ABB]"
                    >
                      Configure AI agent →
                    </button>
                  </div>
                ) : null}
                {launchError.includes("test call") ? (
                  <div>
                    <button
                      type="button"
                      onClick={() => router.push("/dashboard?setup=test-call")}
                      className="inline-flex items-center gap-1 rounded bg-[#7852D6] px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-[#644ABB]"
                    >
                      Place a test call →
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#ECEBE5] pt-4"><p className="max-w-[380px] text-[10px] leading-4 text-[#85877F]">Calls also obey workspace calling hours, available credits, daily limits and contact opt-outs.</p><button type="button" disabled={launchBusy || loadingAudience || !selectedContactIds.length} onClick={submitLaunch} className="rounded-[5px] bg-[#1B1C18] px-5 py-2.5 text-[12px] font-semibold text-white disabled:opacity-50">{launchBusy ? "Queuing campaign…" : startDate ? "Schedule campaign" : "Start campaign now"}</button></div>
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.12em] text-[#9A8ABF]">Workspace / Outbound</p>
          <h1 className="mt-1 font-['Newsreader'] text-[36px] leading-tight tracking-[-0.8px] text-[#1B1C18] sm:text-[42px]">Campaigns</h1>
          <p className="mt-2 max-w-[620px] font-['Space_Grotesk'] text-[12px] leading-5 text-[#747878]">Plan voice outreach, prepare your agent's conversation and track campaign activity from one place.</p>
        </div>
        <button type="button" onClick={() => { setNotice(null); setCreating(true); }} className="inline-flex h-10 items-center gap-2 rounded-[5px] bg-[#1B1C18] px-4 font-['Space_Grotesk'] text-[12px] font-semibold text-white transition-colors hover:bg-[#34352F]">
          <span className="text-[17px] leading-none" aria-hidden="true">+</span> New campaign
        </button>
      </div>

      {notice ? (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-[#D7E8DA] bg-[#F1F8F2] px-4 py-3 font-['Space_Grotesk'] text-[12px] text-[#397A55]">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="font-semibold text-[#397A55]">Dismiss</button>
        </div>
      ) : null}

      {initialError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-[#F0D8D4] bg-[#FFF8F7] px-4 py-3">
          <p className="font-['Space_Grotesk'] text-[12px] leading-5 text-[#A33A32]">Campaigns could not be loaded: {initialError}</p>
          <button type="button" onClick={() => router.refresh()} className="rounded-[4px] border border-[#E5C7C3] bg-white px-3 py-2 font-['Space_Grotesk'] text-[11px] font-semibold text-[#8D3028]">Try again</button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total campaigns" value={formatNumber(campaigns.length)} detail="Saved in this workspace" />
        <MetricCard label="Active campaigns" value={formatNumber(activeCount)} detail="Currently running" />
        <MetricCard label="Draft campaigns" value={formatNumber(draftCount)} detail="Ready for review" />
        <MetricCard label="Calls placed" value={formatNumber(totalCalls)} detail="Across all campaigns" />
      </div>

      <section className="overflow-hidden rounded-[8px] border border-[#ECEBE5] bg-white">
        <div className="flex flex-col gap-4 border-b border-[#ECEBE5] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-['Space_Grotesk'] text-[14px] font-semibold text-[#1B1C18]">All campaigns</h2>
            <p className="mt-1 font-['Space_Grotesk'] text-[11px] text-[#85877F]">Review campaign status and conversation performance.</p>
          </div>
          <label className="relative block w-full lg:max-w-[280px]">
            <span className="sr-only">Search campaigns</span>
            <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#92938C]" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" strokeLinecap="round" /></svg>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search campaigns" className="h-10 w-full rounded-[5px] border border-[#E5E4DC] bg-[#FFFEFB] pl-9 pr-3 font-['Space_Grotesk'] text-[12px] text-[#1B1C18] outline-none focus:border-[#7852D6]" />
          </label>
        </div>

        <div className="flex flex-wrap gap-1.5 border-b border-[#ECEBE5] px-4 py-3 sm:px-5">
          {(["all", "draft", "active", "paused", "completed"] as StatusFilter[]).map((status) => (
            <button key={status} type="button" onClick={() => setStatusFilter(status)} className={`rounded-full px-3 py-1.5 font-['Space_Grotesk'] text-[10px] font-semibold capitalize transition-colors ${statusFilter === status ? "bg-[#E7DEFF] text-[#4C30A2]" : "text-[#747878] hover:bg-[#F5F4ED]"}`}>
              {status === "all" ? "All statuses" : status}
            </button>
          ))}
          <span className="ml-auto self-center font-['Space_Grotesk'] text-[10px] text-[#92938C]">{filteredCampaigns.length} {filteredCampaigns.length === 1 ? "campaign" : "campaigns"}</span>
        </div>

        {filteredCampaigns.length > 0 ? (
          <div className="divide-y divide-[#F0EFE9]">
            {filteredCampaigns.map((campaign) => {
              const stats = campaign.stats;
              return (
                <article
                  key={campaign.id}
                  className="grid gap-4 px-4 py-4 transition-colors hover:bg-[#FFFEFB] sm:px-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(130px,0.7fr)_minmax(180px,0.9fr)] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="truncate font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">
                        {campaign.name}
                      </h3>
                      <StatusBadge status={campaign.status} />
                    </div>
                    <p className="mt-1.5 line-clamp-2 max-w-[620px] font-['Space_Grotesk'] text-[11px] leading-5 text-[#747878]">
                      {campaign.primaryObjective || "No campaign objective added."}
                    </p>
                    <p className="mt-2 font-['Space_Grotesk'] text-[10px] text-[#92938C]">
                      {TYPE_LABELS[campaign.type] ?? campaign.type.replaceAll("_", " ")} · Created{" "}
                      {formatDate(campaign.createdAt)}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 lg:grid-cols-1 lg:gap-1">
                    <div>
                      <p className="font-['Newsreader'] text-[19px] leading-none text-[#1B1C18]">
                        {formatNumber(stats.totalCalls)}
                      </p>
                      <p className="mt-1 font-['Space_Grotesk'] text-[9px] text-[#92938C]">Calls</p>
                    </div>
                    <div>
                      <p className="font-['Newsreader'] text-[19px] leading-none text-[#1B1C18]">
                        {formatNumber(stats.connectedCalls)}
                      </p>
                      <p className="mt-1 font-['Space_Grotesk'] text-[9px] text-[#92938C]">
                        Connected
                      </p>
                    </div>
                    <div>
                      <p className="font-['Newsreader'] text-[19px] leading-none text-[#1B1C18]">
                        {formatNumber(stats.highInterestCalls)}
                      </p>
                      <p className="mt-1 font-['Space_Grotesk'] text-[9px] text-[#92938C]">
                        High intent
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#747878] lg:col-span-3 lg:pl-0">
                    <span>
                      <strong className="text-[#1B1C18]">
                        {formatNumber(stats.inProgressCalls)}
                      </strong>{" "}
                      currently calling
                    </span>
                    <span>
                      <strong className="text-[#1B1C18]">{formatNumber(stats.pendingCalls)}</strong>{" "}
                      pending
                    </span>
                    <span>
                      <strong className="text-[#1B1C18]">
                        {formatNumber(stats.completedQueueCalls)}
                      </strong>{" "}
                      completed
                    </span>
                    <span>
                      <strong className="text-[#1B1C18]">{formatNumber(stats.failedCalls)}</strong>{" "}
                      failed
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#F0EFE9] pt-3 lg:justify-end lg:border-0 lg:pt-0">
                    {campaign.status === "draft" ? (
                      <div className="flex items-center gap-2">
                        <span className="font-['Space_Grotesk'] text-[12px] font-medium text-[#747878]">
                          Ready to launch?
                        </span>
                        <span className="text-[#92938C]" aria-hidden="true">
                          →
                        </span>
                        <button
                          type="button"
                          onClick={() => openLaunch(campaign)}
                          className="rounded-[5px] bg-[#1B1C18] px-4 py-2.5 font-['Space_Grotesk'] text-[12px] font-semibold text-white hover:bg-[#34352F]"
                        >
                          Start campaign
                        </button>
                      </div>
                    ) : campaign.status === "paused" ? (
                      <button
                        type="button"
                        onClick={() => changeCampaignStatus(campaign, "active")}
                        className="rounded-[5px] bg-[#1B1C18] px-3 py-2 font-['Space_Grotesk'] text-[10px] font-semibold text-white hover:bg-[#34352F]"
                      >
                        Resume campaign
                      </button>
                    ) : campaign.status === "active" ? (
                      <button
                        type="button"
                        onClick={() => changeCampaignStatus(campaign, "paused")}
                        className="rounded-[5px] border border-[#DCDDD6] bg-white px-3 py-2 font-['Space_Grotesk'] text-[10px] font-semibold text-[#444748] hover:bg-[#F7F6F1]"
                      >
                        Pause
                      </button>
                    ) : (
                      <span className="font-['Space_Grotesk'] text-[10px] font-medium text-[#747878]">
                        Finished
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center px-5 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F2EEFA] text-[#705AA8]">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11v2a2 2 0 0 0 2 2h2l3 5h2l-2-6" /><path d="M7 9 19 4v16L7 15z" /><path d="M19 9h2a2 2 0 0 1 0 4h-2" /></svg>
            </span>
            <h3 className="mt-4 font-['Newsreader'] text-[25px] text-[#1B1C18]">{campaigns.length === 0 ? "Your campaigns start here" : "No campaigns match this view"}</h3>
            <p className="mt-2 max-w-[390px] font-['Space_Grotesk'] text-[11px] leading-5 text-[#85877F]">{campaigns.length === 0 ? "Create a campaign draft to define the goal, opening and next step for your voice agent." : "Try another status or search term to find the campaign you are looking for."}</p>
            {campaigns.length === 0 ? <button type="button" onClick={() => setCreating(true)} className="mt-5 rounded-[5px] bg-[#1B1C18] px-4 py-2.5 font-['Space_Grotesk'] text-[11px] font-semibold text-white hover:bg-[#34352F]">Create your first campaign</button> : null}
          </div>
        )}
      </section>
    </div>
  );
}
