"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { askNetwork, answerRequest, cancelMission, createMission, decideRequest, kickJobs, setPaused } from "@/lib/engine";
import { addToCorpus, inferPersonality } from "@/lib/personality";
import { considerPost } from "@/lib/publisher";
import { clearSession, hashPassword, requireUserId, setSession, verifyPassword } from "@/lib/session";
import { newId, store } from "@/lib/store";
import type { Agent, Permissions, Personality, PublishFrequency } from "@/lib/types";

const done = () => {
  kickJobs();
  revalidatePath("/", "layout");
};
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const message = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

async function agentOf(userId: string): Promise<Agent> {
  const agent = (await store.list("agents", { userId }))[0];
  if (!agent) throw new Error("create your agent first");
  return agent;
}

export async function signInDemo(userId: string): Promise<void> {
  const user = await store.get("users", userId);
  if (!user?.isDemo) throw new Error("not a demo user");
  await setSession(userId);
  redirect("/");
}

export async function signUp(formData: FormData): Promise<{ error?: string }> {
  const name = str(formData, "name");
  const email = str(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter your name and a valid email." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if ((await store.list("users")).some((u) => u.email.toLowerCase() === email)) return { error: "That email is already registered." };
  const user = await store.insert("users", {
    name,
    handle: `@${name.toLowerCase().replace(/[^a-z0-9]+/g, "")}${newId("").slice(-3)}`,
    email,
    passwordHash: hashPassword(password),
    city: "",
    area: "",
    contact: email,
    availability: [],
    bio: "",
    interests: [],
    goals: [],
  });
  await setSession(user.id);
  redirect("/onboarding");
}

export async function signIn(formData: FormData): Promise<{ error?: string }> {
  const email = str(formData, "email").toLowerCase();
  const user = (await store.list("users")).find((u) => u.email.toLowerCase() === email);
  if (!user || !verifyPassword(String(formData.get("password") ?? ""), user.passwordHash)) return { error: "Wrong email or password." };
  await setSession(user.id);
  redirect("/");
}

export async function signOut(): Promise<void> {
  await clearSession();
  redirect("/login");
}

export async function createAgent(formData: FormData): Promise<{ error?: string }> {
  const userId = await requireUserId();
  if ((await store.list("agents", { userId }))[0]) return { error: "You already have an agent." };
  const user = (await store.get("users", userId))!;
  const agentName = str(formData, "agentName");
  if (!agentName) return { error: "Give your agent a name." };
  const freq = str(formData, "publishFrequency") as PublishFrequency;
  const personalityText = str(formData, "personality");
  await store.update("users", userId, {
    interests: list(str(formData, "interests")),
    goals: list(str(formData, "goals")),
    city: str(formData, "city"),
    area: str(formData, "area"),
  });
  const personality: Personality | null = personalityText
    ? {
        summary: personalityText,
        tone: "",
        traits: [],
        interests: [],
        values: [],
        postingStyle: "",
        emojiUse: "light",
        sampleVoice: "",
        source: "user",
        tokensAnalyzed: 0,
        updatedAt: new Date().toISOString(),
        aiSource: "simulated",
      }
    : null;
  await store.insert("agents", {
    userId,
    name: `${user.name}'s agent: ${agentName}`,
    avatarSeed: agentName,
    color: ["#FBCFE8", "#BAE6FD", "#BBF7D0", "#FDE68A", "#DDD6FE", "#FED7AA"][(await store.list("agents")).length % 6],
    persona: str(formData, "persona") || "Helpful and concise.",
    personality,
    permissions: {
      shareFirstName: true,
      shareInterests: true,
      shareGoals: true,
      shareCoarseLocation: true,
      shareAvailability: true,
      allowAutoPublish: true,
      requirePostApproval: false,
      allowInboundRequests: true,
      allowObservationQuestions: true,
    },
    publishFrequency: ["auto", "hourly", "daily", "weekly", "manual"].includes(freq) ? freq : "daily",
    paused: false,
    budget: { messagesPerHour: 30, questionsPerDay: 5 },
  });
  done();
  return {};
}

export async function createMissionAction(goal: string): Promise<{ missionId: string }> {
  const m = await createMission(await requireUserId(), goal);
  done();
  return { missionId: m.id };
}

export async function askNetworkAction(question: string): Promise<{ missionId: string }> {
  const m = await askNetwork(await requireUserId(), question);
  done();
  return { missionId: m.id };
}

export async function answerRequestAction(requestId: string, text: string, source: "voice" | "text" | "simulated_voice"): Promise<{ error?: string }> {
  const userId = await requireUserId();
  try {
    await answerRequest(userId, requestId, text, source);
  } catch (e) {
    return { error: message(e) };
  }
  done();
  return {};
}

export async function decideRequestAction(
  requestId: string,
  decision: "approve" | "reject",
  opts?: { confirmed?: boolean; editedSummary?: string },
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  try {
    await decideRequest(userId, requestId, decision, opts);
  } catch (e) {
    return { error: message(e) };
  }
  done();
  return {};
}

export async function cancelMissionAction(missionId: string): Promise<void> {
  await cancelMission(await requireUserId(), missionId);
  done();
}

export async function createPostAction(text: string): Promise<{ outcome: "published" | "needs_approval" | "skipped"; reason: string }> {
  const { outcome, reason } = await considerPost(await requireUserId(), text, "manual");
  done();
  return { outcome, reason };
}

export async function deletePostAction(postId: string): Promise<void> {
  const userId = await requireUserId();
  const post = await store.get("posts", postId);
  if (post?.userId === userId) await store.update("posts", postId, { deletedAt: new Date().toISOString() });
  done();
}

export async function commentAction(postId: string, text: string, parentId?: string): Promise<void> {
  const userId = await requireUserId();
  const agent = await agentOf(userId);
  const body = text.trim().slice(0, 500);
  if (!body || !(await store.get("posts", postId))) return;
  await store.insert("comments", { postId, parentId, agentId: agent.id, userId, text: body, provenance: "human_verified" });
  done();
}

export async function updatePermissionsAction(patch: Partial<Permissions>): Promise<void> {
  const agent = await agentOf(await requireUserId());
  await store.update("agents", agent.id, { permissions: { ...agent.permissions, ...patch } });
  done();
}

export async function updateAgentAction(patch: { name?: string; persona?: string; publishFrequency?: PublishFrequency; paused?: boolean }): Promise<void> {
  const userId = await requireUserId();
  const { paused, ...rest } = patch;
  const agent = await agentOf(userId);
  await store.update("agents", agent.id, rest);
  if (paused !== undefined) await setPaused(userId, paused);
  done();
}

export async function updatePersonalityAction(patch: Partial<Personality>): Promise<void> {
  const agent = await agentOf(await requireUserId());
  const base: Personality = agent.personality ?? {
    summary: "", tone: "", traits: [], interests: [], values: [], postingStyle: "", emojiUse: "light", sampleVoice: "",
    source: "user", tokensAnalyzed: 0, updatedAt: "", aiSource: "simulated",
  };
  await store.update("agents", agent.id, { personality: { ...base, ...patch, source: "user", updatedAt: new Date().toISOString() } });
  done();
}

export async function analyzePersonalityAction(): Promise<{ ok: boolean; reason?: string }> {
  const result = await inferPersonality(await requireUserId(), { force: true });
  done();
  return result ? { ok: true } : { ok: false, reason: "Add some of your own writing first." };
}

export async function addCorpusAction(text: string): Promise<void> {
  await addToCorpus(await requireUserId(), text, "upload");
  done();
}

export async function revokeAllSharingAction(): Promise<void> {
  const agent = await agentOf(await requireUserId());
  await store.update("agents", agent.id, {
    permissions: {
      ...agent.permissions,
      shareFirstName: false,
      shareInterests: false,
      shareGoals: false,
      shareCoarseLocation: false,
      shareAvailability: false,
      allowAutoPublish: false,
    },
  });
  done();
}

export async function markNotificationsReadAction(): Promise<void> {
  const userId = await requireUserId();
  for (const a of await store.list("activity", { userId })) if (a.notify && !a.read) await store.update("activity", a.id, { read: true });
  revalidatePath("/", "layout");
}

export async function resetDemoAction(): Promise<void> {
  await requireUserId();
  await store.reset();
  revalidatePath("/", "layout");
}
