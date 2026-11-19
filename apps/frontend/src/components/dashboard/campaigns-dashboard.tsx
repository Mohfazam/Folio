"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createCampaignAction,
  deleteDraftCampaignAction,
  getCampaignLiveStatsAction,
  getLaunchEligibleContactsAction,
  importContactsAction,
  launchCampaignAction,
  updateCampaignDetailsAction,
  updateCampaignStatusAction,
} from "@/app/(dashboard)/dashboard/actions";
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
  targetAudience?: string | null;
  language?: string | null;
  maxDurationSeconds?: number | null;
  createdAt: string | null;
  updatedAt?: string | null;
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

type SortOption =
  | "newest"
  | "oldest"
  | "name_asc"
  | "most_calls"
  | "highest_connection_rate";

type CampaignType =
  | "outreach_sales"
  | "follow_up"
  | "reminder"
  | "reactivation"
  | "feedback_survey"
  | "announcement";

const INPUT =
  "mt-1.5 h-11 w-full rounded-[6px] border border-[#DCDDD6] bg-white px-3.5 font-['Space_Grotesk'] text-[13px] text-[#1B1C18] outline-none transition-colors placeholder:text-[#A0A19A] focus:border-[#7852D6] focus:ring-2 focus:ring-[#7852D6]/15";
const TEXTAREA =
  "mt-1.5 w-full rounded-[6px] border border-[#DCDDD6] bg-white px-3.5 py-3 font-['Space_Grotesk'] text-[13px] leading-5 text-[#1B1C18] outline-none transition-colors placeholder:text-[#A0A19A] focus:border-[#7852D6] focus:ring-2 focus:ring-[#7852D6]/15";
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

const SORT_LABELS: Record<SortOption, string> = {
  newest: "Recently created",
  oldest: "Oldest created",
  name_asc: "Campaign name (A–Z)",
  most_calls: "Most calls placed",
  highest_connection_rate: "Highest connection rate",
};

function formatNumber(value: number | undefined) {
  return new Intl.NumberFormat("en-IN").format(value ?? 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

type MetricIconKind = "layers" | "activity" | "file-edit" | "phone";

function MetricIcon({ kind, className = "h-4 w-4" }: { kind: MetricIconKind; className?: string }) {
  const artwork: Record<MetricIconKind, ReactNode> = {
    layers: (
      <>
        <path d="m12 2 9 5-9 5-9-5 9-5Z" />
        <path d="m3 12 9 5 9-5" />
        <path d="m3 17 9 5 9-5" />
      </>
    ),
    activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
    "file-edit": (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z" />
      </>
    ),
    phone: (
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z" />
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {artwork[kind]}
    </svg>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  active = false,
  onClick,
  href,
}: {
  label: string;
  value: string;
  detail: string;
  icon: MetricIconKind;
  active?: boolean;
  onClick?: () => void;
  href?: string;
}) {
  const baseClass = `group flex min-h-[118px] w-full flex-col justify-between rounded-[10px] border px-4 py-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6] sm:px-5 ${
    active
      ? "border-[#7852D6] bg-[#FAF8FF] shadow-[0_1px_3px_rgba(120,82,214,0.12)]"
      : "border-[#ECEBE5] bg-[#FFFEFB] hover:border-[#D7D5CC] hover:bg-[#FAF9F4]"
  }`;

  const inner = (
    <>
      <div className="flex w-full items-center justify-between gap-2">
        <span
          className={`font-['Space_Grotesk'] text-[11px] font-semibold ${
            active ? "text-[#644ABB]" : "text-[#666A68]"
          }`}
        >
          {label}
        </span>
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] border transition-colors ${
            active
              ? "border-[#DFD5F8] bg-[#EFEAFB] text-[#644ABB]"
              : "border-[#ECEBE5] bg-white text-[#666A68] group-hover:text-[#1B1C18]"
          }`}
        >
          <MetricIcon kind={icon} className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-3">
        <p className="font-['Newsreader'] text-[30px] leading-none tracking-[-0.5px] text-[#1B1C18]">
          {value}
        </p>
        <p className="mt-1.5 font-['Space_Grotesk'] text-[11px] text-[#747878]">{detail}</p>
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={baseClass}>
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={active} className={baseClass}>
        {inner}
      </button>
    );
  }

  return <div className={baseClass}>{inner}</div>;
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-['Space_Grotesk'] text-[10px] font-semibold capitalize ${
        STATUS_STYLES[normalized] ?? STATUS_STYLES.draft
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden="true" />
      {normalized || "draft"}
    </span>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[10px] border border-[#ECEBE5] bg-white p-4 sm:p-5">
      <div className="mb-5 border-b border-[#F0EFE9] pb-4">
        <h2 className="font-['Space_Grotesk'] text-[14px] font-semibold text-[#1B1C18]">{title}</h2>
        <p className="mt-1 font-['Space_Grotesk'] text-[11px] leading-5 text-[#747878]">
          {description}
        </p>
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
          <button
            type="button"
            onClick={onCancel}
            className="mb-3 inline-flex items-center gap-2 font-['Space_Grotesk'] text-[11px] font-semibold text-[#644ABB] hover:text-[#4F369A]"
          >
            <span aria-hidden="true">←</span> Back to campaigns
          </button>
          <p className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.12em] text-[#644ABB]">
            Campaign builder
          </p>
          <h1 className="mt-1 font-['Newsreader'] text-[34px] leading-tight tracking-[-0.8px] text-[#1B1C18] sm:text-[40px]">
            Create a campaign
          </h1>
          <p className="mt-2 max-w-[620px] font-['Space_Grotesk'] text-[12px] leading-5 text-[#747878]">
            Set the goal and conversation outline. Your campaign is saved as a draft. No contacts
            are called until you review and confirm a launch.
          </p>
        </div>
        <span className="rounded-full border border-[#E8E3F2] bg-[#F7F4FC] px-3 py-1.5 font-['Space_Grotesk'] text-[10px] font-semibold text-[#644ABB]">
          DRAFT FIRST
        </span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormSection
          title="Campaign basics"
          description="Give this campaign a clear name and choose what it is meant to do."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={LABEL}>
              Campaign name
              <input
                name="name"
                required
                maxLength={120}
                className={INPUT}
                placeholder="e.g. New enquiries follow-up"
              />
            </label>
            <label className={LABEL}>
              Campaign purpose
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
          <label className={`${LABEL} mt-4`}>
            What should this campaign achieve?
            <textarea
              name="primaryObjective"
              required
              rows={3}
              maxLength={2000}
              className={TEXTAREA}
              placeholder="Describe the result you want from these conversations."
            />
          </label>
          <label className={`${LABEL} mt-4`}>
            Who is this campaign for? <span className="font-normal text-[#747878]">Optional</span>
            <input
              name="targetAudience"
              className={INPUT}
              placeholder="e.g. People who enquired about the admissions process this month"
            />
          </label>
        </FormSection>

        <FormSection
          title="Conversation plan"
          description="Give the agent a clear opening, useful talking points and one next step."
        >
          <label className={LABEL}>
            How should the call begin?
            <textarea
              name="callOpeningHook"
              required
              rows={3}
              maxLength={2000}
              className={TEXTAREA}
              placeholder="Write a clear, natural opening for the agent."
            />
          </label>
          <label className={`${LABEL} mt-4`}>
            What should the agent cover? <span className="font-normal text-[#747878]">One point per line</span>
            <textarea
              name="keyTalkingPoints"
              required
              rows={5}
              maxLength={4000}
              className={TEXTAREA}
              placeholder={
                "Introduce the reason for the call.\nAnswer common questions using approved information.\nAsk whether the customer would like the next step."
              }
            />
          </label>
          <label className={`${LABEL} mt-4`}>
            What should the customer do next?
            <input
              name="callToAction"
              required
              maxLength={500}
              className={INPUT}
              placeholder="e.g. Book a consultation"
            />
          </label>
          <label className={`${LABEL} mt-4`}>
            If the customer is not ready <span className="font-normal text-[#747878]">Optional</span>
            <input
              name="fallbackOffer"
              maxLength={500}
              className={INPUT}
              placeholder="e.g. Offer to send more information by email"
            />
          </label>
        </FormSection>

        <FormSection
          title="Call settings"
          description="Choose how the agent handles language preferences and set the maximum duration for each call."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={LABEL}>
              Language preference
              <select name="language" defaultValue="auto" className={INPUT}>
                <option value="auto">Ask customer (Recommended)</option>
                <option value="en-IN">English (India)</option>
                <option value="hi-IN">Hindi</option>
                <option value="te-IN">Telugu</option>
                <option value="ta-IN">Tamil</option>
                <option value="kn-IN">Kannada</option>
                <option value="ml-IN">Malayalam</option>
              </select>
              <span className="mt-2 block font-['Space_Grotesk'] text-[10px] font-normal leading-4 text-[#747878]">
                Ask customer lets the agent ask which supported language they prefer, then continue
                the conversation in that language.
              </span>
            </label>
            <label className={LABEL}>
              Maximum call duration
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

        {error ? (
          <div
            role="alert"
            className="rounded-[6px] border border-[#F0D8D4] bg-[#FFF8F7] px-4 py-3 font-['Space_Grotesk'] text-[12px] leading-5 text-[#A33A32]"
          >
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ECEBE5] pt-4">
          <p className="max-w-[500px] font-['Space_Grotesk'] text-[10px] leading-4 text-[#747878]">
            Saving creates a draft only. You can review the audience and approve outbound activity
            separately.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="rounded-[6px] border border-[#DCDDD6] bg-white px-4 py-2.5 font-['Space_Grotesk'] text-[12px] font-semibold text-[#444748] hover:bg-[#F7F6F1] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-[6px] bg-[#1B1C18] px-5 py-2.5 font-['Space_Grotesk'] text-[12px] font-semibold text-white transition-colors hover:bg-[#34352F] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Saving draft…" : "Save campaign draft"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function EditCampaignModal({
  campaign,
  onClose,
  onSaved,
}: {
  campaign: Campaign;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState(campaign.name);
  const [type, setType] = useState<string>(campaign.type || "outreach_sales");
  const [primaryObjective, setPrimaryObjective] = useState(campaign.primaryObjective);
  const [targetAudience, setTargetAudience] = useState(campaign.targetAudience ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const trimmedName = name.trim();
    const trimmedObjective = primaryObjective.trim();
    if (!trimmedName || !trimmedObjective) {
      setError("Campaign name and objective are required.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await updateCampaignDetailsAction(campaign.id, {
        name: trimmedName,
        type,
        primaryObjective: trimmedObjective,
        targetAudience: targetAudience.trim() || null,
      });
      if (!result.ok) {
        setError(result.error || "Unable to update campaign.");
        return;
      }
      onSaved(`Updated "${trimmedName}".`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update campaign.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#171812]/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-campaign-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[540px] rounded-[12px] border border-[#ECEBE5] bg-[#FFFEFB] p-5 shadow-xl sm:p-6">
        <div className="flex items-start justify-between gap-4 border-b border-[#F0EFE9] pb-4">
          <div>
            <p className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.12em] text-[#644ABB]">
              Edit campaign
            </p>
            <h2 id="edit-campaign-title" className="mt-1 font-['Newsreader'] text-[28px] leading-tight text-[#1B1C18]">
              {campaign.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] border border-[#E5E4DC] bg-white px-3 py-1.5 font-['Space_Grotesk'] text-[12px] font-medium text-[#444748] hover:bg-[#F5F4ED]"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={LABEL}>
              Campaign name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
                className={INPUT}
              />
            </label>
            <label className={LABEL}>
              Campaign type
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className={INPUT}
              >
                <option value="outreach_sales">Reach new enquiries</option>
                <option value="follow_up">Follow up with leads</option>
                <option value="reminder">Send a reminder</option>
                <option value="reactivation">Reconnect with past customers</option>
                <option value="feedback_survey">Collect feedback</option>
                <option value="announcement">Share an announcement</option>
              </select>
            </label>
          </div>

          <label className={LABEL}>
            Objective
            <textarea
              value={primaryObjective}
              onChange={(e) => setPrimaryObjective(e.target.value)}
              required
              rows={3}
              maxLength={2000}
              className={TEXTAREA}
            />
          </label>

          <label className={LABEL}>
            Target audience <span className="font-normal text-[#747878]">Optional</span>
            <input
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              className={INPUT}
              placeholder="e.g. Warm inbound leads from last 14 days"
            />
          </label>

          {error ? (
            <p
              role="alert"
              className="rounded-[6px] border border-[#F0D8D4] bg-[#FFF8F7] px-3.5 py-2.5 font-['Space_Grotesk'] text-[12px] text-[#A33A32]"
            >
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-[#F0EFE9] pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-[6px] border border-[#DCDDD6] bg-white px-4 py-2 font-['Space_Grotesk'] text-[12px] font-semibold text-[#444748] hover:bg-[#F5F4ED]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-[6px] bg-[#1B1C18] px-4 py-2 font-['Space_Grotesk'] text-[12px] font-semibold text-white hover:bg-[#34352F] disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CampaignDetailDrawer({
  campaign,
  onClose,
  onLaunch,
  onStatusChange,
  onEdit,
}: {
  campaign: Campaign;
  onClose: () => void;
  onLaunch: (campaign: Campaign) => void;
  onStatusChange: (campaign: Campaign, next: "active" | "paused") => void;
  onEdit: (campaign: Campaign) => void;
}) {
  const stats = campaign.stats;
  const totalCalls = stats.totalCalls ?? 0;
  const connectedCalls = stats.connectedCalls ?? 0;
  const rate = totalCalls > 0 ? `${((connectedCalls / totalCalls) * 100).toFixed(1)}%` : "0%";

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#171812]/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="campaign-drawer-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex h-full w-full max-w-[500px] flex-col justify-between overflow-y-auto border-l border-[#E9E8E1] bg-[#FFFEFB] p-5 shadow-2xl sm:p-6">
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-3 border-b border-[#ECEBE5] pb-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={campaign.status} />
                <span className="font-['Space_Grotesk'] text-[11px] font-medium text-[#747878]">
                  {TYPE_LABELS[campaign.type] ?? campaign.type.replaceAll("_", " ")}
                </span>
              </div>
              <h2
                id="campaign-drawer-title"
                className="mt-2 font-['Newsreader'] text-[28px] leading-tight text-[#1B1C18]"
              >
                {campaign.name}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[6px] border border-[#E5E4DC] bg-white px-3 py-1.5 font-['Space_Grotesk'] text-[12px] font-medium text-[#444748] hover:bg-[#F5F4ED]"
            >
              Close
            </button>
          </div>

          <div>
            <p className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.08em] text-[#747878]">
              OBJECTIVE
            </p>
            <p className="mt-1.5 font-['Space_Grotesk'] text-[13px] leading-6 text-[#252620]">
              {campaign.primaryObjective || "No campaign objective recorded."}
            </p>
          </div>

          {campaign.targetAudience ? (
            <div>
              <p className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.08em] text-[#747878]">
                TARGET AUDIENCE
              </p>
              <p className="mt-1 font-['Space_Grotesk'] text-[12px] text-[#444748]">
                {campaign.targetAudience}
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-3 gap-2.5 rounded-[10px] border border-[#ECEBE5] bg-[#FAF9F5] p-3.5">
            <div>
              <p className="font-['Space_Grotesk'] text-[10px] text-[#747878]">Calls placed</p>
              <p className="mt-1 font-['Newsreader'] text-[24px] leading-none text-[#1B1C18]">
                {formatNumber(totalCalls)}
              </p>
            </div>
            <div>
              <p className="font-['Space_Grotesk'] text-[10px] text-[#747878]">Connected</p>
              <p className="mt-1 font-['Newsreader'] text-[24px] leading-none text-[#1B1C18]">
                {formatNumber(connectedCalls)}
              </p>
              <p className="mt-1 font-['Space_Grotesk'] text-[10px] text-[#644ABB]">{rate}</p>
            </div>
            <div>
              <p className="font-['Space_Grotesk'] text-[10px] text-[#747878]">High intent</p>
              <p className="mt-1 font-['Newsreader'] text-[24px] leading-none text-[#1B1C18]">
                {formatNumber(stats.highInterestCalls)}
              </p>
            </div>
          </div>

          <div className="rounded-[10px] border border-[#ECEBE5] bg-white p-3.5">
            <p className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.08em] text-[#747878]">
              QUEUE EXECUTION COUNTS
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-3 font-['Space_Grotesk'] text-[12px]">
              <div className="flex justify-between">
                <dt className="text-[#747878]">Calling now</dt>
                <dd className="font-semibold text-[#1B1C18]">{formatNumber(stats.inProgressCalls)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#747878]">Pending</dt>
                <dd className="font-semibold text-[#1B1C18]">{formatNumber(stats.pendingCalls)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#747878]">Completed</dt>
                <dd className="font-semibold text-[#1B1C18]">
                  {formatNumber(stats.completedQueueCalls)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#747878]">Failed</dt>
                <dd className="font-semibold text-[#1B1C18]">{formatNumber(stats.failedCalls)}</dd>
              </div>
            </dl>
          </div>

          <div className="space-y-1 font-['Space_Grotesk'] text-[11px] text-[#747878]">
            <p>Created: {formatDate(campaign.createdAt)}</p>
            {campaign.updatedAt ? <p>Last updated: {formatDate(campaign.updatedAt)}</p> : null}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[#ECEBE5] pt-4">
          <Link
            href="/dashboard/calls"
            className="font-['Space_Grotesk'] text-[12px] font-semibold text-[#644ABB] hover:underline"
          >
            View call logs →
          </Link>
          <div className="flex flex-wrap gap-2">
            {campaign.status !== "completed" ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(campaign);
                }}
                className="rounded-[6px] border border-[#DCDDD6] bg-white px-3.5 py-2 font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18] hover:bg-[#F5F4ED]"
              >
                Edit
              </button>
            ) : null}
            {campaign.status === "draft" ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLaunch(campaign);
                }}
                className="rounded-[6px] bg-[#1B1C18] px-4 py-2 font-['Space_Grotesk'] text-[12px] font-semibold text-white hover:bg-[#34352F]"
              >
                Start campaign
              </button>
            ) : campaign.status === "paused" ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onStatusChange(campaign, "active");
                }}
                className="rounded-[6px] bg-[#1B1C18] px-4 py-2 font-['Space_Grotesk'] text-[12px] font-semibold text-white hover:bg-[#34352F]"
              >
                Resume campaign
              </button>
            ) : campaign.status === "active" ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onStatusChange(campaign, "paused");
                }}
                className="rounded-[6px] border border-[#DCDDD6] bg-white px-4 py-2 font-['Space_Grotesk'] text-[12px] font-semibold text-[#444748] hover:bg-[#F5F4ED]"
              >
                Pause
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

type LiveCampaignSnapshot = {
  status: string;
  stats: CampaignStats;
};

function computeExecutionProgress(campaign: Campaign): {
  percent: number;
  label: string;
} {
  const stats = campaign.stats;
  const pending = Math.max(0, stats.pendingCalls ?? 0);
  const inProgress = Math.max(0, stats.inProgressCalls ?? 0);
  const completed = Math.max(0, stats.completedQueueCalls ?? 0);
  const failed = Math.max(0, stats.failedCalls ?? 0);
  const totalQueue = pending + inProgress + completed + failed;

  if (campaign.status === "draft" && totalQueue === 0) {
    return { percent: 0, label: "Not started (Draft)" };
  }
  if (totalQueue === 0) {
    if (campaign.status === "completed") {
      return { percent: 100, label: "Completed" };
    }
    return { percent: 0, label: "No queued calls yet" };
  }

  const finished = completed + failed;
  const percent = Math.min(100, Math.max(0, Math.round((finished / totalQueue) * 100)));
  return {
    percent,
    label: `${percent}% queue processed (${finished}/${totalQueue})`,
  };
}

export function CampaignsDashboard({ initialCampaigns, initialError }: Props) {
  const router = useRouter();
  const [liveCampaigns, setLiveCampaigns] = useState<Record<string, LiveCampaignSnapshot>>({});
  const liveStatsRequestInFlight = useRef(false);

  const campaigns = useMemo(
    () =>
      initialCampaigns.map((campaign) => {
        const live = liveCampaigns[campaign.id];
        return live
          ? { ...campaign, status: live.status, stats: live.stats }
          : campaign;
      }),
    [initialCampaigns, liveCampaigns],
  );
  const hasActiveCampaigns = campaigns.some((campaign) => campaign.status === "active");

  useEffect(() => {
    setLiveCampaigns({});
  }, [initialCampaigns]);

  useEffect(() => {
    if (!hasActiveCampaigns) return;

    let disposed = false;

    const refreshLiveStats = async () => {
      if (disposed || document.visibilityState !== "visible" || liveStatsRequestInFlight.current) {
        return;
      }

      liveStatsRequestInFlight.current = true;
      try {
        const result = await getCampaignLiveStatsAction();
        if (!disposed && result.ok && Array.isArray(result.data?.campaigns)) {
          const next: Record<string, LiveCampaignSnapshot> = {};

          for (const value of result.data.campaigns) {
            if (!value || typeof value !== "object") continue;
            const row = value as Record<string, unknown>;
            if (typeof row.id !== "string") continue;

            const rawStats =
              row.stats && typeof row.stats === "object"
                ? (row.stats as Record<string, unknown>)
                : {};
            const toCount = (val: unknown) =>
              typeof val === "number" && Number.isFinite(val) ? val : 0;

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
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [queryInput, setQueryInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedDetailCampaign, setSelectedDetailCampaign] = useState<Campaign | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [deletingDraft, setDeletingDraft] = useState<Campaign | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

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

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(queryInput);
    }, 180);
    return () => window.clearTimeout(handle);
  }, [queryInput]);

  useEffect(() => {
    if (!openMenuId) return;
    const handleDocClick = () => setOpenMenuId(null);
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenuId(null);
    };
    document.addEventListener("click", handleDocClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("click", handleDocClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [openMenuId]);

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
      return [
        {
          id: item.id,
          phoneNumber: item.phoneNumber,
          fullName: typeof item.fullName === "string" ? item.fullName : null,
        },
      ];
    });

    setEligibleContacts(parsed);
    const newlyEligible = parsed.filter((contact) => !previousIds.has(contact.id));
    if (selectNewContacts && newlyEligible.length > 0) {
      setSelectedContactIds((current) =>
        Array.from(new Set([...current, ...newlyEligible.map((contact) => contact.id)])),
      );
    }
    return newlyEligible;
  };

  const openLaunch = async (campaign: Campaign) => {
    setOpenMenuId(null);
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
      setLaunchError(
        error instanceof Error ? error.message : "Eligible contacts could not be loaded.",
      );
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
          setContactError(
            "The contact was submitted, but it was not added to the eligible audience. It may already exist or have an invalid phone number.",
          );
        }
      } catch {
        setContactNotice(
          "Contact saved. Close and reopen the launch window to refresh the eligible audience.",
        );
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
        setContactNotice(
          `Import complete: ${inserted} added, ${duplicates} duplicates, ${failed} rejected. ${newlyEligible.length} new eligible contacts selected.`,
        );
      } catch {
        setContactNotice(
          `Import complete: ${inserted} added, ${duplicates} duplicates, ${failed} rejected. Close and reopen the launch window to refresh the eligible audience.`,
        );
      }
    } catch (error) {
      setContactError(
        error instanceof Error ? error.message : "The contact list could not be imported.",
      );
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
    const scheduled = startDate ? new Date(`${startDate}T${dailyStart}:00`) : new Date();

    if (
      Number.isNaN(scheduled.getTime()) ||
      (startDate && scheduled.getTime() < Date.now() - 60_000)
    ) {
      setLaunchError(
        "Choose a future launch date, or leave it empty to start as soon as possible.",
      );
      return;
    }
    setLaunchBusy(true);
    setLaunchError(null);
    const result = await launchCampaignAction(launchingCampaign.id, selectedContactIds, {
      startAt: scheduled.toISOString(),
      dailyStart,
      dailyEnd,
    });
    setLaunchBusy(false);
    if (!result.ok) {
      setLaunchError(result.error);
      return;
    }
    setNotice(
      `Campaign queued for ${selectedContactIds.length} contacts. Calls will run only during ${dailyStart}–${dailyEnd} workspace time.`,
    );
    setLaunchingCampaign(null);
    router.refresh();
  };

  const changeCampaignStatus = async (campaign: Campaign, status: "active" | "paused") => {
    setOpenMenuId(null);
    const result = await updateCampaignStatusAction(campaign.id, status);
    if (!result.ok) {
      setNotice(
        `Could not ${status === "paused" ? "pause" : "resume"} campaign: ${result.error}`,
      );
      return;
    }
    setNotice(
      status === "paused"
        ? "Campaign paused. No new calls will start until you resume it."
        : "Campaign resumed. Pending calls will continue inside the configured calling windows.",
    );
    router.refresh();
  };

  const confirmDeleteDraft = async () => {
    if (!deletingDraft || deleteBusy) return;
    setDeleteBusy(true);
    const result = await deleteDraftCampaignAction(deletingDraft.id);
    setDeleteBusy(false);
    if (!result.ok) {
      setNotice(`Could not delete draft campaign: ${result.error}`);
      setDeletingDraft(null);
      return;
    }
    const deletedName = deletingDraft.name;
    setDeletingDraft(null);
    setNotice(`Deleted draft campaign "${deletedName}".`);
    router.refresh();
  };

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: campaigns.length,
      draft: 0,
      active: 0,
      paused: 0,
      completed: 0,
    };
    for (const c of campaigns) {
      const s = c.status.toLowerCase();
      if (s === "draft" || s === "active" || s === "paused" || s === "completed") {
        counts[s] += 1;
      }
    }
    return counts;
  }, [campaigns]);

  const filteredCampaigns = useMemo(() => {
    const normalizedQuery = debouncedQuery.trim().toLowerCase();
    const list = campaigns.filter((campaign) => {
      const normalizedStatus = campaign.status.toLowerCase();
      const matchesStatus =
        statusFilter === "all" ||
        normalizedStatus === statusFilter ||
        (statusFilter === "draft" &&
          !["active", "paused", "completed"].includes(normalizedStatus));
      const matchesType = typeFilter === "all" || campaign.type === typeFilter;
      const matchesQuery =
        !normalizedQuery ||
        `${campaign.name} ${campaign.primaryObjective} ${campaign.targetAudience ?? ""} ${
          TYPE_LABELS[campaign.type] ?? campaign.type
        }`
          .toLowerCase()
          .includes(normalizedQuery);
      return matchesStatus && matchesType && matchesQuery;
    });

    return [...list].sort((a, b) => {
      if (sortBy === "name_asc") return a.name.localeCompare(b.name);
      if (sortBy === "most_calls") {
        return (b.stats.totalCalls ?? 0) - (a.stats.totalCalls ?? 0);
      }
      if (sortBy === "highest_connection_rate") {
        const aTotal = a.stats.totalCalls ?? 0;
        const bTotal = b.stats.totalCalls ?? 0;
        const aRate = aTotal > 0 ? (a.stats.connectedCalls ?? 0) / aTotal : -1;
        const bRate = bTotal > 0 ? (b.stats.connectedCalls ?? 0) / bTotal : -1;
        return bRate - aRate;
      }
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return sortBy === "oldest" ? aTime - bTime : bTime - aTime;
    });
  }, [campaigns, statusFilter, typeFilter, debouncedQuery, sortBy]);

  const activeCount = statusCounts.active;
  const draftCount = statusCounts.draft;
  const totalCalls = campaigns.reduce((sum, campaign) => sum + (campaign.stats.totalCalls ?? 0), 0);

  const hasActiveFilters =
    statusFilter !== "all" || typeFilter !== "all" || queryInput.trim().length > 0;

  const clearAllFilters = () => {
    setStatusFilter("all");
    setTypeFilter("all");
    setQueryInput("");
    setDebouncedQuery("");
    setSortBy("newest");
  };

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
      {/* Launch Campaign Modal */}
      {launchingCampaign ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#171812]/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="launch-campaign-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setLaunchingCampaign(null);
          }}
        >
          <div className="max-h-[90vh] w-full max-w-[760px] overflow-y-auto rounded-[12px] border border-[#ECEBE5] bg-[#FFFEFB] p-5 shadow-xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.12em] text-[#644ABB]">
                  Outbound campaign
                </p>
                <h2
                  id="launch-campaign-title"
                  className="mt-1 font-['Newsreader'] text-[30px] text-[#1B1C18]"
                >
                  Launch {launchingCampaign.name}
                </h2>
                <p className="mt-1 font-['Space_Grotesk'] text-[12px] leading-5 text-[#747878]">
                  Choose who to call and when the agent is allowed to place calls.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLaunchingCampaign(null)}
                className="rounded-[6px] border border-[#E5E4DC] bg-white px-3 py-1.5 font-['Space_Grotesk'] text-[12px] text-[#444748] hover:bg-[#F5F4ED]"
              >
                Close
              </button>
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
                <span className="mt-1 block font-['Space_Grotesk'] text-[10px] font-normal text-[#747878]">
                  Choose the launch date.
                </span>
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
            <p className="mt-2 font-['Space_Grotesk'] text-[10px] leading-4 text-[#747878]">
              Leave the start date empty to launch as soon as possible. On the selected date, calls
              can begin at your daily calls start time.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[#ECEBE5] bg-white px-4 py-3">
              <div>
                <p className="font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18]">
                  Need to add contacts?
                </p>
                <p className="font-['Space_Grotesk'] text-[10px] text-[#747878]">
                  Add one person manually or upload a CSV / Excel list without leaving this window.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setContactEntryMode(contactEntryMode === "single" ? null : "single");
                    setContactError(null);
                    setContactNotice(null);
                    setContactPermissionConfirmed(false);
                    setContactFile(null);
                  }}
                  className="rounded-[6px] border border-[#DCDDD6] bg-white px-3 py-2 font-['Space_Grotesk'] text-[11px] font-semibold text-[#444748] hover:bg-[#F7F6F1]"
                >
                  + Add one contact
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setContactEntryMode(contactEntryMode === "bulk" ? null : "bulk");
                    setContactError(null);
                    setContactNotice(null);
                    setContactPermissionConfirmed(false);
                    setContactFile(null);
                  }}
                  className="rounded-[6px] bg-[#1B1C18] px-3 py-2 font-['Space_Grotesk'] text-[11px] font-semibold text-white hover:bg-[#34352F]"
                >
                  ↑ Upload contacts
                </button>
              </div>
            </div>

            {contactEntryMode === "single" ? (
              <form
                onSubmit={handleAddSingleContact}
                className="mt-3 rounded-[8px] border border-[#DCD5ED] bg-[#FCFBFF] p-4"
              >
                <div className="mb-3">
                  <p className="font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18]">
                    Add an individual contact
                  </p>
                  <p className="mt-1 font-['Space_Grotesk'] text-[10px] leading-4 text-[#747878]">
                    The person will be added to your workspace and selected for this campaign if
                    eligible.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className={LABEL}>
                    Name <span className="font-normal text-[#747878]">Optional</span>
                    <input
                      name="fullName"
                      maxLength={160}
                      className={INPUT}
                      placeholder="Full name"
                    />
                  </label>
                  <label className={LABEL}>
                    Phone number
                    <input
                      name="phoneNumber"
                      type="tel"
                      required
                      className={INPUT}
                      placeholder="+91 98765 43210"
                    />
                  </label>
                  <label className={LABEL}>
                    Email <span className="font-normal text-[#747878]">Optional</span>
                    <input
                      name="email"
                      type="email"
                      className={INPUT}
                      placeholder="name@example.com"
                    />
                  </label>
                </div>
                <label className="mt-3 flex items-start gap-2 rounded-[6px] border border-[#E9E8E1] bg-white p-3 font-['Space_Grotesk'] text-[11px] leading-5 text-[#565B5B]">
                  <input
                    type="checkbox"
                    checked={contactPermissionConfirmed}
                    onChange={(event) => setContactPermissionConfirmed(event.target.checked)}
                    className="mt-1 accent-[#7852D6]"
                  />
                  <span>
                    I confirm that this person has given permission to be contacted and has not opted
                    out.
                  </span>
                </label>
                {contactError ? (
                  <p
                    role="alert"
                    className="mt-3 rounded-[6px] border border-[#F0D8D4] bg-[#FFF8F7] px-3 py-2 text-[11px] leading-4 text-[#A33A32]"
                  >
                    {contactError}
                  </p>
                ) : null}
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={contactBusy}
                    onClick={() => {
                      setContactEntryMode(null);
                      setContactError(null);
                      setContactPermissionConfirmed(false);
                    }}
                    className="rounded-[6px] border border-[#DCDDD6] bg-white px-3 py-2 text-[11px] font-semibold text-[#444748] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={contactBusy || !contactPermissionConfirmed}
                    className="rounded-[6px] bg-[#1B1C18] px-4 py-2 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {contactBusy ? "Adding…" : "Add and select contact"}
                  </button>
                </div>
              </form>
            ) : null}

            {contactEntryMode === "bulk" ? (
              <div className="mt-3 rounded-[8px] border border-[#DCD5ED] bg-[#FCFBFF] p-4">
                <div className="mb-3">
                  <p className="font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18]">
                    Upload a contact list
                  </p>
                  <p className="mt-1 font-['Space_Grotesk'] text-[10px] leading-4 text-[#747878]">
                    CSV or XLSX, maximum 5 MB and 500 contact rows. The required column is
                    phoneNumber.
                  </p>
                </div>
                <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-[6px] border border-dashed border-[#CFCFC7] bg-white px-4 py-5 text-center hover:border-[#7852D6]">
                  <span className="font-['Space_Grotesk'] text-[11px] font-semibold text-[#1B1C18]">
                    {contactFile ? contactFile.name : "Choose CSV or Excel file"}
                  </span>
                  <span className="font-['Space_Grotesk'] text-[10px] text-[#747878]">
                    phoneNumber is required. fullName and email are optional.
                  </span>
                  <input
                    type="file"
                    accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="sr-only"
                    onChange={(event) => {
                      setContactFile(event.target.files?.[0] ?? null);
                      setContactError(null);
                      setContactPermissionConfirmed(false);
                    }}
                  />
                </label>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <a
                    href="/contact-import-template.csv"
                    download
                    className="font-['Space_Grotesk'] text-[10px] font-semibold text-[#644ABB] underline underline-offset-2"
                  >
                    Download CSV template
                  </a>
                  {contactFile ? (
                    <button
                      type="button"
                      onClick={() => {
                        setContactFile(null);
                        setContactPermissionConfirmed(false);
                      }}
                      className="font-['Space_Grotesk'] text-[10px] font-semibold text-[#A33A32]"
                    >
                      Remove file
                    </button>
                  ) : null}
                </div>
                <label className="mt-3 flex items-start gap-2 rounded-[6px] border border-[#E9E8E1] bg-white p-3 font-['Space_Grotesk'] text-[11px] leading-5 text-[#565B5B]">
                  <input
                    type="checkbox"
                    checked={contactPermissionConfirmed}
                    onChange={(event) => setContactPermissionConfirmed(event.target.checked)}
                    className="mt-1 accent-[#7852D6]"
                  />
                  <span>
                    I confirm that I have permission to contact the people in this file and that
                    opt-out requests are represented correctly.
                  </span>
                </label>
                {contactError ? (
                  <p
                    role="alert"
                    className="mt-3 rounded-[6px] border border-[#F0D8D4] bg-[#FFF8F7] px-3 py-2 text-[11px] leading-4 text-[#A33A32]"
                  >
                    {contactError}
                  </p>
                ) : null}
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={contactBusy}
                    onClick={() => {
                      setContactEntryMode(null);
                      setContactError(null);
                      setContactFile(null);
                      setContactPermissionConfirmed(false);
                    }}
                    className="rounded-[6px] border border-[#DCDDD6] bg-white px-3 py-2 text-[11px] font-semibold text-[#444748] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!contactFile || !contactPermissionConfirmed || contactBusy}
                    onClick={handleBulkContactImport}
                    className="rounded-[6px] bg-[#1B1C18] px-4 py-2 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {contactBusy ? "Importing…" : "Import and select contacts"}
                  </button>
                </div>
              </div>
            ) : null}

            {contactNotice ? (
              <p
                role="status"
                className="mt-3 rounded-[6px] border border-[#D7E8DA] bg-[#F1F8F2] px-3 py-2.5 font-['Space_Grotesk'] text-[11px] leading-4 text-[#397A55]"
              >
                {contactNotice}
              </p>
            ) : null}

            <div className="mt-3 rounded-[8px] border border-[#ECEBE5] bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-[#ECEBE5] px-4 py-3">
                <div>
                  <p className="font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18]">
                    Eligible contacts
                  </p>
                  <p className="font-['Space_Grotesk'] text-[10px] text-[#747878]">
                    Select the audience for this campaign.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!eligibleContacts.length}
                  onClick={() =>
                    setSelectedContactIds(
                      selectedContactIds.length === eligibleContacts.length
                        ? []
                        : eligibleContacts.map((c) => c.id),
                    )
                  }
                  className="font-['Space_Grotesk'] text-[11px] font-semibold text-[#644ABB] hover:underline disabled:opacity-50"
                >
                  {selectedContactIds.length === eligibleContacts.length && eligibleContacts.length
                    ? "Clear all"
                    : "Select all"}
                </button>
              </div>
              <div className="max-h-[230px] overflow-y-auto">
                {loadingAudience ? (
                  <p className="px-4 py-8 text-center font-['Space_Grotesk'] text-[12px] text-[#747878]">
                    Loading eligible contacts…
                  </p>
                ) : eligibleContacts.length ? (
                  eligibleContacts.map((contact) => (
                    <label
                      key={contact.id}
                      className="flex cursor-pointer items-center gap-3 border-b border-[#F0EFE9] px-4 py-3 last:border-0 hover:bg-[#FAF9F5]"
                    >
                      <input
                        type="checkbox"
                        checked={selectedContactIds.includes(contact.id)}
                        onChange={(e) =>
                          setSelectedContactIds((current) =>
                            e.target.checked
                              ? [...current, contact.id]
                              : current.filter((id) => id !== contact.id),
                          )
                        }
                        className="h-4 w-4 accent-[#7852D6]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-['Space_Grotesk'] text-[12px] font-medium text-[#1B1C18]">
                          {contact.fullName || "Unnamed contact"}
                        </span>
                        <span className="block font-['Space_Grotesk'] text-[10px] text-[#747878]">
                          {contact.phoneNumber}
                        </span>
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="px-4 py-8 text-center font-['Space_Grotesk'] text-[12px] text-[#747878]">
                    {launchError ||
                      "No eligible contacts found. Import contacts or remove opt-out and invalid statuses."}
                  </p>
                )}
              </div>
              <div className="border-t border-[#ECEBE5] px-4 py-2 font-['Space_Grotesk'] text-[10px] text-[#747878]">
                {selectedContactIds.length} of {eligibleContacts.length} selected
              </div>
            </div>
            {launchError ? (
              <div
                role="alert"
                className="mt-4 flex flex-col gap-2 rounded-[6px] border border-[#F0D8D4] bg-[#FFF8F7] px-3.5 py-3"
              >
                <p className="text-[11px] leading-5 text-[#A33A32]">{launchError}</p>
                {launchError.toLowerCase().includes("follow-up and team-handling rules") ||
                launchError.toLowerCase().includes("routing rules") ? (
                  <div className="rounded-[5px] border border-[#E9E1D4] bg-white p-3">
                    <p className="mb-2 text-[10px] leading-5 text-[#747878]">
                      Before launching, choose who receives callback requests, who handles requests
                      to speak to a person, and whether unanswered calls should be retried. You can
                      configure these rules in workspace setup.
                    </p>
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
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#ECEBE5] pt-4">
              <p className="max-w-[380px] font-['Space_Grotesk'] text-[10px] leading-4 text-[#747878]">
                Calls also obey workspace calling hours, available credits, daily limits and contact
                opt-outs.
              </p>
              <button
                type="button"
                disabled={launchBusy || loadingAudience || !selectedContactIds.length}
                onClick={submitLaunch}
                className="rounded-[6px] bg-[#1B1C18] px-5 py-2.5 font-['Space_Grotesk'] text-[12px] font-semibold text-white hover:bg-[#34352F] disabled:opacity-50"
              >
                {launchBusy
                  ? "Queuing campaign…"
                  : startDate
                    ? "Schedule campaign"
                    : "Start campaign now"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Edit Campaign Modal */}
      {editingCampaign ? (
        <EditCampaignModal
          campaign={editingCampaign}
          onClose={() => setEditingCampaign(null)}
          onSaved={(msg) => {
            setEditingCampaign(null);
            setNotice(msg);
            router.refresh();
          }}
        />
      ) : null}

      {/* Campaign Detail Drawer */}
      {selectedDetailCampaign ? (
        <CampaignDetailDrawer
          campaign={selectedDetailCampaign}
          onClose={() => setSelectedDetailCampaign(null)}
          onLaunch={openLaunch}
          onStatusChange={changeCampaignStatus}
          onEdit={(c) => setEditingCampaign(c)}
        />
      ) : null}

      {/* Delete Draft Confirmation Modal */}
      {deletingDraft ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#171812]/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-draft-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDeletingDraft(null);
          }}
        >
          <div className="w-full max-w-[440px] rounded-[12px] border border-[#ECEBE5] bg-white p-5 shadow-xl sm:p-6">
            <p className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.12em] text-[#A33A32]">
              Delete draft campaign
            </p>
            <h2
              id="delete-draft-title"
              className="mt-1 font-['Newsreader'] text-[26px] leading-tight text-[#1B1C18]"
            >
              Delete &ldquo;{deletingDraft.name}&rdquo;?
            </h2>
            <p className="mt-2 font-['Space_Grotesk'] text-[12px] leading-5 text-[#565B5B]">
              This draft campaign will be permanently removed from your workspace. Only draft
              campaigns can be deleted.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingDraft(null)}
                disabled={deleteBusy}
                className="rounded-[6px] border border-[#DCDDD6] bg-white px-4 py-2 font-['Space_Grotesk'] text-[12px] font-semibold text-[#444748] hover:bg-[#F5F4ED]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteDraft}
                disabled={deleteBusy}
                className="rounded-[6px] bg-[#A33A32] px-4 py-2 font-['Space_Grotesk'] text-[12px] font-semibold text-white hover:bg-[#8A2E27] disabled:opacity-50"
              >
                {deleteBusy ? "Deleting…" : "Delete draft"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Page Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#ECEBE5] pb-5">
        <div>
          <p className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.12em] text-[#644ABB]">
            Workspace / Outbound
          </p>
          <h1 className="mt-1 font-['Newsreader'] text-[34px] leading-tight tracking-[-0.8px] text-[#1B1C18] sm:text-[40px]">
            Campaigns
          </h1>
          <p className="mt-1.5 max-w-[640px] font-['Space_Grotesk'] text-[12px] leading-5 text-[#666A68]">
            Manage your voice outreach campaigns, monitor performance, and organize your calling
            operations.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setNotice(null);
            setCreating(true);
          }}
          className="inline-flex h-10 items-center gap-2 rounded-[6px] bg-[#1B1C18] px-4 font-['Space_Grotesk'] text-[12px] font-semibold text-white transition-colors hover:bg-[#34352F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6] focus-visible:ring-offset-2"
        >
          <span className="text-[16px] leading-none" aria-hidden="true">
            +
          </span>
          New campaign
        </button>
      </header>

      {notice ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[#D7E8DA] bg-[#F1F8F2] px-4 py-3 font-['Space_Grotesk'] text-[12px] text-[#397A55]"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="font-semibold text-[#397A55] hover:underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {initialError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[#F0D8D4] bg-[#FFF8F7] px-4 py-3">
          <p className="font-['Space_Grotesk'] text-[12px] leading-5 text-[#A33A32]">
            Campaigns could not be loaded: {initialError}
          </p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="rounded-[6px] border border-[#E5C7C3] bg-white px-3 py-2 font-['Space_Grotesk'] text-[11px] font-semibold text-[#8D3028] hover:bg-[#FDF2F1]"
          >
            Retry
          </button>
        </div>
      ) : null}

      {/* Four Campaign Metric Cards */}
      <section aria-label="Campaign metrics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total campaigns"
          value={formatNumber(campaigns.length)}
          detail="Saved in this workspace"
          icon="layers"
          active={statusFilter === "all"}
          onClick={() => setStatusFilter("all")}
        />
        <MetricCard
          label="Active campaigns"
          value={formatNumber(activeCount)}
          detail="Currently running"
          icon="activity"
          active={statusFilter === "active"}
          onClick={() =>
            setStatusFilter((current) => (current === "active" ? "all" : "active"))
          }
        />
        <MetricCard
          label="Draft campaigns"
          value={formatNumber(draftCount)}
          detail="Awaiting launch"
          icon="file-edit"
          active={statusFilter === "draft"}
          onClick={() =>
            setStatusFilter((current) => (current === "draft" ? "all" : "draft"))
          }
        />
        <MetricCard
          label="Calls placed"
          value={formatNumber(totalCalls)}
          detail="Across all campaigns · View analytics"
          icon="phone"
          href="/dashboard/analytics"
        />
      </section>

      {/* Campaign Management Section */}
      <section className="overflow-hidden rounded-[12px] border border-[#ECEBE5] bg-white shadow-[0_1px_2px_rgba(27,28,24,0.03)]">
        <div className="flex flex-col gap-4 border-b border-[#ECEBE5] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-['Space_Grotesk'] text-[15px] font-semibold text-[#1B1C18]">
              All campaigns
            </h2>
            <p className="mt-0.5 font-['Space_Grotesk'] text-[11px] text-[#747878]">
              Review campaign status and conversation performance.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
            <label className="relative block w-full sm:w-64">
              <span className="sr-only">Search campaigns</span>
              <svg
                viewBox="0 0 20 20"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#747878]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <circle cx="8.5" cy="8.5" r="5.5" />
                <path d="m13 13 4 4" strokeLinecap="round" />
              </svg>
              <input
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
                placeholder="Search campaigns..."
                className="h-9 w-full rounded-[6px] border border-[#E5E4DC] bg-[#FFFEFB] pl-9 pr-8 font-['Space_Grotesk'] text-[12px] text-[#1B1C18] outline-none transition-colors placeholder:text-[#92938C] focus:border-[#7852D6] focus:ring-2 focus:ring-[#7852D6]/15"
              />
              {queryInput ? (
                <button
                  type="button"
                  onClick={() => {
                    setQueryInput("");
                    setDebouncedQuery("");
                  }}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1 font-['Space_Grotesk'] text-[11px] font-semibold text-[#747878] hover:bg-[#F5F4ED] hover:text-[#1B1C18]"
                >
                  ×
                </button>
              ) : null}
            </label>

            <label className="sr-only" htmlFor="campaign-type-filter">
              Filter by campaign type
            </label>
            <select
              id="campaign-type-filter"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="h-9 rounded-[6px] border border-[#E5E4DC] bg-[#FFFEFB] px-2.5 font-['Space_Grotesk'] text-[12px] font-medium text-[#444748] outline-none focus:border-[#7852D6]"
            >
              <option value="all">All types</option>
              {Object.entries(TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>

            <label className="sr-only" htmlFor="campaign-sort-select">
              Sort campaigns
            </label>
            <select
              id="campaign-sort-select"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortOption)}
              className="h-9 rounded-[6px] border border-[#E5E4DC] bg-[#FFFEFB] px-2.5 font-['Space_Grotesk'] text-[12px] font-medium text-[#444748] outline-none focus:border-[#7852D6]"
            >
              {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
                <option key={option} value={option}>
                  {SORT_LABELS[option]}
                </option>
              ))}
            </select>

            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearAllFilters}
                className="h-9 rounded-[6px] border border-[#E5E4DC] bg-[#F8F7F2] px-3 font-['Space_Grotesk'] text-[11px] font-semibold text-[#644ABB] hover:bg-[#EFEAFB]"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>

        {/* Status Pill Tabs */}
        <div
          role="tablist"
          aria-label="Filter campaigns by status"
          className="flex items-center gap-1.5 overflow-x-auto border-b border-[#ECEBE5] bg-[#FCFBF8] px-4 py-2.5 sm:px-5"
        >
          {(["all", "draft", "active", "paused", "completed"] as StatusFilter[]).map((status) => {
            const selected = statusFilter === status;
            const label = status === "all" ? "All statuses" : status;
            return (
              <button
                key={status}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setStatusFilter(status)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-['Space_Grotesk'] text-[11px] font-semibold capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6] ${
                  selected
                    ? "bg-[#E7DEFF] text-[#4C30A2]"
                    : "text-[#666A68] hover:bg-[#F1F0EB] hover:text-[#1B1C18]"
                }`}
              >
                <span>{label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] tabular-nums ${
                    selected ? "bg-white/80 text-[#4C30A2]" : "bg-[#ECEBE5] text-[#666A68]"
                  }`}
                >
                  {statusCounts[status]}
                </span>
              </button>
            );
          })}
          <span className="ml-auto shrink-0 pl-3 font-['Space_Grotesk'] text-[11px] text-[#747878]">
            Showing {filteredCampaigns.length} of {campaigns.length}
          </span>
        </div>

        {/* Horizontal 3-Area Campaign Cards */}
        {filteredCampaigns.length > 0 ? (
          <div className="divide-y divide-[#F0EFE9]">
            {filteredCampaigns.map((campaign) => {
              const stats = campaign.stats;
              const total = stats.totalCalls ?? 0;
              const connected = stats.connectedCalls ?? 0;
              const highIntent = stats.highInterestCalls ?? 0;
              const progress = computeExecutionProgress(campaign);
              const menuOpen = openMenuId === campaign.id;

              return (
                <article
                  key={campaign.id}
                  className="grid gap-4 px-4 py-4 transition-colors hover:bg-[#FAF9F5] sm:px-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(240px,1fr)_auto] lg:items-center lg:gap-6"
                >
                  {/* Area A: Campaign Information */}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedDetailCampaign(campaign)}
                        className="truncate text-left font-['Space_Grotesk'] text-[14px] font-semibold text-[#1B1C18] transition-colors hover:text-[#644ABB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6] rounded"
                      >
                        {campaign.name}
                      </button>
                      <StatusBadge status={campaign.status} />
                      <span className="rounded-[5px] bg-[#F5F4ED] px-2 py-0.5 font-['Space_Grotesk'] text-[10px] font-medium text-[#565B5B]">
                        {TYPE_LABELS[campaign.type] ?? campaign.type.replaceAll("_", " ")}
                      </span>
                    </div>

                    <p className="mt-1 line-clamp-2 max-w-[600px] font-['Space_Grotesk'] text-[12px] leading-5 text-[#666A68]">
                      {campaign.primaryObjective || "No campaign objective added."}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-['Space_Grotesk'] text-[10px] text-[#747878]">
                      <span>Created {formatDate(campaign.createdAt)}</span>
                      {campaign.updatedAt ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Updated {formatDate(campaign.updatedAt)}</span>
                        </>
                      ) : null}
                      {campaign.targetAudience ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="truncate max-w-[240px]">
                            Audience: {campaign.targetAudience}
                          </span>
                        </>
                      ) : null}
                    </div>

                    {/* Execution Status & Progress Bar */}
                    <div className="mt-3 max-w-[440px]">
                      <div className="flex flex-wrap items-center justify-between gap-2 font-['Space_Grotesk'] text-[10px] text-[#747878]">
                        <span>{progress.label}</span>
                        <span className="tabular-nums">
                          <strong className="text-[#1B1C18]">{formatNumber(stats.inProgressCalls)}</strong>{" "}
                          calling ·{" "}
                          <strong className="text-[#1B1C18]">{formatNumber(stats.pendingCalls)}</strong>{" "}
                          pending ·{" "}
                          <strong className="text-[#1B1C18]">
                            {formatNumber(stats.completedQueueCalls)}
                          </strong>{" "}
                          done ·{" "}
                          <strong className="text-[#1B1C18]">{formatNumber(stats.failedCalls)}</strong>{" "}
                          failed
                        </span>
                      </div>
                      <div
                        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#ECEBE5]"
                        role="progressbar"
                        aria-label={`${campaign.name} execution progress`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progress.percent}
                      >
                        <div
                          className="h-full rounded-full bg-[#7852D6] transition-[width]"
                          style={{ width: `${progress.percent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Area B: Horizontal Performance Metrics */}
                  <div className="grid grid-cols-3 gap-3 rounded-[8px] border border-[#F0EFE9] bg-[#FCFBF8] px-3.5 py-2.5 lg:gap-4">
                    <div>
                      <p className="font-['Space_Grotesk'] text-[10px] font-medium text-[#747878]">
                        Calls placed
                      </p>
                      <p className="mt-1 font-['Newsreader'] text-[22px] leading-none text-[#1B1C18]">
                        {formatNumber(total)}
                      </p>
                    </div>
                    <div>
                      <p className="font-['Space_Grotesk'] text-[10px] font-medium text-[#747878]">
                        Connected
                      </p>
                      <p className="mt-1 font-['Newsreader'] text-[22px] leading-none text-[#1B1C18]">
                        {formatNumber(connected)}
                      </p>
                    </div>
                    <div>
                      <p className="font-['Space_Grotesk'] text-[10px] font-medium text-[#747878]">
                        High intent
                      </p>
                      <p className="mt-1 font-['Newsreader'] text-[22px] leading-none text-[#1B1C18]">
                        {formatNumber(highIntent)}
                      </p>
                    </div>
                  </div>

                  {/* Area C: Contextual Primary Action + Actions Menu */}
                  <div className="flex items-center justify-end gap-2 border-t border-[#F0EFE9] pt-3 lg:border-0 lg:pt-0">
                    {campaign.status === "draft" ? (
                      <button
                        type="button"
                        onClick={() => openLaunch(campaign)}
                        className="inline-flex h-9 items-center justify-center rounded-[6px] bg-[#1B1C18] px-3.5 font-['Space_Grotesk'] text-[12px] font-semibold text-white transition-colors hover:bg-[#34352F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6]"
                      >
                        Start campaign
                      </button>
                    ) : campaign.status === "paused" ? (
                      <button
                        type="button"
                        onClick={() => changeCampaignStatus(campaign, "active")}
                        className="inline-flex h-9 items-center justify-center rounded-[6px] bg-[#1B1C18] px-3.5 font-['Space_Grotesk'] text-[12px] font-semibold text-white transition-colors hover:bg-[#34352F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6]"
                      >
                        Resume campaign
                      </button>
                    ) : campaign.status === "active" ? (
                      <button
                        type="button"
                        onClick={() => changeCampaignStatus(campaign, "paused")}
                        className="inline-flex h-9 items-center justify-center rounded-[6px] border border-[#DCDDD6] bg-white px-3.5 font-['Space_Grotesk'] text-[12px] font-semibold text-[#444748] transition-colors hover:bg-[#F5F4ED] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6]"
                      >
                        Pause
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedDetailCampaign(campaign)}
                        className="inline-flex h-9 items-center justify-center rounded-[6px] border border-[#DCDDD6] bg-white px-3.5 font-['Space_Grotesk'] text-[12px] font-semibold text-[#444748] transition-colors hover:bg-[#F5F4ED]"
                      >
                        View details
                      </button>
                    )}

                    {/* Contextual Three-Dot Menu */}
                    <div
                      className="relative"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        aria-label={`More actions for ${campaign.name}`}
                        aria-expanded={menuOpen}
                        aria-haspopup="menu"
                        onClick={() =>
                          setOpenMenuId((current) => (current === campaign.id ? null : campaign.id))
                        }
                        className="inline-flex h-9 w-9 items-center justify-center rounded-[6px] border border-[#E5E4DC] bg-white text-[#444748] transition-colors hover:bg-[#F5F4ED] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6]"
                      >
                        <span className="text-[14px] leading-none" aria-hidden="true">
                          ⋮
                        </span>
                      </button>

                      {menuOpen ? (
                        <div
                          role="menu"
                          className="absolute right-0 top-full z-30 mt-1.5 w-48 overflow-hidden rounded-[8px] border border-[#E9E8E1] bg-white p-1 shadow-[0_10px_28px_rgba(27,28,24,0.12)]"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setOpenMenuId(null);
                              setSelectedDetailCampaign(campaign);
                            }}
                            className="flex w-full items-center rounded-[5px] px-3 py-2 text-left font-['Space_Grotesk'] text-[12px] text-[#1B1C18] hover:bg-[#F5F4ED]"
                          >
                            View details
                          </button>
                          {campaign.status !== "completed" ? (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenMenuId(null);
                                setEditingCampaign(campaign);
                              }}
                              className="flex w-full items-center rounded-[5px] px-3 py-2 text-left font-['Space_Grotesk'] text-[12px] text-[#1B1C18] hover:bg-[#F5F4ED]"
                            >
                              Edit campaign
                            </button>
                          ) : null}
                          <Link
                            href="/dashboard/analytics"
                            role="menuitem"
                            onClick={() => setOpenMenuId(null)}
                            className="flex w-full items-center rounded-[5px] px-3 py-2 font-['Space_Grotesk'] text-[12px] text-[#1B1C18] hover:bg-[#F5F4ED]"
                          >
                            View performance
                          </Link>
                          {campaign.status === "active" ? (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => changeCampaignStatus(campaign, "paused")}
                              className="flex w-full items-center rounded-[5px] px-3 py-2 text-left font-['Space_Grotesk'] text-[12px] text-[#1B1C18] hover:bg-[#F5F4ED]"
                            >
                              Pause campaign
                            </button>
                          ) : null}
                          {campaign.status === "paused" ? (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => changeCampaignStatus(campaign, "active")}
                              className="flex w-full items-center rounded-[5px] px-3 py-2 text-left font-['Space_Grotesk'] text-[12px] text-[#1B1C18] hover:bg-[#F5F4ED]"
                            >
                              Resume campaign
                            </button>
                          ) : null}
                          {campaign.status === "draft" ? (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenMenuId(null);
                                setDeletingDraft(campaign);
                              }}
                              className="mt-1 flex w-full items-center border-t border-[#F0EFE9] rounded-[5px] px-3 py-2 text-left font-['Space_Grotesk'] text-[12px] font-semibold text-[#A33A32] hover:bg-[#FDF2F1]"
                            >
                              Delete draft
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          /* Contextual Empty States */
          <div className="flex flex-col items-center px-5 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F2EEFA] text-[#644ABB]">
              <MetricIcon kind="layers" className="h-5 w-5" />
            </span>
            {campaigns.length === 0 ? (
              <>
                <h3 className="mt-4 font-['Newsreader'] text-[26px] text-[#1B1C18]">
                  No campaigns yet
                </h3>
                <p className="mt-1.5 max-w-[400px] font-['Space_Grotesk'] text-[12px] leading-5 text-[#747878]">
                  Create your first voice campaign to start reaching your contacts.
                </p>
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="mt-5 inline-flex h-10 items-center gap-2 rounded-[6px] bg-[#1B1C18] px-4 font-['Space_Grotesk'] text-[12px] font-semibold text-white hover:bg-[#34352F]"
                >
                  Create campaign
                </button>
              </>
            ) : debouncedQuery.trim() ? (
              <>
                <h3 className="mt-4 font-['Newsreader'] text-[26px] text-[#1B1C18]">
                  No matching campaigns
                </h3>
                <p className="mt-1.5 max-w-[400px] font-['Space_Grotesk'] text-[12px] leading-5 text-[#747878]">
                  Try a different search term or clear your filters.
                </p>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="mt-5 inline-flex h-9 items-center justify-center rounded-[6px] border border-[#DCDDD6] bg-white px-4 font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18] hover:bg-[#F5F4ED]"
                >
                  Clear search
                </button>
              </>
            ) : (
              <>
                <h3 className="mt-4 font-['Newsreader'] text-[26px] text-[#1B1C18]">
                  No campaigns in this category
                </h3>
                <p className="mt-1.5 max-w-[400px] font-['Space_Grotesk'] text-[12px] leading-5 text-[#747878]">
                  Campaigns with this status will appear here.
                </p>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="mt-5 inline-flex h-9 items-center justify-center rounded-[6px] border border-[#DCDDD6] bg-white px-4 font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18] hover:bg-[#F5F4ED]"
                  >
                    Clear filters
                  </button>
                ) : null}
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
