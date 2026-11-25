export const Integrations = () => {
  const integrations = [
    {
      name: "Salesforce",
      description: "Bidirectional CRM sync",
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="#00A1E0" aria-hidden="true">
          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
        </svg>
      ),
    },
    {
      name: "HubSpot",
      description: "Deals & contact updates",
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
      name: "Zendesk",
      description: "Automated ticket logs",
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="#03363D" aria-hidden="true">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15H8v-6h3v6zm5 0h-3V7h3v10z" />
        </svg>
      ),
    },
    {
      name: "Zapier",
      description: "5,000+ workflow triggers",
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="#FF4A00" aria-hidden="true">
          <path d="M13 2L4 14h7v8l9-12h-7z" />
        </svg>
      ),
    },
    {
      name: "Twilio",
      description: "Outbound voice trunking",
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="#F22F46" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="#F22F46" strokeWidth="2.5" fill="none" />
          <circle cx="9" cy="9" r="1.5" />
          <circle cx="15" cy="9" r="1.5" />
          <circle cx="9" cy="15" r="1.5" />
          <circle cx="15" cy="15" r="1.5" />
        </svg>
      ),
    },
    {
      name: "Slack",
      description: "Call alerts & summaries",
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 15a2 2 0 1 0-2 2h2v-2z" fill="#E01E5A" />
          <path d="M7 15a2 2 0 0 0 4 0V9a2 2 0 0 0-4 0v6z" fill="#E01E5A" />
          <path d="M9 6a2 2 0 1 0-2-2v2h2z" fill="#36C5F0" />
          <path d="M9 7a2 2 0 0 0 0 4h6a2 2 0 0 0 0-4H9z" fill="#36C5F0" />
          <path d="M18 9a2 2 0 1 0 2-2h-2v2z" fill="#2EB67D" />
          <path d="M17 9a2 2 0 0 0-4 0v6a2 2 0 0 0 4 0V9z" fill="#2EB67D" />
          <path d="M15 18a2 2 0 1 0 2 2v-2h-2z" fill="#ECB22E" />
          <path d="M15 17a2 2 0 0 0 0-4H9a2 2 0 0 0 0 4h6z" fill="#ECB22E" />
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
              Works with the tools you{" "}
              <span className="italic">already use.</span>
            </span>
          </h2>
          <p className="mt-4 max-w-[54ch] font-['Space_Grotesk'] text-[14.5px] font-normal leading-[23px] tracking-[0.1px] text-[#525552] md:text-[15px]">
            Push call outcomes, recordings, and lead fields straight into your CRM and team channels in real time.
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
