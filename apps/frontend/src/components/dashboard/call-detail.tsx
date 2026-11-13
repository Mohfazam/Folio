import type { ReactNode } from "react";
import Link from "next/link";

type TranscriptLine = {
  speaker: "assistant" | "user";
  text: string;
  timestamp: string | null;
  isComplete: boolean;
};

type ContactDetail = {
  id: string | null;
  fullName: string | null;
  email: string | null;
  companyName: string | null;
  jobTitle: string | null;
  department: string | null;
  industry: string | null;
  city: string | null;
  leadScore: number | null;
  lifecycleStage: string | null;
  accountTier: string | null;
  courseOrStream: string | null;
};

type CampaignDetail = {
  id: string | null;
  name: string | null;
  type: string | null;
  primaryObjective: string | null;
};

export type CallDetailRecord = {
  id: string;
  contactId: string | null;
  campaignId: string | null;
  contactName: string | null;
  phoneNumber: string | null;
  attemptNumber: number;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  outcome: string;
  isBillable: boolean;
  creditsCharged: number;
  summary: string | null;
  interestLevel: string | null;
  sentiment: string | null;
  objectionsRaised: string[];
  followUpRequested: boolean;
  costTelephony: number | null;
  costStt: number | null;
  costLlm: number | null;
  costTts: number | null;
  costTotal: number | null;
  recordingUrl: string | null;
  transcript: TranscriptLine[];
  createdAt: string | null;
  contact: ContactDetail | null;
  campaign: CampaignDetail | null;
};

function formatDate(value: string | null): string {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds < 0) return "—";
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remaining}s` : `${remaining}s`;
}

function formatAmount(value: number | null): string {
  return value === null ? "—" : value.toFixed(4);
}

function safeRecordingUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "purple" | "amber" | "red";
}) {
  const styles = {
    neutral: "border-[#E5E1D5] bg-[#F7F5EF] text-[#696B62]",
    green: "border-[#CDE5D4] bg-[#EFF8F1] text-[#34734B]",
    purple: "border-[#E8E3F2] bg-[#F7F4FC] text-[#705AA8]",
    amber: "border-[#F0DFB8] bg-[#FFFAEC] text-[#8A6826]",
    red: "border-[#F0D8D4] bg-[#FFF8F7] text-[#A33A32]",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 font-['Space_Grotesk'] text-[10px] font-semibold ${styles[tone]}`}>
      {children}
    </span>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[7px] border border-[#ECEBE5] bg-[#FFFEFB] p-3.5">
      <p className="font-['Space_Grotesk'] text-[10px] font-semibold uppercase tracking-[0.06em] text-[#92938C]">{label}</p>
      <p className="mt-1.5 break-words font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">{value}</p>
    </div>
  );
}

export function CallDetailView({
  call,
  error,
}: {
  call: CallDetailRecord | null;
  error: string | null;
}) {
  if (!call) {
    return (
      <div className="space-y-5">
        <Link href="/dashboard/calls" className="inline-flex items-center gap-2 font-['Space_Grotesk'] text-[11px] font-semibold text-[#7852D6] hover:text-[#6040B4]">
          ← Back to calls
        </Link>
        <div className="rounded-[8px] border border-[#F0D8D4] bg-[#FFF8F7] px-5 py-5">
          <h1 className="font-['Newsreader'] text-[30px] text-[#1B1C18]">Call details unavailable</h1>
          <p className="mt-2 font-['Space_Grotesk'] text-[12px] leading-5 text-[#A33A32]">{error ?? "Unable to load this call."}</p>
        </div>
      </div>
    );
  }

  const recordingUrl = safeRecordingUrl(call.recordingUrl);
  const outcomeTone = call.outcome === "connected" ? "green" : call.outcome === "failed" ? "red" : call.outcome === "busy" || call.outcome === "dropped_early" ? "amber" : "neutral";
  const interestTone = call.interestLevel === "high" ? "green" : call.interestLevel === "medium" ? "purple" : "neutral";
  const contactName = call.contact?.fullName || call.contactName || "Unknown contact";

  return (
    <div className="space-y-6">
      <header>
        <Link href="/dashboard/calls" className="inline-flex items-center gap-2 font-['Space_Grotesk'] text-[11px] font-semibold text-[#7852D6] hover:text-[#6040B4]">
          ← Back to calls
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.12em] text-[#9A8ABF]">Call record</p>
            <h1 className="mt-1 font-['Newsreader'] text-[34px] leading-tight tracking-[-0.7px] text-[#1B1C18]">{contactName}</h1>
            <p className="mt-2 font-['Space_Grotesk'] text-[12px] text-[#747878]">{call.phoneNumber || "No phone number"} · {formatDate(call.startedAt)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={outcomeTone}>{call.outcome.replaceAll("_", " ")}</Badge>
            {call.interestLevel ? <Badge tone={interestTone}>{call.interestLevel} interest</Badge> : null}
            {call.sentiment ? <Badge tone={call.sentiment === "positive" ? "green" : call.sentiment === "negative" ? "red" : "neutral"}>{call.sentiment} sentiment</Badge> : null}
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Call facts">
        <InfoCard label="Duration" value={formatDuration(call.durationSeconds)} />
        <InfoCard label="Attempt" value={`#${call.attemptNumber}`} />
        <InfoCard label="Credits charged" value={String(call.creditsCharged)} />
        <InfoCard label="Billing" value={call.isBillable ? "Billable call" : "Not billable"} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
        <div className="space-y-5">
          <section className="rounded-[8px] border border-[#ECEBE5] bg-white p-4 sm:p-5">
            <div className="mb-4">
              <h2 className="font-['Space_Grotesk'] text-[14px] font-semibold text-[#1B1C18]">Call summary</h2>
              <p className="mt-1 font-['Space_Grotesk'] text-[11px] text-[#85877F]">Post-call summary and next-step signals.</p>
            </div>
            <p className="whitespace-pre-wrap font-['Space_Grotesk'] text-[12px] leading-6 text-[#444748]">{call.summary || "No summary is available for this call."}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {call.followUpRequested ? <Badge tone="purple">Follow-up requested</Badge> : <Badge>No follow-up requested</Badge>}
              {call.sentiment ? <Badge tone={call.sentiment === "positive" ? "green" : call.sentiment === "negative" ? "red" : "neutral"}>{call.sentiment} sentiment</Badge> : null}
              {call.interestLevel ? <Badge tone={interestTone}>{call.interestLevel} interest</Badge> : null}
            </div>
            {call.objectionsRaised.length > 0 ? (
              <div className="mt-5 border-t border-[#F0EFE9] pt-4">
                <h3 className="font-['Space_Grotesk'] text-[11px] font-semibold text-[#1B1C18]">Objections raised</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 font-['Space_Grotesk'] text-[11px] leading-5 text-[#747878]">
                  {call.objectionsRaised.map((objection, index) => <li key={`${index}-${objection}`}>{objection}</li>)}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="rounded-[8px] border border-[#ECEBE5] bg-white p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-['Space_Grotesk'] text-[14px] font-semibold text-[#1B1C18]">Conversation transcript</h2>
                <p className="mt-1 font-['Space_Grotesk'] text-[11px] text-[#85877F]">Recorded conversation turns from the call.</p>
              </div>
              <Badge>{call.transcript.length} entries</Badge>
            </div>

            {call.transcript.length > 0 ? (
              <div className="space-y-3">
                {call.transcript.map((line, index) => {
                  const assistant = line.speaker === "assistant";
                  return (
                    <div key={`${index}-${line.timestamp ?? "transcript"}`} className={`flex ${assistant ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[92%] rounded-[9px] border px-3.5 py-3 sm:max-w-[82%] ${assistant ? "border-[#ECEBE5] bg-[#F8F7F2]" : "border-[#E7E0F3] bg-[#F5F1FB]"}`}>
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                          <span className={`font-['Space_Grotesk'] text-[9px] font-bold uppercase tracking-[0.08em] ${assistant ? "text-[#747878]" : "text-[#806DB2]"}`}>{assistant ? "FOOLIOO AGENT" : "CONTACT"}</span>
                          {line.timestamp ? <time className="font-['Space_Grotesk'] text-[9px] text-[#92938C]">{formatDate(line.timestamp)}</time> : null}
                        </div>
                        <p className="mt-2 whitespace-pre-wrap break-words font-['Space_Grotesk'] text-[12px] leading-5 text-[#34362E]">{line.text || "[No transcript text]"}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[6px] bg-[#FBFAF6] px-4 py-8 text-center font-['Space_Grotesk'] text-[11px] text-[#85877F]">No transcript is available for this call.</div>
            )}
          </section>

          <section className="rounded-[8px] border border-[#ECEBE5] bg-white p-4 sm:p-5">
            <h2 className="font-['Space_Grotesk'] text-[14px] font-semibold text-[#1B1C18]">Recording</h2>
            <p className="mt-1 font-['Space_Grotesk'] text-[11px] text-[#85877F]">Audio recording, when retained and available.</p>
            {recordingUrl ? (
              <audio controls preload="none" src={recordingUrl} className="mt-4 w-full">Your browser does not support audio playback.</audio>
            ) : (
              <p className="mt-4 rounded-[6px] bg-[#FBFAF6] px-4 py-4 font-['Space_Grotesk'] text-[11px] leading-5 text-[#85877F]">No recording is available for this call.</p>
            )}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-[8px] border border-[#ECEBE5] bg-white p-4 sm:p-5">
            <h2 className="font-['Space_Grotesk'] text-[14px] font-semibold text-[#1B1C18]">Contact details</h2>
            <div className="mt-4 space-y-3">
              <DetailRow label="Name" value={contactName} />
              <DetailRow label="Email" value={call.contact?.email} />
              <DetailRow label="Company" value={call.contact?.companyName} />
              <DetailRow label="Job title" value={call.contact?.jobTitle} />
              <DetailRow label="Location" value={call.contact?.city} />
              <DetailRow label="Lifecycle" value={call.contact?.lifecycleStage} />
              <DetailRow label="Account tier" value={call.contact?.accountTier} />
              <DetailRow label="Lead score" value={call.contact?.leadScore === null || call.contact?.leadScore === undefined ? null : String(call.contact.leadScore)} />
              <DetailRow label="Course / stream" value={call.contact?.courseOrStream} />
            </div>
          </section>

          <section className="rounded-[8px] border border-[#ECEBE5] bg-white p-4 sm:p-5">
            <h2 className="font-['Space_Grotesk'] text-[14px] font-semibold text-[#1B1C18]">Campaign</h2>
            {call.campaign?.name ? (
              <>
                <p className="mt-3 font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">{call.campaign.name}</p>
                {call.campaign.type ? <p className="mt-1 font-['Space_Grotesk'] text-[10px] capitalize text-[#85877F]">{call.campaign.type.replaceAll("_", " ")}</p> : null}
                {call.campaign.primaryObjective ? <p className="mt-3 font-['Space_Grotesk'] text-[11px] leading-5 text-[#747878]">{call.campaign.primaryObjective}</p> : null}
              </>
            ) : (
              <p className="mt-3 font-['Space_Grotesk'] text-[11px] text-[#85877F]">This call is not linked to a campaign.</p>
            )}
          </section>

          <section className="rounded-[8px] border border-[#ECEBE5] bg-white p-4 sm:p-5">
            <h2 className="font-['Space_Grotesk'] text-[14px] font-semibold text-[#1B1C18]">Cost breakdown</h2>
            <div className="mt-4 space-y-3">
              <DetailRow label="Telephony" value={formatAmount(call.costTelephony)} />
              <DetailRow label="Speech recognition" value={formatAmount(call.costStt)} />
              <DetailRow label="Language model" value={formatAmount(call.costLlm)} />
              <DetailRow label="Text to speech" value={formatAmount(call.costTts)} />
              <div className="border-t border-[#F0EFE9] pt-3">
                <DetailRow label="Estimated total" value={formatAmount(call.costTotal)} strong />
              </div>
              <p className="font-['Space_Grotesk'] text-[9px] leading-4 text-[#92938C]">Values are shown as returned by the calling service and backend. Currency is not inferred here.</p>
            </div>
          </section>

          <section className="rounded-[8px] border border-[#ECEBE5] bg-white p-4 sm:p-5">
            <h2 className="font-['Space_Grotesk'] text-[14px] font-semibold text-[#1B1C18]">Call metadata</h2>
            <div className="mt-4 space-y-3">
              <DetailRow label="Call ID" value={call.id} mono />
              <DetailRow label="Contact ID" value={call.contactId} mono />
              <DetailRow label="Campaign ID" value={call.campaignId} mono />
              <DetailRow label="Started" value={formatDate(call.startedAt)} />
              <DetailRow label="Ended" value={formatDate(call.endedAt)} />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  strong = false,
  mono = false,
}: {
  label: string;
  value: string | null | undefined;
  strong?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <span className="shrink-0 font-['Space_Grotesk'] text-[10px] text-[#85877F]">{label}</span>
      <span className={`min-w-0 break-all text-right font-['Space_Grotesk'] ${strong ? "text-[12px] font-bold text-[#1B1C18]" : mono ? "text-[9px] text-[#747878]" : "text-[11px] text-[#444748]"} ${mono ? "font-mono" : ""}`}>
        {value || "—"}
      </span>
    </div>
  );
}
