import type { TriggerReason } from "./trigger-engine";
import { SUGGESTION_COOLDOWN_MS } from "./copilot-settings";

/**
 * Whether a new suggestion request is allowed (5–8s band, except
 * `direct_question` which bypasses the cooldown).
 */
export function canRequestSuggestion(
  reason: TriggerReason,
  lastSuggestionAtMs: number | null,
  nowMs: number = Date.now()
): boolean {
  if (reason === "none") return false;
  if (reason === "direct_question") return true;
  if (lastSuggestionAtMs === null) return true;
  return nowMs - lastSuggestionAtMs >= SUGGESTION_COOLDOWN_MS;
}
