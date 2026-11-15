"use client";

import { useActionState, useState, Suspense, type KeyboardEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signInAction } from "../actions";
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

function SignInContent() {
  const searchParams = useSearchParams();
  const isVerified = searchParams.get("verified") === "true";
  const [state, formAction, isPending] = useActionState(signInAction, null);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const handlePasswordKey = (event: KeyboardEvent<HTMLDivElement>) => {
    setCapsLockOn(event.getModifierState("CapsLock"));
  };

  return (
    <main className="mx-auto w-full max-w-[384px]">
      <div className="mb-6 sm:mb-7">
        <div className="mb-3 sm:mb-4 inline-flex items-center gap-2 rounded-full border border-[#E7DEFF] bg-[#F4F0FF] px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#7852D6]" aria-hidden="true" />
          <span className="font-['Space_Grotesk'] text-[10px] font-semibold uppercase tracking-[1.25px] text-[#644ABB]">
            Workspace access
          </span>
        </div>

        <h1 className="font-['Newsreader'] text-[clamp(2.25rem,5vw,2.75rem)] font-normal leading-[1.04] tracking-[-1.1px] text-[#1B1C18]">
          Welcome back.
        </h1>
        <p className="mt-3 max-w-[330px] font-['Space_Grotesk'] text-[13px] leading-[21px] text-[#747878] sm:text-[14px]">
          Sign in to pick up where your team left off.
        </p>
        <div className="mt-3 sm:mt-4 flex items-center gap-2 font-['Space_Grotesk'] text-[11px] font-medium text-[#747878]">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-[#7852D6]" fill="none" aria-hidden="true">
            <path d="M4.2 7V5.2a3.8 3.8 0 0 1 7.6 0V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            <rect x="2.7" y="7" width="10.6" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
          </svg>
          Secure access to your Foolioo workspace
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:gap-5">
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

      {isVerified && (
        <div
          role="status"
          className="mt-5 rounded-lg border border-[#22A06B]/25 bg-[#EAF8F1] px-3.5 py-3 font-['Space_Grotesk'] text-[12px] leading-5 text-[#18794E]"
        >
          ✓ Email verified successfully! Please sign in with your password to access your workspace.
        </div>
      )}

      <form action={formAction} className="mt-5 flex flex-col gap-4 sm:mt-6 sm:gap-[18px]">
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
          <div className="relative" onKeyUp={handlePasswordKey} onKeyDown={handlePasswordKey}>
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              label="Password"
              placeholder="Enter your password"
              autoComplete="current-password"
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
          {capsLockOn && (
            <p role="status" className="-mt-1 font-['Space_Grotesk'] text-[11px] text-[#9A6700]">
              Caps Lock is on.
            </p>
          )}
          <div className="-mt-0.5 flex items-center justify-between gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 font-['Space_Grotesk'] text-[11px] text-[#747878]">
              <input
                type="checkbox"
                name="rememberMe"
                value="true"
                className="h-3.5 w-3.5 rounded border-[#D8D6CE] accent-[#7852D6] focus-visible:ring-2 focus-visible:ring-[#A995D7]"
              />
              Remember me
            </label>
            <Link
              href="/forgot-password"
              className="font-['Space_Grotesk'] text-[11px] font-medium text-[#747878] underline decoration-transparent underline-offset-4 transition-colors hover:text-[#7852D6] hover:decoration-[#7852D6]"
            >
              Forgot password?
            </Link>
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
            {isPending ? "Signing in…" : "Sign in"}
          </Button>
        </div>
      </form>

      <div className="mt-6 border-t border-[#E9E8E1] pt-4 sm:mt-7 sm:pt-5">
        <p className="text-center font-['Space_Grotesk'] text-[12px] leading-5 text-[#747878] sm:text-[13px]">
          New to Foolioo?{" "}
          <Link
            href="/sign-up"
            className="font-semibold text-[#1B1C18] underline decoration-[#B8B5AA] underline-offset-4 transition-colors hover:text-[#7852D6] hover:decoration-[#7852D6]"
          >
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[300px] items-center justify-center font-['Space_Grotesk'] text-[13px] text-[#747878]">
          Loading…
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
