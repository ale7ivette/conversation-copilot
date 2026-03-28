import OpenAI from "openai";
import { OpenAIRealtimeWebSocket } from "openai/realtime/websocket";
import type { ClientSecretCreateResponse } from "openai/resources/realtime/client-secrets";

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

export type RealtimeMicOptions = {
  /** Pin input device (e.g. loopback / Stereo Mix). */
  audioDeviceId?: string;
  /** Also capture tab/system audio via getDisplayMedia (user must share). */
  mixDisplayAudio?: boolean;
  micGain?: number;
  displayGain?: number;
};

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

function floatToPcm16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function floatToPcm16Resampled(
  input: Float32Array,
  inputRate: number,
  outputRate: number
): Int16Array {
  if (inputRate === outputRate) {
    return floatToPcm16(input);
  }
  const outLen = Math.max(
    1,
    Math.round((input.length * outputRate) / inputRate)
  );
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcPos = (i * inputRate) / outputRate;
    const j = Math.floor(srcPos);
    const f = srcPos - j;
    const a = input[j] ?? 0;
    const b = input[j + 1] ?? a;
    const sample = Math.max(-1, Math.min(1, a * (1 - f) + b * f));
    out[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return out;
}

function pcm16ToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Mic APIs exist only in a secure context (https, localhost, 127.0.0.1 — not http://LAN-IP). */
function assertBrowserMicAvailable(): void {
  if (typeof navigator === "undefined") {
    throw new Error("Microphone access requires a browser environment.");
  }
  const md = navigator.mediaDevices;
  if (!md?.getUserMedia) {
    throw new Error(
      "Microphone is unavailable on this URL. Use http://localhost or https:// (not http:// plus your Wi‑Fi/LAN IP). For phones or other devices on your network, use HTTPS or deploy the app to a host with TLS."
    );
  }
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
        micRms01: sampleMicRms01(),
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
      handlers.onTranscriptCue({ text: t, micRms01: sampleMicRms01() });
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

  assertBrowserMicAvailable();

  const micConstraints: MediaTrackConstraints | boolean = options.audioDeviceId
    ? { deviceId: { exact: options.audioDeviceId } }
    : true;

  let micStream: MediaStream;
  try {
    micStream = await navigator.mediaDevices!.getUserMedia({
      audio: micConstraints,
    });
  } catch (e) {
    rt.close();
    throw e instanceof Error ? e : new Error("Microphone permission denied");
  }

  let displayStream: MediaStream | null = null;
  if (options.mixDisplayAudio) {
    try {
      displayStream = await navigator.mediaDevices!.getDisplayMedia({
        video: true,
        audio: true,
      });
      displayStream.getVideoTracks().forEach((t) => t.stop());
      if (!displayStream.getAudioTracks().length) {
        onDebug("Display capture had no audio; using microphone only");
        displayStream.getTracks().forEach((t) => t.stop());
        displayStream = null;
      }
    } catch {
      onDebug("Display audio not shared; using microphone only");
      displayStream = null;
    }
  }

  const audioContext = new AudioContext();
  await audioContext.resume();

  const bufferSize = 4096;
  const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);

  const micGain = audioContext.createGain();
  micGain.gain.value = options.micGain ?? 1;
  const micSource = audioContext.createMediaStreamSource(micStream);
  micSource.connect(micGain);
  micGain.connect(processor);

  const micAnalyser = audioContext.createAnalyser();
  micAnalyser.fftSize = 512;
  micGain.connect(micAnalyser);
  const rmsScratch = new Float32Array(micAnalyser.fftSize);
  function sampleMicRms01(): number {
    micAnalyser.getFloatTimeDomainData(rmsScratch);
    let s = 0;
    for (let i = 0; i < rmsScratch.length; i++) {
      const x = rmsScratch[i];
      s += x * x;
    }
    const rms = Math.sqrt(s / rmsScratch.length);
    return Math.min(1, rms * 2.8);
  }

  let dispGain: GainNode | null = null;
  let dispSource: MediaStreamAudioSourceNode | null = null;
  if (displayStream) {
    dispGain = audioContext.createGain();
    dispGain.gain.value = options.displayGain ?? 0.85;
    dispSource = audioContext.createMediaStreamSource(displayStream);
    dispSource.connect(dispGain);
    dispGain.connect(processor);
  }

  processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    const pcm = floatToPcm16Resampled(
      input,
      audioContext.sampleRate,
      TARGET_SAMPLE_RATE
    );
    if (pcm.length === 0) return;
    const audio = pcm16ToBase64(pcm);
    try {
      rt.send({ type: "input_audio_buffer.append", audio });
    } catch {
      /* socket may be closing */
    }
  };

  const mute = audioContext.createGain();
  mute.gain.value = 0;
  processor.connect(mute);
  mute.connect(audioContext.destination);

  return async () => {
    partialByItem.clear();
    itemIdsWithSegments.clear();
    handlers.onPartialTranscript?.("");
    processor.disconnect();
    mute.disconnect();
    micAnalyser.disconnect();
    micGain.disconnect();
    micSource.disconnect();
    if (dispSource) dispSource.disconnect();
    if (dispGain) dispGain.disconnect();
    micStream.getTracks().forEach((t) => t.stop());
    if (displayStream) displayStream.getTracks().forEach((t) => t.stop());
    await audioContext.close();
    rt.close();
  };
}
