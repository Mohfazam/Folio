"use client";

import { useRouter } from "next/navigation";
import Script from "next/script";
import { FormEvent, useEffect, useRef, useState } from "react";

type Scenario = "admissions" | "student-support" | "general-enquiry";
type DemoStatus = "idle" | "submitting" | "queued" | "completed" | "error";
type TurnstileWindow = Window & {
  turnstile?: {
    render: (element: HTMLElement, options: Record<string, unknown>) => string;
    reset: (id?: string) => void;
    remove: (id: string) => void;
  };
};

type PublicDemoExperienceProps = {
  isLoggedIn?: boolean;
};

const scenarios: { id: Scenario; title: string; description: string; icon: string }[] = [
  { id: "admissions", title: "Admissions enquiry", description: "Courses, eligibility, fees and applications.", icon: "01" },
  { id: "student-support", title: "Student support", description: "Timetables, campus information and common questions.", icon: "02" },
  { id: "general-enquiry", title: "General enquiry", description: "A natural first conversation with an institute receptionist.", icon: "03" },
];

const languages = [
  { value: "en-IN", label: "English (India)" },
  { value: "hi-IN", label: "Hindi" },
  { value: "te-IN", label: "Telugu" },
  { value: "ta-IN", label: "Tamil" },
  { value: "kn-IN", label: "Kannada" },
  { value: "ml-IN", label: "Malayalam" },
];

const COMPLETED_STATUSES = new Set([
  "completed",
  "ended",
  "finished",
  "done",
  "disconnected",
  "no-answer",
  "busy",
  "failed",
]);

export default function PublicDemoExperience({ isLoggedIn = false }: PublicDemoExperienceProps) {
  const router = useRouter();
  const returnPath = isLoggedIn ? "/dashboard" : "/";
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [scenario, setScenario] = useState<Scenario>("admissions");
  const [language, setLanguage] = useState("en-IN");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<DemoStatus>("idle");
  const [message, setMessage] = useState("");
  const [requestId, setRequestId] = useState("");
  const [countdown, setCountdown] = useState(5);
  const [liveCallPhase, setLiveCallPhase] = useState<"pending" | "in_progress" | "completed">("pending");
  const [callOutcome, setCallOutcome] = useState<string | null>(null);
  const [callDurationSeconds, setCallDurationSeconds] = useState<number | null>(null);
  const [captchaToken, setCaptchaToken] = useState("");
  const captchaRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();

  useEffect(() => {
    if (!siteKey) return;

    const renderWidget = () => {
      const w = window as TurnstileWindow;
      if (!captchaRef.current || !w.turnstile || widgetId.current) return true;
      widgetId.current = w.turnstile.render(captchaRef.current, {
        sitekey: siteKey,
        action: "public_demo",
        theme: "light",
        callback: (token: string) => setCaptchaToken(token),
        "expired-callback": () => setCaptchaToken(""),
        "error-callback": () => setCaptchaToken(""),
      });
      return true;
    };

    if (renderWidget()) return;

    const interval = window.setInterval(() => {
      if (renderWidget()) {
        window.clearInterval(interval);
      }
    }, 200);

    return () => {
      window.clearInterval(interval);
      const w = window as TurnstileWindow;
      if (widgetId.current && w.turnstile) {
        w.turnstile.remove(widgetId.current);
      }
      widgetId.current = null;
    };
  }, [siteKey]);

  useEffect(() => {
    if (status !== "queued") return;

    let cancelled = false;

    const checkCallStatus = async () => {
      if (!requestId) return;
      try {
        const res = await fetch(`/api/public-demo?requestId=${encodeURIComponent(requestId)}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        const queueState = String(data.queueStatus ?? data.status ?? "").toLowerCase();
        const callState = String(data.status ?? data.callStatus ?? data.state ?? "").toLowerCase();

        if (queueState === "in_progress" || callState === "in_progress") {
          setLiveCallPhase("in_progress");
        } else if (queueState === "pending" || callState === "pending") {
          setLiveCallPhase("pending");
        }

        if (data.completed === true || COMPLETED_STATUSES.has(callState)) {
          setLiveCallPhase("completed");
          setCallOutcome(typeof data.outcome === "string" ? data.outcome : null);
          setCallDurationSeconds(
            typeof data.durationSeconds === "number" ? data.durationSeconds : null,
          );
          setCountdown(5);
          setStatus("completed");
        }
      } catch {
        // Ignore transient network/polling errors
      }
    };

    void checkCallStatus();
    const pollInterval = setInterval(checkCallStatus, 2500);

    const maxDurationTimer = setTimeout(() => {
      if (!cancelled) {
        setLiveCallPhase("completed");
        setCountdown(5);
        setStatus("completed");
      }
    }, 135_000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
      clearTimeout(maxDurationTimer);
    };
  }, [status, requestId]);

  useEffect(() => {
    if (status !== "completed") return;

    if (countdown <= 1) {
      const redirectTimer = setTimeout(() => {
        router.push(returnPath);
      }, 1000);
      return () => clearTimeout(redirectTimer);
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [status, countdown, router, returnPath]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setRequestId("");

    const digits = phone.replace(/[\s()-]/g, "");
    if (!/^\d{10}$/.test(digits)) {
      setStatus("error");
      setMessage("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    if (!consent) {
      setStatus("error");
      setMessage("Please confirm that you agree to receive this one demo call.");
      return;
    }
    if (siteKey && !captchaToken) {
      setStatus("error");
      setMessage("Complete the security check before requesting your call.");
      return;
    }

    setStatus("submitting");
    try {
      const response = await fetch("/api/public-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: `${countryCode}${digits}`,
          scenario,
          language,
          consent: true,
          captchaToken,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "We could not start your demo call. Please try again."
        );
      }
      setRequestId(typeof payload.requestId === "string" ? payload.requestId : "");
      setLiveCallPhase("pending");
      setCallOutcome(null);
      setCallDurationSeconds(null);
      setStatus("queued");
      setMessage(
        typeof payload.message === "string"
          ? payload.message
          : "Your live demo call is queued. Keep your phone nearby. The call will last up to two minutes."
      );
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      setCaptchaToken("");
      const w = window as TurnstileWindow;
      if (widgetId.current) w.turnstile?.reset(widgetId.current);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-[1240px] flex-col justify-start gap-7 px-4 py-5 sm:px-8 sm:py-7 lg:grid lg:grid-cols-[1fr_minmax(0,520px)] lg:items-center lg:gap-12 lg:py-3 xl:gap-16 xl:px-10">
      {/* LEFT COLUMN */}
      <div className="mx-auto w-full max-w-[560px] lg:mx-0 lg:max-w-none">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#E7D8C8] bg-white/80 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[1.5px] text-[#8B6048]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#FD7032]" />
          Meet your AI receptionist
        </div>

        <h1 className="mt-3.5 font-[var(--font-newsreader)] text-[38px] font-medium leading-[1.02] tracking-[-1.5px] text-[#1B1C18] sm:text-[48px] sm:tracking-[-1.8px] xl:text-[56px] xl:tracking-[-2.1px]">
          {isLoggedIn ? (
            <>
              Test a live call. <span className="italic text-[#FD7032]">Hear the flow.</span>
            </>
          ) : (
            <>
              A real conversation. <span className="italic text-[#FD7032]">No sign-up.</span>
            </>
          )}
        </h1>

        <p className="mt-3.5 max-w-[490px] text-[14px] leading-[22px] text-[#66635B] sm:text-[15px] sm:leading-[24px]">
          Experience how a Foolioo voice agent handles everyday institute enquiries. Choose a scenario, select a language and receive one live demo call.
        </p>

        <div className="mt-6 grid max-w-[490px] grid-cols-3 gap-4 border-t border-[#E4DED2] pt-5 sm:gap-6">
          {[
            { value: "01", label: "Choose a scenario" },
            { value: "02", label: "Request a call" },
            { value: "03", label: "Talk naturally" },
          ].map((item) => (
            <div key={item.value}>
              <p className="font-[var(--font-newsreader)] text-[25px] italic leading-none text-[#FD7032] sm:text-[28px]">
                {item.value}
              </p>
              <p className="mt-1.5 text-[11.5px] leading-4 text-[#77736A] sm:text-[12px]">
                {item.label}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex max-w-[490px] items-start gap-3 rounded-xl border border-[#E8E1D5] bg-white/70 p-3.5 text-[12px] leading-[19px] text-[#68645C] sm:p-4 sm:text-[12.5px]">
          <span className="mt-0.5 shrink-0 text-[#FD7032]">✳</span>
          <p>
            <strong className="font-semibold text-[#292821]">Built for institute front desks.</strong>{" "}
            The showcase agent demonstrates admissions and student-support conversations. It is a curated demo, not a live institution&apos;s official support line.
          </p>
        </div>
      </div>

      {/* RIGHT COLUMN (FORM CARD) */}
      <div className="mx-auto w-full max-w-[520px] rounded-[22px] border border-[#E6E0D5] bg-[#FFFEFA] p-5 shadow-[0_20px_60px_rgba(50,42,27,0.06)] sm:p-6 lg:mx-0 lg:px-7 lg:py-4">
        {status === "completed" ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center py-5 text-center sm:min-h-[410px]">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FCE9DD] text-[24px] text-[#E96B32] sm:h-16 sm:w-16 sm:text-[27px]">
              ✓
            </div>
            <p className="mt-5 text-[10px] font-semibold uppercase tracking-[1.8px] text-[#A66A4A]">
              {callOutcome === "no_answer"
                ? "Call unanswered"
                : callOutcome === "busy"
                  ? "Line busy"
                  : callOutcome === "failed"
                    ? "Call ended"
                    : "Demo completed"}
            </p>
            <h2 className="mt-2 font-[var(--font-newsreader)] text-[28px] leading-tight text-[#1B1C18] sm:text-[34px]">
              Thank you for trying Foolioo.
            </h2>
            <p className="mt-2.5 max-w-sm text-[13px] leading-6 text-[#716D64]">
              {callOutcome === "no_answer"
                ? "We tried reaching your phone, but the call was not answered."
                : callOutcome === "busy"
                  ? "Your line appeared busy when our AI receptionist called."
                  : callDurationSeconds && callDurationSeconds > 0
                    ? `Your ${callDurationSeconds}s conversation with our AI receptionist has ended.`
                    : "We hope you enjoyed experiencing our AI receptionist."}{" "}
              Returning to {isLoggedIn ? "dashboard" : "landing"} in{" "}
              <span className="font-semibold text-[#FD7032]">{countdown}</span>…
            </p>
            <button
              type="button"
              onClick={() => router.push(returnPath)}
              className="mt-6 rounded-full border border-[#DCD5C8] px-5 py-2.5 text-[12px] font-semibold text-[#1B1C18] transition hover:border-[#FD7032]"
            >
              {isLoggedIn ? "Back to dashboard" : "Return now"}
            </button>
          </div>
        ) : status === "queued" ? (
          <div
            className="flex min-h-[360px] flex-col items-center justify-center py-5 text-center sm:min-h-[410px]"
            aria-live="polite"
          >
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#FCE9DD] text-[#E96B32] sm:h-16 sm:w-16">
              <span className="absolute inset-0 animate-ping rounded-full bg-[#FD7032]/25" />
              <span className="relative h-3 w-3 rounded-full bg-[#E96B32]" />
            </div>
            <p className="mt-5 text-[10px] font-semibold uppercase tracking-[1.8px] text-[#A66A4A]">
              {liveCallPhase === "in_progress" ? "Live call in progress" : "Connecting your call"}
            </p>
            <h2 className="mt-2 font-[var(--font-newsreader)] text-[28px] leading-tight text-[#1B1C18] sm:text-[32px]">
              {liveCallPhase === "in_progress"
                ? "Your AI receptionist is on the line."
                : "Dialling your phone now…"}
            </h2>
            <p className="mt-2.5 max-w-sm text-[13px] leading-6 text-[#716D64]">
              {liveCallPhase === "in_progress"
                ? "Speak naturally. This screen will automatically update as soon as your call ends."
                : message || "Keep your phone nearby — your call is connecting and will last up to two minutes."}
            </p>

            {/* Live step tracker */}
            <div className="mt-6 flex w-full max-w-xs items-center justify-between rounded-xl border border-[#EAE5DB] bg-[#F9F7F1] px-3.5 py-3 text-left text-[11px] sm:px-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#22A06B]" />
                <span className="font-medium text-[#292821]">Queued</span>
              </div>
              <span className="text-[#C8C1B4]">→</span>
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    liveCallPhase === "in_progress"
                      ? "animate-pulse bg-[#FD7032]"
                      : "bg-[#D5CFC2]"
                  }`}
                />
                <span
                  className={
                    liveCallPhase === "in_progress"
                      ? "font-semibold text-[#1B1C18]"
                      : "text-[#8A8377]"
                  }
                >
                  In progress
                </span>
              </div>
              <span className="text-[#C8C1B4]">→</span>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#D5CFC2]" />
                <span className="text-[#8A8377]">Summary</span>
              </div>
            </div>

            {requestId ? <p className="mt-4 text-[10px] text-[#A19B90]">Reference: {requestId}</p> : null}
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[9.5px] font-semibold uppercase tracking-[1.6px] text-[#A66A4A]">
                  The live experience
                </p>
                <h2 className="mt-0.5 font-[var(--font-newsreader)] text-[25px] leading-tight tracking-[-0.5px] text-[#1B1C18] sm:text-[28px]">
                  Let’s get you on a call.
                </h2>
                <p className="text-[12px] leading-4 text-[#77736A]">
                  {isLoggedIn
                    ? "Pick a flow and get a quick test call."
                    : "No account or email required."}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-[#E8E1D5] bg-[#FAF8F3] px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-[1px] text-[#77736A]">
                Up to 2 min
              </span>
            </div>

            <form onSubmit={submit} className="mt-3 space-y-2.5 lg:mt-2.5 lg:space-y-2">
              <fieldset>
                <legend className="mb-1 text-[12px] font-semibold text-[#34332D]">
                  01. What should the AI receptionist demonstrate?
                </legend>
                <div className="grid gap-1.5 lg:gap-1">
                  {scenarios.map((item) => (
                    <label
                      key={item.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2 transition lg:py-1.5 ${
                        scenario === item.id
                          ? "border-[#E99A70] bg-[#FFF7F1]"
                          : "border-[#EAE5DB] bg-white hover:border-[#CFC5B5]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="scenario"
                        value={item.id}
                        checked={scenario === item.id}
                        onChange={() => setScenario(item.id)}
                        className="shrink-0 accent-[#E96B32]"
                      />
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F2EEE6] text-[10.5px] font-semibold text-[#8A8174]">
                        {item.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12.5px] font-semibold leading-tight text-[#34332D]">
                          {item.title}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-3.5 text-[#77736A]">
                          {item.description}
                        </span>
                      </span>
                      {scenario === item.id ? (
                        <span className="shrink-0 text-[13px] font-medium text-[#E96B32]">✓</span>
                      ) : null}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
                <label className="block">
                  <span className="mb-1 block text-[12px] font-semibold text-[#34332D]">
                    02. Conversation language
                  </span>
                  <select
                    value={language}
                    onChange={(event) => setLanguage(event.target.value)}
                    className="h-9 w-full rounded-lg border border-[#E4DED3] bg-white px-3 text-[12px] text-[#1B1C18] outline-none transition focus:border-[#E99A70]"
                  >
                    {languages.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div>
                  <label
                    htmlFor="demo-phone"
                    className="mb-1 block text-[12px] font-semibold text-[#34332D]"
                  >
                    03. Your phone number
                  </label>
                  <div className="flex h-9 overflow-hidden rounded-lg border border-[#E4DED3] bg-white transition focus-within:border-[#E99A70]">
                    <select
                      aria-label="Country calling code"
                      value={countryCode}
                      onChange={(event) => setCountryCode(event.target.value)}
                      className="w-[78px] shrink-0 border-r border-[#EAE5DB] bg-[#FAF8F3] px-2 text-[12px] text-[#1B1C18] outline-none"
                    >
                      <option value="+91">IN +91</option>
                    </select>
                    <input
                      id="demo-phone"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      inputMode="numeric"
                      autoComplete="tel-national"
                      placeholder="98765 43210"
                      className="min-w-0 flex-1 px-3 text-[12px] text-[#1B1C18] outline-none placeholder:text-[#A39D92]"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#EFECE4] bg-[#F7F4ED] px-3.5 py-2 lg:py-1.5">
                <label className="flex cursor-pointer items-start gap-2.5 text-[10px] leading-[15px] text-[#666158]">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                    className="mt-0.5 shrink-0 accent-[#E96B32]"
                  />
                  <span>
                    I agree to receive one automated AI demo call from Foolioo at the number provided. I confirm I own this number or have permission to use it. I understand this is an AI-generated call, it is not recorded, and I can end it at any time.
                  </span>
                </label>
              </div>

              {siteKey ? (
                <div className="min-h-[62px]">
                  <div
                    ref={captchaRef}
                    className="origin-left scale-[0.92] max-[380px]:scale-[0.86]"
                  />
                </div>
              ) : null}

              {message && status === "error" ? (
                <p role="alert" className="text-[11.5px] leading-4 text-[#B34E35]">
                  {message}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={status === "submitting" || !consent || (Boolean(siteKey) && !captchaToken)}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#1B1C18] px-5 text-[12.5px] font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#34352F] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 lg:h-9.5"
              >
                {status === "submitting" ? "Requesting your call…" : "Request my live demo call"}
                <span aria-hidden="true">↗</span>
              </button>

              <p className="text-center text-[9.5px] leading-3.5 text-[#969084]">
                One demo call per phone number every hour. Calls are available from 9 AM to 8 PM IST and last up to two minutes.
              </p>
            </form>
          </>
        )}
      </div>

      {siteKey ? (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onLoad={() => {
            const w = window as TurnstileWindow;
            if (!w.turnstile || !captchaRef.current || widgetId.current) return;
            widgetId.current = w.turnstile.render(captchaRef.current, {
              sitekey: siteKey,
              action: "public_demo",
              theme: "light",
              callback: (token: string) => setCaptchaToken(token),
              "expired-callback": () => setCaptchaToken(""),
              "error-callback": () => setCaptchaToken(""),
            });
          }}
        />
      ) : null}
    </section>
  );
}
