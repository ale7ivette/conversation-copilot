"use client";

import { useEffect, useState } from "react";
import type { CopilotSuggestion } from "@/types/copilot";
import type { TriggerReason } from "@/lib/trigger-engine";
import { triggerInsightLabel } from "@/lib/trigger-insight-copy";

type SuggestionPanelProps = {
  suggestion: CopilotSuggestion | null;
  lastSuggestionTrigger: TriggerReason | null;
  suggestionInFlight: boolean;
  className?: string;
};

function suggestionKey(s: CopilotSuggestion | null): string {
  if (!s) return "empty";
  return `${s.next_question}\0${s.suggested_reply}`;
}

function primaryBlock(
  suggestion: CopilotSuggestion,
  trigger: TriggerReason | null
): "ask" | "say" {
  const q = suggestion.next_question.trim();
  const r = suggestion.suggested_reply.trim();
  if (!q && r) return "say";
  if (!r && q) return "ask";
  if (trigger === "direct_question") return "ask";
  if (trigger === "objection") return "say";
  return "ask";
}

export function SuggestionPanel({
  suggestion,
  lastSuggestionTrigger,
  suggestionInFlight,
  className = "",
}: SuggestionPanelProps) {
  const incomingKey = suggestionKey(suggestion);
  const [shownKey, setShownKey] = useState(incomingKey);
  const [shownSuggestion, setShownSuggestion] = useState(suggestion);
  const [cardOpacity, setCardOpacity] = useState(1);

  useEffect(() => {
    if (incomingKey === shownKey) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduceMotion) {
      setShownKey(incomingKey);
      setShownSuggestion(suggestion);
      setCardOpacity(1);
      return;
    }
    setCardOpacity(0);
    const fadeMs = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--copilot-suggestion-fade-ms"
      ) || "200",
      10
    );
    const t = window.setTimeout(() => {
      setShownKey(incomingKey);
      setShownSuggestion(suggestion);
      requestAnimationFrame(() => setCardOpacity(1));
    }, fadeMs);
    return () => window.clearTimeout(t);
  }, [incomingKey, shownKey, suggestion]);

  const primary = shownSuggestion
    ? primaryBlock(shownSuggestion, lastSuggestionTrigger)
    : "ask";

  const insight =
    lastSuggestionTrigger && lastSuggestionTrigger !== "none"
      ? triggerInsightLabel(lastSuggestionTrigger)
      : null;

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${className}`}>
      <section
        className="flex min-h-[280px] flex-1 flex-col rounded-2xl border border-[var(--copilot-border)] bg-[var(--copilot-surface-elevated)] p-6 shadow-sm"
        style={{
          transition: `opacity var(--copilot-suggestion-fade-ms, 200ms) ease-out`,
          opacity: cardOpacity,
        }}
      >
        {shownSuggestion ? (
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-8">
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--copilot-muted)]">
                Ask
              </p>
              <p
                className={`leading-snug tracking-tight ${
                  primary === "ask"
                    ? "text-[24px] font-medium text-[var(--copilot-fg)]"
                    : "text-[19px] font-normal text-[var(--copilot-fg-secondary)] opacity-75"
                }`}
              >
                {shownSuggestion.next_question.trim() || "—"}
              </p>
            </div>
            <div className="h-px w-full bg-[var(--copilot-border)]" aria-hidden />
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--copilot-muted)]">
                Say
              </p>
              <p
                className={`leading-relaxed ${
                  primary === "say"
                    ? "text-[20px] font-medium text-[var(--copilot-fg)]"
                    : "text-[18px] font-normal text-[var(--copilot-fg-secondary)] opacity-75"
                }`}
              >
                {shownSuggestion.suggested_reply.trim() || "—"}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-2 text-center">
            <p className="max-w-sm text-[15px] leading-relaxed text-[var(--copilot-muted)]">
              Listening… suggestions will appear as the conversation develops.
            </p>
          </div>
        )}
      </section>

      {insight ? (
        <div className="mt-3 shrink-0">
          <span className="inline-block rounded-full bg-[var(--copilot-accent-muted)] px-3 py-1.5 text-[12px] font-medium text-[var(--copilot-accent)]">
            {insight}
          </span>
        </div>
      ) : null}

      {suggestionInFlight ? (
        <p className="mt-2 text-center text-[11px] text-[var(--copilot-muted)]">
          Updating suggestion…
        </p>
      ) : null}
    </div>
  );
}
