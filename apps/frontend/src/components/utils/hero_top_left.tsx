export const Hero_top_left = () => {
    return (
        <div className="flex w-[260px] rotate-3 flex-col gap-2 rounded-lg border border-white bg-white p-3 shadow-[0px_8px_10px_-6px_rgba(0,0,0,0.1),0px_20px_25px_-5px_rgba(0,0,0,0.1)]">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22A06B] opacity-75"></span>
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22A06B]"></span>
                    </span>
                    <span className="font-['Space_Grotesk'] text-[11px] font-medium text-[#22A06B]">
                        Live Telemetry
                    </span>
                </div>
                <span className="rounded bg-[#F5F3EC] px-1.5 py-0.5 font-['Space_Grotesk'] text-[10px] font-medium text-[#747878]">
                    240ms latency
                </span>
            </div>

            <div>
                <p className="font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18]">
                    Outbound Agent #04
                </p>
                <p className="font-['Space_Grotesk'] text-[10px] text-[#747878]">
                    Strict script adherence • Outbound lead qualification
                </p>
            </div>

            <div className="flex items-center gap-1 border-t border-[#E9E8E1] pt-1.5">
                <span className="rounded bg-[#E3FCEF] px-1.5 py-0.5 font-['Space_Grotesk'] text-[10px] font-medium text-[#22A06B]">
                    ✓ Strict Guardrails
                </span>
                <span className="rounded bg-[#F5F3EC] px-1.5 py-0.5 font-['Space_Grotesk'] text-[10px] font-medium text-[#444748]">
                    Rule-Bound Flow
                </span>
            </div>
        </div>
    );
};