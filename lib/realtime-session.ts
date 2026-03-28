import OpenAI from "openai";
import { COPILOT_SYSTEM_PROMPT } from "./prompt";
import {
  DEFAULT_REALTIME_NOISE_REDUCTION,
  DEFAULT_TRANSCRIPTION_LANGUAGE,
  REALTIME_INPUT_TRANSCRIPTION_MODEL,
  REALTIME_MAX_OUTPUT_TOKENS,
} from "./realtime-settings";

export async function createRealtimeClientSecret(options?: {
  noiseReduction?: "near_field" | "far_field";
}) {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const noiseType =
    options?.noiseReduction ?? DEFAULT_REALTIME_NOISE_REDUCTION;

  return client.realtime.clientSecrets.create({
    session: {
      type: "realtime",
      model: "gpt-realtime",
      // Text-only model output (no TTS stream).
      output_modalities: ["text"],
      instructions: COPILOT_SYSTEM_PROMPT,
      audio: {
        input: {
          format: { type: "audio/pcm", rate: 24000 },
          noise_reduction: { type: noiseType },
          transcription: {
            model: REALTIME_INPUT_TRANSCRIPTION_MODEL,
            language: DEFAULT_TRANSCRIPTION_LANGUAGE,
          },
          turn_detection: {
            type: "server_vad",
            // Auto-response off — transcription/VAD without forcing a model reply.
            create_response: false,
          },
        },
      },
      max_output_tokens: REALTIME_MAX_OUTPUT_TOKENS,
    },
  });
}
