import { promptLabelForLine } from "@/lib/diarization-speaker-map";
import type { TranscriptLine } from "@/lib/transcript-buffer";

export function formatTranscriptForExport(
  lines: TranscriptLine[],
  opts?: {
    sessionStartedAtMs?: number | null;
    liveLine?: string;
  }
): string {
  const parts: string[] = ["Conversation Copilot — transcript", ""];
  if (opts?.sessionStartedAtMs != null) {
    parts.push(
      `Session start: ${new Date(opts.sessionStartedAtMs).toISOString()}`,
      ""
    );
  }
  for (const line of lines) {
    parts.push(`${promptLabelForLine(line)}: ${line.text}`);
  }
  if (opts?.liveLine?.trim()) {
    parts.push("", `--- In progress ---`, opts.liveLine.trim());
  }
  return parts.join("\n");
}
