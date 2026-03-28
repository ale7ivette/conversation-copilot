"use client";

import { useCallback, useRef, useState } from "react";
import {
  AudioCaptureSettingsPanel,
  readPersistedAudioCaptureSettings,
  toRealtimeMicSessionOptions,
} from "@/components/audio-capture-settings";
import { CopilotTestPanel } from "@/components/copilot-test-panel";
import { ListeningToolbar } from "@/components/listening-toolbar";
import { SuggestionPanel } from "@/components/suggestion-panel";
import { TranscriptPanel } from "@/components/transcript-panel";
import {
  loadSpeakerMap,
  saveSpeakerMap,
  resolveSpeakerFromDiarization,
} from "@/lib/diarization-speaker-map";
import {
  DEFAULT_PAUSE_MS,
  TriggerDeduper,
  detectLineTrigger,
} from "@/lib/trigger-engine";
import { canRequestSuggestion } from "@/lib/suggestion-cooldown";
import type { TranscriptLine } from "@/lib/transcript-buffer";
import { TranscriptBuffer } from "@/lib/transcript-buffer";
import { getRealtimeToken, requestCopilotSuggestion } from "@/lib/realtime";
import type { CopilotSuggestion } from "@/types/copilot";

export default function HomePage() {
  const [isListening, setIsListening] = useState(false);
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([]);
  const transcriptBufferRef = useRef(new TranscriptBuffer());
  const lastSuggestionAtRef = useRef<number | null>(null);
  const [lastSuggestionAt, setLastSuggestionAt] = useState<number | null>(
    null
  );
  const [lastLineTrigger, setLastLineTrigger] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<CopilotSuggestion | null>(null);
  const [liveTranscriptHint, setLiveTranscriptHint] = useState("");
  const [status, setStatus] = useState("idle");
  const [tokenState, setTokenState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [speakerMap, setSpeakerMap] = useState(loadSpeakerMap);
  const speakerMapRef = useRef(speakerMap);
  speakerMapRef.current = speakerMap;
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerDeduperRef = useRef(new TriggerDeduper());
  const stopMicRef = useRef<(() => Promise<void>) | null>(null);

  const fullTranscript = useCallback(
    () => transcriptBufferRef.current.getRecentText(),
    []
  );

  const syncTranscriptState = useCallback(() => {
    setTranscriptLines([...transcriptBufferRef.current.getAll()]);
  }, []);

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
    if (!canRequestSuggestion("pause", lastSuggestionAtRef.current)) {
      setStatus("cooldown (pause)");
      return;
    }
    const deduper = triggerDeduperRef.current;
    if (!deduper.tryConsume("pause", full)) {
      setStatus("dedupe blocked pause");
      return;
    }
    try {
      setStatus("triggered: pause (manual test)");
      const result = await requestCopilotSuggestion({
        transcript: full,
        trigger: "pause",
      });
      setSuggestion(result);
      const t = Date.now();
      lastSuggestionAtRef.current = t;
      setLastSuggestionAt(t);
    } catch {
      setStatus("pause suggestion failed");
    }
  }, [fullTranscript]);

  const handleTranscriptCue = useCallback(
    async (cue: { text: string; diarizationLabel?: string }) => {
      const text = cue.text.trim();
      if (!text) return;

      pushTranscriptCue(text, cue.diarizationLabel);

      const reason = detectLineTrigger(text);
      setLastLineTrigger(reason);

      if (reason !== "none") {
        const deduper = triggerDeduperRef.current;
        const full = fullTranscript();
        if (!canRequestSuggestion(reason, lastSuggestionAtRef.current)) {
          setStatus(`cooldown (${reason})`);
        } else if (deduper.tryConsume(reason, full)) {
          try {
            setStatus(`triggered: ${reason}`);
            const result = await requestCopilotSuggestion({
              transcript: full,
              trigger: reason,
            });
            setSuggestion(result);
            const t = Date.now();
            lastSuggestionAtRef.current = t;
            setLastSuggestionAt(t);
          } catch {
            setStatus("error getting suggestion");
          }
        }
      }

      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      silenceTimer.current = setTimeout(async () => {
        const deduper = triggerDeduperRef.current;
        const full = fullTranscript();
        if (!canRequestSuggestion("pause", lastSuggestionAtRef.current)) return;
        if (!deduper.tryConsume("pause", full)) return;
        try {
          const result = await requestCopilotSuggestion({
            transcript: full,
            trigger: "pause",
          });
          setSuggestion(result);
          const t = Date.now();
          lastSuggestionAtRef.current = t;
          setLastSuggestionAt(t);
        } catch {
          setStatus("pause suggestion failed");
        }
      }, DEFAULT_PAUSE_MS);
    },
    [fullTranscript, pushTranscriptCue]
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

    triggerDeduperRef.current.reset();
    lastSuggestionAtRef.current = null;
    setLastSuggestionAt(null);
    setLastLineTrigger(null);
    transcriptBufferRef.current.clear();
    setTranscriptLines([]);
    setLiveTranscriptHint("");
    setTokenState("loading");
    setStatus("fetching realtime token");
    try {
      const audioSettings = readPersistedAudioCaptureSettings();
      const token = await getRealtimeToken({
        noiseReduction: audioSettings.noiseReduction,
      });
      setStatus("connecting realtime…");
      const { startRealtimeMicSession } = await import(
        "@/lib/realtime-mic-session"
      );
      const stop = await startRealtimeMicSession(
        token,
        {
          onTranscriptCue: (cue) => {
            void handleTranscriptCue(cue);
          },
          onPartialTranscript: (t) => setLiveTranscriptHint(t),
          onDebug: (m) => console.debug("[realtime]", m),
        },
        toRealtimeMicSessionOptions(audioSettings)
      );
      stopMicRef.current = stop;
      setTokenState("ready");
      setIsListening(true);
      setStatus("listening — mic on");
    } catch (e) {
      stopMicRef.current = null;
      setTokenState("error");
      setStatus(
        e instanceof Error ? e.message : "token or microphone error"
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
    triggerDeduperRef.current.reset();
    setIsListening(false);
    setStatus("stopped");
    setTokenState("idle");
    if (silenceTimer.current) {
      clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    }
  }, []);

  return (
    <main className="flex min-h-dvh flex-col bg-neutral-950 text-zinc-100">
      <div className="mx-auto flex w-full max-w-6xl flex-1 min-h-0 flex-col px-4 py-4 sm:px-6 sm:py-5">
        <header className="shrink-0 border-b border-white/[0.06] pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Conversation Copilot
              </h1>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-white/45 sm:text-sm">
                Listen with the mic or use developer tools below. Suggestions
                follow the same triggers and cooldowns as live speech.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:items-start lg:items-end">
              <ListeningToolbar
                isListening={isListening}
                tokenState={tokenState}
                micStreaming={isListening && tokenState === "ready"}
                onStart={() => void startListening()}
                onStop={() => void stopListening()}
              />
              <p className="max-w-md text-xs text-white/45 lg:text-right">
                <span className="text-white/55">Status</span>{" "}
                <span className="text-white/80">{status}</span>
              </p>
            </div>
          </div>
          <div className="mt-4 max-w-xl">
            <AudioCaptureSettingsPanel disabled={isListening} />
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 pt-4 lg:flex-row lg:gap-5">
          <div className="flex min-h-[42vh] flex-1 flex-col lg:min-h-0 lg:w-[58%]">
            <TranscriptPanel
              lines={transcriptLines}
              liveLine={liveTranscriptHint}
              className="lg:min-h-0"
              speakerMap={speakerMap}
              onSpeakerMapChange={handleSpeakerMapChange}
            />
          </div>
          <div className="flex min-h-0 shrink-0 flex-col lg:flex-1 lg:max-w-md">
            <SuggestionPanel suggestion={suggestion} />
          </div>
        </div>

        <details className="group mt-4 shrink-0 border-t border-white/[0.06] pt-4">
          <summary className="cursor-pointer list-none text-sm font-medium text-white/50 transition-colors marker:hidden hover:text-white/70 [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <span
                className="text-white/35 transition-transform group-open:rotate-90"
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
      </div>
    </main>
  );
}
