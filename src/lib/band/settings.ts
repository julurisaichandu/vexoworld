import { store } from "@/lib/store";
import { BAND_TOPICS } from "@/lib/types";
import type { BandPublishInterval, BandSettings, BandTopic, BandTranscript, BandTranscriptStatus } from "@/lib/types";
import { INTERVAL_MS } from "./topics";

const defaultBand = () => Number(process.env.VEXO_BAND_NUMBER) || 47;
const noTopics = () => Object.fromEntries(BAND_TOPICS.map((t) => [t, false])) as Record<BandTopic, boolean>;

export type BandPatch = {
  bandNumber?: number;
  audioEnabled?: boolean;
  autoPublish?: boolean;
  publishInterval?: BandPublishInterval;
  topics?: Partial<Record<BandTopic, boolean>>;
};

/** Creates the default row (audio off, auto-publish on, 5m, every topic off) on first call. */
export async function getBandSettings(userId: string): Promise<BandSettings> {
  const rows = await store.list("bandSettings", { userId }, { order: "asc" });
  if (rows[0]) return { ...rows[0], topics: { ...noTopics(), ...rows[0].topics } };
  const at = new Date().toISOString();
  return store.insert("bandSettings", {
    userId, bandNumber: defaultBand(), audioEnabled: false, autoPublish: true, publishInterval: "5m", topics: noTopics(), updatedAt: at,
  });
}

export async function updateBandSettings(userId: string, patch: BandPatch): Promise<BandSettings> {
  const cur = await getBandSettings(userId);
  if (patch.publishInterval !== undefined && !(patch.publishInterval in INTERVAL_MS)) throw new Error("Invalid publish interval");
  if (patch.bandNumber !== undefined && !(Number.isInteger(patch.bandNumber) && patch.bandNumber > 0 && patch.bandNumber < 1_000_000))
    throw new Error("Band number must be a positive whole number");
  const next: Partial<BandSettings> = { topics: { ...cur.topics } };
  for (const k of ["bandNumber", "audioEnabled", "autoPublish", "publishInterval"] as const)
    if (patch[k] !== undefined) (next as Record<string, unknown>)[k] = patch[k];
  for (const t of BAND_TOPICS) if (typeof patch.topics?.[t] === "boolean") next.topics![t] = patch.topics[t]!;
  return (await store.update("bandSettings", cur.id, next)) ?? cur;
}

export const listTranscripts = (userId: string, limit = 50): Promise<BandTranscript[]> =>
  store.list("bandTranscripts", { userId }, { limit });

export async function getBandOverview(userId: string) {
  const settings = await getBandSettings(userId);
  const all = await store.list("bandTranscripts", { userId }); // ponytail: full scan per page load, add a count query if volume grows
  const counts: Record<BandTranscriptStatus, number> = { pending: 0, published: 0, filtered: 0, awaiting_approval: 0 };
  for (const t of all) counts[t.status]++;
  const seen = settings.lastSeenAt ? Date.parse(settings.lastSeenAt) : NaN;
  const lastSeenSecondsAgo = Number.isNaN(seen) ? null : Math.max(0, Math.round((Date.now() - seen) / 1000));
  const since = Date.parse(settings.lastPublishedAt ?? settings.createdAt);
  return {
    settings,
    bridgeOnline: lastSeenSecondsAgo !== null && lastSeenSecondsAgo <= 15,
    lastSeenSecondsAgo,
    counts,
    nextPublishAt: settings.autoPublish ? new Date(since + INTERVAL_MS[settings.publishInterval]).toISOString() : null,
    transcripts: all.slice(0, 50),
  };
}
