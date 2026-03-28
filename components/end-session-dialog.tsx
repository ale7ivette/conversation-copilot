"use client";

import { useEffect, useRef } from "react";

type EndSessionDialogProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function EndSessionDialog({
  open,
  onCancel,
  onConfirm,
}: EndSessionDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => cancelRef.current?.focus(), 10);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 80 }}
    >
      <button
        type="button"
        aria-label="Dismiss"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="end-session-title"
        className="relative w-full max-w-sm rounded-2xl border border-[var(--copilot-border)] bg-[var(--copilot-surface-elevated)] p-5 shadow-2xl"
      >
        <h2
          id="end-session-title"
          className="text-base font-medium text-[var(--copilot-fg)]"
        >
          End this session?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--copilot-muted)]">
          The live transcript will stop. You can start a new session anytime.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-2 text-sm font-medium text-[var(--copilot-fg-secondary)] transition-colors hover:bg-[var(--copilot-surface-2)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-[var(--copilot-surface-2)] px-4 py-2 text-sm font-medium text-[var(--copilot-fg)] ring-1 ring-[var(--copilot-border)] transition-colors hover:bg-[var(--copilot-border)]"
          >
            End session
          </button>
        </div>
      </div>
    </div>
  );
}
