"use client";

export function ToastNotice({
  message,
  tone = "success",
  onDismiss,
}: {
  message: string | null | undefined;
  tone?: "success" | "error";
  onDismiss?: () => void;
}) {
  if (!message) return null;

  const isError = tone === "error";

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 md:bottom-6"
    >
      <div className="pointer-events-auto inline-flex max-w-[92vw] items-center gap-2.5 rounded-full border border-[#2C2E28] bg-[#1B1C18] px-4 py-2.5 font-['Space_Grotesk'] text-[12px] font-medium text-white shadow-[0_12px_32px_rgba(27,28,24,0.24)] transition-all duration-200">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${isError ? "bg-[#F87171]" : "bg-[#4ADE80]"}`}
          aria-hidden="true"
        />
        <span>{message}</span>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss notification"
            className="ml-1 rounded-full p-0.5 text-[#A6A89E] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6]"
          >
            ✕
          </button>
        ) : null}
      </div>
    </div>
  );
}
