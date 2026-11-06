import type { Metadata } from "next";
import Link from "next/link";
import PublicDemoExperience from "@/components/public-demo/public-demo-experience";

export const metadata: Metadata = {
  title: "Experience the Foolioo AI receptionist",
  description: "Try a live AI receptionist experience from Foolioo. No account required.",
};

export default function LiveDemoPage() {
  return (
    <main className="min-h-screen bg-[#F7F5EF] text-[#1B1C18]">
      <header className="flex h-[76px] items-center justify-between border-b border-[#E8E3D8] px-5 sm:px-8 lg:px-14">
        <Link href="/" aria-label="Foolioo home" className="inline-flex items-center gap-2">
          <span className="font-[var(--font-newsreader)] text-[30px] italic tracking-[-1.4px]">foolioo<span className="text-[#FD7032]">.</span></span>
          <span className="rounded-full border border-[#E6DCCB] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[1.3px] text-[#77736A]">Live demo</span>
        </Link>
        <Link href="/sign-up" className="text-[13px] font-semibold text-[#55534F] transition hover:text-[#FD7032]">Create an account <span aria-hidden="true">↗</span></Link>
      </header>
      <PublicDemoExperience />
      <footer className="mx-auto flex max-w-6xl flex-col gap-3 border-t border-[#E8E3D8] px-5 py-6 text-[11px] leading-5 text-[#77736A] sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>Foolioo AI receptionist showcase. Calls are initiated only after your explicit confirmation.</p>
        <div className="flex gap-4"><Link href="/privacy" className="hover:text-[#1B1C18]">Privacy</Link><Link href="/terms" className="hover:text-[#1B1C18]">Terms</Link></div>
      </footer>
    </main>
  );
}
