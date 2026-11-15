import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as ai from "@/lib/ai";
import { chatWithAgent } from "@/lib/agent-chat";
import { redact } from "@/lib/privacy";
import { considerPost } from "@/lib/publisher";
import { store } from "@/lib/store";
import { readBytes } from "@/lib/utils";
import { answerRequest, askNetwork, createMission, decideRequest, enqueue, processJobs } from "@/lib/engine";
import { handleMessage, sendMessage } from "./collab";

async function drain() {
  for (let i = 0; i < 40; i++) {
    const ran = await processJobs(20);
    if (!ran && !(await store.list("jobs", { status: "queued" })).length) return;
  }
}
const openOf = async (userId: string, kind: string) =>
  (await store.list("humanRequests", { userId })).filter((r) => r.kind === kind && (r.status === "pending" || r.status === "review"));
const BADMINTON = "Find someone who wants to play badminton tomorrow";

beforeEach(() => store.reset());
afterEach(() => vi.useRealTimers());

describe("collaboration protocol", () => {
  it("a retried propose_times does not duplicate approvals", async () => {
    await store.update("users", "usr_alex", { availability: ["tomorrow 19:00-20:00"] });
    await createMission("usr_sarah", BADMINTON);
    await drain();
    const propose = (await store.list("messages")).find((m) => m.type === "propose_times")!;
    await handleMessage(propose);
    expect(await openOf("usr_sarah", "approval_intro")).toHaveLength(1);
    expect(await openOf("usr_alex", "approval_intro")).toHaveLength(1);
    expect((await store.list("messages")).filter((m) => m.type === "accept_time")).toHaveLength(1);
  });

  it("the message budget never overwrites an introduced collaboration", async () => {
    await store.update("users", "usr_alex", { availability: ["tomorrow 19:00-20:00"] });
    await createMission("usr_sarah", BADMINTON);
    await drain();
    const a = (await store.get("agents", "agt_sarah"))!;
    await store.update("agents", "agt_sarah", { budget: { ...a.budget, messagesPerHour: 2 } });
    for (const u of ["usr_sarah", "usr_alex"]) await decideRequest(u, (await openOf(u, "approval_intro"))[0].id, "approve", { confirmed: true });
    await drain();
    expect((await store.list("collaborations"))[0].status).toBe("introduced");
    expect((await store.list("missions"))[0].status).toBe("completed");
  });

  it("asks the initiator's human when they have no availability", async () => {
    await createMission("usr_alex", BADMINTON); // Alex has no stored availability
    await drain();
    const [q] = await openOf("usr_alex", "question");
    expect(q).toBeTruthy();
    await answerRequest("usr_alex", q.id, "I'm free after 6pm tomorrow", "text");
    await decideRequest("usr_alex", q.id, "approve");
    await drain();
    expect(await openOf("usr_alex", "approval_intro")).toHaveLength(1);
    expect(await openOf("usr_sarah", "approval_intro")).toHaveLength(1);
  });

  it("a completed mission closes its other collaborations and their questions", async () => {
    const marcus = (await store.get("users", "usr_marcus"))!;
    await store.update("users", "usr_marcus", { interests: [...marcus.interests, "badminton"] });
    const m = await createMission("usr_sarah", BADMINTON);
    await drain();
    const [q] = await openOf("usr_alex", "question");
    for (const u of ["usr_sarah", "usr_marcus"]) await decideRequest(u, (await openOf(u, "approval_intro"))[0].id, "approve", { confirmed: true });
    await drain();
    expect((await store.get("missions", m.id))!.status).toBe("completed");
    expect((await store.get("humanRequests", q.id))!.status).toBe("expired");
    expect((await store.list("collaborations", { responderAgentId: "agt_alex" }))[0].status).toBe("expired");
  });

  it("expires overdue collaborations on the next tick, and a pending question can be declined", async () => {
    const m = await createMission("usr_sarah", BADMINTON);
    await drain();
    const [q] = await openOf("usr_alex", "question");
    const collab = (await store.list("collaborations"))[0];
    await store.update("collaborations", collab.id, { expiresAt: new Date(Date.now() - 1000).toISOString() });
    await processJobs();
    expect((await store.get("collaborations", collab.id))!.status).toBe("expired");
    expect((await store.get("humanRequests", q.id))!.status).toBe("expired");
    expect((await store.get("missions", m.id))!.status).toBe("failed");

    await createMission("usr_sarah", BADMINTON);
    await drain();
    const [q2] = await openOf("usr_alex", "question");
    await decideRequest("usr_alex", q2.id, "reject");
    expect((await store.get("humanRequests", q2.id))!.status).toBe("rejected");
  });

  it("an inbound request in flight is declined once the human turned requests off", async () => {
    await createMission("usr_sarah", BADMINTON);
    await processJobs(1); // discover only
    const a = (await store.get("agents", "agt_alex"))!;
    await store.update("agents", "agt_alex", { permissions: { ...a.permissions, allowInboundRequests: false } });
    await drain();
    expect(await openOf("usr_alex", "question")).toHaveLength(0);
    expect((await store.list("collaborations"))[0].status).toBe("declined");
  });

  it("reclaims a job left running by a crash", async () => {
    const job = await enqueue("noop.unknown", {});
    await store.update("jobs", job.id, { status: "running", attempts: 1 });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 60_000);
    await processJobs();
    expect((await store.get("jobs", job.id))!.status).not.toBe("running");
  });

  it("closing messages skip the loop guards", async () => {
    await createMission("usr_sarah", BADMINTON);
    await drain();
    const collab = (await store.list("collaborations"))[0];
    await store.update("collaborations", collab.id, { turns: collab.maxTurns, status: "awaiting_intro" });
    expect(await sendMessage(collab, collab.initiatorAgentId, collab.responderAgentId, "intro_declined", {}, "no")).toBeTruthy();
    expect((await store.get("collaborations", collab.id))!.status).toBe("awaiting_intro");
  });
});

describe("privacy", () => {
  it("an edited summary replaces the forwarded fields, and the raw note never goes out", async () => {
    await askNetwork("usr_sarah", "Is Ritual Coffee on Valencia St crowded right now?");
    await drain();
    const [req] = await openOf("usr_alex", "observation");
    await answerRequest("usr_alex", req.id, "Pretty quiet. My coworker Dana is skipping work here again", "text");
    await decideRequest("usr_alex", req.id, "approve", { editedSummary: "Crowd level: low." });
    await drain();
    const msg = (await store.list("messages")).find((x) => x.type === "observation_response")!;
    expect(JSON.stringify(msg.payload)).not.toContain("Dana");
    expect(msg.payload.summary).toBe("Crowd level: low.");
  });

  it("the question sent to another human is redacted", async () => {
    await askNetwork("usr_sarah", "Is Ritual Coffee crowded right now? email me at sarah@x.io");
    await drain();
    const [req] = await openOf("usr_alex", "observation");
    expect(req.prompt + JSON.stringify(await store.list("messages"))).not.toContain("sarah@x.io");
  });

  it("redact catches handles, profile urls, international numbers and spelled-out emails", () => {
    for (const t of ["DM me @alexplays", "https://instagram.com/alexplays", "+44 20 7946 0958", "alex at example dot com"])
      expect(redact(t)).toContain("[redacted]");
  });

  it("simulator reads the single interest the engine sends", async () => {
    const r = await ai.reviewInbound({ kind: "match", request: { interest: "chess" }, known: { interests: ["coffee"], availability: [], recentPlaces: [] } });
    expect(r.wants).toBe(false);
  });

  it("chat confirmation applies to the request that was read back", async () => {
    const mk = (draft: string) =>
      store.insert("humanRequests", { userId: "usr_alex", agentId: "agt_alex", kind: "approval_post", status: "pending", sensitive: true, prompt: draft, context: "", postDraft: draft });
    const older = await mk("older post here today");
    const shown = await mk("shown post here today");
    await new Promise((r) => setTimeout(r, 5));
    const asked = await chatWithAgent("usr_alex", "yes", "text");
    expect(asked.confirm?.requestId).toBe(shown.id);
    const newer = await mk("newer post arrives later");
    await chatWithAgent("usr_alex", "yes, confirm", "text");
    expect((await store.get("humanRequests", shown.id))!.status).toBe("approved");
    expect((await store.get("humanRequests", newer.id))!.status).toBe("pending");
    expect((await store.get("humanRequests", older.id))!.status).toBe("pending");
  });

  it("a manual-frequency agent-initiated post asks instead of skipping", async () => {
    await store.update("agents", "agt_sarah", { publishFrequency: "manual" });
    const r = await considerPost("usr_sarah", "I want to find a chess partner this weekend in the park", "mission");
    expect(r.outcome).toBe("needs_approval");
  });

  it("readBytes refuses bodies over the cap", async () => {
    const big = new Request("http://x", { method: "POST", body: new Uint8Array(2000) });
    expect(await readBytes(big, 1000)).toBeNull();
    expect((await readBytes(new Request("http://x", { method: "POST", body: new Uint8Array(10) }), 1000))!.byteLength).toBe(10);
  });
});
