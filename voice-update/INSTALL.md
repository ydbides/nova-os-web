# NOVA Voice Mode + OpenAI TTS — install

Three files, dropped into your project:

1. `app/voicemode.tsx`        → NEW file, into app/
2. `app/api/tts/route.ts`     → NEW file: make folder app/api/tts/, put route.ts inside
3. `app/page.tsx`             → REPLACE your existing one

Then in the terminal:
    git add .
    git commit -m "Add voice mode with OpenAI TTS and reactive orb"
    git push

Vercel rebuilds in ~2 min.

## Using it
- A glowing ◆ button sits bottom-right on every page. Tap it → full-screen Voice Mode.
- Tap the orb → it listens (mic permission popup the first time — Allow).
- Speak a command or question. The orb turns amber while thinking, then pulses
  in time with NOVA's actual voice while it speaks (real OpenAI "nova" voice).
- Ask "generate image of a neon city" and the image appears under the orb.
- Tap the orb while it's talking to interrupt. ✕ top-right closes voice mode.

## Notes
- Needs your OpenAI key in Settings (same key as chat/images). Without it,
  it falls back to the robotic browser voice.
- Voice INPUT needs Chrome or Opera (Safari's speech recognition is unreliable).
- TTS costs a small amount per use on your OpenAI account — it's cheap, but
  it's not free like the browser voice.
