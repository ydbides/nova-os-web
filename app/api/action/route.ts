import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";

const run = promisify(execFile);
const mac = process.platform === "darwin";

// Every action is whitelisted and uses execFile with argument arrays —
// nothing is ever interpolated into a shell string, so there's no
// command-injection risk even though this server takes web requests.

async function osa(script: string, args: string[] = []) {
  return run("osascript", ["-e", script, ...args], { timeout: 20000 });
}

const MUSIC = {
  playpause: 'tell application "Music" to playpause',
  next: 'tell application "Music" to next track',
  prev: 'tell application "Music" to previous track',
  nowplaying: `tell application "Music"
    if player state is playing then
      return (name of current track) & " — " & (artist of current track)
    else
      return ""
    end if
  end tell`,
};

const REMINDER = `on run argv
  tell application "Reminders"
    make new reminder with properties {name:(item 1 of argv)}
  end tell
end run`;

export async function POST(req: Request) {
  const { type, arg, arg2 } = (await req.json().catch(() => ({}))) as { type?: string; arg?: string; arg2?: string };
  if (!mac)
    return NextResponse.json({ ok: false, text: "Mac actions only work when the server runs on macOS." });

  try {
    switch (type) {
      case "open_app": {
        const name = String(arg ?? "").slice(0, 80);
        if (!name) return NextResponse.json({ ok: false, text: "No app name given." });
        await run("open", ["-a", name], { timeout: 10000 });
        return NextResponse.json({ ok: true, text: `Opening ${name}.` });
      }
      case "music": {
        const cmd = String(arg) as keyof typeof MUSIC;
        if (!(cmd in MUSIC)) return NextResponse.json({ ok: false, text: "Unknown music command." });
        const { stdout } = await osa(MUSIC[cmd]);
        if (cmd === "nowplaying") {
          const np = stdout.trim();
          return NextResponse.json({ ok: true, text: np ? `Now playing: ${np}` : "Nothing is playing." });
        }
        return NextResponse.json({ ok: true, text: "Done." });
      }
      case "reminder": {
        const title = String(arg ?? "").slice(0, 200);
        if (!title) return NextResponse.json({ ok: false, text: "What should I remind you about?" });
        await osa(REMINDER, [title]);
        return NextResponse.json({ ok: true, text: `Reminder created: “${title}”.` });
      }
      case "say": {
        await run("say", [String(arg ?? "").slice(0, 300)], { timeout: 20000 });
        return NextResponse.json({ ok: true, text: "Spoken." });
      }
      case "open_url": {
        const url = String(arg ?? "");
        if (!/^https?:\/\//.test(url)) return NextResponse.json({ ok: false, text: "Only http(s) links." });
        await run("open", [url], { timeout: 10000 });
        return NextResponse.json({ ok: true, text: "Opened in your browser." });
      }
      default:
        return NextResponse.json({ ok: false, text: "Unknown action." });
    }
  } catch (e) {
    const err = e as { stderr?: string; message?: string };
    const detail = (err.stderr || err.message || "unknown error").slice(0, 200);
    const hint = detail.includes("1743") || detail.toLowerCase().includes("not allowed")
      ? " macOS blocked automation — System Settings → Privacy & Security → Automation, allow your terminal to control the app."
      : "";
    return NextResponse.json({ ok: false, text: `That didn't work: ${detail}.${hint}` });
  }
}
