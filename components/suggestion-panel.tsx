"use client";

import { useEffect, useState } from "react";
import type { CopilotScenario } from "@/lib/copilot-scenario";
import type { SuggestionTiming } from "@/lib/suggestion-timing";
import type { CopilotSuggestion } from "@/types/copilot";
import type { TriggerReason } from "@/lib/trigger-engine";
import { triggerInsightLabel } from "@/lib/trigger-insight-copy";

type SuggestionPanelProps = {
  suggestion: CopilotSuggestion | null;
  lastSuggestionTrigger: TriggerReason | null;
  suggestionInFlight: boolean;
  scenario: CopilotScenario;
  autoShiftNote?: string | null;
  suggestionTiming?: SuggestionTiming;
  /** When true and timing is manual, show the on-demand button. */
  showSuggestNow?: boolean;
  onSuggestNow?: () => void;
  className?: string;
};

function suggestionKey(s: CopilotSuggestion | null): string {
  if (!s) return "empty";
  const ad = s.autoDetails;
  return `${s.next_question}\0${s.suggested_reply}\0${ad?.detected_conversation_type ?? ""}\0${ad?.primary_voice ?? ""}`;
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
  if (trigger === "manual") return "ask";
  return "ask";
}

function ListBlock({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-[0.65rem] font-medium uppercase tracking-[0.1em] text-[var(--copilot-muted)]">
        {title}
      </p>
      <ul className="list-inside list-disc space-y-1.5 text-[13px] leading-relaxed text-[var(--copilot-fg-secondary)]">
        {items.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

export function SuggestionPanel({
  suggestion,
  lastSuggestionTrigger,
  suggestionInFlight,
  scenario,
  autoShiftNote = null,
  suggestionTiming = "auto",
  showSuggestNow = false,
  onSuggestNow,
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

  const triggerInsight =
    lastSuggestionTrigger && lastSuggestionTrigger !== "none"
      ? triggerInsightLabel(lastSuggestionTrigger)
      : null;

  const ad = shownSuggestion?.autoDetails;
  const autoInsight =
    scenario === "auto" && ad
      ? `${ad.detected_conversation_type} · ${ad.primary_voice}`
      : null;

  const manualMode = suggestionTiming === "manual";
  const showManualCta = manualMode && showSuggestNow && onSuggestNow;

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${className}`}>
      {showManualCta ? (
        <button
          type="button"
          onClick={onSuggestNow}
          disabled={suggestionInFlight}
          className="mb-3 w-full rounded-xl bg-[var(--copilot-accent)] px-4 py-3 text-sm font-semibold text-[#1a1508] shadow-sm transition-opacity disabled:opacity-50"
        >
          Suggest now
        </button>
      ) : null}

      {autoShiftNote ? (
        <p
          className="mb-2 rounded-lg border border-[var(--copilot-accent)]/30 bg-[var(--copilot-accent-muted)] px-3 py-2 text-center text-[11px] font-medium text-[var(--copilot-accent)]"
          role="status"
        >
          {autoShiftNote}
        </p>
      ) : null}

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
              {manualMode
                ? "Listening… tap Suggest now when you want questions or lines to say."
                : "Listening… suggestions will appear as the conversation develops."}
            </p>
          </div>
        )}
      </section>

      {triggerInsight ? (
        <div className="mt-3 shrink-0">
          <span className="inline-block rounded-full bg-[var(--copilot-accent-muted)] px-3 py-1.5 text-[12px] font-medium text-[var(--copilot-accent)]">
            {triggerInsight}
          </span>
        </div>
      ) : null}

      {autoInsight ? (
        <div className={triggerInsight ? "mt-2 shrink-0" : "mt-3 shrink-0"}>
          <span className="inline-block rounded-full border border-[var(--copilot-border)] bg-[var(--copilot-surface-2)] px-3 py-1.5 text-[11px] font-medium text-[var(--copilot-fg-secondary)]">
            {autoInsight}
          </span>
        </div>
      ) : null}

      {ad ? (
        <details className="group mt-3 shrink-0 rounded-xl border border-[var(--copilot-border)] bg-[var(--copilot-surface-2)] px-3 py-2">
          <summary className="cursor-pointer list-none text-[12px] font-medium text-[var(--copilot-fg-secondary)] marker:hidden [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <span
                className="text-[var(--copilot-muted)] transition-transform group-open:rotate-90"
                aria-hidden
              >
                ▸
              </span>
              Context (auto-detect)
            </span>
          </summary>
          <div className="mt-3 space-y-3 border-t border-[var(--copilot-border)] pt-3 text-[12px] text-[var(--copilot-fg-secondary)]">
            <p>
              <span className="text-[var(--copilot-muted)]">Type confidence </span>
              {Math.round(ad.confidence_conversation_type * 100)}%
              <span className="text-[var(--copilot-muted)]"> · Voice confidence </span>
              {Math.round(ad.confidence_primary_voice * 100)}%
            </p>
            <p className="text-[var(--copilot-muted)] leading-relaxed">
              {ad.rationale_one_line}
            </p>
            <ListBlock title="More ways to say" items={ad.say_options} />
            <ListBlock title="Questions to ask" items={ad.smart_questions} />
            <ListBlock title="Key moves" items={ad.key_moves} />
            {ad.clarifying_question.trim() ? (
              <p>
                <span className="font-medium text-[var(--copilot-fg)]">
                  Clarifying question for you:{" "}
                </span>
                {ad.clarifying_question}
              </p>
            ) : null}
          </div>
        </details>
      ) : null}

      {suggestionInFlight ? (
        <p className="mt-2 text-center text-[11px] text-[var(--copilot-muted)]">
          Updating suggestion…
        </p>
      ) : null}
    </div>
  );
}
