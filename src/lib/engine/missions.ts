import * as ai from "@/lib/ai";
import { ownerLabel } from "@/lib/privacy";
import { store } from "@/lib/store";
import type { Agent, Mission, MissionStatus, User } from "@/lib/types";
import { sendMessage } from "./collab";
import { enqueue, stepDelay } from "./jobs";
import { logActivity } from "./log";

const MAX_COLLABS = 3;
const TERMINAL: MissionStatus[] = ["completed", "failed", "cancelled"];
const DEAD = ["declined", "expired", "failed"];

const stepsAt = (steps: Mission["steps"], done: number): Mission["steps"] =>
  steps.map((s, i) => ({ label: s.label, status: i < done ? "done" : i === done ? "active" : "pending" }));

export async function setMission(m: Mission, status: MissionStatus, patch: Partial<Mission> = {}) {
  const done = status === "completed" ? m.steps.length : status === "discovering" ? 1 : status === "planning" ? 0 : 2;
  return store.update("missions", m.id, { status, steps: stepsAt(m.steps, done), ...patch });
}

async function agentOf(userId: string): Promise<{ user: User; agent: Agent }> {
  const user = await store.get("users", userId);
  const agent = (await store.list("agents", { userId }))[0];
  if (!user || !agent) throw new Error("create your agent first");
  return { user, agent };
}

export async function createMission(
  userId: string,
  goal: string,
  opts: { kind?: Mission["kind"]; inputSource?: "text" | "voice" } = {},
): Promise<Mission> {
  const { user, agent } = await agentOf(userId);
  const plan = await ai.planMission(goal, { city: user.city, area: user.area, interests: user.interests });
  const steps = (plan.steps.length ? plan.steps : ["Plan", "Find agents", "Collaborate", "Report back"]).map((label) => ({ label, status: "pending" as const }));
  const mission = await store.insert("missions", {
    userId,
    agentId: agent.id,
    goal,
    title: plan.title || goal,
    kind: opts.kind ?? plan.kind,
    status: "planning",
    steps,
    interests: plan.interests,
    when: plan.when,
    place: plan.place,
    participants: [],
    aiSource: plan.aiSource,
    updatedAt: new Date().toISOString(),
  });
  const next = (await setMission(mission, "discovering"))!;
  await logActivity({
    userId,
    agentId: agent.id,
    type: "mission.created",
    text: `${agent.name} started working on: ${next.title}`,
    refType: "mission",
    refId: mission.id,
  });
  await enqueue("mission.discover", { missionId: mission.id, agentId: agent.id }, stepDelay());
  return next;
}

export const askNetwork = (userId: string, question: string) => createMission(userId, question, { kind: "observation" });

const words = (s?: string) => (s ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);

export async function discover(missionId: string): Promise<void> {
  const m = await store.get("missions", missionId);
  if (!m || (m.status !== "discovering" && m.status !== "collaborating")) return;
  const { user, agent } = await agentOf(m.userId);
  const observation = m.kind === "observation";
  const keys = (observation && m.place ? words(m.place) : m.interests.map((i) => i.toLowerCase())).concat(m.interests.length ? [] : words(m.goal));
  const existing = await store.list("collaborations", { missionId });

  const candidates: { agent: Agent; user: User; text: string; score: number }[] = [];
  for (const a of await store.list("agents")) {
    if (a.userId === m.userId || a.paused || existing.some((c) => c.responderAgentId === a.id)) continue;
    if (!(observation ? a.permissions.allowObservationQuestions : a.permissions.allowInboundRequests)) continue;
    const u = await store.get("users", a.userId);
    if (!u) continue;
    const posts = (await store.list("posts", { agentId: a.id })).filter((p) => !p.deletedAt);
    const text = [a.permissions.shareInterests ? u.interests.join(", ") : "", ...posts.map((p) => `${p.text} ${p.tags.join(" ")}`)].join(". ").toLowerCase();
    const score = keys.filter((k) => text.includes(k)).length;
    if (score > 0) candidates.push({ agent: a, user: u, text, score });
  }

  let chosen = candidates;
  if (candidates.length) {
    const { ranked } = await ai.rankCandidates(m.goal, candidates.map((c) => ({ agentId: c.agent.id, text: c.text })));
    const rank = new Map(ranked.map((r, i) => [r.agentId, i]));
    chosen = [...candidates].sort((a, b) => (rank.get(a.agent.id) ?? 99) - (rank.get(b.agent.id) ?? 99) || b.score - a.score);
  }
  chosen = chosen.slice(0, Math.max(0, MAX_COLLABS - existing.length));

  const topic = observation ? (m.place ?? m.goal) : [m.interests[0] ?? m.title, m.when].filter(Boolean).join(" ");
  const label = ownerLabel(user, agent);
  for (const c of chosen) {
    const collab = await store.insert("collaborations", {
      missionId,
      kind: observation ? "observation" : "match",
      initiatorAgentId: agent.id,
      responderAgentId: c.agent.id,
      status: "requested",
      topic,
      turns: 0,
      maxTurns: 12,
      expiresAt: new Date(Date.now() + 48 * 3_600_000).toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await logActivity({
      userId: m.userId,
      agentId: agent.id,
      type: "agent.contacted",
      text: `${agent.name} contacted ${c.agent.name} about ${topic}.`,
      refType: "collaboration",
      refId: collab.id,
    });
    const base = { ownerLabel: label, agentName: agent.name };
    if (observation) {
      await sendMessage(collab, agent.id, c.agent.id, "observation_request", { ...base, place: m.place ?? m.goal, question: m.goal }, `Asking ${c.agent.name}'s human: ${m.goal}`, "ai_generated");
    } else {
      await sendMessage(
        collab,
        agent.id,
        c.agent.id,
        "collab_request",
        { ...base, interest: m.interests[0] ?? m.title, when: m.when ?? "", area: agent.permissions.shareCoarseLocation ? user.area : "" },
        `My human wants to ${m.interests[0] ?? "meet up"}${m.when ? ` ${m.when}` : ""}. Is yours interested?`,
        "ai_generated",
      );
    }
  }

  const fresh = (await store.get("missions", missionId))!;
  if (TERMINAL.includes(fresh.status)) return;
  const participants = [...new Set([...fresh.participants, ...chosen.map((c) => c.agent.id)])];
  if (!participants.length) {
    await setMission(fresh, "failed", { outcome: "No matching agents on the network yet." });
    await logActivity({ userId: m.userId, agentId: agent.id, type: "mission.failed", text: `${agent.name} found nobody to contact for: ${m.title}`, refType: "mission", refId: m.id, notify: true });
    return;
  }
  await setMission(fresh, "collaborating", { participants });
}

/** Recomputes the mission status from its collaborations and the initiator's open requests. */
export async function refreshMission(missionId: string): Promise<void> {
  const m = await store.get("missions", missionId);
  if (!m || TERMINAL.includes(m.status) || m.status === "discovering" || m.status === "planning") return;
  const collabs = await store.list("collaborations", { missionId });
  if (collabs.length && collabs.every((c) => DEAD.includes(c.status))) {
    await setMission(m, "failed", { outcome: "Nobody could make it this time." });
    await logActivity({ userId: m.userId, agentId: m.agentId, type: "mission.failed", text: `No match for: ${m.title}`, refType: "mission", refId: m.id, notify: true });
    return;
  }
  const open = (await store.list("humanRequests", { userId: m.userId })).some((r) => r.missionId === missionId && (r.status === "pending" || r.status === "review"));
  const status = open ? "awaiting_human" : "collaborating";
  if (m.status !== status) await setMission(m, status);
}

export async function completeMission(missionId: string, outcome: string, text: string): Promise<void> {
  const m = await store.get("missions", missionId);
  if (!m || TERMINAL.includes(m.status)) return;
  await setMission(m, "completed", { outcome });
  await logActivity({ userId: m.userId, agentId: m.agentId, type: "mission.completed", text, refType: "mission", refId: m.id, notify: true });
}

export async function cancelMission(userId: string, missionId: string): Promise<void> {
  const m = await store.get("missions", missionId);
  if (!m || m.userId !== userId) throw new Error("forbidden");
  if (TERMINAL.includes(m.status)) return;
  await setMission(m, "cancelled");
  for (const c of await store.list("collaborations", { missionId })) {
    if (DEAD.includes(c.status) || c.status === "introduced" || c.status === "answered") continue;
    await store.update("collaborations", c.id, { status: "expired" });
    for (const r of await store.list("humanRequests", { collaborationId: c.id })) {
      if (r.status === "pending" || r.status === "review") await store.update("humanRequests", r.id, { status: "expired", resolvedAt: new Date().toISOString() });
    }
  }
  await logActivity({ userId, agentId: m.agentId, type: "mission.cancelled", text: `You cancelled: ${m.title}`, refType: "mission", refId: m.id });
}

export async function setPaused(userId: string, paused: boolean): Promise<void> {
  const { agent } = await agentOf(userId);
  await store.update("agents", agent.id, { paused });
  await logActivity({ userId, agentId: agent.id, type: paused ? "agent.paused" : "agent.resumed", text: paused ? `${agent.name} is paused and will not act.` : `${agent.name} is back to work.` });
}
