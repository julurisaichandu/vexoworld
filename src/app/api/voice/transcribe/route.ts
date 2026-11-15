import { NextResponse } from "next/server";
import { userIdFromRequest } from "@/lib/session";

const MAX_BYTES = 10 * 1024 * 1024;
const simulated = () => NextResponse.json({ simulated: true }, { status: 503 });

export async function POST(req: Request) {
  if (!(await userIdFromRequest(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) return simulated();
  const audio = await req.arrayBuffer();
  if (!audio.byteLength) return NextResponse.json({ error: "empty audio" }, { status: 400 });
  if (audio.byteLength > MAX_BYTES) return NextResponse.json({ error: "audio too large" }, { status: 413 });
  try {
    const res = await fetch("https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true", {
      method: "POST",
      headers: { Authorization: `Token ${key}`, "Content-Type": req.headers.get("content-type") || "audio/webm" },
      body: audio,
    });
    if (!res.ok) return simulated();
    const data = await res.json();
    const transcript: string = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
    return NextResponse.json({ transcript, source: "live" });
  } catch {
    return simulated();
  }
}
