export const SUGGESTION_TIMING_OPTIONS = ["auto", "manual"] as const;
export type SuggestionTiming = (typeof SUGGESTION_TIMING_OPTIONS)[number];

const STORAGE_KEY = "copilot-suggestion-timing";

export function loadPersistedSuggestionTiming(): SuggestionTiming {
  if (typeof window === "undefined") return "auto";
  const v = localStorage.getItem(STORAGE_KEY)?.trim();
  if (v && (SUGGESTION_TIMING_OPTIONS as readonly string[]).includes(v)) {
    return v as SuggestionTiming;
  }
  return "auto";
}

export function savePersistedSuggestionTiming(t: SuggestionTiming) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, t);
}

export const SUGGESTION_TIMING_LABELS: Record<SuggestionTiming, string> = {
  auto: "Automatic",
  manual: "On demand",
};
