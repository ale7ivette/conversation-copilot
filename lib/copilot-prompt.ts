import type { CopilotScenario } from "@/lib/copilot-scenario";
import { SCENARIO_LABELS } from "@/lib/copilot-scenario";
import type { ClientHints } from "@/lib/client-hints";

const FIXED_SCENARIO_LINES: Record<
  Exclude<CopilotScenario, "auto">,
  string
> = {
  sales_call:
    "Session type: sales call. Favor discovery, qualification, and clear next steps. Sound credible and helpful, not pushy.",
  negotiation:
    "Session type: negotiation. Protect interests while finding workable trade space; be precise on terms and tradeoffs.",
  investor:
    "Session type: investor conversation. Be concise, evidence-grounded, and honest about risks and milestones.",
  meeting:
    "Session type: general meeting. Stay collaborative, action-oriented, and respectful of everyone's time.",
};

function scenarioToneParagraph(scenario: CopilotScenario | undefined): string {
  if (!scenario || scenario === "auto") return "";
  const label = SCENARIO_LABELS[scenario];
  const line = FIXED_SCENARIO_LINES[scenario];
  return [`Context: ${label}.`, line, ""].join("\n");
}

function clientHintsBlock(hints: ClientHints | undefined): string {
  if (!hints) return "";
  const parts: string[] = ["--- Client hints (use with transcript; may be incomplete) ---", ""];
  if (hints.speakerMapSummary)
    parts.push(`Speaker map: ${hints.speakerMapSummary}`);
  if (hints.lastCompletedLineRole != null) {
    parts.push(
      `Last completed line role: ${hints.lastCompletedLineRole}` +
        (hints.lastCompletedLineLabel
          ? ` (label ${hints.lastCompletedLineLabel})`
          : "")
    );
  }
  if (hints.micPrimaryGuess) {
    parts.push(
      `Mic correlation guess — label likely you: ${hints.micPrimaryGuess.diarizationLabel ?? "(none)"} (confidence ${hints.micPrimaryGuess.confidence.toFixed(2)}). ${hints.micPrimaryGuess.rationale}`
    );
  }
  if (hints.lastCueMeta) {
    parts.push(
      `Last committed segment: label=${hints.lastCueMeta.diarizationLabel ?? "n/a"}, time=${hints.lastCueMeta.committedAtMs}` +
        (hints.lastCueMeta.micRms01 != null
          ? `, mic RMS 0–1 snapshot≈${hints.lastCueMeta.micRms01.toFixed(3)}`
          : "")
    );
  }
  parts.push("", "--- End client hints ---", "");
  return parts.join("\n");
}

const AUTO_CONVERSATION_TYPES = [
  "small talk",
  "interview",
  "sales call",
  "customer support",
  "brainstorming",
  "negotiation",
  "status meeting",
  "Q&A",
  "presentation practice",
  "technical troubleshooting",
  "coaching",
] as const;

/**
 * Auto mode: detect conversation type + primary voice; rich options for Ask/Say card + details.
 */
export function buildCopilotAutoPrompt(
  trigger: string,
  transcript: string,
  hints: ClientHints | undefined
): string {
  const body = transcript.trim();
  const typesList = AUTO_CONVERSATION_TYPES.join(", ");
  return [
    "You help ONE human participant in a live conversation. Output a single JSON object only—no markdown, no code fences, no text before or after the JSON.",
    "",
    clientHintsBlock(hints),
    "Mode: AUTO-DETECT conversation type and primary voice each time (signals may shift). Re-evaluate from the full transcript.",
    "",
    `Pick detected_conversation_type from this closed set (exact spelling, lowercase where shown): ${typesList}. If unclear, choose the closest match and lower confidence_conversation_type.`,
    "",
    "Primary voice (who you are helping — only generate lines for this person to speak):",
    "Preference order: (1) client micPrimaryGuess.diarizationLabel if confidence is decent; (2) lines labeled me: or mapped as me in speaker map; (3) transcript cues for who is the 'user' being helped; (4) if still uncertain, assume the most active or initiating party is them and set confidence_primary_voice low.",
    "Do NOT write dialogue for other speakers. Every say_* and question_* must be first person I… or natural question phrasing for the primary voice to speak.",
    "",
    "Tone: adapt to detected type and counterpart (formal/informal, friendly/professional, empathetic/direct). Be succinct. No facts not supported by the transcript. If information is missing, still give best-guess say/question options AND a short clarifying_question for the user (or empty string if not needed).",
    "",
    "Below is the ENTIRE conversation so far (oldest first). Labels: me:, other:, unknown:, or diarization ids.",
    "",
    "--- Full transcript ---",
    body.length > 0 ? body : "(empty — stay conservative.)",
    "--- End transcript ---",
    "",
    `Trigger hint (why the copilot fired now): ${trigger}`,
    "",
    "JSON fields (all required strings use \"\" if unused; numbers 0–1 for confidences):",
    "next_question: BEST single question for the primary voice to ask next (verbatim, speakable).",
    "suggested_reply: BEST single line for the primary voice to say next (verbatim, first person where natural).",
    "goal, risk_flag, confidence: as before (confidence = overall suggestion quality).",
    "detected_conversation_type, primary_voice (short description), confidence_conversation_type, confidence_primary_voice, rationale_one_line.",
    "say_1..say_5: up to five distinct verbatim options (I…); unused slots \"\".",
    "question_1..question_5: up to five concise context-aware questions for the primary voice to ask; unused \"\".",
    "move_1..move_5: brief bullet-style key moves (short phrases); unused \"\".",
    "clarifying_question: one short question for the user if context is thin, else \"\".",
    "",
    "Banned: assistant filler, content for non-primary speakers, long essays, markdown inside strings.",
  ].join("\n");
}

/**
 * User-message builder for live copilot suggestions (fixed scenario modes).
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
