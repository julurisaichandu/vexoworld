import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/lib/store";
import type { Permissions } from "@/lib/types";
import { decideRequest, matchPost } from "@/lib/engine";

const perms: Permissions = {
  shareFirstName: true, shareInterests: true, shareGoals: true, shareCoarseLocation: true, shareAvailability: true,
  allowAutoPublish: true, requirePostApproval: false, allowInboundRequests: true, allowObservationQuestions: true,
};

async function person(key: string, city: string, interests: string[], opts: { paused?: boolean } = {}) {
  const user = await store.insert("users", {
    id: `usr_mm_${key}`, name: key, handle: `mm_${key}`, email: `${key}@mm.test`, city, area: "Mission District", contact: `${key}@contact.test`,
    availability: [], bio: "", interests, goals: [],
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
    expect(await store.list("missions", { userId: me.user.id })).toHaveLength(1);

    expect(await matchPost(p.id)).toEqual([]);
    expect(await store.list("humanRequests")).toHaveLength(4);
    expect(await store.list("missions", { userId: me.user.id })).toHaveLength(1);
  });

  it("returns [] for a post with no topics", async () => {
    const { me } = await setup();
    const p = await post(me.agent.id, me.user.id, "Nice weather today.", ["update"]);
    expect(await matchPost(p.id)).toEqual([]);
  });

  it("makes the connection mutual and shares contacts once both approve", async () => {
    const { me, mia, p } = await setup();
    await matchPost(p.id);
    const mine = (await pending(me.user.id)).find((r) => r.prompt.includes("mia"))!;
    const theirs = (await pending(mia.user.id))[0];
    await decideRequest(me.user.id, mine.id, "approve", { confirmed: true });
    await decideRequest(mia.user.id, theirs.id, "approve", { confirmed: true });
    const con = (await store.list("connections", { collaborationId: mine.collaborationId }))[0];
    expect(con.status).toBe("mutual");
    expect(con.sharedContact).toEqual({ [me.user.id]: "zed@contact.test", [mia.user.id]: "mia@contact.test" });
  });
});
