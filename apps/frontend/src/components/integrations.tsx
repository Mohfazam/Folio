export const Integrations = () => {
  const integrations = [
    {
      name: "Sheets & CSV",
      description: "Upload lead lists in seconds",
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18" />
          <path d="M3 15h18" />
          <path d="M9 3v18" />
        </svg>
      ),
    },
    {
      name: "WhatsApp",
      description: "Follow-ups & hot lead alerts",
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22A06B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      ),
    },
    {
      name: "Google Calendar",
      description: "Auto-book visits & demos",
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <path d="m9 16 2 2 4-4" />
        </svg>
      ),
    },
    {
      name: "Zoho CRM",
      description: "Two-way lead & deal sync",
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="8" height="8" rx="1.5" />
          <rect x="13" y="4" width="8" height="8" rx="1.5" stroke="#2563EB" />
          <rect x="3" y="14" width="8" height="6" rx="1.5" stroke="#16A34A" />
          <rect x="13" y="14" width="8" height="6" rx="1.5" stroke="#D97706" />
        </svg>
      ),
    },
    {
      name: "HubSpot",
      description: "Contacts, notes & call logs",
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="#FF7A59" aria-hidden="true">
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="4" r="2.5" />
          <circle cx="19" cy="8" r="2" />
          <line x1="12" y1="6.5" x2="12" y2="7" stroke="#FF7A59" strokeWidth="2" />
        </svg>
      ),
    },
    {
      name: "Webhooks & API",
      description: "Connect any custom tool",
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1B1C18" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      ),
    },
  ];

  return (
    <section className="w-full border-t border-[#E9E8E1] bg-[#FBF9F2] py-20 md:py-28">
      <div className="mx-auto w-full max-w-[1240px] px-6 md:px-10">
        <div className="flex flex-col items-center text-center">
          <span className="font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[1.5px] text-[#525552]">
            INTEGRATIONS
          </span>
          <h2 className="mt-4 max-w-[620px]">
            <span className="block font-['Newsreader'] text-[36px] font-normal leading-[1.12] tracking-[-0.8px] text-[#1B1C18] sm:text-[46px] md:text-[52px]">
              Works with the tools your{" "}
              <span className="italic">team already uses.</span>
            </span>
          </h2>
          <p className="mt-4 max-w-[54ch] font-['Space_Grotesk'] text-[14.5px] font-normal leading-[23px] tracking-[0.1px] text-[#525552] md:text-[15px]">
            Upload leads from spreadsheets and push call outcomes, recordings, and booked slots straight into your calendar, WhatsApp, or CRM.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {integrations.map((item) => (
            <div
              key={item.name}
              className="flex flex-col items-center justify-center rounded-2xl border border-[#E3DFD3] bg-white p-6 text-center shadow-[0_2px_10px_rgba(27,28,24,0.025)] transition-all duration-200 hover:-translate-y-1 hover:border-[#FD7032]/60 hover:shadow-[0_10px_24px_rgba(27,28,24,0.06)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#EAE6DC] bg-[#FBF9F2]">
                {item.icon}
              </div>
              <p className="mt-3.5 font-['Space_Grotesk'] text-[14px] font-bold text-[#1B1C18]">
                {item.name}
              </p>
              <p className="mt-1 font-['Space_Grotesk'] text-[11.5px] text-[#525552]">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
