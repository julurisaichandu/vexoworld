import { store, now } from "./store";
import * as ai from "./ai";
import { postMeta } from "./ai/simulator";
import { redact } from "./privacy";
import { logActivity, matchPost, tipPost } from "@/lib/engine";
import type { HumanRequest, Post } from "./types";

export type PostOutcome = { outcome: "published" | "needs_approval" | "skipped"; post?: Post; request?: HumanRequest; reason: string };

const DAY = 86_400_000;

async function publish(agent: { id: string; userId: string }, text: string, meta: { kind: Post["kind"]; tags: string[] }, aiSource: Post["aiSource"]) {
  const post = await store.insert("posts", { agentId: agent.id, userId: agent.userId, text, kind: meta.kind, tags: meta.tags, provenance: "ai_generated", aiSource });
  await store.update("agents", agent.id, { lastPublishedAt: now() });
  await logActivity({ userId: agent.userId, agentId: agent.id, type: "post.published", text: "Published a post to the network", refType: "post", refId: post.id });
  await matchPost(post.id).catch(() => []);
  await tipPost(post.id).catch(() => null);
  return post;
}

/**
 * origin "mission" is agent-initiated and subject to frequency windows; "chat" and "manual" are the human asking,
 * so only the permission, sensitivity and approval gates apply.
 */
export async function considerPost(userId: string, candidate: string, origin: "chat" | "mission" | "manual"): Promise<PostOutcome> {
  const skipped = (reason: string): PostOutcome => ({ outcome: "skipped", reason });
  const agent = (await store.list("agents", { userId }))[0];
  if (!agent) return skipped("no agent");
  if (agent.paused) return skipped("agent is paused");
  const { permissions } = agent;
  const auto = origin === "mission";
  if (auto && !permissions.allowAutoPublish) return skipped("auto-publish is off");

  const mine = await store.list("posts", { agentId: agent.id }, { limit: 20 });
  if (auto && agent.publishFrequency === "auto" && mine.filter((p) => !p.deletedAt && Date.now() - Date.parse(p.createdAt) < DAY).length >= 4)
    return skipped("daily auto-post limit reached");

  const decision = await ai.decidePublish({
    candidate,
    personality: agent.personality,
    permissions,
    frequency: auto && agent.publishFrequency !== "manual" ? agent.publishFrequency : "auto", // manual is handled below: ask, not skip
    recentPosts: mine.filter((p) => !p.deletedAt).map((p) => p.text),
    lastPublishedAt: agent.lastPublishedAt,
  });
  if (!decision.publish) return skipped(decision.reason);

  const text = redact(decision.text);
  const meta = { kind: decision.kind, tags: decision.tags };
  if (permissions.requirePostApproval || decision.sensitivity !== "low" || agent.publishFrequency === "manual") {
    const open = (await store.list("humanRequests", { userId, kind: "approval_post", status: "pending" })).find((r) => r.postDraft === text);
    const request =
      open ??
      (await store.insert("humanRequests", {
        userId, agentId: agent.id, kind: "approval_post", status: "pending", prompt: "Publish this to the network?",
        context: decision.sensitivity !== "low" ? "This post may be sensitive, so I'm checking first." : "Your settings ask me to check before posting.",
        postDraft: text, aiSource: decision.aiSource,
      }));
    return { outcome: "needs_approval", request, reason: "waiting for your approval" };
  }
  return { outcome: "published", post: await publish(agent, text, meta, decision.aiSource), reason: decision.reason };
}

export async function publishApproved(requestId: string): Promise<Post | null> {
  const req = await store.get("humanRequests", requestId);
  if (!req || req.kind !== "approval_post" || !req.postDraft) return null;
  const agent = await store.get("agents", req.agentId);
  if (!agent) return null;
  const text = redact(req.postDraft);
  const dup = (await store.list("posts", { agentId: agent.id })).find((p) => p.text === text && !p.deletedAt);
  if (dup) return dup;
  const { kind, tags } = postMeta(text);
  return publish(agent, text, { kind, tags }, req.aiSource ?? "simulated");
}
