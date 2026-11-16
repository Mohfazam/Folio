import Link from "next/link";

export default function VerifyEmailPage() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-[420px] flex-col justify-center px-6 py-12 text-center">
      <p className="font-['Space_Grotesk'] text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9A8ABF]">
        Account access
      </p>
      <h1 className="mt-3 font-['Newsreader'] text-[36px] leading-tight text-[#1B1C18]">
        Verification is disabled
      </h1>
      <p className="mt-3 font-['Space_Grotesk'] text-[13px] leading-6 text-[#747878]">
        Foolioo is not using email or phone OTP verification right now. Continue to sign in with your email and password.
      </p>
      <Link
        href="/sign-in"
        className="mt-7 inline-flex min-h-11 items-center justify-center rounded-md bg-[#1B1C18] px-5 font-['Space_Grotesk'] text-[13px] font-semibold text-white hover:bg-[#34352F]"
      >
        Go to sign in
      </Link>
    </main>
  );
}
