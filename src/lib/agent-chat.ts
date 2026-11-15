import { store } from "./store";
import * as ai from "./ai";
import * as engine from "@/lib/engine";
import { addToCorpus } from "./personality";
import { considerPost } from "./publisher";
import { ownerLabel } from "./privacy";
import type { HumanRequest, Source } from "./types";

type ChatResult = { reply: string; actions: { label: string; href?: string }[]; aiSource: Source; confirm?: { requestId: string; prompt: string } };

// ponytail: in-memory, per server instance; move to the chat table if confirmations must survive restarts.
const confirming = new Map<string, { requestId: string; until: number }>();

const isOpen = (r: HumanRequest) => r.status === "review" || (r.status === "pending" && r.kind.startsWith("approval_"));

async function sharesWith(req: HumanRequest) {
  const collab = req.collaborationId ? await store.get("collaborations", req.collaborationId) : null;
  const otherAgent = collab && await store.get("agents", collab.initiatorAgentId === req.agentId ? collab.responderAgentId : collab.initiatorAgentId);
  const other = otherAgent && (await store.get("users", otherAgent.userId));
  return other && otherAgent ? ownerLabel(other, otherAgent) : "the other person";
}

export async function chatWithAgent(userId: string, text: string, inputSource: "text" | "voice"): Promise<ChatResult> {
  const agent = (await store.list("agents", { userId }))[0];
  if (!agent) return { reply: "Set up your agent first, then I can help.", actions: [{ label: "Onboarding", href: "/onboarding" }], aiSource: "simulated" };

  await store.insert("chat", { userId, agentId: agent.id, role: "user", text, inputSource, aiSource: "simulated" });
  await addToCorpus(userId, text, inputSource === "voice" ? "voice" : "chat");

  const all = (await store.list("humanRequests", { userId })).filter((r) => r.status === "pending" || r.status === "review");
  const open = all.filter(isOpen); // what approve/reject can act on
  const cmd = await ai.parseCommand(text, { agentName: agent.name, pending: all.length });
  let res: ChatResult = { reply: cmd.reply, actions: [], aiSource: cmd.aiSource };

  switch (cmd.intent) {
    case "find_people":
    case "create_mission":
    case "ask_network": {
      const goal = (cmd.intent === "ask_network" ? cmd.question : cmd.goal) ?? text;
      const mission = cmd.intent === "ask_network" ? await engine.askNetwork(userId, goal) : await engine.createMission(userId, goal, { inputSource });
      res.actions = [{ label: "View mission", href: `/missions/${mission.id}` }];
      break;
    }
    case "network_digest": {
      const since = Date.now() - 86_400_000;
      const posts = (await store.list("posts")).filter((p) => p.agentId !== agent.id && !p.deletedAt && Date.parse(p.createdAt) >= since);
      const s = await ai.summarize("network_digest", posts.map((p) => p.text));
      res = { ...res, reply: s.text, aiSource: s.aiSource, actions: [{ label: "Open feed", href: "/" }] };
      break;
    }
    case "activity_summary": {
      const acts = await store.list("activity", { userId }, { limit: 15 });
      const s = await ai.summarize("activity", acts.map((a) => a.text));
      res = { ...res, reply: s.text, aiSource: s.aiSource, actions: [{ label: "Open activity", href: "/activity" }] };
      break;
    }
    case "list_pending": {
      res.reply = all.length ? `You have ${all.length} waiting: ${all.map((r) => r.prompt).join(" | ")}` : "Nothing is waiting for you right now.";
      res.actions = [{ label: "Open inbox", href: "/inbox" }];
      break;
    }
    case "approve":
    case "reject": {
      // A sensitive approval applies only to the request the agent read back, never to whatever is newest.
      const asked = confirming.get(userId);
      const readBack = asked && asked.until > Date.now() ? open.find((r) => r.id === asked.requestId) : undefined;
      const req = readBack ?? open.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (!req) {
        res.reply = "Nothing is waiting for your decision.";
      } else if (cmd.intent === "approve" && req.sensitive && !(readBack && /\bconfirm/i.test(text))) {
        const prompt = `This shares your contact details with ${await sharesWith(req)}. Say or type 'confirm' to approve.`;
        confirming.set(userId, { requestId: req.id, until: Date.now() + 120_000 });
        res = { ...res, reply: prompt, confirm: { requestId: req.id, prompt } };
      } else {
        confirming.delete(userId);
        try {
          await engine.decideRequest(userId, req.id, cmd.intent, { confirmed: true });
          res.reply = cmd.intent === "approve" ? "Done, approved." : "Okay, declined.";
        } catch {
          res.reply = "I couldn't apply that decision. Check your inbox.";
        }
        res.actions = [{ label: "Open inbox", href: "/inbox" }];
      }
      break;
    }
    case "post": {
      const r = await considerPost(userId, cmd.post ?? text, "chat");
      res.reply = r.outcome === "published" ? "Posted to the network." : r.outcome === "needs_approval" ? "Draft is in your inbox for approval." : `I won't post that: ${r.reason}.`;
      if (r.outcome === "needs_approval") res.actions = [{ label: "Open inbox", href: "/inbox" }];
      break;
    }
  }

  engine.kickJobs();
  await store.insert("chat", { userId, agentId: agent.id, role: "agent", text: res.reply, aiSource: res.aiSource });
  return res;
}
