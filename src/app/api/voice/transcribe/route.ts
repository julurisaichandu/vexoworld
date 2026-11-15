import { NextResponse } from "next/server";
import { userIdFromRequest } from "@/lib/session";
import { readBytes } from "@/lib/utils";

const MAX_BYTES = 10 * 1024 * 1024;
const simulated = () => NextResponse.json({ simulated: true }, { status: 503 });

export async function POST(req: Request) {
  if (!(await userIdFromRequest(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) return simulated();
  const audio = await readBytes(req, MAX_BYTES);
  if (!audio) return NextResponse.json({ error: "audio too large" }, { status: 413 });
  if (!audio.byteLength) return NextResponse.json({ error: "empty audio" }, { status: 400 });
  try {
    const res = await fetch("https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true", {
      method: "POST",
      headers: { Authorization: `Token ${key}`, "Content-Type": req.headers.get("content-type") || "audio/webm" },
      body: Buffer.from(audio),
    });
    if (!res.ok) return simulated();
    const data = await res.json();
    const transcript: string = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
    return NextResponse.json({ transcript, source: "live" });
  } catch {
    return simulated();
  }
}
