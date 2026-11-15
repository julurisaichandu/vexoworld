import * as ai from "@/lib/ai";
import { ownerLabel } from "@/lib/privacy";
import { store } from "@/lib/store";
import type { Agent, AgentMessage, Collaboration, CollabStatus, HumanRequest, HumanRequestKind, MessageType, Provenance, User } from "@/lib/types";
import { enqueue, stepDelay } from "./jobs";
import { logActivity } from "./log";
import { completeMission, expireCollab, refreshMission } from "./missions";
import { dayOf, overlap, parseSlot, slotStart, slotsForDay } from "./slots";

const DEAD = ["declined", "expired", "failed"];
const FINAL = [...DEAD, "introduced", "answered"];
// Sent after a human decision or to end a conversation: loop guards must not turn them into a failure.
const CLOSING: MessageType[] = ["intro_accepted", "intro_declined", "decline", "close"];
const HOUR = 3_600_000;

async function close(collab: Collaboration, from: string, to: string, why: string) {
  if (!(await store.updateIf("collaborations", collab.id, { status: collab.status }, { status: "failed" }))) return; // already finished or moved on
  await store.insert("messages", { collaborationId: collab.id, fromAgentId: from, toAgentId: to, type: "close", payload: {}, summary: why, provenance: "ai_generated" });
  const mission = await store.get("missions", collab.missionId);
  const a = await store.get("agents", collab.initiatorAgentId);
  if (a) await logActivity({ userId: a.userId, agentId: a.id, type: "collab.stopped", text: `A conversation was stopped: ${why}`, refType: "collaboration", refId: collab.id });
  if (mission) await refreshMission(mission.id);
}

/** Persists one agent-to-agent message and schedules its delivery. Returns null when a loop guard stops it. */
export async function sendMessage(
  collab: Collaboration,
  from: string,
  to: string,
  type: MessageType,
  payload: Record<string, unknown>,
  summary: string,
  provenance: Provenance = "ai_generated",
): Promise<AgentMessage | null> {
  const [agent, fresh] = await Promise.all([store.get("agents", from), store.get("collaborations", collab.id)]);
  if (!agent || !fresh || DEAD.includes(fresh.status)) return null;
  const closing = CLOSING.includes(type);
  if (!closing && fresh.turns >= fresh.maxTurns) return close(fresh, from, to, "message limit reached").then(() => null);
  const since = new Date(Date.now() - HOUR).toISOString();
  const sent = (await store.list("messages", { fromAgentId: from })).filter((m) => m.createdAt > since).length;
  if (!closing && sent >= agent.budget.messagesPerHour) return close(fresh, from, to, "hourly message budget reached").then(() => null);
  const bumped = await store.updateIf("collaborations", collab.id, { turns: fresh.turns }, { turns: fresh.turns + 1 });
  if (!bumped) return sendMessage(collab, from, to, type, payload, summary, provenance);
  const msg = await store.insert("messages", { collaborationId: collab.id, fromAgentId: from, toAgentId: to, type, payload, summary, provenance });
  await enqueue("message.deliver", { messageId: msg.id, agentId: to }, stepDelay());
  return msg;
}

type Ctx = { collab: Collaboration; ia: Agent; ra: Agent; iu: User; ru: User };

async function ctxOf(collab: Collaboration): Promise<Ctx | null> {
  const [ia, ra] = await Promise.all([store.get("agents", collab.initiatorAgentId), store.get("agents", collab.responderAgentId)]);
  if (!ia || !ra) return null;
  const [iu, ru] = await Promise.all([store.get("users", ia.userId), store.get("users", ra.userId)]);
  return iu && ru ? { collab, ia, ra, iu, ru } : null;
}

/** Moves the collaboration `from` -> `to` (compare-and-set), then runs `act`. A retried or duplicate message loses the claim and does nothing. */
async function claimThen(c: Collaboration, from: CollabStatus, to: CollabStatus, act: () => Promise<unknown>, extra: Partial<Collaboration> = {}) {
  if (!(await store.updateIf("collaborations", c.id, { status: from }, { status: to, ...extra }))) return false;
  try {
    await act();
  } catch (e) {
    await store.updateIf("collaborations", c.id, { status: to }, { status: from }); // let the job retry
    throw e;
  }
  return true;
}

async function decline(x: Ctx, from: Agent, to: Agent, why: string) {
  const fresh = await store.get("collaborations", x.collab.id);
  if (!fresh || FINAL.includes(fresh.status)) return; // never overwrite a finished collaboration
  await sendMessage(x.collab, from.id, to.id, "decline", { reason: why }, why);
  await store.updateIf("collaborations", fresh.id, { status: fresh.status }, { status: "declined" });
  await logActivity({ userId: to.userId, agentId: to.id, type: "agent.message", text: `${from.name} declined: ${why}`, refType: "collaboration", refId: x.collab.id });
  await refreshMission(x.collab.missionId);
}

/**
 * Creates a question/observation request for the responder's human (or the initiator's, side "i"), within the rate limits.
 * Returns the request already open for this collaboration, so a retry never declines. Null when the daily budget is spent.
 */
async function askHuman(x: Ctx, kind: HumanRequestKind, prompt: string, context: string, side: "r" | "i" = "r"): Promise<HumanRequest | null> {
  const [human, agent] = side === "r" ? [x.ru, x.ra] : [x.iu, x.ia];
  const mine = await store.list("humanRequests", { userId: human.id });
  const open = mine.find((r) => r.collaborationId === x.collab.id && (r.kind === "question" || r.kind === "observation") && (r.status === "pending" || r.status === "review"));
  if (open) return open;
  const day = new Date(Date.now() - 24 * HOUR).toISOString();
  if (mine.filter((r) => (r.kind === "question" || r.kind === "observation") && r.createdAt > day).length >= agent.budget.questionsPerDay) return null;
  const req = await store.insert("humanRequests", { userId: human.id, agentId: agent.id, kind, status: "pending", prompt, context, collaborationId: x.collab.id, missionId: side === "i" ? x.collab.missionId : undefined });
  await logActivity({ userId: human.id, agentId: agent.id, type: "human.question", text: prompt, refType: "request", refId: req.id, notify: true });
  return req;
}

async function waitForHuman(x: Ctx, kind: HumanRequestKind, prompt: string, context: string) {
  const req = await askHuman(x, kind, prompt, context);
  if (!req) return decline(x, x.ra, x.ia, "My human can't take another question right now.");
  await claimThen(x.collab, "requested", "awaiting_human", () =>
    sendMessage(x.collab, x.ra.id, x.ia.id, "info_pending", {}, "My human needs to answer first. I'll get back to you."),
  );
}

const ASKED_CONTEXT = (x: Ctx, shared: string) =>
  `An agent acting for ${ownerLabel(x.iu, x.ia)} is asking. ${shared} Your raw answer stays private.`;

async function onCollabRequest(x: Ctx, msg: AgentMessage) {
  if (!x.ra.permissions.allowInboundRequests) return decline(x, x.ra, x.ia, "My human isn't taking requests from other agents.");
  const p = msg.payload as { interest?: string; when?: string; area?: string };
  const day = dayOf(p.when);
  const known = x.ra.permissions.shareAvailability ? slotsForDay(x.ru.availability, day) : [];
  const review = await ai.reviewInbound({
    kind: "match",
    request: msg.payload,
    known: { interests: x.ru.interests, availability: known, recentPlaces: [] },
  });
  if (!review.wants) return decline(x, x.ra, x.ia, "My human isn't looking for that right now.");
  if (known.length) {
    await claimThen(x.collab, "requested", "negotiating", () =>
      sendMessage(
        x.collab, x.ra.id, x.ia.id, "propose_times",
        { times: known, area: x.ra.permissions.shareCoarseLocation ? x.ru.area : "" },
        `My human could do ${known.join(" or ")}.`, "profile",
      ),
    );
    return;
  }
  const what = p.interest ?? "meet up";
  await waitForHuman(
    x, "question",
    review.questionForHuman || `Someone's agent wants to do ${what}${p.when ? ` ${p.when}` : ""}. What times work for you?`,
    ASKED_CONTEXT(x, `They asked about ${what}${p.when ? ` ${p.when}` : ""}. Only the times you approve are shared.`),
  );
}

async function approvalFor(x: Ctx, mine: "i" | "r", topic: string, time: string, area: string) {
  const [me, mineAgent, other, otherAgent] = mine === "i" ? [x.iu, x.ia, x.ru, x.ra] : [x.ru, x.ra, x.iu, x.ia];
  const have = await store.list("humanRequests", { userId: me.id, collaborationId: x.collab.id });
  if (have.some((r) => r.kind === "approval_intro")) return; // a retry must not ask twice
  const req = await store.insert("humanRequests", {
    userId: me.id,
    agentId: mineAgent.id,
    kind: "approval_intro",
    status: "pending",
    sensitive: true,
    prompt: `Introduce yourself to ${ownerLabel(other, otherAgent)} for ${topic} at ${time}${area ? ` (${area})` : ""}?`,
    context: "Both of you have to approve. Your contact details are shared only if you both say yes.",
    collaborationId: x.collab.id,
    missionId: mine === "i" ? x.collab.missionId : undefined,
  });
  await logActivity({ userId: me.id, agentId: mineAgent.id, type: "human.approval", text: `Approve an introduction? ${req.prompt}`, refType: "request", refId: req.id, notify: true });
}

async function onProposeTimes(x: Ctx, msg: AgentMessage) {
  const times = Array.isArray(msg.payload.times) ? (msg.payload.times as unknown[]).filter((t): t is string => typeof t === "string" && !!parseSlot(t)) : [];
  if (x.ra.paused) { // paused agents accept nothing: try again once it resumes
    await enqueue("message.deliver", { messageId: msg.id, agentId: x.ra.id }, 5000);
    return;
  }
  const common = overlap(x.iu.availability, times);
  if (!common.length) {
    // No stored availability for that day: ask the initiator's own human instead of declining.
    if (times.length && !slotsForDay(x.iu.availability, dayOf(times[0])).length) {
      const req = await askHuman(
        x, "question", `Another agent can do ${times.join(" or ")} for ${x.collab.topic}. What times work for you?`,
        "Your agent found a possible match. Only the times you approve are shared.", "i",
      );
      if (req) return refreshMission(x.collab.missionId);
    }
    return decline(x, x.ia, x.ra, "We couldn't find a time that works for both of us.");
  }
  const time = slotStart(common[0]);
  const area = (msg.payload.area as string) || (x.ia.permissions.shareCoarseLocation ? x.iu.area : "");
  const topic = x.collab.topic.replace(/ (today|tomorrow|mon|tue|wed|thu|fri|sat|sun|weekend)\w*$/i, "");
  const waiting = (await store.list("humanRequests", { userId: x.ru.id, kind: "approval_intro", status: "pending" })).length;
  if (waiting >= x.ra.budget.questionsPerDay) return decline(x, x.ra, x.ia, "My human has too many introductions waiting.");
  await claimThen(x.collab, "negotiating", "awaiting_intro", async () => {
    await sendMessage(x.collab, x.ia.id, x.ra.id, "accept_time", { time, area }, `Let's do ${time}${area ? ` in ${area}` : ""}.`);
    await approvalFor(x, "i", topic, time, area);
    await approvalFor(x, "r", topic, time, area);
  }, { agreed: { time, area, window: common[0] } });
  await refreshMission(x.collab.missionId);
}

async function onObservationRequest(x: Ctx, msg: AgentMessage) {
  const p = msg.payload as { place?: string; question?: string };
  if (!x.ra.permissions.allowObservationQuestions) return decline(x, x.ra, x.ia, "My human doesn't take observation questions.");
  const review = await ai.reviewInbound({ kind: "observation", request: msg.payload, known: { interests: x.ru.interests, availability: [], recentPlaces: [] } });
  if (!review.wants) return decline(x, x.ra, x.ia, "My human can't help with that.");
  await waitForHuman(
    x, "observation",
    `Someone wants to know: ${String(p.question ?? p.place).replace(/[.?!\s]+$/, "")}? Would you like to answer?`,
    ASKED_CONTEXT(x, `They asked about ${p.place}. Only a short summary you approve is shared, with the time you observed it.`),
  );
}

async function onObservationResponse(x: Ctx, msg: AgentMessage) {
  const observedAt = String(msg.payload.observedAt ?? msg.createdAt);
  const summary = String(msg.payload.summary ?? "");
  await store.update("collaborations", x.collab.id, { status: "answered" });
  const when = new Date(observedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const outcome = `${x.collab.topic}: ${summary} (reported by a person there, observed ${when}, human-verified)`;
  await logActivity({ userId: x.iu.id, agentId: x.ia.id, type: "observation.received", text: `Answer received: ${summary}`, refType: "collaboration", refId: x.collab.id });
  await completeMission(x.collab.missionId, outcome, `Answer from the network: ${outcome}`);
}

export async function handleMessage(msg: AgentMessage): Promise<void> {
  const collab = await store.get("collaborations", msg.collaborationId);
  if (!collab || FINAL.includes(collab.status)) return;
  const mission = await store.get("missions", collab.missionId);
  if (!mission || ["completed", "failed", "cancelled"].includes(mission.status) || collab.expiresAt < new Date().toISOString()) {
    await expireCollab(collab);
    return;
  }
  const x = await ctxOf(collab);
  if (!x) return;
  const to = msg.toAgentId === x.ia.id ? x.iu : x.ru;
  const toAgent = msg.toAgentId === x.ia.id ? x.ia : x.ra;
  const say = (type: string, text: string, notify = false) =>
    logActivity({ userId: to.id, agentId: toAgent.id, type, text, refType: "collaboration", refId: collab.id, notify });

  switch (msg.type) {
    case "collab_request":
      if (collab.status !== "requested") return; // already handled (retry or duplicate)
      await say("agent.message", `${x.ia.name} asked ${x.ra.name} about ${collab.topic}.`);
      return onCollabRequest(x, msg);
    case "observation_request":
      if (collab.status !== "requested") return;
      await say("agent.message", `${x.ia.name} asked ${x.ra.name} a question.`);
      return onObservationRequest(x, msg);
    case "info_pending":
      await say("agent.message", `${x.ra.name} is checking with their human first.`);
      return refreshMission(collab.missionId);
    case "propose_times":
      if (collab.status !== "negotiating") return;
      await say("agent.message", `${x.ra.name} proposed times: ${(msg.payload.times as string[]).join(", ")}.`);
      return onProposeTimes(x, msg);
    case "accept_time":
      return void (await say("agent.message", `${x.ia.name} agreed on ${msg.payload.time}. Waiting for both of you to approve the introduction.`));
    case "observation_response":
      return onObservationResponse(x, msg);
    default:
      return;
  }
}

/** Records one human's introduction decision; finalizes the connection once both approved. */
export async function recordIntroDecision(req: HumanRequest, approve: boolean): Promise<void> {
  const collab = (await store.get("collaborations", req.collaborationId!))!;
  if (collab.status !== "awaiting_intro") return; // ended meanwhile (expired, mission over): nothing to decide
  const x = await ctxOf(collab);
  if (!x) return;
  const [a, b] = [x.iu.id, x.ru.id];
  const mine = req.userId === a ? x.ia : x.ra;
  const theirs = req.userId === a ? x.ra : x.ia;
  const siblings = (await store.list("humanRequests", { collaborationId: collab.id })).filter((r) => r.kind === "approval_intro" && r.id !== req.id);
  let con = (await store.list("connections", { collaborationId: collab.id }))[0];

  if (!approve) {
    if (con) await store.update("connections", con.id, { status: "declined" });
    else await store.insert("connections", { userAId: a, userBId: b, collaborationId: collab.id, missionId: collab.missionId, status: "declined", approvedBy: [] });
    for (const s of siblings) if (s.status === "pending") await store.update("humanRequests", s.id, { status: "expired", resolvedAt: new Date().toISOString() });
    await sendMessage(collab, mine.id, theirs.id, "intro_declined", {}, "My human prefers not to go ahead.");
    await store.updateIf("collaborations", collab.id, { status: "awaiting_intro" }, { status: "declined" });
    await logActivity({ userId: theirs.userId, agentId: theirs.id, type: "connection.declined", text: "The introduction didn't go ahead.", refType: "collaboration", refId: collab.id, notify: true });
    return refreshMission(collab.missionId);
  }

  // derived from the requests themselves, so two simultaneous approvals cannot overwrite each other
  const approvedBy = [...new Set([req.userId, ...siblings.filter((s) => s.status === "approved").map((s) => s.userId)])];
  let created = false;
  if (con) await store.update("connections", con.id, { approvedBy });
  else {
    con = await store.insert("connections", { userAId: a, userBId: b, collaborationId: collab.id, missionId: collab.missionId, status: "pending", approvedBy });
    created = true;
  }
  if (!siblings.every((s) => s.status === "approved")) {
    await logActivity({ userId: req.userId, agentId: mine.id, type: "connection.waiting", text: "You approved. Waiting for the other person to decide.", refType: "collaboration", refId: collab.id });
    return refreshMission(collab.missionId);
  }

  const won = await store.updateIf("collaborations", collab.id, { status: "awaiting_intro" }, { status: "introduced" });
  if (!won) {
    if (created) await store.remove("connections", con.id); // the other approval finished first and owns the connection
    return;
  }
  for (const dup of await store.list("connections", { collaborationId: collab.id })) if (dup.id !== con.id) await store.remove("connections", dup.id);
  await store.update("connections", con.id, { status: "mutual", approvedBy: [a, b], sharedContact: { [a]: x.iu.contact, [b]: x.ru.contact } });
  await sendMessage(collab, x.ia.id, x.ra.id, "intro_accepted", {}, "My human said yes to the introduction.", "human_verified");
  await sendMessage(collab, x.ra.id, x.ia.id, "intro_accepted", {}, "My human said yes too.", "human_verified");
  const m = await store.get("missions", collab.missionId);
  const interest = m?.interests[0] ?? collab.topic;
  const ag = won.agreed ?? {};
  const outcome = `Matched with ${x.ru.name.split(" ")[0]} for ${interest} ${ag.time ?? ""}${ag.area ? ` (${ag.area})` : ""}`;
  await completeMission(collab.missionId, outcome, `It's a match! ${outcome}`);
  await logActivity({ userId: b, agentId: x.ra.id, type: "connection.mutual", text: `It's a match! You and ${x.iu.name.split(" ")[0]} both said yes (${interest} ${ag.time ?? ""}).`, refType: "connection", refId: con.id, notify: true });
  await logActivity({ userId: a, agentId: x.ia.id, type: "connection.mutual", text: `It's a match! You and ${x.ru.name.split(" ")[0]} both said yes.`, refType: "connection", refId: con.id, notify: true });
}

export async function continueFromAnswer(req: HumanRequest): Promise<void> {
  const collab = await store.get("collaborations", req.collaborationId!);
  if (!collab || FINAL.includes(collab.status)) return;
  const mission = await store.get("missions", collab.missionId);
  if (!mission || ["completed", "failed", "cancelled"].includes(mission.status) || collab.expiresAt < new Date().toISOString()) {
    await expireCollab(collab);
    return;
  }
  const x = await ctxOf(collab);
  if (!x) return;
  const approved = req.answerStructured;
  if (req.userId === x.iu.id) {
    // The initiator's human gave times: run the proposal they were asked about again, now with their availability.
    const proposal = (await store.list("messages", { collaborationId: collab.id, type: "propose_times" }, { order: "asc" })).pop();
    if (collab.status !== "negotiating" || !proposal) return;
    const offered = Array.isArray(proposal.payload.times) ? (proposal.payload.times as string[]) : [];
    if (!slotsForDay(x.iu.availability, dayOf(offered[0])).length) return decline(x, x.ia, x.ra, "My human didn't give times I could use.");
    return onProposeTimes(x, proposal);
  }
  if (req.kind === "observation") {
    // Only the summary and the crowd level go out. Free-text fields can carry the raw answer.
    const fields = approved?.fields.crowd ? { crowd: approved.fields.crowd } : {};
    await sendMessage(
      collab, x.ra.id, x.ia.id, "observation_response",
      { place: collab.topic, fields, summary: approved?.summary ?? "", observedAt: req.observedAt ?? new Date().toISOString() },
      `Answer from my human: ${approved?.summary ?? ""}`, "human_verified",
    );
    return;
  }
  const times = (approved?.fields.availability ?? "").split(",").map((s) => s.trim()).filter((s) => parseSlot(s));
  if (!times.length) return decline(x, x.ra, x.ia, "My human didn't give times I could use.");
  await claimThen(collab, "awaiting_human", "negotiating", () =>
    sendMessage(
      collab, x.ra.id, x.ia.id, "propose_times",
      { times, area: x.ra.permissions.shareCoarseLocation ? x.ru.area : "" },
      `My human said they can do ${times.join(" or ")}.`, "human_verified",
    ),
  );
}

export async function declineFromHuman(req: HumanRequest): Promise<void> {
  const collab = req.collaborationId ? await store.get("collaborations", req.collaborationId) : null;
  const x = collab && (await ctxOf(collab));
  if (!x) return;
  if (req.userId === x.iu.id) await decline(x, x.ia, x.ra, "My human can't do those times.");
  else await decline(x, x.ra, x.ia, "My human can't help with this right now.");
}
