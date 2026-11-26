"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { dashboardKeys } from "@/lib/query/keys";
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
import { ToastNotice } from "@/components/dashboard/toast-notice";

type CampaignStats = {
  totalCalls?: number;
  connectedCalls?: number;
  highInterestCalls?: number;
  pendingCalls?: number;
  inProgressCalls?: number;
  failedCalls?: number;
  completedQueueCalls?: number;
};

type ObjectionHandler = {
  objection: string;
  response: string;
};

type Campaign = {
  id: string;
  name: string;
  type: string;
  status: string;
  primaryObjective: string;
  callOpeningHook?: string;
  keyTalkingPoints?: string[];
  objectionHandlers?: unknown[];
  callToAction?: string;
  fallbackOffer?: string | null;
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
  initialCampaignId?: string | null;
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
  | "updated"
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

const AUTO_LANGUAGE_PROMPT =
  "At the beginning of the call, ask the customer which language they would prefer to speak. Offer English, Hindi, Telugu, Tamil, Kannada, and Malayalam. Continue the conversation in the language they choose. Do not assume their preferred language.";

const INPUT =
  "mt-1.5 h-10 w-full rounded-[8px] border border-[#DCDDD6] bg-white px-3.5 font-['Space_Grotesk'] text-[13px] text-[#1B1C18] outline-none transition-colors placeholder:text-[#A0A19A] focus:border-[#7852D6] focus:ring-2 focus:ring-[#7852D6]/15";
const TEXTAREA =
  "mt-1.5 w-full rounded-[8px] border border-[#DCDDD6] bg-white px-3.5 py-2.5 font-['Space_Grotesk'] text-[13px] leading-5 text-[#1B1C18] outline-none transition-colors placeholder:text-[#A0A19A] focus:border-[#7852D6] focus:ring-2 focus:ring-[#7852D6]/15";
const LABEL = "block font-['Space_Grotesk'] text-[12px] font-semibold text-[#3B3E3B]";

const STATUS_STYLES: Record<string, string> = {
  draft: "border-[#E3E0D6] bg-[#F7F5EF] text-[#5C5E56]",
  active: "border-[#C8E3D0] bg-[#EEF8F1] text-[#28683E]",
  paused: "border-[#EEDBA8] bg-[#FFF9EA] text-[#84621E]",
  completed: "border-[#D5DBE6] bg-[#F1F4F9] text-[#4D5A73]",
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
  updated: "Recently updated",
  name_asc: "Campaign name (A–Z)",
  most_calls: "Most calls placed",
  highest_connection_rate: "Highest connection rate",
};

function cleanDisplayTitle(raw: string): string {
  return raw
    .replace(/\\+\s*\|?/g, " · ")
    .replace(/\s*·\s*·\s*/g, " · ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function cleanScriptText(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/\\\{/g, "{")
    .replace(/\\\}/g, "}")
    .replace(/\\+/g, "")
    .trim();
}

function normalizeObjectionHandlers(rawHandlers: unknown[] | undefined): ObjectionHandler[] {
  if (!Array.isArray(rawHandlers)) return [];
  const normalized: ObjectionHandler[] = [];

  for (const item of rawHandlers) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const rawObj =
      typeof row.objection === "string"
        ? row.objection
        : typeof row.trigger === "string"
          ? row.trigger
          : typeof row.question === "string"
            ? row.question
            : "";
    const rawResp =
      typeof row.response === "string"
        ? row.response
        : typeof row.reply === "string"
          ? row.reply
          : typeof row.answer === "string"
            ? row.answer
            : "";

    const objection = cleanScriptText(rawObj);
    const response = cleanScriptText(rawResp);
    if (objection || response) {
      normalized.push({ objection, response });
    }
  }

  return normalized;
}

function serializeObjectionHandlers(handlers: ObjectionHandler[]): ObjectionHandler[] {
  return handlers
    .map((h) => ({
      objection: h.objection.trim(),
      response: h.response.trim(),
    }))
    .filter((h) => h.objection.length > 0 && h.response.length > 0);
}

function extractEditableTalkingPoints(points: string[] | undefined): string[] {
  if (!points?.length) return [];
  const filtered = points
    .map((line) => cleanScriptText(line))
    .filter((line) => line.length > 0 && line !== AUTO_LANGUAGE_PROMPT);

  const merged: string[] = [];
  for (const item of filtered) {
    if (merged.length > 0 && /^[a-z]/.test(item)) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${item}`;
    } else {
      merged.push(item);
    }
  }
  return merged;
}

function buildTalkingPointsPayload(language: string, rawLines: string): string[] {
  const parsed = rawLines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (language === "auto") {
    return [AUTO_LANGUAGE_PROMPT, ...parsed.filter((line) => line !== AUTO_LANGUAGE_PROMPT)];
  }
  return parsed.filter((line) => line !== AUTO_LANGUAGE_PROMPT);
}

function formatNumber(value: number | undefined) {
  return new Intl.NumberFormat("en-IN").format(value ?? 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function isTransientDbMessage(msg: string | null | undefined): boolean {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return (
    lower.includes("temporary database connection") ||
    lower.includes("database connection issue") ||
    lower.includes("connection terminated") ||
    lower.includes("econnreset") ||
    lower.includes("etimedout") ||
    lower.includes("too many clients")
  );
}

async function withTransientRetry<T extends { ok: boolean; error?: string }>(
  fn: () => Promise<T>,
  retries = 2,
): Promise<T> {
  let lastResult = await fn();
  for (let attempt = 0; attempt < retries; attempt++) {
    if (lastResult.ok || !isTransientDbMessage(lastResult.error)) {
      return lastResult;
    }
    await new Promise((resolve) => setTimeout(resolve, 450 * (attempt + 1)));
    lastResult = await fn();
  }
  return lastResult;
}

type IconKind =
  | "layers"
  | "activity"
  | "file-edit"
  | "phone"
  | "search"
  | "sliders"
  | "more"
  | "play"
  | "pause"
  | "rocket"
  | "eye"
  | "edit"
  | "copy"
  | "trash"
  | "chart"
  | "close"
  | "plus";

function Icon({ kind, className = "h-4 w-4" }: { kind: IconKind; className?: string }) {
  const artwork: Record<IconKind, ReactNode> = {
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
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </>
    ),
    sliders: (
      <>
        <line x1="4" y1="6" x2="20" y2="6" />
        <line x1="7" y1="12" x2="17" y2="12" />
        <line x1="10" y1="18" x2="14" y2="18" />
      </>
    ),
    more: (
      <>
        <circle cx="12" cy="5" r="1.25" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
        <circle cx="12" cy="19" r="1.25" fill="currentColor" stroke="none" />
      </>
    ),
    play: <polygon points="6 4 20 12 6 20 6 4" />,
    pause: (
      <>
        <rect x="6" y="4" width="4" height="16" rx="1" />
        <rect x="14" y="4" width="4" height="16" rx="1" />
      </>
    ),
    rocket: (
      <>
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09Z" />
        <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2Z" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    edit: (
      <>
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      </>
    ),
    copy: (
      <>
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18" />
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      </>
    ),
    chart: (
      <>
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </>
    ),
    close: (
      <>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
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
  onClick,
  href,
}: {
  label: string;
  value: string;
  detail: string;
  icon: IconKind;
  onClick?: () => void;
  href?: string;
}) {
  const baseClass =
    "group flex h-[112px] w-full flex-col justify-between rounded-[12px] border border-[#E9E8E1] bg-white p-4 text-left transition-colors hover:border-[#D4D2C8] hover:bg-[#FCFBF8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6]/40 sm:px-5";

  const inner = (
    <>
      <div className="flex w-full items-center justify-between gap-2">
        <span className="font-['Space_Grotesk'] text-[12px] font-medium text-[#5C5F5C]">
          {label}
        </span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] border border-[#ECEBE5] bg-[#FAF9F5] text-[#666A68] transition-colors group-hover:text-[#1B1C18]">
          <Icon kind={icon} className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-['Newsreader'] text-[30px] leading-none tracking-[-0.5px] text-[#1B1C18]">
          {value}
        </p>
        <p className="truncate font-['Space_Grotesk'] text-[11px] text-[#7A7D7A]">{detail}</p>
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
      <button type="button" onClick={onClick} className={baseClass}>
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
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-['Space_Grotesk'] text-[11px] font-semibold capitalize ${
        STATUS_STYLES[normalized] ?? STATUS_STYLES.draft
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-85" aria-hidden="true" />
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
    <section className="rounded-[12px] border border-[#E9E8E1] bg-white p-5 sm:p-6">
      <div className="mb-4 border-b border-[#F0EFE9] pb-3.5">
        <h2 className="font-['Space_Grotesk'] text-[14px] font-semibold text-[#1B1C18]">{title}</h2>
        <p className="mt-0.5 font-['Space_Grotesk'] text-[12px] text-[#747878]">{description}</p>
      </div>
      {children}
    </section>
  );
}

function ObjectionHandlersEditor({
  handlers,
  onChange,
}: {
  handlers: ObjectionHandler[];
  onChange: (next: ObjectionHandler[]) => void;
}) {
  const addRow = () => {
    onChange([...handlers, { objection: "", response: "" }]);
  };

  const updateRow = (index: number, patch: Partial<ObjectionHandler>) => {
    onChange(handlers.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  const removeRow = (index: number) => {
    onChange(handlers.filter((_, idx) => idx !== index));
  };

  return (
    <div className="mt-5 border-t border-[#F0EFE9] pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-['Space_Grotesk'] text-[12px] font-semibold text-[#3B3E3B]">
            Objection handlers <span className="font-normal text-[#747878]">Optional</span>
          </p>
          <p className="font-['Space_Grotesk'] text-[11px] text-[#747878]">
            Define how the agent responds when a contact raises a common pushback.
          </p>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex h-8 items-center gap-1 rounded-[7px] border border-[#DCDDD6] bg-[#FAF9F5] px-3 font-['Space_Grotesk'] text-[11px] font-semibold text-[#1B1C18] transition-colors hover:bg-[#F2F0E8]"
        >
          <Icon kind="plus" className="h-3 w-3" />
          Add objection
        </button>
      </div>

      {handlers.length > 0 ? (
        <div className="mt-3 space-y-3">
          {handlers.map((item, idx) => (
            <div
              key={idx}
              className="rounded-[10px] border border-[#ECEBE5] bg-[#FAF9F5] p-3.5"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-['Space_Grotesk'] text-[11px] font-semibold text-[#644ABB]">
                  Objection #{idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  aria-label={`Remove objection ${idx + 1}`}
                  className="inline-flex items-center gap-1 rounded px-2 py-0.5 font-['Space_Grotesk'] text-[11px] font-medium text-[#A33A32] hover:bg-[#FDF2F1]"
                >
                  <Icon kind="trash" className="h-3 w-3" />
                  Remove
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={LABEL}>
                  Customer says
                  <input
                    value={item.objection}
                    onChange={(e) => updateRow(idx, { objection: e.target.value })}
                    maxLength={300}
                    className={INPUT}
                    placeholder="e.g. I don't have time right now"
                  />
                </label>
                <label className={LABEL}>
                  Agent response
                  <input
                    value={item.response}
                    onChange={(e) => updateRow(idx, { response: e.target.value })}
                    maxLength={1000}
                    className={INPUT}
                    placeholder="e.g. No problem—can I send a 60-second overview?"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CampaignForm({
  initialDraft,
  onCancel,
  onCreated,
}: {
  initialDraft?: Campaign | null;
  onCancel: () => void;
  onCreated: (
    message?: string,
    options?: {
      createdCampaignId?: string | null;
      createdCampaign?: Campaign | null;
      launchImmediately?: boolean;
    },
  ) => void;
}) {
  const [busy, setBusy] = useState(false);
  const submittingRef = useRef(false);
  const launchAfterSaveRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [objectionHandlers, setObjectionHandlers] = useState<ObjectionHandler[]>(() =>
    normalizeObjectionHandlers(initialDraft?.objectionHandlers),
  );

  const defaultTalkingPoints = useMemo(() => {
    return extractEditableTalkingPoints(initialDraft?.keyTalkingPoints).join("\n");
  }, [initialDraft]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current || busy) return;

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get("name") ?? "").trim();
    const type = String(form.get("type") ?? "outreach_sales") as CampaignType;
    const primaryObjective = String(form.get("primaryObjective") ?? "").trim();
    const callOpeningHook = String(form.get("callOpeningHook") ?? "").trim();
    const rawTalkingPoints = String(form.get("keyTalkingPoints") ?? "");
    const callToAction = String(form.get("callToAction") ?? "").trim();
    const fallbackOffer = String(form.get("fallbackOffer") ?? "").trim() || undefined;
    const targetAudience = String(form.get("targetAudience") ?? "").trim() || undefined;
    const language = String(form.get("language") ?? "auto");
    const maxDurationSeconds = Number(form.get("maxDurationSeconds") ?? 300);

    const editablePoints = extractEditableTalkingPoints(
      rawTalkingPoints
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    );

    if (editablePoints.length === 0) {
      setError("Add at least one talking point for the voice agent.");
      return;
    }

    const launchImmediately = launchAfterSaveRef.current;
    launchAfterSaveRef.current = false;

    submittingRef.current = true;
    setBusy(true);
    setError(null);

    const talkingPointsPayload = buildTalkingPointsPayload(language, rawTalkingPoints);
    const serializedHandlers = serializeObjectionHandlers(objectionHandlers);

    try {
      const result = await createCampaignAction({
        name,
        type,
        primaryObjective,
        callOpeningHook,
        keyTalkingPoints: talkingPointsPayload,
        objectionHandlers: serializedHandlers,
        callToAction,
        fallbackOffer,
        targetAudience,
        language,
        maxDurationSeconds,
      });

      if (!result.ok) {
        setError(result.error || "Your campaign draft could not be saved.");
        return;
      }

      const rawData = result.data as Record<string, unknown> | undefined;
      const createdRecord =
        rawData && typeof rawData.campaign === "object" && rawData.campaign !== null
          ? (rawData.campaign as Record<string, unknown>)
          : rawData;
      const createdId =
        createdRecord && typeof createdRecord.id === "string"
          ? createdRecord.id
          : `temp-${Date.now()}`;
      const nowIso = new Date().toISOString();

      const optimisticCampaign: Campaign = {
        id: createdId,
        name: typeof createdRecord?.name === "string" ? createdRecord.name : name,
        type: typeof createdRecord?.type === "string" ? createdRecord.type : type,
        status: typeof createdRecord?.status === "string" ? createdRecord.status : "draft",
        primaryObjective:
          typeof createdRecord?.primaryObjective === "string"
            ? createdRecord.primaryObjective
            : primaryObjective,
        callOpeningHook:
          typeof createdRecord?.callOpeningHook === "string"
            ? createdRecord.callOpeningHook
            : callOpeningHook,
        keyTalkingPoints: Array.isArray(createdRecord?.keyTalkingPoints)
          ? (createdRecord.keyTalkingPoints as string[])
          : talkingPointsPayload,
        objectionHandlers: Array.isArray(createdRecord?.objectionHandlers)
          ? (createdRecord.objectionHandlers as unknown[])
          : serializedHandlers,
        callToAction:
          typeof createdRecord?.callToAction === "string"
            ? createdRecord.callToAction
            : callToAction,
        fallbackOffer:
          typeof createdRecord?.fallbackOffer === "string"
            ? createdRecord.fallbackOffer
            : (fallbackOffer ?? null),
        targetAudience:
          typeof createdRecord?.targetAudience === "string"
            ? createdRecord.targetAudience
            : (targetAudience ?? null),
        language:
          typeof createdRecord?.language === "string" ? createdRecord.language : language,
        maxDurationSeconds:
          typeof createdRecord?.maxDurationSeconds === "number"
            ? createdRecord.maxDurationSeconds
            : maxDurationSeconds,
        createdAt:
          typeof createdRecord?.createdAt === "string" ? createdRecord.createdAt : nowIso,
        updatedAt:
          typeof createdRecord?.updatedAt === "string" ? createdRecord.updatedAt : nowIso,
        stats: {
          totalCalls: 0,
          connectedCalls: 0,
          highInterestCalls: 0,
          pendingCalls: 0,
          inProgressCalls: 0,
          failedCalls: 0,
          completedQueueCalls: 0,
        },
      };

      onCreated(
        initialDraft
          ? `Duplicated "${cleanDisplayTitle(initialDraft.name)}" as a new draft.`
          : "Campaign draft saved. Review your audience before launching outbound calls.",
        {
          createdCampaignId: createdId,
          createdCampaign: optimisticCampaign,
          launchImmediately,
        },
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your campaign draft could not be saved.");
    } finally {
      submittingRef.current = false;
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
            className="mb-2.5 inline-flex items-center gap-1.5 font-['Space_Grotesk'] text-[12px] font-semibold text-[#644ABB] hover:text-[#4F369A]"
          >
            <span aria-hidden="true">←</span> Back to campaigns
          </button>
          <p className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.12em] text-[#644ABB]">
            {initialDraft ? "Duplicate campaign" : "Campaign builder"}
          </p>
          <h1 className="mt-1 font-['Newsreader'] text-[34px] leading-tight tracking-[-0.8px] text-[#1B1C18]">
            {initialDraft ? `Copy of ${cleanDisplayTitle(initialDraft.name)}` : "Create a campaign"}
          </h1>
          <p className="mt-1.5 max-w-[600px] font-['Space_Grotesk'] text-[12px] leading-5 text-[#666A68]">
            Set the goal and conversation outline. Your campaign is saved as a draft. No contacts
            are called until you review and confirm a launch.
          </p>
        </div>
        <span className="rounded-full border border-[#E2D9F8] bg-[#F7F4FC] px-3 py-1 font-['Space_Grotesk'] text-[11px] font-semibold text-[#644ABB]">
          Draft first
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
                defaultValue={initialDraft ? `${cleanDisplayTitle(initialDraft.name)} (Copy)` : ""}
                className={INPUT}
                placeholder="e.g. New enquiries follow-up"
              />
            </label>
            <label className={LABEL}>
              Campaign purpose
              <select
                name="type"
                className={INPUT}
                defaultValue={initialDraft?.type || "outreach_sales"}
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
          <label className={`${LABEL} mt-4`}>
            What should this campaign achieve?
            <textarea
              name="primaryObjective"
              required
              rows={3}
              maxLength={2000}
              defaultValue={initialDraft?.primaryObjective ?? ""}
              className={TEXTAREA}
              placeholder="Describe the result you want from these conversations."
            />
          </label>
          <label className={`${LABEL} mt-4`}>
            Who is this campaign for? <span className="font-normal text-[#747878]">Optional</span>
            <input
              name="targetAudience"
              defaultValue={initialDraft?.targetAudience ?? ""}
              className={INPUT}
              placeholder="e.g. Business owners, founders, sales leads"
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
              defaultValue={cleanScriptText(initialDraft?.callOpeningHook)}
              className={TEXTAREA}
              placeholder="Write a clear, natural opening for the agent."
            />
          </label>
          <label className={`${LABEL} mt-4`}>
            What should the agent cover?{" "}
            <span className="font-normal text-[#747878]">One point per line</span>
            <textarea
              name="keyTalkingPoints"
              required
              rows={5}
              maxLength={4000}
              defaultValue={defaultTalkingPoints}
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
              defaultValue={cleanScriptText(initialDraft?.callToAction)}
              className={INPUT}
              placeholder="e.g. Book a consultation"
            />
          </label>
          <label className={`${LABEL} mt-4`}>
            If the customer is not ready{" "}
            <span className="font-normal text-[#747878]">Optional</span>
            <input
              name="fallbackOffer"
              maxLength={500}
              defaultValue={cleanScriptText(initialDraft?.fallbackOffer)}
              className={INPUT}
              placeholder="e.g. Offer to send more information by email"
            />
          </label>

          <ObjectionHandlersEditor
            handlers={objectionHandlers}
            onChange={setObjectionHandlers}
          />
        </FormSection>

        <FormSection
          title="Call settings"
          description="Choose how the agent handles language preferences and set the maximum duration for each call."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={LABEL}>
              Language preference
              <select
                name="language"
                defaultValue={initialDraft?.language || "auto"}
                className={INPUT}
              >
                <option value="auto">Ask customer (Recommended)</option>
                <option value="en-IN">English (India)</option>
                <option value="hi-IN">Hindi</option>
                <option value="te-IN">Telugu</option>
                <option value="ta-IN">Tamil</option>
                <option value="kn-IN">Kannada</option>
                <option value="ml-IN">Malayalam</option>
              </select>
            </label>
            <label className={LABEL}>
              Maximum call duration
              <select
                name="maxDurationSeconds"
                defaultValue={String(initialDraft?.maxDurationSeconds ?? 300)}
                className={INPUT}
              >
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
            className="rounded-[8px] border border-[#F0D8D4] bg-[#FFF8F7] px-4 py-3 font-['Space_Grotesk'] text-[12px] text-[#A33A32]"
          >
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ECEBE5] pt-4">
          <p className="font-['Space_Grotesk'] text-[11px] text-[#747878]">
            Saving creates a draft only. You can review the audience and approve outbound activity
            separately.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="h-10 rounded-[8px] border border-[#DCDDD6] bg-white px-4 font-['Space_Grotesk'] text-[12px] font-semibold text-[#444748] hover:bg-[#F7F6F1] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              onClick={() => {
                launchAfterSaveRef.current = false;
              }}
              className="h-10 rounded-[8px] border border-[#DCDDD6] bg-white px-4 font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18] transition-colors hover:bg-[#F5F4ED] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Saving draft…" : "Save campaign draft"}
            </button>
            <button
              type="submit"
              disabled={busy}
              onClick={() => {
                launchAfterSaveRef.current = true;
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-[8px] bg-[#1B1C18] px-5 font-['Space_Grotesk'] text-[12px] font-semibold text-white transition-colors hover:bg-[#34352F] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon kind="rocket" className="h-3.5 w-3.5" />
              {busy ? "Saving…" : "Save & launch"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function CampaignFullEditor({
  campaign,
  onCancel,
  onSaved,
}: {
  campaign: Campaign;
  onCancel: () => void;
  onSaved: (message: string, patch?: Partial<Campaign>) => void;
}) {
  const initialTalkingPointsText = useMemo(
    () => extractEditableTalkingPoints(campaign.keyTalkingPoints).join("\n"),
    [campaign.keyTalkingPoints],
  );
  const initialOpeningHook = useMemo(
    () => cleanScriptText(campaign.callOpeningHook),
    [campaign.callOpeningHook],
  );
  const initialCallToAction = useMemo(
    () => cleanScriptText(campaign.callToAction),
    [campaign.callToAction],
  );
  const initialFallbackOffer = useMemo(
    () => cleanScriptText(campaign.fallbackOffer),
    [campaign.fallbackOffer],
  );
  const initialHandlers = useMemo(
    () => normalizeObjectionHandlers(campaign.objectionHandlers),
    [campaign.objectionHandlers],
  );
  const initialLanguage = campaign.language || "auto";
  const initialDuration = campaign.maxDurationSeconds ?? 300;

  const [name, setName] = useState(() => cleanDisplayTitle(campaign.name));
  const [type, setType] = useState<string>(() => campaign.type || "outreach_sales");
  const [primaryObjective, setPrimaryObjective] = useState(() => campaign.primaryObjective ?? "");
  const [targetAudience, setTargetAudience] = useState(() => campaign.targetAudience ?? "");
  const [callOpeningHook, setCallOpeningHook] = useState(() => initialOpeningHook);
  const [talkingPointsText, setTalkingPointsText] = useState(() => initialTalkingPointsText);
  const [objectionHandlers, setObjectionHandlers] = useState<ObjectionHandler[]>(
    () => initialHandlers,
  );
  const [callToAction, setCallToAction] = useState(() => initialCallToAction);
  const [fallbackOffer, setFallbackOffer] = useState(() => initialFallbackOffer);
  const [language, setLanguage] = useState<string>(() => initialLanguage);
  const [maxDurationSeconds, setMaxDurationSeconds] = useState<number>(() => initialDuration);

  const [busy, setBusy] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty =
    name !== cleanDisplayTitle(campaign.name) ||
    type !== (campaign.type || "outreach_sales") ||
    primaryObjective !== (campaign.primaryObjective ?? "") ||
    targetAudience !== (campaign.targetAudience ?? "") ||
    callOpeningHook !== initialOpeningHook ||
    talkingPointsText !== initialTalkingPointsText ||
    JSON.stringify(objectionHandlers) !== JSON.stringify(initialHandlers) ||
    callToAction !== initialCallToAction ||
    fallbackOffer !== initialFallbackOffer ||
    language !== initialLanguage ||
    maxDurationSeconds !== initialDuration;

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingRef.current || busy) return;

    const trimmedName = name.trim();
    const trimmedObjective = primaryObjective.trim();
    const trimmedHook = callOpeningHook.trim();
    const trimmedCta = callToAction.trim();
    const parsedPoints = extractEditableTalkingPoints(
      talkingPointsText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    );

    if (!trimmedName || !trimmedObjective) {
      setError("Campaign name and objective are required.");
      return;
    }
    if (!trimmedHook) {
      setError("Opening greeting is required for the voice agent.");
      return;
    }
    if (parsedPoints.length === 0) {
      setError("Add at least one talking point for the voice agent.");
      return;
    }
    if (!trimmedCta) {
      setError("Next step / call to action is required.");
      return;
    }

    savingRef.current = true;
    setBusy(true);
    setError(null);

    try {
      const payload = {
        name: trimmedName,
        type,
        primaryObjective: trimmedObjective,
        targetAudience: targetAudience.trim() || null,
        callOpeningHook: trimmedHook,
        keyTalkingPoints: buildTalkingPointsPayload(language, talkingPointsText),
        objectionHandlers: serializeObjectionHandlers(objectionHandlers),
        callToAction: trimmedCta,
        fallbackOffer: fallbackOffer.trim() || null,
        language,
        maxDurationSeconds,
      };

      const result = await withTransientRetry(() =>
        updateCampaignDetailsAction(campaign.id, payload),
      );
      if (!result.ok) {
        setError(result.error || "Unable to update campaign details.");
        return;
      }

      onSaved(`Saved all changes for "${trimmedName}".`, {
        ...payload,
        updatedAt: new Date().toISOString(),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update campaign details.");
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="mt-6 space-y-4">
      <FormSection
        title="Campaign basics"
        description="Update the campaign name, purpose, objective, and intended audience."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={LABEL}>
            Campaign name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              className={INPUT}
              placeholder="e.g. New enquiries follow-up"
            />
          </label>
          <label className={LABEL}>
            Campaign purpose
            <select value={type} onChange={(e) => setType(e.target.value)} className={INPUT}>
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
          Primary objective
          <textarea
            value={primaryObjective}
            onChange={(e) => setPrimaryObjective(e.target.value)}
            required
            rows={3}
            maxLength={2000}
            className={TEXTAREA}
            placeholder="Describe what this campaign should achieve."
          />
        </label>

        <label className={`${LABEL} mt-4`}>
          Target audience <span className="font-normal text-[#747878]">Optional</span>
          <input
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            className={INPUT}
            placeholder="e.g. Business owners, founders, sales leads"
          />
        </label>
      </FormSection>

      <FormSection
        title="Conversation plan &amp; script"
        description="Edit how the voice agent opens calls, covers talking points, and guides next steps."
      >
        <label className={LABEL}>
          Opening greeting
          <textarea
            value={callOpeningHook}
            onChange={(e) => setCallOpeningHook(e.target.value)}
            required
            rows={3}
            maxLength={2000}
            className={TEXTAREA}
            placeholder="Write a clear, natural opening for the agent."
          />
        </label>

        <label className={`${LABEL} mt-4`}>
          Key talking points{" "}
          <span className="font-normal text-[#747878]">One point per line</span>
          <textarea
            value={talkingPointsText}
            onChange={(e) => setTalkingPointsText(e.target.value)}
            required
            rows={5}
            maxLength={4000}
            className={TEXTAREA}
            placeholder={
              "Introduce the reason for the call.\nAnswer common questions using approved information.\nAsk whether the customer would like the next step."
            }
          />
        </label>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className={LABEL}>
            Next step (call to action)
            <input
              value={callToAction}
              onChange={(e) => setCallToAction(e.target.value)}
              required
              maxLength={500}
              className={INPUT}
              placeholder="e.g. Book a product walkthrough"
            />
          </label>
          <label className={LABEL}>
            Fallback offer <span className="font-normal text-[#747878]">Optional</span>
            <input
              value={fallbackOffer}
              onChange={(e) => setFallbackOffer(e.target.value)}
              maxLength={500}
              className={INPUT}
              placeholder="e.g. Offer to send a summary by email"
            />
          </label>
        </div>

        <ObjectionHandlersEditor
          handlers={objectionHandlers}
          onChange={setObjectionHandlers}
        />
      </FormSection>

      <FormSection
        title="Call settings"
        description="Configure language behavior and maximum allowed call duration."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={LABEL}>
            Language preference
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className={INPUT}
            >
              <option value="auto">Ask customer (Multi-language)</option>
              <option value="en-IN">English (India)</option>
              <option value="hi-IN">Hindi</option>
              <option value="te-IN">Telugu</option>
              <option value="ta-IN">Tamil</option>
              <option value="kn-IN">Kannada</option>
              <option value="ml-IN">Malayalam</option>
            </select>
          </label>
          <label className={LABEL}>
            Maximum call duration
            <select
              value={String(maxDurationSeconds)}
              onChange={(e) => setMaxDurationSeconds(Number(e.target.value))}
              className={INPUT}
            >
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
          className="rounded-[8px] border border-[#F0D8D4] bg-[#FFF8F7] px-4 py-3 font-['Space_Grotesk'] text-[12px] text-[#A33A32]"
        >
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#E9E8E1] bg-white px-5 py-4">
        <div className="font-['Space_Grotesk'] text-[12px] text-[#747878]">
          {isDirty ? (
            <span className="font-semibold text-[#644ABB]">You have unsaved edits.</span>
          ) : (
            <span>All changes are saved.</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-10 rounded-[8px] border border-[#DCDDD6] bg-white px-4 font-['Space_Grotesk'] text-[12px] font-semibold text-[#444748] hover:bg-[#F7F6F1] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !isDirty}
            className="h-10 rounded-[8px] bg-[#1B1C18] px-5 font-['Space_Grotesk'] text-[12px] font-semibold text-white transition-colors hover:bg-[#34352F] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Saving changes…" : "Save campaign"}
          </button>
        </div>
      </div>
    </form>
  );
}

function formatDurationLabel(seconds: number | null | undefined): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
    return "Default (5 mins)";
  }
  const mins = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return rem > 0 ? `${mins}m ${rem}s` : `${mins} ${mins === 1 ? "minute" : "minutes"}`;
}

function formatLanguageLabel(code: string | null | undefined): string {
  if (!code || code === "auto") return "Ask customer (Multi-language)";
  const map: Record<string, string> = {
    "en-IN": "English (India)",
    "hi-IN": "Hindi",
    "te-IN": "Telugu",
    "ta-IN": "Tamil",
    "kn-IN": "Kannada",
    "ml-IN": "Malayalam",
  };
  return map[code] ?? code;
}

function CampaignDetailView({
  campaign,
  initialTab = "overview",
  statusBusy = false,
  onBack,
  onLaunch,
  onStatusChange,
  onDuplicate,
  onDeleteCampaign,
  onSaved,
}: {
  campaign: Campaign;
  initialTab?: "overview" | "script" | "edit";
  statusBusy?: boolean;
  onBack: () => void;
  onLaunch: (campaign: Campaign) => void;
  onStatusChange: (campaign: Campaign, next: "active" | "paused") => void;
  onDuplicate: (campaign: Campaign) => void;
  onDeleteCampaign: (campaign: Campaign) => void;
  onSaved: (message: string, patch?: Partial<Campaign>) => void;
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "script" | "edit">(initialTab);
  const [actionsOpen, setActionsOpen] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [campaign.id, initialTab]);

  const stats = campaign.stats;
  const totalCalls = stats.totalCalls ?? 0;
  const connectedCalls = stats.connectedCalls ?? 0;
  const highIntentCalls = stats.highInterestCalls ?? 0;
  const connectionRate =
    totalCalls > 0 ? `${((connectedCalls / totalCalls) * 100).toFixed(0)}%` : "0%";
  const progress = computeExecutionProgress(campaign);
  const displayName = cleanDisplayTitle(campaign.name);
  const canEdit = campaign.status !== "completed";

  useEffect(() => {
    if (!canEdit && activeTab === "edit") {
      setActiveTab("overview");
    }
  }, [canEdit, activeTab]);

  useEffect(() => {
    if (!actionsOpen) return;
    const closeMenu = () => setActionsOpen(false);
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActionsOpen(false);
    };
    document.addEventListener("click", closeMenu);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("click", closeMenu);
      document.removeEventListener("keydown", onEsc);
    };
  }, [actionsOpen]);

  const cleanedOpeningHook = useMemo(
    () => cleanScriptText(campaign.callOpeningHook),
    [campaign.callOpeningHook],
  );

  const visibleTalkingPoints = useMemo(
    () => extractEditableTalkingPoints(campaign.keyTalkingPoints),
    [campaign.keyTalkingPoints],
  );

  const visibleObjectionHandlers = useMemo(
    () => serializeObjectionHandlers(normalizeObjectionHandlers(campaign.objectionHandlers)),
    [campaign.objectionHandlers],
  );

  return (
    <div className="mx-auto max-w-[980px] space-y-7 pb-8">
      <div className="space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded font-['Space_Grotesk'] text-[12px] font-medium text-[#666A68] transition-colors hover:text-[#1B1C18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6]"
        >
          <span aria-hidden="true">←</span> Campaigns
        </button>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <StatusBadge status={campaign.status} />
              <span className="font-['Space_Grotesk'] text-[12px] text-[#7A7D7A]">
                {TYPE_LABELS[campaign.type] ?? campaign.type.replaceAll("_", " ")}
              </span>
              <span className="text-[#D4D2C8]" aria-hidden="true">
                •
              </span>
              <span className="font-['Space_Grotesk'] text-[12px] text-[#7A7D7A]">
                Created {formatDate(campaign.createdAt)}
              </span>
            </div>
            <h1 className="font-['Newsreader'] text-[30px] font-normal leading-[1.15] tracking-[-0.5px] text-[#1B1C18] sm:text-[34px]">
              {displayName}
            </h1>
            <p className="font-['Space_Grotesk'] text-[12px] text-[#666A68]">
              {campaign.callToAction
                ? `Goal: ${cleanScriptText(campaign.callToAction)}`
                : "Campaign overview, AI conversation script, settings, and live execution metrics."}
            </p>
          </div>

          <div
            className="flex shrink-0 items-center gap-2"
            onClick={(event) => event.stopPropagation()}
          >
            {campaign.status === "draft" ||
            !["active", "paused", "completed"].includes(campaign.status.toLowerCase()) ? (
              <button
                type="button"
                onClick={() => onLaunch(campaign)}
                className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[#1B1C18] px-3.5 font-['Space_Grotesk'] text-[12px] font-semibold text-white transition-colors hover:bg-[#34352F]"
              >
                <Icon kind="rocket" className="h-3.5 w-3.5" />
                Launch
              </button>
            ) : campaign.status === "paused" ? (
              <button
                type="button"
                disabled={statusBusy}
                onClick={() => onStatusChange(campaign, "active")}
                className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[#1B1C18] px-3.5 font-['Space_Grotesk'] text-[12px] font-semibold text-white transition-colors hover:bg-[#34352F] disabled:opacity-50"
              >
                <Icon kind="play" className="h-3.5 w-3.5" />
                {statusBusy ? "Resuming…" : "Resume"}
              </button>
            ) : campaign.status === "active" ? (
              <button
                type="button"
                disabled={statusBusy}
                onClick={() => onStatusChange(campaign, "paused")}
                className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#DCDDD6] bg-white px-3.5 font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18] transition-colors hover:bg-[#F5F4ED] disabled:opacity-50"
              >
                <Icon kind="pause" className="h-3.5 w-3.5" />
                {statusBusy ? "Pausing…" : "Pause"}
              </button>
            ) : null}

            {canEdit ? (
              <button
                type="button"
                onClick={() => setActiveTab((curr) => (curr === "edit" ? "overview" : "edit"))}
                className={`inline-flex h-9 items-center gap-1.5 rounded-[8px] border px-3 font-['Space_Grotesk'] text-[12px] font-medium transition-colors ${
                  activeTab === "edit"
                    ? "border-[#D8CEF5] bg-[#F7F4FC] font-semibold text-[#644ABB]"
                    : "border-[#E2E0D8] bg-white text-[#3B3E3B] hover:bg-[#FAF9F5]"
                }`}
              >
                <Icon
                  kind="edit"
                  className={`h-3.5 w-3.5 ${activeTab === "edit" ? "text-[#644ABB]" : "text-[#666A68]"}`}
                />
                {activeTab === "edit" ? "View details" : "Edit campaign"}
              </button>
            ) : null}

            <div className="relative">
              <button
                type="button"
                aria-label="More campaign actions"
                aria-expanded={actionsOpen}
                aria-haspopup="menu"
                onClick={() => setActionsOpen((open) => !open)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[#E2E0D8] bg-white text-[#5C5F5C] transition-colors hover:bg-[#FAF9F5] hover:text-[#1B1C18]"
              >
                <Icon kind="more" className="h-4 w-4" />
              </button>

              {actionsOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-30 mt-1.5 w-48 overflow-hidden rounded-[10px] border border-[#E9E8E1] bg-white p-1 shadow-[0_12px_32px_rgba(27,28,24,0.12)]"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setActionsOpen(false);
                      onDuplicate(campaign);
                    }}
                    className="flex w-full items-center gap-2 rounded-[6px] px-3 py-2 text-left font-['Space_Grotesk'] text-[12px] text-[#1B1C18] hover:bg-[#F5F4ED]"
                  >
                    <Icon kind="copy" className="h-3.5 w-3.5 text-[#747878]" />
                    Duplicate campaign
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setActionsOpen(false);
                      onDeleteCampaign(campaign);
                    }}
                    className="mt-1 flex w-full items-center gap-2 rounded-[6px] border-t border-[#F0EFE9] px-3 py-2 text-left font-['Space_Grotesk'] text-[12px] font-semibold text-[#A33A32] hover:bg-[#FDF2F1]"
                  >
                    <Icon kind="trash" className="h-3.5 w-3.5 text-[#A33A32]" />
                    Delete campaign
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <section
        aria-label="Campaign metrics"
        className="grid grid-cols-2 divide-y divide-[#ECEBE5] rounded-[12px] border border-[#E9E8E1] bg-[#FAF9F5] sm:grid-cols-4 sm:divide-x sm:divide-y-0"
      >
        <div className="px-5 py-4">
          <p className="font-['Space_Grotesk'] text-[11px] font-medium text-[#747878]">
            Calls placed
          </p>
          <p className="mt-1.5 font-['Newsreader'] text-[28px] leading-none text-[#1B1C18]">
            {formatNumber(totalCalls)}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="font-['Space_Grotesk'] text-[11px] font-medium text-[#747878]">Connected</p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <p className="font-['Newsreader'] text-[28px] leading-none text-[#1B1C18]">
              {formatNumber(connectedCalls)}
            </p>
            {totalCalls > 0 ? (
              <span className="font-['Space_Grotesk'] text-[11px] font-semibold text-[#644ABB]">
                {connectionRate}
              </span>
            ) : null}
          </div>
        </div>
        <div className="px-5 py-4">
          <p className="font-['Space_Grotesk'] text-[11px] font-medium text-[#747878]">
            High intent
          </p>
          <p className="mt-1.5 font-['Newsreader'] text-[28px] leading-none text-[#1B1C18]">
            {formatNumber(highIntentCalls)}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="font-['Space_Grotesk'] text-[11px] font-medium text-[#747878]">Progress</p>
          <p className="mt-1.5 font-['Newsreader'] text-[28px] leading-none text-[#1B1C18]">
            {progress.percent}%
          </p>
          <p className="mt-1 truncate font-['Space_Grotesk'] text-[10px] text-[#7A7D7A]">
            {progress.label}
          </p>
        </div>
      </section>

      <div>
        <div
          role="tablist"
          aria-label="Campaign workspace sections"
          className="flex items-center gap-6 border-b border-[#ECEBE5]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "overview"}
            onClick={() => setActiveTab("overview")}
            className={`relative pb-3 font-['Space_Grotesk'] text-[13px] font-semibold transition-colors focus-visible:outline-none ${
              activeTab === "overview"
                ? "text-[#1B1C18] after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-[#644ABB]"
                : "text-[#747878] hover:text-[#1B1C18]"
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "script"}
            onClick={() => setActiveTab("script")}
            className={`relative pb-3 font-['Space_Grotesk'] text-[13px] font-semibold transition-colors focus-visible:outline-none ${
              activeTab === "script"
                ? "text-[#1B1C18] after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-[#644ABB]"
                : "text-[#747878] hover:text-[#1B1C18]"
            }`}
          >
            Call script &amp; flow
          </button>
          {canEdit ? (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "edit"}
              onClick={() => setActiveTab("edit")}
              className={`relative pb-3 font-['Space_Grotesk'] text-[13px] font-semibold transition-colors focus-visible:outline-none ${
                activeTab === "edit"
                  ? "text-[#1B1C18] after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-[#644ABB]"
                  : "text-[#747878] hover:text-[#1B1C18]"
              }`}
            >
              Edit campaign
            </button>
          ) : null}
        </div>

        {activeTab === "overview" ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.85fr)] lg:items-start">
            <div className="space-y-6 rounded-[12px] border border-[#E9E8E1] bg-white p-6">
              <div>
                <h2 className="font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">
                  What this campaign does
                </h2>
                <p className="mt-2 font-['Space_Grotesk'] text-[13.5px] leading-[1.65] text-[#3B3E3B]">
                  {campaign.primaryObjective || "No objective added yet."}
                </p>
              </div>

              {campaign.callToAction ? (
                <div className="rounded-[10px] border border-[#EFEAFB] bg-[#FAF8FF] px-4 py-3.5">
                  <p className="font-['Space_Grotesk'] text-[11px] font-semibold text-[#644ABB]">
                    Desired outcome
                  </p>
                  <p className="mt-1 font-['Space_Grotesk'] text-[13.5px] font-medium text-[#1B1C18]">
                    {cleanScriptText(campaign.callToAction)}
                  </p>
                </div>
              ) : null}

              {campaign.targetAudience ? (
                <div className="border-t border-[#F0EFE9] pt-5">
                  <h3 className="font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">
                    Target audience
                  </h3>
                  <p className="mt-1.5 font-['Space_Grotesk'] text-[13px] leading-6 text-[#5C5F5C]">
                    {campaign.targetAudience}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="space-y-5">
              <div className="rounded-[12px] border border-[#E9E8E1] bg-white p-5">
                <h2 className="font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">
                  Configuration
                </h2>
                <dl className="mt-3 divide-y divide-[#F0EFE9] font-['Space_Grotesk'] text-[12.5px]">
                  <div className="flex items-center justify-between gap-3 py-2.5">
                    <dt className="text-[#747878]">Language</dt>
                    <dd className="font-medium text-[#1B1C18]">
                      {formatLanguageLabel(campaign.language)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-2.5">
                    <dt className="text-[#747878]">Max call length</dt>
                    <dd className="font-medium text-[#1B1C18]">
                      {formatDurationLabel(campaign.maxDurationSeconds)}
                    </dd>
                  </div>
                  {campaign.updatedAt ? (
                    <div className="flex items-center justify-between gap-3 py-2.5">
                      <dt className="text-[#747878]">Last updated</dt>
                      <dd className="font-medium text-[#1B1C18]">
                        {formatDate(campaign.updatedAt)}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <Link
                  href={`/dashboard/calls?campaignId=${encodeURIComponent(campaign.id)}`}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[10px] border border-[#E2E0D8] bg-white px-3.5 font-['Space_Grotesk'] text-[12.5px] font-medium text-[#1B1C18] transition-colors hover:bg-[#FAF9F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6]"
                >
                  <Icon kind="phone" className="h-3.5 w-3.5 text-[#644ABB]" />
                  <span>Campaign calls</span>
                </Link>
                <Link
                  href="/dashboard/analytics"
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[10px] border border-[#E2E0D8] bg-white px-3.5 font-['Space_Grotesk'] text-[12.5px] font-medium text-[#1B1C18] transition-colors hover:bg-[#FAF9F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6]"
                >
                  <Icon kind="chart" className="h-3.5 w-3.5 text-[#644ABB]" />
                  <span>Analytics</span>
                </Link>
              </div>

              {progress.hasQueueData ? (
                <div className="rounded-[12px] border border-[#E9E8E1] bg-white p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">
                      Queue status
                    </h2>
                    <span className="font-['Space_Grotesk'] text-[11px] font-semibold text-[#644ABB]">
                      {progress.percent}%
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#ECEBE5]">
                    <div
                      className="h-full rounded-full bg-[#644ABB]"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap justify-between gap-2 font-['Space_Grotesk'] text-[11px] text-[#666A68]">
                    <span>{formatNumber(stats.inProgressCalls)} calling</span>
                    <span>{formatNumber(stats.pendingCalls)} pending</span>
                    <span>{formatNumber(stats.completedQueueCalls)} done</span>
                    <span>{formatNumber(stats.failedCalls)} failed</span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : activeTab === "script" ? (
          <div className="mt-6 space-y-5 rounded-[12px] border border-[#E9E8E1] bg-white p-6">
            {cleanedOpeningHook ? (
              <div>
                <p className="font-['Space_Grotesk'] text-[11px] font-semibold text-[#644ABB]">
                  1. Opening greeting
                </p>
                <div className="mt-2 rounded-[10px] border border-[#ECEBE5] bg-[#FAF9F5] p-4 font-['Space_Grotesk'] text-[13.5px] leading-[1.65] text-[#1B1C18]">
                  &ldquo;{cleanedOpeningHook}&rdquo;
                </div>
              </div>
            ) : null}

            {visibleTalkingPoints.length > 0 ? (
              <div className="border-t border-[#F0EFE9] pt-5">
                <p className="font-['Space_Grotesk'] text-[11px] font-semibold text-[#644ABB]">
                  2. Key conversation points
                </p>
                <ol className="mt-3 space-y-2.5">
                  {visibleTalkingPoints.map((point, idx) => (
                    <li
                      key={`${idx}-${point.slice(0, 24)}`}
                      className="flex items-start gap-3 font-['Space_Grotesk'] text-[13px] leading-6 text-[#3B3E3B]"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F5F4ED] font-['Space_Grotesk'] text-[10px] font-semibold text-[#5C5E56]">
                        {idx + 1}
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            {campaign.callToAction || campaign.fallbackOffer ? (
              <div className="grid gap-4 border-t border-[#F0EFE9] pt-5 sm:grid-cols-2">
                {campaign.callToAction ? (
                  <div className="rounded-[10px] border border-[#ECEBE5] bg-[#FAF9F5] p-4">
                    <p className="font-['Space_Grotesk'] text-[11px] font-semibold text-[#28683E]">
                      3. Next step (when interested)
                    </p>
                    <p className="mt-1.5 font-['Space_Grotesk'] text-[13px] leading-6 text-[#1B1C18]">
                      {cleanScriptText(campaign.callToAction)}
                    </p>
                  </div>
                ) : null}
                {campaign.fallbackOffer ? (
                  <div className="rounded-[10px] border border-[#ECEBE5] bg-[#FAF9F5] p-4">
                    <p className="font-['Space_Grotesk'] text-[11px] font-semibold text-[#666A68]">
                      4. Fallback (if not ready)
                    </p>
                    <p className="mt-1.5 font-['Space_Grotesk'] text-[13px] leading-6 text-[#3B3E3B]">
                      {cleanScriptText(campaign.fallbackOffer)}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {visibleObjectionHandlers.length > 0 ? (
              <div className="border-t border-[#F0EFE9] pt-5">
                <p className="font-['Space_Grotesk'] text-[11px] font-semibold text-[#644ABB]">
                  5. Objection handlers
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {visibleObjectionHandlers.map((item, idx) => (
                    <div
                      key={`${idx}-${item.objection.slice(0, 20)}`}
                      className="rounded-[10px] border border-[#ECEBE5] bg-[#FAF9F5] p-4"
                    >
                      <p className="font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18]">
                        &ldquo;{item.objection}&rdquo;
                      </p>
                      <p className="mt-1.5 font-['Space_Grotesk'] text-[12.5px] leading-5 text-[#5C5E5C]">
                        {item.response}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <CampaignFullEditor
            campaign={campaign}
            onCancel={() => setActiveTab("overview")}
            onSaved={(msg, patch) => {
              setActiveTab("overview");
              onSaved(msg, patch);
            }}
          />
        )}
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
  hasQueueData: boolean;
  totalQueue: number;
} {
  const stats = campaign.stats;
  const pending = Math.max(0, stats.pendingCalls ?? 0);
  const inProgress = Math.max(0, stats.inProgressCalls ?? 0);
  const completed = Math.max(0, stats.completedQueueCalls ?? 0);
  const failed = Math.max(0, stats.failedCalls ?? 0);
  const totalQueue = pending + inProgress + completed + failed;

  if (totalQueue === 0) {
    if (campaign.status === "completed") {
      return { percent: 100, label: "Completed", hasQueueData: false, totalQueue: 0 };
    }
    if (campaign.status === "draft") {
      return { percent: 0, label: "Awaiting launch", hasQueueData: false, totalQueue: 0 };
    }
    return { percent: 0, label: "No calls queued yet", hasQueueData: false, totalQueue: 0 };
  }

  const finished = completed + failed;
  const percent = Math.min(100, Math.max(0, Math.round((finished / totalQueue) * 100)));
  return {
    percent,
    label: `${finished} of ${totalQueue} queued calls processed (${percent}%)`,
    hasQueueData: true,
    totalQueue,
  };
}

export function CampaignsDashboard({
  initialCampaigns,
  initialError,
  initialCampaignId = null,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [liveCampaigns, setLiveCampaigns] = useState<Record<string, LiveCampaignSnapshot>>({});
  const [optimisticCreated, setOptimisticCreated] = useState<Campaign[]>([]);
  const [optimisticPatches, setOptimisticPatches] = useState<Record<string, Partial<Campaign>>>({});
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set());
  const [statusBusyIds, setStatusBusyIds] = useState<Record<string, boolean>>({});
  const liveStatsRequestInFlight = useRef(false);

  useEffect(() => {
    const serverIds = new Set(initialCampaigns.map((item) => item.id));
    setLiveCampaigns((prev) => {
      const next: Record<string, LiveCampaignSnapshot> = {};
      for (const [id, snapshot] of Object.entries(prev)) {
        if (serverIds.has(id)) next[id] = snapshot;
      }
      return next;
    });
    setOptimisticCreated((prev) => prev.filter((item) => !serverIds.has(item.id)));
    setOptimisticPatches((prev) => {
      const next: Record<string, Partial<Campaign>> = {};
      for (const [id, patch] of Object.entries(prev)) {
        if (serverIds.has(id)) next[id] = patch;
      }
      return next;
    });
    // Retain deletedIds until the server list confirms the campaign is absent
    setDeletedIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set<string>();
      for (const id of prev) {
        if (serverIds.has(id)) next.add(id);
      }
      return next;
    });
  }, [initialCampaigns]);

  const campaigns = useMemo(() => {
    const serverIds = new Set(initialCampaigns.map((c) => c.id));
    const mergedBase = [
      ...optimisticCreated.filter((c) => !serverIds.has(c.id)),
      ...initialCampaigns,
    ];

    return mergedBase
      .filter((campaign) => !deletedIds.has(campaign.id))
      .map((campaign) => {
        const live = liveCampaigns[campaign.id];
        const patch = optimisticPatches[campaign.id];
        return {
          ...campaign,
          ...(live ? { status: live.status, stats: live.stats } : {}),
          ...(patch ?? {}),
        };
      });
  }, [initialCampaigns, optimisticCreated, liveCampaigns, optimisticPatches, deletedIds]);

  const hasActiveCampaigns = campaigns.some((campaign) => campaign.status === "active");

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
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);

  const [creating, setCreating] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<Campaign | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => {
      setNotice(null);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [detailSelection, setDetailSelection] = useState<{
    campaignId: string;
    initialTab: "overview" | "script" | "edit";
  } | null>(() =>
    initialCampaignId ? { campaignId: initialCampaignId, initialTab: "overview" } : null,
  );
  const [deletingCampaign, setDeletingCampaign] = useState<Campaign | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    if (initialCampaignId) {
      setDetailSelection({ campaignId: initialCampaignId, initialTab: "overview" });
    }
  }, [initialCampaignId]);

  const selectedDetailCampaign = useMemo(() => {
    if (!detailSelection) return null;
    return campaigns.find((c) => c.id === detailSelection.campaignId) ?? null;
  }, [campaigns, detailSelection]);

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

  const filterPopoverContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenuId && !filterPopoverOpen) return;
    const handleOutsidePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (
        filterPopoverOpen &&
        filterPopoverContainerRef.current &&
        target &&
        filterPopoverContainerRef.current.contains(target)
      ) {
        return;
      }
      setOpenMenuId(null);
      setFilterPopoverOpen(false);
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenuId(null);
        setFilterPopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsidePointerDown);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutsidePointerDown);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [openMenuId, filterPopoverOpen]);

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

    if (Number.isNaN(scheduled.getTime())) {
      setLaunchError(
        "Choose a future launch date, or leave it empty to start as soon as possible.",
      );
      return;
    }
    const targetCampaignId = launchingCampaign.id;
    const queuedCount = selectedContactIds.length;
    setLaunchBusy(true);
    setLaunchError(null);
    const result = await withTransientRetry(() =>
      launchCampaignAction(targetCampaignId, selectedContactIds, {
        startAt: scheduled.toISOString(),
        startDate: startDate || undefined,
        dailyStart,
        dailyEnd,
      }),
    );
    setLaunchBusy(false);
    if (!result.ok) {
      setLaunchError(result.error);
      return;
    }
    setOptimisticPatches((prev) => ({
      ...prev,
      [targetCampaignId]: {
        ...(prev[targetCampaignId] ?? {}),
        status: "active",
        stats: {
          ...launchingCampaign.stats,
          pendingCalls: (launchingCampaign.stats.pendingCalls ?? 0) + queuedCount,
        },
      },
    }));
    setNotice(
      `Campaign queued for ${queuedCount} contacts. Calls will run only during ${dailyStart}–${dailyEnd} workspace time.`,
    );
    setLaunchingCampaign(null);
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.campaigns() });
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.workspaceSetup() });
    router.refresh();
  };

  const changeCampaignStatus = async (campaign: Campaign, status: "active" | "paused") => {
    if (statusBusyIds[campaign.id]) return;
    setOpenMenuId(null);
    const previousStatus = campaign.status;

    setStatusBusyIds((prev) => ({ ...prev, [campaign.id]: true }));
    setOptimisticPatches((prev) => ({
      ...prev,
      [campaign.id]: {
        ...(prev[campaign.id] ?? {}),
        status,
      },
    }));

    const result = await withTransientRetry(() => updateCampaignStatusAction(campaign.id, status));

    setStatusBusyIds((prev) => {
      const next = { ...prev };
      delete next[campaign.id];
      return next;
    });

    if (!result.ok) {
      setOptimisticPatches((prev) => ({
        ...prev,
        [campaign.id]: {
          ...(prev[campaign.id] ?? {}),
          status: previousStatus,
        },
      }));
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
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.campaigns() });
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.workspaceSetup() });
    router.refresh();
  };

  const purgeCampaignFromClientState = useCallback(
    (targetId: string) => {
      setDeletedIds((prev) => {
        const next = new Set(prev);
        next.add(targetId);
        return next;
      });
      setOptimisticCreated((prev) => prev.filter((item) => item.id !== targetId));
      setOptimisticPatches((prev) => {
        if (!(targetId in prev)) return prev;
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
      setLiveCampaigns((prev) => {
        if (!(targetId in prev)) return prev;
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
      setDetailSelection((curr) => (curr?.campaignId === targetId ? null : curr));

      // Evict the deleted campaign from every cached campaigns query immediately
      queryClient.setQueriesData<Record<string, unknown>>(
        { queryKey: ["dashboard", "campaigns"] },
        (cached) => {
          if (!cached || !Array.isArray(cached.campaigns)) return cached;
          const filtered = cached.campaigns.filter(
            (item) =>
              !(
                typeof item === "object" &&
                item !== null &&
                "id" in item &&
                (item as { id?: unknown }).id === targetId
              ),
          );
          if (filtered.length === cached.campaigns.length) return cached;
          return {
            ...cached,
            campaigns: filtered,
            total: typeof cached.total === "number" ? Math.max(0, cached.total - 1) : filtered.length,
          };
        },
      );
    },
    [queryClient],
  );

  const confirmDeleteCampaign = async () => {
    if (!deletingCampaign || deleteBusy) return;
    const targetId = deletingCampaign.id;
    const deletedName = cleanDisplayTitle(deletingCampaign.name);

    setDeleteBusy(true);
    const result = await withTransientRetry(() => deleteDraftCampaignAction(targetId));
    setDeleteBusy(false);

    const alreadyGoneInDb =
      !result.ok &&
      (result.status === 404 || /not found/i.test(result.error));

    if (!result.ok && !alreadyGoneInDb) {
      setNotice(`Could not delete campaign: ${result.error}`);
      setDeletingCampaign(null);
      return;
    }

    purgeCampaignFromClientState(targetId);
    setDeletingCampaign(null);
    setNotice(
      alreadyGoneInDb
        ? `Campaign "${deletedName}" was already removed. Synced your campaign list.`
        : `Deleted campaign "${deletedName}".`,
    );
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard", "campaigns"] }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.workspaceSetup() }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "calls"] }),
    ]);
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
        `${cleanDisplayTitle(campaign.name)} ${campaign.name} ${campaign.primaryObjective} ${
          campaign.targetAudience ?? ""
        } ${TYPE_LABELS[campaign.type] ?? campaign.type}`
          .toLowerCase()
          .includes(normalizedQuery);
      return matchesStatus && matchesType && matchesQuery;
    });

    return [...list].sort((a, b) => {
      if (sortBy === "name_asc") {
        return cleanDisplayTitle(a.name).localeCompare(cleanDisplayTitle(b.name));
      }
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
      if (sortBy === "updated") {
        const aTime =
          a.updatedAt ?? a.createdAt ? new Date(a.updatedAt ?? a.createdAt!).getTime() : 0;
        const bTime =
          b.updatedAt ?? b.createdAt ? new Date(b.updatedAt ?? b.createdAt!).getTime() : 0;
        return bTime - aTime;
      }
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return sortBy === "oldest" ? aTime - bTime : bTime - aTime;
    });
  }, [campaigns, statusFilter, typeFilter, debouncedQuery, sortBy]);

  const activeCount = statusCounts.active;
  const draftCount = statusCounts.draft;
  const totalCalls = campaigns.reduce((sum, campaign) => sum + (campaign.stats.totalCalls ?? 0), 0);

  const secondaryFilterCount = (typeFilter !== "all" ? 1 : 0) + (sortBy !== "newest" ? 1 : 0);
  const hasActiveFilters =
    statusFilter !== "all" || typeFilter !== "all" || queryInput.trim().length > 0;

  const clearAllFilters = () => {
    setStatusFilter("all");
    setTypeFilter("all");
    setQueryInput("");
    setDebouncedQuery("");
    setSortBy("newest");
  };

  const [pendingLaunchCampaignId, setPendingLaunchCampaignId] = useState<string | null>(null);

  const handleCreated = (
    message?: string,
    options?: {
      createdCampaignId?: string | null;
      createdCampaign?: Campaign | null;
      launchImmediately?: boolean;
    },
  ) => {
    if (options?.createdCampaign) {
      const created = options.createdCampaign;
      setOptimisticCreated((prev) => [
        created,
        ...prev.filter((item) => item.id !== created.id),
      ]);
    }
    setCreating(false);
    setDuplicateSource(null);
    setStatusFilter("all");
    setNotice(
      message ?? "Campaign draft saved. Review your audience before launching outbound calls.",
    );
    if (options?.launchImmediately && options.createdCampaignId) {
      if (options.createdCampaign) {
        void openLaunch(options.createdCampaign);
      } else {
        setPendingLaunchCampaignId(options.createdCampaignId);
      }
    }
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.campaigns() });
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.workspaceSetup() });
    router.refresh();
  };

  useEffect(() => {
    if (!pendingLaunchCampaignId) return;
    const match = campaigns.find((item) => item.id === pendingLaunchCampaignId);
    if (match) {
      setPendingLaunchCampaignId(null);
      void openLaunch(match);
    }
  }, [pendingLaunchCampaignId, campaigns]);

  if (creating || duplicateSource) {
    return (
      <CampaignForm
        initialDraft={duplicateSource}
        onCancel={() => {
          setCreating(false);
          setDuplicateSource(null);
        }}
        onCreated={handleCreated}
      />
    );
  }

  if (selectedDetailCampaign && detailSelection) {
    return (
      <>
        <ToastNotice message={notice} onDismiss={() => setNotice(null)} />
        <CampaignDetailView
        campaign={selectedDetailCampaign}
        initialTab={detailSelection.initialTab}
        statusBusy={Boolean(statusBusyIds[selectedDetailCampaign.id])}
        onBack={() => {
          setDetailSelection(null);
          if (initialCampaignId) {
            router.push("/dashboard/campaigns");
          }
        }}
        onLaunch={(c) => {
          setDetailSelection(null);
          void openLaunch(c);
        }}
        onStatusChange={(c, nextStatus) => {
          void changeCampaignStatus(c, nextStatus);
        }}
        onDuplicate={(c) => {
          setDetailSelection(null);
          setDuplicateSource(c);
        }}
        onDeleteCampaign={(c) => {
          setDetailSelection(null);
          setDeletingCampaign(c);
        }}
        onSaved={(msg, patch) => {
          if (patch) {
            setOptimisticPatches((prev) => ({
              ...prev,
              [selectedDetailCampaign.id]: {
                ...(prev[selectedDetailCampaign.id] ?? {}),
                ...patch,
              },
            }));
          }
          setNotice(msg);
          router.refresh();
        }}
      />
      </>
    );
  }

  return (
    <div className="space-y-6">
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
                  Launch {cleanDisplayTitle(launchingCampaign.name)}
                </h2>
                <p className="mt-1 font-['Space_Grotesk'] text-[12px] leading-5 text-[#747878]">
                  Choose who to call and when the agent is allowed to place calls.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLaunchingCampaign(null)}
                aria-label="Close launch window"
                className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] border border-[#E5E4DC] bg-white text-[#444748] hover:bg-[#F5F4ED]"
              >
                <Icon kind="close" className="h-4 w-4" />
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
                className="rounded-[8px] bg-[#1B1C18] px-5 py-2.5 font-['Space_Grotesk'] text-[12px] font-semibold text-white hover:bg-[#34352F] disabled:opacity-50"
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

      {deletingCampaign ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#171812]/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-campaign-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleteBusy) setDeletingCampaign(null);
          }}
        >
          <div className="w-full max-w-[440px] rounded-[12px] border border-[#ECEBE5] bg-white p-5 shadow-xl sm:p-6">
            <p className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.12em] text-[#A33A32]">
              Delete campaign
            </p>
            <h2
              id="delete-campaign-title"
              className="mt-1 font-['Newsreader'] text-[26px] leading-tight text-[#1B1C18]"
            >
              Delete &ldquo;{cleanDisplayTitle(deletingCampaign.name)}&rdquo;?
            </h2>
            <p className="mt-2 font-['Space_Grotesk'] text-[12px] leading-5 text-[#565B5B]">
              {deletingCampaign.status === "active"
                ? "This campaign is currently active. Deleting it will stop any queued calls and permanently remove this campaign from your workspace without affecting other campaigns."
                : "This campaign will be permanently removed from your workspace. Other campaigns will not be affected, and this action cannot be undone."}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingCampaign(null)}
                disabled={deleteBusy}
                className="h-9 rounded-[8px] border border-[#DCDDD6] bg-white px-4 font-['Space_Grotesk'] text-[12px] font-semibold text-[#444748] hover:bg-[#F5F4ED]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteCampaign}
                disabled={deleteBusy}
                className="h-9 rounded-[8px] bg-[#A33A32] px-4 font-['Space_Grotesk'] text-[12px] font-semibold text-white hover:bg-[#8A2E27] disabled:opacity-50"
              >
                {deleteBusy ? "Deleting…" : "Delete campaign"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ECEBE5] pb-5">
        <div>
          <h1 className="font-['Newsreader'] text-[36px] leading-tight tracking-[-0.8px] text-[#1B1C18] sm:text-[42px]">
            Campaigns
          </h1>
          <p className="mt-1 max-w-[640px] font-['Space_Grotesk'] text-[12px] leading-5 text-[#666A68]">
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
          className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#1B1C18] px-4 font-['Space_Grotesk'] text-[12px] font-semibold text-white transition-colors hover:bg-[#34352F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6] focus-visible:ring-offset-2"
        >
          <Icon kind="plus" className="h-3.5 w-3.5" />
          New campaign
        </button>
      </header>

      <ToastNotice message={notice} onDismiss={() => setNotice(null)} />

      {initialError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[#F0D8D4] bg-[#FFF8F7] px-4 py-3">
          <p className="font-['Space_Grotesk'] text-[12px] leading-5 text-[#A33A32]">
            Campaigns could not be loaded: {initialError}
          </p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="rounded-[6px] border border-[#E5C7C3] bg-white px-3 py-1.5 font-['Space_Grotesk'] text-[11px] font-semibold text-[#8D3028] hover:bg-[#FDF2F1]"
          >
            Retry
          </button>
        </div>
      ) : null}

      <section
        aria-label="Campaign metrics"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          label="Total campaigns"
          value={formatNumber(campaigns.length)}
          detail="Saved in workspace"
          icon="layers"
          onClick={() => setStatusFilter("all")}
        />
        <MetricCard
          label="Active campaigns"
          value={formatNumber(activeCount)}
          detail="Currently running"
          icon="activity"
          onClick={() => setStatusFilter((current) => (current === "active" ? "all" : "active"))}
        />
        <MetricCard
          label="Draft campaigns"
          value={formatNumber(draftCount)}
          detail="Awaiting launch"
          icon="file-edit"
          onClick={() => setStatusFilter((current) => (current === "draft" ? "all" : "draft"))}
        />
        <MetricCard
          label="Calls placed"
          value={formatNumber(totalCalls)}
          detail="View analytics →"
          icon="phone"
          href="/dashboard/analytics"
        />
      </section>

      <section className="overflow-visible rounded-[12px] border border-[#E9E8E1] bg-white shadow-[0_1px_2px_rgba(27,28,24,0.03)]">
        <div className="flex flex-col gap-3 border-b border-[#ECEBE5] px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-['Space_Grotesk'] text-[15px] font-semibold text-[#1B1C18]">
              All campaigns
            </h2>
            <p className="mt-0.5 font-['Space_Grotesk'] text-[11px] text-[#747878]">
              Review campaign status and conversation performance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="relative block min-w-0 flex-1 sm:w-64 sm:flex-initial">
              <span className="sr-only">Search campaigns</span>
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#747878]">
                <Icon kind="search" className="h-3.5 w-3.5" />
              </span>
              <input
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
                placeholder="Search campaigns..."
                className="h-9 w-full rounded-[8px] border border-[#E2E0D8] bg-[#FAF9F5] pl-8 pr-7 font-['Space_Grotesk'] text-[12px] text-[#1B1C18] outline-none transition-colors placeholder:text-[#92938C] focus:border-[#7852D6] focus:bg-white focus:ring-2 focus:ring-[#7852D6]/15"
              />
              {queryInput ? (
                <button
                  type="button"
                  onClick={() => {
                    setQueryInput("");
                    setDebouncedQuery("");
                  }}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[#747878] hover:bg-[#ECEBE5] hover:text-[#1B1C18]"
                >
                  <Icon kind="close" className="h-3 w-3" />
                </button>
              ) : null}
            </label>

            <div ref={filterPopoverContainerRef} className="relative" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                aria-expanded={filterPopoverOpen}
                aria-controls="campaign-filter-popover"
                aria-haspopup="dialog"
                onClick={() => setFilterPopoverOpen((open) => !open)}
                className={`inline-flex h-9 items-center gap-1.5 rounded-[8px] border px-3 font-['Space_Grotesk'] text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6] ${
                  secondaryFilterCount > 0 || filterPopoverOpen
                    ? "border-[#D8CEF5] bg-[#F7F4FC] text-[#644ABB]"
                    : "border-[#E2E0D8] bg-white text-[#444748] hover:bg-[#FAF9F5]"
                }`}
              >
                <Icon kind="sliders" className="h-3.5 w-3.5" />
                <span>Filter &amp; Sort</span>
                {secondaryFilterCount > 0 ? (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#644ABB] px-1 text-[10px] font-semibold text-white">
                    {secondaryFilterCount}
                  </span>
                ) : null}
              </button>

              {filterPopoverOpen ? (
                <div
                  id="campaign-filter-popover"
                  role="dialog"
                  aria-label="Filter and sort campaigns"
                  className="absolute right-0 top-full z-30 mt-2 w-72 rounded-[10px] border border-[#E9E8E1] bg-white p-4 shadow-[0_12px_32px_rgba(27,28,24,0.12)]"
                >
                  <div className="space-y-3.5">
                    <div>
                      <label
                        htmlFor="campaign-type-popover"
                        className="block font-['Space_Grotesk'] text-[11px] font-semibold text-[#444748]"
                      >
                        Campaign type
                      </label>
                      <select
                        id="campaign-type-popover"
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="mt-1.5 h-9 w-full rounded-[6px] border border-[#DCDDD6] bg-white px-2.5 font-['Space_Grotesk'] text-[12px] text-[#1B1C18] outline-none focus:border-[#7852D6]"
                      >
                        <option value="all">All types</option>
                        {Object.entries(TYPE_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="campaign-sort-popover"
                        className="block font-['Space_Grotesk'] text-[11px] font-semibold text-[#444748]"
                      >
                        Sort order
                      </label>
                      <select
                        id="campaign-sort-popover"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                        className="mt-1.5 h-9 w-full rounded-[6px] border border-[#DCDDD6] bg-white px-2.5 font-['Space_Grotesk'] text-[12px] text-[#1B1C18] outline-none focus:border-[#7852D6]"
                      >
                        {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
                          <option key={option} value={option}>
                            {SORT_LABELS[option]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center justify-between border-t border-[#F0EFE9] pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setTypeFilter("all");
                          setSortBy("newest");
                        }}
                        className="font-['Space_Grotesk'] text-[11px] font-semibold text-[#747878] hover:text-[#1B1C18]"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterPopoverOpen(false)}
                        className="rounded-[6px] bg-[#1B1C18] px-3 py-1.5 font-['Space_Grotesk'] text-[11px] font-semibold text-white hover:bg-[#34352F]"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Filter campaigns by status"
          className="flex items-center gap-1 overflow-x-auto border-b border-[#ECEBE5] bg-[#FAF9F5] px-4 py-2 sm:px-5"
        >
          {(["all", "draft", "active", "paused", "completed"] as StatusFilter[]).map((status) => {
            const selected = statusFilter === status;
            const label = status === "all" ? "All" : status;
            return (
              <button
                key={status}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setStatusFilter(status)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-[7px] px-3 py-1.5 font-['Space_Grotesk'] text-[12px] font-medium capitalize transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6] ${
                  selected
                    ? "bg-white font-semibold text-[#1B1C18] shadow-[0_1px_2px_rgba(27,28,24,0.06)] ring-1 ring-[#E5E3DB]"
                    : "text-[#666A68] hover:text-[#1B1C18]"
                }`}
              >
                <span>{label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] tabular-nums ${
                    selected
                      ? "bg-[#EFEAFB] font-semibold text-[#644ABB]"
                      : "bg-[#ECEBE5] text-[#666A68]"
                  }`}
                >
                  {statusCounts[status]}
                </span>
              </button>
            );
          })}

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearAllFilters}
              className="ml-2 shrink-0 font-['Space_Grotesk'] text-[11px] font-semibold text-[#644ABB] hover:underline"
            >
              Clear filters
            </button>
          ) : null}

          <span className="ml-auto shrink-0 pl-3 font-['Space_Grotesk'] text-[11px] text-[#7A7D7A]">
            {filteredCampaigns.length} {filteredCampaigns.length === 1 ? "campaign" : "campaigns"}
          </span>
        </div>

        {filteredCampaigns.length > 0 ? (
          <div className="divide-y divide-[#ECEBE5]">
            {filteredCampaigns.map((campaign) => {
              const stats = campaign.stats;
              const total = stats.totalCalls ?? 0;
              const connected = stats.connectedCalls ?? 0;
              const highIntent = stats.highInterestCalls ?? 0;
              const progress = computeExecutionProgress(campaign);
              const menuOpen = openMenuId === campaign.id;
              const isRowStatusBusy = Boolean(statusBusyIds[campaign.id]);
              const displayName = cleanDisplayTitle(campaign.name);

              return (
                <article
                  key={campaign.id}
                  onClick={() =>
                    setDetailSelection({ campaignId: campaign.id, initialTab: "overview" })
                  }
                  className="group cursor-pointer px-4 py-4 transition-colors hover:bg-[#FCFBF8] sm:px-5"
                >
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_270px_auto] lg:items-center lg:gap-6">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-['Space_Grotesk'] text-[15px] font-semibold text-[#1B1C18] transition-colors group-hover:text-[#644ABB]">
                          {displayName}
                        </h3>
                        <StatusBadge status={campaign.status} />
                        <span className="rounded-[5px] bg-[#F5F4ED] px-2 py-0.5 font-['Space_Grotesk'] text-[11px] font-medium text-[#5C5E56]">
                          {TYPE_LABELS[campaign.type] ?? campaign.type.replaceAll("_", " ")}
                        </span>
                      </div>

                      <p className="mt-1 line-clamp-1 max-w-[640px] font-['Space_Grotesk'] text-[12.5px] text-[#5C5F5C]">
                        {campaign.primaryObjective || "No campaign objective added."}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-['Space_Grotesk'] text-[11px] text-[#7A7D7A]">
                        <span>Created {formatDate(campaign.createdAt)}</span>
                        {campaign.targetAudience ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="max-w-[280px] truncate">{campaign.targetAudience}</span>
                          </>
                        ) : null}
                        <span aria-hidden="true">·</span>
                        <span className="text-[#5C5F5C]">{progress.label}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 divide-x divide-[#ECEBE5] rounded-[8px] border border-[#ECEBE5] bg-[#FAF9F5] py-2">
                      <div className="px-3">
                        <p className="font-['Space_Grotesk'] text-[10px] font-medium text-[#747878]">
                          Calls
                        </p>
                        <p className="mt-0.5 font-['Newsreader'] text-[20px] leading-none text-[#1B1C18]">
                          {formatNumber(total)}
                        </p>
                      </div>
                      <div className="px-3">
                        <p className="font-['Space_Grotesk'] text-[10px] font-medium text-[#747878]">
                          Connected
                        </p>
                        <p className="mt-0.5 font-['Newsreader'] text-[20px] leading-none text-[#1B1C18]">
                          {formatNumber(connected)}
                        </p>
                      </div>
                      <div className="px-3">
                        <p className="font-['Space_Grotesk'] text-[10px] font-medium text-[#747878]">
                          High intent
                        </p>
                        <p className="mt-0.5 font-['Newsreader'] text-[20px] leading-none text-[#1B1C18]">
                          {formatNumber(highIntent)}
                        </p>
                      </div>
                    </div>

                    <div
                      className="flex items-center justify-end gap-2 border-t border-[#F0EFE9] pt-3 lg:border-0 lg:pt-0"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {campaign.status === "draft" ||
                      !["active", "paused", "completed"].includes(campaign.status.toLowerCase()) ? (
                        <button
                          type="button"
                          onClick={() => openLaunch(campaign)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[#1B1C18] px-3.5 font-['Space_Grotesk'] text-[12px] font-semibold text-white transition-colors hover:bg-[#34352F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6]"
                        >
                          <Icon kind="rocket" className="h-3.5 w-3.5" />
                          Launch
                        </button>
                      ) : campaign.status === "paused" ? (
                        <button
                          type="button"
                          disabled={isRowStatusBusy}
                          onClick={() => changeCampaignStatus(campaign, "active")}
                          className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[#1B1C18] px-3.5 font-['Space_Grotesk'] text-[12px] font-semibold text-white transition-colors hover:bg-[#34352F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6] disabled:opacity-50"
                        >
                          <Icon kind="play" className="h-3.5 w-3.5" />
                          {isRowStatusBusy ? "Resuming…" : "Resume"}
                        </button>
                      ) : campaign.status === "active" ? (
                        <button
                          type="button"
                          disabled={isRowStatusBusy}
                          onClick={() => changeCampaignStatus(campaign, "paused")}
                          className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#DCDDD6] bg-white px-3.5 font-['Space_Grotesk'] text-[12px] font-semibold text-[#3B3E3B] transition-colors hover:bg-[#F5F4ED] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6] disabled:opacity-50"
                        >
                          <Icon kind="pause" className="h-3.5 w-3.5" />
                          {isRowStatusBusy ? "Pausing…" : "Pause"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setDetailSelection({ campaignId: campaign.id, initialTab: "overview" })
                          }
                          className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#DCDDD6] bg-white px-3.5 font-['Space_Grotesk'] text-[12px] font-semibold text-[#3B3E3B] transition-colors hover:bg-[#F5F4ED]"
                        >
                          <Icon kind="eye" className="h-3.5 w-3.5" />
                          Results
                        </button>
                      )}

                      <div className="relative">
                        <button
                          type="button"
                          aria-label={`Actions for ${displayName}`}
                          aria-expanded={menuOpen}
                          aria-controls={`campaign-menu-${campaign.id}`}
                          aria-haspopup="menu"
                          onClick={() =>
                            setOpenMenuId((current) => (current === campaign.id ? null : campaign.id))
                          }
                          className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[#E2E0D8] bg-white text-[#5C5F5C] transition-colors hover:bg-[#F5F4ED] hover:text-[#1B1C18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6]"
                        >
                          <Icon kind="more" className="h-4 w-4" />
                        </button>

                        {menuOpen ? (
                          <div
                            id={`campaign-menu-${campaign.id}`}
                            role="menu"
                            className="absolute right-0 top-full z-30 mt-1.5 w-48 overflow-hidden rounded-[10px] border border-[#E9E8E1] bg-white p-1 shadow-[0_12px_32px_rgba(27,28,24,0.12)]"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenMenuId(null);
                                setDetailSelection({
                                  campaignId: campaign.id,
                                  initialTab: "overview",
                                });
                              }}
                              className="flex w-full items-center gap-2 rounded-[6px] px-3 py-2 text-left font-['Space_Grotesk'] text-[12px] text-[#1B1C18] hover:bg-[#F5F4ED]"
                            >
                              <Icon kind="eye" className="h-3.5 w-3.5 text-[#747878]" />
                              View details
                            </button>
                            {campaign.status !== "completed" ? (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  setDetailSelection({
                                    campaignId: campaign.id,
                                    initialTab: "edit",
                                  });
                                }}
                                className="flex w-full items-center gap-2 rounded-[6px] px-3 py-2 text-left font-['Space_Grotesk'] text-[12px] text-[#1B1C18] hover:bg-[#F5F4ED]"
                              >
                                <Icon kind="edit" className="h-3.5 w-3.5 text-[#747878]" />
                                Edit campaign
                              </button>
                            ) : null}
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenMenuId(null);
                                setDuplicateSource(campaign);
                              }}
                              className="flex w-full items-center gap-2 rounded-[6px] px-3 py-2 text-left font-['Space_Grotesk'] text-[12px] text-[#1B1C18] hover:bg-[#F5F4ED]"
                            >
                              <Icon kind="copy" className="h-3.5 w-3.5 text-[#747878]" />
                              Duplicate campaign
                            </button>
                            <Link
                              href={`/dashboard/calls?campaignId=${encodeURIComponent(campaign.id)}`}
                              role="menuitem"
                              onClick={() => setOpenMenuId(null)}
                              className="flex w-full items-center gap-2 rounded-[6px] px-3 py-2 font-['Space_Grotesk'] text-[12px] text-[#1B1C18] hover:bg-[#F5F4ED]"
                            >
                              <Icon kind="phone" className="h-3.5 w-3.5 text-[#747878]" />
                              View campaign calls
                            </Link>
                            <Link
                              href="/dashboard/analytics"
                              role="menuitem"
                              onClick={() => setOpenMenuId(null)}
                              className="flex w-full items-center gap-2 rounded-[6px] px-3 py-2 font-['Space_Grotesk'] text-[12px] text-[#1B1C18] hover:bg-[#F5F4ED]"
                            >
                              <Icon kind="chart" className="h-3.5 w-3.5 text-[#747878]" />
                              View performance
                            </Link>
                            {campaign.status === "active" ? (
                              <button
                                type="button"
                                role="menuitem"
                                disabled={isRowStatusBusy}
                                onClick={() => changeCampaignStatus(campaign, "paused")}
                                className="flex w-full items-center gap-2 rounded-[6px] px-3 py-2 text-left font-['Space_Grotesk'] text-[12px] text-[#1B1C18] hover:bg-[#F5F4ED] disabled:opacity-50"
                              >
                                <Icon kind="pause" className="h-3.5 w-3.5 text-[#747878]" />
                                Pause campaign
                              </button>
                            ) : null}
                            {campaign.status === "paused" ? (
                              <button
                                type="button"
                                role="menuitem"
                                disabled={isRowStatusBusy}
                                onClick={() => changeCampaignStatus(campaign, "active")}
                                className="flex w-full items-center gap-2 rounded-[6px] px-3 py-2 text-left font-['Space_Grotesk'] text-[12px] text-[#1B1C18] hover:bg-[#F5F4ED] disabled:opacity-50"
                              >
                                <Icon kind="play" className="h-3.5 w-3.5 text-[#747878]" />
                                Resume campaign
                              </button>
                            ) : null}
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenMenuId(null);
                                setDeletingCampaign(campaign);
                              }}
                              className="mt-1 flex w-full items-center gap-2 rounded-[6px] border-t border-[#F0EFE9] px-3 py-2 text-left font-['Space_Grotesk'] text-[12px] font-semibold text-[#A33A32] hover:bg-[#FDF2F1]"
                            >
                              <Icon kind="trash" className="h-3.5 w-3.5 text-[#A33A32]" />
                              Delete campaign
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {progress.hasQueueData ? (
                    <div className="mt-3 flex items-center gap-3 pt-1">
                      <div
                        className="h-1 flex-1 overflow-hidden rounded-full bg-[#ECEBE5]"
                        role="progressbar"
                        aria-label={`${displayName} progress`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progress.percent}
                      >
                        <div
                          className="h-full rounded-full bg-[#7852D6] transition-[width]"
                          style={{ width: `${progress.percent}%` }}
                        />
                      </div>
                      <span className="shrink-0 font-['Space_Grotesk'] text-[10px] tabular-nums text-[#747878]">
                        {formatNumber(stats.inProgressCalls)} calling ·{" "}
                        {formatNumber(stats.pendingCalls)} pending ·{" "}
                        {formatNumber(stats.completedQueueCalls)} done ·{" "}
                        {formatNumber(stats.failedCalls)} failed
                      </span>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center px-5 py-14 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F2EEFA] text-[#644ABB]">
              <Icon kind="layers" className="h-5 w-5" />
            </span>
            {campaigns.length === 0 ? (
              <>
                <h3 className="mt-3.5 font-['Newsreader'] text-[24px] text-[#1B1C18]">
                  No campaigns yet
                </h3>
                <p className="mt-1 max-w-[380px] font-['Space_Grotesk'] text-[12px] leading-5 text-[#747878]">
                  Create your first voice campaign to start reaching your contacts.
                </p>
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[#1B1C18] px-4 font-['Space_Grotesk'] text-[12px] font-semibold text-white hover:bg-[#34352F]"
                >
                  <Icon kind="plus" className="h-3.5 w-3.5" />
                  Create campaign
                </button>
              </>
            ) : debouncedQuery.trim() ? (
              <>
                <h3 className="mt-3.5 font-['Newsreader'] text-[24px] text-[#1B1C18]">
                  No matching campaigns
                </h3>
                <p className="mt-1 max-w-[380px] font-['Space_Grotesk'] text-[12px] leading-5 text-[#747878]">
                  Try a different search term or clear your filters.
                </p>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="mt-4 inline-flex h-9 items-center justify-center rounded-[8px] border border-[#DCDDD6] bg-white px-4 font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18] hover:bg-[#F5F4ED]"
                >
                  Clear search
                </button>
              </>
            ) : (
              <>
                <h3 className="mt-3.5 font-['Newsreader'] text-[24px] text-[#1B1C18]">
                  No campaigns in this category
                </h3>
                <p className="mt-1 max-w-[380px] font-['Space_Grotesk'] text-[12px] leading-5 text-[#747878]">
                  Campaigns with this status will appear here.
                </p>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="mt-4 inline-flex h-9 items-center justify-center rounded-[8px] border border-[#DCDDD6] bg-white px-4 font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18] hover:bg-[#F5F4ED]"
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
