import { NextResponse } from "next/server";
import { currentUserId, signToken } from "@/lib/session";

export async function POST() {
  const uid = await currentUserId(); // cookie only: a voice token must not mint more voice tokens
  if (!uid) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json({
    token: signToken({ uid, scope: "voice" }, 600),
    url: process.env.NEXT_PUBLIC_PIPECAT_URL ?? null,
  });
}
