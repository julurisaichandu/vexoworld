import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/lib/store";
import type { Permissions } from "@/lib/types";
import { createMission, decideRequest, matchPost, processJobs } from "@/lib/engine";

const perms: Permissions = {
  shareFirstName: true, shareInterests: true, shareGoals: true, shareCoarseLocation: true, shareAvailability: true,
  allowAutoPublish: true, requirePostApproval: false, allowInboundRequests: true, allowObservationQuestions: true,
};

async function person(key: string, city: string, interests: string[], opts: { paused?: boolean; isDemo?: boolean } = {}) {
  const user = await store.insert("users", {
    id: `usr_mm_${key}`, name: key, handle: `mm_${key}`, email: `${key}@mm.test`, city, area: "Mission District", contact: `${key}@contact.test`,
    availability: [], bio: "", interests, goals: [], isDemo: opts.isDemo,
  } as never);
  const agent = await store.insert("agents", {
    id: `agt_mm_${key}`, userId: user.id, name: `${key}'s agent`, avatarSeed: key, color: "#fff", persona: "", personality: null,
    permissions: { ...perms }, publishFrequency: "auto", paused: !!opts.paused, budget: { messagesPerHour: 20, questionsPerDay: 5 },
  } as never);
  return { user, agent };
}
const post = (agentId: string, userId: string, text: string, tags: string[], kind: "looking_for" | "update" = "update") =>
  store.insert("posts", { agentId, userId, text, tags, kind, provenance: "ai_generated", aiSource: "simulated" });
const pending = async (userId: string) => (await store.list("humanRequests", { userId, kind: "approval_intro", status: "pending" }));
const notes = async (userId: string) => (await store.list("activity", { userId, type: "match.found" })).filter((a) => a.notify);

beforeEach(async () => {
  await store.reset();
  for (const t of ["users", "agents", "posts", "missions", "collaborations", "messages", "humanRequests", "connections", "activity"] as const)
    for (const r of await store.list(t)) await store.remove(t, r.id);
});

describe("matchPost", () => {
  async function setup() {
    const me = await person("zed", "San Francisco", []);
    const mia = await person("mia", "san francisco ", ["matcha"]);
    const ben = await person("ben", "San Francisco", []);
    const oak = await person("oak", "Oakland", ["badminton", "matcha"]);
    const nap = await person("nap", "San Francisco", ["badminton"], { paused: true });
    await post(ben.agent.id, ben.user.id, "My human wants badminton partners.", ["badminton"], "looking_for");
    await post(oak.agent.id, oak.user.id, "Badminton in Oakland.", ["badminton", "matcha"], "looking_for");
    const p = await post(me.agent.id, me.user.id, "My human loves matcha and wants to play badminton this weekend.", ["matcha", "badminton"]);
    return { me, mia, ben, oak, nap, p };
  }

  it("matches nearby people, notifies both sides, and is idempotent", async () => {
    const { me, mia, ben, oak, nap, p } = await setup();
    const picks = await matchPost(p.id);
    expect(picks.map((x) => x.userId).sort()).toEqual([ben.user.id, mia.user.id].sort());
    expect(picks.some((x) => [oak.user.id, nap.user.id].includes(x.userId))).toBe(false);

    for (const u of [mia.user.id, ben.user.id]) {
      expect(await pending(u)).toHaveLength(1);
      expect(await notes(u)).toHaveLength(1);
    }
    expect(await pending(me.user.id)).toHaveLength(2);
    expect(await notes(me.user.id)).toHaveLength(1);
    expect(await pending(oak.user.id)).toHaveLength(0);
    expect(await store.list("missions", { userId: me.user.id })).toHaveLength(2);

    expect(await matchPost(p.id)).toEqual([]);
    expect(await store.list("humanRequests")).toHaveLength(4);
    expect(await store.list("missions", { userId: me.user.id })).toHaveLength(2);
  });

  it("returns [] for a post with no topics", async () => {
    const { me } = await setup();
    const p = await post(me.agent.id, me.user.id, "Nice weather today.", ["update"]);
    expect(await matchPost(p.id)).toEqual([]);
  });

  it("makes the connection mutual and shares contacts once both approve", async () => {
    const { me, mia, ben, p } = await setup();
    await matchPost(p.id);
    const mine = (await pending(me.user.id)).find((r) => r.prompt.includes("mia"))!;
    const theirs = (await pending(mia.user.id))[0];
    await decideRequest(me.user.id, mine.id, "approve", { confirmed: true });
    await decideRequest(mia.user.id, theirs.id, "approve", { confirmed: true });
    const con = (await store.list("connections", { collaborationId: mine.collaborationId }))[0];
    expect(con.status).toBe("mutual");
    expect(con.sharedContact).toEqual({ [me.user.id]: "zed@contact.test", [mia.user.id]: "mia@contact.test" });

    // The first match must not expire the other one from the same post.
    const next = (await pending(me.user.id)).find((r) => r.prompt.includes("ben"))!;
    await decideRequest(me.user.id, next.id, "approve", { confirmed: true });
    await decideRequest(ben.user.id, (await pending(ben.user.id))[0].id, "approve", { confirmed: true });
    expect((await store.list("connections", { collaborationId: next.collaborationId }))[0].status).toBe("mutual");
  });

  it("does not ask again after a no", async () => {
    const { me, mia, p } = await setup();
    await matchPost(p.id);
    const theirs = (await pending(mia.user.id))[0];
    await decideRequest(mia.user.id, theirs.id, "reject");
    const again = await post(me.agent.id, me.user.id, "Still craving matcha.", ["matcha"]);
    expect((await matchPost(again.id)).map((x) => x.userId)).not.toContain(mia.user.id);
    expect(await notes(mia.user.id)).toHaveLength(1);
  });

  it("does not duplicate intros when two posts match at once", async () => {
    const { me, mia, p } = await setup();
    const p2 = await post(me.agent.id, me.user.id, "Matcha again tomorrow.", ["matcha"]);
    await Promise.all([matchPost(p.id), matchPost(p2.id)]);
    expect(await pending(mia.user.id)).toHaveLength(1);
  });

  it("treats SF and San Francisco, CA as one city and keeps demo personas apart from real accounts", async () => {
    const me = await person("cal", "San Francisco, CA", []);
    const sf = await person("sfo", "SF", ["matcha"]);
    await person("demo", "San Francisco", ["matcha"], { isDemo: true });
    const p = await post(me.agent.id, me.user.id, "My human loves matcha.", ["matcha"]);
    expect((await matchPost(p.id)).map((x) => x.userId)).toEqual([sf.user.id]);
  });

  it("ordinary missions only contact nearby agents", async () => {
    const { me, oak, ben } = await setup();
    await createMission(me.user.id, "Find someone who wants to play badminton tomorrow");
    for (let i = 0; i < 40 && (await store.list("jobs", { status: "queued" })).length; i++) {
      if (!(await processJobs(20))) await new Promise((r) => setTimeout(r, 50));
    }
    const contacted = (await store.list("collaborations")).map((c) => c.responderAgentId);
    expect(contacted).toContain(ben.agent.id);
    expect(contacted).not.toContain(oak.agent.id);
  });
});
