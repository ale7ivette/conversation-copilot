import OpenAI from "openai";
import { OpenAIRealtimeWebSocket } from "openai/realtime/websocket";
import type { ClientSecretCreateResponse } from "openai/resources/realtime/client-secrets";
import {
  pcm16ToBase64,
  startMixedAudioPcmCapture,
} from "@/lib/browser-mixed-audio-capture";
import type { MicCaptureOptions } from "@/lib/mic-capture-options";

const TARGET_SAMPLE_RATE = 24000;

export type TranscriptCue = {
  text: string;
  /** Raw diarization speaker id when using gpt-4o-transcribe-diarize. */
  diarizationLabel?: string;
  /** Normalized ~0–1 RMS on local mic path when segment committed (best-effort). */
  micRms01?: number;
};

export type RealtimeMicHandlers = {
  onTranscriptCue: (cue: TranscriptCue) => void;
  /** In-progress ASR text (aggregated); empty string when nothing partial. */
  onPartialTranscript?: (text: string) => void;
  onDebug?: (message: string) => void;
};

export type RealtimeMicOptions = MicCaptureOptions;

function resolveModel(token: ClientSecretCreateResponse): string {
  const s = token.session;
  if (
    s &&
    "model" in s &&
    typeof (s as { model?: string }).model === "string" &&
    (s as { model: string }).model.length > 0
  ) {
    return (s as { model: string }).model;
  }
  return "gpt-realtime";
}

/**
 * Browser mic (optional display-audio mix) → OpenAI Realtime WebSocket (PCM 24 kHz)
 * → transcription events (diarized segments or full line on completed).
 */
export async function startRealtimeMicSession(
  token: ClientSecretCreateResponse,
  handlers: RealtimeMicHandlers,
  options: RealtimeMicOptions = {}
): Promise<() => Promise<void>> {
  const model = resolveModel(token);
  const onDebug = handlers.onDebug ?? (() => {});

  const client = new OpenAI({
    apiKey: token.value,
    dangerouslyAllowBrowser: true,
  });

  const rt = new OpenAIRealtimeWebSocket(
    { model, dangerouslyAllowBrowser: true },
    client
  );

  const sessionReady = rt.emitted("session.created");

  const partialByItem = new Map<string, string>();
  const itemIdsWithSegments = new Set<string>();
  const emitPartial = () => {
    const parts = [...partialByItem.values()].filter((p) => p.length > 0);
    handlers.onPartialTranscript?.(parts.join("\n\n"));
  };

  rt.on("conversation.item.input_audio_transcription.delta", (ev) => {
    const id = ev.item_id;
    const chunk = ev.delta ?? "";
    partialByItem.set(id, (partialByItem.get(id) ?? "") + chunk);
    emitPartial();
  });

  rt.on(
    "conversation.item.input_audio_transcription.segment",
    (ev: {
      item_id: string;
      speaker: string;
      text: string;
    }) => {
      const text = ev.text?.trim();
      if (!text) return;
      itemIdsWithSegments.add(ev.item_id);
      handlers.onTranscriptCue({
        text,
        diarizationLabel: ev.speaker?.trim() || undefined,
        micRms01: sampleMicRms01Ref(),
      });
    }
  );

  rt.on("conversation.item.input_audio_transcription.completed", (ev) => {
    partialByItem.delete(ev.item_id);
    emitPartial();
    const hadSegments = itemIdsWithSegments.has(ev.item_id);
    if (hadSegments) {
      itemIdsWithSegments.delete(ev.item_id);
      return;
    }
    const t = ev.transcript?.trim();
    if (t)
      handlers.onTranscriptCue({ text: t, micRms01: sampleMicRms01Ref() });
  });

  rt.on("error", (err) => {
    onDebug(`realtime error: ${err.message}`);
  });

  try {
    await Promise.race([
      sessionReady,
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                "Realtime session timed out (no session.created in 25s)"
              )
            ),
          25_000
        )
      ),
    ]);
  } catch (e) {
    try {
      rt.close();
    } catch {
      /* ignore */
    }
    throw e;
  }
  onDebug("session.created — opening audio capture");

  let sampleMicRms01Ref = (): number => 0;

  const audioHandle = await startMixedAudioPcmCapture(
    options,
    TARGET_SAMPLE_RATE,
    (pcm) => {
      if (pcm.length === 0) return;
      const audio = pcm16ToBase64(pcm);
      try {
        rt.send({ type: "input_audio_buffer.append", audio });
      } catch {
        /* socket may be closing */
      }
    },
    onDebug
  );
  sampleMicRms01Ref = audioHandle.sampleMicRms01;

  return async () => {
    partialByItem.clear();
    itemIdsWithSegments.clear();
    handlers.onPartialTranscript?.("");
    try {
      rt.close();
    } catch {
      /* ignore */
    }
    await audioHandle.dispose();
  };
}
