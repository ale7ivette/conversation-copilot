/** Room for one–two natural sentences per speakable field (JSON still compact). */
export const COPILOT_MAX_COMPLETION_TOKENS = 400;

/**
 * Minimum gap between **any** copilot suggestion API calls (ms), including
 * `direct_question` and `pause`. Keeps suggestions from flipping every second.
 */
export const SUGGESTION_MIN_INTERVAL_MS = 15_000;

/** @deprecated Use {@link SUGGESTION_MIN_INTERVAL_MS} (same value). */
export const SUGGESTION_COOLDOWN_MS = SUGGESTION_MIN_INTERVAL_MS;

/**
 * Silence after a transcript line before the pause trigger runs (end-of-turn).
 * Used by the silence timer in the page and documented in the test panel.
 */
export const PAUSE_TRIGGER_MS = 4_500;
