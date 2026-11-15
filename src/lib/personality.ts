import { store, now } from "./store";
import * as ai from "./ai";
import type { CorpusEntry, Personality } from "./types";

const TARGET = 200_000;
const MAX = 300_000;
const REFRESH_TOKENS = 50_000;

export const estimateTokens = (text: string) => Math.ceil(text.length / 4);

const agentOf = async (userId: string) => (await store.list("agents", { userId }))[0] ?? null;

export async function corpusStats(userId: string) {
  const entries = await store.list("corpus", { userId });
  return { tokens: entries.reduce((n, e) => n + e.tokens, 0), target: TARGET, max: MAX, entries: entries.length };
}

export async function addToCorpus(userId: string, text: string, source: CorpusEntry["source"]) {
  if (!text.trim()) return;
  await store.insert("corpus", { userId, text, source, tokens: estimateTokens(text) });
  const agent = await agentOf(userId);
  if (!agent || agent.personality?.source === "user") return;
  const { tokens } = await corpusStats(userId);
  const min = Number(process.env.PERSONALITY_MIN_TOKENS ?? TARGET);
  if (tokens >= min && (!agent.personality || tokens - agent.personality.tokensAnalyzed >= REFRESH_TOKENS))
    void inferPersonality(userId).catch(() => {});
}

/** Analyzes the newest <= 300k tokens in one call. A personality the human wrote always wins. */
export async function inferPersonality(userId: string, opts: { force?: boolean } = {}): Promise<Personality | null> {
  const agent = await agentOf(userId);
  if (!agent || agent.personality?.source === "user") return null;
  if (agent.personality && !opts.force) return agent.personality;
  const newest = await store.list("corpus", { userId });
  const picked: CorpusEntry[] = [];
  let tokens = 0;
  for (const e of newest) {
    if (tokens + e.tokens > MAX) break;
    picked.unshift(e);
    tokens += e.tokens;
  }
  if (!picked.length) return null;
  const result = await ai.analyzePersonality(picked.map((e) => e.text).join("\n\n"));
  const personality: Personality = { ...result, source: "inferred", tokensAnalyzed: tokens, updatedAt: now() };
  const fresh = await agentOf(userId);
  if (fresh?.personality?.source === "user") return null;
  await store.update("agents", agent.id, { personality });
  return personality;
}

export async function updatePersonality(userId: string, patch: Partial<Personality>): Promise<Personality | null> {
  const agent = await agentOf(userId);
  if (!agent) return null;
  const base: Personality = agent.personality ?? {
    summary: "", tone: "", traits: [], interests: [], values: [], postingStyle: "", emojiUse: "none",
    sampleVoice: "", source: "user", tokensAnalyzed: 0, updatedAt: now(), aiSource: "simulated",
  };
  const personality: Personality = { ...base, ...patch, source: "user", updatedAt: now() };
  await store.update("agents", agent.id, { personality });
  return personality;
}
