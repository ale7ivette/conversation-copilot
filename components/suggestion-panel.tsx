"use client";

import type { ReactNode } from "react";
import type { CopilotSuggestion } from "@/types/copilot";

type SuggestionPanelProps = {
  suggestion: CopilotSuggestion | null;
  className?: string;
};

export function SuggestionPanel({
  suggestion,
  className = "",
}: SuggestionPanelProps) {
  return (
    <section
      className={`flex min-h-0 flex-1 flex-col rounded-3xl border border-white/[0.07] bg-white/[0.035] p-5 backdrop-blur-sm ${className}`}
    >
      <div className="mb-4 shrink-0">
        <h2 className="text-lg font-semibold tracking-tight text-white/[0.95]">
          What to say next
        </h2>
        <p className="mt-1 text-xs text-white/45">Live suggestions from your transcript.</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
        {suggestion ? (
          <div className="space-y-5">
            <Field label="Next question" emphasized>
              {suggestion.next_question}
            </Field>
            <Field label="Suggested reply">{suggestion.suggested_reply}</Field>
            <div className="border-t border-white/[0.06] pt-4 space-y-4">
              <Field label="Goal">{suggestion.goal}</Field>
              <Field label="Risk flag">{suggestion.risk_flag}</Field>
              <Field label="Confidence">
                {(suggestion.confidence * 100).toFixed(0)}%
              </Field>
            </div>
          </div>
        ) : (
          <p className="py-10 text-center text-sm leading-relaxed text-white/40">
            Speak or pause — a suggestion will appear when the copilot triggers.
          </p>
        )}
      </div>
    </section>
  );
}

function Field({
  label,
  children,
  emphasized,
}: {
  label: string;
  children: ReactNode;
  emphasized?: boolean;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[0.65rem] font-medium uppercase tracking-[0.12em] text-white/40">
        {label}
      </p>
      <p
        className={
          emphasized
            ? "text-[17px] font-medium leading-snug text-white/[0.95]"
            : "text-[15px] leading-relaxed text-white/[0.88]"
        }
      >
        {children}
      </p>
    </div>
  );
}
