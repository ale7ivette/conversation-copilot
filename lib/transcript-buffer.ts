import { TRANSCRIPT_BUFFER_MAX_LINES } from "./realtime-settings";
import {
  promptLabelForLine,
  resolveSpeakerFromDiarization,
  type SpeakerMap,
} from "./diarization-speaker-map";

export type { SpeakerMap };

export type TranscriptLine = {
  speaker: "other" | "me" | "unknown";
  text: string;
  timestamp: number;
  /** Raw speaker id from diarization when present (e.g. SPEAKER_00). */
  diarizationLabel?: string;
};

export class TranscriptBuffer {
  private lines: TranscriptLine[] = [];
  /** Keep last 20–40 lines; default matches {@link TRANSCRIPT_BUFFER_MAX_LINES}. */
  private maxLines = TRANSCRIPT_BUFFER_MAX_LINES;

  add(line: TranscriptLine) {
    this.lines.push(line);
    if (this.lines.length > this.maxLines) {
      this.lines.shift();
    }
  }

  getRecentText() {
    return this.lines
      .map((l) => `${promptLabelForLine(l)}: ${l.text}`)
      .join("\n");
  }

  getLatestLine() {
    return this.lines[this.lines.length - 1] ?? null;
  }

  getAll() {
    return this.lines;
  }

  clear() {
    this.lines = [];
  }

  /** Re-apply diarization label → me/other mapping to existing lines. */
  relabelSpeakers(map: SpeakerMap) {
    for (const line of this.lines) {
      if (line.diarizationLabel) {
        line.speaker = resolveSpeakerFromDiarization(
          map,
          line.diarizationLabel
        );
      }
    }
  }
}
