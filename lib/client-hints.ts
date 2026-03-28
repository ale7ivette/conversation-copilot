import { z } from "zod";

export const MicPrimaryGuessSchema = z.object({
  diarizationLabel: z.string().optional(),
  confidence: z.preprocess(
    (v) => {
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n)) return 0.25;
      return Math.min(1, Math.max(0, n));
    },
    z.number().min(0).max(1)
  ),
  rationale: z.string(),
});

export const LastCueMetaSchema = z.object({
  diarizationLabel: z.string().optional(),
  committedAtMs: z.number(),
  micRms01: z.preprocess(
    (v) => {
      if (v === null || v === undefined) return undefined;
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n)) return undefined;
      return Math.min(1, Math.max(0, n));
    },
    z.number().min(0).max(1).optional()
  ),
});

const ClientHintsObjectSchema = z.object({
  speakerMapSummary: z.string().optional(),
  lastCompletedLineLabel: z.string().optional(),
  lastCompletedLineRole: z.enum(["me", "other", "unknown"]).optional(),
  micPrimaryGuess: MicPrimaryGuessSchema.optional(),
  lastCueMeta: LastCueMetaSchema.optional(),
});

export const ClientHintsSchema = ClientHintsObjectSchema.optional();

export type ClientHints = z.infer<typeof ClientHintsObjectSchema>;

export function buildSpeakerMapSummary(
  map: Record<string, "me" | "other">
): string {
  const entries = Object.entries(map).filter(
    ([, v]) => v === "me" || v === "other"
  );
  if (entries.length === 0) return "(no diarization labels mapped to me/other)";
  return entries.map(([k, v]) => `${k}→${v}`).join(", ");
}
