"use client";
import { useActionState } from "react";
import { forgotPasswordAction } from "../actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const EMAIL_AUTH_DISABLED = true;

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState(forgotPasswordAction, null);

  return (
    <>
      <h1 className="font-['Newsreader'] text-[32px] font-normal text-[#1B1C18]">Reset password</h1>
      {EMAIL_AUTH_DISABLED ? (
        <div className="mt-5 rounded-lg border border-[#E6E3D8] bg-[#F8F6EF] p-4 font-['Space_Grotesk'] text-[12px] leading-5 text-[#666862]">
          Email password reset is temporarily paused while SMTP delivery is unavailable on free-tier hosting. Sign in with Google instead.
        </div>
      ) : (
        <>
          <p className="mt-2 font-['Space_Grotesk'] text-[13px] text-[#747878]">We will send you an email with a 6-digit reset code.</p>
          {state?.success ? (
            <div className="mt-8 rounded-md border border-[#22A06B]/30 bg-[#E3FCEF] p-4 text-[13px] text-[#22A06B]">{state.success}</div>
          ) : (
            <form action={formAction} className="mt-8 flex flex-col gap-4">
              <Input name="email" type="email" label="Work email" required />
              {state?.error && <p className="text-[12px] text-[#EF4444]">{state.error}</p>}
              <Button type="submit" loading={isPending}>Send reset code</Button>
            </form>
          )}
        </>
      )}
      <p className="mt-6 text-center text-[13px]">
        <Link href="/sign-in" className="text-[#747878] hover:text-[#1B1C18]">Back to sign in</Link>
      </p>
    </>
  );
}
