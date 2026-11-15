import { beforeAll, describe, expect, it } from "vitest";
import * as ai from "./index";
import type { Permissions } from "../types";

beforeAll(() => {
  process.env.GEMINI_API_KEY = "";
});

const perms = { allowAutoPublish: true, requirePostApproval: false } as Permissions;
const ctx = { agentName: "Nova", pending: 0 };

describe("simulator", () => {
  it("parses demo commands", async () => {
    const find = await ai.parseCommand("Find someone who wants to play badminton tomorrow", ctx);
    expect(find).toMatchObject({ intent: "find_people", aiSource: "simulated" });
    expect((await ai.parseCommand("Is Ritual Coffee crowded right now?", ctx)).intent).toBe("ask_network");
    expect((await ai.parseCommand("what have the other agents discovered", ctx)).intent).toBe("network_digest");
    expect((await ai.parseCommand("yes, confirm", ctx)).intent).toBe("approve");
    expect((await ai.parseCommand("I'm free after 6pm tomorrow", ctx)).intent).toBe("chat");
  });

  it("plans match and observation missions", async () => {
    const m = await ai.planMission("Find someone who wants to play badminton tomorrow", { city: "SF", area: "Mission", interests: [] });
    expect(m).toMatchObject({ kind: "match", interests: ["badminton"], when: "tomorrow" });
    expect(m.steps).toHaveLength(5);
    const o = await ai.planMission("Is Ritual Coffee crowded right now?", { city: "SF", area: "Mission", interests: [] });
    expect(o).toMatchObject({ kind: "observation", place: "Ritual Coffee" });
  });

  it("reviews inbound requests warmly", async () => {
    const known = { interests: ["badminton"], availability: [], recentPlaces: [] };
    const m = await ai.reviewInbound({ kind: "match", request: { interests: ["badminton"], when: "tomorrow" }, known });
    expect(m.missing).toEqual(["availability for tomorrow"]);
    expect(m.questionForHuman).toBe("Hey! Someone's agent is looking for a badminton partner tomorrow. What times work for you?");
    const o = await ai.reviewInbound({ kind: "observation", request: { place: "Ritual Coffee" }, known });
    expect(o.questionForHuman).toBe("Hey! Someone wants to know if Ritual Coffee is crowded right now. Would you like to answer?");
    expect(o.missing).toEqual(["current crowd level"]);
  });

  it("structures answers", async () => {
    const a = await ai.structureAnswer("What times work tomorrow?", "I'm free after 6pm tomorrow", "question");
    expect(a.fields.availability).toBe("tomorrow 18:00-22:00");
    expect((await ai.structureAnswer("x", "7-9pm", "question")).fields.availability).toBe("today 19:00-21:00");
    const o = await ai.structureAnswer("Is it crowded?", "Not really, there were only a few people", "observation");
    expect(o.fields.crowd).toBe("low");
  });

  it("ranks by overlap", async () => {
    const r = await ai.rankCandidates("badminton partner tomorrow", [
      { agentId: "a", text: "loves hiking" },
      { agentId: "b", text: "plays badminton on weekends" },
    ]);
    expect(r.ranked.map((c) => c.agentId)).toEqual(["b"]);
  });
});

describe("decidePublish", () => {
  const base = { candidate: "I'm looking for a badminton partner tomorrow", personality: null, permissions: perms, frequency: "daily" as const, recentPosts: [] };
  it("writes a my-human post", async () => {
    const d = await ai.decidePublish(base);
    expect(d).toMatchObject({ publish: true, kind: "looking_for", tags: ["badminton"], sensitivity: "low" });
    expect(d.text).toMatch(/^My human is looking for/);
  });
  it("gates frequency, manual, chit-chat and private details", async () => {
    const recent = new Date(Date.now() - 3_600_000).toISOString();
    expect((await ai.decidePublish({ ...base, lastPublishedAt: recent })).publish).toBe(false);
    expect((await ai.decidePublish({ ...base, frequency: "hourly", lastPublishedAt: recent })).publish).toBe(true);
    expect((await ai.decidePublish({ ...base, frequency: "manual" })).reason).toBe("manual: needs approval");
    expect((await ai.decidePublish({ ...base, candidate: "thanks!" })).publish).toBe(false);
    expect((await ai.decidePublish({ ...base, candidate: "call me at 415-555-1234 about badminton" })).publish).toBe(false);
  });
  it("flags sensitive posts", async () => {
    expect((await ai.decidePublish({ ...base, candidate: "I'm worried about my health this week" })).sensitivity).toBe("high");
  });
});

describe("personality and summaries", () => {
  it("analyzes a corpus", async () => {
    const p = await ai.analyzePersonality("I love badminton! Playing badminton every weekend is the best thing ever. Anyone up for coffee after?");
    expect(p.interests).toContain("badminton");
    expect(p.aiSource).toBe("simulated");
  });
  it("summarizes", async () => {
    expect((await ai.summarize("activity", ["Started a mission"])).text).toContain("Started a mission");
  });
});
