import { z } from "zod";
import { NextResponse } from "next/server";
import { userIdFromRequest } from "@/lib/session";
import { readJson } from "@/lib/utils";
import { chatWithAgent } from "@/lib/agent-chat";

const Body = z.object({ text: z.string().trim().min(1).max(2000), inputSource: z.enum(["text", "voice"]).default("text") });

export async function POST(req: Request) {
  const userId = await userIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = Body.safeParse(await readJson(req).catch(() => null));
  if (!body.success) return NextResponse.json({ error: "text must be 1 to 2000 characters" }, { status: 400 });
  try {
    return NextResponse.json(await chatWithAgent(userId, body.data.text, body.data.inputSource));
  } catch {
    return NextResponse.json({ error: "Agent chat failed" }, { status: 500 });
  }
}
