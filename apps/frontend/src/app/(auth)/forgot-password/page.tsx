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
      <p className="mt-2 font-['Space_Grotesk'] text-[13px] text-[#747878]">
        {EMAIL_AUTH_DISABLED
          ? "Email password reset is temporarily disabled while email delivery is paused. Please sign in with Google."
          : "We will send you an email with a 6-digit reset code."}
      </p>

      {state?.success ? (
        <div className="mt-8 rounded-md border border-[#22A06B]/30 bg-[#E3FCEF] p-4 text-[13px] text-[#22A06B]">{state.success}</div>
      ) : (
        <form action={formAction} className="mt-8 flex flex-col gap-4">
          <Input name="email" type="email" label="Work email" disabled={EMAIL_AUTH_DISABLED} required />
          {state?.error && <p className="text-[12px] text-[#EF4444]">{state.error}</p>}
          <Button type="submit" loading={isPending} disabled={EMAIL_AUTH_DISABLED}>
            {EMAIL_AUTH_DISABLED ? "Email reset unavailable" : "Send reset code"}
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-[13px]">
        <Link href="/sign-in" className="text-[#747878] hover:text-[#1B1C18]">Back to sign in</Link>
      </p>
    </>
  );
}
