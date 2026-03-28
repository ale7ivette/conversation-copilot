import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateCopilotSuggestion } from "@/lib/copilot-suggestion";

const RequestBodySchema = z.object({
  transcript: z.string(),
  trigger: z.string(),
});

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY is missing or empty. Add it to .env.local and restart the dev server.",
      },
      { status: 503 }
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedBody = RequestBodySchema.safeParse(json);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsedBody.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const suggestion = await generateCopilotSuggestion(parsedBody.data);
    return NextResponse.json(suggestion);
  } catch (err) {
    console.error("copilot-suggest", err);
    return NextResponse.json(
      { error: "Failed to generate suggestion" },
      { status: 502 }
    );
  }
}
