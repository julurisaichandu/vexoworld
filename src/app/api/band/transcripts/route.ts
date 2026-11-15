import { after } from "next/server";
import { ingestTranscript, publishDue, transcriptBody, verifyBandRequest } from "@/lib/band";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const v = await verifyBandRequest(req);
  if (!v.ok) return Response.json({ error: v.error }, { status: v.status });
  const body = transcriptBody.safeParse(v.body);
  if (!body.success) return Response.json({ error: "invalid body" }, { status: 400 });
  const status = await ingestTranscript(body.data);
  if (status === "too_large") return Response.json({ error: "text too long" }, { status: 413 });
  after(() => publishDue().catch(() => {}));
  return Response.json({ status });
}
