import { processJobs } from "@/lib/engine";
import { publishDue } from "@/lib/band";
import { currentUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await currentUserId())) return Response.json({ error: "Not signed in" }, { status: 401 });
  const processed = await processJobs(10);
  const bandPosts = await publishDue().catch(() => 0);
  return Response.json({ processed, bandPosts });
}
