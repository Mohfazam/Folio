"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SupportPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    contactPhone: "",
    subject: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/support/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (res.ok && data.ok) {
        setStatusMessage({
          type: "success",
          text: "Thank you! Your inquiry was received. A confirmation has been sent to your email from support@foolioo.app.",
        });
        setFormData({ name: "", email: "", contactPhone: "", subject: "", message: "" });
      } else {
        setStatusMessage({ type: "error", text: data.error || "Failed to submit request." });
      }
    } catch {
      setStatusMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF9F2] text-[#1B1C18]">
      <header className="border-b border-[#EAE7DE] bg-[#FCFBF7] px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <Image src="/Foolioo.svg" alt="" width={28} height={32} className="h-7 w-auto" />
            <span className="font-['Newsreader'] text-[28px] font-medium italic tracking-[-1.4px]">
              foolioo<span className="text-[#FD7032]">.</span>
            </span>
          </Link>
          <div className="flex items-center gap-4 font-['Space_Grotesk'] text-[13px]">
            <Link href="/sign-in" className="text-[#55534F] hover:text-[#1B1C18]">
              Sign in
            </Link>
            <Link
              href="/"
              className="rounded-full border border-[#EAE7DE] bg-white px-4 py-1.5 font-medium hover:bg-[#F5F3EC]"
            >
              Back to home
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-6 py-12">
        <div className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#E7DEFF] bg-[#F4F0FF] px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7852D6]" />
            <span className="font-['Space_Grotesk'] text-[10px] font-semibold uppercase tracking-[1.2px] text-[#644ABB]">
              Customer Support
            </span>
          </div>
          <h1 className="font-['Newsreader'] text-[38px] font-normal leading-tight tracking-[-1px] sm:text-[44px]">
            How can we help<span className="text-[#FD7032]">?</span>
          </h1>
          <p className="mt-2 font-['Space_Grotesk'] text-[14px] text-[#747878]">
            Get in touch with our team. Support notifications are handled securely via{" "}
            <strong className="font-semibold text-[#1B1C18]">support@foolioo.app</strong>.
          </p>
        </div>

        {statusMessage && (
          <div
            role="status"
            className={`mb-6 rounded-lg border p-4 font-['Space_Grotesk'] text-[13px] leading-5 ${
              statusMessage.type === "success"
                ? "border-[#22A06B]/25 bg-[#EAF8F1] text-[#18794E]"
                : "border-[#EF4444]/25 bg-[#FFF1F0] text-[#B42318]"
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        <div className="rounded-2xl border border-[#EAE7DE] bg-white p-6 shadow-sm sm:p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              id="name"
              label="Your name"
              placeholder="Aarav Sharma"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />

            <Input
              id="email"
              type="email"
              label="Email address"
              placeholder="you@company.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />

            <Input
              id="contactPhone"
              type="tel"
              label="Phone number (optional)"
              placeholder="+91 98765 43210"
              value={formData.contactPhone}
              onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
            />

            <Input
              id="subject"
              label="Subject"
              placeholder="e.g. Question about call routing or enterprise plan"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              required
            />

            <div className="flex flex-col gap-1.5">
              <label htmlFor="message" className="font-['Space_Grotesk'] text-[13px] font-medium text-[#1B1C18]">
                Message
              </label>
              <textarea
                id="message"
                rows={4}
                placeholder="Describe your issue or question in detail..."
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full rounded-md border border-[#E9E8E1] bg-white p-3 font-['Space_Grotesk'] text-[13px] text-[#1B1C18] placeholder-[#747878] shadow-xs outline-none transition focus:border-[#1B1C18]"
                required
              />
            </div>

            <div className="pt-2">
              <Button type="submit" loading={loading}>
                {loading ? "Submitting request…" : "Submit Support Request"}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
