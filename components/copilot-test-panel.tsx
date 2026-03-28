"use client";

import { useEffect, useState } from "react";
import { SUGGESTION_MIN_INTERVAL_MS } from "@/lib/copilot-settings";
import { DEFAULT_PAUSE_MS } from "@/lib/trigger-engine";

const PRESETS: { label: string; text: string; expect: string }[] = [
  {
    label: "Direct question",
    text: "What's the timeline for approval?",
    expect: "direct_question",
  },
  {
    label: "Budget / scope / timeline",
    text: "We should align on budget, scope, and timeline before signing.",
    expect: "price_budget_scope",
  },
  {
    label: "Objection",
    text: "I'm not sure we can commit at that price.",
    expect: "objection",
  },
  {
    label: "End of thought",
    text: "Thanks, let's reconnect on Friday.",
    expect: "thought_finished",
  },
  {
    label: "Concern + approval",
    text: "My concern is we need approval from finance first.",
    expect: "price_budget_scope",
  },
  {
    label: "Plain line",
    text: "Yeah I was thinking we could sync tomorrow morning",
    expect: "none",
  },
];

type CopilotTestPanelProps = {
  onSendLine: (text: string) => void;
  onClearTranscript: () => void;
  onTestPauseSuggestion: () => void;
  lastTrigger: string | null;
  lastSuggestionAt: number | null;
};

export function CopilotTestPanel({
  onSendLine,
  onClearTranscript,
  onTestPauseSuggestion,
  lastTrigger,
  lastSuggestionAt,
}: CopilotTestPanelProps) {
  const [customLine, setCustomLine] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const msSinceSuggestion =
    lastSuggestionAt != null ? now - lastSuggestionAt : null;
  const cooldownRemaining =
    msSinceSuggestion != null
      ? Math.max(0, SUGGESTION_MIN_INTERVAL_MS - msSinceSuggestion)
      : 0;
  const onCooldown = cooldownRemaining > 0;

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5">
      <h2 className="text-sm font-semibold tracking-tight text-white/90">
        Developer testing
      </h2>
      <p className="mt-1 text-xs text-white/45">
        Requires <code className="text-white/60">OPENAI_API_KEY</code> in{" "}
        <code className="text-white/60">.env.local</code>. Presets hit the trigger
        engine; suggestions use the same API as live mode.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onSendLine(p.text)}
            className="rounded-xl border border-white/[0.07] bg-white/[0.04] px-2.5 py-2 text-left text-xs transition-colors hover:bg-white/[0.07] sm:px-3 sm:text-sm"
            title={`Expect ~${p.expect}`}
          >
            <span className="block font-medium text-white/90">{p.label}</span>
            <span className="mt-0.5 block text-[0.65rem] text-white/40">
              → {p.expect}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={customLine}
          onChange={(e) => setCustomLine(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && customLine.trim()) {
              onSendLine(customLine.trim());
              setCustomLine("");
            }
          }}
          placeholder="Type a line, Enter to send"
          className="flex-1 rounded-full border border-white/[0.1] bg-black/30 px-4 py-2 text-sm text-white placeholder:text-white/30"
        />
        <button
          type="button"
          onClick={() => {
            if (!customLine.trim()) return;
            onSendLine(customLine.trim());
            setCustomLine("");
          }}
          className="rounded-full bg-sky-600/85 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500/90"
        >
          Send
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onTestPauseSuggestion}
          className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/80 hover:bg-white/[0.05]"
        >
          Test pause suggestion
        </button>
        <button
          type="button"
          onClick={onClearTranscript}
          className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/80 hover:bg-white/[0.05]"
        >
          Clear transcript
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-white/[0.06] pt-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[0.65rem] font-medium uppercase tracking-[0.1em] text-white/38">
            Last line trigger
          </dt>
          <dd className="mt-1 font-mono text-sm text-emerald-400/90">
            {lastTrigger ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[0.65rem] font-medium uppercase tracking-[0.1em] text-white/38">
            Suggestion cooldown
          </dt>
          <dd className="mt-1 text-sm text-white/75">
            {lastSuggestionAt == null ? (
              "No suggestion yet"
            ) : onCooldown ? (
              <>
                <span className="text-amber-200/90">
                  {(cooldownRemaining / 1000).toFixed(1)}s
                </span>{" "}
                <span className="text-white/40">(all triggers)</span>
              </>
            ) : (
              <span className="text-emerald-400/90">Ready</span>
            )}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-[0.65rem] leading-relaxed text-white/35">
        Pause fires ~{Math.round(DEFAULT_PAUSE_MS / 100) / 10}s after a line unless
        another line arrives. &quot;Test pause&quot; skips the wait.
      </p>
    </div>
  );
}
