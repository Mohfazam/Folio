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
      className="w-full border-t border-b border-[#E9E8E1] bg-[#FBF9F2] py-16 md:py-20"
    >
      <div className="mx-auto max-w-[1240px] px-6 md:px-10">
        {/* Editorial Customer Proof Card */}
        <div className="mx-auto max-w-[920px] rounded-2xl border border-[#E3DFD3] bg-white p-6 shadow-[0_6px_24px_rgba(27,28,24,0.04)] sm:p-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-[580px]">
              <p className="font-['Newsreader'] text-[21px] font-normal italic leading-[1.35] text-[#1B1C18] sm:text-[24px]">
                &ldquo;We processed 1,840 prospective tenants without hiring an outsourced call center—and every qualified visit synced straight into our CRM.&rdquo;
              </p>

              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E3DFD3] bg-[#F5F3EC]">
                  <span className="font-['Space_Grotesk'] text-[12px] font-bold text-[#1B1C18]">
                    AM
                  </span>
                </div>
                <div>
                  <p className="font-['Space_Grotesk'] text-[13px] font-bold text-[#1B1C18]">
                    Ananya Mehta
                  </p>
                  <p className="font-['Space_Grotesk'] text-[12px] text-[#525552]">
                    VP Operations, Guild Real Estate
                  </p>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-row gap-4 border-t border-[#E9E8E1] pt-4 md:flex-col md:border-l md:border-t-0 md:pl-7 md:pt-0">
              <div>
                <p className="font-['Space_Grotesk'] text-[24px] font-bold leading-none text-[#1B1C18] tabular-nums">
                  1,840
                </p>
                <p className="mt-1 font-['Space_Grotesk'] text-[11px] font-medium text-[#525552]">
                  Tenant leads qualified
                </p>
              </div>
              <div>
                <p className="font-['Space_Grotesk'] text-[24px] font-bold leading-none text-[#166534] tabular-nums">
                  ~77%
                </p>
                <p className="mt-1 font-['Space_Grotesk'] text-[11px] font-medium text-[#525552]">
                  Lower cost vs. BPO reps
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Standardized Monochrome Customer Logo Strip */}
        <div className="mt-12 text-center">
          <p className="font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[1.3px] text-[#525552]">
            Trusted by operations &amp; revenue teams at high-growth companies
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-10 gap-y-5 md:gap-x-14 lg:gap-x-16">
            {logos.map((logo) => (
              <div
                key={logo.name}
                className="flex h-8 items-center gap-2.5 text-[#525552] opacity-75 transition-opacity duration-200 hover:opacity-100"
              >
                <span className="text-[#1B1C18]">{logo.icon}</span>
                <span className="font-['Space_Grotesk'] text-[13px] font-bold tracking-[0.08em] text-[#1B1C18]">
                  {logo.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
