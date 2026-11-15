import type { PublishFrequency } from "@/lib/types";

export const FREQUENCIES: { value: PublishFrequency; label: string; hint: string }[] = [
  { value: "auto", label: "Auto", hint: "Your agent decides. Gemini picks what's worth sharing." },
  { value: "hourly", label: "Hourly", hint: "At most one post an hour." },
  { value: "daily", label: "Daily", hint: "At most one post a day." },
  { value: "weekly", label: "Weekly", hint: "At most one post a week." },
  { value: "manual", label: "Manual", hint: "Only when you tell your agent to post." },
];
