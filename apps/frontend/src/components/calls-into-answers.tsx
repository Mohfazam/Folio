export const CallsIntoAnswers = () => {
  const cards = [
    {
      number: "01",
      accentClass: "bg-[#1B1C18]",
      title: "Call More Leads Faster",
      description:
        "Call hundreds of leads at once with smart pacing and automatic follow-up retries.",
      metric: "Up to 24x Faster Lead Contact",
      context: "Compared to dialing one by one",
    },
    {
      number: "02",
      accentClass: "bg-[#FD7032]",
      title: "Automatic Call Quality Checks",
      description:
        "Check every call automatically against your script and flag objections or missed steps right away.",
      metric: "99.2% Script Accuracy",
      context: "Across 14,200+ tracked calls",
    },
    {
      number: "03",
      accentClass: "bg-[#22A06B]",
      title: "Instant Summaries & CRM Sync",
      description:
        "Save clean call notes, booked meetings, and follow-up summaries to your CRM the moment a call ends.",
      metric: "<1s CRM Update After Hangup",
      context: "Zero manual post-call data entry",
    },
  ];

  return (
    <section
      id="resources"
      className="w-full scroll-mt-20 border-t border-[#E9E8E1] bg-[#FBF9F2] py-20 md:py-28"
    >
      <div className="mx-auto w-full max-w-[1240px] px-6 md:px-10">
        <div className="flex flex-col items-center text-center">
          <span className="font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[1.5px] text-[#525552]">
            ALL-IN-ONE CALLING
          </span>
          <h2 className="mt-4 max-w-[640px]">
            <span className="block font-['Newsreader'] text-[36px] font-normal leading-[1.12] tracking-[-0.8px] text-[#1B1C18] sm:text-[46px] md:text-[52px]">
              Together, they turn calls into{" "}
              <span className="italic">answers.</span>
            </span>
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {cards.map((card) => (
            <div
              key={card.number}
              className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-[#E3DFD3] bg-white shadow-[0_4px_20px_rgba(27,28,24,0.03)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(27,28,24,0.07)]"
            >
              <div>
                <div className={`h-1 w-full ${card.accentClass}`} />
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-[#F5F3EC] px-2.5 py-1 font-['Space_Grotesk'] text-[11px] font-bold text-[#1B1C18] tabular-nums">
                      STEP {card.number}
                    </span>
                  </div>
                  <h3 className="mt-4 font-['Space_Grotesk'] text-[18px] font-bold tracking-tight text-[#1B1C18]">
                    {card.title}
                  </h3>
                  <p className="mt-2.5 font-['Space_Grotesk'] text-[14px] font-normal leading-[22px] text-[#525552]">
                    {card.description}
                  </p>
                </div>
              </div>

              <div className="border-t border-[#E9E8E1] bg-[#FCFBF8] px-6 py-4">
                <span className="inline-block rounded-md bg-white px-3 py-1 font-['Space_Grotesk'] text-[11.5px] font-bold text-[#1B1C18] ring-1 ring-[#E3DFD3] tabular-nums">
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
