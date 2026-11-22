export const Hero_bottom_left = () => {
    return (
        <div className="flex w-[240px] -rotate-2 flex-col justify-between rounded-lg border border-white bg-white p-3 shadow-[0px_8px_10px_-6px_rgba(0,0,0,0.1),0px_20px_25px_-5px_rgba(0,0,0,0.1)]">
            <div className="flex items-center justify-between">
                <span className="font-['Space_Grotesk'] text-[10px] font-medium uppercase tracking-[0.5px] text-[#747878]">
                    EFFECTIVE COST
                </span>
                <span className="rounded bg-[#E3FCEF] px-1.5 py-0.5 font-['Space_Grotesk'] text-[10px] font-medium text-[#22A06B]">
                    ~77% vs call center
                </span>
            </div>

            <div className="mt-1 flex items-baseline gap-2">
                <span className="font-['Space_Grotesk'] text-[24px] font-bold leading-tight text-[#1B1C18]">
                    ₹4.20
                </span>
                <span className="font-['Space_Grotesk'] text-[11px] text-[#747878]">
                    / minute
                </span>
            </div>

            <p className="mt-1 font-['Space_Grotesk'] text-[10px] text-[#747878]">
                vs outsourced rep (₹18/min) · 14,200+ calls
            </p>
        </div>
    );
};