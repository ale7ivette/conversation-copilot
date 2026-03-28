import { z } from "zod";

const conf01 = z.preprocess(
  (v) => {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return 0.5;
    return Math.min(1, Math.max(0, n));
  },
  z.number().min(0).max(1)
);

export const AutoDetailsNestedSchema = z.object({
  detected_conversation_type: z.string(),
  primary_voice: z.string(),
  confidence_conversation_type: conf01,
  confidence_primary_voice: conf01,
  rationale_one_line: z.string(),
  say_options: z.array(z.string()),
  smart_questions: z.array(z.string()),
  key_moves: z.array(z.string()),
  clarifying_question: z.string(),
});

export type AutoCopilotDetails = z.infer<typeof AutoDetailsNestedSchema>;

export const CopilotSuggestionSchema = z.object({
  next_question: z.string(),
  suggested_reply: z.string(),
  goal: z.string(),
  risk_flag: z.string(),
  confidence: conf01,
  autoDetails: AutoDetailsNestedSchema.optional().nullable(),
});

export type CopilotSuggestion = z.infer<typeof CopilotSuggestionSchema>;

/** Flat shape returned by the model in auto mode (strict JSON schema). */
export const AutoModelFlatSchema = z.object({
  next_question: z.string(),
  suggested_reply: z.string(),
  goal: z.string(),
  risk_flag: z.string(),
  confidence: conf01,
  detected_conversation_type: z.string(),
  primary_voice: z.string(),
  confidence_conversation_type: conf01,
  confidence_primary_voice: conf01,
  rationale_one_line: z.string(),
  say_1: z.string(),
  say_2: z.string(),
  say_3: z.string(),
  say_4: z.string(),
  say_5: z.string(),
  question_1: z.string(),
  question_2: z.string(),
  question_3: z.string(),
  question_4: z.string(),
  question_5: z.string(),
  move_1: z.string(),
  move_2: z.string(),
  move_3: z.string(),
  move_4: z.string(),
  move_5: z.string(),
  clarifying_question: z.string(),
});

export type AutoModelFlat = z.infer<typeof AutoModelFlatSchema>;

export function autoFlatToCopilotSuggestion(f: AutoModelFlat): CopilotSuggestion {
  const nonEmpty = (s: string) => s.trim().length > 0;
  return {
    next_question: f.next_question,
    suggested_reply: f.suggested_reply,
    goal: f.goal,
    risk_flag: f.risk_flag,
    confidence: f.confidence,
    autoDetails: {
      detected_conversation_type: f.detected_conversation_type,
      primary_voice: f.primary_voice,
      confidence_conversation_type: f.confidence_conversation_type,
      confidence_primary_voice: f.confidence_primary_voice,
      rationale_one_line: f.rationale_one_line,
      say_options: [f.say_1, f.say_2, f.say_3, f.say_4, f.say_5].filter(
        nonEmpty
      ),
      smart_questions: [
        f.question_1,
        f.question_2,
        f.question_3,
        f.question_4,
        f.question_5,
      ].filter(nonEmpty),
      key_moves: [f.move_1, f.move_2, f.move_3, f.move_4, f.move_5].filter(
        nonEmpty
      ),
      clarifying_question: f.clarifying_question.trim(),
    },
  };
}
