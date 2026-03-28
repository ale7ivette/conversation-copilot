export type TranscriptionProvider = "assemblyai" | "openai";

/**
 * Client-side transcription backend (must match server `TRANSCRIPTION_PROVIDER`).
 */
export function getClientTranscriptionProvider(): TranscriptionProvider {
  const p =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_TRANSCRIPTION_PROVIDER?.trim().toLowerCase()
      : undefined;
  if (p === "assemblyai") return "assemblyai";
  return "openai";
}
