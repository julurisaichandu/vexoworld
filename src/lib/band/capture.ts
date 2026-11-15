import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// The Band page starts and stops band-capture/run.sh over Bluetooth. One capture per machine: the band takes one connection.
const dataDir = () => process.env.VEXOWORLD_DATA_DIR ?? path.join(process.cwd(), ".data");
const pidFile = () => path.join(dataDir(), "band-capture.json");
const logFile = () => path.join(dataDir(), "band-capture.log");

type Running = { pid: number; userId: string; band: number };
export type CaptureState = { running: boolean; mine: boolean; band?: number; lastLine?: string };

/** The capture this app started, or null. Checks the command line so a reused PID is never taken for ours. */
function current(): Running | null {
  let r: Running;
  try {
    r = JSON.parse(fs.readFileSync(pidFile(), "utf8"));
  } catch {
    return null;
  }
  try {
    if (execFileSync("ps", ["-o", "command=", "-p", String(r.pid)], { encoding: "utf8" }).includes("run.sh")) return r;
  } catch {}
  fs.rmSync(pidFile(), { force: true });
  return null;
}

export function captureState(userId: string): CaptureState {
  const r = current();
  const mine = r?.userId === userId;
  let lastLine: string | undefined;
  if (mine) {
    try {
      lastLine = fs.readFileSync(logFile(), "utf8").trimEnd().split("\n").at(-1)?.slice(0, 600) || undefined;
    } catch {}
  }
  return { running: !!r, mine, band: r?.band, lastLine };
}

/** Starts capture for this band over Bluetooth; run.sh retries until the band is found. Returns an error message or null. */
export function startCapture(userId: string, band: number): string | null {
  const r = current();
  if (r) return r.userId === userId ? null : `Capture is already running for band ${r.band} on another account.`;
  fs.mkdirSync(dataDir(), { recursive: true });
  const log = fs.openSync(logFile(), "w");
  try {
    const child = spawn("bash", ["run.sh"], {
      cwd: path.join(process.cwd(), "band-capture"),
      detached: true, // its own process group, so Stop ends run.sh, uv and python together
      stdio: ["ignore", log, log],
      env: { ...process.env, VEXO_BAND_NUMBER: String(band), PYTHONUNBUFFERED: "1" },
    });
    child.on("error", () => {});
    child.unref();
    if (!child.pid) return "Could not start capture.";
    fs.writeFileSync(pidFile(), JSON.stringify({ pid: child.pid, userId, band }));
    return null;
  } finally {
    fs.closeSync(log);
  }
}

export function stopCapture(userId: string): string | null {
  const r = current();
  if (!r) return null;
  if (r.userId !== userId) return "Capture was started by another account.";
  try {
    process.kill(-r.pid, "SIGTERM");
  } catch {}
  fs.rmSync(pidFile(), { force: true });
  return null;
}
