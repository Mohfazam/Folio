"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TICKET_CATEGORIES = [
  "Complaint / Service Issue",
  "Bug / Technical Fault",
  "Billing & Credits",
  "Call Quality & Routing",
  "Enterprise / Custom Setup",
  "General Inquiry",
] as const;

type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export default function SupportPage() {
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    contactPhone: string;
    category: TicketCategory;
    subject: string;
    message: string;
  }>({
    name: "",
    email: "",
    contactPhone: "",
    category: "Complaint / Service Issue",
    subject: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
    ticketId?: string;
  } | null>(null);

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText("support@foolioo.app");
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch {
      setCopiedEmail(false);
    }
  };

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
          text:
            data.message ||
            "Your support ticket has been recorded. Our team will review your message and respond shortly.",
          ticketId: typeof data.ticketId === "string" ? data.ticketId : undefined,
        });
        setFormData({
          name: "",
          email: "",
          contactPhone: "",
          category: "Complaint / Service Issue",
          subject: "",
          message: "",
        });
      } else {
        setStatusMessage({
          type: "error",
          text: data.error || "Failed to submit support ticket.",
        });
      }
    } catch {
      setStatusMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF9F2] text-[#1B1C18]">
      <header className="border-b border-[#EAE7DE] bg-[#FCFBF7] px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <Image src="/Foolioo.svg" alt="" width={28} height={32} className="h-7 w-auto" />
            <span className="font-['Newsreader'] text-[28px] font-medium italic tracking-[-1.4px]">
              foolioo<span className="text-[#FD7032]">.</span>
            </span>
          </Link>
          <div className="flex items-center gap-4 font-['Space_Grotesk'] text-[13px]">
            <Link href="/sign-in" className="text-[#55534F] transition hover:text-[#1B1C18]">
              Sign in
            </Link>
            <Link
              href="/"
              className="rounded-full border border-[#EAE7DE] bg-white px-4 py-1.5 font-medium transition hover:bg-[#F5F3EC]"
            >
              Back to home
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 lg:py-14">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-start lg:gap-12">
          <aside className="lg:sticky lg:top-10 lg:col-span-5">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#EAE7DE] bg-[#F3EFE6] px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FD7032]" />
              <span className="font-['Space_Grotesk'] text-[10px] font-semibold uppercase tracking-[1.2px] text-[#1B1C18]">
                Support &amp; Complaints
              </span>
            </div>

            <h1 className="font-['Newsreader'] text-[40px] font-normal leading-[1.08] tracking-[-1px] sm:text-[46px]">
              How can we help<span className="text-[#FD7032]">?</span>
            </h1>

            <p className="mt-3 font-['Space_Grotesk'] text-[14px] leading-[22px] text-[#747878]">
              Raise a complaint, report a call or billing issue, or ask a question. Every submission is
              logged directly as an open ticket for our team.
            </p>

            <div className="mt-6 space-y-3 rounded-2xl border border-[#EAE7DE] bg-[#FCFBF7] p-5 font-['Space_Grotesk'] text-[13px]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.8px] text-[#747878]">
                    Direct Support Desk
                  </p>
                  <a
                    href="mailto:support@foolioo.app"
                    className="mt-0.5 inline-block font-semibold text-[#1B1C18] hover:underline"
                  >
                    support@foolioo.app
                  </a>
                </div>
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="rounded-full border border-[#EAE7DE] bg-white px-3 py-1 text-[12px] font-medium text-[#1B1C18] transition hover:bg-[#F5F3EC]"
                >
                  {copiedEmail ? "Copied" : "Copy"}
                </button>
              </div>

              <div className="border-t border-[#EAE7DE] pt-3 text-[#55534F]">
                <p className="font-medium text-[#1B1C18]">Include relevant context when possible</p>
                <p className="mt-0.5 text-[12px] leading-[18px] text-[#747878]">
                  Share campaign IDs, call IDs, or timestamps so our team can trace logs quickly.
                </p>
              </div>
            </div>
          </aside>

          <section className="lg:col-span-7">
            {statusMessage && (
              <div
                role="status"
                className={`mb-6 rounded-xl border p-4 font-['Space_Grotesk'] text-[13px] leading-5 ${
                  statusMessage.type === "success"
                    ? "border-[#22A06B]/25 bg-[#EAF8F1] text-[#18794E]"
                    : "border-[#EF4444]/25 bg-[#FFF1F0] text-[#B42318]"
                }`}
              >
                <p className="font-medium">{statusMessage.text}</p>
                {statusMessage.ticketId && (
                  <p className="mt-1.5 font-mono text-[11px] opacity-90">
                    Ticket ID: {statusMessage.ticketId}
                  </p>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-[#EAE7DE] bg-white p-6 shadow-xs sm:p-8">
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                    label="Work email"
                    placeholder="you@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <span className="font-['Space_Grotesk'] text-[13px] font-medium text-[#1B1C18]">
                    Category
                  </span>
                  <div
                    role="radiogroup"
                    aria-label="Category"
                    className="flex flex-wrap gap-2"
                  >
                    {TICKET_CATEGORIES.map((cat) => {
                      const active = formData.category === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setFormData({ ...formData, category: cat })}
                          className={`rounded-full border px-3.5 py-1.5 font-['Space_Grotesk'] text-[12px] font-medium transition ${
                            active
                              ? "border-[#1B1C18] bg-[#1B1C18] text-white"
                              : "border-[#EAE7DE] bg-[#FCFBF7] text-[#55534F] hover:border-[#D5D1C5] hover:text-[#1B1C18]"
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    id="subject"
                    label="Subject"
                    placeholder="e.g. Call dropped mid-conversation"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
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
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="message"
                    className="font-['Space_Grotesk'] text-[13px] font-medium text-[#1B1C18]"
                  >
                    Complaint / Message details
                  </label>
                  <textarea
                    id="message"
                    rows={5}
                    placeholder="Describe what happened, include any campaign or call IDs if relevant..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full resize-none rounded-md border border-[#E9E8E1] bg-white p-3 font-['Space_Grotesk'] text-[13px] leading-[20px] text-[#1B1C18] placeholder-[#747878] shadow-xs outline-none transition focus:border-[#1B1C18]"
                    required
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                  <p className="font-['Space_Grotesk'] text-[12px] text-[#747878]">
                    Logged directly to <span className="font-medium text-[#1B1C18]">support@foolioo.app</span>
                  </p>
                  <Button type="submit" loading={loading}>
                    {loading ? "Submitting ticket…" : "Submit Support Ticket"}
                  </Button>
                </div>
              </form>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}