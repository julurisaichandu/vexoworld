import * as ai from "@/lib/ai";
import { publishApproved } from "@/lib/publisher";
import { store } from "@/lib/store";
import type { HumanRequest } from "@/lib/types";
import { continueFromAnswer, declineFromHuman, recordIntroDecision } from "./collab";
import { enqueue, stepDelay } from "./jobs";
import { logActivity } from "./log";
import { refreshMission } from "./missions";
import { dayOf, extractSlots, parseSlot } from "./slots";

async function owned(userId: string, id: string): Promise<HumanRequest> {
  const req = await store.get("humanRequests", id);
  if (!req || req.userId !== userId) throw new Error("forbidden");
  return req;
}

export async function answerRequest(
  userId: string,
  requestId: string,
  text: string,
  source: "voice" | "text" | "simulated_voice",
): Promise<HumanRequest> {
  const req = await owned(userId, requestId);
  if (req.kind !== "question" && req.kind !== "observation") throw new Error("this request takes no answer");
  if (req.status !== "pending" && req.status !== "review") throw new Error("request already resolved");
  const structured = await ai.structureAnswer(req.prompt, text, req.kind);
  const fields = { ...structured.fields };
  if (req.kind === "question") {
    const collab = req.collaborationId ? await store.get("collaborations", req.collaborationId) : null;
    const mission = collab && (await store.get("missions", collab.missionId));
    const given = (fields.availability ?? "").split(",").map((s) => s.trim());
    if (!given.length || !given.every((s) => parseSlot(s))) {
      const slots = extractSlots([text, ...Object.values(fields)].join(" "), dayOf(mission?.when ?? mission?.goal) ?? "today");
      if (slots.length) fields.availability = slots.join(", ");
      else delete fields.availability;
    }
  }
  const next = await store.updateIf("humanRequests", requestId, { status: req.status }, {
    status: "review",
    answerRaw: text,
    answerSource: source,
    answerStructured: { summary: structured.summary, fields },
    aiSource: structured.aiSource,
    observedAt: req.kind === "observation" ? new Date().toISOString() : undefined,
  });
  if (!next) throw new Error("request changed, try again");
  return next;
}

export async function decideRequest(
  userId: string,
  requestId: string,
  decision: "approve" | "reject",
  opts: { confirmed?: boolean; editedSummary?: string } = {},
): Promise<HumanRequest> {
  const req = await owned(userId, requestId);
  const approve = decision === "approve";
  const needsReview = req.kind === "question" || req.kind === "observation";
  if (needsReview ? req.status !== "review" : req.status !== "pending") throw new Error(needsReview ? "answer the request first" : "request already resolved");
  if (approve && req.sensitive && opts.confirmed !== true) throw new Error("confirmation required");

  const patch: Partial<HumanRequest> = { status: approve ? "approved" : "rejected", resolvedAt: new Date().toISOString() };
  if (approve && opts.editedSummary && req.answerStructured) patch.answerStructured = { ...req.answerStructured, summary: opts.editedSummary };
  const next = await store.updateIf("humanRequests", requestId, { status: req.status }, patch);
  if (!next) throw new Error("request changed, try again");

  if (req.kind === "approval_post") {
    if (approve) await publishApproved(requestId);
  } else if (req.kind === "approval_intro") {
    await recordIntroDecision(next, approve);
  } else if (approve) {
    const slots = (next.answerStructured?.fields.availability ?? "").split(",").map((s) => s.trim()).filter((s) => parseSlot(s));
    if (slots.length) {
      const user = (await store.get("users", userId))!;
      await store.update("users", userId, { availability: [...new Set([...user.availability, ...slots])] });
    }
    await enqueue("request.continue", { requestId, agentId: req.agentId }, stepDelay());
  } else {
    await declineFromHuman(next);
  }
  await logActivity({ userId, agentId: req.agentId, type: approve ? "human.approved" : "human.rejected", text: `You ${approve ? "approved" : "declined"}: ${req.prompt}`, refType: "request", refId: requestId });
  if (req.missionId) await refreshMission(req.missionId);
  return next;
}

export const continueRequest = async (requestId: string) => {
  const req = await store.get("humanRequests", requestId);
  if (req?.status === "approved") await continueFromAnswer(req);
};
