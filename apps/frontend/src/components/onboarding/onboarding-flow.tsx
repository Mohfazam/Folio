"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { OnboardingSnapshot } from "../../lib/auth/backend";

type Answers = OnboardingSnapshot["answers"];
type Screen = "welcome" | "questions" | "customizing";
type Choice = { value: string; label: string; description?: string };
type Question = {
  key: keyof Answers;
  eyebrow: string;
  title: string;
  description: string;
  multi: boolean;
  choices: Choice[];
};

const QUESTIONS: Question[] = [
  {
    key: "primaryGoals",
    eyebrow: "YOUR TEAM'S PRIORITIES",
    title: "What matters most to your team?",
    description: "Choose the outcomes you want Foolioo to help improve.",
    multi: true,
    choices: [
      { value: "increase_reach", label: "Reach more enquiries", description: "Make sure more people get a timely call." },
      { value: "qualify_enquiries", label: "Qualify enquiries", description: "Identify interest and intent earlier." },
      { value: "improve_follow_ups", label: "Improve follow-ups", description: "Make callbacks and next steps easier to manage." },
      { value: "complete_campaigns", label: "Complete campaigns", description: "Move through contact lists consistently." },
      { value: "reduce_manual_calling", label: "Reduce manual calling", description: "Give your team more time for important conversations." },
      { value: "improve_consistency", label: "Improve consistency", description: "Keep conversations aligned with your rules." },
      { value: "other", label: "Something else" },
    ],
  },
  {
    key: "usesCrmOrDialer",
    eyebrow: "YOUR EXISTING WORKFLOW",
    title: "Do you already use a CRM or dialer for outbound?",
    description: "This helps us understand how Foolioo should fit into your current setup.",
    multi: false,
    choices: [
      { value: "yes", label: "Yes, we use existing tools", description: "CRM, dialer or another outbound system." },
      { value: "no", label: "No, we're starting fresh", description: "We don't currently use a dedicated tool." },
    ],
  },
  {
    key: "channels",
    eyebrow: "HOW YOU REACH PEOPLE",
    title: "Which channels does your team use today?",
    description: "Select every channel you currently use to communicate with contacts.",
    multi: true,
    choices: [
      { value: "phone", label: "Phone calls" },
      { value: "whatsapp", label: "WhatsApp" },
      { value: "sms", label: "SMS" },
      { value: "email", label: "Email" },
      { value: "other", label: "Other channels" },
    ],
  },
  {
    key: "monthlyContacts",
    eyebrow: "YOUR OUTREACH VOLUME",
    title: "How many contacts do you reach per month?",
    description: "A rough estimate is enough. You can change your setup later.",
    multi: false,
    choices: [
      { value: "0_250", label: "0–250 contacts" },
      { value: "250_1000", label: "250–1,000 contacts" },
      { value: "1000_15000", label: "1,000–15,000 contacts" },
      { value: "15000_50000", label: "15,000–50,000 contacts" },
      { value: "50000_plus", label: "50,000+ contacts" },
      { value: "not_sure", label: "Not sure yet" },
    ],
  },
  {
    key: "managesOutboundTeam",
    eyebrow: "YOUR TEAM",
    title: "Do you manage the calling or outbound team?",
    description: "This helps us understand who will configure and review calling activity.",
    multi: false,
    choices: [
      { value: "yes", label: "Yes, I manage the team" },
      { value: "no", label: "No, someone else manages it" },
      { value: "not_yet", label: "I don't have a team yet" },
    ],
  },
  {
    key: "launchTimeline",
    eyebrow: "YOUR TIMELINE",
    title: "When will you start calling customers?",
    description: "Choose the timing that best describes your plans.",
    multi: false,
    choices: [
      { value: "0_1_month", label: "Within the next month" },
      { value: "1_3_months", label: "In 1–3 months" },
      { value: "3_6_months", label: "In 3–6 months" },
      { value: "6_12_months", label: "In 6–12 months" },
      { value: "not_sure", label: "I'm still exploring" },
    ],
  },
];

function isMultiValue(value: unknown): value is string[] {
  return Array.isArray(value);
}

function hasAnswer(question: Question, answers: Answers) {
  const value = answers[question.key];
  return isMultiValue(value) ? value.length > 0 : typeof value === "string" && value.length > 0;
}

function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="m4.5 10.2 3.3 3.3 7.7-7.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowIcon({ direction = "right" }: { direction?: "left" | "right" }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      {direction === "right" ? (
        <path d="M3.5 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M16.5 10h-12m5 5-5-5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

export function OnboardingFlow({ initialOnboarding }: { initialOnboarding: OnboardingSnapshot }) {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>(initialOnboarding.hasSeenWelcome ? "questions" : "welcome");
  const [currentStep, setCurrentStep] = useState(Math.min(5, Math.max(0, initialOnboarding.currentStep)));
  const [answers, setAnswers] = useState<Answers>(initialOnboarding.answers ?? {});
  const [skippedSteps, setSkippedSteps] = useState<number[]>(initialOnboarding.skippedSteps ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completionStarted = useRef(false);

  const question = QUESTIONS[currentStep];
  const canContinue = question ? hasAnswer(question, answers) : false;
  const progress = currentStep + 1;

  useEffect(() => {
    const url = window.location.href;
    if (screen === "welcome") {
      window.history.replaceState({ onboardingScreen: "welcome" }, "", url);
    } else if (screen === "questions") {
      // Rebuild a small same-route history stack so browser Back walks through
      // completed question steps instead of immediately leaving onboarding.
      window.history.replaceState({ onboardingScreen: "questions", onboardingStep: 0 }, "", url);
      for (let index = 1; index <= currentStep; index += 1) {
        window.history.pushState({ onboardingScreen: "questions", onboardingStep: index }, "", url);
      }
    }

    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as { onboardingScreen?: Screen; onboardingStep?: number } | null;
      if (state?.onboardingScreen === "welcome") {
        setScreen("welcome");
        return;
      }
      if (state?.onboardingScreen === "questions") {
        const nextStep = Math.min(5, Math.max(0, Number(state.onboardingStep ?? 0)));
        setScreen("questions");
        setCurrentStep(nextStep);
        setError(null);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
    // History is initialized once from the server-provided resume state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useCallback((choice: string) => {
    if (!question) return false;
    const value = answers[question.key];
    return isMultiValue(value) ? value.includes(choice) : value === choice;
  }, [answers, question]);

  const updateSelection = (choice: string) => {
    if (!question) return;
    setError(null);

    const current = answers[question.key];
    let nextValue: string | string[];
    if (question.multi) {
      const list = isMultiValue(current) ? current : [];
      nextValue = list.includes(choice) ? list.filter((value) => value !== choice) : [...list, choice];
    } else {
      nextValue = choice;
    }

    const nextAnswers = { ...answers, [question.key]: nextValue } as Answers;
    setAnswers(nextAnswers);
  };

  const beginQuestions = () => {
    setError(null);
    window.history.replaceState({ onboardingScreen: "welcome" }, "", window.location.href);
    window.history.pushState({ onboardingScreen: "questions", onboardingStep: 0 }, "", window.location.href);
    setScreen("questions");
    setCurrentStep(0);
  };

  const finishOnboarding = async (nextAnswers: Answers, nextSkipped: number[]) => {
    if (completionStarted.current) return;
    completionStarted.current = true;
    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentStep: 6,
          hasSeenWelcome: true,
          answers: nextAnswers,
          skippedSteps: nextSkipped,
          completed: true,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true) {
        throw new Error(result.error || "We couldn't save your answers. Please try again.");
      }
      setScreen("customizing");
      // This is a short transition after a confirmed save, not a fake progress metric.
      await new Promise((resolve) => window.setTimeout(resolve, 1100));
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      completionStarted.current = false;
      setError(err instanceof Error ? err.message : "Unable to finish setup. Please try again.");
      setIsSaving(false);
    }
  };

  const advance = async () => {
    if (!question || !canContinue || isSaving) return;
    const nextStep = currentStep + 1;
    if (nextStep >= QUESTIONS.length) {
      await finishOnboarding(answers, skippedSteps);
      return;
    }

    setError(null);
    window.history.pushState({ onboardingScreen: "questions", onboardingStep: nextStep }, "", window.location.href);
    setCurrentStep(nextStep);
  };

  const skipQuestion = async () => {
    if (isSaving) return;
    const nextSkipped = [...new Set([...skippedSteps, currentStep])];
    const nextStep = currentStep + 1;
    setError(null);
    setSkippedSteps(nextSkipped);

    if (nextStep >= QUESTIONS.length) {
      await finishOnboarding(answers, nextSkipped);
      return;
    }

    window.history.pushState({ onboardingScreen: "questions", onboardingStep: nextStep }, "", window.location.href);
    setCurrentStep(nextStep);
  };

  const goBack = () => {
    if (isSaving) return;
    if (currentStep === 0) {
      window.history.replaceState({ onboardingScreen: "welcome" }, "", window.location.href);
      setScreen("welcome");
      return;
    }
    window.history.back();
  };

  return (
    <main className="foolioo-onboarding relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F4F1E9] px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-40 -top-44 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(143,115,204,0.16),transparent_68%)]" />
        <div className="absolute -bottom-48 -right-24 h-[540px] w-[540px] rounded-full bg-[radial-gradient(circle,rgba(205,177,131,0.20),transparent_68%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(120,115,98,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(120,115,98,0.035)_1px,transparent_1px)] bg-[size:52px_52px]" />
      </div>

      {/* Deliberately subdued workspace shell behind the modal, matching the Figma onboarding treatment. */}
      <div className="pointer-events-none absolute inset-0 hidden p-7 opacity-55 blur-[2px] md:block" aria-hidden="true">
        <div className="mx-auto flex h-full max-w-[1240px] flex-col overflow-hidden rounded-[22px] border border-[#E2DED4] bg-[#FBFAF6]">
          <div className="flex h-14 items-center justify-between border-b border-[#EAE7DF] px-7">
            <span className="font-['Space_Grotesk'] text-[15px] font-semibold tracking-tight text-[#77766F]">foolioo.</span>
            <div className="h-7 w-28 rounded-full bg-[#F0EEE8]" />
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-[190px_1fr]">
            <aside className="border-r border-[#EAE7DF] p-5">
              <div className="h-9 rounded-lg bg-[#F0EEE8]" />
              <div className="mt-9 space-y-4">
                {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-3 rounded-full bg-[#EEECE5]" style={{ width: `${62 + (index % 3) * 10}%` }} />)}
              </div>
            </aside>
            <section className="p-8">
              <div className="h-7 w-56 rounded-md bg-[#EDEAE2]" />
              <div className="mt-3 h-3 w-80 max-w-full rounded-full bg-[#F0EEE8]" />
              <div className="mt-9 grid grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-28 rounded-xl border border-[#ECE9E1] bg-white" />)}
              </div>
              <div className="mt-5 h-64 rounded-xl border border-[#ECE9E1] bg-white" />
            </section>
          </div>
        </div>
      </div>

      <header className="absolute left-5 right-5 top-5 z-10 flex items-center justify-between sm:left-8 sm:right-8 sm:top-7">
        <span className="font-['Space_Grotesk'] text-[17px] font-semibold lowercase tracking-[-0.7px] text-[#1B1C18]">
          foolioo<span className="text-[#7852D6]">.</span>
        </span>
        <span className="hidden items-center gap-2 font-['Space_Grotesk'] text-[10px] font-medium uppercase tracking-[0.12em] text-[#898980] sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-[#8B75CE]" /> Workspace setup
        </span>
      </header>

      {screen === "welcome" && (
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-welcome-title"
          className="onboarding-card relative z-20 w-full max-w-[520px] overflow-hidden rounded-[18px] border border-[#E7E3D9] bg-[#FFFEFB] shadow-[0_28px_90px_rgba(35,31,24,0.16)]"
        >
          <div className="relative h-[176px] overflow-hidden bg-[#EEE9F6] sm:h-[205px]">
            <div className="absolute -left-10 -top-20 h-64 w-64 rounded-full border border-[#CFC2E8]" />
            <div className="absolute -left-2 -top-12 h-48 w-48 rounded-full border border-[#D8CEE9]" />
            <div className="absolute -bottom-24 right-[-10px] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(120,82,214,0.20),transparent_65%)]" />
            <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#DCD4E9]/50 to-transparent" />
            <div className="absolute left-[13%] top-[23%] flex h-14 w-14 items-center justify-center rounded-2xl border border-white/80 bg-white/75 shadow-[0_12px_30px_rgba(76,58,112,0.10)] backdrop-blur">
              <svg viewBox="0 0 28 28" className="h-7 w-7" fill="none" aria-hidden="true">
                <path d="M4 11v6M9 7v14M14 4v20M19 8v12M24 11v6" stroke="#7852D6" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="absolute right-[17%] top-[26%] flex h-12 w-12 items-center justify-center rounded-full border border-white/80 bg-white/75 text-[#7852D6] shadow-[0_12px_30px_rgba(76,58,112,0.10)] backdrop-blur">
              <CheckIcon className="h-5 w-5" />
            </div>
            <div className="absolute bottom-7 left-[31%] right-[27%] h-px bg-[#B7A8D4]" />
            <div className="absolute bottom-[19px] left-[48%] h-4 w-4 rounded-full border-[3px] border-[#EEE9F6] bg-[#7852D6] shadow-[0_0_0_5px_rgba(120,82,214,0.12)]" />
            <div className="absolute bottom-5 right-[31%] h-2.5 w-2.5 rounded-full bg-[#AF9BCF]" />
          </div>

          <div className="p-6 sm:p-8">
            <p className="font-['Space_Grotesk'] text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7852D6]">
              YOUR WORKSPACE IS ALMOST READY
            </p>
            <h1 id="onboarding-welcome-title" className="mt-2 font-['Newsreader'] text-[34px] font-normal leading-[1.06] tracking-[-0.7px] text-[#1B1C18] sm:text-[39px]">
              Welcome to Foolioo.
            </h1>
            <p className="mt-3 max-w-[425px] font-['Space_Grotesk'] text-[13px] leading-[21px] text-[#747878] sm:text-[14px]">
              Let's tailor your voice operations workspace. A few quick questions will help us understand your team's goals, current tools and calling plans.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-full border border-[#E9E5DB] bg-[#FBFAF6] px-3 py-1.5 font-['Space_Grotesk'] text-[10px] text-[#686A62]">About 2 minutes</span>
              <span className="rounded-full border border-[#E9E5DB] bg-[#FBFAF6] px-3 py-1.5 font-['Space_Grotesk'] text-[10px] text-[#686A62]">6 questions</span>
              <span className="rounded-full border border-[#E9E5DB] bg-[#FBFAF6] px-3 py-1.5 font-['Space_Grotesk'] text-[10px] text-[#686A62]">You can skip any step</span>
            </div>

            {error && <p role="alert" className="mt-4 rounded-lg border border-[#E8C9C4] bg-[#FFF5F3] px-3 py-2 font-['Space_Grotesk'] text-[11px] text-[#A34E42]">{error}</p>}

            <div className="mt-7 flex items-center justify-between gap-4 border-t border-[#EEECE5] pt-5">
              <p className="font-['Space_Grotesk'] text-[10px] text-[#999990]">Your answers help personalize your setup.</p>
              <button
                type="button"
                onClick={beginQuestions}
                disabled={isSaving}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#1B1C18] px-5 font-['Space_Grotesk'] text-[12px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#373831] disabled:cursor-wait disabled:opacity-60"
              >
                {isSaving ? "Preparing…" : "Continue"} <ArrowIcon />
              </button>
            </div>
          </div>
        </section>
      )}

      {screen === "questions" && question && (
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-question-title"
          className="onboarding-card relative z-20 w-full max-w-[490px] rounded-[18px] border border-[#E7E3D9] bg-[#FFFEFB] p-5 shadow-[0_28px_90px_rgba(35,31,24,0.16)] sm:p-7"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-['Space_Grotesk'] text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7852D6]">
                {question.eyebrow}
              </p>
              <p className="mt-2 font-['Space_Grotesk'] text-[11px] font-medium text-[#8D8D84]">
                Question {progress} of 6
              </p>
            </div>
            <span className="rounded-full border border-[#EAE7DF] bg-[#FBFAF6] px-2.5 py-1 font-['Space_Grotesk'] text-[9px] font-medium text-[#85867E]">
              {question.multi ? "SELECT ALL THAT APPLY" : "ONE ANSWER"}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-6 gap-1.5" aria-label={`Question ${progress} of 6`}>
            {QUESTIONS.map((item, index) => (
              <span key={item.key} className={`h-[3px] rounded-full transition-colors duration-300 ${index <= currentStep ? "bg-[#1B1C18]" : "bg-[#E9E7E0]"}`} />
            ))}
          </div>

          <h1 id="onboarding-question-title" className="mt-6 font-['Newsreader'] text-[29px] font-normal leading-[1.1] tracking-[-0.55px] text-[#1B1C18] sm:text-[33px]">
            {question.title}
          </h1>
          <p className="mt-2 font-['Space_Grotesk'] text-[12px] leading-[19px] text-[#777970] sm:text-[13px]">
            {question.description}
          </p>

          <div className={`mt-6 grid gap-2.5 ${question.choices.length >= 6 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
            {question.choices.map((choice) => {
              const active = selected(choice.value);
              return (
                <button
                  key={choice.value}
                  type="button"
                  aria-pressed={active}
                  disabled={isSaving}
                  onClick={() => updateSelection(choice.value)}
                  className={`group flex min-h-[49px] items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A995D7] ${
                    active
                      ? "border-[#B8A8D8] bg-[#F5F1FA] shadow-[0_0_0_1px_rgba(120,82,214,0.04)]"
                      : "border-[#EAE7DF] bg-white hover:border-[#D6CDE6] hover:bg-[#FCFAFF]"
                  }`}
                >
                  <span className="min-w-0">
                    <span className={`block font-['Space_Grotesk'] text-[12px] font-semibold ${active ? "text-[#51416F]" : "text-[#393B34]"}`}>
                      {choice.label}
                    </span>
                    {choice.description && <span className="mt-0.5 block font-['Space_Grotesk'] text-[10px] leading-[15px] text-[#8A8B83]">{choice.description}</span>}
                  </span>
                  <span className={`flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border transition-colors ${active ? "border-[#7852D6] bg-[#7852D6] text-white" : "border-[#DAD8D0] bg-white text-transparent group-hover:border-[#B9AACF]"}`}>
                    {active && <CheckIcon className="h-3 w-3" />}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex min-h-[18px] items-center justify-between gap-3">
            <p aria-live="polite" className="font-['Space_Grotesk'] text-[10px] text-[#96968F]">
              {question.multi ? "Select all that apply." : "Select one option to continue."}
            </p>
            {error && <span role="alert" className="text-right font-['Space_Grotesk'] text-[10px] text-[#A34E42]">{error}</span>}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-[#EEECE5] pt-4">
            <button
              type="button"
              onClick={goBack}
              disabled={isSaving}
              className="inline-flex h-10 items-center gap-2 rounded-full px-3 font-['Space_Grotesk'] text-[11px] font-medium text-[#777970] transition-colors hover:bg-[#F5F3EC] hover:text-[#1B1C18] disabled:opacity-40"
            >
              <ArrowIcon direction="left" /> Back
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void skipQuestion()}
                disabled={isSaving}
                className="h-10 rounded-full px-4 font-['Space_Grotesk'] text-[11px] font-medium text-[#777970] transition-colors hover:bg-[#F5F3EC] hover:text-[#1B1C18] disabled:opacity-40"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => void advance()}
                disabled={!canContinue || isSaving}
                className="inline-flex h-10 min-w-[116px] items-center justify-center gap-2 rounded-full bg-[#1B1C18] px-4 font-['Space_Grotesk'] text-[11px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#373831] disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-[#E8E6DF] disabled:text-[#A8A89F]"
              >
                {isSaving ? "Saving setup…" : currentStep === 5 ? "Finish setup" : "Continue"}
                {!isSaving && <ArrowIcon />}
              </button>
            </div>
          </div>
        </section>
      )}

      {screen === "customizing" && (
        <section className="onboarding-card relative z-20 w-full max-w-[460px] rounded-[18px] border border-[#E7E3D9] bg-[#FFFEFB] px-7 py-10 text-center shadow-[0_28px_90px_rgba(35,31,24,0.16)] sm:px-10 sm:py-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F1ECF8] text-[#7852D6]">
            <svg viewBox="0 0 36 36" className="h-8 w-8" fill="none" aria-hidden="true">
              <path d="M5 14v8M11 9v18M18 4v28M25 10v16M31 14v8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="mt-6 font-['Newsreader'] text-[34px] font-normal leading-tight tracking-[-0.6px] text-[#1B1C18]">
            Customizing your setup…
          </h1>
          <p className="mx-auto mt-3 max-w-[330px] font-['Space_Grotesk'] text-[13px] leading-[21px] text-[#777970]">
            Your answers are being submitted. We're preparing your Foolioo workspace.
          </p>
          <div className="mx-auto mt-7 flex w-36 items-center justify-center gap-1.5" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((dot) => <span key={dot} className="customize-dot h-1.5 w-1.5 rounded-full bg-[#927BC4]" style={{ animationDelay: `${dot * 120}ms` }} />)}
          </div>
        </section>
      )}

      <footer className="absolute bottom-5 left-5 right-5 z-10 flex items-center justify-between gap-4 sm:bottom-7 sm:left-8 sm:right-8">
        <span className="font-['Space_Grotesk'] text-[10px] text-[#96968F]">© Foolioo</span>
        <span className="font-['Space_Grotesk'] text-[10px] text-[#96968F]">Your workspace. Your rules.</span>
      </footer>

      <style jsx global>{`
        .onboarding-card { animation: onboarding-enter 260ms ease-out both; }
        .customize-dot { animation: customize-breathe 850ms ease-in-out infinite alternate; }
        @keyframes onboarding-enter {
          from { opacity: 0; transform: translateY(9px) scale(0.99); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes customize-breathe {
          from { opacity: 0.3; transform: translateY(0); }
          to { opacity: 1; transform: translateY(-3px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .onboarding-card, .customize-dot { animation: none !important; }
        }
      `}</style>
    </main>
  );
}
