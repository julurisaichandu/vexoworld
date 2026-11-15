import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/lib/store";
import { answerRequest, cancelMission, createMission, decideRequest, askNetwork, processJobs, setPaused } from "@/lib/engine";
import { sendMessage } from "./collab";
import { extractSlots, overlap } from "./slots";

async function drain() {
  for (let i = 0; i < 40; i++) {
    const ran = await processJobs(20);
    if (!ran && !(await store.list("jobs", { status: "queued" })).length) return;
    if (!ran) await new Promise((r) => setTimeout(r, 50));
  }
}

const openOf = async (userId: string, kind: string) =>
  (await store.list("humanRequests", { userId })).filter((r) => r.kind === kind && (r.status === "pending" || r.status === "review"));
const types = async () => (await store.list("messages", undefined, { order: "asc" })).map((m) => m.type);

beforeEach(async () => {
  await store.reset();
});

describe("overlap", () => {
  it("intersects slots on the same day", () => {
    expect(overlap(["tomorrow 18:00-21:00", "sat 09:00-12:00"], ["tomorrow 19:30-23:00"])).toEqual(["tomorrow 19:30-21:00"]);
  });
  it("matches weekend against sat/sun", () => {
    expect(overlap(["sat 09:00-12:00"], ["weekend 10:00-16:00"])).toEqual(["sat 10:00-12:00"]);
  });
  it("ignores different days, short overlaps and junk", () => {
    expect(overlap(["tomorrow 18:00-21:00"], ["sat 18:00-21:00"])).toEqual([]);
    expect(overlap(["tomorrow 18:00-18:20"], ["tomorrow 18:00-21:00"])).toEqual([]);
    expect(overlap(["nonsense"], [])).toEqual([]);
  });
  it("extracts slots from free text", () => {
    expect(extractSlots("I'm free after 6pm tomorrow")).toEqual(["tomorrow 18:00-22:00"]);
    expect(extractSlots("saturday morning", "today")).toEqual(["sat 09:00-12:00"]);
  });
});

describe("badminton match", () => {
  it("runs end to end through persisted agent messages", async () => {
    const mission = await createMission("usr_sarah", "Find someone who wants to play badminton tomorrow");
    await drain();

    const q = (await openOf("usr_alex", "question"))[0];
    expect(q).toBeTruthy();
    expect((await store.get("missions", mission.id))!.status).toBe("collaborating");

    const answered = await answerRequest("usr_alex", q.id, "I'm free after 6pm tomorrow", "voice");
    expect(answered.status).toBe("review");
    expect(answered.answerStructured).toBeTruthy();
    await decideRequest("usr_alex", q.id, "approve");
    await drain();

    const intro = [...(await openOf("usr_alex", "approval_intro")), ...(await openOf("usr_sarah", "approval_intro"))];
    expect(intro).toHaveLength(2);
    expect(intro.every((r) => r.sensitive)).toBe(true);
    expect((await store.get("missions", mission.id))!.status).toBe("awaiting_human");

    await decideRequest("usr_sarah", intro.find((r) => r.userId === "usr_sarah")!.id, "approve", { confirmed: true });
    expect((await store.list("connections"))[0].status).toBe("pending");
    await decideRequest("usr_alex", intro.find((r) => r.userId === "usr_alex")!.id, "approve", { confirmed: true });
    await drain();

    const [con] = await store.list("connections");
    expect(con.status).toBe("mutual");
    expect(con.approvedBy.sort()).toEqual(["usr_alex", "usr_sarah"]);
    expect(con.sharedContact).toEqual({ usr_sarah: "sarah@example.com", usr_alex: "@alexplays" });

    const done = (await store.get("missions", mission.id))!;
    expect(done.status).toBe("completed");
    expect(done.outcome).toBe("Matched with Alex for badminton tomorrow 18:00 (Mission District)");
    expect(await types()).toEqual(expect.arrayContaining(["collab_request", "info_pending", "propose_times", "accept_time", "intro_accepted"]));
    const notes = await store.list("activity", { userId: "usr_alex" });
    expect(notes.some((a) => a.notify && a.type === "connection.mutual")).toBe(true);
    // the raw answer stays private
    const forwarded = JSON.stringify(await store.list("messages"));
    expect(forwarded).not.toContain("free after 6pm");
  });

  it("proposes times directly when availability is known", async () => {
    await store.update("users", "usr_alex", { availability: ["tomorrow 19:00-20:00"] });
    await createMission("usr_sarah", "Find someone who wants to play badminton tomorrow");
    await drain();
    expect(await openOf("usr_alex", "question")).toHaveLength(0);
    expect(await types()).toContain("propose_times");
    expect(await openOf("usr_sarah", "approval_intro")).toHaveLength(1);
  });

  it("a rejected introduction declines the connection", async () => {
    await store.update("users", "usr_alex", { availability: ["tomorrow 19:00-20:00"] });
    await createMission("usr_sarah", "Find someone who wants to play badminton tomorrow");
    await drain();
    const [mine] = await openOf("usr_sarah", "approval_intro");
    await decideRequest("usr_sarah", mine.id, "reject");
    await drain();
    expect((await store.list("connections"))[0].status).toBe("declined");
    expect((await store.list("missions"))[0].status).toBe("failed");
    expect(await types()).toContain("intro_declined");
  });
});

describe("observation", () => {
  it("returns a human-verified answer with observedAt", async () => {
    const m = await askNetwork("usr_sarah", "Is Ritual Coffee on Valencia St crowded right now?");
    await drain();
    const [req] = await openOf("usr_alex", "observation");
    expect(req).toBeTruthy();
    await answerRequest("usr_alex", req.id, "It's pretty quiet, maybe three people in line", "text");
    await decideRequest("usr_alex", req.id, "approve");
    await drain();

    const msg = (await store.list("messages")).find((x) => x.type === "observation_response")!;
    expect(msg.provenance).toBe("human_verified");
    expect(typeof msg.payload.observedAt).toBe("string");
    const done = (await store.get("missions", m.id))!;
    expect(done.status).toBe("completed");
    expect(done.outcome).toContain("human-verified");
    expect(done.outcome).toContain("observed");
  });

  it("declines when the human takes no observation questions", async () => {
    const a = (await store.get("agents", "agt_alex"))!;
    await store.update("agents", "agt_alex", { permissions: { ...a.permissions, allowObservationQuestions: false } });
    const m = await askNetwork("usr_sarah", "Is Ritual Coffee on Valencia St crowded right now?");
    await drain();
    expect(await openOf("usr_alex", "observation")).toHaveLength(0);
    expect((await store.get("missions", m.id))!.status).toBe("failed");
  });
});

describe("guards", () => {
  async function pendingIntro() {
    await store.update("users", "usr_alex", { availability: ["tomorrow 19:00-20:00"] });
    await createMission("usr_sarah", "Find someone who wants to play badminton tomorrow");
    await drain();
    return (await openOf("usr_sarah", "approval_intro"))[0];
  }

  it("needs explicit confirmation for sensitive approvals", async () => {
    const r = await pendingIntro();
    await expect(decideRequest("usr_sarah", r.id, "approve")).rejects.toThrow("confirmation required");
    await expect(decideRequest("usr_sarah", r.id, "approve", { confirmed: false })).rejects.toThrow("confirmation required");
    expect((await store.get("humanRequests", r.id))!.status).toBe("pending");
  });

  it("keeps other users out of a request", async () => {
    await createMission("usr_sarah", "Find someone who wants to play badminton tomorrow");
    await drain();
    const [q] = await openOf("usr_alex", "question");
    await expect(answerRequest("usr_priya", q.id, "hi", "text")).rejects.toThrow("forbidden");
    await expect(decideRequest("usr_sarah", q.id, "approve")).rejects.toThrow("forbidden");
    await expect(cancelMission("usr_alex", (await store.list("missions"))[0].id)).rejects.toThrow("forbidden");
  });

  it("paused agents are not contacted and run no jobs", async () => {
    await setPaused("usr_alex", true);
    const m = await createMission("usr_sarah", "Find someone who wants to play badminton tomorrow");
    await drain();
    expect(await store.list("collaborations")).toHaveLength(0);
    expect((await store.get("missions", m.id))!.status).toBe("failed");

    await setPaused("usr_alex", false);
    await createMission("usr_sarah", "Find someone who wants to play badminton tomorrow");
    await drain();
    expect(await openOf("usr_alex", "question")).toHaveLength(1);
    await setPaused("usr_alex", true);
    const [q] = await openOf("usr_alex", "question");
    await answerRequest("usr_alex", q.id, "free after 6pm tomorrow", "text");
    await decideRequest("usr_alex", q.id, "approve");
    await drain();
    expect((await store.list("jobs", { status: "queued" })).length).toBe(1);
    expect(await types()).not.toContain("propose_times");
  });

  it("maxTurns stops a loop", async () => {
    const mission = await createMission("usr_sarah", "Find someone who wants to play badminton tomorrow");
    const collab = await store.insert("collaborations", {
      missionId: mission.id, kind: "match", initiatorAgentId: "agt_sarah", responderAgentId: "agt_priya", status: "requested",
      topic: "x", turns: 0, maxTurns: 2, expiresAt: new Date(Date.now() + 1e6).toISOString(), updatedAt: new Date().toISOString(),
    });
    expect(await sendMessage(collab, "agt_sarah", "agt_priya", "collab_request", {}, "1")).toBeTruthy();
    expect(await sendMessage(collab, "agt_priya", "agt_sarah", "info_pending", {}, "2")).toBeTruthy();
    expect(await sendMessage(collab, "agt_sarah", "agt_priya", "collab_request", {}, "3")).toBeNull();
    expect((await store.get("collaborations", collab.id))!.status).toBe("failed");
  });

  it("enforces the hourly message budget", async () => {
    const a = (await store.get("agents", "agt_sarah"))!;
    await store.update("agents", a.id, { budget: { ...a.budget, messagesPerHour: 1 } });
    const mission = await createMission("usr_sarah", "Find someone who wants to play badminton tomorrow");
    const collab = await store.insert("collaborations", {
      missionId: mission.id, kind: "match", initiatorAgentId: "agt_sarah", responderAgentId: "agt_priya", status: "requested",
      topic: "x", turns: 0, maxTurns: 12, expiresAt: new Date(Date.now() + 1e6).toISOString(), updatedAt: new Date().toISOString(),
    });
    expect(await sendMessage(collab, "agt_sarah", "agt_priya", "collab_request", {}, "1")).toBeTruthy();
    expect(await sendMessage(collab, "agt_sarah", "agt_priya", "collab_request", {}, "2")).toBeNull();
  });
});
