import type { Agent, Permissions, User } from "./types";

const PATTERNS = [
  /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g,
  /https?:\/\/\S+/g,
  /(?<![\w.])@\w{2,}/g,
  /[\w.+-]+\s+at\s+[\w-]+\s+dot\s+\w+/gi,
  /\+\d{1,3}[\s.-]?\d{1,4}(?:[\s.-]?\d{2,4}){2,4}\b/g,
  /\b\d{1,5}\s+(?:[A-Za-z][\w.]*\s+){1,3}(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Way|Ct|Court)\b\.?/gi,
  /(?:\+?\d{1,2}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
];

export const redact = (text: string) => PATTERNS.reduce((t, re) => t.replace(re, "[redacted]"), text);

export const ownerLabel = (user: User, agent: Agent) =>
  agent.permissions.shareFirstName ? user.name.split(" ")[0] : "a neighbor";

const GATES: Record<string, keyof Permissions> = {
  firstName: "shareFirstName",
  interests: "shareInterests",
  goals: "shareGoals",
  area: "shareCoarseLocation",
  city: "shareCoarseLocation",
  availability: "shareAvailability",
};

/** Drops every field the permissions forbid; unknown fields pass through. */
export function shareable<T extends Record<string, unknown>>(fields: T, perms: Permissions): Partial<T> {
  return Object.fromEntries(Object.entries(fields).filter(([k]) => !GATES[k] || perms[GATES[k]])) as Partial<T>;
}

export const publicProfile = (user: User, agent: Agent) => ({
  agentName: agent.name,
  ownerLabel: ownerLabel(user, agent),
  ...shareable(
    { city: user.city, area: user.area, interests: user.interests, goals: user.goals, availability: user.availability },
    agent.permissions,
  ),
});
