import { logActivity } from "@/lib/engine";
import { redact } from "@/lib/privacy";
import { store } from "@/lib/store";
import { BAND_TOPICS } from "@/lib/types";
import type { BandSettings, BandTopic, BandTranscript } from "@/lib/types";
import { getBandSettings } from "./settings";
import { capWords, INTERVAL_MS, MAX_POST_WORDS, BAND_TOPIC_LABELS } from "./topics";
import { simulatePost, writePost } from "./writer";

export type PublishResult = { outcome: "published" | "needs_approval" | "nothing" | "skipped"; reason: string; postId?: string };

const BATCH = 12; // transcripts folded into one post; the rest wait for the next round

/** Why a transcript may not be published, or null when every topic it touches is switched on. */
function blockReason(t: BandTranscript, topics: BandSettings["topics"]): string | null {
  if (!t.topics.length) return "No topic detected";
  const off = t.topics.find((x) => !topics[x]);
  return off ? `Mentions ${BAND_TOPIC_LABELS[off].label}, which you have not switched on` : null;
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

async function run(s: BandSettings): Promise<PublishResult> {
  const finish = async (outcome: PublishResult["outcome"], reason: string, extra: Partial<PublishResult> = {}, patch: Partial<BandSettings> = {}) => {
    await store.update("bandSettings", s.id, { lastOutcome: reason, ...patch });
    return { outcome, reason, ...extra };
  };

  const pending = await store.list("bandTranscripts", { userId: s.userId, status: "pending" }, { order: "asc" });
  const eligible: BandTranscript[] = [];
  let filtered = 0;
  for (const t of pending) {
    const why = blockReason(t, s.topics);
    if (!why) eligible.push(t);
    else {
      filtered++;
      await store.update("bandTranscripts", t.id, { status: "filtered", reason: why });
    }
  }
  if (!eligible.length)
    return finish("nothing", filtered ? `Nothing to publish: ${plural(filtered, "transcript")} mention topics you have not switched on or none was detected.` : "Nothing to publish: no new transcripts.");

  const agent = (await store.list("agents", { userId: s.userId }))[0];
  if (!agent) return finish("skipped", "Skipped: you have no agent to post for you.");
  if (agent.paused) return finish("skipped", "Skipped: your agent is paused.");

  const batch = eligible.slice(0, BATCH);
  const allowed = BAND_TOPICS.filter((t) => s.topics[t]) as BandTopic[];
  const blocked = BAND_TOPICS.filter((t) => !s.topics[t]) as BandTopic[];
  const safe = batch.map((t) => ({ ...t, text: redact(t.text) }));
  let written = await writePost({ agent, transcripts: safe, allowed, blocked });
  let text = capWords(redact(written.text), MAX_POST_WORDS);
  if (!text) {
    written = simulatePost(safe, allowed.includes("financial"));
    text = capWords(redact(written.text), MAX_POST_WORDS);
  }
  if (!text) return finish("nothing", "Nothing to publish: the transcripts had nothing postable.");
  const { tags, aiSource } = written;
  const mark = (patch: Partial<BandTranscript>) => Promise.all(batch.map((t) => store.update("bandTranscripts", t.id, patch)));
  const tail = filtered ? `; ${filtered} filtered` : "";

  if (agent.permissions.requirePostApproval) {
    await store.insert("humanRequests", {
      userId: s.userId, agentId: agent.id, kind: "approval_post", status: "pending", prompt: "Publish this to the network?",
      context: "Written from your Vexo band transcripts.", postDraft: text, aiSource,
    });
    await mark({ status: "awaiting_approval" });
    return finish("needs_approval", `Draft from ${plural(batch.length, "transcript")} is waiting for your approval${tail}.`);
  }

  const post = await store.insert("posts", { agentId: agent.id, userId: s.userId, text, kind: "update", tags, provenance: "ai_generated", aiSource });
  const at = new Date().toISOString();
  await store.update("agents", agent.id, { lastPublishedAt: at });
  await logActivity({ userId: s.userId, agentId: agent.id, type: "post.published", text: "Published a post from your Vexo band", refType: "post", refId: post.id });
  await mark({ status: "published", postId: post.id });
  return finish("published", `Published 1 post from ${plural(batch.length, "transcript")}${tail}.`, { postId: post.id }, { lastPublishedAt: at });
}

/** Publishes now, ignoring the interval. */
export async function publishNow(userId: string): Promise<PublishResult> {
  return run(await getBandSettings(userId));
}

/** Publishes for every user whose interval has elapsed. Concurrent callers claim the slot, so each slot posts once. */
export async function publishDue(): Promise<number> {
  let made = 0;
  for (const s of await store.list("bandSettings")) {
    if (!s.autoPublish) continue;
    if (Date.now() - Date.parse(s.lastPublishedAt ?? s.createdAt) < INTERVAL_MS[s.publishInterval]) continue;
    // Nothing waiting: leave the slot open so the next transcript posts right away.
    if (!(await store.list("bandTranscripts", { userId: s.userId, status: "pending" }, { limit: 1 })).length) continue;
    const claimed = await store.updateIf("bandSettings", s.id, { lastPublishedAt: s.lastPublishedAt }, { lastPublishedAt: new Date().toISOString() });
    if (!claimed) continue;
    try {
      if ((await run(claimed)).outcome === "published") made++;
    } catch {
      await store.update("bandSettings", s.id, { lastPublishedAt: s.lastPublishedAt, lastOutcome: "Publishing failed; will retry." });
    }
  }
  return made;
}
