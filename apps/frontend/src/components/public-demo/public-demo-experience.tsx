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

export default function PublicDemoExperience() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [scenario, setScenario] = useState<Scenario>("admissions");
  const [language, setLanguage] = useState("en-IN");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<DemoStatus>("idle");
  const [message, setMessage] = useState("");
  const [requestId, setRequestId] = useState("");
  const [countdown, setCountdown] = useState(5);
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
        const callState = String(data.status ?? data.callStatus ?? data.state ?? "").toLowerCase();
        if (!cancelled && (data.completed === true || COMPLETED_STATUSES.has(callState))) {
          setCountdown(5);
          setStatus("completed");
        }
      } catch {
        // Ignore transient network/polling errors
      }
    };

    const pollInterval = setInterval(checkCallStatus, 3000);

    const maxDurationTimer = setTimeout(() => {
      if (!cancelled) {
        setCountdown(5);
        setStatus("completed");
      }
    }, 130_000);

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
        router.push("/");
      }, 1000);
      return () => clearTimeout(redirectTimer);
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [status, countdown, router]);

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
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 py-5 sm:px-8 lg:grid lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-12">
      {/* LEFT COLUMN */}
      <div className="flex flex-col justify-center lg:pr-4">
        <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-[#E7D8C8] bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[1.5px] text-[#8B6048]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#FD7032]" /> Meet your AI receptionist
        </div>
        <h1 className="max-w-xl font-[var(--font-newsreader)] text-[44px] font-medium leading-[0.99] tracking-[-1.9px] sm:text-[56px]">
          A real conversation. <span className="italic text-[#FD7032]">No sign-up.</span>
        </h1>
        <p className="mt-4 max-w-lg text-[14px] leading-6 text-[#66635B]">
          Experience how a Foolioo voice agent handles everyday institute enquiries. Choose a scenario, select a language and receive one live demo call.
        </p>
        <div className="mt-7 grid max-w-lg grid-cols-3 gap-3 border-t border-[#E4DED2] pt-5">
          {[
            { value: "01", label: "Choose a scenario" },
            { value: "02", label: "Request a call" },
            { value: "03", label: "Talk naturally" },
          ].map((item) => (
            <div key={item.value}>
              <p className="font-[var(--font-newsreader)] text-[24px] italic text-[#FD7032]">{item.value}</p>
              <p className="mt-0.5 text-[11px] leading-4 text-[#77736A]">{item.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-7 flex items-start gap-3 rounded-xl border border-[#E8E1D5] bg-white/60 p-3.5 text-[12px] leading-5 text-[#68645C]">
          <span className="mt-0.5 text-[#FD7032]">✳</span>
          <p>
            <strong className="font-semibold text-[#292821]">Built for institute front desks.</strong> The showcase agent demonstrates admissions and student-support conversations. It is a curated demo, not a live institution&apos;s official support line.
          </p>
        </div>
      </div>

      {/* RIGHT COLUMN (FORM CARD) */}
      <div className="rounded-[22px] border border-[#E6E0D5] bg-[#FFFEFA] p-5 shadow-[0_20px_70px_rgba(50,42,27,0.07)] sm:p-7">
        {status === "completed" ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FCE9DD] text-[27px] text-[#E96B32]">
              ✓
            </div>
            <p className="mt-6 text-[10px] font-semibold uppercase tracking-[1.8px] text-[#A66A4A]">
              Demo completed
            </p>
            <h2 className="mt-2 font-[var(--font-newsreader)] text-[36px] leading-tight">
              Thank you for trying Foolioo.
            </h2>
            <p className="mt-3 max-w-sm text-[13px] leading-6 text-[#716D64]">
              We hope you enjoyed experiencing our AI receptionist. Returning back to landing in{" "}
              <span className="font-semibold text-[#FD7032]">{countdown}</span>…
            </p>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="mt-7 rounded-full border border-[#DCD5C8] px-5 py-2.5 text-[12px] font-semibold hover:border-[#FD7032]"
            >
              Return now
            </button>
          </div>
        ) : status === "queued" ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FCE9DD] text-[27px] text-[#E96B32]">
              ✓
            </div>
            <p className="mt-6 text-[10px] font-semibold uppercase tracking-[1.8px] text-[#A66A4A]">
              Request accepted
            </p>
            <h2 className="mt-2 font-[var(--font-newsreader)] text-[36px] leading-tight">
              Your demo call is queued.
            </h2>
            <p className="mt-3 max-w-sm text-[13px] leading-6 text-[#716D64]">{message}</p>
            {requestId ? <p className="mt-4 text-[10px] text-[#A19B90]">Reference: {requestId}</p> : null}
            <button
              type="button"
              onClick={() => {
                setCountdown(5);
                setStatus("completed");
              }}
              className="mt-7 rounded-full border border-[#DCD5C8] px-5 py-2.5 text-[12px] font-semibold hover:border-[#FD7032]"
            >
              I&apos;ve finished my call
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[1.7px] text-[#A66A4A]">The live experience</p>
                <h2 className="mt-1 font-[var(--font-newsreader)] text-[32px] leading-tight tracking-[-0.7px]">Let’s get you on a call.</h2>
                <p className="mt-1 text-[12px] leading-4 text-[#77736A]">No account or email required.</p>
              </div>
              <span className="rounded-full border border-[#E8E1D5] px-3 py-1 text-[9px] font-semibold uppercase tracking-[1px] text-[#77736A]">
                Up to 2 min
              </span>
            </div>

            <form onSubmit={submit} className="mt-5 space-y-4">
              <fieldset>
                <legend className="mb-2 text-[12px] font-semibold text-[#34332D]">01. What should the AI receptionist demonstrate?</legend>
                <div className="grid gap-2">
                  {scenarios.map((item) => (
                    <label
                      key={item.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 transition ${
                        scenario === item.id
                          ? "border-[#E99A70] bg-[#FFF7F1]"
                          : "border-[#EAE5DB] hover:border-[#CFC5B5]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="scenario"
                        value={item.id}
                        checked={scenario === item.id}
                        onChange={() => setScenario(item.id)}
                        className="accent-[#E96B32]"
                      />
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F2EEE6] text-[10px] font-semibold text-[#8A8174]">
                        {item.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] font-semibold text-[#34332D]">{item.title}</span>
                        <span className="block text-[10px] leading-4 text-[#77736A]">{item.description}</span>
                      </span>
                      {scenario === item.id ? <span className="text-[#E96B32]">✓</span> : null}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-3.5 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-semibold text-[#34332D]">02. Conversation language</span>
                  <select
                    value={language}
                    onChange={(event) => setLanguage(event.target.value)}
                    className="h-10 w-full rounded-lg border border-[#E4DED3] bg-white px-3 text-[12px] outline-none focus:border-[#E99A70]"
                  >
                    {languages.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  <label htmlFor="demo-phone" className="mb-1.5 block text-[12px] font-semibold text-[#34332D]">
                    03. Your phone number
                  </label>
                  <div className="flex h-10 overflow-hidden rounded-lg border border-[#E4DED3] bg-white focus-within:border-[#E99A70]">
                    <select
                      aria-label="Country calling code"
                      value={countryCode}
                      onChange={(event) => setCountryCode(event.target.value)}
                      className="w-[82px] border-r border-[#EAE5DB] bg-[#FAF8F3] px-2 text-[12px] outline-none"
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
                      className="min-w-0 flex-1 px-3 text-[12px] outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-[#F7F4ED] p-3">
                <label className="flex cursor-pointer items-start gap-2.5 text-[10px] leading-4 text-[#666158]">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                    className="mt-0.5 accent-[#E96B32]"
                  />
                  <span>
                    I agree to receive one automated AI demo call from Foolioo at the number provided. I confirm I own this number or have permission to use it. I understand this is an AI-generated call, it is not recorded, and I can end it at any time.
                  </span>
                </label>
              </div>

              {siteKey ? <div ref={captchaRef} className="min-h-[65px]" /> : null}

              {message && status === "error" ? (
                <p role="alert" className="text-[11px] leading-5 text-[#B34E35]">
                  {message}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={status === "submitting" || !consent || (Boolean(siteKey) && !captchaToken)}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#1B1C18] px-5 text-[12px] font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#34352F] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {status === "submitting" ? "Requesting your call…" : "Request my live demo call"}
                <span aria-hidden="true">↗</span>
              </button>

              <p className="text-center text-[9px] leading-4 text-[#969084]">
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