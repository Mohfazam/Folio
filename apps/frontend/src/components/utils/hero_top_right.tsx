export const Hero_top_right = () => {
  return (
    <div className="flex h-24.5 w-[262px] -rotate-3 flex-col justify-between rounded-lg border border-white bg-white p-3 shadow-[0px_8px_10px_-6px_rgba(0,0,0,0.1),0px_20px_25px_-5px_rgba(0,0,0,0.1)]">
      {/* Client identity */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E9E8E1]">
          <span className="font-['Space_Grotesk'] text-[12px] font-bold leading-none text-[#1B1C18]">
            VJ
          </span>
        </div>

        <div className="flex min-w-0 flex-col">
          <p className="font-['Space_Grotesk'] text-[12px] font-medium leading-3.75 text-[#1B1C18]">
            Vikram Joshi
          </p>

          <p className="whitespace-nowrap font-['Space_Grotesk'] text-[10px] font-normal leading-3.25 text-[#525552]">
            Founder, PrimeEdge Clinics
          </p>
        </div>
      </div>

      <p className="font-['Newsreader'] text-[13px] font-normal italic leading-[17.5px] text-[#353732]">
        &ldquo;We called 920 patient enquiries in 48 hours without expanding our front desk.&rdquo;
      </p>
    </div>
  );
};
