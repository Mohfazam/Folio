export const Hero_top_right = () => {
    return (
        <div className="flex h-24.5 w-[256px] -rotate-3 flex-col justify-between rounded-lg border border-white bg-white p-3 shadow-[0px_8px_10px_-6px_rgba(0,0,0,0.1),0px_20px_25px_-5px_rgba(0,0,0,0.1)]">
            {/* Client identity */}
            <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E9E8E1]">
                    <span className="font-['Space_Grotesk'] text-[12px] font-bold leading-none text-[#1B1C18]">
                        AM
                    </span>
                </div>

                <div className="flex min-w-0 flex-col">
                    <p className="font-['Space_Grotesk'] text-[12px] font-medium leading-3.75 text-[#1B1C18]">
                        Ananya Mehta
                    </p>

                    <p className="whitespace-nowrap font-['Space_Grotesk'] text-[10px] font-normal leading-3.25 text-[#747878]">
                        VP Operations, Guild Real Estate
                    </p>
                </div>
            </div>

            <p className="font-['Newsreader'] text-[13px] font-normal italic leading-[17.88px] text-[#444748]">
                &ldquo;We processed 1,840 prospective tenants without hiring an outsourced call center.&rdquo;
            </p>
        </div>
    );
};