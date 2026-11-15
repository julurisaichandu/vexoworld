import { processJobs } from "@/lib/engine";

export const dynamic = "force-dynamic";

export async function POST() {
  return Response.json({ processed: await processJobs(10) });
}
