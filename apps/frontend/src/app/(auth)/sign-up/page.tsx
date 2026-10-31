"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signUpAction } from "../actions";
import { GoogleButton } from "@/components/auth/google-button";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function VisibilityIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg viewBox="0 0 20 20" className="h-[17px] w-[17px]" fill="none" aria-hidden="true">
      <path d="M2.1 10s2.7-5 7.9-5 7.9 5 7.9 5-2.7 5-7.9 5-7.9-5-7.9-5Z" stroke="currentColor" strokeWidth="1.35" />
      <circle cx="10" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.35" />
    </svg>
  ) : (
    <svg viewBox="0 0 20 20" className="h-[17px] w-[17px]" fill="none" aria-hidden="true">
      <path d="M2.1 10s2.7-5 7.9-5 7.9 5 7.9 5-2.7 5-7.9 5-7.9-5-7.9-5Z" stroke="currentColor" strokeWidth="1.35" />
      <circle cx="10" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.35" />
      <path d="m3 3 14 14" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
    </svg>
  );
}

function getPasswordStrength(password: string) {
  if (!password) return { score: 0, label: "Password strength", color: "#D9D7CF" };

  const checks = [
    password.length >= 8,
    /[A-Za-z]/.test(password) && /\d/.test(password),
    password.length >= 12,
    /[a-z]/.test(password) && /[A-Z]/.test(password) && /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong"];
  const colors = ["#D9D7CF", "#D97757", "#D19A45", "#7D9A68", "#39855D"];
  return { score, label: labels[score], color: colors[score] };
}

export default function SignUpPage() {
  const [state, formAction, isPending] = useActionState(signUpAction, null);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const strength = getPasswordStrength(password);

  return (
    <main className="mx-auto w-full max-w-[384px]">
      <div className="mb-8">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="h-px w-7 bg-[#FD7032]" aria-hidden="true" />
          <span className="font-['Space_Grotesk'] text-[10px] font-semibold uppercase tracking-[0.18em] text-[#A36A4D]">
            Get started
          </span>
        </div>

        <h1 className="max-w-[390px] font-['Newsreader'] text-[42px] font-normal leading-[0.98] tracking-[-1.35px] text-[#1B1C18] sm:text-[48px]">
          Your workspace starts here<span className="text-[#FD7032]">.</span>
        </h1>
        <p className="mt-4 max-w-[350px] font-['Space_Grotesk'] text-[13px] leading-[22px] text-[#747878] sm:text-[14px]">
          Bring your voice operations together. Create your Foolioo account and get your team moving.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-[#EAE7DE] py-3.5">
          <span className="inline-flex items-center gap-2 font-['Space_Grotesk'] text-[11px] font-medium text-[#55574F]">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FFF0E8] text-[#E66A36]">
              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden="true">
                <path d="m3.5 8.2 2.8 2.7 6.2-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            7-day free trial
          </span>
          <span className="hidden h-4 w-px bg-[#E2DED4] sm:block" aria-hidden="true" />
          <span className="font-['Space_Grotesk'] text-[11px] font-medium text-[#85877F]">
            No credit card required
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <div className="[&_button]:!min-h-[46px] [&_button]:!w-full [&_button]:!rounded-lg [&_button]:!border [&_button]:!border-[#E6E4DC] [&_button]:!bg-white [&_button]:!font-['Space_Grotesk'] [&_button]:!text-[13px] [&_button]:!font-semibold [&_button]:!text-[#1B1C18] [&_button]:!shadow-[0_1px_2px_rgba(24,24,20,0.04)] [&_button]:transition-colors [&_button:hover]:!bg-[#F8F7F2]">
          <GoogleButton />
        </div>

        <div className="flex items-center gap-3" aria-hidden="true">
          <div className="h-px flex-1 bg-[#E9E8E1]" />
          <span className="font-['Space_Grotesk'] text-[10px] font-medium uppercase tracking-[1.1px] text-[#92938D]">
            Or use your work email
          </span>
          <div className="h-px flex-1 bg-[#E9E8E1]" />
        </div>
      </div>

      {state?.success ? (
        <div
          role="status"
          className="mt-5 rounded-xl border border-[#22A06B]/25 bg-[#EAF8F1] px-4 py-4 font-['Space_Grotesk'] text-[13px] leading-5 text-[#18794E]"
        >
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
              <path d="m4.5 10.2 3.4 3.4 7.6-7.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Account request received
          </div>
          {state.success}
        </div>
      ) : (
        <form action={formAction} className="mt-6 flex flex-col gap-[17px]">
          <Input
            id="name"
            name="name"
            label="Full name"
            placeholder="Aarav Sharma"
            autoComplete="name"
            maxLength={50}
            error={state?.fieldErrors?.name?.[0]}
            required
          />
          <Input
            id="email"
            name="email"
            type="email"
            label="Work email"
            placeholder="you@company.com"
            autoComplete="email"
            error={state?.fieldErrors?.email?.[0]}
            required
          />

          <div className="flex flex-col gap-2">
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                label="Password"
                placeholder="At least 8 characters"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                error={state?.fieldErrors?.password?.[0]}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute right-2 top-[36px] inline-flex h-8 w-8 items-center justify-center rounded-md text-[#85877F] transition-colors hover:bg-[#F2F0EA] hover:text-[#51496A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A995D7]"
              >
                <VisibilityIcon visible={showPassword} />
              </button>
            </div>

            <div className="rounded-lg border border-[#ECE9E1] bg-[#FCFBF8] px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="font-['Space_Grotesk'] text-[10px] font-medium text-[#777970]">Password strength</span>
                <span className="font-['Space_Grotesk'] text-[10px] font-semibold" style={{ color: strength.color }} aria-live="polite">
                  {strength.label}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-1.5" aria-label={`Password strength: ${strength.label}`}>
                {[0, 1, 2, 3].map((index) => (
                  <span
                    key={index}
                    className="h-1 rounded-full transition-colors duration-300"
                    style={{ backgroundColor: index < strength.score ? strength.color : "#E7E5DE" }}
                  />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-['Space_Grotesk'] text-[10px] text-[#85877F]">
                <span className={password.length >= 8 ? "text-[#39855D]" : ""}>
                  {password.length >= 8 ? "✓" : "○"} 8 characters minimum
                </span>
                <span className={/[A-Za-z]/.test(password) && /\d/.test(password) ? "text-[#39855D]" : ""}>
                  {/[A-Za-z]/.test(password) && /\d/.test(password) ? "✓" : "○"} Mix letters and numbers
                </span>
              </div>
            </div>
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
            <Button type="submit" loading={isPending}>
              {isPending ? "Creating your account…" : "Create account"}
            </Button>
          </div>

          <p className="-mt-1 text-center font-['Space_Grotesk'] text-[10px] leading-[17px] text-[#85877F]">
            By creating an account, you agree to our{" "}
            <Link href="/terms" className="font-medium text-[#51496A] underline underline-offset-2 hover:text-[#7852D6]">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="font-medium text-[#51496A] underline underline-offset-2 hover:text-[#7852D6]">
              Privacy Policy
            </Link>.
          </p>
        </form>
      )}

      <div className="mt-7 border-t border-[#E9E8E1] pt-5">
        <p className="text-center font-['Space_Grotesk'] text-[12px] leading-5 text-[#747878] sm:text-[13px]">
          Already have a Foolioo account?{" "}
          <Link
            href="/sign-in"
            className="font-semibold text-[#1B1C18] underline decoration-[#B8B5AA] underline-offset-4 transition-colors hover:text-[#7852D6] hover:decoration-[#7852D6]"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}