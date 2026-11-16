export default function DashboardLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#E9E8E1] border-t-[#7852D6]" />
        <p className="font-['Space_Grotesk'] text-[13px] text-[#747878]">Loading…</p>
      </div>
    </div>
  );
}
