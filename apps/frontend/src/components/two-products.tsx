"use client";

import { useState, type ReactNode } from "react";

type WorkflowStepId =
    | "greeting"
    | "intent"
    | "qualification"
    | "routing"
    | "outcome";

type WorkflowStep = {
    id: WorkflowStepId;
    title: string;
    shortTitle: string;
    description: string;
    trigger: string;
    action: string;
    evidence: string;
};

type CampaignContact = {
    name: string;
    role: string;
    phone: string;
    status: "Connected" | "Ringing" | "Voicemail";
    detail: string;
};

const campaignQueue: CampaignContact[] = [
    {
        name: "Ananya Mehta",
        role: "VP Operations · Guild Real Estate",
        phone: "+91 98200 45192",
        status: "Connected",
        detail: "02:44 · Qualifying 1,800 tenant leads",
    },
    {
        name: "Rohan Deshmukh",
        role: "Leasing Lead · Mumbai West",
        phone: "+91 98201 77410",
        status: "Ringing",
        detail: "Line 2 · Local presence active",
    },
    {
        name: "Neha Kulkarni",
        role: "Operations Manager · Pune",
        phone: "+91 98230 11904",
        status: "Voicemail",
        detail: "Retry scheduled in 2h",
    },
];

const workflowSteps: WorkflowStep[] = [
    {
        id: "greeting",
        title: "Opening & consent",
        shortTitle: "Greeting",
        description:
            "The agent opens with the approved introduction and confirms that the prospect can continue the conversation.",
        trigger: "Call connected",
        action: "Deliver the approved opening and wait for confirmation.",
        evidence: "Opening script · call state",
    },
    {
        id: "intent",
        title: "Intent detection",
        shortTitle: "Intent detection",
        description:
            "The response is mapped to a supported intent before the conversation moves to the next step.",
        trigger: "Prospect responds to the opening",
        action: "Classify the enquiry and follow its configured path.",
        evidence: "Intent rules · supported categories",
    },
    {
        id: "qualification",
        title: "Lead qualification",
        shortTitle: "Qualification",
        description:
            "The agent collects the information required by the qualification flow and asks only for missing details.",
        trigger: "A supported enquiry is identified",
        action: "Ask for property type, purpose, location and budget as configured.",
        evidence: "Qualification checklist · captured answers",
    },
    {
        id: "routing",
        title: "Decision & routing",
        shortTitle: "Decision & routing",
        description:
            "The collected answers are checked against configured conditions to determine the permitted next action.",
        trigger: "Required qualification fields are available",
        action: "Continue, mark for follow-up, or route to a human representative.",
        evidence: "Decision conditions · escalation policy",
    },
    {
        id: "outcome",
        title: "Outcome & handoff",
        shortTitle: "Outcome",
        description:
            "The session ends with a structured outcome and the relevant conversation context for the next team or system.",
        trigger: "The flow reaches a terminal state",
        action: "Save the outcome and pass the summary to the connected workflow.",
        evidence: "Session summary · outcome record",
    },
];

const Icon = ({
    name,
    className = "h-4 w-4",
}: {
    name: "shield" | "workflow" | "handoff" | "phone" | "database" | "check" | "arrow" | "spark";
    className?: string;
}) => {
    const common = {
        className,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.8,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
        "aria-hidden": true as const,
    };

    switch (name) {
        case "shield":
            return (
                <svg {...common}>
                    <path d="M12 3.2 19 6v5.2c0 4.4-2.8 7.6-7 9.6-4.2-2-7-5.2-7-9.6V6l7-2.8Z" />
                    <path d="m9 11.8 2 2 4-4.2" />
                </svg>
            );
        case "workflow":
            return (
                <svg {...common}>
                    <rect x="8" y="3" width="8" height="5" rx="1" />
                    <rect x="2.5" y="16" width="8" height="5" rx="1" />
                    <rect x="13.5" y="16" width="8" height="5" rx="1" />
                    <path d="M12 8v4M6.5 16v-2h11v2M17.5 14v-2" />
                </svg>
            );
        case "handoff":
            return (
                <svg {...common}>
                    <path d="M4 13v-1a8 8 0 0 1 16 0v1" />
                    <path d="M4 13h2.5A2.5 2.5 0 0 1 9 15.5v1A2.5 2.5 0 0 1 6.5 19H6a2 2 0 0 1-2-2v-4Z" />
                    <path d="M20 13h-2.5a2.5 2.5 0 0 0-2.5 2.5v1a2.5 2.5 0 0 0 2.5 2.5h.5a2 2 0 0 0 2-2v-4Z" />
                    <path d="M15 6.5a4.5 4.5 0 0 1 4 4.5" />
                </svg>
            );
        case "phone":
            return (
                <svg {...common}>
                    <path d="M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5Z" />
                    <path d="M10 17.5h4" />
                </svg>
            );
        case "database":
            return (
                <svg {...common}>
                    <ellipse cx="12" cy="5" rx="8" ry="3" />
                    <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
                </svg>
            );
        case "check":
            return (
                <svg {...common}>
                    <path d="m5 12 4 4L19 6" />
                </svg>
            );
        case "arrow":
            return (
                <svg {...common}>
                    <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
            );
        case "spark":
            return (
                <svg {...common}>
                    <path d="m12 3 1.5 6.5L20 11l-6.5 1.5L12 19l-1.5-6.5L4 11l6.5-1.5L12 3Z" />
                    <path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" />
                </svg>
            );
    }
};

const StatusPill = ({
    children,
    tone = "neutral",
}: {
    children: ReactNode;
    tone?: "neutral" | "success" | "purple" | "warning";
}) => {
    const tones = {
        neutral: "border-[#E9E8E1] bg-white text-[#525552]",
        success: "border-[#CDEBDD] bg-[#EFFAF4] text-[#23835D]",
        purple: "border-[#DDD6FE] bg-[#F5F3FF] text-[#6D4BC3]",
        warning: "border-[#F2DEC0] bg-[#FFF8EC] text-[#9A651C]",
    };

    return (
        <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 font-['Space_Grotesk'] text-[10px] font-semibold tracking-[0.2px] ${tones[tone]}`}
        >
            {children}
        </span>
    );
};

type GlassTabsProps<T extends string> = {
    value: T;
    onChange: (value: T) => void;
    options: { value: T; label: string }[];
    ariaLabel: string;
    idPrefix: string;
    className?: string;
};

/**
- Shared two-way segmented control. The glass highlight moves independently
- of the content, so each option behaves like a real tab rather than a toggle.
 */
const GlassTabs = <T extends string,>({
    value,
    onChange,
    options,
    ariaLabel,
    idPrefix,
    className = "",
}: GlassTabsProps<T>) => {
    const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));

    return (
        <div
            className={`relative isolate grid w-full grid-cols-2 items-center rounded-full border border-white/80 bg-[#EAE8E1]/80 p-1 shadow-[inset_0_1px_2px_rgba(35,36,30,0.06)] backdrop-blur-xl ${className}`}
            role="tablist"
            aria-label={ariaLabel}
        >
            <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-1 top-1 z-0 w-[calc(50%-4px)] rounded-full border border-white/90"
                style={{
                    left: selectedIndex === 0 ? "4px" : "50%",
                    background:
                        "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.76) 100%)",
                    boxShadow:
                        "0 4px 14px rgba(35,36,30,0.11), inset 0 1px 0 rgba(255,255,255,0.96)",
                    backdropFilter: "blur(18px)",
                    WebkitBackdropFilter: "blur(18px)",
                    transition: "left 480ms cubic-bezier(0.22, 1, 0.36, 1)",
                }}
            />

            {options.map((option) => {
                const isActive = option.value === value;

                return (
                    <button
                        key={option.value}
                        type="button"
                        role="tab"
                        id={`${idPrefix}-${option.value}-tab`}
                        aria-selected={isActive}
                        aria-controls={`${idPrefix}-panel`}
                        tabIndex={isActive ? 0 : -1}
                        onClick={() => onChange(option.value)}
                        className={`relative z-10 flex h-10 min-w-0 items-center justify-center whitespace-nowrap rounded-full px-2.5 font-['Space_Grotesk'] text-[10px] font-semibold tracking-[0.1px] transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B70D6] focus-visible:ring-offset-2 sm:px-4 sm:text-[11px] ${
                            isActive
                                ? "text-[#252720]"
                                : "text-[#777B74] hover:text-[#34372F]"
                        }`}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
};

const WorkflowPanel = ({
    selectedStep,
    onSelectStep,
}: {
    selectedStep: WorkflowStepId;
    onSelectStep: (step: WorkflowStepId) => void;
}) => {
    const selectedIndex = workflowSteps.findIndex((step) => step.id === selectedStep);

    return (
        <section id="products" className="rounded-xl border border-[#E9E8E1] bg-white p-5 shadow-[0_2px_12px_rgba(28,29,24,0.03)] md:p-6">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="font-['Space_Grotesk'] text-[10px] font-semibold uppercase tracking-[1.1px] text-[#525552]">
                        Execution map
                    </p>
                    <h3 className="mt-1 font-['Space_Grotesk'] text-[16px] font-semibold text-[#1B1C18]">
                        Conversation workflow
                    </h3>
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F5F3EC] text-[#5B5E56]">
                    <Icon name="workflow" className="h-[18px] w-[18px]" />
                </span>
            </div>

            <div className="mt-5 space-y-1">
                {workflowSteps.map((step, index) => {
                    const isSelected = step.id === selectedStep;
                    const isComplete = index < selectedIndex;
                    const isCurrent = index === selectedIndex;

                    return (
                        <div key={step.id} className="relative">
                            {index < workflowSteps.length - 1 && (
                                <span className="absolute left-[15px] top-9 h-[calc(100%-4px)] w-px bg-[#E9E8E1]" />
                            )}
                            <button
                                type="button"
                                onClick={() => onSelectStep(step.id)}
                                aria-pressed={isSelected}
                                className={`relative flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors ${
                                    isSelected
                                        ? "bg-[#F5F3FF]"
                                        : "hover:bg-[#FAF9F5]"
                                }`}
                            >
                                <span
                                    className={`z-10 flex h-[31px] w-[31px] shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                                        isComplete
                                            ? "border-[#BFE8D3] bg-[#E9F8F0] text-[#23835D]"
                                            : isCurrent
                                              ? "border-[#CFC3F4] bg-[#EDE8FB] text-[#6D4BC3]"
                                              : "border-[#E9E8E1] bg-white text-[#999D96]"
                                    }`}
                                >
                                    {isComplete ? (
                                        <Icon name="check" className="h-4 w-4" />
                                    ) : (
                                        String(index + 1).padStart(2, "0")
                                    )}
                                </span>

                                <span className="min-w-0 flex-1">
                                    <span className="block font-['Space_Grotesk'] text-[12px] font-semibold text-[#292B26]">
                                        {step.shortTitle}
                                    </span>
                                    <span className="mt-0.5 block font-['Space_Grotesk'] text-[10px] text-[#5F6360]">
                                        {isComplete
                                            ? "Completed in this example"
                                            : isCurrent
                                              ? "Selected step"
                                              : "Next in workflow"}
                                    </span>
                                </span>

                                <span
                                    className={`shrink-0 rounded-full px-2 py-1 font-['Space_Grotesk'] text-[9px] font-semibold ${
                                        isComplete
                                            ? "bg-[#E9F8F0] text-[#23835D]"
                                            : isCurrent
                                              ? "bg-[#EDE8FB] text-[#6D4BC3]"
                                              : "bg-[#F5F4EF] text-[#92968F]"
                                    }`}
                                >
                                    {isComplete ? "DONE" : isCurrent ? "ACTIVE" : "QUEUED"}
                                </span>
                            </button>
                        </div>
                    );
                })}
            </div>

            <div className="mt-4 rounded-lg border border-[#E9E8E1] bg-[#FBFAF6] p-3.5">
                <p className="font-['Space_Grotesk'] text-[10px] font-semibold uppercase tracking-[0.8px] text-[#525552]">
                    Selected stage
                </p>
                <p className="mt-1 font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18]">
                    {workflowSteps[selectedIndex].title}
                </p>
                <p className="mt-1.5 font-['Space_Grotesk'] text-[11px] leading-[18px] text-[#525552]">
                    {workflowSteps[selectedIndex].description}
                </p>
            </div>
        </section>
    );
};

const ConversationPanel = ({
    showGuardrailExample,
    onToggleGuardrail,
}: {
    showGuardrailExample: boolean;
    onToggleGuardrail: () => void;
}) => (
    <section className="overflow-hidden rounded-xl border border-[#E9E8E1] bg-white shadow-[0_2px_12px_rgba(28,29,24,0.03)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E9E8E1] px-5 py-4 md:px-6">
            <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1B1C18] font-['Space_Grotesk'] text-[10px] font-bold text-white">
                    AI
                </span>
                <div>
                    <p className="font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">
                        Lead qualification call
                    </p>
                    <p className="font-['Space_Grotesk'] text-[10px] text-[#5F6360]">
                        Sample conversation · Real-time transcript concept
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <StatusPill tone="success">Demo session</StatusPill>
                <StatusPill>Illustrative data</StatusPill>
            </div>
        </div>

        <div className="space-y-4 bg-[#FCFBF8] p-5 md:p-6">
            <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1B1C18] font-['Space_Grotesk'] text-[9px] font-bold text-white">
                    AI
                </span>
                <div className="max-w-[88%] rounded-xl rounded-tl-sm border border-[#E9E8E1] bg-white p-3.5">
                    <p className="font-['Space_Grotesk'] text-[9px] font-semibold uppercase tracking-[0.7px] text-[#5F6360]">
                        Agent · Opening script
                    </p>
                    <p className="mt-1.5 font-['Space_Grotesk'] text-[12px] leading-[20px] text-[#343630]">
                        Hello, I&apos;m calling about your property enquiry. Is now a convenient time for a brief conversation?
                    </p>
                </div>
            </div>

            <div className="flex items-start justify-end gap-2.5">
                <div className="max-w-[88%] rounded-xl rounded-tr-sm border border-[#E9E8E1] bg-[#F3F1EA] p-3.5">
                    <p className="font-['Space_Grotesk'] text-[9px] font-semibold uppercase tracking-[0.7px] text-[#5F6360]">
                        Prospect · Response
                    </p>
                    <p className="mt-1.5 font-['Space_Grotesk'] text-[12px] leading-[20px] text-[#343630]">
                        Yes. I&apos;m looking for a two-bedroom apartment for my family.
                    </p>
                </div>
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E9E8E1] font-['Space_Grotesk'] text-[9px] font-bold text-[#454840]">
                    PM
                </span>
            </div>

            <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1B1C18] font-['Space_Grotesk'] text-[9px] font-bold text-white">
                    AI
                </span>
                <div className="max-w-[88%] rounded-xl rounded-tl-sm border border-[#DDD6FE] bg-[#F7F5FF] p-3.5">
                    <p className="font-['Space_Grotesk'] text-[9px] font-semibold uppercase tracking-[0.7px] text-[#7862B5]">
                        Agent · Qualification path
                    </p>
                    <p className="mt-1.5 font-['Space_Grotesk'] text-[12px] leading-[20px] text-[#43386D]">
                        Understood. Do you have a preferred location and approximate budget?
                    </p>
                </div>
            </div>

            {showGuardrailExample && (
                <div className="rounded-xl border border-[#E9DCC5] bg-[#FFFCF5] p-4 md:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#F5EBD8] text-[#9A651C]">
                                <Icon name="shield" className="h-4 w-4" />
                            </span>
                            <p className="font-['Space_Grotesk'] text-[11px] font-semibold text-[#4D402D]">
                                Guardrail scenario
                            </p>
                        </div>
                        <StatusPill tone="warning">Out-of-scope request</StatusPill>
                    </div>

                    <div className="mt-3 space-y-2.5">
                        <div className="rounded-lg border border-[#EFE5D4] bg-white p-3">
                            <p className="font-['Space_Grotesk'] text-[9px] font-semibold uppercase tracking-[0.7px] text-[#5F6360]">
                                Prospect asks
                            </p>
                            <p className="mt-1 font-['Space_Grotesk'] text-[12px] leading-[19px] text-[#343630]">
                                Can you guarantee this property will appreciate by 30%?
                            </p>
                        </div>
                        <div className="flex items-center gap-2 px-1 font-['Space_Grotesk'] text-[10px] font-semibold text-[#9A651C]">
                            <Icon name="shield" className="h-3.5 w-3.5" />
                            Policy check: unsupported financial guarantee
                        </div>
                        <div className="rounded-lg border border-[#DDD6FE] bg-[#F7F5FF] p-3">
                            <p className="font-['Space_Grotesk'] text-[9px] font-semibold uppercase tracking-[0.7px] text-[#7862B5]">
                                Approved response
                            </p>
                            <p className="mt-1 font-['Space_Grotesk'] text-[12px] leading-[19px] text-[#43386D]">
                                I can&apos;t guarantee future property appreciation. I can arrange for a property consultant to discuss the market information with you.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#F5F0E5] px-3 py-2.5">
                            <span className="font-['Space_Grotesk'] text-[10px] font-medium text-[#6B5738]">
                                Next action: offer a human handoff
                            </span>
                            <StatusPill tone="success">Escalation path selected</StatusPill>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E9E8E1] pt-4">
                <div className="flex items-center gap-2 text-[#525552]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#2CA879]" />
                    <span className="font-['Space_Grotesk'] text-[10px]">
                        Transcript shown with sample data
                    </span>
                </div>
                <button
                    type="button"
                    onClick={onToggleGuardrail}
                    aria-expanded={showGuardrailExample}
                    className="inline-flex items-center gap-2 rounded-md border border-[#DCD5F0] bg-white px-3 py-2 font-['Space_Grotesk'] text-[10px] font-semibold text-[#6D4BC3] transition-colors hover:bg-[#F7F5FF]"
                >
                    <Icon name="shield" className="h-3.5 w-3.5" />
                    {showGuardrailExample ? "Hide guardrail scenario" : "Explore guardrail scenario"}
                </button>
            </div>
        </div>
    </section>
);

const DecisionTracePanel = ({
    selectedStep,
    showGuardrailExample,
}: {
    selectedStep: WorkflowStepId;
    showGuardrailExample: boolean;
}) => {
    const step = workflowSteps.find((item) => item.id === selectedStep) ?? workflowSteps[2];

    return (
        <section className="rounded-xl border border-[#E9E8E1] bg-white p-5 shadow-[0_2px_12px_rgba(28,29,24,0.03)] md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <p className="font-['Space_Grotesk'] text-[10px] font-semibold uppercase tracking-[1.1px] text-[#525552]">
                        Explainable execution
                    </p>
                    <h3 className="mt-1 font-['Space_Grotesk'] text-[16px] font-semibold text-[#1B1C18]">
                        Decision trace
                    </h3>
                </div>
                <StatusPill tone="purple">Sample trace</StatusPill>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-[#FBFAF6] p-3.5">
                    <p className="font-['Space_Grotesk'] text-[9px] font-semibold uppercase tracking-[0.7px] text-[#5F6360]">
                        Current stage
                    </p>
                    <p className="mt-1.5 font-['Space_Grotesk'] text-[12px] font-semibold text-[#292B26]">
                        {step.title}
                    </p>
                </div>
                <div className="rounded-lg bg-[#FBFAF6] p-3.5">
                    <p className="font-['Space_Grotesk'] text-[9px] font-semibold uppercase tracking-[0.7px] text-[#5F6360]">
                        Decision status
                    </p>
                    <p className="mt-1.5 font-['Space_Grotesk'] text-[12px] font-semibold text-[#292B26]">
                        {showGuardrailExample ? "Guardrail matched" : "Awaiting next input"}
                    </p>
                </div>
            </div>

            <div className="mt-4 space-y-3">
                <div>
                    <p className="font-['Space_Grotesk'] text-[9px] font-semibold uppercase tracking-[0.7px] text-[#5F6360]">
                        Trigger
                    </p>
                    <p className="mt-1 font-['Space_Grotesk'] text-[11px] leading-[18px] text-[#454840]">
                        {showGuardrailExample
                            ? "A prospect requests a financial guarantee that is not supported by the approved knowledge base."
                            : step.trigger}
                    </p>
                </div>
                <div className="h-px bg-[#EEEDE7]" />
                <div>
                    <p className="font-['Space_Grotesk'] text-[9px] font-semibold uppercase tracking-[0.7px] text-[#5F6360]">
                        Permitted action
                    </p>
                    <p className="mt-1 font-['Space_Grotesk'] text-[11px] leading-[18px] text-[#454840]">
                        {showGuardrailExample
                            ? "Decline to make the unsupported claim and offer a handoff to a property consultant."
                            : step.action}
                    </p>
                </div>
                <div className="h-px bg-[#EEEDE7]" />
                <div>
                    <p className="font-['Space_Grotesk'] text-[9px] font-semibold uppercase tracking-[0.7px] text-[#5F6360]">
                        Referenced configuration
                    </p>
                    <p className="mt-1 font-['Space_Grotesk'] text-[11px] leading-[18px] text-[#454840]">
                        {showGuardrailExample
                            ? "Approved knowledge base · restricted claims policy · human escalation path"
                            : step.evidence}
                    </p>
                </div>
            </div>

            <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-[#DDD6FE] bg-[#F7F5FF] p-3.5">
                <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-[#6D4BC3]" />
                <p className="font-['Space_Grotesk'] text-[10px] leading-[17px] text-[#5C4B8D]">
                    The interface illustrates the intended decision flow. Actual trace events, policies and audit records should come from the agent runtime.
                </p>
            </div>
        </section>
    );
};

const HumanEscalationPanel = () => (
    <section
        id="human-escalation-demo"
        className="mt-4 rounded-xl border border-[#DDD6FE] bg-[#FAF8FF] p-5 md:p-6"
        aria-label="Human escalation walkthrough"
    >
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
                <p className="font-['Space_Grotesk'] text-[10px] font-semibold uppercase tracking-[1.1px] text-[#7852D6]">
                    Human-in-the-loop control
                </p>
                <h4 className="mt-1 font-['Space_Grotesk'] text-[16px] font-semibold text-[#292B26]">
                    How a call reaches your team
                </h4>
                <p className="mt-1 max-w-[620px] font-['Space_Grotesk'] text-[11px] leading-[18px] text-[#525552]">
                    When a configured escalation condition is met, the agent prepares the conversation context and routes the prospect to the right human team.
                </p>
            </div>
            <StatusPill tone="purple">Illustrative handoff</StatusPill>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-[#E8E1F7] bg-white p-3.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F2EDFF] text-[#6D4BC3]">
                    <Icon name="shield" className="h-4 w-4" />
                </span>
                <p className="mt-3 font-['Space_Grotesk'] text-[11px] font-semibold text-[#292B26]">
                    01 · Escalation detected
                </p>
                <p className="mt-1 font-['Space_Grotesk'] text-[10px] leading-[17px] text-[#525552]">
                    The prospect requests a person, or the request falls outside the agent&apos;s approved scope.
                </p>
            </div>
            <div className="rounded-lg border border-[#E8E1F7] bg-white p-3.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F2EDFF] text-[#6D4BC3]">
                    <Icon name="database" className="h-4 w-4" />
                </span>
                <p className="mt-3 font-['Space_Grotesk'] text-[11px] font-semibold text-[#292B26]">
                    02 · Context packaged
                </p>
                <p className="mt-1 font-['Space_Grotesk'] text-[10px] leading-[17px] text-[#525552]">
                    The handoff summary includes the reason, transcript, captured answers and outstanding questions.
                </p>
            </div>
            <div className="rounded-lg border border-[#E8E1F7] bg-white p-3.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F2EDFF] text-[#6D4BC3]">
                    <Icon name="phone" className="h-4 w-4" />
                </span>
                <p className="mt-3 font-['Space_Grotesk'] text-[11px] font-semibold text-[#292B26]">
                    03 · Team takes over
                </p>
                <p className="mt-1 font-['Space_Grotesk'] text-[10px] leading-[17px] text-[#525552]">
                    The configured routing destination receives the context so the prospect does not need to repeat everything.
                </p>
            </div>
        </div>

        <div className="mt-4 rounded-lg border border-[#E8E1F7] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <p className="font-['Space_Grotesk'] text-[9px] font-semibold uppercase tracking-[0.7px] text-[#5F6360]">
                        Example handoff summary
                    </p>
                    <p className="mt-1 font-['Space_Grotesk'] text-[12px] font-semibold text-[#292B26]">
                        Property enquiry · Human review requested
                    </p>
                </div>
                <StatusPill tone="success">Context prepared</StatusPill>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                    <p className="font-['Space_Grotesk'] text-[9px] uppercase tracking-[0.6px] text-[#5F6360]">Handoff reason</p>
                    <p className="mt-1 font-['Space_Grotesk'] text-[11px] font-medium text-[#454840]">Out-of-scope question</p>
                </div>
                <div>
                    <p className="font-['Space_Grotesk'] text-[9px] uppercase tracking-[0.6px] text-[#5F6360]">Captured need</p>
                    <p className="mt-1 font-['Space_Grotesk'] text-[11px] font-medium text-[#454840]">2-bedroom apartment</p>
                </div>
                <div>
                    <p className="font-['Space_Grotesk'] text-[9px] uppercase tracking-[0.6px] text-[#5F6360]">Missing detail</p>
                    <p className="mt-1 font-['Space_Grotesk'] text-[11px] font-medium text-[#454840]">Budget confirmation</p>
                </div>
                <div>
                    <p className="font-['Space_Grotesk'] text-[9px] uppercase tracking-[0.6px] text-[#5F6360]">Destination</p>
                    <p className="mt-1 font-['Space_Grotesk'] text-[11px] font-medium text-[#454840]">Property sales team</p>
                </div>
            </div>
            <p className="mt-3 border-t border-[#EEEAF5] pt-3 font-['Space_Grotesk'] text-[9px] leading-[16px] text-[#5F6360]">
                Demo only. No call is transferred and no team is notified by this frontend interaction.
            </p>
        </div>
    </section>
);

const IntegrationFlow = () => (
    <section className="mt-6 rounded-xl border border-[#E9E8E1] bg-white p-5 md:p-6">
        <div className="max-w-[560px]">
            <p className="font-['Space_Grotesk'] text-[10px] font-semibold uppercase tracking-[1.1px] text-[#525552]">
                One connected platform
            </p>
            <h3 className="mt-1 font-['Space_Grotesk'] text-[16px] font-semibold text-[#1B1C18]">
                From campaign to completed outcome
            </h3>
            <p className="mt-1.5 font-['Space_Grotesk'] text-[11px] leading-[18px] text-[#525552]">
                Campaigns start the calls. The voice agent follows your script. Results sync back to your CRM right away.
            </p>
        </div>

        <div className="mt-5 grid grid-cols-1 items-stretch gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center md:gap-3">
            <div className="flex items-center gap-3 rounded-lg bg-[#FBFAF6] p-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EEECE4] text-[#575B53]">
                    <Icon name="workflow" className="h-[18px] w-[18px]" />
                </span>
                <div>
                    <p className="font-['Space_Grotesk'] text-[12px] font-semibold text-[#292B26]">Campaigns</p>
                    <p className="font-['Space_Grotesk'] text-[10px] text-[#525552]">Audience & scheduling</p>
                </div>
            </div>
            <span className="hidden text-[#A3A59F] md:block">
                <Icon name="arrow" className="h-4 w-4" />
            </span>
            <div className="flex items-center gap-3 rounded-lg border border-[#DDD6FE] bg-[#F7F5FF] p-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EAE4FA] text-[#6D4BC3]">
                    <Icon name="phone" className="h-[18px] w-[18px]" />
                </span>
                <div>
                    <p className="font-['Space_Grotesk'] text-[12px] font-semibold text-[#292B26]">Voice Agent</p>
                    <p className="font-['Space_Grotesk'] text-[10px] text-[#7862B5]">Rule-bound calls</p>
                </div>
            </div>
            <span className="hidden text-[#A3A59F] md:block">
                <Icon name="arrow" className="h-4 w-4" />
            </span>
            <div className="flex items-center gap-3 rounded-lg bg-[#FBFAF6] p-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EEECE4] text-[#575B53]">
                    <Icon name="database" className="h-[18px] w-[18px]" />
                </span>
                <div>
                    <p className="font-['Space_Grotesk'] text-[12px] font-semibold text-[#292B26]">Outcomes</p>
                    <p className="font-['Space_Grotesk'] text-[10px] text-[#525552]">Results & follow-up</p>
                </div>
            </div>
        </div>
    </section>
);

const RuleGuidedAgentPanel = () => {
    const [selectedStep, setSelectedStep] = useState<WorkflowStepId>("qualification");
    const [showGuardrailExample, setShowGuardrailExample] = useState(false);
    const [activeAgentView, setActiveAgentView] = useState<"workflow" | "escalation">("workflow");

    return (
        <div className="mt-10 overflow-hidden rounded-xl border border-[#E9E8E1] bg-[#FCFBF8] shadow-[0px_8px_30px_rgba(0,0,0,0.06)]">
            {/* Product workspace bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E9E8E1] bg-[#EAE9E2] px-5 py-3 md:px-7">
                <div className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#2FC29B]" />
                    <span className="font-['Space_Grotesk'] text-[10px] font-semibold uppercase tracking-[0.9px] text-[#292B26]">
                        FOOLIOO DETERMINISTIC VOICE ENGINE
                    </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone="success">Demo environment</StatusPill>
                    <span className="font-['Space_Grotesk'] text-[10px] text-[#666A62]">
                        Sample data · No live call connected
                    </span>
                </div>
            </div>

            <div className="p-5 md:p-7 lg:p-8">
                {/* Agent introduction and glass tabs */}
                <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
                    <div className="max-w-[650px]">
                        <p className="font-['Space_Grotesk'] text-[10px] font-semibold uppercase tracking-[1.2px] text-[#7852D6]">
                            Rule-guided voice calls
                        </p>
                        <h3 className="mt-2 font-['Newsreader'] text-[29px] font-normal leading-[1.12] tracking-[-0.5px] text-[#1B1C18] sm:text-[36px]">
                            Every conversation follows a defined path.
                        </h3>
                        <p className="mt-3 max-w-[610px] font-['Space_Grotesk'] text-[12px] leading-[21px] text-[#525552] md:text-[13px]">
                            Configure the conversation, control which actions the agent can take, and route exceptions to your team with the context they need.
                        </p>
                    </div>

                    <GlassTabs<"workflow" | "escalation">
                        value={activeAgentView}
                        onChange={setActiveAgentView}
                        ariaLabel="Rule-guided agent views"
                        idPrefix="agent-view"
                        className="w-full md:w-[390px] md:shrink-0"
                        options={[
                            { value: "workflow", label: "Rule-guided workflow" },
                            { value: "escalation", label: "Human escalation path" },
                        ]}
                    />
                </div>

                {/* The selected tab owns its own content. Switching tabs never
                    toggles an expandable panel or changes the other tab's state. */}
                <div
                    id="agent-view-panel"
                    role="tabpanel"
                    aria-labelledby={
                        activeAgentView === "workflow"
                            ? "agent-view-workflow-tab"
                            : "agent-view-escalation-tab"
                    }
                    className="mt-6"
                >
                    {activeAgentView === "workflow" ? (
                        <div key="workflow" className="foolioo-glass-panel">
                            {/* Workflow capabilities */}
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <div className="flex items-center gap-3 rounded-lg border border-[#E9E8E1] bg-white p-3.5">
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F2F0E9] text-[#5C6058]">
                                        <Icon name="workflow" className="h-[18px] w-[18px]" />
                                    </span>
                                    <div>
                                        <p className="font-['Space_Grotesk'] text-[11px] font-semibold text-[#292B26]">Defined conversation paths</p>
                                        <p className="mt-0.5 font-['Space_Grotesk'] text-[10px] text-[#525552]">Clear steps & conditions</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 rounded-lg border border-[#E9E8E1] bg-white p-3.5">
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F2F0E9] text-[#5C6058]">
                                        <Icon name="shield" className="h-[18px] w-[18px]" />
                                    </span>
                                    <div>
                                        <p className="font-['Space_Grotesk'] text-[11px] font-semibold text-[#292B26]">Safety rules</p>
                                        <p className="mt-0.5 font-['Space_Grotesk'] text-[10px] text-[#525552]">Approved answers & limits</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 rounded-lg border border-[#E9E8E1] bg-white p-3.5">
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F2F0E9] text-[#5C6058]">
                                        <Icon name="handoff" className="h-[18px] w-[18px]" />
                                    </span>
                                    <div>
                                        <p className="font-['Space_Grotesk'] text-[11px] font-semibold text-[#292B26]">Human handoff</p>
                                        <p className="mt-0.5 font-['Space_Grotesk'] text-[10px] text-[#525552]">Smart team escalation</p>
                                    </div>
                                </div>
                            </div>

                            {/* Main execution workspace */}
                            <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-12">
                                <div className="xl:col-span-4">
                                    <WorkflowPanel
                                        selectedStep={selectedStep}
                                        onSelectStep={setSelectedStep}
                                    />
                                </div>

                                <div className="space-y-5 xl:col-span-8">
                                    <ConversationPanel
                                        showGuardrailExample={showGuardrailExample}
                                        onToggleGuardrail={() =>
                                            setShowGuardrailExample((current) => !current)
                                        }
                                    />
                                    <DecisionTracePanel
                                        selectedStep={selectedStep}
                                        showGuardrailExample={showGuardrailExample}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div key="escalation" className="foolioo-glass-panel">
                            <HumanEscalationPanel />
                        </div>
                    )}
                </div>

                <IntegrationFlow />

                <p className="mt-4 text-center font-['Space_Grotesk'] text-[9px] leading-[16px] text-[#9A9D96]">
                    Interactive preview. Steps, sample transcript, and rules shown here are examples of a live outbound campaign.
                </p>
            </div>
        </div>
    );
};

export const TwoProducts = () => {
    const [activeTab, setActiveTab] = useState<"campaigns" | "agent">("campaigns");

    return (
      <section id="products" className="w-full scroll-mt-20 border-t border-[#E9E8E1] bg-[#FBF9F2] pt-20 pb-16 md:pt-28 md:pb-24">
        <div className="mx-auto w-full max-w-[1240px] px-6 md:px-10">
          {/* Section header */}
          <div className="flex flex-col items-center text-center">
            <span className="font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[1.5px] text-[#525552]">
              HOW FOOLIOO WORKS
            </span>
            <h2 className="mt-4 max-w-[620px]">
              <span className="block font-['Newsreader'] text-[36px] font-normal leading-[1.12] tracking-[-0.8px] text-[#1B1C18] sm:text-[46px] md:text-[52px]">
                Two products, one seamless
              </span>
              <span className="block font-['Newsreader'] text-[36px] font-normal italic leading-[1.12] tracking-[-0.8px] text-[#1B1C18] sm:text-[46px] md:text-[52px]">
                experience.
              </span>
            </h2>
            <p className="mt-4 max-w-[540px] font-['Space_Grotesk'] text-[14px] font-normal leading-[22px] tracking-[0.1px] text-[#525552] md:text-[15px]">
              Foolioo separates campaign setup from live calling, giving your team
              complete control over outreach batches and every voice conversation.
            </p>
          </div>

          {/* Product tabs with the same animated glass treatment */}
          <GlassTabs<"campaigns" | "agent">
            value={activeTab}
            onChange={setActiveTab}
            ariaLabel="Foolioo products"
            idPrefix="product"
            className="mx-auto mt-8 max-w-[430px]"
            options={[
              { value: "campaigns", label: "Foolioo Campaigns" },
              { value: "agent", label: "Rule-Guided Agent" },
            ]}
          />

          <div
            id="product-panel"
            role="tabpanel"
            aria-labelledby={activeTab === "agent" ? "product-agent-tab" : "product-campaigns-tab"}
            className="mt-2"
          >
            {activeTab === "agent" ? (
              <div key="agent-product" className="foolioo-glass-panel">
                <RuleGuidedAgentPanel />
              </div>
            ) : (
              /* Campaign orchestration view */
              <div key="campaigns-product" className="foolioo-glass-panel">
                <div className="mt-10 overflow-hidden rounded-xl border border-[#E9E8E1] bg-white shadow-[0px_8px_30px_rgba(0,0,0,0.06)]">
                  {/* Mac Browser Chrome */}
                  <div className="flex h-11 items-center justify-between border-b border-[#E9E8E1] bg-[#FAFAF8] px-4">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-[#EF4444]/80" />
                      <span className="h-3 w-3 rounded-full bg-[#F59E0B]/80" />
                      <span className="h-3 w-3 rounded-full bg-[#10B981]/80" />
                    </div>

                    <div className="flex h-7 items-center rounded-md border border-[#E9E8E1] bg-white px-3 font-['Space_Grotesk'] text-[11px] text-[#525552] shadow-2xs">
                      <span className="text-[#A1A1AA]">https://</span>
                      <span className="font-medium text-[#1B1C18]">
                        foolioo.app/campaigns/
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[#22A06B]" />
                      <span className="font-['Space_Grotesk'] text-[11px] font-medium text-[#22A06B]">
                        Sample Queue
                      </span>
                    </div>
                  </div>

                  {/* Campaign orchestration content */}
                  <div className="grid grid-cols-1 lg:grid-cols-12">
                    <div className="flex flex-col gap-4 border-b border-[#E9E8E1] bg-[#FCFBF8] p-6 lg:col-span-4 lg:border-b-0 lg:border-r">
                      {/* Connection rate */}
                      <div className="flex flex-col justify-between rounded-lg border border-[#E9E8E1] bg-white p-4 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[0.6px] text-[#525552]">
                            CONNECTION RATE
                          </span>
                          <span className="rounded bg-[#E3FCEF] px-1.5 py-0.5 font-['Space_Grotesk'] text-[10px] font-semibold text-[#22A06B]">
                            +24.5%
                          </span>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="font-['Space_Grotesk'] text-[32px] font-bold text-[#1B1C18] tabular-nums">
                            48.5%
                          </span>
                          <span className="font-['Space_Grotesk'] text-[11px] text-[#525552]">
                            vs industry avg 24%
                          </span>
                        </div>
                        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#F5F3EC]">
                          <div className="h-full w-[48.5%] rounded-full bg-[#22A06B]" />
                        </div>
                      </div>

                      {/* Connected minutes */}
                      <div className="flex flex-col justify-between rounded-lg border border-[#E9E8E1] bg-white p-4 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[0.6px] text-[#525552]">
                            CONNECTED MINUTES
                          </span>
                          <span className="font-['Space_Grotesk'] text-[10px] text-[#525552]">
                            Today
                          </span>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="font-['Space_Grotesk'] text-[32px] font-bold text-[#1B1C18] tabular-nums">
                            525 min
                          </span>
                          <span className="font-['Space_Grotesk'] text-[11px] text-[#525552]">
                            (Avg: 3m 42s)
                          </span>
                        </div>
                        <p className="mt-2 font-['Space_Grotesk'] text-[11px] text-[#525552]">
                          142 completed outbound conversations
                        </p>
                      </div>

                      {/* Effective cost */}
                      <div className="flex flex-col justify-between rounded-lg border border-[#E9E8E1] bg-white p-4 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[0.6px] text-[#525552]">
                            EFFECTIVE COST
                          </span>
                          <span className="rounded bg-[#E3FCEF] px-1.5 py-0.5 font-['Space_Grotesk'] text-[10px] font-semibold text-[#22A06B]">
                            Fixed Rate
                          </span>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="font-['Space_Grotesk'] text-[32px] font-bold text-[#1B1C18] tabular-nums">
                            ₹4.20
                          </span>
                          <span className="font-['Space_Grotesk'] text-[11px] text-[#525552]">
                            / minute
                          </span>
                        </div>
                        <p className="mt-2 font-['Space_Grotesk'] text-[11px] text-[#525552]">
                          vs outsourced call center rep (₹18/min)
                        </p>
                      </div>
                    </div>

                    {/* Campaign queue & pacing */}
                    <div className="flex flex-col justify-between p-6 lg:col-span-8">
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E9E8E1] pb-4">
                          <div>
                            <p className="font-['Space_Grotesk'] text-[10px] font-semibold uppercase tracking-[0.9px] text-[#525552]">
                              Campaign Queue · Live Preview
                            </p>
                            <p className="mt-1 font-['Space_Grotesk'] text-[14px] font-semibold text-[#1B1C18]">
                              Outbound Tenant Follow-up Batch (1,800 Leads)
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <StatusPill tone="purple">4 Lines Concurrent</StatusPill>
                            <StatusPill tone="success">Pacing Active</StatusPill>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-3">
                          <div className="rounded-lg border border-[#E9E8E1] bg-[#FCFBF8] p-3">
                            <p className="font-['Space_Grotesk'] text-[10px] text-[#525552]">
                              Queued
                            </p>
                            <p className="mt-1 font-['Space_Grotesk'] text-[18px] font-bold text-[#1B1C18] tabular-nums">
                              1,800
                            </p>
                          </div>
                          <div className="rounded-lg border border-[#E9E8E1] bg-[#FCFBF8] p-3">
                            <p className="font-['Space_Grotesk'] text-[10px] text-[#525552]">
                              Dialed Today
                            </p>
                            <p className="mt-1 font-['Space_Grotesk'] text-[18px] font-bold text-[#1B1C18] tabular-nums">
                              642
                            </p>
                          </div>
                          <div className="rounded-lg border border-[#E9E8E1] bg-[#FCFBF8] p-3">
                            <p className="font-['Space_Grotesk'] text-[10px] text-[#525552]">
                              Qualified &amp; Synced
                            </p>
                            <p className="mt-1 font-['Space_Grotesk'] text-[18px] font-bold text-[#23835D] tabular-nums">
                              214
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 divide-y divide-[#E9E8E1] rounded-lg border border-[#E9E8E1] bg-[#FCFBF8]">
                          {campaignQueue.map((contact) => {
                            const initials = contact.name
                              .split(" ")
                              .map((part) => part[0])
                              .join("");

                            return (
                              <div
                                key={contact.phone}
                                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E9E8E1] font-['Space_Grotesk'] text-[10px] font-bold text-[#1B1C18]">
                                    {initials}
                                  </span>
                                  <div>
                                    <p className="font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18]">
                                      {contact.name}
                                      <span className="ml-1.5 font-normal text-[#525552]">
                                        · {contact.role}
                                      </span>
                                    </p>
                                    <p className="font-['Space_Grotesk'] text-[10px] text-[#525552]">
                                      {contact.phone} · {contact.detail}
                                    </p>
                                  </div>
                                </div>

                                <StatusPill
                                  tone={
                                    contact.status === "Connected"
                                      ? "success"
                                      : contact.status === "Ringing"
                                        ? "purple"
                                        : "warning"
                                  }
                                >
                                  {contact.status}
                                </StatusPill>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E9E8E1] bg-[#FBF9F2] p-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-[#22A06B]" />
                          <span className="font-['Space_Grotesk'] text-[11px] font-medium text-[#1B1C18]">
                            Disclosure &amp; retry rules enforced automatically per campaign batch.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab("agent")}
                          className="rounded bg-[#1B1C18] px-3 py-1.5 font-['Space_Grotesk'] text-[11px] font-medium text-white transition-colors hover:bg-[#3A3B37]"
                        >
                          Inspect Agent Flow
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <style jsx global>{`
          @keyframes foolioo-glass-panel-enter {
            from {
              opacity: 0;
              transform: translate3d(0, 10px, 0) scale(0.995);
              filter: blur(5px);
            }
            to {
              opacity: 1;
              transform: translate3d(0, 0, 0) scale(1);
              filter: blur(0);
            }
          }

          .foolioo-glass-panel {
            animation: foolioo-glass-panel-enter 440ms cubic-bezier(0.22, 1, 0.36, 1) both;
            transform-origin: top center;
            will-change: opacity, transform, filter;
          }

          @media (prefers-reduced-motion: reduce) {
            .foolioo-glass-panel {
              animation: none;
            }
          }
        `}</style>
      </section>
    );
};