import { NextResponse } from "next/server";
import { userIdFromRequest } from "@/lib/session";
import { readJson } from "@/lib/utils";

export async function POST(req: Request) {
  if (!(await userIdFromRequest(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) return NextResponse.json({ simulated: true }, { status: 503 });
  const body = (await readJson(req).catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 1000) return NextResponse.json({ error: "text must be 1-1000 chars" }, { status: 400 });
  try {
    const res = await fetch("https://api.deepgram.com/v1/speak?model=aura-2-thalia-en&encoding=mp3", {
      method: "POST",
      headers: { Authorization: `Token ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok || !res.body) return NextResponse.json({ simulated: true }, { status: 503 });
    return new Response(res.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ simulated: true }, { status: 503 });
  }
}
