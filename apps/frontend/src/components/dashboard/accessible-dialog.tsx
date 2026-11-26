"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function useDialogFocusTrap(
  open: boolean,
  containerRef: React.RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const frame = window.requestAnimationFrame(() => {
      const root = containerRef.current;
      if (!root) return;
      const focusables = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      const target =
        focusables.find((el) => el.dataset.autofocus === "true") ?? focusables[0] ?? root;
      target?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;
      const root = containerRef.current;
      if (!root) return;

      const focusables = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === first || !root.contains(document.activeElement)) {
          event.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last || !root.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      const prev = previouslyFocusedRef.current;
      if (prev && prev.isConnected) {
        window.requestAnimationFrame(() => prev.focus());
      }
    };
  }, [open, containerRef]);
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useDialogFocusTrap(open, dialogRef, () => {
    if (!busy) onCancel();
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#1B1C18]/35 px-4 py-8 backdrop-blur-[1px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        tabIndex={-1}
        className="w-full max-w-[420px] rounded-[10px] border border-[#E9E8E1] bg-white p-5 shadow-[0_20px_64px_rgba(27,28,24,0.22)] outline-none sm:p-6"
      >
        <p className="font-['Space_Grotesk'] text-[12px] font-bold uppercase tracking-[0.09em] text-[#A33A32]">
          CONFIRM ACTION
        </p>
        <h2
          id="confirm-dialog-title"
          className="mt-1 font-['Newsreader'] text-[24px] leading-tight text-[#1B1C18]"
        >
          {title}
        </h2>
        <p
          id="confirm-dialog-desc"
          className="mt-2 font-['Space_Grotesk'] text-[14px] leading-[1.55] text-[#666A68]"
        >
          {description}
        </p>
        <div className="mt-6 flex justify-end gap-2 border-t border-[#ECEBE5] pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-[5px] border border-[#DCDDD6] bg-white px-4 py-2 font-['Space_Grotesk'] text-[13px] font-semibold text-[#444748] transition hover:bg-[#F5F4ED] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            data-autofocus="true"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-[5px] bg-[#A33A32] px-4 py-2 font-['Space_Grotesk'] text-[13px] font-semibold text-white transition hover:bg-[#8A2E27] disabled:opacity-50"
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
