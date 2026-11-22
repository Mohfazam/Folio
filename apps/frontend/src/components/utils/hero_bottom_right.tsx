export const Hero_bottom_right = () => {
    return (
        <div className="flex w-[240px] rotate-2 flex-col justify-between rounded-lg border border-white bg-white p-3 shadow-[0px_8px_10px_-6px_rgba(0,0,0,0.1),0px_20px_25px_-5px_rgba(0,0,0,0.1)]">
            <div className="flex items-center justify-between">
                <span className="font-['Space_Grotesk'] text-[10px] font-medium uppercase tracking-[0.5px] text-[#747878]">
                    ENTERPRISE READY
                </span>
                <span className="rounded bg-[#E3FCEF] px-1.5 py-0.5 font-['Space_Grotesk'] text-[10px] font-medium text-[#22A06B]">
                    99.95% Uptime
                </span>
            </div>

            <div className="mt-1 flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 1L2 3.5V7C2 10.5 4.5 13.8 8 15C11.5 13.8 14 10.5 14 7V3.5L8 1Z" stroke="#1B1C18" strokeWidth="1.5" strokeLinejoin="round"/>
                    <path d="M5.5 8L7 9.5L10.5 6" stroke="#22A06B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="font-['Space_Grotesk'] text-[13px] font-bold text-[#1B1C18]">
                    SOC-2 Type II Certified
                </span>
            </div>

            <p className="mt-1 font-['Space_Grotesk'] text-[10px] text-[#747878]">
                TRAI &amp; DPDP ready · Encrypted call logs
            </p>
        </div>
    );
};