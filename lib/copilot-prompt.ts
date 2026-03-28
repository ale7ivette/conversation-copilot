import type { CopilotScenario } from "@/lib/copilot-scenario";
import { SCENARIO_LABELS } from "@/lib/copilot-scenario";

function scenarioToneParagraph(scenario: CopilotScenario | undefined): string {
  if (!scenario) return "";
  const label = SCENARIO_LABELS[scenario];
  const lines: Record<CopilotScenario, string> = {
    sales_call:
      "Session type: sales call. Favor discovery, qualification, and clear next steps. Sound credible and helpful, not pushy.",
    negotiation:
      "Session type: negotiation. Protect interests while finding workable trade space; be precise on terms and tradeoffs.",
    investor:
      "Session type: investor conversation. Be concise, evidence-grounded, and honest about risks and milestones.",
    meeting:
      "Session type: general meeting. Stay collaborative, action-oriented, and respectful of everyone's time.",
  };
  return [`Context: ${label}.`, lines[scenario], ""].join("\n");
}

/**
 * User-message builder for live copilot suggestions.
 * Pairs with structured JSON schema; stresses verbatim, speakable, expert tone.
 */
export function buildCopilotNegotiationPrompt(
  trigger: string,
  transcript: string,
  scenario?: CopilotScenario
): string {
  const body = transcript.trim();
  const scenarioBlock = scenarioToneParagraph(scenario);
  return [
    "You help the user in live professional conversations. Output a single JSON object only—no markdown, no code fences, no text before or after the JSON.",
    scenarioBlock,
    "",
    "Below is the ENTIRE conversation so far, in chronological order (oldest at the top, newest at the bottom). Each line may start with a speaker label: me:, other:, unknown:, or a diarization id (e.g. SPEAKER_00) — use that to tell who said what. Ground next_question and suggested_reply in this full thread: names, numbers, constraints, tone shifts, and anything already promised or questioned.",
    "",
    "--- Full transcript ---",
    body.length > 0 ? body : "(empty — very little has been said yet; stay conservative.)",
    "--- End transcript ---",
    "",
    `Trigger hint (why the copilot fired now): ${trigger}`,
    "",
    "Field requirements:",
    "",
    "next_question:",
    "- Exact words the user can speak aloud as ONE natural question (or empty string \"\" if no good question fits).",
    "- Not a topic label, not meta (\"ask about pricing\"), no quotation marks around the question, no stage directions.",
    "- Sound like a sharp, experienced peer who has done this many times—smart, specific, and easy to say in one breath.",
    "",
    "suggested_reply:",
    "- Exact words the user can say aloud as their next contribution—first person, conversational, human.",
    "- Convey deep experience and credibility without boasting; confident, warm, professional. Leave the other person with a strong impression of competence and judgment.",
    "- Not a bullet list, not assistant filler (\"Happy to help\", \"I'd be glad to\"), not robotic formality stacks.",
    "- Use \"\" if staying quiet is the stronger move.",
    "",
    "goal: One short phrase describing what the user is trying to achieve in this moment.",
    'risk_flag: The main risk or blocker in one short phrase, or the literal word "none".',
    "confidence: number from 0 to 1.",
    "",
    "Banned: phrases that sound like an AI assistant, generic platitudes, numbered lists inside strings, meta commentary about \"the conversation\", or content that ignores the transcript.",
  ].join("\n");
}
