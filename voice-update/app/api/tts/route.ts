import { NextResponse } from "next/server";

// OpenAI text-to-speech. Returns MP3 audio bytes the browser plays.
// Voices: alloy, echo, fable, onyx, nova, shimmer (we default to "nova" — fitting).
export async function POST(req: Request) {
  const { text, voice, apiKey } = (await req.json().catch(() => ({}))) as {
    text?: string; voice?: string; apiKey?: string;
  };
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "Add your OpenAI key in Settings." }, { status: 400 });
  if (!text?.trim()) return NextResponse.json({ error: "Nothing to speak." }, { status: 400 });

  try {
    const r = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: voice || "nova",
        input: text.slice(0, 4000),
      }),
    });
    if (!r.ok) {
      const detail = await r.text();
      return NextResponse.json({ error: `TTS failed: ${detail.slice(0, 200)}` }, { status: 500 });
    }
    const audio = await r.arrayBuffer();
    return new NextResponse(audio, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Couldn't reach OpenAI for speech." }, { status: 500 });
  }
}
