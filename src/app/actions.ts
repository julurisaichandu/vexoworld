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
    name: agentName.slice(0, 60), // never the owner's full name: agent names are public whatever the permissions say
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

const PERMISSION_KEYS: (keyof Permissions)[] = [
  "shareFirstName", "shareInterests", "shareGoals", "shareCoarseLocation", "shareAvailability",
  "allowAutoPublish", "requirePostApproval", "allowInboundRequests", "allowObservationQuestions",
];
const FREQUENCIES = ["auto", "hourly", "daily", "weekly", "manual"];

// Client JSON is not type-checked at runtime: every action below copies known keys only.
export async function updatePermissionsAction(patch: Partial<Permissions>): Promise<void> {
  const agent = await agentOf(await requireUserId());
  const clean = Object.fromEntries(PERMISSION_KEYS.filter((k) => typeof patch?.[k] === "boolean").map((k) => [k, patch[k]]));
  await store.update("agents", agent.id, { permissions: { ...agent.permissions, ...clean } });
  done();
}

export async function updateAgentAction(patch: { name?: string; persona?: string; publishFrequency?: PublishFrequency; paused?: boolean }): Promise<void> {
  const userId = await requireUserId();
  const agent = await agentOf(userId);
  const clean: Partial<Agent> = {};
  if (typeof patch?.name === "string" && patch.name.trim()) clean.name = patch.name.trim().slice(0, 60);
  if (typeof patch?.persona === "string") clean.persona = patch.persona.slice(0, 500);
  if (typeof patch?.publishFrequency === "string" && FREQUENCIES.includes(patch.publishFrequency)) clean.publishFrequency = patch.publishFrequency;
  if (clean.name && (await store.list("agents")).some((a) => a.id !== agent.id && a.name.toLowerCase() === clean.name!.toLowerCase())) throw new Error("That agent name is taken.");
  await store.update("agents", agent.id, clean);
  if (typeof patch?.paused === "boolean") await setPaused(userId, patch.paused);
  done();
}

const TEXT_KEYS = ["summary", "tone", "postingStyle", "sampleVoice"] as const;
const LIST_KEYS = ["traits", "interests", "values"] as const;

export async function updatePersonalityAction(patch: Partial<Personality>): Promise<void> {
  const agent = await agentOf(await requireUserId());
  const base: Personality = agent.personality ?? {
    summary: "", tone: "", traits: [], interests: [], values: [], postingStyle: "", emojiUse: "light", sampleVoice: "",
    source: "user", tokensAnalyzed: 0, updatedAt: "", aiSource: "simulated",
  };
  const clean: Partial<Personality> = {};
  for (const k of TEXT_KEYS) if (typeof patch?.[k] === "string") clean[k] = patch[k]!.slice(0, 2000);
  for (const k of LIST_KEYS) if (Array.isArray(patch?.[k])) clean[k] = patch[k]!.filter((v) => typeof v === "string").slice(0, 20).map((v) => v.slice(0, 80));
  if (patch?.emojiUse && ["none", "light", "heavy"].includes(patch.emojiUse)) clean.emojiUse = patch.emojiUse;
  await store.update("agents", agent.id, { personality: { ...base, ...clean, source: "user", updatedAt: new Date().toISOString() } });
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
  const user = await store.get("users", await requireUserId());
  // Wipes every account: only a demo session, and only where the operator opted in (VEXOWORLD_ALLOW_RESET=1).
  if (!user?.isDemo || process.env.VEXOWORLD_ALLOW_RESET !== "1") throw new Error("Reset is disabled.");
  await store.reset();
  revalidatePath("/", "layout");
}
