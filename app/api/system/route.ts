import { NextResponse } from "next/server";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";

const run = promisify(execFile);

function cpuTimes() {
  let idle = 0, total = 0;
  for (const c of os.cpus()) {
    idle += c.times.idle;
    total += c.times.user + c.times.nice + c.times.sys + c.times.irq + c.times.idle;
  }
  return { idle, total };
}

async function cpuPercent(): Promise<number> {
  const a = cpuTimes();
  await new Promise((r) => setTimeout(r, 120));
  const b = cpuTimes();
  const dTotal = b.total - a.total, dIdle = b.idle - a.idle;
  return dTotal > 0 ? Math.round((1 - dIdle / dTotal) * 100) : 0;
}

function localIp(): string {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const i of ifaces ?? []) {
      if (i.family === "IPv4" && !i.internal) return i.address;
    }
  }
  return "127.0.0.1";
}

async function battery(): Promise<number | null> {
  if (process.platform !== "darwin") return null;
  try {
    const { stdout } = await run("pmset", ["-g", "batt"], { timeout: 5000 });
    const m = stdout.match(/(\d+)%/);
    return m ? parseInt(m[1], 10) : null;
  } catch {
    return null;
  }
}

async function storage(): Promise<{ usedPercent: number; freeGb: number } | null> {
  try {
    const { stdout } = await run("df", ["-k", "/"], { timeout: 5000 });
    const line = stdout.trim().split("\n").pop() ?? "";
    const parts = line.split(/\s+/);
    // Filesystem 1024-blocks Used Available Capacity ...
    const freeGb = Math.round(parseInt(parts[3], 10) / 1e6);
    const usedPercent = parseInt(parts[4], 10);
    if (Number.isFinite(freeGb) && Number.isFinite(usedPercent))
      return { usedPercent, freeGb };
    return null;
  } catch {
    return null;
  }
}

export async function GET() {
  const [cpu, batt, disk] = await Promise.all([cpuPercent(), battery(), storage()]);
  const total = os.totalmem(), free = os.freemem();
  return NextResponse.json({
    cpu,
    ram: {
      percent: Math.round(((total - free) / total) * 100),
      usedGb: +((total - free) / 1e9).toFixed(1),
      totalGb: Math.round(total / 1e9),
    },
    battery: batt,
    disk,
    uptimeH: +(os.uptime() / 3600).toFixed(1),
    hostname: os.hostname(),
    ip: localIp(),
    platform: process.platform,
    cores: os.cpus().length,
  });
}
