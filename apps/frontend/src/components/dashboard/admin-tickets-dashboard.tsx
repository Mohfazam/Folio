"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dashboardKeys } from "@/lib/query/keys";
import { useDashboardUiStore } from "@/stores/dashboard-ui-store";
import { useDialogFocusTrap } from "@/components/dashboard/accessible-dialog";
import { ToastNotice } from "@/components/dashboard/toast-notice";

export type SupportTicketItem = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  contactPhone: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type TicketsApiResponse = {
  ok: boolean;
  tickets?: SupportTicketItem[];
  total?: number;
  openCount?: number;
  error?: string;
};

const STATUS_BADGE: Record<string, string> = {
  open: "border-[#F0DFB8] bg-[#FFFAEC] text-[#8A6826]",
  in_progress: "border-[#D8CEF5] bg-[#F7F4FC] text-[#644ABB]",
  resolved: "border-[#CDE5D4] bg-[#EFF8F1] text-[#34734B]",
  closed: "border-[#E5E1D5] bg-[#F7F5EF] text-[#696B62]",
};

function formatTicketTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

async function fetchFounderTickets(
  statusFilter: string,
  searchQuery: string,
): Promise<TicketsApiResponse> {
  const params = new URLSearchParams({ limit: "50", offset: "0" });
  if (statusFilter !== "all") params.set("status", statusFilter);
  if (searchQuery.trim()) params.set("search", searchQuery.trim());

  const res = await fetch(`/api/support/tickets?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as TicketsApiResponse | null;
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || "Unable to load support tickets.");
  }
  return data;
}

export function AdminTicketsDashboard() {
  const queryClient = useQueryClient();

  const statusFilter = useDashboardUiStore((s) => s.founderTicketStatusFilter);
  const searchQuery = useDashboardUiStore((s) => s.founderTicketSearchQuery);
  const selectedTicketId = useDashboardUiStore((s) => s.selectedFounderTicketId);
  const setStatusFilter = useDashboardUiStore((s) => s.setFounderTicketStatusFilter);
  const setSearchQuery = useDashboardUiStore((s) => s.setFounderTicketSearchQuery);
  const setSelectedTicketId = useDashboardUiStore((s) => s.setSelectedFounderTicketId);

  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyStatusAfterSend, setReplyStatusAfterSend] = useState<string>("resolved");
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setReplyText("");
    setReplyStatusAfterSend("resolved");
    setActionError(null);
  }, [selectedTicketId]);

  const queryParams = { status: statusFilter, search: searchQuery.trim() };

  const {
    data,
    isLoading,
    isFetching,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: dashboardKeys.founderTickets(queryParams),
    queryFn: () => fetchFounderTickets(statusFilter, searchQuery),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ ticketId, nextStatus }: { ticketId: string; nextStatus: string }) => {
      const res = await fetch(`/api/support/tickets/${encodeURIComponent(ticketId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        ticket?: SupportTicketItem;
      } | null;
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || "Could not update ticket status.");
      }
      return { ticketId, nextStatus, ticket: payload.ticket };
    },
    onSuccess: ({ nextStatus }) => {
      setActionError(null);
      setNotice(`Ticket marked as ${nextStatus.replaceAll("_", " ")}.`);
      void queryClient.invalidateQueries({ queryKey: [...dashboardKeys.all, "founder", "tickets"] });
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : "Network error while updating ticket status.");
    },
  });

  const replyMutation = useMutation({
    mutationFn: async ({
      ticketId,
      replyMessage,
      status,
    }: {
      ticketId: string;
      replyMessage: string;
      status: string;
    }) => {
      const res = await fetch(`/api/support/tickets/${encodeURIComponent(ticketId)}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyMessage, status }),
      });
      const payload = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        sentTo?: string;
        message?: string;
      } | null;
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || "Could not send reply email.");
      }
      return payload;
    },
    onSuccess: (payload) => {
      setActionError(null);
      setReplyText("");
      setNotice(
        payload.message ||
          `Reply sent to ${payload.sentTo ?? "user"} from support@foolioo.app.`,
      );
      void queryClient.invalidateQueries({ queryKey: [...dashboardKeys.all, "founder", "tickets"] });
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : "Network error while sending reply.");
    },
  });

  const tickets = Array.isArray(data?.tickets) ? data.tickets : [];
  const total = typeof data?.total === "number" ? data.total : tickets.length;
  const openCount = typeof data?.openCount === "number" ? data.openCount : 0;

  const selectedTicket =
    selectedTicketId ? tickets.find((item) => item.id === selectedTicketId) ?? null : null;

  useDialogFocusTrap(Boolean(selectedTicket), modalRef, () => setSelectedTicketId(null));

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const displayedError =
    actionError || (queryError instanceof Error ? queryError.message : null);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#ECEBE5] pb-5">
        <div>
          <p className="font-['Space_Grotesk'] text-[12px] font-bold uppercase tracking-[0.12em] text-[#644ABB]">
            FOUNDER OPS
          </p>
          <h1 className="mt-1 font-['Newsreader'] text-[36px] leading-tight tracking-[-0.8px] text-[#1B1C18] sm:text-[42px]">
            Support tickets
          </h1>
          <p className="mt-1 font-['Space_Grotesk'] text-[14px] text-[#747878]">
            Founder-only inbox for incoming complaints and tickets from{" "}
            <code className="rounded bg-[#F5F4ED] px-1.5 py-0.5 font-mono text-[13px]">
              /support
            </code>{" "}
            stored in{" "}
            <code className="rounded bg-[#F5F4ED] px-1.5 py-0.5 font-mono text-[13px]">
              support_tickets
            </code>
            .
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[#F0DFB8] bg-[#FFFAEC] px-3 py-1 font-['Space_Grotesk'] text-[13px] font-semibold text-[#8A6826]">
            {openCount} open
          </span>
          <span className="rounded-full border border-[#E5E1D5] bg-[#F7F5EF] px-3 py-1 font-['Space_Grotesk'] text-[13px] font-semibold text-[#444748]">
            {total} total
          </span>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="h-9 rounded-[6px] border border-[#DCDDD6] bg-white px-3.5 font-['Space_Grotesk'] text-[14px] font-semibold text-[#1B1C18] transition hover:bg-[#F5F4ED] disabled:opacity-60"
          >
            {isFetching ? "Syncing…" : "Refresh"}
          </button>
        </div>
      </header>

      <ToastNotice message={notice} onDismiss={() => setNotice(null)} />

      {displayedError ? (
        <div
          role="alert"
          className="rounded-[8px] border border-[#F0D8D4] bg-[#FFF8F7] px-4 py-3 font-['Space_Grotesk'] text-[14px] text-[#A33A32]"
        >
          {displayedError}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[10px] border border-[#ECEBE5] bg-white">
        <div className="flex flex-col gap-3 border-b border-[#ECEBE5] bg-[#FAF9F5] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter tickets by status">
            {[
              { id: "all", label: "All" },
              { id: "open", label: "Open" },
              { id: "in_progress", label: "In Progress" },
              { id: "resolved", label: "Resolved" },
              { id: "closed", label: "Closed" },
            ].map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`rounded-[6px] px-3 py-1.5 font-['Space_Grotesk'] text-[14px] transition ${
                    active
                      ? "bg-[#1B1C18] font-semibold text-white"
                      : "border border-[#E5E4DC] bg-white text-[#565B5B] hover:text-[#1B1C18]"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, email, subject, or message..."
            className="h-9 w-full rounded-[6px] border border-[#DCDDD6] bg-white px-3 font-['Space_Grotesk'] text-[14px] text-[#1B1C18] outline-none focus:border-[#7852D6] sm:w-72"
          />
        </div>

        {isLoading && !data ? (
          <div className="divide-y divide-[#F0EFE9] p-4 sm:px-5">
            {[0, 1, 2].map((skeletonRow) => (
              <div key={skeletonRow} className="animate-pulse py-4">
                <div className="h-4 w-64 rounded bg-[#ECEBE5]" />
                <div className="mt-2 h-3 w-96 max-w-full rounded bg-[#F5F4ED]" />
                <div className="mt-2.5 h-3 w-full rounded bg-[#F5F4ED]" />
              </div>
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <h2 className="font-['Newsreader'] text-[24px] text-[#1B1C18]">No support tickets found</h2>
            <p className="mt-1 font-['Space_Grotesk'] text-[14px] text-[#747878]">
              Submissions from{" "}
              <code className="rounded bg-[#F5F4ED] px-1.5 py-0.5 font-mono text-[13px]">
                /support
              </code>{" "}
              will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#F0EFE9]">
            {tickets.map((ticket) => {
              const badgeClass =
                STATUS_BADGE[ticket.status] ??
                "border-[#E5E1D5] bg-[#F7F5EF] text-[#696B62]";
              const isMutatingThis =
                statusMutation.isPending && statusMutation.variables?.ticketId === ticket.id;

              return (
                <article
                  key={ticket.id}
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className="cursor-pointer p-4 transition-colors hover:bg-[#FCFBF8] sm:px-5"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-['Space_Grotesk'] text-[15px] font-semibold text-[#1B1C18] sm:text-[16px]">
                          {ticket.subject}
                        </h2>
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 font-['Space_Grotesk'] text-[12px] font-semibold capitalize ${badgeClass}`}
                        >
                          {ticket.status.replaceAll("_", " ")}
                        </span>
                      </div>

                      <p className="mt-1 font-['Space_Grotesk'] text-[13px] text-[#747878]">
                        From <strong className="font-semibold text-[#1B1C18]">{ticket.name}</strong>{" "}
                        ({ticket.email})
                        {ticket.contactPhone ? ` · ${ticket.contactPhone}` : ""} ·{" "}
                        {formatTicketTime(ticket.createdAt)}
                      </p>

                      <p className="mt-2 line-clamp-2 whitespace-pre-line font-['Space_Grotesk'] text-[14px] leading-[1.55] text-[#3B3E3B]">
                        {ticket.message}
                      </p>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTicketId(ticket.id);
                        }}
                        className="mt-2 inline-flex items-center gap-1 font-['Space_Grotesk'] text-[13px] font-semibold text-[#644ABB] hover:underline"
                      >
                        Open detailed window →
                      </button>
                    </div>

                    <div
                      className="flex shrink-0 items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <label className="sr-only" htmlFor={`ticket-status-${ticket.id}`}>
                        Status for {ticket.subject}
                      </label>
                      <select
                        id={`ticket-status-${ticket.id}`}
                        value={ticket.status}
                        disabled={isMutatingThis}
                        onChange={(e) =>
                          statusMutation.mutate({
                            ticketId: ticket.id,
                            nextStatus: e.target.value,
                          })
                        }
                        className="h-9 rounded-[6px] border border-[#DCDDD6] bg-white px-2.5 font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18] outline-none focus:border-[#7852D6] disabled:opacity-50"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Detailed Ticket Modal Window */}
      {selectedTicket ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1B1C18]/50 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ticket-detail-title"
          onClick={() => setSelectedTicketId(null)}
        >
          <div
            ref={modalRef}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#E3DFD3] bg-white p-6 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#ECEBE5] pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-['Space_Grotesk'] text-[12px] font-bold uppercase tracking-[0.12em] text-[#644ABB]">
                    TICKET DETAILS
                  </span>
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 font-['Space_Grotesk'] text-[12px] font-semibold capitalize ${
                      STATUS_BADGE[selectedTicket.status] ??
                      "border-[#E5E1D5] bg-[#F7F5EF] text-[#696B62]"
                    }`}
                  >
                    {selectedTicket.status.replaceAll("_", " ")}
                  </span>
                </div>
                <h2
                  id="ticket-detail-title"
                  className="mt-1.5 font-['Newsreader'] text-[28px] leading-snug tracking-[-0.5px] text-[#1B1C18]"
                >
                  {selectedTicket.subject}
                </h2>
              </div>

              <button
                type="button"
                data-autofocus="true"
                onClick={() => setSelectedTicketId(null)}
                aria-label="Close ticket window"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#DCDDD6] bg-[#FAF9F5] font-['Space_Grotesk'] text-[15px] font-semibold text-[#1B1C18] hover:bg-[#F0EFE9]"
              >
                ✕
              </button>
            </div>

            <dl className="mt-5 grid grid-cols-1 gap-3 rounded-xl border border-[#ECEBE5] bg-[#FAF9F5] p-4 font-['Space_Grotesk'] text-[14px] sm:grid-cols-2">
              <div>
                <dt className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#747878]">
                  Submitted By
                </dt>
                <dd className="mt-0.5 font-semibold text-[#1B1C18]">{selectedTicket.name}</dd>
              </div>
              <div>
                <dt className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#747878]">
                  Email
                </dt>
                <dd className="mt-0.5 font-medium text-[#1B1C18]">
                  <a
                    href={`mailto:${selectedTicket.email}`}
                    className="text-[#644ABB] hover:underline"
                  >
                    {selectedTicket.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#747878]">
                  Phone Number
                </dt>
                <dd className="mt-0.5 font-medium text-[#1B1C18]">
                  {selectedTicket.contactPhone || "Not provided"}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#747878]">
                  Received At (IST)
                </dt>
                <dd className="mt-0.5 font-medium text-[#1B1C18]">
                  {formatTicketTime(selectedTicket.createdAt)}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#747878]">
                  Ticket ID
                </dt>
                <dd className="mt-0.5 break-all font-mono text-[13px] text-[#525552]">
                  {selectedTicket.id}
                </dd>
              </div>
            </dl>

            <div className="mt-5">
              <h3 className="font-['Space_Grotesk'] text-[13px] font-bold uppercase tracking-[0.08em] text-[#747878]">
                Full Complaint / Message
              </h3>
              <div className="mt-2 whitespace-pre-wrap rounded-xl border border-[#ECEBE5] bg-[#FCFBF8] p-4 font-['Space_Grotesk'] text-[14px] leading-[22px] text-[#1B1C18]">
                {selectedTicket.message}
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-[#E3DFD3] bg-[#FAF9F5] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="ticket-reply-box"
                  className="font-['Space_Grotesk'] text-[13px] font-bold uppercase tracking-[0.08em] text-[#1B1C18]"
                >
                  Reply from support@foolioo.app → {selectedTicket.email}
                </label>
                <span className="font-['Space_Grotesk'] text-[13px] text-[#747878]">
                  Sent automatically via email
                </span>
              </div>

              <textarea
                id="ticket-reply-box"
                rows={4}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Write your response to ${selectedTicket.name} (${selectedTicket.email})...`}
                className="mt-2 w-full rounded-lg border border-[#DCDDD6] bg-white p-3 font-['Space_Grotesk'] text-[14px] leading-[20px] text-[#1B1C18] placeholder-[#747878] outline-none focus:border-[#7852D6]"
              />

              {actionError ? (
                <p
                  role="alert"
                  className="mt-2 font-['Space_Grotesk'] text-[11.5px] font-medium text-[#A33A32]"
                >
                  {actionError}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="reply-status-select"
                    className="font-['Space_Grotesk'] text-[11.5px] text-[#525552]"
                  >
                    Set ticket status after sending:
                  </label>
                  <select
                    id="reply-status-select"
                    value={replyStatusAfterSend}
                    onChange={(e) => setReplyStatusAfterSend(e.target.value)}
                    className="h-8 rounded-[6px] border border-[#DCDDD6] bg-white px-2 font-['Space_Grotesk'] text-[11.5px] font-semibold text-[#1B1C18] outline-none focus:border-[#7852D6]"
                  >
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                    <option value="open">Keep Open</option>
                  </select>
                </div>

                <button
                  type="button"
                  disabled={replyMutation.isPending || replyText.trim().length < 2}
                  onClick={() =>
                    replyMutation.mutate({
                      ticketId: selectedTicket.id,
                      replyMessage: replyText.trim(),
                      status: replyStatusAfterSend,
                    })
                  }
                  className="inline-flex h-9 items-center justify-center rounded-[6px] bg-[#FD7032] px-4 font-['Space_Grotesk'] text-[14px] font-semibold text-[#1B1C18] shadow-xs transition hover:bg-[#e56228] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {replyMutation.isPending
                    ? "Sending email…"
                    : `Send Reply to ${selectedTicket.email}`}
                </button>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#ECEBE5] pt-4">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="modal-ticket-status"
                  className="font-['Space_Grotesk'] text-[14px] font-semibold text-[#1B1C18]"
                >
                  Update Status:
                </label>
                <select
                  id="modal-ticket-status"
                  value={selectedTicket.status}
                  disabled={statusMutation.isPending}
                  onChange={(e) =>
                    statusMutation.mutate({
                      ticketId: selectedTicket.id,
                      nextStatus: e.target.value,
                    })
                  }
                  className="h-9 rounded-[6px] border border-[#DCDDD6] bg-white px-3 font-['Space_Grotesk'] text-[14px] font-semibold text-[#1B1C18] outline-none focus:border-[#7852D6]"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTicketId(null)}
                className="h-9 rounded-[6px] bg-[#1B1C18] px-4 font-['Space_Grotesk'] text-[14px] font-semibold text-white hover:bg-[#34352F]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
