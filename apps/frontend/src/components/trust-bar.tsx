export const TrustBar = () => {
  const logos = [
    {
      name: "ADVANCED",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <polygon points="12 2 2 22 22 22" />
          <line x1="7" y1="15" x2="17" y2="15" />
        </svg>
      ),
    },
    {
      name: "MODERNA Health",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      ),
    },
    {
      name: "GUILD REALTY",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      name: "SENTRY CLAIMS",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
    },
    {
      name: "PARAMOUNT SERVICES",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <polygon points="10 8 16 12 10 16 10 8" />
        </svg>
      ),
    },
  ];

  return (
    <section
      id="customers"
      className="w-full scroll-mt-20 border-t border-b border-[#E9E8E1] bg-[#FBF9F2] py-14 md:py-16"
    >
      <div className="mx-auto max-w-[1240px] px-6 md:px-10">
        <div className="text-center">
          <p className="font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[1.2px] text-[#525552]">
            Trusted by sales and operations teams at growing companies
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-10 gap-y-5 md:gap-x-14 lg:gap-x-16">
            {logos.map((logo) => (
              <div
                key={logo.name}
                className="flex h-8 items-center gap-2.5 text-[#525552] opacity-80 transition-opacity duration-200 hover:opacity-100"
              >
                <span className="text-[#1B1C18]">{logo.icon}</span>
                <span className="font-['Space_Grotesk'] text-[13px] font-bold tracking-[0.08em] text-[#1B1C18]">
                  {logo.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Dedicated Editorial Customer Quote */}
        <div className="mx-auto mt-10 max-w-[880px] rounded-2xl border border-[#E3DFD3] bg-white px-6 py-5 shadow-[0_4px_20px_rgba(27,28,24,0.03)] sm:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="max-w-[580px]">
              <p className="font-['Newsreader'] text-[19px] font-normal italic leading-[1.35] text-[#1B1C18]">
                &ldquo;We processed 1,840 prospective leads without hiring an outsourced call center.&rdquo;
              </p>
              <div className="mt-2.5 flex items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E9E8E1] font-['Space_Grotesk'] text-[11px] font-bold text-[#1B1C18]">
                  AM
                </span>
                <span className="font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18]">
                  Ananya Mehta
                </span>
                <span className="font-['Space_Grotesk'] text-[12px] text-[#525552]">
                  · VP Operations, Guild Real Estate
                </span>
              </div>
            </div>
            <div className="shrink-0 rounded-xl border border-[#EAE6DC] bg-[#FBF9F2] px-4 py-2.5 text-left sm:text-right">
              <p className="font-['Space_Grotesk'] text-[16px] font-bold text-[#1B1C18] tabular-nums">
                1,840 leads
              </p>
              <p className="font-['Space_Grotesk'] text-[11px] text-[#525552]">
                ~77% lower cost vs. BPO
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
