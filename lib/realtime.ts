import type { ClientSecretCreateResponse } from "openai/resources/realtime/client-secrets";
import type { ClientHints } from "@/lib/client-hints";
import type { CopilotScenario } from "@/lib/copilot-scenario";
import { CopilotSuggestionSchema, type CopilotSuggestion } from "./schema";
import { COPILOT_SYSTEM_PROMPT } from "./prompt";

export type { ClientSecretCreateResponse };

export async function getRealtimeToken(options?: {
  noiseReduction?: "near_field" | "far_field";
}): Promise<ClientSecretCreateResponse> {
  const q =
    options?.noiseReduction === "near_field" ||
    options?.noiseReduction === "far_field"
      ? `?noiseReduction=${encodeURIComponent(options.noiseReduction)}`
      : "";
  const res = await fetch(`/api/realtime-token${q}`);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) detail = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(
      res.status === 503
        ? detail
        : `Realtime token failed (${res.status}): ${detail}`
    );
  }
  return res.json() as Promise<ClientSecretCreateResponse>;
}

export async function getAssemblyAiStreamingToken(): Promise<string> {
  const res = await fetch("/api/assemblyai-streaming-token");
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) detail = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(
      res.status === 503
        ? detail
        : `AssemblyAI token failed (${res.status}): ${detail}`
    );
  }
  const data = (await res.json()) as { token?: string };
  if (!data.token?.trim()) {
    throw new Error("AssemblyAI token response missing token.");
  }
  return data.token;
}

export async function requestCopilotSuggestion(args: {
  transcript: string;
  trigger: string;
  scenario?: CopilotScenario;
  clientHints?: ClientHints;
}): Promise<CopilotSuggestion> {
  const res = await fetch("/api/copilot-suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) detail = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(
      res.status === 503
        ? detail
        : `Suggestion request failed (${res.status}): ${detail}`
    );
  }

  const data = await res.json();
  return CopilotSuggestionSchema.parse(data);
}

export { COPILOT_SYSTEM_PROMPT };
