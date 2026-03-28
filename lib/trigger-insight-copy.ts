import type { TriggerReason } from "@/lib/trigger-engine";

/** Human-readable insight for the UI (no system trigger codes). */
export function triggerInsightLabel(reason: TriggerReason): string | null {
  switch (reason) {
    case "direct_question":
      return "They asked a direct question";
    case "price_budget_scope":
      return "They mentioned budget or scope";
    case "objection":
      return "Objection raised";
    case "pause":
      return "Pause detected — good moment to contribute";
    case "thought_finished":
      return "They finished a thought";
    case "manual":
      return "You asked for suggestions";
    case "none":
      return null;
  }
}
