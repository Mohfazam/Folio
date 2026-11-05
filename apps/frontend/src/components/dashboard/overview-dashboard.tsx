"use client";

import { useState, type ReactNode } from "react";
import { useDashboardProfile } from "@/components/dashboard/dashboard-shell";

type OverviewMetrics = {
  contactsReached: string | null;
  successfulConversations: string | null;
  followUpsScheduled: string | null;
  campaignCompletion: string | null;
  telemetryAvailable: boolean;
};

const SETUP_STEPS = [
  {
    id: 1,
    title: "Configure voice persona & guardrails",
    description: "Set the assistant's tone, pronunciation, response boundaries, and handoff rules so every conversation stays consistent with your business.",
    detail: "Choose a voice, define how the assistant should respond, and document topics or requests that require a human handoff.",
    previewLabel: "Suggested starting point",
    previewValue: "Warm, professional, and concise",
    action: "Set up voice",
    recommended: true,
  },
  {
    id: 2,
    title: "Connect your CRM or import contacts",
    description: "Upload a CSV spreadsheet or bring in contact records from your existing workflow. Review the data before you use it in a campaign.",
    detail: "Foolioo needs a clean contact list before it can start outbound activity. Keep consent and opt-out status accurate.",
    action: "Import contacts",
  },
  {
    id: 3,
    title: "Place a simulated test call",
    description: "Check the voice experience, response flow, and handoff behavior before contacting your audience.",
    detail: "Run a test with a team member and review the transcript before launching a campaign.",
    action: "Test call",
  },
  {
    id: 4,
    title: "Create your first outbound campaign",
    description: "Choose a contact segment, define the campaign objective, and prepare the conversation flow.",
    detail: "Start with a focused audience and a clear outcome. You can refine the campaign before launch.",
    action: "Create campaign",
  },
  {
    id: 5,
    title: "Set up team routing & follow-up rules",
    description: "Choose who receives live handoffs, callbacks, and conversations that need human attention.",
    detail: "Assign owners and decide how your team should handle follow-up tasks.",
    action: "Configure routing",
  },
  {
    id: 6,
    title: "Launch your first campaign",
    description: "Start outbound activity when your voice setup, contacts, and team workflows are ready.",
    detail: "Review your campaign settings and confirm that your team is ready to handle responses.",
    action: "Launch campaign",
  },
];

function Icon({ kind, className = "h-4 w-4" }: { kind: "people" | "conversation" | "followup" | "campaign" | "book" | "audio" | "team" | "check" | "arrow" | "clock"; className?: string }) {
  const paths: Record<typeof kind, ReactNode> = {
    people: <><path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20" /><circle cx="9.5" cy="7" r="3.5" /><path d="M17 4.5a3.5 3.5 0 0 1 0 6.8M17 14.5a4 4 0 0 1 4 4V20" /></>,
    conversation: <><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9h8M8 12h5" /></>,
    followup: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M8 14h3M8 17h6" /></>,
    campaign: <><path d="M3 11v2a2 2 0 0 0 2 2h2l3 5h2l-2-6" /><path d="M7 9 19 4v16L7 15z" /></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22z" /><path d="M4 5.5V22M8 7h8M8 11h8" /></>,
    audio: <><path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4" /></>,
    team: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.2 2.6-5 6-5s6 1.8 6 5M17 5a3 3 0 0 1 0 6M18 15c2 .5 3 2 3 4" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  };

  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[kind]}
    </svg>
  );
}

function ProgressRing() {
  return (
    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full" style={{ background: "conic-gradient(#644ABB 0deg, #E9E8E1 0deg)" }} aria-label="0 of 6 setup steps complete">
      <div className="absolute inset-[4px] flex items-center justify-center rounded-full bg-[#F8F7F2] font-['Space_Grotesk'] text-[11px] font-bold tracking-[0.06em] text-[#1B1C18]">0/6</div>
    </div>
  );
}

function SetupChecklist() {
  const [expanded, setExpanded] = useState<number[]>([1]);
  const allExpanded = expanded.length === SETUP_STEPS.length;

  const toggleAll = () => setExpanded(allExpanded ? [] : SETUP_STEPS.map((step) => step.id));
  const toggleStep = (id: number) => {
    setExpanded((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  return (
    <section className="overflow-hidden rounded-[8px] border border-[#E9E8E1] bg-white pb-6 shadow-[0_1px_2px_rgba(0,0,0,0.05)]" aria-labelledby="setup-heading">
      <div className="flex flex-col gap-4 bg-[rgba(245,244,237,0.55)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-4">
          <ProgressRing />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="setup-heading" className="font-['Space_Grotesk'] text-[15px] font-semibold tracking-[-0.16px] text-[#1B1C18] sm:text-[16px]">
                Get your workspace ready for outbound voice
              </h2>
              <span className="rounded-[2px] bg-[#FFEBE8] px-2 py-0.5 font-['Space_Grotesk'] text-[10px] font-medium tracking-[0.04em] text-[#A33A32]">Pending setup</span>
            </div>
            <p className="mt-1 font-['Space_Grotesk'] text-[12px] leading-5 text-[#444748] sm:text-[13px]">
              Complete these essential steps before you run your first outbound campaign.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:justify-end">
          <button type="button" onClick={toggleAll} className="rounded-[2px] px-3 py-1.5 font-['Space_Grotesk'] text-[12px] font-medium text-[#444748] transition-colors hover:bg-white">
            {allExpanded ? "Collapse all steps" : "Expand all steps"}
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-[12px] bg-[#E7DEFF] px-3 py-1.5 font-['Space_Grotesk'] text-[10px] font-semibold tracking-[0.06em] text-[#644ABB]">
            <Icon kind="clock" className="h-3 w-3" /> Est. 8 mins
          </span>
        </div>
      </div>

      <div className="flex flex-col px-4 pt-2 sm:px-6">
        {SETUP_STEPS.map((step) => {
          const isExpanded = expanded.includes(step.id);
          return (
            <article key={step.id} className={`border-b border-[#ECEBE5] last:border-b-0 ${step.recommended && isExpanded ? "my-1 rounded-[4px] border-0 bg-[#F5F4ED] px-3" : "px-3"}`}>
              <div className="flex items-start gap-3 py-4 sm:items-center sm:gap-4">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#D5D5CE] bg-white text-[#B3B5B2]" aria-hidden="true">
                  <span className="h-1.5 w-1.5 rounded-full bg-transparent" />
                </span>
                <button type="button" onClick={() => toggleStep(step.id)} aria-expanded={isExpanded} className="min-w-0 flex-1 text-left">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={`font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.07em] ${step.recommended ? "text-[#644ABB]" : "text-[#747878]"}`}>
                      STEP {step.id}{step.recommended ? " · RECOMMENDED NEXT" : ""}
                    </span>
                    <span className="hidden h-1 w-1 rounded-full bg-[#C4C7C7] sm:inline-block" />
                    <span className="font-['Space_Grotesk'] text-[14px] font-semibold leading-5 text-[#1B1C18] sm:text-[15px]">{step.title}</span>
                  </span>
                  <span className="mt-1 block max-w-[620px] font-['Space_Grotesk'] text-[12px] leading-[20px] text-[#565B5B]">{step.description}</span>
                </button>
                <button type="button" onClick={() => toggleStep(step.id)} aria-label={`${isExpanded ? "Collapse" : "Expand"} ${step.title}`} className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] text-[#747878] hover:bg-white sm:hidden">
                  <span className={`text-[18px] leading-none transition-transform ${isExpanded ? "rotate-45" : ""}`}>+</span>
                </button>
                <button type="button" disabled title="This setup action will be connected as the related dashboard section is built" className="hidden shrink-0 items-center gap-2 rounded-[4px] bg-[#1B1C18] px-3.5 py-2 font-['Space_Grotesk'] text-[12px] font-medium text-white opacity-55 sm:inline-flex">
                  {step.action}<Icon kind="arrow" className="h-3 w-3" />
                </button>
              </div>
              {isExpanded ? (
                <div className="pb-4 pl-8 sm:pl-9">
                  <p className="max-w-[650px] font-['Space_Grotesk'] text-[12px] leading-[20px] text-[#565B5B]">{step.detail}</p>
                  {step.previewValue ? (
                    <div className="mt-3 flex flex-col gap-2 rounded-[3px] bg-white p-3 shadow-[0_1px_1px_rgba(0,0,0,0.05)] sm:flex-row sm:items-center">
                      <span className="flex h-8 w-8 items-center justify-center rounded-[3px] bg-[#E7DEFF] text-[#644ABB]"><Icon kind="audio" className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-['Space_Grotesk'] text-[10px] font-semibold uppercase tracking-[0.06em] text-[#747878]">{step.previewLabel}</span>
                        <span className="block font-['Space_Grotesk'] text-[12px] font-medium text-[#1B1C18]">{step.previewValue}</span>
                      </span>
                      <span className="font-['Space_Grotesk'] text-[10px] font-medium text-[#929493]">Not configured</span>
                    </div>
                  ) : null}
                  <button type="button" disabled title="This setup action will be connected as the related dashboard section is built" className="mt-3 inline-flex items-center gap-2 rounded-[4px] bg-[#1B1C18] px-3.5 py-2 font-['Space_Grotesk'] text-[12px] font-medium text-white opacity-55 sm:hidden">
                    {step.action}<Icon kind="arrow" className="h-3 w-3" />
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string | null;
  helper: string;
  icon: "people" | "conversation" | "followup" | "campaign";
}) {
  return (
    <article className="flex min-h-[128px] flex-col justify-between rounded-[8px] bg-[rgba(245,244,237,0.7)] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-['Space_Grotesk'] text-[12px] font-medium text-[#444748] sm:text-[13px]">{label}</h3>
        <span className="text-[#747878]"><Icon kind={icon} className="h-4 w-4" /></span>
      </div>
      <div>
        <p className="font-['Newsreader'] text-[30px] leading-9 text-[#1B1C18]">{value ?? "—"}</p>
        <p className="mt-1 font-['Space_Grotesk'] text-[10px] font-semibold leading-[14px] tracking-[0.03em] text-[#747878]">{helper}</p>
      </div>
    </article>
  );
}

const RESOURCES = [
  {
    icon: "book" as const,
    tone: "bg-[#E7DEFF] text-[#644ABB]",
    eyebrow: "PLAYBOOK",
    title: "Voice Prompting Playbook",
    description: "Learn prompt structures that help voice agents sound natural, stay on-topic, and follow your business rules.",
    action: "Read guide",
  },
  {
    icon: "audio" as const,
    tone: "bg-[#E9E8E1] text-[#565B5B]",
    eyebrow: "SAMPLE RECORDING",
    title: "Sample 3-Minute Test Call",
    description: "Hear how a well-structured outbound conversation handles an opening, common questions, and next steps.",
    action: "Listen to sample",
  },
  {
    icon: "team" as const,
    tone: "bg-[#F5F4ED] text-[#565B5B]",
    eyebrow: "TEAM SETUP",
    title: "Invite your team members",
    description: "Bring operators and managers into one workspace to review activity and coordinate follow-ups.",
    action: "Manage team",
  },
];

function ResourceCard({ resource }: { resource: (typeof RESOURCES)[number] }) {
  return (
    <article className="flex h-full flex-col justify-between rounded-[8px] bg-white p-4 shadow-[0_1px_1px_rgba(0,0,0,0.05)] sm:p-5">
      <div>
        <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-[4px] ${resource.tone}`}>
          <Icon kind={resource.icon} className="h-[17px] w-[17px]" />
        </div>
        <p className="mb-2 font-['Space_Grotesk'] text-[9px] font-bold tracking-[0.08em] text-[#747878]">{resource.eyebrow}</p>
        <h3 className="font-['Space_Grotesk'] text-[15px] font-semibold leading-6 text-[#1B1C18]">{resource.title}</h3>
        <p className="mt-2 font-['Space_Grotesk'] text-[12px] leading-[21px] text-[#444748]">{resource.description}</p>
      </div>
      <button type="button" disabled title="This resource link will be connected in a later pass" className="mt-5 inline-flex items-center gap-2 self-start font-['Space_Grotesk'] text-[12px] font-medium text-[#644ABB] opacity-55">
        {resource.action}<Icon kind="arrow" className="h-3 w-3" />
      </button>
    </article>
  );
}

export function OverviewDashboard({ metrics }: { metrics: OverviewMetrics }) {
  const profile = useDashboardProfile();
  const firstName = profile.displayName.trim().split(/\s+/)[0] || "there";
  const workspaceCode = profile.workspaceId ? profile.workspaceId.slice(-6).toUpperCase() : null;

  return (
    <div className="flex flex-col">
      <header className="pb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded-[2px] bg-[rgba(231,222,255,0.65)] px-2.5 py-1 font-['Space_Grotesk'] text-[10px] font-bold tracking-[0.1em] text-[#644ABB]">WORKSPACE OVERVIEW</span>
          {workspaceCode ? <span className="font-['Space_Grotesk'] text-[10px] font-medium tracking-[0.05em] text-[#747878]">Workspace ID: {workspaceCode}</span> : null}
        </div>
        <h1 className="font-['Newsreader'] text-[34px] font-normal leading-[1.12] tracking-[-0.8px] text-[#1B1C18] sm:text-[40px]">
          {profile.greeting}, {firstName}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 font-['Space_Grotesk'] text-[12px] leading-[22px] text-[#444748] sm:text-[13px]">
          <span>Welcome to your Foolioo workspace</span>
          <span className="h-1 w-1 rounded-full bg-[#C4C7C7]" />
          <span className="font-medium text-[#1B1C18]">{profile.workspaceName}</span>
          <span className="h-1 w-1 rounded-full bg-[#C4C7C7]" />
          <span>{profile.timezone}</span>
        </div>
      </header>

      <SetupChecklist />

      <section className="pt-8" aria-labelledby="metrics-heading">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
          <h2 id="metrics-heading" className="font-['Space_Grotesk'] text-[10px] font-bold tracking-[0.08em] text-[#747878]">WORKSPACE METRICS BASELINE</h2>
          <span className="font-['Space_Grotesk'] text-[10px] font-semibold tracking-[0.06em] text-[#747878]">
            {metrics.telemetryAvailable ? "LIVE TELEMETRY" : "LIVE TELEMETRY INACTIVE"}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Contacts Reached" value={metrics.contactsReached} helper={metrics.contactsReached === null ? "No activity to report yet" : "Recorded by your workspace"} icon="people" />
          <MetricCard label="Successful Conversations" value={metrics.successfulConversations} helper={metrics.successfulConversations === null ? "Awaiting first completed call" : "Completed conversations"} icon="conversation" />
          <MetricCard label="Follow-ups Scheduled" value={metrics.followUpsScheduled} helper={metrics.followUpsScheduled === null ? "No follow-up activity yet" : "Scheduled actions"} icon="followup" />
          <MetricCard label="Campaign Completion" value={metrics.campaignCompletion} helper={metrics.campaignCompletion === null ? "No campaigns in progress" : "Across your campaigns"} icon="campaign" />
        </div>
      </section>

      <section className="pt-10" aria-labelledby="resources-heading">
        <div className="pb-5">
          <h2 id="resources-heading" className="font-['Newsreader'] text-[22px] font-semibold leading-[30px] tracking-[-0.11px] text-[#1B1C18]">Go further with Foolioo</h2>
          <p className="mt-1 font-['Space_Grotesk'] text-[12px] leading-[22px] text-[#444748] sm:text-[13px]">
            Helpful resources, sample recordings, and playbooks to improve your team's outbound outcomes.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {RESOURCES.map((resource) => <ResourceCard key={resource.title} resource={resource} />)}
        </div>
      </section>
    </div>
  );
}
