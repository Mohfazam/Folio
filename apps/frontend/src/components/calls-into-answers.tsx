export const CallsIntoAnswers = () => {
  const pillars = [
    {
      index: "01",
      stat: "Up to 24x",
      statLabel: "faster lead outreach",
      title: "Dial lists without manual bottlenecks",
      description:
        "Upload leads, set calling hours, and run parallel outbound calls with automatic retries on unanswered numbers.",
    },
    {
      index: "02",
      stat: "99.2%",
      statLabel: "script adherence",
      title: "Keep every conversation on script",
      description:
        "Every call follows your approved rules and safety limits, flagging objections and policy checks automatically.",
    },
    {
      index: "03",
      stat: "< 1 sec",
      statLabel: "CRM & note sync",
      title: "Turn call audio into clear next steps",
      description:
        "Summaries, call outcomes, and booked times land in your CRM and team notes as soon as the call ends.",
    },
  ];

  return (
    <section
      id="resources"
      className="w-full scroll-mt-20 border-t border-[#E9E8E1] bg-[#FBF9F2] py-20 md:py-28"
    >
      <div className="mx-auto w-full max-w-[1240px] px-6 md:px-10">
        <div className="max-w-[640px]">
          <span className="font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[1.5px] text-[#525552]">
            HOW IT HELPS YOUR TEAM
          </span>
          <h2 className="mt-3">
            <span className="block font-['Newsreader'] text-[36px] font-normal leading-[1.12] tracking-[-0.8px] text-[#1B1C18] sm:text-[46px] md:text-[52px]">
              Less busywork after{" "}
              <span className="italic">every call.</span>
            </span>
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 divide-y divide-[#E3DFD3] border-t border-b border-[#E3DFD3] md:grid-cols-3 md:divide-x md:divide-y-0">
          {pillars.map((pillar, idx) => (
            <div
              key={pillar.index}
              className={`flex flex-col justify-between py-8 md:py-9 ${
                idx === 0 ? "md:pr-8" : idx === 1 ? "md:px-8" : "md:pl-8"
              }`}
            >
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-['Space_Grotesk'] text-[28px] font-bold tracking-[-0.6px] text-[#1B1C18] tabular-nums">
                    {pillar.stat}
                  </span>
                  <span className="font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[1px] text-[#525552] tabular-nums">
                    {pillar.index}
                  </span>
                </div>
                <p className="mt-1 font-['Space_Grotesk'] text-[12px] font-medium text-[#525552]">
                  {pillar.statLabel}
                </p>

                <h3 className="mt-6 font-['Space_Grotesk'] text-[17px] font-semibold tracking-tight text-[#1B1C18]">
                  {pillar.title}
                </h3>
                <p className="mt-2 font-['Space_Grotesk'] text-[14px] leading-[22px] text-[#525552]">
                  {pillar.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};