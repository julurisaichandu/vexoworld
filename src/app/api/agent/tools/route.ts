import * as ai from "@/lib/ai";
import { askNetwork, createMission, decideRequest, kickJobs } from "@/lib/engine";
import { readJson } from "@/lib/utils";
import { userIdFromRequest } from "@/lib/session";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

type Args = Record<string, unknown>;
type Out = { result: unknown; say: string };

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

const tools: Record<string, (userId: string, args: Args) => Promise<Out>> = {
  async find_people(userId, args) {
    const goal = text(args.goal);
    if (!goal) throw new Error("goal is required");
    const m = await createMission(userId, goal, { inputSource: "voice" });
    return { result: { missionId: m.id, title: m.title }, say: `I'm on it. I'm looking for people for: ${m.title}.` };
  },
  async ask_network(userId, args) {
    const question = text(args.question);
    if (!question) throw new Error("question is required");
    const m = await askNetwork(userId, question);
    return { result: { missionId: m.id }, say: "I'm asking around the network. I'll tell you when someone answers." };
  },
  async network_digest(userId) {
    const posts = (await store.list("posts", undefined, { limit: 8 })).filter((p) => !p.deletedAt && p.userId !== userId);
    const { text: digest } = await ai.summarize("network_digest", posts.map((p) => p.text));
    return { result: { posts: posts.length, digest }, say: digest };
  },
  async activity_summary(userId) {
    const items = await store.list("activity", { userId }, { limit: 10 });
    const { text: summary } = await ai.summarize("activity", items.map((a) => a.text));
    return { result: { items: items.length, summary }, say: summary };
  },
  async list_pending(userId) {
    const open = (await store.list("humanRequests", { userId })).filter((r) => r.status === "pending" || r.status === "review");
    const say = open.length ? `You have ${open.length} waiting. First: ${open[0].prompt}` : "Nothing is waiting for you.";
    return { result: open.map((r) => ({ id: r.id, kind: r.kind, status: r.status, prompt: r.prompt, sensitive: !!r.sensitive })), say };
  },
  async decide_request(userId, args) {
    if (args.decision !== "approve" && args.decision !== "reject") throw new Error("decision must be approve or reject");
    const r = await decideRequest(userId, text(args.requestId), args.decision, { confirmed: args.confirmed === true });
    return { result: { id: r.id, status: r.status }, say: args.decision === "approve" ? "Approved." : "Declined." };
  },
};

export async function POST(req: Request) {
  const userId = await userIdFromRequest(req, { allowVoice: true });
  if (!userId) return Response.json({ ok: false, say: "Please sign in." }, { status: 401 });
  const body = (await readJson(req).catch(() => null)) as { tool?: string; args?: Args } | null;
  const run = body?.tool && Object.hasOwn(tools, body.tool) ? tools[body.tool] : null;
  if (!run) return Response.json({ ok: false, say: "I don't know that tool." }, { status: 400 });
  try {
    const out = await run(userId, body?.args ?? {});
    kickJobs();
    return Response.json({ ok: true, ...out });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "failed";
    return Response.json({ ok: false, say: msg === "confirmation required" ? "I need your explicit confirmation first." : `That didn't work: ${msg}.`, error: msg }, { status: 400 });
  }
}
