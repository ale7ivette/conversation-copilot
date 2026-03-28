const STORAGE_KEY = "copilot-diarization-speaker-map";

export type SpeakerMap = Record<string, "me" | "other">;

export function loadSpeakerMap(): SpeakerMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: SpeakerMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (v === "me" || v === "other") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveSpeakerMap(map: SpeakerMap): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota */
  }
}

/** Map API diarization label to transcript role; unmapped labels → unknown. */
export function resolveSpeakerFromDiarization(
  map: SpeakerMap,
  diarizationLabel?: string
): "me" | "other" | "unknown" {
  if (!diarizationLabel?.trim()) return "unknown";
  const key = diarizationLabel.trim();
  const mapped = map[key];
  if (mapped === "me" || mapped === "other") return mapped;
  return "unknown";
}

/** Line shown in copilot / prompt: clear roles or raw diarization id. */
export function promptLabelForLine(line: {
  speaker: "me" | "other" | "unknown";
  diarizationLabel?: string;
}): string {
  if (line.speaker === "me") return "me";
  if (line.speaker === "other") return "other";
  if (line.diarizationLabel?.trim()) return line.diarizationLabel.trim();
  return "unknown";
}
