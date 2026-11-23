"use client";
import { Suspense, useActionState, useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { resetPasswordAction, resendPasswordResetOtpAction } from "../actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") || "";
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [cooldown, setCooldown] = useState(60);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [isResending, startResendTransition] = useTransition();
  const [state, formAction, isPending] = useActionState(resetPasswordAction, null);

  useEffect(() => {
    if (initialEmail) setEmail(initialEmail);
  }, [initialEmail]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = () => {
    if (!email || cooldown > 0 || isResending) return;
    setResendStatus(null);
    startResendTransition(async () => {
      const result = await resendPasswordResetOtpAction(email);
      if (result.ok) {
        setResendStatus("A new password reset code was sent.");
        setCooldown(60);
      } else {
        setResendStatus(result.error || "Could not resend the reset code.");
      }
    });
  };

  return (
    <>
      <h1 className="font-['Newsreader'] text-[32px] font-normal text-[#1B1C18]">Set new password</h1>
      <p className="mt-2 font-['Space_Grotesk'] text-[13px] text-[#747878]">Enter the 6-digit code sent to your email.</p>
      <form action={formAction} className="mt-8 flex flex-col gap-4">
        <Input
          name="email"
          type="email"
          label="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <Input
          name="otp"
          label="6-Digit Reset Code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={otp}
          onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          required
        />
        <Input name="password" type="password" label="New Password" placeholder="At least 8 characters" required />
        {state?.error && <p className="text-[12px] text-[#EF4444]">{state.error}</p>}
        {resendStatus && <p className="text-[12px] text-[#18794E]">{resendStatus}</p>}
        <Button type="submit" loading={isPending} disabled={otp.length !== 6}>Update password</Button>
      </form>
      <div className="mt-4 flex justify-between font-['Space_Grotesk'] text-[12px]">
        <span className="text-[#747878]">Didn't get the code?</span>
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || isResending}
          className="font-medium text-[#7852D6] underline disabled:text-[#A0A29C]"
        >
          {isResending ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </button>
      </div>
      <p className="mt-6 text-center text-[13px]">
        <Link href="/sign-in" className="text-[#747878] hover:text-[#1B1C18]">Back to sign in</Link>
      </p>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-[13px] text-[#747878]">Loading…</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}