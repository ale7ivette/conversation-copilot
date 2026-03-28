"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  readPersistedAudioCaptureSettings,
  toRealtimeMicSessionOptions,
} from "@/components/audio-capture-settings";
import { CopilotTestPanel } from "@/components/copilot-test-panel";
import { EndSessionDialog } from "@/components/end-session-dialog";
import { ConversationTypeControl } from "@/components/conversation-type-control";
import { IdleHero } from "@/components/idle-hero";
import { SettingsDrawer } from "@/components/settings-drawer";
import { SuggestionPanel } from "@/components/suggestion-panel";
import { TranscriptFullDrawer } from "@/components/transcript-full-drawer";
import { TranscriptPeek } from "@/components/transcript-peek";
import type { CopilotScenario } from "@/lib/copilot-scenario";
import {
  loadPersistedScenario,
  savePersistedScenario,
} from "@/lib/copilot-scenario";
import {
  loadSpeakerMap,
  saveSpeakerMap,
  resolveSpeakerFromDiarization,
} from "@/lib/diarization-speaker-map";
import {
  DEFAULT_PAUSE_MS,
  TriggerDeduper,
  detectLineTrigger,
  type TriggerReason,
} from "@/lib/trigger-engine";
import { buildSpeakerMapSummary } from "@/lib/client-hints";
import { MicActivityTracker } from "@/lib/mic-activity-tracker";
import { canRequestSuggestion } from "@/lib/suggestion-cooldown";
import type { TranscriptLine } from "@/lib/transcript-buffer";
import { TranscriptBuffer } from "@/lib/transcript-buffer";
import {
  getAssemblyAiStreamingToken,
  getRealtimeToken,
  requestCopilotSuggestion,
} from "@/lib/realtime";
import {
  loadPersistedSuggestionTiming,
  savePersistedSuggestionTiming,
  type SuggestionTiming,
} from "@/lib/suggestion-timing";
import { getClientTranscriptionProvider } from "@/lib/transcription-provider";
import type { CopilotSuggestion } from "@/types/copilot";

const SHOW_DEV_TOOLS =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_COPILOT_DEV_TOOLS === "true";

function formatElapsed(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function HomePage() {
  const [isListening, setIsListening] = useState(false);
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([]);
  const transcriptBufferRef = useRef(new TranscriptBuffer());
  const lastSuggestionAtRef = useRef<number | null>(null);
  const [lastSuggestionAt, setLastSuggestionAt] = useState<number | null>(
    null
  );
  const [lastLineTrigger, setLastLineTrigger] = useState<string | null>(null);
  const [lastSuggestionTrigger, setLastSuggestionTrigger] =
    useState<TriggerReason | null>(null);
  const [suggestion, setSuggestion] = useState<CopilotSuggestion | null>(
    null
  );
  const [liveTranscriptHint, setLiveTranscriptHint] = useState("");
  const [tokenState, setTokenState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [speakerMap, setSpeakerMap] = useState(loadSpeakerMap);
  const speakerMapRef = useRef(speakerMap);
  speakerMapRef.current = speakerMap;
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerDeduperRef = useRef(new TriggerDeduper());
  const suggestionInFlightRef = useRef(false);
  const [suggestionInFlight, setSuggestionInFlight] = useState(false);
  const stopMicRef = useRef<(() => Promise<void>) | null>(null);
  const micActivityTrackerRef = useRef(new MicActivityTracker());
  const prevAutoRef = useRef<{
    type: string;
    voice: string;
  } | null>(null);

  const [scenario, setScenario] = useState<CopilotScenario>("auto");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [transcriptFullOpen, setTranscriptFullOpen] = useState(false);
  const [endSessionOpen, setEndSessionOpen] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(
    null
  );
  const [elapsedSec, setElapsedSec] = useState(0);
  const [autoShiftNote, setAutoShiftNote] = useState<string | null>(null);
  const [suggestionTiming, setSuggestionTiming] =
    useState<SuggestionTiming>("auto");
  const suggestionTimingRef = useRef<SuggestionTiming>("auto");

  useEffect(() => {
    setScenario(loadPersistedScenario());
    setSuggestionTiming(loadPersistedSuggestionTiming());
  }, []);

  useEffect(() => {
    suggestionTimingRef.current = suggestionTiming;
  }, [suggestionTiming]);

  useEffect(() => {
    if (scenario !== "auto") prevAutoRef.current = null;
  }, [scenario]);

  useEffect(() => {
    if (scenario !== "auto" || !suggestion?.autoDetails) {
      setAutoShiftNote(null);
      return;
    }
    const d = suggestion.autoDetails;
    const prev = prevAutoRef.current;
    if (!prev) {
      prevAutoRef.current = {
        type: d.detected_conversation_type,
        voice: d.primary_voice,
      };
      return;
    }
    const typeChanged = prev.type !== d.detected_conversation_type;
    const voiceChanged = prev.voice !== d.primary_voice;
    prevAutoRef.current = {
      type: d.detected_conversation_type,
      voice: d.primary_voice,
    };
    if (!typeChanged && !voiceChanged) return;
    const parts: string[] = [];
    if (typeChanged) parts.push(`Now: ${d.detected_conversation_type}`);
    if (voiceChanged) parts.push(`Primary: ${d.primary_voice}`);
    setAutoShiftNote(parts.join(" · "));
    const t = window.setTimeout(() => setAutoShiftNote(null), 6000);
    return () => window.clearTimeout(t);
  }, [suggestion, scenario]);

  useEffect(() => {
    if (sessionStartedAt == null) return;
    const tick = () => {
      setElapsedSec(
        Math.floor((Date.now() - sessionStartedAt) / 1000)
      );
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [sessionStartedAt]);

  const diarizationLabels = useMemo(() => {
    const s = new Set<string>();
    for (const l of transcriptLines) {
      if (l.diarizationLabel?.trim()) s.add(l.diarizationLabel.trim());
    }
    return [...s].sort();
  }, [transcriptLines]);

  const fullTranscript = useCallback(
    () => transcriptBufferRef.current.getRecentText(),
    []
  );

  const syncTranscriptState = useCallback(() => {
    setTranscriptLines([...transcriptBufferRef.current.getAll()]);
  }, []);

  const buildAutoClientHints = useCallback(() => {
    const latest = transcriptBufferRef.current.getLatestLine();
    const guess = micActivityTrackerRef.current.getMicPrimaryGuess();
    const lastMeta = micActivityTrackerRef.current.getLastCueMeta();
    return {
      speakerMapSummary: buildSpeakerMapSummary(speakerMapRef.current),
      lastCompletedLineLabel: latest?.diarizationLabel,
      lastCompletedLineRole:
        latest?.speaker === "unknown" ? undefined : latest?.speaker,
      micPrimaryGuess: guess,
      lastCueMeta: lastMeta
        ? {
            diarizationLabel: lastMeta.diarizationLabel,
            committedAtMs: lastMeta.committedAtMs,
            micRms01: lastMeta.micRms01,
          }
        : undefined,
    };
  }, []);

  const fireCopilotSuggestion = useCallback(
    async (
      reason: Exclude<TriggerReason, "none">,
      transcript: string
    ) => {
      if (reason !== "manual") {
        if (!canRequestSuggestion(reason, lastSuggestionAtRef.current)) {
          return;
        }
      }
      if (suggestionInFlightRef.current) return;
      const deduper = triggerDeduperRef.current;
      if (reason !== "manual" && !deduper.tryConsume(reason, transcript)) {
        return;
      }
      suggestionInFlightRef.current = true;
      setSuggestionInFlight(true);
      try {
        const result = await requestCopilotSuggestion({
          transcript,
          trigger: reason,
          scenario,
          ...(scenario === "auto"
            ? { clientHints: buildAutoClientHints() }
            : {}),
        });
        setSuggestion(result);
        setLastSuggestionTrigger(reason);
        const t = Date.now();
        lastSuggestionAtRef.current = t;
        setLastSuggestionAt(t);
      } catch {
        console.warn("[copilot] suggestion request failed", reason);
      } finally {
        suggestionInFlightRef.current = false;
        setSuggestionInFlight(false);
      }
    },
    [scenario, buildAutoClientHints]
  );

  const handleSpeakerMapChange = useCallback(
    (map: typeof speakerMap) => {
      saveSpeakerMap(map);
      setSpeakerMap(map);
      transcriptBufferRef.current.relabelSpeakers(map);
      syncTranscriptState();
    },
    [syncTranscriptState]
  );

  const pushTranscriptCue = useCallback(
    (text: string, diarizationLabel?: string) => {
      const buf = transcriptBufferRef.current;
      buf.add({
        speaker: resolveSpeakerFromDiarization(
          speakerMapRef.current,
          diarizationLabel
        ),
        text,
        timestamp: Date.now(),
        diarizationLabel: diarizationLabel?.trim() || undefined,
      });
      syncTranscriptState();
    },
    [syncTranscriptState]
  );

  function clearTranscript() {
    transcriptBufferRef.current.clear();
    setTranscriptLines([]);
    setLiveTranscriptHint("");
  }

  const testPauseSuggestion = useCallback(async () => {
    const full = fullTranscript();
    await fireCopilotSuggestion("pause", full);
  }, [fullTranscript, fireCopilotSuggestion]);

  const handleTranscriptCue = useCallback(
    async (cue: {
      text: string;
      diarizationLabel?: string;
      micRms01?: number;
    }) => {
      const text = cue.text.trim();
      if (!text) return;

      pushTranscriptCue(text, cue.diarizationLabel);
      const committedAt = Date.now();
      micActivityTrackerRef.current.recordCue({
        diarizationLabel: cue.diarizationLabel,
        micRms01: cue.micRms01,
        committedAtMs: committedAt,
      });

      const reason = detectLineTrigger(text);
      setLastLineTrigger(reason);

      if (suggestionTimingRef.current === "auto") {
        if (reason !== "none") {
          const full = fullTranscript();
          void fireCopilotSuggestion(reason, full);
        }

        if (silenceTimer.current) clearTimeout(silenceTimer.current);
        silenceTimer.current = setTimeout(() => {
          const full = fullTranscript();
          void fireCopilotSuggestion("pause", full);
        }, DEFAULT_PAUSE_MS);
      } else {
        if (silenceTimer.current) {
          clearTimeout(silenceTimer.current);
          silenceTimer.current = null;
        }
      }
    },
    [fullTranscript, pushTranscriptCue, fireCopilotSuggestion]
  );

  const handleManualLine = useCallback(
    async (line: string) => {
      await handleTranscriptCue({ text: line });
    },
    [handleTranscriptCue]
  );

  const startListening = useCallback(async () => {
    try {
      const unlock = new AudioContext();
      await unlock.resume();
      await unlock.close();
    } catch {
      /* ignore */
    }

    setBannerError(null);
    micActivityTrackerRef.current.reset();
    prevAutoRef.current = null;
    triggerDeduperRef.current.reset();
    lastSuggestionAtRef.current = null;
    setLastSuggestionAt(null);
    setLastLineTrigger(null);
    setLastSuggestionTrigger(null);
    setSuggestion(null);
    transcriptBufferRef.current.clear();
    setTranscriptLines([]);
    setLiveTranscriptHint("");
    setTokenState("loading");
    try {
      const audioSettings = readPersistedAudioCaptureSettings();
      const micOpts = toRealtimeMicSessionOptions(audioSettings);
      const provider = getClientTranscriptionProvider();

      let stop: () => Promise<void>;
      if (provider === "assemblyai") {
        const streamingToken = await getAssemblyAiStreamingToken();
        const { startAssemblyAiMicSession } = await import(
          "@/lib/assemblyai-mic-session"
        );
        stop = await startAssemblyAiMicSession(
          streamingToken,
          {
            onTranscriptCue: (cue) => {
              void handleTranscriptCue(cue);
            },
            onPartialTranscript: (t) => setLiveTranscriptHint(t),
            onDebug: (m) => console.debug("[assemblyai]", m),
          },
          micOpts
        );
      } else {
        const token = await getRealtimeToken({
          noiseReduction: audioSettings.noiseReduction,
        });
        const { startRealtimeMicSession } = await import(
          "@/lib/realtime-mic-session"
        );
        stop = await startRealtimeMicSession(
          token,
          {
            onTranscriptCue: (cue) => {
              void handleTranscriptCue(cue);
            },
            onPartialTranscript: (t) => setLiveTranscriptHint(t),
            onDebug: (m) => console.debug("[realtime]", m),
          },
          micOpts
        );
      }
      stopMicRef.current = stop;
      setTokenState("ready");
      setIsListening(true);
      setSessionStartedAt(Date.now());
      setElapsedSec(0);
    } catch (e) {
      stopMicRef.current = null;
      setTokenState("error");
      setBannerError(
        e instanceof Error ? e.message : "Could not start listening."
      );
      setIsListening(false);
    }
  }, [handleTranscriptCue]);

  const stopListening = useCallback(async () => {
    if (stopMicRef.current) {
      try {
        await stopMicRef.current();
      } catch {
        /* ignore teardown errors */
      }
      stopMicRef.current = null;
    }
    setLiveTranscriptHint("");
    micActivityTrackerRef.current.reset();
    prevAutoRef.current = null;
    triggerDeduperRef.current.reset();
    setIsListening(false);
    setTokenState("idle");
    setSessionStartedAt(null);
    setElapsedSec(0);
    setLastSuggestionTrigger(null);
    setSuggestion(null);
    if (silenceTimer.current) {
      clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    }
  }, []);

  function onScenarioChange(next: CopilotScenario) {
    setScenario(next);
    savePersistedScenario(next);
  }

  const micLive =
    isListening && tokenState === "ready" && stopMicRef.current != null;

  const suggestNow = useCallback(() => {
    const full = fullTranscript();
    void fireCopilotSuggestion("manual", full);
  }, [fullTranscript, fireCopilotSuggestion]);

  function onSuggestionTimingChange(next: SuggestionTiming) {
    setSuggestionTiming(next);
    savePersistedSuggestionTiming(next);
  }

  return (
    <main className="flex min-h-dvh flex-col bg-[var(--copilot-bg)] text-[var(--copilot-fg)]">
      <div className="mx-auto flex w-full max-w-6xl flex-1 min-h-0 flex-col px-4 py-4 sm:px-6 sm:py-5">
        <header className="relative flex shrink-0 flex-col gap-3 pb-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 pt-0.5">
            <h1 className="text-lg font-semibold tracking-tight text-[var(--copilot-fg)] sm:text-xl">
              Conversation Copilot
            </h1>
            {!isListening ? (
              <p className="mt-0.5 text-xs text-[var(--copilot-muted)]">
                Premium real-time conversation support
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-start sm:gap-2">
            <ConversationTypeControl
              value={scenario}
              onChange={onScenarioChange}
              disabled={tokenState === "loading"}
              className="w-full sm:w-auto"
            />
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="self-end rounded-xl p-2.5 text-[var(--copilot-muted)] transition-colors hover:bg-[var(--copilot-surface-2)] hover:text-[var(--copilot-fg-secondary)] sm:self-auto"
              aria-label="Open settings"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            </button>
          </div>
        </header>

        {isListening ? (
          <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-[var(--copilot-muted)]">
            <span className="inline-flex items-center gap-2 text-[var(--copilot-fg-secondary)]">
              <span
                className={`copilot-live-dot h-2 w-2 shrink-0 rounded-full bg-[var(--copilot-accent)] ${
                  micLive ? "" : "opacity-40"
                }`}
                aria-hidden
              />
              <span className="font-medium tracking-wide">Live</span>
            </span>
            <span className="text-[var(--copilot-muted)]">·</span>
            <span className="tabular-nums">{formatElapsed(elapsedSec)}</span>
          </div>
        ) : null}

        {!isListening ? (
          <IdleHero
            onStart={() => void startListening()}
            connecting={tokenState === "loading"}
            errorMessage={bannerError}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-5 lg:flex-row lg:gap-6">
            <div className="flex min-h-0 flex-1 flex-col lg:w-[58%] lg:max-w-none">
              <SuggestionPanel
                suggestion={suggestion}
                lastSuggestionTrigger={lastSuggestionTrigger}
                suggestionInFlight={suggestionInFlight}
                scenario={scenario}
                autoShiftNote={autoShiftNote}
                suggestionTiming={suggestionTiming}
                showSuggestNow={isListening}
                onSuggestNow={suggestNow}
                className="min-h-0"
              />
              <button
                type="button"
                onClick={() => setEndSessionOpen(true)}
                className="mt-6 w-full rounded-xl py-3 text-sm font-medium text-[var(--copilot-muted)] transition-colors hover:bg-[var(--copilot-surface-2)] hover:text-[var(--copilot-fg-secondary)]"
              >
                End session
              </button>
            </div>
            <div className="flex min-h-[200px] flex-1 flex-col lg:max-w-md">
              <TranscriptPeek
                lines={transcriptLines}
                liveLine={liveTranscriptHint}
                onViewFull={() => setTranscriptFullOpen(true)}
                className="min-h-0 lg:min-h-[320px]"
              />
            </div>
          </div>
        )}

        {SHOW_DEV_TOOLS ? (
          <details className="group mt-6 shrink-0 border-t border-[var(--copilot-border)] pt-4">
            <summary className="cursor-pointer list-none text-sm font-medium text-[var(--copilot-muted)] transition-colors marker:hidden hover:text-[var(--copilot-fg-secondary)] [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                <span
                  className="text-[var(--copilot-muted)] transition-transform group-open:rotate-90"
                  aria-hidden
                >
                  ▸
                </span>
                Developer testing
              </span>
            </summary>
            <div className="mt-3">
              <CopilotTestPanel
                onSendLine={(line) => void handleManualLine(line)}
                onClearTranscript={clearTranscript}
                onTestPauseSuggestion={() => void testPauseSuggestion()}
                lastTrigger={lastLineTrigger}
                lastSuggestionAt={lastSuggestionAt}
              />
            </div>
          </details>
        ) : null}
      </div>

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        audioCaptureLocked={isListening}
        diarizationLabels={diarizationLabels}
        speakerMap={speakerMap}
        onSpeakerMapChange={handleSpeakerMapChange}
        suggestionTiming={suggestionTiming}
        onSuggestionTimingChange={onSuggestionTimingChange}
      />

      <TranscriptFullDrawer
        open={transcriptFullOpen}
        onClose={() => setTranscriptFullOpen(false)}
        lines={transcriptLines}
        liveLine={liveTranscriptHint}
        sessionStartedAtMs={sessionStartedAt}
      />

      <EndSessionDialog
        open={endSessionOpen}
        onCancel={() => setEndSessionOpen(false)}
        onConfirm={() => {
          setEndSessionOpen(false);
          void stopListening();
        }}
      />
    </main>
  );
}
