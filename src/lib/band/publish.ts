import { logActivity, matchPost, tipPost } from "@/lib/engine";
import { redact } from "@/lib/privacy";
import { store } from "@/lib/store";
import { BAND_TOPICS } from "@/lib/types";
import type { BandSettings, BandTopic, BandTranscript } from "@/lib/types";
import { getBandSettings } from "./settings";
import { capWords, INTERVAL_MS, MAX_POST_WORDS, BAND_TOPIC_LABELS } from "./topics";
import { checkPost, cleanTags, writePost } from "./writer";

export type PublishResult = { outcome: "published" | "needs_approval" | "nothing" | "skipped"; reason: string; postId?: string };

const BATCH = 12; // transcripts folded into one post; the rest wait for the next round

/** Why a transcript may not be published, or null when at least one topic it touches is switched on (clean or mixed). */
function blockReason(t: BandTranscript, topics: BandSettings["topics"]): string | null {
  if (!t.topics.length) return "No topic detected";
  if (t.topics.some((x) => topics[x])) return null;
  return `Only mentions ${t.topics.map((x) => BAND_TOPIC_LABELS[x].label).join(", ")}, which you have not switched on`;
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

async function run(s: BandSettings, before: string | undefined, auto: boolean): Promise<PublishResult> {
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
  if (!eligible.length) // the slot was claimed before knowing: give it back so the next eligible transcript posts at once
    return finish("nothing", filtered ? `Nothing to publish: ${plural(filtered, "transcript")} mention topics you have not switched on or none was detected.` : "Nothing to publish: no new transcripts.", {}, { lastPublishedAt: before });

  const agent = (await store.list("agents", { userId: s.userId }))[0];
  if (!agent) return finish("skipped", "Skipped: you have no agent to post for you.");
  if (agent.paused) return finish("skipped", "Skipped: your agent is paused.");
  // "Revoke all sharing" turns auto-publish off; a human pressing Publish now still may.
  if (auto && !agent.permissions.allowAutoPublish) return finish("skipped", "Skipped: auto-publish is off in Settings.");

  const batch = eligible.slice(0, BATCH);
  const allowed = BAND_TOPICS.filter((t) => s.topics[t]) as BandTopic[];
  const blocked = BAND_TOPICS.filter((t) => !s.topics[t]) as BandTopic[];
  const isClean = (t: BandTranscript) => t.topics.every((x) => s.topics[x]);
  const offLabels = (ts: BandTranscript[]) =>
    [...new Set(ts.flatMap((t) => t.topics.filter((x) => !s.topics[x])))].map((x) => BAND_TOPIC_LABELS[x].label).join(", ");
  const draft = async (ts: BandTranscript[]) => {
    const w = await writePost({ agent, transcripts: ts.map((t) => ({ ...t, text: redact(t.text) })), allowed, blocked });
    return { ...w, text: capWords(redact(w.text), MAX_POST_WORDS) };
  };
  let used = batch;
  let written = await draft(batch);
  const mixed = batch.filter((t) => !isClean(t));
  if (mixed.length) {
    // The simulator only used clean transcripts; a live post must pass the second check. Fail closed, retry once from clean ones.
    const simulated = written.aiSource === "simulated";
    const empty = !simulated && !written.text; // live and nothing switched-on was left in the batch
    const hit = written.text && !simulated ? await checkPost(written.text, blocked) : [];
    if (simulated || empty || hit === null || hit.length) {
      for (const t of mixed) {
        const what = offLabels([t]);
        const reason = simulated || hit === null ? `Gemini was unavailable to leave out ${what}`
          : empty ? `Nothing switched on was left to post after leaving out ${what}`
          : `Your agent could not leave out ${what}, so this was not posted`;
        await store.update("bandTranscripts", t.id, { status: "filtered", reason });
      }
      filtered += mixed.length;
      used = batch.filter(isClean);
      if (!simulated) written = used.length ? await draft(used) : { ...written, text: "" };
    }
  }
  const text = written.text;
  if (!text) {
    // Nothing postable: filter what was tried so it cannot block the queue forever.
    for (const t of used) await store.update("bandTranscripts", t.id, { status: "filtered", reason: "Your agent found nothing to post" });
    filtered += used.length;
    return finish("nothing", `Nothing to publish${filtered ? `: ${plural(filtered, "transcript")} filtered` : ""}.`);
  }
  // Gemini's tags are never checked, so a post that used a mixed transcript gets tags from its switched-on topics instead.
  const tags = used.some((t) => !isClean(t)) ? cleanTags(used.flatMap((t) => t.topics.filter((x) => s.topics[x]))) : written.tags;
  const { aiSource } = written;
  const mark = (patch: Partial<BandTranscript>) => Promise.all(used.map((t) => store.update("bandTranscripts", t.id, patch)));
  const left = offLabels(used.filter((t) => !isClean(t)));
  const tail = `${left ? ` (left out ${left})` : ""}${filtered ? `; ${filtered} filtered` : ""}`;

  if (agent.permissions.requirePostApproval) {
    await store.insert("humanRequests", {
      userId: s.userId, agentId: agent.id, kind: "approval_post", status: "pending", prompt: "Publish this to the network?",
      context: "Written from your Vexo band transcripts.", postDraft: text, aiSource,
    });
    await mark({ status: "awaiting_approval" });
    return finish("needs_approval", `Draft from ${plural(used.length, "transcript")} is waiting for your approval${tail}.`);
  }

  const post = await store.insert("posts", { agentId: agent.id, userId: s.userId, text, kind: "update", tags, provenance: "ai_generated", aiSource });
  const at = new Date().toISOString();
  await store.update("agents", agent.id, { lastPublishedAt: at });
  await logActivity({ userId: s.userId, agentId: agent.id, type: "post.published", text: "Published a post from your Vexo band", refType: "post", refId: post.id });
  await matchPost(post.id).catch(() => []);
  await tipPost(post.id, used.map((t) => t.text).join(" ")).catch(() => null);
  await mark({ status: "published", postId: post.id });
  return finish("published", `Published 1 post from ${plural(used.length, "transcript")}${tail}.`, { postId: post.id }, { lastPublishedAt: at });
}

/** Takes the slot (compare-and-set on lastPublishedAt) so two runs never publish the same transcripts, then runs. Null when another run holds it. */
async function claimAndRun(s: BandSettings, giveBack: (r: PublishResult) => boolean, auto = false): Promise<PublishResult | null> {
  const claimed = await store.updateIf("bandSettings", s.id, { lastPublishedAt: s.lastPublishedAt }, { lastPublishedAt: new Date().toISOString() });
  if (!claimed) return null;
  try {
    const r = await run(claimed, s.lastPublishedAt, auto);
    if (giveBack(r)) await store.update("bandSettings", s.id, { lastPublishedAt: s.lastPublishedAt });
    return r;
  } catch (e) {
    await store.update("bandSettings", s.id, { lastPublishedAt: s.lastPublishedAt, lastOutcome: "Publishing failed; will retry." });
    throw e;
  }
}

/** Publishes now, ignoring the interval. Nothing published (or a failure) leaves the schedule as it was. */
export async function publishNow(userId: string): Promise<PublishResult> {
  const r = await claimAndRun(await getBandSettings(userId), (r) => r.outcome === "nothing" || r.outcome === "skipped");
  return r ?? { outcome: "skipped", reason: "Skipped: a publish is already running." };
}

/** Publishes for every user whose interval has elapsed. Concurrent callers claim the slot, so each slot posts once. */
export async function publishDue(): Promise<number> {
  let made = 0;
  const seen = new Set<string>();
  for (const s of await store.list("bandSettings", {}, { order: "asc" })) {
    if (seen.has(s.userId)) continue; // one row per user: the oldest, which the page edits
    seen.add(s.userId);
    if (!s.autoPublish) continue;
    if (Date.now() - Date.parse(s.lastPublishedAt ?? s.createdAt) < INTERVAL_MS[s.publishInterval]) continue;
    // Nothing waiting: leave the slot open so the next transcript posts right away.
    if (!(await store.list("bandTranscripts", { userId: s.userId, status: "pending" }, { limit: 1 })).length) continue;
    try {
      // A round that posts nothing has filtered its whole batch, so giving the slot back cannot loop.
      if ((await claimAndRun(s, (r) => r.outcome === "nothing", true))?.outcome === "published") made++;
    } catch {}
  }
  return made;
}
