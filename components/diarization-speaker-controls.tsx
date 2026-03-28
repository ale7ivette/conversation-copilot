"use client";

import type { SpeakerMap } from "@/lib/transcript-buffer";

type DiarizationSpeakerControlsProps = {
  labels: string[];
  speakerMap: SpeakerMap;
  onSpeakerMapChange: (map: SpeakerMap) => void;
  disabled?: boolean;
};

export function DiarizationSpeakerControls({
  labels,
  speakerMap,
  onSpeakerMapChange,
  disabled,
}: DiarizationSpeakerControlsProps) {
  if (labels.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[var(--copilot-border)] bg-[var(--copilot-surface-2)] px-3 py-2.5">
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.1em] text-[var(--copilot-muted)]">
        Who is speaking?
      </p>
      <p className="mt-1 text-[0.65rem] leading-relaxed text-[var(--copilot-muted)]">
        Map each detected speaker to you or them so the copilot can follow the
        thread.
      </p>
      <div className="mt-2 flex flex-col gap-2">
        {labels.map((label) => (
          <label
            key={label}
            className="flex flex-wrap items-center gap-2 text-xs text-[var(--copilot-fg-secondary)]"
          >
            <span className="font-mono text-[var(--copilot-muted)]">{label}</span>
            <select
              disabled={disabled}
              value={speakerMap[label] ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                const next = { ...speakerMap };
                if (v === "me" || v === "other") next[label] = v;
                else delete next[label];
                onSpeakerMapChange(next);
              }}
              className="rounded-lg border border-[var(--copilot-border)] bg-[var(--copilot-surface)] px-2 py-1 text-sm text-[var(--copilot-fg)] disabled:opacity-50"
            >
              <option value="">Unmapped</option>
              <option value="me">Me</option>
              <option value="other">Them</option>
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}
