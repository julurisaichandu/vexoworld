import { GoogleGenAI } from "@google/genai";
import type { ZodType } from "zod";

export const geminiModel = () => process.env.GEMINI_MODEL || "gemini-2.5-flash";

let cached: { key: string; ai: GoogleGenAI } | null = null;

/** Returns validated JSON from Gemini, or null on missing key, timeout, API error or invalid JSON. Never logs user text. */
export async function generateJson<T>(system: string, prompt: string, schema: ZodType<T>): Promise<T | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15_000);
  try {
    if (cached?.key !== key) cached = { key, ai: new GoogleGenAI({ apiKey: key }) };
    const res = await cached.ai.models.generateContent({
      model: geminiModel(),
      contents: prompt,
      config: { systemInstruction: system, responseMimeType: "application/json", abortSignal: ctl.signal },
    });
    const parsed = schema.safeParse(JSON.parse(res.text ?? ""));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
