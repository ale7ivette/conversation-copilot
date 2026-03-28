/**
 * Server-side Realtime session defaults (see OpenAI Realtime docs).
 * Language: set explicitly when known; override with TRANSCRIPTION_LANGUAGE.
 */
export const DEFAULT_TRANSCRIPTION_LANGUAGE =
  process.env.TRANSCRIPTION_LANGUAGE?.trim() || "en";

/**
 * Realtime input transcription model. Default is widely available.
 * Set REALTIME_TRANSCRIPTION_MODEL=gpt-4o-transcribe-diarize when your
 * OpenAI org has access (speaker segments + mapping UI).
 *
 * @see https://platform.openai.com/docs/guides/realtime
 */
const TRANSCRIPTION_MODEL_WHITELIST = new Set([
  "gpt-4o-mini-transcribe",
  "gpt-4o-mini-transcribe-2025-12-15",
  "gpt-4o-transcribe",
  "gpt-4o-transcribe-diarize",
  "whisper-1",
]);

const envTranscriptionModel = process.env.REALTIME_TRANSCRIPTION_MODEL?.trim();

export const REALTIME_INPUT_TRANSCRIPTION_MODEL =
  envTranscriptionModel &&
  TRANSCRIPTION_MODEL_WHITELIST.has(envTranscriptionModel)
    ? envTranscriptionModel
    : "gpt-4o-mini-transcribe";

/**
 * Max transcript lines kept per session (oldest dropped).
 * Use `NEXT_PUBLIC_TRANSCRIPT_SESSION_MAX_LINES` so the client bundle picks it up.
 */
const rawSessionMax = parseInt(
  process.env.NEXT_PUBLIC_TRANSCRIPT_SESSION_MAX_LINES?.trim() ?? "",
  10
);
export const TRANSCRIPT_SESSION_MAX_LINES =
  Number.isFinite(rawSessionMax) && rawSessionMax >= 40 && rawSessionMax <= 50_000
    ? rawSessionMax
    : 2000;

/** Text-only assistant output; keep small to limit latency/cost. */
export const REALTIME_MAX_OUTPUT_TOKENS = 120;

/**
 * Realtime input noise reduction profile (server session).
 * far_field suits laptop / room mics; near_field suits headsets.
 * Client can override per session via /api/realtime-token?noiseReduction=...
 */
const NOISE_REDUCTION_WHITELIST = new Set(["near_field", "far_field"]);
const envNoiseReduction = process.env.REALTIME_INPUT_NOISE_REDUCTION?.trim();

export const DEFAULT_REALTIME_NOISE_REDUCTION: "near_field" | "far_field" =
  envNoiseReduction &&
  NOISE_REDUCTION_WHITELIST.has(envNoiseReduction)
    ? (envNoiseReduction as "near_field" | "far_field")
    : "near_field";
