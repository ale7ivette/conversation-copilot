import type { TriggerReason } from "./trigger-engine";
import { SUGGESTION_MIN_INTERVAL_MS } from "./copilot-settings";

/**
 * Whether a new suggestion request is allowed.
 * All triggers share the same minimum interval (including `direct_question`).
 */
export function canRequestSuggestion(
  reason: TriggerReason,
  lastSuggestionAtMs: number | null,
  nowMs: number = Date.now()
): boolean {
  if (reason === "none") return false;
  if (reason === "manual") return true;
  if (lastSuggestionAtMs === null) return true;
  return nowMs - lastSuggestionAtMs >= SUGGESTION_MIN_INTERVAL_MS;
}
