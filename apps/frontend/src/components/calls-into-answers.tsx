export const CallsIntoAnswers = () => {
  const cards = [
    {
      number: "01",
      title: "High-Volume Outreach",
      description:
        "Scale your outbound calling operations with human-like cadence and deterministic reliability across thousands of contacts simultaneously.",
      metric: "Up to 24x Faster Lead Contact",
      context: "Parallel dialing vs. single-rep manual dialing",
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      ),
    },
    {
      number: "02",
      title: "Real-time Structured QA",
      description:
        "Grade every single conversation in real time against your compliance criteria. Instantly detect buyer objections and policy violations.",
      metric: "99.2% QA & Script Adherence",
      context: "Audited across 14,200+ production calls",
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      ),
    },
    {
      number: "03",
      title: "Automated Follow-up Summary",
      description:
        "Turn hours of call audio into structured CRM notes, calendar events, and follow-up emails dispatched immediately on hangup.",
      metric: "<1s Post-Call CRM Sync",
      context: "Instant webhook & disposition logging",
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
    },
  ];

  return (
    <section
      id="resources"
      className="w-full border-t border-[#E9E8E1] bg-[#FBF9F2] py-20 md:py-28"
    >
      <div className="mx-auto w-full max-w-[1240px] px-6 md:px-10">
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <span className="font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[1.5px] text-[#525552]">
            UNIFIED OPERATIONS
          </span>
          <h2 className="mt-4 max-w-[640px]">
            <span className="block font-['Newsreader'] text-[36px] font-normal leading-[1.12] tracking-[-0.8px] text-[#1B1C18] sm:text-[46px] md:text-[52px]">
              Together, they turn calls into{" "}
              <span className="italic">answers.</span>
            </span>
          </h2>
        </div>

        {/* 3 Large Cards Grid */}
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {cards.map((card) => (
            <div
              key={card.number}
              className="flex flex-col justify-between rounded-2xl border border-[#E3DFD3] bg-white p-6 shadow-[0_4px_20px_rgba(27,28,24,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(27,28,24,0.07)]"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#EAE6DC] bg-[#FBF9F2] text-[#1B1C18]">
                    {card.icon}
                  </span>
                  <span className="font-['Space_Grotesk'] text-[12px] font-bold text-[#525552] tabular-nums">
                    {card.number}
                  </span>
                </div>

                <h3 className="mt-5 font-['Space_Grotesk'] text-[18px] font-bold tracking-tight text-[#1B1C18]">
                  {card.title}
                </h3>
                <p className="mt-2.5 font-['Space_Grotesk'] text-[14px] font-normal leading-[22px] text-[#525552]">
                  {card.description}
                </p>
              </div>

              <div className="mt-6 border-t border-[#E9E8E1] pt-4">
                <span className="inline-block rounded-md bg-[#F5F3EC] px-3 py-1 font-['Space_Grotesk'] text-[11.5px] font-bold text-[#1B1C18] tabular-nums">
                  {card.metric}
                </span>
                <p className="mt-1.5 font-['Space_Grotesk'] text-[11px] text-[#525552]">
                  {card.context}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
