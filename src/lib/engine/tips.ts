import { keywordsIn } from "@/lib/ai/simulator";
import { ownerLabel } from "@/lib/privacy";
import { store } from "@/lib/store";
import { BAND_TOPICS } from "@/lib/types";
import type { Agent, Post, User } from "@/lib/types";
import { logActivity } from "./log";

const GENERIC = new Set(["place", "update", ...BAND_TOPICS, ...BAND_TOPICS.map((t) => t.replace(/_/g, "-"))]);
const norm = (s?: string) => (s ?? "").trim().toLowerCase();
const topicsOf = (text: string, tags: string[]) => [...new Set([...tags.map(norm), ...keywordsIn(text)])].filter((t) => t && !GENERIC.has(t));
// Doubled letters collapse so speech-to-text spellings still meet ("Mina" / "Minna").
const words = (t: string) => new Set((t.toLowerCase().match(/[a-z]{4,}/g) ?? []).map((w) => w.replace(/(.)\1+/g, "$1")));
const snippet = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

/**
 * Answers a fresh post with the best place tip from a neighbour in the same city: a discovery post that shares a
 * topic, ranked by words it shares with the post and `hint` (the raw band transcript, used only for ranking, never
 * shown). The tipster's agent replies with its own public post and the poster gets a notification. Once per post.
 */
export async function tipPost(postId: string, hint = ""): Promise<Post | null> {
  const post = await store.get("posts", postId);
  if (!post || post.deletedAt) return null;
  const [agent, user] = await Promise.all([store.get("agents", post.agentId), store.get("users", post.userId)]);
  if (!agent || agent.paused || !user) return null;
  const topics = topicsOf(`${post.text} ${hint}`, post.tags);
  if (!topics.length) return null;
  if ((await store.list("activity", { userId: user.id, type: "tip.found" })).some((a) => a.refId === postId)) return null;

  const query = words(`${post.text} ${hint}`);
  let best: { tip: Post; agent: Agent; user: User; score: number } | undefined;
  const tips = (await store.list("posts")).filter((p) => p.kind === "discovery" && !p.deletedAt && p.userId !== user.id);
  for (const tip of tips.sort((x, y) => y.createdAt.localeCompare(x.createdAt))) {
    const shared = topicsOf(tip.text, tip.tags).filter((t) => topics.includes(t));
    if (!shared.length) continue;
    const [a, u] = await Promise.all([store.get("agents", tip.agentId), store.get("users", tip.userId)]);
    if (!a || a.paused || !a.permissions.allowAutoPublish || !u || norm(u.city) !== norm(user.city)) continue;
    const score = 2 * shared.length + [...words(tip.text)].filter((w) => query.has(w)).length;
    if (!best || score > best.score) best = { tip, agent: a, user: u, score };
  }
  if (!best) return null;

  await store.insert("comments", { postId, agentId: best.agent.id, userId: best.user.id, text: best.tip.text, provenance: "ai_generated" });
  await logActivity({
    userId: user.id,
    agentId: agent.id,
    type: "tip.found",
    text: `${agent.name} found a tip for you. ${ownerLabel(best.user, best.agent)}'s agent says: "${snippet(best.tip.text, 160)}"`,
    refType: "post",
    refId: postId,
    notify: true,
  });
  return best.tip;
}
