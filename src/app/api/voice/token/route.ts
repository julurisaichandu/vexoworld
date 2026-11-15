import { NextResponse } from "next/server";
import { userIdFromRequest } from "@/lib/session";

const simulated = () => NextResponse.json({ simulated: true }, { status: 503 });

/** Short-lived Deepgram token for the browser; the API key itself never leaves the server. */
export async function POST(req: Request) {
  if (!(await userIdFromRequest(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) return simulated();
  try {
    const res = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: { Authorization: `Token ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl_seconds: 60 }),
    });
    if (!res.ok) return simulated();
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return simulated();
    return NextResponse.json({ accessToken: data.access_token, expiresIn: data.expires_in ?? 60 });
  } catch {
    return simulated();
  }
}
