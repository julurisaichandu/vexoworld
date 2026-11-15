import { keywordsIn } from "@/lib/ai/simulator";
import { ownerLabel } from "@/lib/privacy";
import { store } from "@/lib/store";
import { BAND_TOPICS } from "@/lib/types";
import type { Agent, Post, User } from "@/lib/types";
import { logActivity } from "./log";

export type PostMatch = { agentId: string; userId: string; label: string; topics: string[]; area?: string; postId?: string; collaborationId: string };

const MAX_PICKS = 3;
const HOUR = 3_600_000;
const OPEN = ["requested", "awaiting_human", "negotiating", "awaiting_intro"];
const GENERIC = new Set(["place", "update", ...BAND_TOPICS, ...BAND_TOPICS.map((t) => t.replace(/_/g, "-"))]);
const norm = (s?: string) => (s ?? "").trim().toLowerCase();
const snippet = (t: string, n = 120) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
const plural = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;
const CITY_ALIASES: Record<string, string> = { sf: "san francisco", "san fran": "san francisco", nyc: "new york", "new york city": "new york", la: "los angeles" };
/** "SF", "san francisco " and "San Francisco, CA" are one city. */
export const cityKey = (s?: string) => {
  const c = norm(s).split(",")[0].trim();
  return CITY_ALIASES[c] ?? c;
};

const topicsOf = (text: string, tags: string[]) =>
  [...new Set([...tags.map(norm), ...keywordsIn(text)])].filter((t) => t && !GENERIC.has(t));

type Cand = { agent: Agent; user: User; shared: string[]; best?: Post; score: number };

// ponytail: one queue per process, so the dedup checks below hold; the worker and the Next server can still race (add a per-pair claim in the store if that matters).
let queue: Promise<unknown> = Promise.resolve();

/** Finds nearby humans who share a topic with a fresh post and asks both sides to approve an intro. */
export function matchPost(postId: string): Promise<PostMatch[]> {
  const run = queue.then(() => matchNow(postId));
  queue = run.catch(() => {});
  return run;
}

async function matchNow(postId: string): Promise<PostMatch[]> {
  const post = await store.get("posts", postId);
  if (!post || post.deletedAt) return [];
  const [agent, user] = await Promise.all([store.get("agents", post.agentId), store.get("users", post.userId)]);
  if (!agent || agent.paused || !user) return [];
  const topics = topicsOf(post.text, post.tags);
  const city = cityKey(user.city);
  // Nearby matching reveals coarse location, so both sides must share it.
  if (!topics.length || !city || !agent.permissions.shareCoarseLocation) return [];
  const [users, agents, allPosts, collabs, connections, messages] = await Promise.all([
    store.list("users"), store.list("agents"), store.list("posts"), store.list("collaborations"), store.list("connections"), store.list("messages"),
  ]);
  if (messages.some((m) => m.type === "collab_request" && m.payload.postId === postId)) return [];
  const since = new Date(Date.now() - HOUR).toISOString();
  const sent = (agentId: string) => messages.filter((m) => m.fromAgentId === agentId && m.createdAt > since).length;
  // Each match costs both agents a message now and an intro_accepted later: stay inside the hourly budgets.
  const room = Math.min(MAX_PICKS, Math.floor((agent.budget.messagesPerHour - sent(agent.id)) / 2));
  if (room <= 0) return [];

  const userById = new Map(users.map((u) => [u.id, u]));
  const cands: Cand[] = [];
  for (const a of agents) {
    if (a.userId === user.id || a.paused || !a.permissions.allowInboundRequests || !a.permissions.shareCoarseLocation) continue;
    const u = userById.get(a.userId);
    // Nearby only, and demo personas and real accounts stay separate pools (as in discover).
    if (!u || cityKey(u.city) !== city || !!u.isDemo !== !!user.isDemo) continue;
    if (a.budget.messagesPerHour - sent(a.id) < 2) continue;
    // Skip open talks, existing connections and anyone who already said no.
    if (collabs.some((c) => OPEN.includes(c.status) && [c.initiatorAgentId, c.responderAgentId].includes(a.id) && [c.initiatorAgentId, c.responderAgentId].includes(agent.id))) continue;
    if (connections.some((c) => (c.status === "mutual" || c.status === "declined") && [c.userAId, c.userBId].includes(user.id) && [c.userAId, c.userBId].includes(u.id))) continue;
    const posts = allPosts.filter((p) => p.agentId === a.id && !p.deletedAt).sort((x, y) => y.createdAt.localeCompare(x.createdAt));
    const theirs = new Set([...posts.flatMap((p) => topicsOf(p.text, p.tags)), ...(a.permissions.shareInterests ? u.interests.map(norm) : [])]);
    const shared = topics.filter((t) => theirs.has(t));
    if (!shared.length) continue;
    const hits = posts.filter((p) => topicsOf(p.text, p.tags).some((t) => shared.includes(t)));
    const best = hits.find((p) => p.kind === "looking_for") ?? hits[0];
    const score = 2 * shared.length + (norm(u.area) && norm(u.area) === norm(user.area) ? 1 : 0) + (best?.kind === "looking_for" ? 1 : 0);
    cands.push({ agent: a, user: u, shared, best, score });
  }

  const byScore = cands.sort((x, y) => y.score - x.score);
  const picks: Cand[] = [];
  for (const t of topics) {
    if (picks.length >= room) break;
    const c = byScore.find((x) => !picks.includes(x) && x.shared.includes(t));
    if (c) picks.push(c);
  }
  for (const c of byScore) if (picks.length < room && !picks.includes(c)) picks.push(c);
  if (!picks.length) return [];

  const label = ownerLabel(user, agent);
  const out: PostMatch[] = [];
  const parts: string[] = [];
  let firstRequest: string | undefined;
  for (const c of picks) {
    const them = ownerLabel(c.user, c.agent);
    const topic = c.shared[0];
    const tShared = c.shared.join(", ");
    // One mission per match: completing a mission expires its other collaborations.
    const mission = await store.insert("missions", {
      userId: user.id,
      agentId: agent.id,
      goal: `Meet ${them} nearby for ${tShared}`,
      title: `Meet ${them} for ${tShared}`,
      kind: "match",
      status: "awaiting_human",
      steps: [
        { label: "Spot nearby people from your post", status: "done" },
        { label: "Agents compare notes", status: "done" },
        { label: "Both humans approve", status: "active" },
        { label: "Share contacts", status: "pending" },
      ],
      interests: c.shared,
      participants: [c.agent.id],
      aiSource: "simulated",
      updatedAt: new Date().toISOString(),
    });
    const sameArea = norm(user.area) !== "" && norm(user.area) === norm(c.user.area);
    const collab = await store.insert("collaborations", {
      missionId: mission.id,
      kind: "match",
      initiatorAgentId: agent.id,
      responderAgentId: c.agent.id,
      status: "awaiting_intro",
      topic,
      turns: 2,
      maxTurns: 12,
      ...(sameArea ? { agreed: { area: user.area } } : {}),
      expiresAt: new Date(Date.now() + 48 * 3_600_000).toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await store.insert("messages", {
      collaborationId: collab.id,
      fromAgentId: agent.id,
      toAgentId: c.agent.id,
      type: "collab_request",
      payload: { postId, interest: topic, topics: c.shared, area: user.area, ownerLabel: label, agentName: agent.name },
      summary: `My human just posted about ${topic}. Yours is nearby and into it too. Want to connect them?`,
      provenance: "ai_generated",
    });
    await store.insert("messages", {
      collaborationId: collab.id,
      fromAgentId: c.agent.id,
      toAgentId: agent.id,
      type: "intro_request",
      payload: { postId: c.best?.id },
      summary: c.best ? `Yes, my human posted: "${snippet(c.best.text, 80)}". Let's ask both humans first.` : `Yes, my human is into ${topic} too. Let's ask both humans first.`,
      provenance: "ai_generated",
    });
    const theirArea = c.user.area;
    const ctx = (snip: string) => `${snip ? `${snip} ` : ""}Both of you have to approve. Contact details are shared only if you both say yes.`;
    const mine = await store.insert("humanRequests", {
      userId: user.id,
      agentId: agent.id,
      kind: "approval_intro",
      status: "pending",
      sensitive: true,
      prompt: `Connect with ${them}${theirArea ? ` (${theirArea})` : ""}? You're both into ${tShared}.`,
      context: ctx(c.best ? `${them}'s post: "${snippet(c.best.text)}".` : ""),
      collaborationId: collab.id,
      missionId: mission.id,
    });
    const theirs = await store.insert("humanRequests", {
      userId: c.user.id,
      agentId: c.agent.id,
      kind: "approval_intro",
      status: "pending",
      sensitive: true,
      prompt: `Connect with ${label}${user.area ? ` (${user.area})` : ""}? They're nearby and into ${tShared} too.`,
      context: ctx(`${label}'s post: "${snippet(post.text)}".`),
      collaborationId: collab.id,
      missionId: undefined,
    });
    await logActivity({
      userId: c.user.id,
      agentId: c.agent.id,
      type: "match.found",
      text: `${agent.name} found you: ${label} is nearby and into ${tShared} too. Approve the intro?`,
      refType: "request",
      refId: theirs.id,
      notify: true,
    });
    firstRequest ??= mine.id;
    parts.push(`${them} (${topic})`);
    out.push({ agentId: c.agent.id, userId: c.user.id, label: them, topics: c.shared, area: theirArea || undefined, postId: c.best?.id, collaborationId: collab.id });
  }

  // The mission page only links to /inbox, so the bell points at the first request.
  await logActivity({
    userId: user.id,
    agentId: agent.id,
    type: "match.found",
    text: `${agent.name} found ${plural(picks.length)} nearby from your post: ${parts.join(", ")}. Approve the intros to connect.`,
    refType: "request",
    refId: firstRequest,
    notify: true,
  });
  return out;
}
