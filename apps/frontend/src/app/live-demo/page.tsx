import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import PublicDemoExperience from "@/components/public-demo/public-demo-experience";

export const metadata: Metadata = {
  title: "Experience the Foolioo AI receptionist",
  description: "Try a live AI receptionist experience from Foolioo. No account required.",
};

export default function LiveDemoPage() {
  return (
    // On mobile: standard flex column with natural height (allows scrolling).
    // On desktop (lg): locked to screen height with no page scrolling.
    <main className="flex min-h-screen flex-col bg-[#F7F5EF] text-[#1B1C18] lg:h-screen lg:overflow-hidden">
      {/* HEADER */}
      <header className="flex h-[76px] shrink-0 items-center justify-between border-b border-[#E8E3D8] px-5 sm:px-8 lg:px-14">
        <div className="flex items-center gap-4">
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
              className="h-[34px] w-[29px] object-contain transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-[1.04]"
            />
            <span className="relative -mt-0.5 inline-flex items-baseline font-['Newsreader'] text-[31px] font-medium italic leading-none tracking-[-1.55px] text-[#24231F] transition-colors duration-200 group-hover:text-[#FD7032]">
              foolioo
              <span className="ml-[1px] not-italic text-[#FD7032]">.</span>
            </span>
          </Link>

          <div className="hidden h-6 w-px bg-[#E8E3D8] sm:block" />

          <span className="hidden rounded-full border border-[#E6DCCB] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[1.3px] text-[#77736A] sm:inline-block">
            Live demo
          </span>
        </div>

        <Link
          href="/sign-up"
          className="text-[13px] font-semibold text-[#55534F] transition hover:text-[#FD7032]"
        >
          Create an account <span aria-hidden="true">→</span>
        </Link>
      </header>

      {/* MAIN CONTENT AREA */}
      {/* relative + flex + min-h-0 ensures the demo section fills exactly this
          middle region between header and footer, and scrolls internally on
          desktop without breaking out of the page. */}
      <div className="relative flex flex-1 flex-col lg:min-h-0 lg:overflow-hidden">
        <PublicDemoExperience />
      </div>

      {/* FOOTER */}
      <footer className="flex w-full shrink-0 flex-col gap-3 border-t border-[#E8E3D8] px-5 py-6 text-[11px] leading-5 text-[#77736A] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:py-4">
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