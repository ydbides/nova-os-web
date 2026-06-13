import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { messages, system, apiKey } = (await req.json().catch(() => ({}))) as { messages?: { role: string; content: string }[]; system?: string; apiKey?: string };
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key)
    return NextResponse.json({
      text: "I can chat once you add an OpenAI API key in Settings. Commands like “open safari”, “play music” and “remind me to …” work without one.",
    });
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 500,
        messages: [{ role: "system", content: system || "You are NOVA, a concise friendly assistant." },
          ...(Array.isArray(messages) ? messages.slice(-10) : [])],
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      const msg = data?.error?.message || `API error ${r.status}`;
      return NextResponse.json({ text: `AI error: ${msg}` });
    }
    return NextResponse.json({ text: data.choices?.[0]?.message?.content?.trim() || "…" });
  } catch {
    return NextResponse.json({ text: "Couldn't reach OpenAI — check your internet." });
  }
}
