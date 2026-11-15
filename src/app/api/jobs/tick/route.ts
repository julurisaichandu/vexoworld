import { processJobs } from "@/lib/engine";
import { currentUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await currentUserId())) return Response.json({ error: "Not signed in" }, { status: 401 });
  return Response.json({ processed: await processJobs(10) });
}
