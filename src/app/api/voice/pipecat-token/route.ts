import { NextResponse } from "next/server";
import { signToken, userIdFromRequest } from "@/lib/session";

export async function POST(req: Request) {
  const uid = await userIdFromRequest(req);
  if (!uid) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json({
    token: signToken({ uid, scope: "voice" }, 600),
    url: process.env.NEXT_PUBLIC_PIPECAT_URL ?? null,
  });
}
