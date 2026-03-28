import { z } from "zod";

export const CopilotSuggestionSchema = z.object({
  next_question: z.string(),
  suggested_reply: z.string(),
  goal: z.string(),
  risk_flag: z.string(),
  confidence: z.number().min(0).max(1),
});

export type CopilotSuggestion = z.infer<typeof CopilotSuggestionSchema>;
