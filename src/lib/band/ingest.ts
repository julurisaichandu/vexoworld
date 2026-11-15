import { z } from "zod";
import { store } from "@/lib/store";
import { BAND_TOPICS } from "@/lib/types";
import type { BandSettings, BandTopic } from "@/lib/types";
import { countWords } from "./topics";

export const MAX_TRANSCRIPT_CHARS = 16_000;

const iso = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "invalid date");
export const bandBody = z.object({ band: z.number().int().positive() });
export const transcriptBody = z.object({
  band: z.number().int().positive(),
  id: z.string().min(1).max(100),
  text: z.string().refine((s) => s.trim().length > 0, "empty text"),
  startedAt: iso,
  endedAt: iso,
  topics: z.array(z.string()).max(50).default([]),
  topicSource: z.enum(["gemini", "rules"]),
});

/** The settings row that owns this band number (most recently updated when several do). */
export async function findBandOwner(band: number): Promise<BandSettings | null> {
  const rows = await store.list("bandSettings", { bandNumber: band });
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}

/** Capture heartbeat. Marks the band as seen and tells capture whether audio is wanted. */
export async function bandHeartbeat(band: number) {
  const owner = await findBandOwner(band);
  if (!owner) return { audioEnabled: false, claimed: false };
  const row = await store.update("bandSettings", owner.id, { lastSeenAt: new Date().toISOString() });
  return { audioEnabled: (row ?? owner).audioEnabled, claimed: true };
}

export type IngestStatus = "stored" | "duplicate" | "audio_off" | "unclaimed" | "too_large";

export async function ingestTranscript(input: z.infer<typeof transcriptBody>): Promise<IngestStatus> {
  if (input.text.length > MAX_TRANSCRIPT_CHARS) return "too_large";
  const owner = await findBandOwner(input.band);
  if (!owner) return "unclaimed";
  if (!owner.audioEnabled) return "audio_off";
  const dup = await store.list("bandTranscripts", { userId: owner.userId, externalId: input.id });
  if (dup.length) return "duplicate";
  const text = input.text.trim();
  const topics = BAND_TOPICS.filter((t) => input.topics.includes(t)) as BandTopic[];
  await store.insert("bandTranscripts", {
    userId: owner.userId, bandNumber: input.band, externalId: input.id, text, startedAt: input.startedAt, endedAt: input.endedAt,
    words: countWords(text), topics, topicSource: input.topicSource, status: "pending",
  });
  return "stored";
}
