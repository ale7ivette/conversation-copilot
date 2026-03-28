import type { TranscriptionProvider } from "@/lib/transcription-provider";

/** Server-side: default `openai` for backward compatibility; set `assemblyai` to use AssemblyAI. */
export function getServerTranscriptionProvider(): TranscriptionProvider {
  const p = process.env.TRANSCRIPTION_PROVIDER?.trim().toLowerCase();
  if (p === "assemblyai") return "assemblyai";
  return "openai";
}
