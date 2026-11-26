"use client";

import { useCallback, useEffect, useState } from "react";
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

export function AdminTicketsDashboard() {
  const [tickets, setTickets] = useState<SupportTicketItem[]>([]);
  const [total, setTotal] = useState(0);
  const [openCount, setOpenCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "50", offset: "0" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(`/api/support/tickets?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setError(data?.error || "Unable to load support tickets.");
        setTickets([]);
        return;
      }

      setTickets(Array.isArray(data.tickets) ? data.tickets : []);
      setTotal(typeof data.total === "number" ? data.total : 0);
      setOpenCount(typeof data.openCount === "number" ? data.openCount : 0);
    } catch {
      setError("Network error while loading support tickets.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const handleStatusChange = async (ticketId: string, nextStatus: string) => {
    setUpdatingId(ticketId);
    setError(null);
    try {
      const res = await fetch(`/api/support/tickets/${encodeURIComponent(ticketId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error || "Could not update ticket status.");
        return;
      }
      setNotice(`Ticket marked as ${nextStatus.replaceAll("_", " ")}.`);
      await loadTickets();
    } catch {
      setError("Network error while updating ticket status.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#ECEBE5] pb-5">
        <div>
          <p className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.12em] text-[#644ABB]">
            FOUNDER OPS
          </p>
          <h1 className="mt-1 font-['Newsreader'] text-[36px] leading-tight tracking-[-0.8px] text-[#1B1C18] sm:text-[42px]">
            Support tickets
          </h1>
          <p className="mt-1 font-['Space_Grotesk'] text-[12px] text-[#747878]">
            Founder-only inbox for incoming complaints and tickets from /support stored in <code className="rounded bg-[#F5F4ED] px-1.5 py-0.5 font-mono text-[11px]">support_tickets</code>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[#F0DFB8] bg-[#FFFAEC] px-3 py-1 font-['Space_Grotesk'] text-[11px] font-semibold text-[#8A6826]">
            {openCount} open
          </span>
          <span className="rounded-full border border-[#E5E1D5] bg-[#F7F5EF] px-3 py-1 font-['Space_Grotesk'] text-[11px] font-semibold text-[#444748]">
            {total} total
          </span>
          <button
            type="button"
            onClick={() => void loadTickets()}
            className="h-9 rounded-[6px] border border-[#DCDDD6] bg-white px-3.5 font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18] transition hover:bg-[#F5F4ED]"
          >
            Refresh
          </button>
        </div>
      </header>

      <ToastNotice message={notice} onDismiss={() => setNotice(null)} />

      {error ? (
        <div
          role="alert"
          className="rounded-[8px] border border-[#F0D8D4] bg-[#FFF8F7] px-4 py-3 font-['Space_Grotesk'] text-[12px] text-[#A33A32]"
        >
          {error}
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
                  className={`rounded-[6px] px-3 py-1.5 font-['Space_Grotesk'] text-[12px] transition ${
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
            className="h-9 w-full rounded-[6px] border border-[#DCDDD6] bg-white px-3 font-['Space_Grotesk'] text-[12px] text-[#1B1C18] outline-none focus:border-[#7852D6] sm:w-72"
          />
        </div>

        {loading ? (
          <div className="px-5 py-12 text-center font-['Space_Grotesk'] text-[12px] text-[#747878]">
            Loading support tickets…
          </div>
        ) : tickets.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <h2 className="font-['Newsreader'] text-[24px] text-[#1B1C18]">No support tickets found</h2>
            <p className="mt-1 font-['Space_Grotesk'] text-[12px] text-[#747878]">
              Submissions from <code className="rounded bg-[#F5F4ED] px-1.5 py-0.5 font-mono text-[11px]">/support</code> will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#F0EFE9]">
            {tickets.map((ticket) => {
              const isExpanded = expandedId === ticket.id;
              const badgeClass =
                STATUS_BADGE[ticket.status] ??
                "border-[#E5E1D5] bg-[#F7F5EF] text-[#696B62]";

              return (
                <article key={ticket.id} className="p-4 transition-colors hover:bg-[#FCFBF8] sm:px-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-['Space_Grotesk'] text-[14px] font-semibold text-[#1B1C18]">
                          {ticket.subject}
                        </h2>
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 font-['Space_Grotesk'] text-[10px] font-semibold capitalize ${badgeClass}`}
                        >
                          {ticket.status.replaceAll("_", " ")}
                        </span>
                      </div>

                      <p className="mt-1 font-['Space_Grotesk'] text-[11px] text-[#747878]">
                        From <strong className="font-semibold text-[#1B1C18]">{ticket.name}</strong>{" "}
                        ({ticket.email})
                        {ticket.contactPhone ? ` · ${ticket.contactPhone}` : ""} ·{" "}
                        {formatTicketTime(ticket.createdAt)}
                      </p>

                      <p
                        className={`mt-2 whitespace-pre-line font-['Space_Grotesk'] text-[12.5px] leading-5 text-[#3B3E3B] ${
                          isExpanded ? "" : "line-clamp-2"
                        }`}
                      >
                        {ticket.message}
                      </p>

                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                        className="mt-1.5 font-['Space_Grotesk'] text-[11px] font-semibold text-[#644ABB] hover:underline"
                      >
                        {isExpanded ? "Show less" : "Read full message"}
                      </button>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <label className="sr-only" htmlFor={`ticket-status-${ticket.id}`}>
                        Status for {ticket.subject}
                      </label>
                      <select
                        id={`ticket-status-${ticket.id}`}
                        value={ticket.status}
                        disabled={updatingId === ticket.id}
                        onChange={(e) => void handleStatusChange(ticket.id, e.target.value)}
                        className="h-9 rounded-[6px] border border-[#DCDDD6] bg-white px-2.5 font-['Space_Grotesk'] text-[11px] font-semibold text-[#1B1C18] outline-none focus:border-[#7852D6] disabled:opacity-50"
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
    </div>
  );
}
