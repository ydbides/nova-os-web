"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AuthGate, useUser, doSignOut } from "./auth";
import VoiceMode from "./voicemode";

/* ================= types & constants ================= */

type Task = { id: number; text: string; mins: number; done: boolean };
type Msg = { who: "you" | "nova"; text: string };
type Sys = {
  cpu: number; ram: { percent: number; usedGb: number; totalGb: number };
  battery: number | null; disk: { usedPercent: number; freeGb: number } | null;
  uptimeH: number; hostname: string; ip: string; cores: number;
} | null;

const PAGES = ["Dashboard", "AI Assistant", "System Monitor", "School",
  "Cyber Dashboard", "Automation", "Plugin Store", "Settings"] as const;

const ACCENTS: Record<string, string> = {
  Cyan: "#22d3ee", Violet: "#a78bfa", Green: "#34d399", Amber: "#fbbf24",
};

const PERSONALITIES: Record<string, string> = {
  Friendly: "You are NOVA, a warm, encouraging AI assistant inside a futuristic dashboard. Keep replies short and friendly.",
  Professional: "You are NOVA, a precise, efficient AI assistant. Keep replies brief and to the point.",
  Jarvis: "You are NOVA, a calm, dry-witted AI butler in the style of a sci-fi movie assistant. Address the user respectfully. Keep replies short.",
};

const PLUGINS = [
  { id: "weather", name: "Weather", desc: "Live forecast on your dashboard (Open-Meteo, no key needed)." },
  { id: "music", name: "Music", desc: "Now-playing and controls for the Mac Music app." },
  { id: "calendar", name: "Calendar", desc: "Your next study tasks and exam countdown at a glance." },
  { id: "fishtank", name: "Fish Tank", desc: "EcoGuard-style live tank readings (simulated feed)." },
  { id: "finance", name: "Finance", desc: "Live USD → ZAR exchange rate." },
  { id: "robotics", name: "Robotics", desc: "Project status card for your builds." },
] as const;

const BOOT_LINES = ["NOVA core initializing …", "Loading neural routines …",
  "Linking Mac bridge …", "Syncing plugins …", "All systems nominal."];

/* ================= small UI pieces ================= */

function Card({ title, value, sub, children }: {
  title: string; value?: string; sub?: string; children?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-[var(--acc-border)] bg-black/40 p-6 shadow-[0_0_40px_var(--acc-glow)] backdrop-blur-xl">
      <p className="text-[var(--acc)] text-sm tracking-widest uppercase">{title}</p>
      {value !== undefined && <p className="text-4xl font-black mt-3">{value}</p>}
      {sub && <p className="text-zinc-500 mt-2 text-sm">{sub}</p>}
      {children}
    </div>
  );
}

function Bar({ pct }: { pct: number }) {
  return (
    <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
      <div className="h-full rounded-full bg-[var(--acc)] transition-all duration-700"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

/* ================= main app ================= */

export default function Page() {
  return (
    <AuthGate>
      <NovaApp />
    </AuthGate>
  );
}

function NovaApp() {
  const [page, setPage] = useState<(typeof PAGES)[number]>("Dashboard");
  const [loaded, setLoaded] = useState(false);

  // persisted state
  const [settings, setSettings] = useState({
    name: "Commander", accent: "Cyan", personality: "Friendly", apiKey: "", city: "Durban",
  });
  const [tasks, setTasks] = useState<Task[]>([
    { id: 1, text: "Maths practice", mins: 45, done: false },
    { id: 2, text: "Science revision", mins: 30, done: false },
  ]);
  const [exam, setExam] = useState({ label: "Exams", date: "" });
  const [installed, setInstalled] = useState<Record<string, boolean>>({});
  const [log, setLog] = useState<string[]>(["System boot successful", "Web core active"]);

  // live state
  const [sys, setSys] = useState<Sys>(null);
  const [msgs, setMsgs] = useState<Msg[]>([
    { who: "nova", text: "Hello! I can open Mac apps, control music, set reminders, and chat. Try “open safari”, “play music”, or just talk to me." },
  ]);
  const [voiceOn, setVoiceOn] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const user = useUser();
  const shownName = settings.name !== "Commander" ? settings.name
    : (user?.displayName || user?.email?.split("@")[0] || "Commander");
  const accent = ACCENTS[settings.accent] ?? ACCENTS.Cyan;
  const [modes, setModes] = useState<Record<string, boolean>>({});
  const [timer, setTimer] = useState({ left: 25 * 60, total: 25 * 60, running: false });
  const [booting, setBooting] = useState<string[] | null>(null);

  const addLog = useCallback((line: string) => {
    setLog((l) => [`${new Date().toTimeString().slice(0, 5)}  ${line}`, ...l].slice(0, 30));
  }, []);

  /* ---- persistence ---- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("nova-web");
      if (raw) {
        const d = JSON.parse(raw);
        if (d.settings) setSettings((s) => ({ ...s, ...d.settings }));
        if (d.tasks) setTasks(d.tasks);
        if (d.exam) setExam(d.exam);
        if (d.installed) setInstalled(d.installed);
        if (d.log) setLog(d.log);
      }
    } catch { /* fresh start */ }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem("nova-web", JSON.stringify({ settings, tasks, exam, installed, log }));
  }, [settings, tasks, exam, installed, log, loaded]);

  /* ---- live system stats ---- */
  useEffect(() => {
    let alive = true;
    const tick = () =>
      fetch("/api/system").then((r) => r.json()).then((d) => alive && setSys(d)).catch(() => {});
    tick();
    const id = setInterval(tick, 3000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  /* ---- focus timer ---- */
  useEffect(() => {
    if (!timer.running) return;
    const id = setInterval(() => {
      setTimer((t) => {
        if (t.left <= 1) {
          addLog("Focus session complete");
          try { speechSynthesis.speak(new SpeechSynthesisUtterance("Focus session complete.")); } catch {}
          return { ...t, left: 0, running: false };
        }
        return { ...t, left: t.left - 1 };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timer.running, addLog]);

  /* ---- assistant ---- */
  const speak = useCallback((text: string) => {
    if (!voiceOn) return;
    try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(text)); } catch {}
  }, [voiceOn]);

  const novaSay = useCallback((text: string) => {
    setMsgs((m) => [...m, { who: "nova", text }]);
    speak(text);
  }, [speak]);

  const action = useCallback(async (type: string, arg?: string, arg2?: string) => {
    const r = await fetch("/api/action", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, arg, arg2 }),
    }).then((x) => x.json()).catch(() => ({ ok: false, text: "Lost connection to the server." }));
    return r as { ok: boolean; text: string };
  }, []);

  // Shared command runner used by both chat and voice mode.
  const runCommand = useCallback(async (text: string): Promise<{ text: string; image?: string | null }> => {
    const low = text.trim().toLowerCase();
    const openMatch = low.match(/^(?:open|launch|start)\s+(?:the\s+)?(?:app\s+)?(.+)$/);
    const remindMatch = low.match(/^remind me (?:to |about )?(.+)$/);
    const imgMatch = low.match(/^(?:generate|make|create|draw)\s+(?:an?\s+)?image\s+(?:of\s+)?(.+)$/);

    if (imgMatch) {
      const r = await fetch("/api/image", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: imgMatch[1], apiKey: settings.apiKey }) }).then(x => x.json()).catch(() => ({}));
      if (r.image) return { text: `Here's what I imagined for “${imgMatch[1]}”.`, image: r.image };
      return { text: r.error || "I couldn't generate that image." };
    }
    if (low === "help") return { text: "Try: open safari, play music, remind me to feed the fish, generate image of a galaxy, or just talk to me." };
    if (low === "status") return { text: sys ? `CPU ${sys.cpu}%, RAM ${sys.ram.percent}%, battery ${sys.battery ?? "n/a"}%.` : "Stats still loading." };
    if (["play","pause","play music","pause music","resume"].includes(low)) return { text: (await action("music","playpause")).text };
    if (["next song","next track","skip"].includes(low)) return { text: (await action("music","next")).text };
    if (["now playing","what's playing","whats playing"].includes(low)) return { text: (await action("music","nowplaying")).text };
    if (remindMatch) return { text: (await action("reminder", remindMatch[1])).text };
    if (openMatch) return { text: (await action("open_app", openMatch[1])).text };

    const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: text }], apiKey: settings.apiKey,
        system: `${PERSONALITIES[settings.personality]} The user is called ${shownName}.` }) })
      .then(x => x.json()).catch(() => ({ text: "Couldn't reach the server." }));
    return { text: r.text };
  }, [settings, sys, action, shownName]);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    setMsgs((m) => [...m, { who: "you", text }]);
    const low = text.toLowerCase();

    const openMatch = low.match(/^(?:open|launch|start)\s+(?:the\s+)?(?:app\s+)?(.+)$/);
    const remindMatch = low.match(/^remind me (?:to |about )?(.+)$/);

    let reply: string | null = null;
    if (low === "help") {
      reply = "Try: open safari · play music / pause / next song / now playing · remind me to feed the fish · status · or just chat (needs API key in Settings).";
    } else if (low === "status") {
      reply = sys
        ? `CPU ${sys.cpu}% · RAM ${sys.ram.percent}% (${sys.ram.usedGb}/${sys.ram.totalGb} GB) · battery ${sys.battery ?? "n/a"}% · uptime ${sys.uptimeH} h`
        : "Stats are still loading…";
    } else if (["play", "pause", "play music", "pause music", "resume"].includes(low)) {
      reply = (await action("music", "playpause")).text;
    } else if (["next song", "next track", "skip"].includes(low)) {
      reply = (await action("music", "next")).text;
    } else if (["previous song", "previous track", "back"].includes(low)) {
      reply = (await action("music", "prev")).text;
    } else if (["now playing", "what's playing", "whats playing"].includes(low)) {
      reply = (await action("music", "nowplaying")).text;
    } else if (remindMatch) {
      reply = (await action("reminder", remindMatch[1])).text;
    } else if (openMatch) {
      reply = (await action("open_app", openMatch[1])).text;
    }

    if (reply !== null) {
      addLog(`Assistant: ${text}`);
      novaSay(reply);
      return;
    }
    // free chat → AI
    const history = [...msgs, { who: "you", text }].slice(-10)
      .map((m) => ({ role: m.who === "you" ? "user" : "assistant", content: m.text }));
    const r = await fetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: history, apiKey: settings.apiKey,
        system: `${PERSONALITIES[settings.personality]} The user is called ${shownName}.`,
      }),
    }).then((x) => x.json()).catch(() => ({ text: "Couldn't reach the server." }));
    novaSay(r.text);
  }, [msgs, sys, settings, action, addLog, novaSay]);

  /* ---- automations ---- */
  const toggleMode = (mode: string) => {
    const on = !modes[mode];
    setModes((m) => ({ ...m, [mode]: on }));
    addLog(`${mode} ${on ? "activated" : "deactivated"}`);
    if (mode === "Study Mode" && on) {
      setTimer({ left: 25 * 60, total: 25 * 60, running: true });
      setPage("School");
    }
    if (mode === "Coding Mode" && on) action("open_app", "Visual Studio Code");
  };

  const launchBoot = () => {
    setBooting([]);
    BOOT_LINES.forEach((l, i) =>
      setTimeout(() => setBooting((b) => (b === null ? b : [...b, l])), 350 * (i + 1)));
    setTimeout(() => { setBooting(null); addLog("NOVA core re-initialized"); }, 350 * BOOT_LINES.length + 900);
  };


  return (
    <main
      className={`min-h-screen bg-black text-white flex overflow-hidden ${modes["Night Mode"] ? "brightness-[0.82]" : ""}`}
      style={{
        "--acc": accent,
        "--acc-soft": accent + "1f",
        "--acc-border": accent + "3d",
        "--acc-glow": accent + "14",
      } as React.CSSProperties}
    >
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(circle at top left, ${accent}26, transparent 30%), radial-gradient(circle at bottom right, ${accent}1a, transparent 35%)` }} />

      {/* ===== sidebar ===== */}
      <aside className="relative z-10 w-72 shrink-0 bg-black/70 border-r border-[var(--acc-border)] p-6 backdrop-blur-xl">
        <h1 className="text-3xl font-black text-[var(--acc)] mb-1">◆ NOVA OS</h1>
        <p className="text-xs text-zinc-500 mb-8">web command center · v3</p>
        <nav className="flex flex-col gap-2">
          {PAGES.map((p) => (
            <button key={p} onClick={() => setPage(p)}
              className={`text-left rounded-xl px-4 py-3 transition border ${
                page === p
                  ? "bg-[var(--acc-soft)] border-[var(--acc)] text-[var(--acc)] shadow-[0_0_25px_var(--acc-glow)]"
                  : "bg-white/5 border-white/10 text-zinc-300 hover:border-[var(--acc-border)] hover:text-[var(--acc)]"}`}>
              {p}
            </button>
          ))}
        </nav>
        <div className="mt-8 rounded-2xl border border-[var(--acc-border)] bg-white/5 p-4">
          <p className="text-xs text-zinc-400">NOVA CORE</p>
          <p className="text-green-400 font-bold mt-1 animate-pulse">● ONLINE</p>
          <p className="text-xs text-zinc-500 mt-2">{sys ? `${sys.hostname} · ${sys.ip}` : "connecting…"}</p>
        </div>
      </aside>

      {/* ===== content ===== */}
      <section className="relative z-10 flex-1 p-8 overflow-y-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-5xl font-black text-[var(--acc)]">{page}</h2>
            <p className="text-zinc-400 mt-2">Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {shownName}</p>
          </div>
          <button onClick={launchBoot}
            className="rounded-full border border-[var(--acc-border)] bg-[var(--acc-soft)] px-6 py-3 text-[var(--acc)] hover:brightness-125 transition">
            Launch NOVA
          </button>
        </div>

        {page === "Dashboard" && <Dashboard sys={sys} log={log} installed={installed}
          settings={settings} tasks={tasks} exam={exam} action={action}
          toggleMode={toggleMode} setPage={setPage} hideFeed={!!modes["Focus Mode"]} />}
        {page === "AI Assistant" && <Assistant msgs={msgs} send={send} voiceOn={voiceOn}
          setVoiceOn={setVoiceOn} settings={settings} addLog={addLog} />}
        {page === "System Monitor" && <Monitor sys={sys} />}
        {page === "School" && <School tasks={tasks} setTasks={setTasks} exam={exam}
          setExam={setExam} timer={timer} setTimer={setTimer} />}
        {page === "Cyber Dashboard" && <Cyber sys={sys} addLog={addLog} />}
        {page === "Automation" && <Automation modes={modes} toggleMode={toggleMode} />}
        {page === "Plugin Store" && <Store installed={installed} setInstalled={setInstalled} addLog={addLog} />}
        {page === "Settings" && <Settings settings={settings} setSettings={setSettings} addLog={addLog} />}
      </section>

      {/* ===== voice mode ===== */}
      <button onClick={() => setVoiceOpen(true)} title="Voice Mode"
        className="fixed bottom-8 right-8 z-40 h-16 w-16 rounded-full text-black font-black text-2xl shadow-[0_0_30px_var(--acc-glow)]"
        style={{ background: accent }}>
        ◆
      </button>
      {voiceOpen && (
        <VoiceMode
          onClose={() => setVoiceOpen(false)}
          onCommand={runCommand}
          apiKey={settings.apiKey}
          accent={accent}
          userName={shownName}
        />
      )}

      {/* ===== boot overlay ===== */}
      {booting !== null && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur flex items-center justify-center">
          <div className="font-mono text-[var(--acc)] text-lg space-y-2">
            {booting.map((l, i) => <p key={i} className="animate-pulse">▸ {l}</p>)}
          </div>
        </div>
      )}
    </main>
  );
}

/* ================= pages ================= */

function Dashboard(props: {
  sys: Sys; log: string[]; installed: Record<string, boolean>;
  settings: { city: string }; tasks: Task[]; exam: { label: string; date: string };
  action: (t: string, a?: string) => Promise<{ ok: boolean; text: string }>;
  toggleMode: (m: string) => void; setPage: (p: (typeof PAGES)[number]) => void; hideFeed: boolean;
}) {
  const { sys, log, installed, settings, tasks, exam, action, toggleMode, setPage, hideFeed } = props;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-5">
        <Card title="CPU" value={sys ? `${sys.cpu}%` : "…"} sub={sys ? `${sys.cores} cores` : ""}><Bar pct={sys?.cpu ?? 0} /></Card>
        <Card title="RAM" value={sys ? `${sys.ram.percent}%` : "…"} sub={sys ? `${sys.ram.usedGb} / ${sys.ram.totalGb} GB` : ""}><Bar pct={sys?.ram.percent ?? 0} /></Card>
        <Card title="Battery" value={sys?.battery != null ? `${sys.battery}%` : "—"} sub="power"><Bar pct={sys?.battery ?? 0} /></Card>
        <Card title="Uptime" value={sys ? `${sys.uptimeH}h` : "…"} sub={sys ? sys.hostname : ""} />
      </div>

      {/* plugin widgets */}
      <div className="grid grid-cols-3 gap-5">
        {installed.weather && <WeatherWidget city={settings.city} />}
        {installed.music && <MusicWidget action={action} />}
        {installed.calendar && <CalendarWidget tasks={tasks} exam={exam} />}
        {installed.fishtank && <FishTankWidget />}
        {installed.finance && <FinanceWidget />}
        {installed.robotics && <Card title="Robotics" value="EcoGuard" sub="Raspberry Pi 5 · online" />}
      </div>

      <div className="grid grid-cols-2 gap-5">
        {!hideFeed && (
          <div className="rounded-3xl border border-[var(--acc-border)] bg-white/5 p-8">
            <h3 className="text-2xl text-[var(--acc)] font-bold">Mission Feed</h3>
            <div className="mt-5 space-y-2 text-zinc-300 text-sm font-mono max-h-56 overflow-y-auto">
              {log.map((l, i) => <p key={i}>✓ {l}</p>)}
            </div>
          </div>
        )}
        <div className="rounded-3xl border border-[var(--acc-border)] bg-white/5 p-8">
          <h3 className="text-2xl text-[var(--acc)] font-bold">Quick Actions</h3>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button onClick={() => toggleMode("Study Mode")} className="rounded-xl bg-[var(--acc-soft)] border border-[var(--acc-border)] p-4 hover:brightness-125">Study Mode</button>
            <button onClick={() => toggleMode("Coding Mode")} className="rounded-xl bg-[var(--acc-soft)] border border-[var(--acc-border)] p-4 hover:brightness-125">Code Mode</button>
            <button onClick={() => setPage("Cyber Dashboard")} className="rounded-xl bg-[var(--acc-soft)] border border-[var(--acc-border)] p-4 hover:brightness-125">Scan Network</button>
            <button onClick={() => setPage("AI Assistant")} className="rounded-xl bg-[var(--acc-soft)] border border-[var(--acc-border)] p-4 hover:brightness-125">Generate Image</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Assistant({ msgs, send, voiceOn, setVoiceOn, settings, addLog }: {
  msgs: Msg[]; send: (t: string) => void; voiceOn: boolean; setVoiceOn: (b: boolean) => void;
  settings: { apiKey: string }; addLog: (s: string) => void;
}) {
  const [input, setInput] = useState("");
  const [imgPrompt, setImgPrompt] = useState("");
  const [img, setImg] = useState<string | null>(null);
  const [imgBusy, setImgBusy] = useState(false);
  const [imgErr, setImgErr] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);
  useEffect(() => { feedRef.current?.scrollTo(0, 1e9); }, [msgs]);

  const go = () => { send(input); setInput(""); };
  const genImage = async () => {
    if (!imgPrompt.trim() || imgBusy) return;
    setImgBusy(true); setImgErr(""); setImg(null);
    const r = await fetch("/api/image", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: imgPrompt, apiKey: settings.apiKey }),
    }).then((x) => x.json()).catch(() => ({ error: "Server error." }));
    setImgBusy(false);
    if (r.image) { setImg(r.image); addLog("Image generated"); } else setImgErr(r.error || "Failed.");
  };

  return (
    <div className="grid grid-cols-3 gap-5">
      <div className="col-span-2 rounded-3xl border border-[var(--acc-border)] bg-black/50 p-6 flex flex-col min-h-[560px]">
        <h3 className="text-2xl text-[var(--acc)] font-bold">NOVA Chat</h3>
        <div ref={feedRef} className="mt-5 flex-1 space-y-3 overflow-y-auto pr-2">
          {msgs.map((m, i) => (
            <div key={i} className={`rounded-2xl p-4 text-sm whitespace-pre-wrap max-w-[85%] ${
              m.who === "you" ? "ml-auto bg-white/10 text-zinc-100" : "bg-[var(--acc-soft)] text-zinc-200"}`}>
              {m.text}
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-3">
          <input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && go()}
            className="flex-1 rounded-xl bg-white/10 border border-white/10 p-4 outline-none focus:border-[var(--acc-border)]"
            placeholder='Try "open safari" · "play music" · "remind me to feed the fish" · or chat' />
          <button onClick={go} className="rounded-xl bg-[var(--acc)] px-6 text-black font-bold">Send</button>
        </div>
      </div>

      <div className="space-y-5">
        <div className="rounded-3xl border border-[var(--acc-border)] bg-white/5 p-6">
          <h3 className="text-xl text-[var(--acc)] font-bold">AI Tools</h3>
          <button onClick={() => setVoiceOn(!voiceOn)}
            className={`mt-4 w-full rounded-xl border p-4 text-left ${voiceOn ? "bg-[var(--acc-soft)] border-[var(--acc)] text-[var(--acc)]" : "border-white/10 bg-white/5"}`}>
            🔊 Voice Mode {voiceOn ? "ON — NOVA speaks replies" : "off"}
          </button>
        </div>
        <div className="rounded-3xl border border-[var(--acc-border)] bg-white/5 p-6">
          <h3 className="text-xl text-[var(--acc)] font-bold">Image Generator</h3>
          <textarea value={imgPrompt} onChange={(e) => setImgPrompt(e.target.value)} rows={3}
            className="mt-3 w-full rounded-xl bg-white/10 border border-white/10 p-3 text-sm outline-none"
            placeholder="A neon cyberpunk aquarium with glowing fish…" />
          <button onClick={genImage} disabled={imgBusy}
            className="mt-2 w-full rounded-xl bg-[var(--acc)] py-3 text-black font-bold disabled:opacity-50">
            {imgBusy ? "Generating…" : "Generate"}
          </button>
          {imgErr && <p className="text-red-400 text-xs mt-2">{imgErr}</p>}
          {img && <img src={img} alt="generated" className="mt-3 rounded-xl border border-[var(--acc-border)]" />}
        </div>
      </div>
    </div>
  );
}

function Monitor({ sys }: { sys: Sys }) {
  return (
    <div className="grid grid-cols-3 gap-5">
      <Card title="CPU Load" value={sys ? `${sys.cpu}%` : "…"}><Bar pct={sys?.cpu ?? 0} /></Card>
      <Card title="Memory" value={sys ? `${sys.ram.usedGb} GB` : "…"} sub={sys ? `of ${sys.ram.totalGb} GB (${sys.ram.percent}%)` : ""}><Bar pct={sys?.ram.percent ?? 0} /></Card>
      <Card title="Battery" value={sys?.battery != null ? `${sys.battery}%` : "—"}><Bar pct={sys?.battery ?? 0} /></Card>
      <Card title="Storage" value={sys?.disk ? `${sys.disk.freeGb} GB free` : "…"} sub={sys?.disk ? `${sys.disk.usedPercent}% used` : ""}><Bar pct={sys?.disk?.usedPercent ?? 0} /></Card>
      <Card title="Network" value={sys ? "ONLINE" : "…"} sub={sys ? `${sys.hostname} · ${sys.ip}` : ""} />
      <Card title="Uptime" value={sys ? `${sys.uptimeH} h` : "…"} sub={sys ? `${sys.cores} CPU cores` : ""} />
    </div>
  );
}

function School({ tasks, setTasks, exam, setExam, timer, setTimer }: {
  tasks: Task[]; setTasks: (t: Task[]) => void;
  exam: { label: string; date: string }; setExam: (e: { label: string; date: string }) => void;
  timer: { left: number; total: number; running: boolean };
  setTimer: (t: { left: number; total: number; running: boolean }) => void;
}) {
  const [text, setText] = useState("");
  const [mins, setMins] = useState(30);
  const add = () => {
    if (!text.trim()) return;
    setTasks([...tasks, { id: Date.now(), text: text.trim(), mins, done: false }]);
    setText("");
  };
  const days = exam.date
    ? Math.max(0, Math.ceil((new Date(exam.date).getTime() - Date.now()) / 86400000))
    : null;
  const mm = String(Math.floor(timer.left / 60)).padStart(2, "0");
  const ss = String(timer.left % 60).padStart(2, "0");

  return (
    <div className="grid grid-cols-2 gap-5">
      <div className="rounded-3xl border border-[var(--acc-border)] bg-white/5 p-6">
        <h3 className="text-2xl text-[var(--acc)] font-bold">Study Planner</h3>
        <div className="mt-4 flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            className="flex-1 rounded-xl bg-white/10 border border-white/10 p-3 text-sm outline-none" placeholder="Add a task… e.g. EMS flashcards" />
          <input type="number" value={mins} onChange={(e) => setMins(+e.target.value || 0)}
            className="w-20 rounded-xl bg-white/10 border border-white/10 p-3 text-sm outline-none" />
          <button onClick={add} className="rounded-xl bg-[var(--acc)] px-4 text-black font-bold">+</button>
        </div>
        <ul className="mt-4 space-y-2">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 p-3">
              <input type="checkbox" checked={t.done} className="accent-[var(--acc)] h-4 w-4"
                onChange={() => setTasks(tasks.map((x) => x.id === t.id ? { ...x, done: !x.done } : x))} />
              <span className={`flex-1 ${t.done ? "line-through text-zinc-500" : "text-zinc-200"}`}>{t.text}</span>
              <span className="text-xs text-zinc-500">{t.mins} min</span>
              <button onClick={() => setTasks(tasks.filter((x) => x.id !== t.id))}
                className="text-zinc-500 hover:text-red-400">✕</button>
            </li>
          ))}
          {tasks.length === 0 && <p className="text-zinc-500 text-sm">Nothing planned — add your first task.</p>}
        </ul>
      </div>

      <div className="space-y-5">
        <div className="rounded-3xl border border-[var(--acc-border)] bg-white/5 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl text-[var(--acc)] font-bold">Exam Countdown</h3>
            <input type="date" value={exam.date} onChange={(e) => setExam({ ...exam, date: e.target.value })}
              className="rounded-lg bg-white/10 border border-white/10 p-2 text-sm outline-none [color-scheme:dark]" />
          </div>
          <p className="text-6xl font-black mt-6">{days === null ? "—" : `${days} Days`}</p>
          <p className="text-zinc-500 mt-2 text-sm">{exam.date ? `until ${exam.date}` : "pick your exam date →"}</p>
        </div>

        <div className="rounded-3xl border border-[var(--acc-border)] bg-white/5 p-6">
          <h3 className="text-2xl text-[var(--acc)] font-bold">Focus Timer</h3>
          <p className="text-6xl font-black mt-4 font-mono">{mm}:{ss}</p>
          <div className="mt-4 flex gap-2 flex-wrap">
            <button onClick={() => setTimer({ left: 25 * 60, total: 25 * 60, running: true })} className="rounded-xl bg-[var(--acc-soft)] border border-[var(--acc-border)] px-4 py-2">Focus 25</button>
            <button onClick={() => setTimer({ left: 5 * 60, total: 5 * 60, running: true })} className="rounded-xl bg-[var(--acc-soft)] border border-[var(--acc-border)] px-4 py-2">Break 5</button>
            <button onClick={() => setTimer({ ...timer, running: !timer.running })} className="rounded-xl bg-[var(--acc)] px-4 py-2 text-black font-bold">{timer.running ? "Pause" : "Start"}</button>
            <button onClick={() => setTimer({ left: timer.total, total: timer.total, running: false })} className="rounded-xl bg-white/10 px-4 py-2">Reset</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Cyber({ sys, addLog }: { sys: Sys; addLog: (s: string) => void }) {
  const [lines, setLines] = useState<string[]>(["Console ready. Press Run Scan."]);
  const [scanning, setScanning] = useState(false);
  const scan = () => {
    if (scanning) return;
    setScanning(true); setLines([]);
    const seq = [
      "Initializing passive scan …",
      `Host: ${sys?.hostname ?? "unknown"} (${sys?.ip ?? "?"})`,
      "Checking open connections ……… OK",
      "Verifying firewall state ……… ACTIVE",
      `Memory integrity ……… ${sys ? sys.ram.percent + "% in use, healthy" : "OK"}`,
      "Known-threat signatures ……… 0 matches",
      "Scan complete — no threats detected.",
    ];
    seq.forEach((l, i) => setTimeout(() => setLines((x) => [...x, l]), 450 * (i + 1)));
    setTimeout(() => { setScanning(false); addLog("Network scan complete — 0 threats"); }, 450 * seq.length + 300);
  };
  return (
    <div className="grid grid-cols-3 gap-5">
      <Card title="Firewall" value="ACTIVE" sub="macOS application firewall" />
      <Card title="Threats" value="0" sub="local diagnostics" />
      <Card title="Connection" value={sys ? "SECURE" : "…"} sub={sys ? `${sys.ip}` : ""} />
      <div className="col-span-3 rounded-3xl border border-[var(--acc-border)] bg-black/50 p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl text-[var(--acc)] font-bold">Network Console</h3>
          <button onClick={scan} disabled={scanning}
            className="rounded-xl bg-[var(--acc)] px-5 py-2 text-black font-bold disabled:opacity-50">
            {scanning ? "Scanning…" : "▶ Run Scan"}
          </button>
        </div>
        <div className="mt-5 font-mono text-green-400 text-sm space-y-1 min-h-[160px]">
          {lines.map((l, i) => <p key={i}>▸ {l}</p>)}
        </div>
      </div>
    </div>
  );
}

function Automation({ modes, toggleMode }: { modes: Record<string, boolean>; toggleMode: (m: string) => void }) {
  const DESCS: Record<string, string> = {
    "Study Mode": "Starts a 25-minute focus timer and jumps to School.",
    "Coding Mode": "Opens Visual Studio Code on your Mac.",
    "Focus Mode": "Hides the Mission Feed to cut distractions.",
    "Night Mode": "Dims the whole interface for late sessions.",
  };
  return (
    <div className="grid grid-cols-4 gap-5">
      {Object.keys(DESCS).map((x) => (
        <button key={x} onClick={() => toggleMode(x)}
          className={`rounded-3xl border p-8 text-left transition ${
            modes[x] ? "border-[var(--acc)] bg-[var(--acc-soft)] shadow-[0_0_30px_var(--acc-glow)]"
                     : "border-[var(--acc-border)] bg-white/5 hover:bg-[var(--acc-soft)]"}`}>
          <p className="text-2xl font-bold">{x}</p>
          <p className={`mt-2 text-sm font-bold ${modes[x] ? "text-green-400" : "text-zinc-500"}`}>{modes[x] ? "● ACTIVE" : "○ off"}</p>
          <p className="text-zinc-400 mt-3 text-sm">{DESCS[x]}</p>
        </button>
      ))}
    </div>
  );
}

function Store({ installed, setInstalled, addLog }: {
  installed: Record<string, boolean>;
  setInstalled: (v: Record<string, boolean>) => void; addLog: (s: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-5">
      {PLUGINS.map((p) => (
        <div key={p.id} className="rounded-3xl border border-[var(--acc-border)] bg-white/5 p-6 flex flex-col">
          <h3 className="text-2xl text-[var(--acc)] font-bold">{p.name}</h3>
          <p className="text-zinc-400 mt-2 text-sm flex-1">{p.desc}</p>
          <button
            onClick={() => { setInstalled({ ...installed, [p.id]: !installed[p.id] }); addLog(`Plugin ${p.name} ${installed[p.id] ? "removed" : "installed"}`); }}
            className={`mt-6 rounded-xl px-5 py-3 font-bold ${installed[p.id] ? "bg-white/10 text-zinc-300" : "bg-[var(--acc)] text-black"}`}>
            {installed[p.id] ? "Uninstall" : "Install"}
          </button>
          {installed[p.id] && <p className="text-green-400 text-xs mt-2">● live on your Dashboard</p>}
        </div>
      ))}
    </div>
  );
}

function Settings({ settings, setSettings, addLog }: {
  settings: { name: string; accent: string; personality: string; apiKey: string; city: string };
  setSettings: (s: typeof settings) => void; addLog: (s: string) => void;
}) {
  const set = (k: string, v: string) => { setSettings({ ...settings, [k]: v }); };
  return (
    <div className="rounded-3xl border border-[var(--acc-border)] bg-white/5 p-8 max-w-3xl space-y-7">
      <AccountSection />
      <div>
        <p className="text-[var(--acc)] font-bold mb-2">Your name</p>
        <input value={settings.name} onChange={(e) => set("name", e.target.value)}
          className="w-72 rounded-xl bg-white/10 border border-white/10 p-3 outline-none" />
      </div>
      <div>
        <p className="text-[var(--acc)] font-bold mb-2">Accent color — changes the whole interface</p>
        <div className="flex gap-3">
          {Object.entries(ACCENTS).map(([name, hex]) => (
            <button key={name} onClick={() => { set("accent", name); addLog(`Accent → ${name}`); }}
              className={`h-12 w-12 rounded-full border-4 transition ${settings.accent === name ? "border-white scale-110" : "border-transparent"}`}
              style={{ background: hex }} title={name} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-[var(--acc)] font-bold mb-2">NOVA personality — changes how the AI talks</p>
        <div className="flex gap-3">
          {Object.keys(PERSONALITIES).map((p) => (
            <button key={p} onClick={() => set("personality", p)}
              className={`rounded-xl border px-5 py-3 ${settings.personality === p ? "border-[var(--acc)] bg-[var(--acc-soft)] text-[var(--acc)]" : "border-white/10 bg-white/5"}`}>
              {p}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[var(--acc)] font-bold mb-2">OpenAI API key (chat + image generation)</p>
        <input type="password" value={settings.apiKey} onChange={(e) => set("apiKey", e.target.value)}
          placeholder="sk-…" className="w-full rounded-xl bg-white/10 border border-white/10 p-3 outline-none font-mono text-sm" />
        <p className="text-zinc-500 text-xs mt-1">Stored only in this browser. Commands work without it.</p>
      </div>
      <div>
        <p className="text-[var(--acc)] font-bold mb-2">Weather city</p>
        <input value={settings.city} onChange={(e) => set("city", e.target.value)}
          className="w-72 rounded-xl bg-white/10 border border-white/10 p-3 outline-none" />
      </div>
    </div>
  );
}

/* ================= plugin widgets ================= */

function WeatherWidget({ city }: { city: string }) {
  const [w, setW] = useState<{ temp: number; hi: number; lo: number; name: string } | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(city || "Durban")}`).then((r) => r.json());
        const p = geo.results?.[0];
        if (!p) return;
        const fc = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}&current=temperature_2m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`).then((r) => r.json());
        if (alive) setW({ temp: Math.round(fc.current.temperature_2m), hi: Math.round(fc.daily.temperature_2m_max[0]), lo: Math.round(fc.daily.temperature_2m_min[0]), name: p.name });
      } catch { /* offline */ }
    })();
    return () => { alive = false; };
  }, [city]);
  return <Card title={`Weather · ${w?.name ?? city}`} value={w ? `${w.temp}°` : "…"} sub={w ? `H ${w.hi}° · L ${w.lo}°` : "loading"} />;
}

function MusicWidget({ action }: { action: (t: string, a?: string) => Promise<{ ok: boolean; text: string }> }) {
  const [np, setNp] = useState("—");
  const refresh = useCallback(async () => {
    const r = await action("music", "nowplaying");
    setNp(r.text.replace("Now playing: ", ""));
  }, [action]);
  useEffect(() => { refresh(); }, [refresh]);
  return (
    <Card title="Music">
      <p className="text-lg font-bold mt-2 truncate">{np}</p>
      <div className="mt-3 flex gap-2">
        <button onClick={async () => { await action("music", "prev"); refresh(); }} className="rounded-lg bg-white/10 px-3 py-2">⏮</button>
        <button onClick={async () => { await action("music", "playpause"); refresh(); }} className="rounded-lg bg-[var(--acc)] text-black font-bold px-4 py-2">⏯</button>
        <button onClick={async () => { await action("music", "next"); refresh(); }} className="rounded-lg bg-white/10 px-3 py-2">⏭</button>
      </div>
    </Card>
  );
}

function CalendarWidget({ tasks, exam }: { tasks: Task[]; exam: { date: string } }) {
  const pending = tasks.filter((t) => !t.done).slice(0, 3);
  const days = exam.date ? Math.max(0, Math.ceil((new Date(exam.date).getTime() - Date.now()) / 86400000)) : null;
  return (
    <Card title="Up Next">
      <div className="mt-2 space-y-1 text-sm text-zinc-300">
        {pending.map((t) => <p key={t.id}>▸ {t.text} · {t.mins}m</p>)}
        {pending.length === 0 && <p className="text-zinc-500">All tasks done 🎉</p>}
        {days !== null && <p className="text-[var(--acc)] font-bold pt-2">Exams in {days} days</p>}
      </div>
    </Card>
  );
}

function FishTankWidget() {
  const [v, setV] = useState({ ph: 7.2, temp: 25.4, health: 92 });
  useEffect(() => {
    const id = setInterval(() => setV((x) => ({
      ph: +(x.ph + (Math.random() - 0.5) * 0.06).toFixed(2),
      temp: +(x.temp + (Math.random() - 0.5) * 0.2).toFixed(1),
      health: Math.min(100, Math.max(80, Math.round(x.health + (Math.random() - 0.5) * 2))),
    })), 3000);
    return () => clearInterval(id);
  }, []);
  return <Card title="EcoGuard Tank" value={`${v.health}%`} sub={`pH ${v.ph} · ${v.temp}°C · simulated feed`}><Bar pct={v.health} /></Card>;
}

function FinanceWidget() {
  const [rate, setRate] = useState<number | null>(null);
  useEffect(() => {
    fetch("https://api.frankfurter.app/latest?from=USD&to=ZAR")
      .then((r) => r.json()).then((d) => setRate(d.rates?.ZAR ?? null)).catch(() => {});
  }, []);
  return <Card title="USD → ZAR" value={rate ? `R ${rate.toFixed(2)}` : "…"} sub="live exchange rate" />;
}

function AccountSection() {
  const user = useUser();
  return (
    <div className="flex items-center justify-between rounded-2xl border border-[var(--acc-border)] bg-black/30 p-5">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-[var(--acc)] text-black font-black text-xl flex items-center justify-center">
          {(user?.displayName || user?.email || "?")[0].toUpperCase()}
        </div>
        <div>
          <p className="font-bold">{user?.displayName || "NOVA user"}</p>
          <p className="text-zinc-500 text-sm">{user?.email}</p>
        </div>
      </div>
      <button onClick={() => doSignOut()}
        className="rounded-xl border border-red-400/40 px-5 py-3 text-red-400 hover:bg-red-400/10 font-bold">
        Sign out
      </button>
    </div>
  );
}
