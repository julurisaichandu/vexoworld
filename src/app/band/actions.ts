"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BAND_TOPICS } from "@/lib/types";
import { publishNow, updateBandSettings } from "@/lib/band";
import { requireUserId } from "@/lib/session";

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

export async function publishNowAction(): Promise<{ outcome: string; reason: string }> {
  const userId = await requireUserId();
  const r = await publishNow(userId);
  revalidatePath("/band");
  return { outcome: r.outcome, reason: r.reason };
}
