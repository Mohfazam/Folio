import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import PublicDemoExperience from "@/components/public-demo/public-demo-experience";
import { getDashboardAuthContext } from "@/lib/auth/dashboard-request";

export const metadata: Metadata = {
  title: "Experience the Foolioo AI receptionist",
  description: "Try a live AI receptionist experience from Foolioo.",
};

async function getIsAuthenticated(): Promise<boolean> {
  try {
    const authContext = await getDashboardAuthContext();
    return Boolean(authContext?.userId);
  } catch {
    return false;
  }
}

export default async function LiveDemoPage() {
  const isLoggedIn = await getIsAuthenticated();

  return (
    <main className="flex min-h-screen flex-col bg-[#F7F5EF] text-[#1B1C18] lg:h-dvh lg:overflow-hidden">
      {/* HEADER */}
      <header className="flex h-[54px] shrink-0 items-center justify-between border-b border-[#E8E3D8] px-5 sm:px-8 lg:px-12 xl:px-16 [@media(min-height:840px)]:h-[68px]">
        <div className="flex items-center gap-3.5 xl:gap-4">
          <Link
            href="/"
            aria-label="Foolioo home"
            className="group inline-flex shrink-0 items-center gap-[9px] rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDAD86] focus-visible:ring-offset-4"
          >
            <Image
              src="/Foolioo.svg"
              alt=""
              aria-hidden="true"
              width={29}
              height={34}
              priority
              className="h-[26px] w-[22px] object-contain transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-[1.04] [@media(min-height:840px)]:h-[33px] [@media(min-height:840px)]:w-[28px]"
            />
            <span className="relative -mt-0.5 inline-flex items-baseline font-['Newsreader'] text-[25px] font-medium italic leading-none tracking-[-1.4px] text-[#24231F] transition-colors duration-200 group-hover:text-[#FD7032] [@media(min-height:840px)]:text-[31px]">
              foolioo
              <span className="ml-[1px] not-italic text-[#FD7032]">.</span>
            </span>
          </Link>

          <div className="hidden h-5 w-px bg-[#E8E3D8] sm:block" />

          <span className="hidden rounded-full border border-[#E6DCCB] px-2.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[1.3px] text-[#77736A] sm:inline-block [@media(min-height:840px)]:px-3 [@media(min-height:840px)]:py-1 [@media(min-height:840px)]:text-[10px]">
            Live demo
          </span>
        </div>

        {isLoggedIn ? (
          <Link
            href="/dashboard"
            className="text-[12px] font-semibold text-[#55534F] transition hover:text-[#FD7032] xl:text-[13px]"
          >
            Go to dashboard <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <Link
            href="/sign-up"
            className="text-[12px] font-semibold text-[#55534F] transition hover:text-[#FD7032] xl:text-[13px]"
          >
            Create an account <span aria-hidden="true">→</span>
          </Link>
        )}
      </header>

      {/* MAIN CONTENT AREA */}
      <div className="relative flex flex-1 flex-col justify-center lg:min-h-0 lg:overflow-hidden">
        <PublicDemoExperience isLoggedIn={isLoggedIn} />
      </div>

      {/* FOOTER */}
      <footer className="flex w-full shrink-0 flex-col gap-1 border-t border-[#E8E3D8] px-5 py-2.5 text-[10.5px] leading-4 text-[#77736A] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12 lg:py-2 xl:px-16 [@media(min-height:840px)]:py-3.5 [@media(min-height:840px)]:text-[11px]">
        <p>
          Foolioo AI receptionist showcase. Calls are initiated only after your explicit
          confirmation.
        </p>
        <div className="flex gap-4">
          <Link href="/privacy" className="hover:text-[#1B1C18]">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-[#1B1C18]">
            Terms
          </Link>
        </div>
      </footer>
    </main>
  );
}
