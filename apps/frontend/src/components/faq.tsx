"use client";

import { useState } from "react";

const FAQ_ITEMS = [
  {
    question: "Does Foolioo speak Hindi, Hinglish, and Indian English naturally?",
    answer:
      "Yes. Foolioo is tuned specifically for Indian callers—switching comfortably between Indian English, Hindi, and everyday Hinglish with fast response speed so conversations feel natural rather than robotic.",
  },
  {
    question: "Do unanswered or voicemail calls use up my credits?",
    answer:
      "No. Credits only count toward connected talk time (~1 credit per 10 seconds of live conversation). Ringing, busy lines, and unanswered dials do not drain your monthly credits.",
  },
  {
    question: "Can I call leads from my own business phone number?",
    answer:
      "Yes. On Pro and Scale plans, you can connect your own verified outbound business number so leads recognize your caller ID and call back directly.",
  },
  {
    question: "How quickly can I upload a CSV or Excel sheet and start calling?",
    answer:
      "Most teams launch their first outbound campaign in under 15 minutes. Upload your contact sheet, write or pick your call script, set your calling hours, and start dialing.",
  },
  {
    question: "What happens if a lead asks something off-script or asks for a human?",
    answer:
      "Built-in safety rules keep the agent from guessing or promising unauthorized discounts. If a lead asks an out-of-scope question or requests a person, Foolioo politely wraps up and immediately alerts your team with the full call summary and transcript.",
  },
];

export const Faq = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="w-full scroll-mt-20 border-t border-[#E9E8E1] bg-[#FBF9F2] py-20 md:py-24"
    >
      <div className="mx-auto w-full max-w-[860px] px-6 md:px-10">
        <div className="flex flex-col items-center text-center">
          <span className="font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[1.5px] text-[#525552]">
            COMMON QUESTIONS
          </span>
          <h2 className="mt-4">
            <span className="block font-['Newsreader'] text-[34px] font-normal leading-[1.14] tracking-[-0.7px] text-[#1B1C18] sm:text-[42px]">
              Everything you want to know{" "}
              <span className="italic">before starting.</span>
            </span>
          </h2>
        </div>

        <div className="mt-10 divide-y divide-[#E3DFD3] overflow-hidden rounded-2xl border border-[#E3DFD3] bg-white shadow-[0_4px_20px_rgba(27,28,24,0.03)]">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div key={item.question}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${idx}`}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-[#FCFBF8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FD7032]"
                >
                  <span className="font-['Space_Grotesk'] text-[15px] font-semibold leading-[1.4] text-[#1B1C18]">
                    {item.question}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#E3DFD3] bg-[#FBF9F2] text-[#1B1C18] transition-transform duration-200 ${
                      isOpen ? "rotate-45 border-[#1B1C18] bg-[#1B1C18] text-white" : ""
                    }`}
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    >
                      <path d="M12 5v14" />
                      <path d="M5 12h14" />
                    </svg>
                  </span>
                </button>

                {isOpen && (
                  <div
                    id={`faq-answer-${idx}`}
                    className="px-6 pb-5 pt-0.5 font-['Space_Grotesk'] text-[14px] leading-[22px] text-[#525552]"
                  >
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
