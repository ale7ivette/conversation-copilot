/** Room for one–two natural sentences per speakable field (JSON still compact). */
export const COPILOT_MAX_COMPLETION_TOKENS = 400;

/**
 * Minimum gap between copilot suggestion API calls (ms), unless
 * {@link import("./trigger-engine").detectLineTrigger} returns `direct_question`.
 * Target band: 5–8s.
 */
export const SUGGESTION_COOLDOWN_MS = 6500;
