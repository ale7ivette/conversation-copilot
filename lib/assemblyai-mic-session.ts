import { StreamingTranscriber } from "assemblyai";
import { startMixedAudioPcmCapture } from "@/lib/browser-mixed-audio-capture";
import type { MicCaptureOptions } from "@/lib/mic-capture-options";
import {
  ASSEMBLYAI_STREAMING_SAMPLE_RATE,
  ASSEMBLYAI_STREAMING_SPEECH_MODEL,
} from "@/lib/assemblyai-settings";
import type { RealtimeMicHandlers } from "@/lib/realtime-mic-session";

export type AssemblyAiMicOptions = MicCaptureOptions;

/**
 * Browser mic → AssemblyAI Universal Streaming v3 (PCM 16 kHz) with optional speaker labels.
 */
export async function startAssemblyAiMicSession(
  streamingToken: string,
  handlers: RealtimeMicHandlers,
  options: AssemblyAiMicOptions = {}
): Promise<() => Promise<void>> {
  const onDebug = handlers.onDebug ?? (() => {});

  const transcriber = new StreamingTranscriber({
    token: streamingToken,
    sampleRate: ASSEMBLYAI_STREAMING_SAMPLE_RATE,
    speechModel: ASSEMBLYAI_STREAMING_SPEECH_MODEL,
    speakerLabels: true,
    formatTurns: true,
  });

  transcriber.on("turn", (ev) => {
    const text = ev.transcript?.trim() ?? "";
    if (!text && !ev.end_of_turn) return;

    if (!ev.end_of_turn) {
      handlers.onPartialTranscript?.(text);
      return;
    }

    handlers.onPartialTranscript?.("");
    if (!text) return;

    const label = ev.speaker_label?.trim();
    handlers.onTranscriptCue({
      text,
      diarizationLabel: label || undefined,
      micRms01: sampleMicRms01Ref(),
    });
  });

  transcriber.on("error", (err) => {
    onDebug(`assemblyai error: ${err.message}`);
  });

  transcriber.on("close", (code, reason) => {
    onDebug(`assemblyai closed: ${code} ${reason}`);
  });

  await transcriber.connect();
  onDebug("AssemblyAI streaming — opening audio capture");

  let sampleMicRms01Ref = (): number => 0;

  const audioHandle = await startMixedAudioPcmCapture(
    options,
    ASSEMBLYAI_STREAMING_SAMPLE_RATE,
    (pcm) => {
      try {
        transcriber.sendAudio(
          pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength)
        );
      } catch {
        /* socket may be closing */
      }
    },
    onDebug
  );
  sampleMicRms01Ref = audioHandle.sampleMicRms01;

  return async () => {
    handlers.onPartialTranscript?.("");
    try {
      await transcriber.close(true);
    } catch {
      try {
        await transcriber.close(false);
      } catch {
        /* ignore */
      }
    }
    await audioHandle.dispose();
  };
}
