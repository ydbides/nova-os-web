"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "idle" | "listening" | "thinking" | "speaking";

/* Reactive orb: a glowing sphere whose rings pulse with `level` (0..1).
   Pure SVG + CSS so it's smooth and never looks broken. */
function Orb({ phase, level, accent }: { phase: Phase; level: number; accent: string }) {
  const scale = 1 + level * 0.35;
  const glow = 30 + level * 90;
  const spin = phase === "thinking" ? "nova-spin 1.1s linear infinite" : "none";
  const colors: Record<Phase, string> = {
    idle: accent, listening: "#3DFFA2", thinking: "#FFB454", speaking: accent,
  };
  const c = colors[phase];
  return (
    <div style={{ position: "relative", width: 280, height: 280, display: "grid", placeItems: "center" }}>
      {/* outer aura */}
      <div style={{
        position: "absolute", width: 280, height: 280, borderRadius: "50%",
        background: `radial-gradient(circle, ${c}40, transparent 65%)`,
        filter: `blur(${glow * 0.4}px)`, transform: `scale(${scale})`,
        transition: "transform 80ms linear",
      }} />
      {/* rotating ring for "thinking" */}
      <div style={{
        position: "absolute", width: 220, height: 220, borderRadius: "50%",
        border: `2px solid ${c}`, borderTopColor: "transparent",
        borderRightColor: "transparent", animation: spin, opacity: phase === "thinking" ? 0.8 : 0,
        transition: "opacity 300ms",
      }} />
      {/* pulsing rings */}
      {[170, 130, 95].map((d, i) => (
        <div key={i} style={{
          position: "absolute", width: d, height: d, borderRadius: "50%",
          border: `${2 - i * 0.4}px solid ${c}`,
          opacity: 0.25 + level * 0.5 - i * 0.06,
          transform: `scale(${1 + level * (0.4 - i * 0.1)})`,
          transition: "transform 80ms linear, opacity 120ms",
          boxShadow: `0 0 ${glow}px ${c}`,
        }} />
      ))}
      {/* core */}
      <div style={{
        width: 70, height: 70, borderRadius: "50%",
        background: `radial-gradient(circle at 35% 30%, #fff, ${c})`,
        transform: `scale(${1 + level * 0.5})`, transition: "transform 80ms linear",
        boxShadow: `0 0 ${40 + level * 60}px ${c}`,
      }} />
      <style>{`@keyframes nova-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export default function VoiceMode({
  onClose, onCommand, apiKey, accent, userName,
}: {
  onClose: () => void;
  onCommand: (text: string) => Promise<{ text: string; image?: string | null }>;
  apiKey: string; accent: string; userName: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState("");
  const [reply, setReply] = useState("");
  const [card, setCard] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);

  /* ---------- speak with OpenAI TTS, drive orb from real audio ---------- */
  const speak = useCallback(async (text: string) => {
    setPhase("speaking");
    try {
      const res = await fetch("/api/tts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: "nova", apiKey }),
      });
      if (!res.ok) throw new Error("tts");
      const buf = await res.arrayBuffer();
      const blob = new Blob([buf], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);

      // Web Audio: analyse amplitude so the orb pulses with the voice
      const AC = (window.AudioContext || (window as any).webkitAudioContext);
      const ctx = new AC();
      const audio = new Audio(url);
      audioRef.current = audio;
      const src = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser); analyser.connect(ctx.destination);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const loop = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setLevel(Math.min(1, avg / 90));
        rafRef.current = requestAnimationFrame(loop);
      };
      audio.onplay = () => loop();
      audio.onended = () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        setLevel(0); setPhase("idle"); URL.revokeObjectURL(url); ctx.close();
      };
      await audio.play();
    } catch {
      // Fallback: browser voice if TTS unavailable
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.onend = () => setPhase("idle");
        speechSynthesis.speak(u);
      } catch { setPhase("idle"); }
    }
  }, [apiKey]);

  /* ---------- handle one spoken turn ---------- */
  const handle = useCallback(async (text: string) => {
    setHeard(text); setPhase("thinking"); setReply(""); setCard(null);
    const res = await onCommand(text);
    setReply(res.text);
    if (res.image) setCard(res.image);
    await speak(res.text);
  }, [onCommand, speak]);

  /* ---------- mic / speech recognition ---------- */
  const listen = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setErr("This browser can't do voice input — try Chrome or Opera."); return; }
    const rec = new SR();
    rec.lang = "en-US"; rec.interimResults = false; rec.maxAlternatives = 1;
    recognitionRef.current = rec;
    setErr(""); setPhase("listening"); setLevel(0.4);
    rec.onresult = (e: any) => { handle(e.results[0][0].transcript); };
    rec.onerror = (e: any) => {
      setPhase("idle"); setLevel(0);
      if (e.error === "not-allowed") setErr("Microphone blocked — allow mic access for this site.");
      else if (e.error !== "no-speech") setErr("Didn't catch that — tap the orb to try again.");
    };
    rec.onend = () => { if (phase === "listening") { setPhase("idle"); setLevel(0); } };
    rec.start();
  }, [handle, phase]);

  /* greet on open */
  useEffect(() => {
    speak(`Voice mode online. Hi ${userName}, tap the orb and talk to me.`);
    return () => {
      audioRef.current?.pause();
      recognitionRef.current?.abort?.();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      speechSynthesis.cancel?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tapOrb = () => {
    if (phase === "speaking") { audioRef.current?.pause(); setPhase("idle"); setLevel(0); return; }
    if (phase === "idle") listen();
  };

  const label = { idle: "Tap the orb to speak", listening: "Listening…",
    thinking: "Thinking…", speaking: "Tap to stop" }[phase];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 60,
      background: "radial-gradient(circle at center, #0d1426 0%, #05070d 70%)",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: 24,
    }}>
      <button onClick={onClose} style={{
        position: "absolute", top: 24, right: 28, color: "#8290B2",
        background: "transparent", border: "none", fontSize: 28, cursor: "pointer",
      }}>✕</button>

      <p style={{ color: accent, fontWeight: 800, fontSize: 14, letterSpacing: 3 }}>◆ NOVA VOICE</p>

      <div onClick={tapOrb} style={{ cursor: "pointer" }}>
        <Orb phase={phase} level={level} accent={accent} />
      </div>

      <p style={{ color: "#8290B2", fontSize: 15 }}>{label}</p>

      {heard && (
        <p style={{ color: "#E9EFFF", fontSize: 16, maxWidth: 600, textAlign: "center" }}>
          “{heard}”
        </p>
      )}
      {reply && (
        <p style={{ color: accent, fontSize: 15, maxWidth: 640, textAlign: "center", lineHeight: 1.5 }}>
          {reply}
        </p>
      )}
      {card && (
        <img src={card} alt="" style={{
          width: 220, borderRadius: 16, border: `1px solid ${accent}55`,
          boxShadow: `0 0 40px ${accent}33`,
        }} />
      )}
      {err && <p style={{ color: "#FF5C7A", fontSize: 14 }}>{err}</p>}
    </div>
  );
}
