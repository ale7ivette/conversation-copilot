/** Models accepted for Universal Streaming v3 (query `speech_model`). */
const MODEL_WHITELIST = new Set([
  "universal-streaming-english",
  "universal-streaming-multilingual",
  "u3-rt-pro",
  "whisper-rt",
]);

const envModel = process.env.NEXT_PUBLIC_ASSEMBLYAI_SPEECH_MODEL?.trim();

export type AssemblyAiSpeechModel =
  | "universal-streaming-english"
  | "universal-streaming-multilingual"
  | "u3-rt-pro"
  | "whisper-rt";

export const ASSEMBLYAI_STREAMING_SPEECH_MODEL: AssemblyAiSpeechModel =
  envModel && MODEL_WHITELIST.has(envModel)
    ? (envModel as AssemblyAiSpeechModel)
    : "universal-streaming-english";

/** AssemblyAI Universal Streaming expects 16 kHz PCM by default. */
export const ASSEMBLYAI_STREAMING_SAMPLE_RATE = 16000;
