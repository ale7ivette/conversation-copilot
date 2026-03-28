"use client";

import { useMemo } from "react";
import type { TranscriptLine } from "@/lib/transcript-buffer";

const PEEK_LINES = 4;
const FADE_AGE_MS = 30_000;

type TranscriptPeekProps = {
  lines: TranscriptLine[];
  liveLine?: string;
  onViewFull: () => void;
  className?: string;
};

function prefixFor(line: TranscriptLine): string {
  if (line.speaker === "me") return "You: ";
  if (line.speaker === "other") return "Them: ";
  return "";
}

export function TranscriptPeek({
  lines,
  liveLine = "",
  onViewFull,
  className = "",
}: TranscriptPeekProps) {
  const now = Date.now();
  const slice = useMemo(
    () => lines.slice(-PEEK_LINES),
    [lines]
  );
  const showLive = liveLine.trim().length > 0;

  return (
    <section
      className={`flex min-h-0 flex-1 flex-col rounded-2xl border border-[var(--copilot-border)] bg-[var(--copilot-surface-2)] p-4 ${className}`}
    >
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <h2 className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--copilot-muted)]">
          Context
        </h2>
        <button
          type="button"
          onClick={onViewFull}
          className="text-[11px] font-medium text-[var(--copilot-accent)] transition-opacity hover:opacity-90"
        >
          View full transcript
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain">
        {slice.length === 0 && !showLive ? (
          <p className="py-6 text-center text-[13px] text-[var(--copilot-muted)]">
            Transcript will build as people speak.
          </p>
        ) : (
          <>
            {slice.map((line, idx) => {
              const isLatest =
                idx === slice.length - 1 && !showLive;
              const age = now - line.timestamp;
              const faded = age > FADE_AGE_MS;
              return (
                <p
                  key={`${line.timestamp}-${idx}-${line.text.slice(0, 6)}`}
                  className={`border-l-2 pl-2.5 text-[13px] leading-relaxed transition-opacity duration-200 ${
                    isLatest
                      ? "border-[var(--copilot-accent)] text-[var(--copilot-fg-secondary)]"
                      : "border-transparent text-[var(--copilot-fg-secondary)]"
                  } ${faded ? "opacity-[0.3]" : "opacity-100"}`}
                >
                  <span className="text-[var(--copilot-muted)]">
                    {prefixFor(line)}
                  </span>
                  {line.text}
                </p>
              );
            })}
            {showLive && (
              <p className="border-l-2 border-[var(--copilot-accent)] pl-2.5 text-[13px] leading-relaxed text-[var(--copilot-fg-secondary)] opacity-90">
                <span className="text-[var(--copilot-muted)]">Listening… </span>
                <span className="whitespace-pre-wrap">{liveLine}</span>
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
