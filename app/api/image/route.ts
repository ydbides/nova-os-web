import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { prompt, apiKey } = (await req.json().catch(() => ({}))) as { prompt?: string; apiKey?: string };
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "Add an OpenAI API key in Settings first." });
  if (!prompt?.trim()) return NextResponse.json({ error: "Describe the image first." });
  try {
    const r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "gpt-image-1", prompt: String(prompt).slice(0, 800), size: "1024x1024" }),
    });
    const data = await r.json();
    if (!r.ok) return NextResponse.json({ error: data?.error?.message || `API error ${r.status}` });
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) return NextResponse.json({ error: "No image returned." });
    return NextResponse.json({ image: `data:image/png;base64,${b64}` });
  } catch {
    return NextResponse.json({ error: "Couldn't reach OpenAI — check your internet." });
  }
}
