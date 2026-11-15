import type { BandPublishInterval, BandTopic } from "@/lib/types";

export const BAND_TOPIC_LABELS: Record<BandTopic, { label: string; hint: string }> = {
  daily_activities: { label: "Daily activities", hint: "Routines, errands, what you got up to today" },
  work: { label: "Work & career", hint: "Projects, meetings, colleagues, job talk" },
  health_fitness: { label: "Health & fitness", hint: "Workouts, sleep, wellbeing" },
  food_dining: { label: "Food & dining", hint: "Meals, cooking, restaurants, coffee" },
  places_travel: { label: "Places & travel", hint: "Trips, commutes, places you visit" },
  hobbies_interests: { label: "Hobbies & interests", hint: "Music, games, reading, side projects" },
  social_plans: { label: "Social plans & events", hint: "Meetups, parties, plans with friends" },
  personal_feelings: { label: "Personal thoughts & feelings", hint: "Moods, worries, reflections" },
  relationships_family: { label: "Relationships & family", hint: "Partner, family, close friends" },
  financial: { label: "Money & finances", hint: "Spending, bills, savings, investments" },
};

export const INTERVAL_LABELS: Record<BandPublishInterval, string> = {
  "1m": "Every minute",
  "2m": "Every 2 minutes",
  "5m": "Every 5 minutes",
  "10m": "Every 10 minutes",
  "1d": "Once a day",
};

export const INTERVAL_MS: Record<BandPublishInterval, number> = {
  "1m": 60_000,
  "2m": 120_000,
  "5m": 300_000,
  "10m": 600_000,
  "1d": 86_400_000,
};

export const MAX_POST_WORDS = 199;

/** Hard word cap, enforced in code. Keeps the original spacing up to the last allowed word. */
export function capWords(text: string, max = MAX_POST_WORDS): string {
  const words = [...text.matchAll(/\S+/g)];
  if (words.length <= max) return text.trim();
  const last = words[max - 1];
  return text.slice(0, last.index + last[0].length).trim();
}

export const countWords = (text: string) => text.match(/\S+/g)?.length ?? 0;
