import type { HumanRequestKind, MissionKind, Permissions, Personality, PostKind, PublishFrequency } from "../types";
import { redact } from "../privacy";

// Deterministic offline stand-in for Gemini. Also the fallback on any live failure.

export const KEYWORDS = [
  "badminton", "tennis", "hiking", "robotics", "coffee", "photography", "ai", "startup", "events", "running",
  "climbing", "yoga", "cycling", "music", "board games", "cooking", "design", "volunteering", "pickleball", "chess",
];
const DAYS = ["today", "tomorrow", "mon", "tue", "wed", "thu", "fri", "sat", "sun", "weekend"] as const;
const DAY_ALIASES: Record<string, string> = {
  monday: "mon", tuesday: "tue", wednesday: "wed", thursday: "thu", friday: "fri", saturday: "sat", sunday: "sun",
  tonight: "today", weekend: "weekend", today: "today", tomorrow: "tomorrow",
  mon: "mon", tue: "tue", wed: "wed", thu: "thu", fri: "fri", sat: "sat", sun: "sun",
};
const STOP = new Set(
  "the a an and or but to of in on at for with who what that this is are was were be i me my we you it as from by about some someone people find looking want wants play partner connect any anyone have has had not just really there only few".split(" "),
);

const words = (t: string) => t.toLowerCase().match(/[a-z][a-z'-]+/g) ?? [];
const has = (text: string, kw: string) => new RegExp(`(^|[^a-z])${kw}([^a-z]|$)`, "i").test(text);
export const keywordsIn = (text: string) => KEYWORDS.filter((k) => has(text, k));

export function dayIn(text: string): string | undefined {
  const m = text.toLowerCase().match(/\b(today|tonight|tomorrow|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/);
  return m ? DAY_ALIASES[m[1]] : undefined;
}

function placeIn(text: string) {
  const m = text.replace(/^\S+\s+/, "").match(/\b[A-Z][a-z]+(?: [A-Z][a-z]+)+\b/);
  return m?.[0];
}

export function parseCommand(text: string) {
  const t = text.trim();
  const l = t.toLowerCase();
  const out = (intent: string, extra: Record<string, string | undefined> = {}) => ({ intent, ...extra });
  if (/what (have|did) the other agents|other agents (have )?discovered|network digest/.test(l)) return out("network_digest", { reply: "Here is what the network has been up to." });
  if (/what (has|have) my agent|what have you been doing|my agent been doing/.test(l)) return out("activity_summary", { reply: "Here is what I have been doing." });
  if (/\b(pending|questions for me|waiting for me)\b/.test(l)) return out("list_pending", { reply: "Here is what is waiting for you." });
  if (/\b(is|does) anyone\b|crowded|ask (around |the network )?(whether|if)/.test(l)) return out("ask_network", { question: t, reply: "Good question. I'll ask around the network." });
  if (/\b(find|connect me)\b|\bsomeone (who|to)\b|\bpartner\b|looking for (a |an |some)?\w+ (partner|buddy)/.test(l)) return out("find_people", { goal: t, reply: "On it. I'll look for matching people on the network." });
  const post = t.match(/^(?:please )?(?:post|share)\b(?:\s+that)?[:,]?\s*(.*)$/i);
  if (post) return out("post", { post: post[1] || undefined, reply: "Let me see if that's good to share." });
  if (/^(yes|yep|approve|approved|confirm|ok|okay|sure|go ahead)\b/.test(l)) return out("approve", { reply: "Approved." });
  if (/^(no|nope|reject|decline|don't|cancel)\b/.test(l)) return out("reject", { reply: "Okay, I'll decline." });
  return out("chat", { reply: "Got it. I can find people, ask the network a question, or summarize what's going on." });
}

export function planMission(goal: string) {
  const place = placeIn(goal);
  const crowdQ = /\?\s*$|crowded|busy|right now|open now|line|wait/i.test(goal);
  const kind: MissionKind = place && crowdQ ? "observation" : "match";
  const interests = keywordsIn(goal);
  const when = dayIn(goal) ?? (/right now/i.test(goal) ? "today" : undefined);
  const steps =
    kind === "observation"
      ? ["Search the agent network", "Contact nearby agents", "Ask a human for a live observation", "Share the answer"]
      : ["Search the agent network", "Contact matching agents", "Exchange authorized details", "Ask both humans to approve", "Introduce"];
  const title = kind === "observation" ? `Is ${place} crowded right now?` : goal.replace(/[.!?]+$/, "").slice(0, 70);
  return { title, kind, interests, when, place: kind === "observation" ? place : undefined, steps };
}

export function rankCandidates(goal: string, candidates: { agentId: string; text: string }[]) {
  const g = new Set(words(goal).filter((w) => !STOP.has(w) && w.length > 1));
  const ranked = candidates
    .map(({ agentId, text }) => {
      const shared = [...new Set(words(text))].filter((w) => g.has(w));
      return { agentId, score: g.size ? Math.min(1, shared.length / Math.min(g.size, 3)) : 0, reason: shared.length ? `Shares: ${shared.join(", ")}` : "No overlap" };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);
  return { ranked };
}

export function reviewInbound(input: {
  kind: "match" | "observation";
  request: Record<string, unknown>;
  known: { interests: string[]; availability: string[]; recentPlaces: string[] };
}) {
  const r = input.request;
  if (input.kind === "observation") {
    const place = String(r.place ?? r.topic ?? "that place");
    return { wants: true, missing: ["current crowd level"], questionForHuman: `Hey! Someone wants to know if ${place} is crowded right now. Would you like to answer?` };
  }
  const wanted = Array.isArray(r.interests) ? (r.interests as string[]) : [];
  const wants = !wanted.length || wanted.some((i) => input.known.interests.map((k) => k.toLowerCase()).includes(i.toLowerCase()));
  if (!wants) return { wants: false, missing: [] as string[] };
  const when = typeof r.when === "string" && r.when ? r.when : undefined;
  const day = when ? dayIn(when) ?? when : undefined;
  if (!when || input.known.availability.some((s) => s.toLowerCase().startsWith(String(day)))) return { wants: true, missing: [] as string[] };
  const what = wanted[0] ? `a ${wanted[0]} partner` : "someone to meet up with";
  return { wants: true, missing: [`availability for ${when}`], questionForHuman: `Hey! Someone's agent is looking for ${what} ${when}. What times work for you?` };
}

const pad = (n: number) => String(n).padStart(2, "0");
function hour24(h: string, min: string | undefined, ap: string | undefined, fallbackPm = false) {
  let n = Number(h);
  const pm = ap ? ap.toLowerCase() === "pm" : fallbackPm && n < 8;
  if (pm && n < 12) n += 12;
  if (!pm && ap && n === 12) n = 0;
  return `${pad(n)}:${min ?? "00"}`;
}

export function parseTimes(answer: string): string | undefined {
  const a = answer.toLowerCase();
  const range = a.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|to|and|until)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  if (range) return `${hour24(range[1], range[2], range[3] ?? range[6])}-${hour24(range[4], range[5], range[6])}`;
  const after = a.match(/(?:after|from|starting)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (after) {
    const start = hour24(after[1], after[2], after[3], true);
    return `${start}-${pad(Math.min(23, Number(start.slice(0, 2)) + 4))}:00`;
  }
  const before = a.match(/before\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (before) return `08:00-${hour24(before[1], before[2], before[3], true)}`;
  return undefined;
}

export function structureAnswer(question: string, answer: string, kind: HumanRequestKind) {
  const note = redact(answer.trim()).slice(0, 140);
  if (kind === "observation") {
    const a = answer.toLowerCase();
    const crowd = /\b(few|empty|quiet|barely|nobody|no one|slow|not (really |that |very )?(crowded|busy|packed))\b|not really/.test(a)
      ? "low"
      : /\b(busy|packed|crowded|full|line|lot of|swamped)\b/.test(a)
        ? "busy"
        : "moderate";
    return { summary: `Crowd level: ${crowd}. "${note}"`, fields: { crowd, note } };
  }
  const times = parseTimes(answer);
  if (times) {
    const slot = `${dayIn(answer) ?? dayIn(question) ?? "today"} ${times}`;
    return { summary: `Available ${slot}`, fields: { availability: slot } };
  }
  return { summary: note, fields: {} as Record<string, string> };
}

const WINDOW_MS: Partial<Record<PublishFrequency, number>> = { hourly: 3_600_000, daily: 86_400_000, weekly: 604_800_000 };
const SENSITIVE = /\b(health|doctor|medical|medication|sick|diagnos\w*|salary|money|debt|loan|bank|mortgage|child|children|kid|kids|son|daughter|baby|pregnan\w*)\b|\b\d{1,5}\s+\w+\s+(st|street|ave|avenue|rd|road|blvd)\b/i;
const CHIT_CHAT = /^(hi|hello|hey|thanks|thank you|ok|okay|lol|cool|yes|no|good (morning|night))\b/i;

/** Hard gates that always apply, live or simulated: chit-chat, private details, duplicates, frequency window. */
export function publishGate(input: { candidate: string; frequency: PublishFrequency; recentPosts: string[]; lastPublishedAt?: string }) {
  const c = input.candidate.trim();
  if (input.frequency === "manual") return "manual: needs approval";
  if (c.split(/\s+/).length < 3 || CHIT_CHAT.test(c)) return "chit-chat, nothing worth sharing";
  if (redact(c) !== c) return "contains private details";
  if (input.recentPosts.some((p) => p.toLowerCase() === c.toLowerCase())) return "already posted";
  const win = WINDOW_MS[input.frequency];
  if (win && input.lastPublishedAt && Date.now() - Date.parse(input.lastPublishedAt) < win) return `${input.frequency}: too soon since the last post`;
  return null;
}

export const postMeta = (text: string): { kind: PostKind; tags: string[]; sensitivity: "low" | "medium" | "high" } => ({
  kind: /looking for|find|partner|anyone|who wants/i.test(text) ? "looking_for" : /discover|found|learned|turns out|noticed/i.test(text) ? "discovery" : keywordsIn(text).length ? "interest" : "update",
  tags: keywordsIn(text),
  sensitivity: SENSITIVE.test(text) ? "high" : "low",
});

function thirdPerson(c: string) {
  const s = c.trim().replace(/[.!]+$/, "");
  if (/^my human\b/i.test(s)) return s;
  const map: [RegExp, string][] = [
    [/^i['’]m\s+/i, "is "], [/^i am\s+/i, "is "], [/^i['’]d like\s+/i, "would like "], [/^i want\s+/i, "wants "],
    [/^i need\s+/i, "needs "], [/^i love\s+/i, "loves "], [/^i like\s+/i, "likes "], [/^i just\s+/i, "just "],
  ];
  for (const [re, rep] of map) if (re.test(s)) return `My human ${s.replace(re, rep)}`;
  return `My human is thinking about: ${s}`;
}

export function decidePublish(input: {
  candidate: string;
  personality: Personality | null;
  permissions: Permissions;
  frequency: PublishFrequency;
  recentPosts: string[];
  lastPublishedAt?: string;
}) {
  const none = { publish: false, text: "", kind: "update" as PostKind, tags: [] as string[], sensitivity: "low" as const };
  const gate = publishGate(input);
  if (gate) return { ...none, reason: gate };
  const meta = postMeta(input.candidate);
  const emoji = input.personality?.emojiUse === "heavy" ? " ✨🎉" : input.personality?.emojiUse === "light" ? " ✨" : "";
  const text = `${thirdPerson(input.candidate)}${/enthusias|excit|upbeat|warm|energetic/i.test(input.personality?.tone ?? "") ? "!" : "."}${emoji}`;
  return { publish: true, reason: "Worth sharing", text, ...meta };
}

const EMOJI = /\p{Extended_Pictographic}/gu;

export function analyzePersonality(corpus: string): Omit<Personality, "source" | "tokensAnalyzed" | "updatedAt"> {
  const ws = words(corpus);
  const freq = new Map<string, number>();
  for (const w of ws) if (!STOP.has(w) && w.length > 2) freq.set(w, (freq.get(w) ?? 0) + 1);
  const top = [...freq].sort((a, b) => b[1] - a[1]);
  const kw = KEYWORDS.filter((k) => has(corpus, k)).sort((a, b) => (freq.get(b) ?? 0) - (freq.get(a) ?? 0));
  const interests = (kw.length ? kw : top.map(([w]) => w)).slice(0, 5);
  const sentences = corpus.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const bangs = (corpus.match(/!/g) ?? []).length;
  const questions = (corpus.match(/\?/g) ?? []).length;
  const avgLen = ws.length / Math.max(1, sentences.length);
  const emojis = (corpus.match(EMOJI) ?? []).length;
  const per1k = (emojis / Math.max(1, corpus.length)) * 1000;
  const tone = bangs > sentences.length * 0.2 ? "enthusiastic and warm" : questions > sentences.length * 0.25 ? "curious and conversational" : avgLen < 9 ? "brisk and direct" : "thoughtful and measured";
  const traits = [tone.split(" ")[0], avgLen < 9 ? "concise" : "detailed", questions > bangs ? "inquisitive" : "expressive"];
  const sample = sentences.filter((s) => s.length >= 30 && s.length <= 140).sort((a, b) => Math.abs(a.length - 80) - Math.abs(b.length - 80))[0] ?? sentences[0] ?? "";
  return {
    summary: `Writes in a ${tone} voice${interests.length ? ` and often talks about ${interests.slice(0, 3).join(", ")}` : ""}.`,
    tone,
    traits,
    interests,
    values: [],
    postingStyle: avgLen < 9 ? "short, punchy lines" : "a couple of full sentences",
    emojiUse: per1k > 3 ? "heavy" : per1k > 0.3 ? "light" : "none",
    sampleVoice: sample,
    aiSource: "simulated",
  };
}

export function summarize(kind: "network_digest" | "activity", items: string[]) {
  if (!items.length) return { text: kind === "activity" ? "Nothing yet. I haven't done anything on your behalf." : "The network is quiet right now." };
  const lead = kind === "activity" ? "Recently I" : "On the network";
  const shown = items.slice(0, 5).map((i) => i.replace(/[.!\s]+$/, ""));
  return { text: `${lead}: ${shown.join("; ")}.${items.length > 5 ? ` Plus ${items.length - 5} more.` : ""}` };
}

export { DAYS };
