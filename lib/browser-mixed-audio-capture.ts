/**
 * Shared browser mic (+ optional display-audio mix) → mono PCM chunks at a target sample rate.
 */

import type { MicCaptureOptions } from "@/lib/mic-capture-options";

export function floatToPcm16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export function floatToPcm16Resampled(
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

export function pcm16ToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Mic APIs exist only in a secure context (https, localhost, 127.0.0.1 — not http://LAN-IP). */
export function assertBrowserMicAvailable(): void {
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

export type MixedAudioPcmHandle = {
  sampleMicRms01: () => number;
  dispose: () => Promise<void>;
};

/**
 * Opens mic (optional display mix), resamples to `outputSampleRate`, invokes `onPcmChunk` per processor frame.
 */
export async function startMixedAudioPcmCapture(
  options: MicCaptureOptions,
  outputSampleRate: number,
  onPcmChunk: (pcm: Int16Array) => void,
  onDebug?: (message: string) => void
): Promise<MixedAudioPcmHandle> {
  const debug = onDebug ?? (() => {});

  assertBrowserMicAvailable();

  const micConstraints: MediaTrackConstraints | boolean = options.audioDeviceId
    ? { deviceId: { exact: options.audioDeviceId } }
    : true;

  const micStream = await navigator.mediaDevices!.getUserMedia({
    audio: micConstraints,
  });

  let displayStream: MediaStream | null = null;
  if (options.mixDisplayAudio) {
    try {
      displayStream = await navigator.mediaDevices!.getDisplayMedia({
        video: true,
        audio: true,
      });
      displayStream.getVideoTracks().forEach((t) => t.stop());
      if (!displayStream.getAudioTracks().length) {
        debug("Display capture had no audio; using microphone only");
        displayStream.getTracks().forEach((t) => t.stop());
        displayStream = null;
      }
    } catch {
      debug("Display audio not shared; using microphone only");
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
      outputSampleRate
    );
    if (pcm.length > 0) onPcmChunk(pcm);
  };

  const mute = audioContext.createGain();
  mute.gain.value = 0;
  processor.connect(mute);
  mute.connect(audioContext.destination);

  return {
    sampleMicRms01,
    dispose: async () => {
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
    },
  };
}
