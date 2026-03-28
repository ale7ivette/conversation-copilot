import { NextResponse } from "next/server";
import { AssemblyAI } from "assemblyai";
import { getServerTranscriptionProvider } from "@/lib/transcription-provider-server";

const DEFAULT_EXPIRES = 480;

export async function GET() {
  if (getServerTranscriptionProvider() !== "assemblyai") {
    return NextResponse.json(
      {
        error:
          "AssemblyAI is not enabled. Set TRANSCRIPTION_PROVIDER=assemblyai and NEXT_PUBLIC_TRANSCRIPTION_PROVIDER=assemblyai (same value on server and client).",
      },
      { status: 400 }
    );
  }

  const apiKey = process.env.ASSEMBLYAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "ASSEMBLYAI_API_KEY is missing or empty. Add it to .env.local and restart the dev server.",
      },
      { status: 503 }
    );
  }

  try {
    const client = new AssemblyAI({ apiKey });
    const token = await client.streaming.createTemporaryToken({
      expires_in_seconds: DEFAULT_EXPIRES,
      max_session_duration_seconds: 10_800,
    });
    return NextResponse.json({ token, expires_in_seconds: DEFAULT_EXPIRES });
  } catch (err) {
    console.error("assemblyai-streaming-token", err);
    const detail =
      err instanceof Error ? err.message : "Failed to create streaming token";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
