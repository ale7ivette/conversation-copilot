"use client";

import { useEffect, useRef } from "react";
import type { TranscriptLine } from "@/lib/transcript-buffer";

type TranscriptFullDrawerProps = {
  open: boolean;
  onClose: () => void;
  lines: TranscriptLine[];
  liveLine: string;
};

function linePrefix(line: TranscriptLine): string {
  if (line.speaker === "me") return "You";
  if (line.speaker === "other") return "Them";
  return "";
}

export function TranscriptFullDrawer({
  open,
  onClose,
  lines,
  liveLine,
}: TranscriptFullDrawerProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 10);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const showLive = liveLine.trim().length > 0;

  return (
    <div
      className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-6"
      style={{ zIndex: 40 }}
    >
      <button
        type="button"
        aria-label="Close transcript"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="copilot-transcript-full-title"
        className="relative flex max-h-[min(85dvh,640px)] w-full max-w-lg flex-col rounded-t-2xl border border-[var(--copilot-border)] bg-[var(--copilot-surface-elevated)] shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--copilot-border)] px-4 py-3">
          <h2
            id="copilot-transcript-full-title"
            className="text-sm font-medium text-[var(--copilot-fg)]"
          >
            Full transcript
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-[var(--copilot-muted)] transition-colors hover:bg-[var(--copilot-surface-2)] hover:text-[var(--copilot-fg-secondary)]"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          {lines.length === 0 && !showLive ? (
            <p className="py-8 text-center text-sm text-[var(--copilot-muted)]">
              Nothing captured yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {lines.map((line, i) => {
                const p = linePrefix(line);
                return (
                  <li key={`${line.timestamp}-${i}`}>
                    {p ? (
                      <span className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-[var(--copilot-muted)]">
                        {p}{" "}
                      </span>
                    ) : null}
                    <span className="text-[13px] leading-relaxed text-[var(--copilot-fg-secondary)]">
                      {line.text}
                    </span>
                  </li>
                );
              })}
              {showLive && (
                <li className="border-t border-dashed border-[var(--copilot-border)] pt-3">
                  <span className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-[var(--copilot-muted)]">
                    Listening…{" "}
                  </span>
                  <span className="text-[13px] leading-relaxed text-[var(--copilot-muted)] whitespace-pre-wrap">
                    {liveLine}
                  </span>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
