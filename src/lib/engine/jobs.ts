import { after } from "next/server";
import { store } from "@/lib/store";
import type { Job } from "@/lib/types";
import { continueRequest } from "./inbox";
import { handleMessage } from "./collab";
import { discover, expireCollab, failMission } from "./missions";

const TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 3;
const STALE_MS = TIMEOUT_MS * 1.5;
class JobTimeout extends Error {}

/** Pause between agent turns so the UI visibly progresses. VEXOWORLD_STEP_MS=0 disables it (tests). */
export const stepDelay = () => (process.env.VEXOWORLD_STEP_MS !== undefined ? Number(process.env.VEXOWORLD_STEP_MS) : 800 + Math.random() * 700);

export const enqueue = (type: string, payload: Record<string, unknown>, delayMs = 0): Promise<Job> =>
  store.insert("jobs", {
    type,
    payload,
    status: "queued",
    attempts: 0,
    runAfter: new Date(Date.now() + delayMs).toISOString(),
    updatedAt: new Date().toISOString(),
  });

const handlers: Record<string, (p: Record<string, unknown>) => Promise<void>> = {
  "mission.discover": (p) => discover(String(p.missionId)),
  "message.deliver": async (p) => {
    const msg = await store.get("messages", String(p.messageId));
    if (msg) await handleMessage(msg);
  },
  "request.continue": (p) => continueRequest(String(p.requestId)),
};

function withTimeout<T>(p: Promise<T>): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, rej) => (t = setTimeout(() => rej(new JobTimeout("job timeout")), TIMEOUT_MS)));
  return Promise.race([p, timeout]).finally(() => clearTimeout(t));
}

async function giveUp(job: Job, lastError: string) {
  await store.update("jobs", job.id, { status: "failed", lastError });
  if (job.type === "mission.discover") await failMission(String(job.payload.missionId));
}

/** Reclaims jobs a crash or timeout left 'running', and expires collaborations past their deadline. */
async function sweep() {
  const cutoff = new Date(Date.now() - STALE_MS).toISOString();
  for (const job of await store.list("jobs", { status: "running" })) {
    if (job.updatedAt > cutoff) continue;
    if (job.attempts >= MAX_ATTEMPTS) {
      if (await store.updateIf("jobs", job.id, { status: "running", updatedAt: job.updatedAt }, {})) await giveUp(job, job.lastError ?? "job stalled");
    } else await store.updateIf("jobs", job.id, { status: "running", updatedAt: job.updatedAt }, { status: "queued", runAfter: new Date().toISOString() });
  }
  const t = new Date().toISOString();
  // ponytail: full scan each tick, index on expiresAt if the table grows
  for (const c of await store.list("collaborations")) if (c.expiresAt < t) await expireCollab(c);
}

/** Runs due jobs. Jobs of paused agents stay queued. Returns how many ran. */
export async function processJobs(max = 20): Promise<number> {
  await sweep();
  const due = (await store.list("jobs", { status: "queued" }, { order: "asc" })).filter((j) => j.runAfter <= new Date().toISOString());
  let ran = 0;
  for (const job of due) {
    if (ran >= max) break;
    const agentId = job.payload.agentId as string | undefined;
    if (agentId && (await store.get("agents", agentId))?.paused) continue;
    const claimed = await store.updateIf("jobs", job.id, { status: "queued", attempts: job.attempts, runAfter: job.runAfter }, { status: "running", attempts: job.attempts + 1 });
    if (!claimed) continue;
    ran++;
    try {
      const handler = handlers[job.type];
      if (!handler) throw new Error(`unknown job type ${job.type}`);
      await withTimeout(handler(job.payload));
      await store.update("jobs", job.id, { status: "done" });
    } catch (e) {
      // A timed-out handler is still running: leave the job 'running' and let sweep() reclaim it.
      if (e instanceof JobTimeout) continue;
      const lastError = e instanceof Error ? e.message : String(e);
      if (claimed.attempts >= MAX_ATTEMPTS) await giveUp(job, lastError);
      else await store.update("jobs", job.id, { status: "queued", lastError, runAfter: new Date(Date.now() + 1000 * 2 ** claimed.attempts).toISOString() });
    }
  }
  return ran;
}

export function kickJobs(): void {
  try {
    after(() => processJobs());
  } catch {}
}
