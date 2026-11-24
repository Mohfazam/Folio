"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  cancelQueuedCallAction,
  createTestCallAction,
  getLiveCallStatusAction,
} from "@/app/(dashboard)/dashboard/actions";

type LiveQueueEntry = {
  id: string;
  contactName: string | null;
  phoneNumber: string | null;
  campaignName: string | null;
  status: "pending" | "in_progress";
  scheduledFor: string | null;
  updatedAt: string | null;
};

type LiveCallStatus = {
  pendingCount: number;
  inProgressCount: number;
  duePendingCount: number;
  nextPendingAt: string | null;
  entries: LiveQueueEntry[];
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "purple" | "amber" | "red";
}) {
  const tones = {
    neutral: "border-[#E5E1D5] bg-[#F7F5EF] text-[#696B62]",
    green: "border-[#CDE5D4] bg-[#EFF8F1] text-[#34734B]",
    purple: "border-[#E8E3F2] bg-[#F7F4FC] text-[#705AA8]",
    amber: "border-[#F0DFB8] bg-[#FFFAEC] text-[#8A6826]",
    red: "border-[#F0D8D4] bg-[#FFF8F7] text-[#A33A32]",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 font-['Space_Grotesk'] text-[10px] font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function TestCallDashboard() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callNotice, setCallNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!callNotice) return;
    const timer = window.setTimeout(() => {
      setCallNotice(null);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [callNotice]);

  const [liveRefreshKey, setLiveRefreshKey] = useState(0);
  const [liveStatus, setLiveStatus] = useState<LiveCallStatus>({
    pendingCount: 0,
    inProgressCount: 0,
    duePendingCount: 0,
    nextPendingAt: null,
    entries: [],
  });
  const [liveStatusError, setLiveStatusError] = useState<string | null>(null);
  const [cancellingQueueId, setCancellingQueueId] = useState<string | null>(null);
  const [queueActionError, setQueueActionError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let timer: number | undefined;

    const scheduleNext = (ms: number) => {
      if (disposed) return;
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void refreshLiveStatus();
      }, ms);
    };

    const refreshLiveStatus = async () => {
      if (disposed) return;
      if (document.visibilityState === "hidden") {
        scheduleNext(15000);
        return;
      }
      if (inFlight) return;
      inFlight = true;

      try {
        const result = await getLiveCallStatusAction();
        if (disposed) return;

        if (!result.ok || !result.data) {
          setLiveStatusError(
            !result.ok && result.error
              ? result.error
              : "Live call status is temporarily unavailable.",
          );
          scheduleNext(15000);
          return;
        }

        const data = result.data;
        const entries = Array.isArray(data.entries)
          ? data.entries.filter(
              (entry): entry is LiveQueueEntry =>
                typeof entry === "object" &&
                entry !== null &&
                typeof (entry as LiveQueueEntry).id === "string" &&
                ((entry as LiveQueueEntry).status === "pending" ||
                  (entry as LiveQueueEntry).status === "in_progress"),
            )
          : [];

        const nextStatus: LiveCallStatus = {
          pendingCount: typeof data.pendingCount === "number" ? data.pendingCount : 0,
          inProgressCount: typeof data.inProgressCount === "number" ? data.inProgressCount : 0,
          duePendingCount: typeof data.duePendingCount === "number" ? data.duePendingCount : 0,
          nextPendingAt: typeof data.nextPendingAt === "string" ? data.nextPendingAt : null,
          entries,
        };
        setLiveStatus(nextStatus);
        setLiveStatusError(null);

        const hasImmediateWork = nextStatus.inProgressCount > 0 || nextStatus.duePendingCount > 0;
        if (hasImmediateWork) {
          scheduleNext(8000);
        } else if (nextStatus.pendingCount > 0 && nextStatus.nextPendingAt) {
          const nextAttemptAt = new Date(nextStatus.nextPendingAt).getTime();
          const waitMs = Number.isFinite(nextAttemptAt)
            ? Math.max(1000, nextAttemptAt - Date.now())
            : 30000;
          scheduleNext(waitMs);
        }
      } catch (err) {
        if (disposed) return;
        setLiveStatusError(
          err instanceof Error ? err.message : "Live call status is temporarily unavailable.",
        );
        scheduleNext(15000);
      } finally {
        inFlight = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (timer !== undefined) window.clearTimeout(timer);
        void refreshLiveStatus();
      }
    };

    void refreshLiveStatus();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      disposed = true;
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [liveRefreshKey]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    const normalizedPhone = phoneNumber.replace(/[\s()-]/g, "");
    if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
      setError("Enter a valid international phone number, including the + country code.");
      return;
    }
    if (!confirmed) {
      setError("Confirm that you have permission to call this number.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await createTestCallAction(normalizedPhone, confirmed);
      if (!result.ok) {
        setError(result.error || "The call could not be queued.");
        return;
      }
      setPhoneNumber("");
      setConfirmed(false);
      setLiveStatus((current) => ({
        ...current,
        pendingCount: current.pendingCount + 1,
        duePendingCount: current.duePendingCount + 1,
        entries: [
          {
            id: `queued-${Date.now()}`,
            contactName: null,
            phoneNumber: normalizedPhone,
            campaignName: "Test / direct call",
            status: "pending",
            scheduledFor: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          ...current.entries,
        ],
      }));
      setCallNotice(
        `Your test call to ${normalizedPhone} has been queued. It will be attempted when the calling service is available, subject to workspace limits.`,
      );
      setLiveRefreshKey((value) => value + 1);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The call could not be queued.");
    } finally {
      setBusy(false);
    }
  };

  const handleCancelQueuedCall = async (entry: LiveQueueEntry) => {
    if (entry.status !== "pending" || cancellingQueueId) return;
    const recipient = entry.contactName || entry.phoneNumber || "this recipient";
    if (!window.confirm(`Cancel the queued call to ${recipient}? It will not be attempted.`)) {
      return;
    }

    setCancellingQueueId(entry.id);
    setQueueActionError(null);
    const result = await cancelQueuedCallAction(entry.id);
    setCancellingQueueId(null);

    if (!result.ok) {
      setQueueActionError(result.error || "The queued call could not be cancelled.");
      setLiveRefreshKey((value) => value + 1);
      return;
    }

    setLiveStatus((current) => ({
      ...current,
      pendingCount: Math.max(0, current.pendingCount - 1),
      duePendingCount: Math.max(
        0,
        current.duePendingCount -
          (entry.scheduledFor && new Date(entry.scheduledFor).getTime() <= Date.now() ? 1 : 0),
      ),
      entries: current.entries.filter((item) => item.id !== entry.id),
    }));
    setCallNotice(`Queued call to ${recipient} cancelled.`);
    setLiveRefreshKey((value) => value + 1);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mt-1 font-['Newsreader'] text-[36px] leading-tight tracking-[-0.8px] text-[#1B1C18] sm:text-[42px]">
            Testing
          </h1>
          <p className="mt-2 max-w-[620px] font-['Space_Grotesk'] text-[12px] leading-5 text-[#747878]">
            Place a live outbound test call to preview your workspace&apos;s AI voice agent, greeting, and responses before launching campaigns.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="purple">Outbound test call</Badge>
          <Link
            href="/dashboard/calls"
            className="inline-flex h-10 items-center rounded-[5px] border border-[#DCDDD6] bg-white px-4 font-['Space_Grotesk'] text-[11px] font-semibold text-[#444748] transition-colors hover:bg-[#F7F6F1]"
          >
            View call logs →
          </Link>
        </div>
      </header>

      {callNotice ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
        >
          <div className="pointer-events-auto inline-flex max-w-[92vw] items-center gap-2.5 rounded-full border border-[#2C2E28] bg-[#1B1C18] px-4 py-2.5 font-['Space_Grotesk'] text-[12px] font-medium text-white shadow-[0_12px_32px_rgba(27,28,24,0.24)] transition-all duration-200">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#4ADE80]" aria-hidden="true" />
            <span>{callNotice}</span>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <section className="rounded-[8px] border border-[#ECEBE5] bg-white p-5 sm:p-6">
          <div className="border-b border-[#ECEBE5] pb-4">
            <h2 className="mt-1 font-['Newsreader'] text-[26px] leading-tight text-[#1B1C18]">
              Make a test call
            </h2>
            <p className="mt-1 font-['Space_Grotesk'] text-[11px] leading-5 text-[#747878]">
              Enter any phone number in international format. You do not need to create a contact or launch a campaign.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
            <label className="block font-['Space_Grotesk'] text-[12px] font-semibold text-[#444748]">
              Phone number
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="+91 98765 43210"
                className="mt-1.5 h-11 w-full rounded-[5px] border border-[#DCDDD6] bg-white px-3 font-['Space_Grotesk'] text-[13px] font-normal text-[#1B1C18] outline-none focus:border-[#7852D6]"
                required
              />
              <span className="mt-1 block font-['Space_Grotesk'] text-[10px] font-normal text-[#92938C]">
                Include + and your country code. Example: +919876543210.
              </span>
            </label>

            <label className="flex items-start gap-2.5 rounded-[5px] border border-[#ECEBE5] bg-[#FBFAF6] p-3 font-['Space_Grotesk'] text-[11px] leading-5 text-[#62645D]">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-1 h-3.5 w-3.5 accent-[#7852D6]"
              />
              <span>
                I confirm that I have the recipient&apos;s permission or another valid legal basis to place this call.
              </span>
            </label>

            <div className="rounded-[5px] border border-[#E9E8E1] bg-[#FBFAF6] px-3 py-2.5 font-['Space_Grotesk'] text-[10px] leading-5 text-[#747878]">
              The call uses your workspace&apos;s saved AI agent settings. Workspace credit, daily-call and availability limits still apply. Direct calls currently have a two-minute maximum duration.
            </div>

            {error ? (
              <div
                role="alert"
                className="rounded-[5px] border border-[#F0D8D4] bg-[#FFF8F7] px-3 py-2.5 font-['Space_Grotesk'] text-[11px] leading-5 text-[#A33A32]"
              >
                {error}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#ECEBE5] pt-4">
              <button
                type="submit"
                disabled={busy || !phoneNumber.trim() || !confirmed}
                className="inline-flex h-10 items-center gap-2 rounded-[5px] bg-[#1B1C18] px-5 font-['Space_Grotesk'] text-[11px] font-semibold text-white transition-colors hover:bg-[#34352F] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span aria-hidden="true" className="text-[14px]">＋</span>
                {busy ? "Queuing test call…" : "Make a test call"}
              </button>
            </div>
          </form>
        </section>

        <aside className="space-y-5">
          <section className="overflow-hidden rounded-[8px] border border-[#ECEBE5] bg-white" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ECEBE5] px-4 py-3.5 sm:px-5">
              <div>
                <h2 className="font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">
                  Live call queue
                </h2>
                <p className="mt-0.5 font-['Space_Grotesk'] text-[10px] text-[#85877F]">
                  Tracks queued and active calls in real time.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone="purple">{formatNumber(liveStatus.pendingCount)} pending</Badge>
                <Badge tone="green">{formatNumber(liveStatus.inProgressCount)} in progress</Badge>
              </div>
            </div>

            {liveStatusError ? (
              <p className="px-4 py-3 font-['Space_Grotesk'] text-[11px] text-[#8A6826]">
                Live status could not refresh. Retrying automatically.
              </p>
            ) : null}

            {queueActionError ? (
              <p role="alert" className="px-4 py-3 font-['Space_Grotesk'] text-[11px] text-[#A33A32]">
                {queueActionError}
              </p>
            ) : null}

            {liveStatus.entries.length > 0 ? (
              <div className="divide-y divide-[#F0EFE9]">
                {liveStatus.entries.slice(0, 8).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-['Space_Grotesk'] text-[11px] font-semibold text-[#1B1C18]">
                        {entry.contactName || entry.phoneNumber || "Unknown recipient"}
                      </p>
                      <p className="mt-0.5 truncate font-['Space_Grotesk'] text-[10px] text-[#92938C]">
                        {entry.campaignName || "Test / direct call"}
                        {entry.phoneNumber && entry.contactName ? ` · ${entry.phoneNumber}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={entry.status === "in_progress" ? "green" : "amber"}>
                        {entry.status === "in_progress" ? "Calling now" : "Queued"}
                      </Badge>
                      {entry.status === "pending" ? (
                        <button
                          type="button"
                          onClick={() => void handleCancelQueuedCall(entry)}
                          disabled={cancellingQueueId !== null}
                          className="rounded-[5px] border border-[#E7C9C5] bg-white px-2.5 py-1 font-['Space_Grotesk'] text-[10px] font-semibold text-[#A33A32] transition-colors hover:bg-[#FFF5F3] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {cancellingQueueId === entry.id ? "Cancelling…" : "Cancel"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-8 text-center font-['Space_Grotesk'] text-[11px] text-[#85877F]">
                No queued or active calls right now. Place a test call on the left to begin.
              </div>
            )}
          </section>

          <section className="rounded-[8px] border border-[#ECEBE5] bg-white p-4 sm:p-5">
            <h2 className="font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">
              Testing checklist
            </h2>
            <ul className="mt-3 space-y-2 font-['Space_Grotesk'] text-[11px] leading-5 text-[#62645D]">
              <li>• Configure your agent voice, greeting, and knowledge base in AI Studio first.</li>
              <li>• Completed test calls automatically appear in Calls with transcripts and audio recordings.</li>
              <li>• Standard workspace credits and concurrency limits apply to test calls.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
