"use client";

import {
  COPILOT_SCENARIOS,
  type CopilotScenario,
  SCENARIO_LABELS,
} from "@/lib/copilot-scenario";

type ConversationTypeControlProps = {
  value: CopilotScenario;
  onChange: (next: CopilotScenario) => void;
  disabled?: boolean;
  className?: string;
};

export function ConversationTypeControl({
  value,
  onChange,
  disabled,
  className = "",
}: ConversationTypeControlProps) {
  return (
    <div className={`flex flex-col items-stretch gap-2 sm:items-end ${className}`}>
      <p
        className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-[var(--copilot-muted)] sm:hidden"
        id="conversation-type-label-mobile"
      >
        Conversation type
      </p>
      <div
        className="hidden flex-wrap justify-end gap-1 sm:flex"
        role="radiogroup"
        aria-label="Conversation type"
      >
        {COPILOT_SCENARIOS.map((id) => {
          const selected = value === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(id)}
              className={`rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium transition-colors sm:text-center ${
                selected
                  ? "bg-[var(--copilot-accent-muted)] text-[var(--copilot-accent)] ring-1 ring-[var(--copilot-accent)]/35"
                  : "bg-[var(--copilot-surface-2)] text-[var(--copilot-fg-secondary)] hover:bg-[var(--copilot-border)]/40"
              } disabled:opacity-45`}
            >
              {SCENARIO_LABELS[id]}
            </button>
          );
        })}
      </div>
      <label className="sm:sr-only">
        <select
          aria-label="Conversation type"
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value as CopilotScenario)}
          className="w-full rounded-xl border border-[var(--copilot-border)] bg-[var(--copilot-surface-elevated)] px-3 py-2 text-sm text-[var(--copilot-fg)] sm:hidden"
        >
          {COPILOT_SCENARIOS.map((id) => (
            <option key={id} value={id}>
              {SCENARIO_LABELS[id]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
