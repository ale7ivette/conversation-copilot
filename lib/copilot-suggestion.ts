import OpenAI from "openai";
import type { ChatCompletion } from "openai/resources/chat/completions";
import type { CopilotScenario } from "@/lib/copilot-scenario";
import type { ClientHints } from "@/lib/client-hints";
import {
  COPILOT_MAX_COMPLETION_TOKENS,
  COPILOT_MAX_COMPLETION_TOKENS_AUTO,
} from "./copilot-settings";
import {
  buildCopilotAutoPrompt,
  buildCopilotNegotiationPrompt,
} from "./copilot-prompt";
import {
  autoFlatToCopilotSuggestion,
  AutoModelFlatSchema,
  CopilotSuggestionSchema,
  type CopilotSuggestion,
} from "./schema";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function extractJsonTextFromCompletion(completion: ChatCompletion): string {
  const choice = completion.choices[0];
  const message = choice?.message;
  if (!message) throw new Error("No assistant message in completion");
  if (message.refusal) {
    throw new Error(`Model refused: ${message.refusal}`);
  }
  const raw = message.content;
  if (raw == null || raw === "") {
    const reason = choice?.finish_reason ?? "unknown";
    throw new Error(
      `Empty model content (finish_reason=${reason}). Try again or shorten the prompt.`
    );
  }
  return raw;
}

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

/** Strict mode: every property needs a description (OpenAI API requirement). */
const AUTO_COPILOT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    next_question: {
      type: "string",
      description:
        "Best single verbatim question for the primary voice to ask next; empty string if none.",
    },
    suggested_reply: {
      type: "string",
      description:
        "Best single verbatim line for the primary voice to say next; empty string if silence is better.",
    },
    goal: {
      type: "string",
      description: "Immediate objective in one short phrase.",
    },
    risk_flag: {
      type: "string",
      description: 'Main risk or the literal word "none".',
    },
    confidence: {
      type: "number",
      description: "Overall 0–1 confidence in these suggestions.",
    },
    detected_conversation_type: {
      type: "string",
      description:
        "One of: small talk, interview, sales call, customer support, brainstorming, negotiation, status meeting, Q&A, presentation practice, technical troubleshooting, coaching.",
    },
    primary_voice: {
      type: "string",
      description:
        "Short label for who you are helping (the user), e.g. diarization id or role.",
    },
    confidence_conversation_type: {
      type: "number",
      description: "0–1 confidence in detected_conversation_type.",
    },
    confidence_primary_voice: {
      type: "number",
      description: "0–1 confidence in primary_voice identification.",
    },
    rationale_one_line: {
      type: "string",
      description: "One line why this type and primary voice were chosen.",
    },
    say_1: { type: "string", description: "First verbatim I-line option." },
    say_2: { type: "string", description: "Second verbatim I-line option or empty." },
    say_3: { type: "string", description: "Third verbatim I-line option or empty." },
    say_4: { type: "string", description: "Fourth verbatim I-line option or empty." },
    say_5: { type: "string", description: "Fifth verbatim I-line option or empty." },
    question_1: {
      type: "string",
      description: "First concise question for the primary voice or empty.",
    },
    question_2: {
      type: "string",
      description: "Second concise question or empty.",
    },
    question_3: {
      type: "string",
      description: "Third concise question or empty.",
    },
    question_4: {
      type: "string",
      description: "Fourth concise question or empty.",
    },
    question_5: {
      type: "string",
      description: "Fifth concise question or empty.",
    },
    move_1: { type: "string", description: "First brief key move or empty." },
    move_2: { type: "string", description: "Second brief key move or empty." },
    move_3: { type: "string", description: "Third brief key move or empty." },
    move_4: { type: "string", description: "Fourth brief key move or empty." },
    move_5: { type: "string", description: "Fifth brief key move or empty." },
    clarifying_question: {
      type: "string",
      description:
        "One short question for the user if context is thin; empty string if not needed.",
    },
  },
  required: [
    "next_question",
    "suggested_reply",
    "goal",
    "risk_flag",
    "confidence",
    "detected_conversation_type",
    "primary_voice",
    "confidence_conversation_type",
    "confidence_primary_voice",
    "rationale_one_line",
    "say_1",
    "say_2",
    "say_3",
    "say_4",
    "say_5",
    "question_1",
    "question_2",
    "question_3",
    "question_4",
    "question_5",
    "move_1",
    "move_2",
    "move_3",
    "move_4",
    "move_5",
    "clarifying_question",
  ],
} as const;

function expandTriggerForPrompt(trigger: string): string {
  if (trigger === "manual") {
    return "manual — user explicitly requested suggestions (Suggest now); give strong, relevant questions and lines without waiting for a pause or line trigger.";
  }
  return trigger;
}

export async function generateCopilotSuggestion(input: {
  transcript: string;
  trigger: string;
  scenario?: CopilotScenario;
  clientHints?: ClientHints;
}): Promise<CopilotSuggestion> {
  const { transcript, trigger, scenario, clientHints } = input;
  const triggerHint = expandTriggerForPrompt(trigger);

  if (scenario === "auto") {
    const userContent = buildCopilotAutoPrompt(
      triggerHint,
      transcript,
      clientHints
    );
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "developer",
          content:
            "You output only valid JSON matching the schema. All say_* and question_* are verbatim lines for the PRIMARY voice only (first person where natural). Ground everything in the transcript and client hints. Be succinct.",
        },
        { role: "user", content: userContent },
      ],
      max_completion_tokens: COPILOT_MAX_COMPLETION_TOKENS_AUTO,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "copilot_suggestion_auto",
          strict: true,
          schema: AUTO_COPILOT_JSON_SCHEMA,
        },
      },
    });

    const raw = extractJsonTextFromCompletion(response);
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      throw new Error("Model returned non-JSON");
    }
    const flat = AutoModelFlatSchema.safeParse(parsedJson);
    if (!flat.success) {
      const err = new Error("Response failed Zod validation (auto)");
      throw Object.assign(err, { cause: flat.error.flatten() });
    }
    const merged = autoFlatToCopilotSuggestion(flat.data);
    const check = CopilotSuggestionSchema.safeParse(merged);
    if (!check.success) {
      const err = new Error("Merged auto response failed validation");
      throw Object.assign(err, { cause: check.error.flatten() });
    }
    return check.data;
  }

  const userContent = buildCopilotNegotiationPrompt(
    triggerHint,
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

  const raw = extractJsonTextFromCompletion(response);
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
