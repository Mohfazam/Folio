"use client";

import { useActionState, useState, useEffect, Suspense, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { verifyOtpAction, resendOtpAction } from "../actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") || "";
  const isUnconfirmed = searchParams.get("unconfirmed") === "true";

  const [state, formAction, isPending] = useActionState(verifyOtpAction, null);
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [cooldown, setCooldown] = useState(60);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [isResending, startResendTransition] = useTransition();

  useEffect(() => {
    if (initialEmail) setEmail(initialEmail);
  }, [initialEmail]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = () => {
    if (cooldown > 0 || isResending || !email) return;
    setResendStatus(null);

    startResendTransition(async () => {
      const res = await resendOtpAction(email);
      if (res.ok) {
        setResendStatus("A new verification code was sent to your inbox from auth@foolioo.app.");
        setCooldown(60);
      } else {
        setResendStatus(res.error || "Failed to resend code. Please wait a moment.");
      }
    });
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow numbers and max 6 digits
    const clean = e.target.value.replace(/\D/g, "").slice(0, 6);
    setOtp(clean);
  };

  return (
    <main className="mx-auto w-full max-w-[384px]">
      <div className="mb-7">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#E7DEFF] bg-[#F4F0FF] px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#7852D6]" aria-hidden="true" />
          <span className="font-['Space_Grotesk'] text-[10px] font-semibold uppercase tracking-[1.25px] text-[#644ABB]">
            Security Verification
          </span>
        </div>

        <h1 className="font-['Newsreader'] text-[38px] font-normal leading-[1.05] tracking-[-1.1px] text-[#1B1C18] sm:text-[42px]">
          Check your email<span className="text-[#FD7032]">.</span>
        </h1>
        <p className="mt-3 max-w-[340px] font-['Space_Grotesk'] text-[13px] leading-[22px] text-[#747878] sm:text-[14px]">
          We sent a 6-digit verification code from{" "}
          <strong className="font-semibold text-[#1B1C18]">auth@foolioo.app</strong> to:
        </p>
        <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-[#EAE7DE] bg-[#F8F6EF] px-3 py-1.5 font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18]">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-[#FD7032]" fill="none" aria-hidden="true">
            <path d="M2.5 4h11a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.2" />
            <path d="m2.5 5 5.5 4 5.5-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="truncate max-w-[280px]">{email || "your email"}</span>
        </div>
      </div>

      {isUnconfirmed && (
        <div
          role="status"
          className="mb-5 rounded-lg border border-[#D97706]/25 bg-[#FFFBEB] px-3.5 py-3 font-['Space_Grotesk'] text-[12px] leading-5 text-[#B45309]"
        >
          Please verify your email address to activate your account and continue to your workspace.
        </div>
      )}

      {resendStatus && (
        <div
          role="status"
          className="mb-5 rounded-lg border border-[#22A06B]/25 bg-[#EAF8F1] px-3.5 py-3 font-['Space_Grotesk'] text-[12px] leading-5 text-[#18794E]"
        >
          {resendStatus}
        </div>
      )}

      <form action={formAction} className="flex flex-col gap-[18px]">
        {!initialEmail && (
          <Input
            id="email"
            name="email"
            type="email"
            label="Work email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
          />
        )}
        {initialEmail && <input type="hidden" name="email" value={email} />}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="otp" className="font-['Space_Grotesk'] text-[13px] font-medium text-[#1B1C18]">
            6-Digit Verification Code
          </label>
          <input
            id="otp"
            name="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            value={otp}
            onChange={handleOtpChange}
            maxLength={6}
            autoFocus
            className="h-14 w-full rounded-lg border border-[#E9E8E1] bg-white text-center font-mono text-[26px] font-bold tracking-[8px] text-[#1B1C18] placeholder-[#C2BFB5] shadow-xs outline-none transition focus:border-[#7852D6] focus:ring-2 focus:ring-[#E7DEFF]"
            required
          />
          <p className="mt-1 font-['Space_Grotesk'] text-[11px] text-[#85877F]">
            Expires in 10 minutes. Check your spam folder if not found.
          </p>
        </div>

        {state?.error && (
          <div
            role="alert"
            className="rounded-lg border border-[#EF4444]/25 bg-[#FFF1F0] px-3.5 py-3 font-['Space_Grotesk'] text-[12px] leading-5 text-[#B42318]"
          >
            {state.error}
          </div>
        )}

        <div className="pt-1">
          <Button type="submit" loading={isPending} disabled={otp.length !== 6}>
            {isPending ? "Verifying code…" : "Verify & Continue"}
          </Button>
        </div>

        <div className="flex items-center justify-between border-t border-[#EAE7DE] pt-4 font-['Space_Grotesk'] text-[12px]">
          <span className="text-[#747878]">Didn't get the code?</span>
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || isResending}
            className="font-medium text-[#7852D6] underline underline-offset-2 transition hover:text-[#5B3CA6] disabled:text-[#A0A29C] disabled:no-underline disabled:cursor-not-allowed"
          >
            {isResending
              ? "Sending…"
              : cooldown > 0
                ? `Resend in ${cooldown}s`
                : "Resend code"}
          </button>
        </div>
      </form>

      <div className="mt-7 border-t border-[#E9E8E1] pt-5">
        <p className="text-center font-['Space_Grotesk'] text-[12px] leading-5 text-[#747878]">
          Wrong email address?{" "}
          <Link
            href="/sign-up"
            className="font-semibold text-[#1B1C18] underline decoration-[#B8B5AA] underline-offset-4 transition-colors hover:text-[#7852D6]"
          >
            Sign up again
          </Link>
          {" · "}
          <Link
            href="/sign-in"
            className="font-semibold text-[#1B1C18] underline decoration-[#B8B5AA] underline-offset-4 transition-colors hover:text-[#7852D6]"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[300px] items-center justify-center font-['Space_Grotesk'] text-[13px] text-[#747878]">
          Loading verification…
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
