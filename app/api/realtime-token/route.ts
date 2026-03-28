import { NextRequest, NextResponse } from "next/server";
import { createRealtimeClientSecret } from "@/lib/realtime-session";

export async function GET(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY is missing or empty. Add it to .env.local and restart the dev server.",
      },
      { status: 503 }
    );
  }

  try {
    const q = req.nextUrl.searchParams.get("noiseReduction");
    const noiseReduction =
      q === "near_field" || q === "far_field" ? q : undefined;
    const session = await createRealtimeClientSecret(
      noiseReduction ? { noiseReduction } : undefined
    );
    return NextResponse.json(session);
  } catch (err) {
    console.error("realtime-token", err);
    const message =
      err instanceof Error ? err.message : "OpenAI realtime session failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
