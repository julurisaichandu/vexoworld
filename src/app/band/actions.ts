"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BAND_TOPICS } from "@/lib/types";
import { getBandOverview, getBandSettings, publishNow, updateBandSettings } from "@/lib/band";
import { captureState, startCapture, stopCapture } from "@/lib/band/capture";
import { requireUserId } from "@/lib/session";
import { store } from "@/lib/store";

const patchSchema = z.object({
  bandNumber: z.number().int().min(1).max(9999).optional(),
  audioEnabled: z.boolean().optional(),
  autoPublish: z.boolean().optional(),
  publishInterval: z.enum(["1m", "2m", "5m", "10m", "1d"]).optional(),
  topics: z.partialRecord(z.enum(BAND_TOPICS), z.boolean()).optional(),
});

type BandSettingsPatch = z.infer<typeof patchSchema>;

export async function saveBandSettingsAction(patch: BandSettingsPatch): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const parsed = patchSchema.safeParse(patch);
  if (!parsed.success) return { error: "Invalid settings" };
  try {
    await updateBandSettings(userId, parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save" };
  }
  revalidatePath("/band");
  return {};
}

export async function startCaptureAction(): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const { settings, bridgeOnline } = await getBandOverview(userId);
  if (bridgeOnline && !captureState(userId).running)
    return { error: "Capture is already running outside the app (a terminal?). Stop it there first." };
  try {
    await updateBandSettings(userId, { bandNumber: settings.bandNumber }); // starting claims the band, as a save does
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not claim the band" };
  }
  const error = startCapture(userId, settings.bandNumber);
  revalidatePath("/band");
  return error ? { error } : {};
}

export async function stopCaptureAction(): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const error = stopCapture(userId);
  // Clear the heartbeat so the page shows "not running" at once instead of after 15 s.
  if (!error) await store.update("bandSettings", (await getBandSettings(userId)).id, { lastSeenAt: undefined });
  revalidatePath("/band");
  return error ? { error } : {};
}

export async function publishNowAction(): Promise<{ outcome: string; reason: string }> {
  const userId = await requireUserId();
  const r = await publishNow(userId);
  revalidatePath("/band");
  return { outcome: r.outcome, reason: r.reason };
}
