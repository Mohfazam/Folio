"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { ConfirmDialog, useDialogFocusTrap } from "@/components/dashboard/accessible-dialog";
import { ToastNotice } from "@/components/dashboard/toast-notice";
import {
  createFollowUpAction,
  deleteFollowUpAction,
  updateFollowUpAction,
} from "@/app/(dashboard)/dashboard/actions";
import { formatPhoneNumber } from "@/lib/utils/format-phone";

type ContactOption = { id: string; fullName: string; phoneNumber: string };
export type FollowUpRecord = {
  id: string;
  contactId: string;
  callId: string | null;
  type: string;
  priority: string;
  dueDate: string | null;
  requestedCallbackTime: string | null;
  assignedTo: string | null;
  status: "open" | "done" | "not_needed" | string;
  notes: string | null;
  createdAt: string | null;
  contact: {
    id: string | null;
    fullName: string | null;
    phoneNumber: string | null;
    email: string | null;
    companyName: string | null;
    courseOrStream: string | null;
  } | null;
  call: {
    id: string | null;
    startedAt: string | null;
    outcome: string | null;
    sentiment: string | null;
    interestLevel: string | null;
    durationSeconds: number | null;
    summary: string | null;
  } | null;
};

type Props = {
  followUps: FollowUpRecord[];
  total: number;
  contacts: ContactOption[];
  initialError: string | null;
  initialStatus: string;
};

const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
const TYPES = ["call_back", "demo_scheduled", "information_sent", "escalation"] as const;
const INPUT = "h-10 w-full rounded-[5px] border border-[#E5E4DC] bg-white px-3 font-['Space_Grotesk'] text-[14px] text-[#1B1C18] outline-none focus:border-[#7852D6] focus:ring-2 focus:ring-[#7852D6]/10";
const LABEL = "mb-1.5 block font-['Space_Grotesk'] text-[13px] font-semibold text-[#55574F]";

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null) {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function isOverdue(item: FollowUpRecord) {
  return item.status === "open" && Boolean(item.dueDate) && new Date(item.dueDate!).getTime() < Date.now();
}

function StatusPill({ status }: { status: string }) {
  const dot = status === "done"
    ? "bg-[#2F7A4D]"
    : status === "not_needed"
      ? "bg-[#8E918B]"
      : "bg-[#B87D1E]";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[5px] border border-[#E6E5DD] bg-[#FAF9F5] px-2 py-0.5 font-['Space_Grotesk'] text-[12px] font-medium text-[#2E302B]">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      {titleCase(status)}
    </span>
  );
}

function PriorityPill({ priority }: { priority: string }) {
  const textTone = priority === "urgent" ? "text-[#A33A32]" : priority === "high" ? "text-[#8A6826]" : "text-[#525552]";
  return (
    <span className={`inline-flex items-center rounded-[5px] border border-[#ECEBE5] bg-white px-2 py-0.5 font-['Space_Grotesk'] text-[12px] font-medium ${textTone}`}>
      {titleCase(priority)}
    </span>
  );
}

function Metric({ label, value, hint }: { label: string; value: number; hint: string }) {
  return <div className="rounded-[8px] border border-[#ECEBE5] bg-[#FFFEFB] px-4 py-4"><p className="font-['Space_Grotesk'] text-[13px] text-[#747878]">{label}</p><p className="mt-2 font-['Newsreader'] text-[32px] leading-none text-[#1B1C18]">{value.toLocaleString("en-IN")}</p><p className="mt-2 font-['Space_Grotesk'] text-[12px] text-[#92938C]">{hint}</p></div>;
}

export function FollowUpsDashboard({ followUps, total, contacts, initialError, initialStatus }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(initialStatus || "open");
  const [priority, setPriority] = useState("all");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<FollowUpRecord[]>(followUps);
  const [notice, setNotice] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [pendingDeleteItem, setPendingDeleteItem] = useState<FollowUpRecord | null>(null);
  const createDialogRef = useRef<HTMLElement | null>(null);

  useDialogFocusTrap(creating, createDialogRef, () => {
    if (busyId !== "new") setCreating(false);
  });

  useEffect(() => {
    setItems(followUps);
  }, [followUps]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => {
      setNotice(null);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const openCount = items.filter((item) => item.status === "open").length;
  const overdueCount = items.filter(isOverdue).length;
  const urgentCount = items.filter((item) => item.status === "open" && (item.priority === "urgent" || item.priority === "high")).length;
  const completedCount = items.filter((item) => item.status === "done").length;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesStatus = status === "all" || item.status === status;
      const matchesPriority = priority === "all" || item.priority === priority;
      const searchable = `${item.contact?.fullName ?? ""} ${item.contact?.phoneNumber ?? ""} ${item.notes ?? ""} ${item.type}`.toLowerCase();
      return matchesStatus && matchesPriority && (!needle || searchable.includes(needle));
    });
  }, [items, priority, query, status]);

  async function changeStatus(item: FollowUpRecord, nextStatus: string) {
    const previousItems = items;
    setBusyId(item.id); setError(null); setNotice(null);
    setItems((current) => current.map((row) => (row.id === item.id ? { ...row, status: nextStatus } : row)));
    const result = await updateFollowUpAction(item.id, { status: nextStatus });
    setBusyId(null);
    if (!result.ok) {
      setItems(previousItems);
      setError(result.error);
      return;
    }
    const updatedRow = (result.data as { followUp?: FollowUpRecord } | undefined)?.followUp;
    if (updatedRow && typeof updatedRow === "object") {
      setItems((current) => current.map((row) => (row.id === item.id ? { ...row, ...updatedRow } : row)));
    }
    setNotice(nextStatus === "done" ? "Follow-up marked as completed." : nextStatus === "not_needed" ? "Follow-up closed." : "Follow-up reopened.");
    router.refresh();
  }

  function removeItem(item: FollowUpRecord) {
    setError(null);
    setPendingDeleteItem(item);
  }

  const evictFollowUpFromCache = (targetId: string) => {
    setItems((current) => current.filter((row) => row.id !== targetId));
    queryClient.setQueriesData<Record<string, unknown>>(
      { queryKey: ["dashboard", "follow-ups"] },
      (cached) => {
        if (!cached || !Array.isArray(cached.followUps)) return cached;
        const filtered = cached.followUps.filter(
          (row) =>
            !(
              typeof row === "object" &&
              row !== null &&
              "id" in row &&
              (row as { id?: unknown }).id === targetId
            ),
        );
        if (filtered.length === cached.followUps.length) return cached;
        return {
          ...cached,
          followUps: filtered,
          total: typeof cached.total === "number" ? Math.max(0, cached.total - 1) : filtered.length,
        };
      },
    );
  };

  async function confirmRemoveItem() {
    const item = pendingDeleteItem;
    if (!item) return;
    const previousItems = items;
    setBusyId(item.id); setError(null); setNotice(null);
    evictFollowUpFromCache(item.id);
    const result = await deleteFollowUpAction(item.id);
    setBusyId(null);
    setPendingDeleteItem(null);
    const alreadyGone =
      !result.ok &&
      (result.status === 404 || /not found/i.test(result.error));
    if (!result.ok && !alreadyGone) {
      setItems(previousItems);
      setError(result.error);
      return;
    }
    if (alreadyGone) {
      evictFollowUpFromCache(item.id);
    }
    setNotice(alreadyGone ? "Follow-up was already removed. Synced queue." : "Follow-up deleted.");
    await queryClient.invalidateQueries({ queryKey: ["dashboard", "follow-ups"] });
    router.refresh();
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const contactId = String(form.get("contactId") || "");
    const typeVal = String(form.get("type") || "call_back");
    const priorityVal = String(form.get("priority") || "medium");
    const dueDateValue = String(form.get("dueDate") || "");
    const callbackValue = String(form.get("requestedCallbackTime") || "");
    const notesVal = String(form.get("notes") || "").trim() || null;
    const matchedContact = contacts.find((c) => c.id === contactId);

    setBusyId("new"); setError(null);
    const result = await createFollowUpAction({
      contactId,
      type: typeVal,
      priority: priorityVal,
      dueDate: dueDateValue ? new Date(dueDateValue).toISOString() : undefined,
      requestedCallbackTime: callbackValue ? new Date(callbackValue).toISOString() : undefined,
      notes: notesVal || undefined,
    });
    setBusyId(null);
    if (!result.ok) { setError(result.error); return; }

    const createdFromServer = (result.data as { followUp?: FollowUpRecord } | undefined)?.followUp;
    const optimisticRecord: FollowUpRecord = createdFromServer && typeof createdFromServer === "object"
      ? {
          ...createdFromServer,
          contact: createdFromServer.contact ?? (matchedContact
            ? {
                id: matchedContact.id,
                fullName: matchedContact.fullName,
                phoneNumber: matchedContact.phoneNumber,
                email: null,
                companyName: null,
                courseOrStream: null,
              }
            : null),
        }
      : {
          id: `temp-${Date.now()}`,
          contactId,
          callId: null,
          type: typeVal,
          priority: priorityVal,
          dueDate: dueDateValue ? new Date(dueDateValue).toISOString() : null,
          requestedCallbackTime: callbackValue ? new Date(callbackValue).toISOString() : null,
          assignedTo: null,
          status: "open",
          notes: notesVal,
          createdAt: new Date().toISOString(),
          contact: matchedContact
            ? {
                id: matchedContact.id,
                fullName: matchedContact.fullName,
                phoneNumber: matchedContact.phoneNumber,
                email: null,
                companyName: null,
                courseOrStream: null,
              }
            : null,
          call: null,
        };

    setItems((current) => [optimisticRecord, ...current]);
    setCreating(false);
    setNotice("Follow-up created.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-['Newsreader'] text-[36px] leading-tight tracking-[-0.8px] text-[#1B1C18] sm:text-[42px]">Follow-ups</h1>
          <p className="mt-2 max-w-[620px] font-['Space_Grotesk'] text-[14px] leading-[1.55] text-[#747878]">Keep callbacks, demos, escalations and promised next steps organized across your contacts.</p>
        </div>
        <button type="button" onClick={() => { setCreating(true); setError(null); }} className="inline-flex h-10 items-center gap-2 rounded-[5px] bg-[#1B1C18] px-4 font-['Space_Grotesk'] text-[14px] font-semibold text-white hover:bg-[#34352F]">+ New follow-up</button>
      </div>

      <ToastNotice message={notice} onDismiss={() => setNotice(null)} />
      {error || initialError ? <div role="alert" className="rounded-[6px] border border-[#F0D8D4] bg-[#FFF8F7] px-4 py-3 font-['Space_Grotesk'] text-[14px] leading-[1.55] text-[#A33A32]">{error || initialError}</div> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Open follow-ups" value={openCount} hint="Need an action" />
        <Metric label="Overdue" value={overdueCount} hint="Past their due date" />
        <Metric label="High priority" value={urgentCount} hint="High or urgent items" />
        <Metric label="Completed" value={completedCount} hint={`${total.toLocaleString("en-IN")} records loaded`} />
      </div>

      <section className="overflow-hidden rounded-[8px] border border-[#ECEBE5] bg-white">
        <div className="flex flex-col gap-3 border-b border-[#ECEBE5] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 className="font-['Space_Grotesk'] text-[15px] font-semibold text-[#1B1C18] sm:text-[16px]">Follow-up queue</h2><p className="mt-1 font-['Space_Grotesk'] text-[13px] text-[#85877F]">Prioritize the next action and keep every commitment visible.</p></div>
          <div className="grid w-full gap-2 sm:grid-cols-[minmax(180px,1fr)_150px_150px] lg:max-w-[650px]">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search contacts or notes" className={INPUT} />
            <select value={status} onChange={(event) => setStatus(event.target.value)} className={INPUT}><option value="all">All statuses</option><option value="open">Open</option><option value="done">Completed</option><option value="not_needed">Not needed</option></select>
            <select value={priority} onChange={(event) => setPriority(event.target.value)} className={INPUT}><option value="all">All priorities</option>{PRIORITIES.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select>
          </div>
        </div>

        {filtered.length ? <div className="divide-y divide-[#F0EFE9]">
          {filtered.map((item) => {
            const contactName = item.contact?.fullName || "Unknown contact";
            const description = item.notes || item.call?.summary || "No notes added.";
            const isExpanded = Boolean(expandedIds[item.id]);
            const canExpand = description.length > 105 || description.includes("\n");

            return <article key={item.id} className="grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(150px,0.8fr)_minmax(180px,0.8fr)] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-['Space_Grotesk'] text-[15px] font-semibold text-[#1B1C18]">{contactName}</h3><StatusPill status={item.status} /><PriorityPill priority={item.priority} />{isOverdue(item) ? <span className="font-['Space_Grotesk'] text-[12px] font-semibold text-[#B33B32]">Overdue</span> : null}</div>
                <p className="mt-1 font-['Space_Grotesk'] text-[13px] text-[#747878]">{formatPhoneNumber(item.contact?.phoneNumber) || "No phone number"}{item.contact?.courseOrStream ? ` · ${item.contact.courseOrStream}` : ""}</p>
                
                <div className="mt-2">
                  <p
                    id={`follow-up-notes-${item.id}`}
                    className={`whitespace-pre-line break-words font-['Space_Grotesk'] text-[13px] leading-5 text-[#747878] ${isExpanded ? "" : "line-clamp-2"}`}
                  >
                    {description}
                  </p>
                  {canExpand ? (
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-controls={`follow-up-notes-${item.id}`}
                      onClick={() => toggleExpand(item.id)}
                      className="mt-1 inline-flex items-center rounded font-['Space_Grotesk'] text-[13px] font-semibold text-[#7055A8] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6]"
                    >
                      {isExpanded ? "Show less" : "Read more"}
                    </button>
                  ) : null}
                </div>

                {item.call?.outcome ? <p className="mt-1 font-['Space_Grotesk'] text-[12px] text-[#92938C]">From call · {titleCase(item.call.outcome)}{item.call.interestLevel ? ` · ${titleCase(item.call.interestLevel)} interest` : ""}</p> : null}
              </div>
              <div className="space-y-1"><p className="font-['Space_Grotesk'] text-[12px] font-semibold uppercase tracking-wide text-[#92938C]">{titleCase(item.type)}</p><p className="font-['Space_Grotesk'] text-[13px] text-[#444748]">Due {formatDate(item.dueDate || item.requestedCallbackTime)}</p><p className="font-['Space_Grotesk'] text-[12px] text-[#92938C]">Created {formatDate(item.createdAt)}</p></div>
              <div className="flex flex-wrap items-center gap-2 border-t border-[#F0EFE9] pt-3 lg:justify-end lg:border-0 lg:pt-0">
                {item.status === "open" ? <><button type="button" disabled={busyId === item.id} onClick={() => changeStatus(item, "done")} className="rounded-[5px] bg-[#1B1C18] px-3 py-2 font-['Space_Grotesk'] text-[12px] font-semibold text-white disabled:opacity-50">{busyId === item.id ? "Saving…" : "Mark complete"}</button><button type="button" disabled={busyId === item.id} onClick={() => changeStatus(item, "not_needed")} className="rounded-[5px] border border-[#DCDDD6] px-3 py-2 font-['Space_Grotesk'] text-[12px] font-semibold text-[#55574F] disabled:opacity-50">Close</button></> : <button type="button" disabled={busyId === item.id} onClick={() => changeStatus(item, "open")} className="rounded-[5px] border border-[#DCDDD6] px-3 py-2 font-['Space_Grotesk'] text-[12px] font-semibold text-[#55574F] disabled:opacity-50">Reopen</button>}
                <button type="button" disabled={busyId === item.id} onClick={() => removeItem(item)} className="rounded-[5px] px-2 py-2 font-['Space_Grotesk'] text-[12px] font-semibold text-[#A33A32] hover:bg-[#FFF4F2] disabled:opacity-50">Delete</button>
              </div>
            </article>;
          })}
        </div> : <div className="px-5 py-14 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#F2EEFA] text-[#705AA8]"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 4h14v17H5zM8 8h8M8 12h8M8 16h5" /></svg></div><h3 className="mt-4 font-['Newsreader'] text-[24px] text-[#1B1C18]">{items.length ? "No follow-ups match these filters" : "No follow-ups yet"}</h3><p className="mx-auto mt-2 max-w-[390px] font-['Space_Grotesk'] text-[13px] leading-5 text-[#85877F]">Follow-ups requested during calls will appear here automatically. You can also create one manually.</p><button type="button" onClick={() => setCreating(true)} className="mt-5 rounded-[5px] bg-[#1B1C18] px-4 py-2.5 font-['Space_Grotesk'] text-[13px] font-semibold text-white">Create follow-up</button></div>}
        <div className="flex items-center justify-between border-t border-[#ECEBE5] px-4 py-3 font-['Space_Grotesk'] text-[12px] tabular-nums text-[#92938C] sm:px-5"><span>Showing {filtered.length} of {items.length} loaded follow-ups</span><span>{total.toLocaleString("en-IN")} total in workspace</span></div>
      </section>

      {creating ? <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#1B1C18]/35 px-4 py-6" onMouseDown={(event) => { if (event.target === event.currentTarget && busyId !== "new") setCreating(false); }}><section ref={createDialogRef} role="dialog" aria-modal="true" aria-labelledby="new-follow-up-title" tabIndex={-1} className="max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-[10px] border border-[#E9E8E1] bg-white p-5 shadow-[0_20px_64px_rgba(27,28,24,0.2)] outline-none sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="font-['Space_Grotesk'] text-[12px] font-bold uppercase tracking-[0.1em] text-[#9A8ABF]">Customer action</p><h2 id="new-follow-up-title" className="mt-1 font-['Newsreader'] text-[28px] text-[#1B1C18]">New follow-up</h2><p className="mt-1 font-['Space_Grotesk'] text-[13px] text-[#747878]">Create a callback, demo, information task or escalation.</p></div><button type="button" onClick={() => setCreating(false)} disabled={busyId === "new"} className="rounded p-2 text-[#747878] hover:bg-[#F5F4ED]" aria-label="Close">✕</button></div>
        <form onSubmit={handleCreate} className="mt-5 space-y-4"><div><label className={LABEL}>Contact</label><select name="contactId" required defaultValue="" className={INPUT}><option value="" disabled>Select a contact</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.fullName} · {formatPhoneNumber(contact.phoneNumber)}</option>)}</select>{contacts.length === 0 ? <p className="mt-1 text-[12px] text-[#A33A32]">No contacts are available. Add a contact before creating a follow-up.</p> : null}</div><div className="grid gap-3 sm:grid-cols-2"><div><label className={LABEL}>Action type</label><select name="type" defaultValue="call_back" className={INPUT}>{TYPES.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></div><div><label className={LABEL}>Priority</label><select name="priority" defaultValue="medium" className={INPUT}>{PRIORITIES.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></div></div><div className="grid gap-3 sm:grid-cols-2"><div><label className={LABEL}>Due date</label><input type="datetime-local" name="dueDate" className={INPUT} /></div><div><label className={LABEL}>Requested callback time</label><input type="datetime-local" name="requestedCallbackTime" className={INPUT} /></div></div><div><label className={LABEL}>Notes</label><textarea name="notes" rows={4} maxLength={4000} className="w-full rounded-[5px] border border-[#E5E4DC] bg-white px-3 py-2.5 font-['Space_Grotesk'] text-[14px] leading-[1.55] text-[#1B1C18] outline-none focus:border-[#7852D6]" placeholder="What needs to happen next?" /></div>{error ? <p role="alert" className="text-[13px] text-[#A33A32]">{error}</p> : null}<div className="flex justify-end gap-2 border-t border-[#ECEBE5] pt-4"><button type="button" onClick={() => setCreating(false)} disabled={busyId === "new"} className="rounded-[5px] border border-[#DCDDD6] px-4 py-2.5 font-['Space_Grotesk'] text-[13px] font-semibold text-[#55574F]">Cancel</button><button type="submit" disabled={busyId === "new" || contacts.length === 0} className="rounded-[5px] bg-[#1B1C18] px-4 py-2.5 font-['Space_Grotesk'] text-[13px] font-semibold text-white disabled:opacity-50">{busyId === "new" ? "Creating…" : "Create follow-up"}</button></div></form>
      </section></div> : null}
      <ConfirmDialog
        open={pendingDeleteItem !== null}
        title="Delete follow-up?"
        description={`Delete the follow-up for ${pendingDeleteItem?.contact?.fullName || "this contact"}? This cannot be undone.`}
        confirmLabel="Delete"
        busy={busyId === pendingDeleteItem?.id}
        onCancel={() => setPendingDeleteItem(null)}
        onConfirm={() => void confirmRemoveItem()}
      />
    </div>
  );
}