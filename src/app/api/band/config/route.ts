import { after } from "next/server";
import { bandBody, bandHeartbeat, publishDue, verifyBandRequest } from "@/lib/band";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const v = await verifyBandRequest(req);
  if (!v.ok) return Response.json({ error: v.error }, { status: v.status });
  const body = bandBody.safeParse(v.body);
  if (!body.success) return Response.json({ error: "invalid body" }, { status: 400 });
  const out = await bandHeartbeat(body.data.band);
  after(() => publishDue().catch(() => {}));
  return Response.json(out);
}
