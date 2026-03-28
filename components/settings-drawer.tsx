"use client";

import { useEffect, useRef } from "react";
import { AudioCaptureSettingsPanel } from "@/components/audio-capture-settings";
import { DiarizationSpeakerControls } from "@/components/diarization-speaker-controls";
import type { SpeakerMap } from "@/lib/transcript-buffer";

type SettingsDrawerProps = {
  open: boolean;
  onClose: () => void;
  /** Mic, gains, noise mode, tab mix — need a new session to apply. */
  audioCaptureLocked: boolean;
  diarizationLabels: string[];
  speakerMap: SpeakerMap;
  onSpeakerMapChange: (map: SpeakerMap) => void;
};

export function SettingsDrawer({
  open,
  onClose,
  audioCaptureLocked,
  diarizationLabels,
  speakerMap,
  onSpeakerMapChange,
}: SettingsDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!open || !panelRef.current) return;
    const root = panelRef.current;
    const focusable = root.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const list = [...focusable].filter((el) => !el.hasAttribute("disabled"));
    if (list.length === 0) return;

    function onTrap(e: KeyboardEvent) {
      if (e.key !== "Tab" || list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    root.addEventListener("keydown", onTrap);
    return () => root.removeEventListener("keydown", onTrap);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex justify-end"
      style={{ zIndex: 50 }}
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close settings"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="copilot-settings-title"
        className="relative flex h-full w-full max-w-md flex-col border-l border-[var(--copilot-border)] bg-[var(--copilot-surface)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--copilot-border)] px-4 py-3">
          <h2
            id="copilot-settings-title"
            className="text-sm font-medium tracking-tight text-[var(--copilot-fg)]"
          >
            Settings
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
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
          <p className="text-[0.65rem] leading-relaxed text-[var(--copilot-muted)]">
            Conversation type at the top only steers how suggestions are phrased.
            It does not change microphone or audio capture — those are separate
            below.
          </p>

          {audioCaptureLocked ? (
            <p className="rounded-xl border border-[var(--copilot-border)] bg-[var(--copilot-surface-2)] px-3 py-2 text-[0.65rem] leading-relaxed text-amber-200/85">
              While you are live, audio capture options stay fixed until you end
              the session so the stream stays stable. This is not tied to
              conversation type.
            </p>
          ) : null}

          <AudioCaptureSettingsPanel disabled={audioCaptureLocked} />

          <DiarizationSpeakerControls
            labels={diarizationLabels}
            speakerMap={speakerMap}
            onSpeakerMapChange={onSpeakerMapChange}
          />
        </div>
      </aside>
    </div>
  );
}
