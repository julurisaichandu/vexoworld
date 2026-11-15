import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateJson } from "@/lib/ai/gemini";
import { tipPost } from "@/lib/engine";
import { store } from "@/lib/store";
import type { BandTopic } from "@/lib/types";
import { BAND_TOPICS } from "@/lib/types";
import { POST as configPOST } from "@/app/api/band/config/route";
import { POST as transcriptPOST } from "@/app/api/band/transcripts/route";
import {
  capWords, getBandSettings, ingestTranscript, publishDue, publishNow, signBand, updateBandSettings, verifyBandRequest,
} from "@/lib/band";

vi.mock("@/lib/ai/gemini", async (orig) => ({ ...(await orig<typeof import("@/lib/ai/gemini")>()), generateJson: vi.fn(async () => null) }));
const gemini = vi.mocked(generateJson);
/** Fake Gemini: the writer echoes every transcript it was given (it cannot leave anything out); the checker flags "rent" as financial, or returns null. */
const fakeGemini = (check: "ok" | "null") =>
  gemini.mockImplementation((async (system: string, prompt: string) => {
    if (system.startsWith("Write ONE")) return { text: [...prompt.matchAll(/<transcript[^>]*>\n([\s\S]*?)\n<\/transcript>/g)].map((m) => m[1]).join(" "), tags: [] };
    return check === "null" ? null : { mentioned: /\brent\b/.test(prompt) ? ["financial"] : [] };
  }) as never);

const SECRET = "x".repeat(32);
process.env.VEXOWORLD_BAND_SECRET = SECRET;
const VECTOR = "3b272d1a0425220927ea7695ecd970d791d3cc3c45b1e20365e924bd264896ae";

const signed = (url: string, body: unknown, ts = String(Math.floor(Date.now() / 1000)), sig?: string) => {
  const raw = JSON.stringify(body);
  return new Request(`http://x${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-vexo-timestamp": ts, "x-vexo-signature": sig ?? signBand(SECRET, ts, raw) },
    body: raw,
  });
};

let userId: string;
const T0 = "2026-01-01T10:00:00Z";
let n = 0;
const add = (text: string, topics: BandTopic[]) =>
  store.insert("bandTranscripts", {
    userId, bandNumber: 47, externalId: `e${++n}`, text, startedAt: T0, endedAt: T0, words: text.split(" ").length,
    topics, topicSource: "rules", status: "pending",
  });
const stat = async () => (await store.list("bandTranscripts", { userId })).map((t) => t.status);

beforeEach(async () => {
  gemini.mockReset().mockResolvedValue(null);
  await store.reset();
  userId = (await store.list("agents"))[0].userId;
  await store.update("agents", (await store.list("agents", { userId }))[0].id, { paused: false });
});

describe("signature", () => {
  it("matches the shared test vector", () => {
    expect(signBand(SECRET, "1700000000", '{"band":47}')).toBe(VECTOR);
  });
  it("accepts a good request, rejects bad signature, stale timestamp and short secret", async () => {
    expect((await verifyBandRequest(signed("/a", { band: 47 }))).ok).toBe(true);
    const bad = await verifyBandRequest(signed("/a", { band: 47 }, undefined, "0".repeat(64)));
    expect(bad).toMatchObject({ ok: false, status: 401 });
    const stale = await verifyBandRequest(signed("/a", { band: 47 }, String(Math.floor(Date.now() / 1000) - 400)));
    expect(stale).toMatchObject({ ok: false, status: 401 });
    process.env.VEXOWORLD_BAND_SECRET = "short";
    expect(await verifyBandRequest(signed("/a", { band: 47 }))).toMatchObject({ ok: false, status: 401 });
    process.env.VEXOWORLD_BAND_SECRET = SECRET;
  });
});

describe("capWords", () => {
  it("keeps at most 199 words", () => {
    const long = Array.from({ length: 500 }, (_, i) => `w${i}`).join(" ");
    expect(capWords(long).split(/\s+/)).toHaveLength(199);
    expect(capWords("short post")).toBe("short post");
  });
});

describe("routes and ingest", () => {
  it("answers unclaimed, then audio_off, then stores once", async () => {
    const body = { band: 47, id: "11111111-1111-4111-8111-111111111111", text: "had a great coffee", startedAt: T0, endedAt: T0, topics: ["food_dining", "bogus"], topicSource: "rules" };
    const call = async () => (await (await transcriptPOST(signed("/api/band/transcripts", body))).json()).status;
    expect(await call()).toBe("unclaimed");
    await getBandSettings(userId); // opening the page claims nothing
    expect(await call()).toBe("unclaimed");
    await updateBandSettings(userId, { autoPublish: true }); // saving claims the band
    expect(await call()).toBe("audio_off");
    expect(await store.list("bandTranscripts", { userId })).toHaveLength(0);
    expect(await (await configPOST(signed("/api/band/config", { band: 47 }))).json()).toEqual({ audioEnabled: false, claimed: true });
    await updateBandSettings(userId, { audioEnabled: true });
    expect(await call()).toBe("stored");
    expect(await call()).toBe("duplicate");
    const [t] = await store.list("bandTranscripts", { userId });
    expect(t.topics).toEqual(["food_dining"]);
    expect((await getBandSettings(userId)).lastSeenAt).toBeTruthy();
  });
  it("rejects bad signature (401), empty body (400) and long text (413)", async () => {
    await updateBandSettings(userId, { audioEnabled: true });
    expect((await configPOST(signed("/c", { band: 47 }, undefined, "0".repeat(64)))).status).toBe(401);
    expect((await configPOST(signed("/c", { band: "x" }))).status).toBe(400);
    const base = { band: 47, id: "a", startedAt: T0, endedAt: T0, topics: [], topicSource: "rules" };
    expect((await transcriptPOST(signed("/t", { ...base, text: "x".repeat(16001) }))).status).toBe(413);
    expect(await ingestTranscript({ ...base, text: "ok" } as never)).toBe("stored");
  });
});

describe("publishing", () => {
  it("filters untagged and disabled-topic transcripts, publishes enabled ones", async () => {
    await updateBandSettings(userId, { topics: { food_dining: true } });
    await add("Nothing tagged here.", []);
    await add("Paid my rent today.", ["financial"]);
    await add("Great ramen for lunch. Really good.", ["food_dining"]);
    const r = await publishNow(userId);
    expect(r.outcome).toBe("published");
    expect(await stat()).toEqual(expect.arrayContaining(["filtered", "filtered", "published"]));
    const filtered = (await store.list("bandTranscripts", { userId, status: "filtered" })).map((t) => t.reason);
    expect(filtered).toContain("No topic detected");
    expect(filtered).toContain("Only mentions Money & finances, which you have not switched on");
    const post = (await store.list("posts", { userId }))[0];
    expect(post.text).toContain("ramen");
    expect(post.text).not.toContain("rent");
    expect((await getBandSettings(userId)).lastOutcome).toMatch(/Published 1 post/);
  });
  it("publishes nothing when all are filtered", async () => {
    await add("Anything.", []);
    const r = await publishNow(userId);
    expect(r.outcome).toBe("nothing");
  });
  it("all topics enabled publishes a post under the word cap", async () => {
    await updateBandSettings(userId, { topics: Object.fromEntries(BAND_TOPICS.map((t) => [t, true])) });
    await add(Array.from({ length: 400 }, (_, i) => `w${i}`).join(" ") + ".", ["work"]);
    expect((await publishNow(userId)).outcome).toBe("published");
    expect((await store.list("posts", { userId }))[0].text.split(/\s+/).length).toBeLessThanOrEqual(199);
  });
  it("requirePostApproval creates an approval_post request", async () => {
    const agent = (await store.list("agents", { userId }))[0];
    await store.update("agents", agent.id, { permissions: { ...agent.permissions, requirePostApproval: true } });
    await updateBandSettings(userId, { topics: { work: true } });
    await add("Shipped the feature at work.", ["work"]);
    const before = (await store.list("posts", { userId })).length;
    expect((await publishNow(userId)).outcome).toBe("needs_approval");
    const req = (await store.list("humanRequests", { userId, kind: "approval_post", status: "pending" })).find((r) => r.postDraft?.includes("Shipped"));
    expect(req).toBeTruthy();
    expect((await store.list("posts", { userId })).length).toBe(before);
    expect(await stat()).toEqual(["awaiting_approval"]);
  });
  it("skips and keeps transcripts pending when the agent is paused", async () => {
    const agent = (await store.list("agents", { userId }))[0];
    await store.update("agents", agent.id, { paused: true });
    await updateBandSettings(userId, { topics: { work: true } });
    await add("Work thing.", ["work"]);
    expect((await publishNow(userId)).outcome).toBe("skipped");
    expect(await stat()).toEqual(["pending"]);
  });
  it("publishDue respects the interval and publishes once under concurrency", async () => {
    const s = await updateBandSettings(userId, { topics: { work: true }, publishInterval: "1m" });
    await add("First work thing.", ["work"]);
    // interval not elapsed since creation
    expect(await publishDue()).toBe(0);
    await store.update("bandSettings", s.id, { lastPublishedAt: new Date(Date.now() - 120_000).toISOString() });
    const before = (await store.list("posts", { userId })).length;
    const made = await Promise.all([publishDue(), publishDue()]);
    expect(made.reduce((a, b) => a + b, 0)).toBe(1);
    expect((await store.list("posts", { userId })).length).toBe(before + 1);
    await add("Second work thing.", ["work"]);
    expect(await publishDue()).toBe(0); // 1m interval not elapsed again
  });
});

describe("mixed-topic transcripts", () => {
  const texts = async (status: string) => (await store.list("bandTranscripts", { userId, status: status as never })).map((t) => t.text);
  const reasons = async () => (await store.list("bandTranscripts", { userId, status: "filtered" })).map((t) => t.reason);
  beforeEach(() => updateBandSettings(userId, { topics: { food_dining: true } }));

  it("publishes a mixed transcript when the check passes", async () => {
    fakeGemini("ok");
    await add("Ramen for lunch.", ["food_dining", "financial"]);
    expect((await publishNow(userId)).outcome).toBe("published");
    expect(await stat()).toEqual(["published"]);
    expect((await getBandSettings(userId)).lastOutcome).toBe("Published 1 post from 1 transcript (left out Money & finances).");
  });
  it("a flagged mixed transcript is filtered and the clean one still publishes", async () => {
    fakeGemini("ok");
    await add("Paid the rent after ramen.", ["food_dining", "financial"]);
    await add("Great matcha today.", ["food_dining"]);
    const r = await publishNow(userId);
    expect(r.outcome).toBe("published");
    expect(await texts("published")).toEqual(["Great matcha today."]);
    expect(await reasons()).toEqual(["Your agent could not leave out Money & finances, so this was not posted"]);
    const post = (await store.list("posts", { userId }))[0];
    expect(post.text).toBe("Great matcha today.");
    expect((await getBandSettings(userId)).lastOutcome).toBe("Published 1 post from 1 transcript; 1 filtered.");
    expect(gemini).toHaveBeenCalledTimes(3); // write, check, one retry write; no second check
  });
  it("fails closed when the check is unavailable", async () => {
    fakeGemini("null");
    await add("Ramen for lunch.", ["food_dining", "financial"]);
    const before = (await store.list("posts", { userId })).length;
    expect((await publishNow(userId)).outcome).toBe("nothing");
    expect((await store.list("posts", { userId })).length).toBe(before);
    expect(await reasons()).toEqual(["Gemini was unavailable to leave out Money & finances"]);
  });
  it("ignores the writer's own tags on a mixed post", async () => {
    gemini.mockImplementation((async (system: string) =>
      system.startsWith("Write ONE") ? { text: "Ramen for lunch.", tags: ["ramen", "rent", "salary"] } : { mentioned: [] }) as never);
    await add("Ramen for lunch, then paid rent.", ["food_dining", "financial"]);
    expect((await publishNow(userId)).outcome).toBe("published");
    expect((await store.list("posts", { userId }))[0].tags).toEqual(["food-dining"]);
  });
  it("an empty live reply does not leave transcripts pending", async () => {
    gemini.mockImplementation((async (system: string) => (system.startsWith("Write ONE") ? { text: "", tags: [] } : { mentioned: [] })) as never);
    await add("Paid the rent.", ["food_dining", "financial"]);
    await add("Good ramen.", ["food_dining"]);
    const r = await publishNow(userId);
    expect(r.outcome).toBe("nothing");
    expect(r.reason).toBe("Nothing to publish: 2 transcripts filtered.");
    expect(await stat()).toEqual(["filtered", "filtered"]);
  });
  it("the simulator only uses clean transcripts", async () => {
    await add("Rent was due. Ramen too.", ["food_dining", "financial"]);
    await add("Great matcha today.", ["food_dining"]);
    expect((await publishNow(userId)).outcome).toBe("published");
    expect(await reasons()).toEqual(["Gemini was unavailable to leave out Money & finances"]);
    expect((await store.list("posts", { userId }))[0].text).toBe("Great matcha today.");
  });
  it("the simulator keeps the sentences that name an interest and tags only posted words", async () => {
    await add("Hey, I just moved to the Mission. I'm obsessed with matcha and want people to play badminton.", ["food_dining"]);
    await add("Quiet morning at home. Nothing much.", ["food_dining"]);
    expect((await publishNow(userId)).outcome).toBe("published");
    const post = (await store.list("posts", { userId }))[0];
    expect(post.text).toBe("I'm obsessed with matcha and want people to play badminton. Quiet morning at home.");
    expect(post.tags).toEqual(["badminton", "matcha"]);
  });
  it("filters all-off and untagged transcripts", async () => {
    await add("Rent.", ["financial", "work"]);
    await add("Nothing.", []);
    expect((await publishNow(userId)).outcome).toBe("nothing");
    expect((await reasons()).sort()).toEqual(["No topic detected", "Only mentions Money & finances, Work & career, which you have not switched on"]);
  });
  it("still caps a mixed post at 199 words", async () => {
    fakeGemini("ok");
    await add(Array.from({ length: 400 }, (_, i) => `w${i}`).join(" ") + ".", ["food_dining", "work"]);
    expect((await publishNow(userId)).outcome).toBe("published");
    expect((await store.list("posts", { userId }))[0].text.split(/\s+/).length).toBeLessThanOrEqual(199);
  });
  it("a published band post about matcha reaches matching neighbours", async () => {
    const maya = (await store.list("users")).find((u) => u.name === "Maya")!;
    await add("Hunting for a great matcha latte nearby.", ["food_dining"]);
    expect((await publishNow(userId)).outcome).toBe("published");
    expect(await store.list("activity", { userId: maya.id, type: "match.found" })).not.toHaveLength(0);
  });
  it("a band chat about matcha near Mina Street gets the Blue Bottle tip as a reply and a notification, once", async () => {
    await add("Do you know any good matcha places near Mina Street in San Francisco?", ["food_dining"]);
    expect((await publishNow(userId)).outcome).toBe("published");
    const post = (await store.list("posts", { userId }))[0];
    const tips = await store.list("activity", { userId, type: "tip.found" });
    expect(tips).toHaveLength(1);
    expect(tips[0]).toMatchObject({ notify: true, refId: post.id });
    expect(tips[0].text).toContain("Blue Bottle Coffee near Minna Street");
    const replies = await store.list("comments", { postId: post.id });
    expect(replies.map((c) => c.userId)).toEqual(["usr_maya"]);
    expect(await tipPost(post.id)).toBeNull();
  });
});

describe("band ownership and publishing races", () => {
  const otherUser = async () => (await store.list("agents")).map((a) => a.userId).find((u) => u !== userId)!;
  it("opening /band claims nothing; the first save wins and others cannot take the band over", async () => {
    const b = await otherUser();
    await updateBandSettings(userId, { audioEnabled: true });
    await getBandSettings(b);
    for (let i = 0; i < 2; i++) expect(await (await configPOST(signed("/c", { band: 47 }))).json()).toEqual({ audioEnabled: true, claimed: true });
    await expect(updateBandSettings(b, { audioEnabled: true })).rejects.toThrow(/already linked/);
    await updateBandSettings(b, { bandNumber: 48 });
    expect((await getBandSettings(userId)).bandNumber).toBe(47);
    expect(await ingestTranscript({ band: 47, id: "x", text: "hi", startedAt: T0, endedAt: T0, topics: [], topicSource: "rules" })).toBe("stored");
    expect(await store.list("bandTranscripts", { userId: b })).toHaveLength(0);
  });
  it("two simultaneous first calls create one row", async () => {
    const b = await otherUser();
    await Promise.all([getBandSettings(b), getBandSettings(b)]);
    expect(await store.list("bandSettings", { userId: b })).toHaveLength(1);
  });
  it("publishNow and publishDue running together publish once", async () => {
    const s = await updateBandSettings(userId, { topics: { work: true }, publishInterval: "1m" });
    await store.update("bandSettings", s.id, { lastPublishedAt: new Date(Date.now() - 120_000).toISOString() });
    await add("Work thing.", ["work"]);
    const before = (await store.list("posts", { userId })).length;
    await Promise.all([publishDue(), publishNow(userId)]);
    expect((await store.list("posts", { userId })).length).toBe(before + 1);
  });
  it("a due slot with only filtered transcripts is not used up", async () => {
    const s = await updateBandSettings(userId, { topics: { work: true }, publishInterval: "1d" });
    const old = new Date(Date.now() - 2 * 86_400_000).toISOString();
    await store.update("bandSettings", s.id, { lastPublishedAt: old });
    await add("Untagged.", []);
    expect(await publishDue()).toBe(0);
    expect((await getBandSettings(userId)).lastPublishedAt).toBe(old);
    await add("Work thing.", ["work"]);
    expect(await publishDue()).toBe(1);
  });
});
