/**
 * Local, deterministic trigger engine.
 *
 * Line-based priority (first match wins):
 * 1. direct_question — contains "?"
 * 2. price_budget_scope — price, budget, scope, timeline, approval, concern
 * 3. objection — objection / risk phrases (longest phrase matched first)
 * 4. thought_finished — sentence ends with . ! or … (not a question)
 * 5. general_line — substantive line that matched none of the above (min length)
 *
 * Pause is only emitted from the silence timer (see DEFAULT_PAUSE_MS), not from text alone.
 */

/** Minimum trimmed length for `general_line` when no higher-priority trigger matches. */
export const GENERAL_LINE_MIN_CHARS = 12;

export const TRIGGER_REASONS = [
  "thought_finished",
  "price_budget_scope",
  "pause",
  "direct_question",
  "objection",
  "general_line",
  "none",
] as const;

export type TriggerReason = (typeof TRIGGER_REASONS)[number];

const PRICE_BUDGET_TOPIC = [
  "price",
  "budget",
  "scope",
  "timeline",
  "approval",
  "concern",
] as const;

/** Longest phrases first — deterministic substring checks. */
const OBJECTION_PHRASES: readonly string[] = [
  "too expensive",
  "not sure",
  "need approval",
  "push back",
  "problem with",
  "doesn't work",
  "hold off",
  "not ready",
  "can't commit",
  "won't work",
  "hesitate",
  "expensive",
  "objection",
  "worried",
  "can't",
  "won't",
  "later",
];

export const DEFAULT_PAUSE_MS = 1400;

function normalizeTranscript(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function wordBagKey(normalized: string): string {
  const words = normalized.match(/\w+/g) ?? [];
  return [...new Set(words)].sort().join("\u0001");
}

function isDirectQuestion(line: string): boolean {
  return line.includes("?");
}

function matchesPriceBudgetScope(normalized: string): boolean {
  return PRICE_BUDGET_TOPIC.some((k) => normalized.includes(k));
}

function matchesObjection(normalized: string): boolean {
  return OBJECTION_PHRASES.some((p) => normalized.includes(p));
}

function isThoughtFinished(line: string): boolean {
  const t = line.trim();
  if (t.length === 0) return false;
  if (t.includes("?")) return false;
  return /[.!…]\s*$/.test(t);
}

/**
 * Signals from the latest transcript line only. Does not emit `pause` (use the silence timer).
 */
export function detectLineTrigger(latestLine: string): TriggerReason {
  const normalized = normalizeTranscript(latestLine);
  if (normalized.length === 0) return "none";

  if (isDirectQuestion(latestLine)) return "direct_question";
  if (matchesPriceBudgetScope(normalized)) return "price_budget_scope";
  if (matchesObjection(normalized)) return "objection";
  if (isThoughtFinished(latestLine)) return "thought_finished";

  if (latestLine.trim().length >= GENERAL_LINE_MIN_CHARS) {
    return "general_line";
  }

  return "none";
}

/**
 * Blocks repeat copilot calls for the same reason on identical or nearly identical
 * transcript text (exact match, or same word-bag under the same reason).
 */
export class TriggerDeduper {
  private readonly maxEntries = 8;
  private history: { exact: string; soft: string; reason: TriggerReason }[] = [];

  tryConsume(
    reason: Exclude<TriggerReason, "none">,
    transcript: string
  ): boolean {
    const n = normalizeTranscript(transcript);
    const exact = `${reason}::${n}`;
    const soft = `${reason}::${wordBagKey(n)}`;

    for (const h of this.history) {
      if (h.exact === exact) return false;
      if (h.reason === reason && h.soft === soft) return false;
    }

    this.history.push({ exact, soft, reason });
    if (this.history.length > this.maxEntries) this.history.shift();
    return true;
  }

  reset(): void {
    this.history = [];
  }
}
