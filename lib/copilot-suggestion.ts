import OpenAI from "openai";
import type { CopilotScenario } from "@/lib/copilot-scenario";
import { COPILOT_MAX_COMPLETION_TOKENS } from "./copilot-settings";
import { buildCopilotNegotiationPrompt } from "./copilot-prompt";
import { CopilotSuggestionSchema } from "./schema";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/** JSON Schema for OpenAI structured outputs (strict). Descriptions steer model behavior. */
const COPILOT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    next_question: {
      type: "string",
      description:
        "Verbatim question the user can read aloud in one natural breath—exact words, not a summary or topic label. Empty string if none. Experienced-professional tone, references transcript when relevant.",
    },
    suggested_reply: {
      type: "string",
      description:
        "Verbatim first-person line the user can speak next—human dialogue, credible expert, warm and confident without arrogance. No bullets, no assistant filler. Empty string if silence is better.",
    },
    goal: {
      type: "string",
      description: "User's immediate objective in one short phrase.",
    },
    risk_flag: {
      type: "string",
      description: 'Main risk or "none".',
    },
    confidence: {
      type: "number",
      description: "0–1 confidence given the transcript.",
    },
  },
  required: [
    "next_question",
    "suggested_reply",
    "goal",
    "risk_flag",
    "confidence",
  ],
} as const;

export async function generateCopilotSuggestion(input: {
  transcript: string;
  trigger: string;
  scenario?: CopilotScenario;
}) {
  const { transcript, trigger, scenario } = input;

  const userContent = buildCopilotNegotiationPrompt(
    trigger,
    transcript,
    scenario
  );

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "developer",
        content:
          "You output only valid JSON for the schema. next_question and suggested_reply must be ready-to-speak verbatim lines (not ideas or labels), grounded in the full transcript the user provides. Tone: seasoned professional peer—natural speech, not robotic, not AI-assistant phrasing.",
      },
      { role: "user", content: userContent },
    ],
    max_completion_tokens: COPILOT_MAX_COMPLETION_TOKENS,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "copilot_suggestion",
        strict: true,
        schema: COPILOT_JSON_SCHEMA,
      },
    },
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("Empty model response");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new Error("Model returned non-JSON");
  }

  const result = CopilotSuggestionSchema.safeParse(parsedJson);
  if (!result.success) {
    const err = new Error("Response failed Zod validation");
    throw Object.assign(err, { cause: result.error.flatten() });
  }

  return result.data;
}
