"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDashboardProfile } from "@/components/dashboard/dashboard-shell";
import { ToastNotice } from "@/components/dashboard/toast-notice";

const WORKSPACE_TICKET_CATEGORIES = [
  "Campaign & Calling Issue",
  "Call Quality, Audio & Routing",
  "Billing, Plan & Credits",
  "AI Studio & Knowledge Base",
  "Contacts & CRM Import",
  "Bug / Technical Fault",
  "Account & Team Access",
] as const;

type WorkspaceTicketCategory = (typeof WORKSPACE_TICKET_CATEGORIES)[number];

const inputClass =
  "mt-1.5 w-full rounded-md border border-[#E5E4DC] bg-white px-3 py-2.5 font-['Space_Grotesk'] text-[14px] text-[#252620] outline-none transition focus:border-[#7852D6] focus:ring-2 focus:ring-[#7852D6]/10";
const labelClass =
  "font-['Space_Grotesk'] text-[12.5px] font-semibold uppercase tracking-[0.07em] text-[#747878]";

export function SupportDashboard() {
  const profile = useDashboardProfile();

  const [category, setCategory] = useState<WorkspaceTicketCategory>("Campaign & Calling Issue");
  const [subject, setSubject] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [message, setMessage] = useState("");
  const [includeWorkspaceContext, setIncludeWorkspaceContext] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedWorkspaceId, setCopiedWorkspaceId] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedTicket, setSubmittedTicket] = useState<{
    message: string;
    ticketId?: string;
  } | null>(null);

  useEffect(() => {
    if (!submittedTicket) return;
    const timer = setTimeout(() => setSubmittedTicket(null), 10_000);
    return () => clearTimeout(timer);
  }, [submittedTicket]);

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText("support@foolioo.app");
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch {
      setCopiedEmail(false);
    }
  };

  const handleCopyWorkspaceId = async () => {
    if (!profile.workspaceId) return;
    try {
      await navigator.clipboard.writeText(profile.workspaceId);
      setCopiedWorkspaceId(true);
      setTimeout(() => setCopiedWorkspaceId(false), 2000);
    } catch {
      setCopiedWorkspaceId(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSubmittedTicket(null);

    const contextLines: string[] = [];
    if (includeWorkspaceContext) {
      contextLines.push(`Workspace: ${profile.workspaceName}`);
      if (profile.workspaceId) contextLines.push(`Workspace ID: ${profile.workspaceId}`);
      if (profile.planName) contextLines.push(`Plan: ${profile.planName}`);
    }
    if (referenceId.trim()) {
      contextLines.push(`Campaign / Call / Payment Ref: ${referenceId.trim()}`);
    }

    const composedMessage =
      contextLines.length > 0
        ? `${message.trim()}\n\n--- Workspace Diagnostics ---\n${contextLines.join("\n")}`
        : message.trim();

    try {
      const res = await fetch("/api/support/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.displayName || profile.email.split("@")[0] || "Workspace User",
          email: profile.email,
          contactPhone: contactPhone.trim() || undefined,
          category,
          subject: subject.trim(),
          message: composedMessage,
        }),
      });
      const data = await res.json();

      if (res.ok && data.ok) {
        setSubmittedTicket({
          message:
            data.message ||
            "Your support ticket has been logged. Our team will review your workspace diagnostics and reply shortly.",
          ticketId: typeof data.ticketId === "string" ? data.ticketId : undefined,
        });
        setSubject("");
        setReferenceId("");
        setMessage("");
      } else {
        setError(data.error || "Failed to submit support ticket. Please try again.");
      }
    } catch {
      setError("Network error while submitting your ticket. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-['Space_Grotesk'] text-[12px] font-semibold uppercase tracking-[0.12em] text-[#858782]">
            Help &amp; Support
          </p>
          <h1 className="mt-1 font-['Newsreader'] text-[34px] leading-[1.12] tracking-[-0.7px] text-[#1B1C18] sm:text-[40px]">
            Workspace support desk
          </h1>
          <p className="mt-2 max-w-2xl font-['Space_Grotesk'] text-[14px] leading-[1.55] text-[#747878]">
            Report campaign, routing, billing, or AI agent issues directly from your signed-in workspace. Your account and workspace identifiers are attached automatically.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/dashboard/calls"
            className="rounded-[6px] border border-[#DCDCD4] bg-white px-3.5 py-2 font-['Space_Grotesk'] text-[13px] font-semibold text-[#34352F] transition-colors hover:bg-[#F5F4ED]"
          >
            Inspect Call Logs
          </Link>
          <Link
            href="/dashboard/billing"
            className="rounded-[6px] border border-[#DCDCD4] bg-white px-3.5 py-2 font-['Space_Grotesk'] text-[13px] font-semibold text-[#34352F] transition-colors hover:bg-[#F5F4ED]"
          >
            Billing &amp; Credits
          </Link>
        </div>
      </div>

      {error ? <ToastNotice tone="error" message={error} onDismiss={() => setError(null)} /> : null}

      {submittedTicket ? (
        <div
          role="status"
          className="rounded-[10px] border border-[#22A06B]/30 bg-[#EAF8F1] p-4 font-['Space_Grotesk'] text-[14px] text-[#18794E]"
        >
          <p className="font-semibold">{submittedTicket.message}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-4 text-[12.5px] opacity-90">
            <span>Replies will be sent to {profile.email}</span>
            {submittedTicket.ticketId ? (
              <span className="font-mono">Ticket ID: {submittedTicket.ticketId}</span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-[10px] border border-[#E9E8E1] bg-white p-5 sm:p-6 lg:col-span-8"
        >
          <div className="border-b border-[#F0EFEA] pb-4">
            <h2 className="font-['Newsreader'] text-[24px] leading-tight text-[#1B1C18]">
              Open a support ticket
            </h2>
            <p className="mt-1 font-['Space_Grotesk'] text-[13.5px] text-[#747878]">
              Submitting as <span className="font-semibold text-[#1B1C18]">{profile.displayName}</span> ({profile.email})
            </p>
          </div>

          <div>
            <span className={labelClass}>
              Issue Category <span className="text-[#FD7032]">*</span>
            </span>
            <div
              role="radiogroup"
              aria-label="Issue Category"
              className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2"
            >
              {WORKSPACE_TICKET_CATEGORIES.map((item) => {
                const active = category === item;
                return (
                  <button
                    key={item}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setCategory(item)}
                    className={`cursor-pointer rounded-[8px] border px-3.5 py-2.5 text-left font-['Space_Grotesk'] text-[13px] font-medium transition-all ${
                      active
                        ? "border-[#644ABB] bg-[#EFEAFB] font-semibold text-[#644ABB]"
                        : "border-[#E6E4DC] bg-[#FBFAF6] text-[#444748] hover:border-[#D4D1C7] hover:bg-white hover:text-[#1B1C18]"
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>
                Subject <span className="text-[#FD7032]">*</span>
              </span>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Campaign calls stuck in queued state"
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className={labelClass}>Campaign / Call / Payment ID (Optional)</span>
              <input
                type="text"
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                placeholder="e.g. call_9f2a... or pay_P8x..."
                className={inputClass}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Callback Phone (Optional)</span>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className={inputClass}
              />
            </label>

            <div className="flex flex-col justify-end">
              <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-[#E6E4DC] bg-[#FBFAF6] px-3 py-2.5 font-['Space_Grotesk'] text-[13px] text-[#34352F]">
                <input
                  type="checkbox"
                  checked={includeWorkspaceContext}
                  onChange={(e) => setIncludeWorkspaceContext(e.target.checked)}
                  className="h-4 w-4 accent-[#644ABB]"
                />
                <span>Attach workspace ID &amp; plan metadata</span>
              </label>
            </div>
          </div>

          <label className="block">
            <span className={labelClass}>
              Issue Details <span className="text-[#FD7032]">*</span>
            </span>
            <textarea
              rows={5}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe what happened, steps to reproduce, expected behavior, and any relevant timestamps..."
              className={`${inputClass} resize-y`}
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F0EFEA] pt-4">
            <p className="font-['Space_Grotesk'] text-[12.5px] text-[#747878]">
              Routed directly to <span className="font-semibold text-[#1B1C18]">support@foolioo.app</span>
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex cursor-pointer items-center justify-center rounded-[6px] bg-[#1B1C18] px-5 py-2.5 font-['Space_Grotesk'] text-[13.5px] font-semibold text-white transition-colors hover:bg-[#34352F] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Submitting ticket..." : "Submit Support Ticket"}
            </button>
          </div>
        </form>

        <div className="space-y-4 lg:col-span-4">
          <div className="rounded-[10px] border border-[#E9E8E1] bg-[#FBFAF6] p-5 font-['Space_Grotesk']">
            <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#747878]">
              Workspace Context
            </p>
            <dl className="mt-3 space-y-3 text-[13.5px]">
              <div>
                <dt className="text-[12px] text-[#747878]">Workspace</dt>
                <dd className="font-semibold text-[#1B1C18]">{profile.workspaceName}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-[#747878]">Signed-in Account</dt>
                <dd className="truncate font-medium text-[#1B1C18]">{profile.email}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-[#747878]">Current Plan</dt>
                <dd className="font-medium text-[#1B1C18]">
                  {profile.planName ?? (profile.isTrial ? "Trial" : "Workspace plan")}
                </dd>
              </div>
              {profile.workspaceId ? (
                <div>
                  <dt className="text-[12px] text-[#747878]">Workspace ID</dt>
                  <dd className="mt-1 flex items-center justify-between gap-2 rounded border border-[#E6E4DC] bg-white px-2.5 py-1.5 font-mono text-[12px] text-[#1B1C18]">
                    <span className="truncate">{profile.workspaceId}</span>
                    <button
                      type="button"
                      onClick={handleCopyWorkspaceId}
                      className="shrink-0 cursor-pointer font-['Space_Grotesk'] text-[11.5px] font-semibold text-[#644ABB] hover:underline"
                    >
                      {copiedWorkspaceId ? "Copied" : "Copy"}
                    </button>
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>

          <div className="rounded-[10px] border border-[#E9E8E1] bg-white p-5 font-['Space_Grotesk']">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#747878]">
                  Direct Email
                </p>
                <a
                  href="mailto:support@foolioo.app"
                  className="mt-0.5 inline-block text-[14px] font-semibold text-[#1B1C18] hover:underline"
                >
                  support@foolioo.app
                </a>
              </div>
              <button
                type="button"
                onClick={handleCopyEmail}
                className="cursor-pointer rounded-[6px] border border-[#E6E4DC] bg-[#FBFAF6] px-3 py-1.5 text-[12.5px] font-semibold text-[#1B1C18] transition-colors hover:bg-[#ECEBE4]"
              >
                {copiedEmail ? "Copied" : "Copy"}
              </button>
            </div>

            <div className="mt-4 border-t border-[#F0EFEA] pt-4">
              <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#747878]">
                Before Submitting
              </p>
              <ul className="mt-2.5 space-y-2 text-[13px] leading-[1.45] text-[#525552]">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#644ABB]" />
                  <span>Include the Campaign ID or Call ID for call routing or transcript issues.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#644ABB]" />
                  <span>For Razorpay top-ups or plan renewals, share the payment reference ID.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#644ABB]" />
                  <span>Agent prompt &amp; voice configuration can also be adjusted in AI Studio.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
