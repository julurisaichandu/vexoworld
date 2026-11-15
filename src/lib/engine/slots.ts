// Availability slots: "<day> HH:MM-HH:MM", day = today|tomorrow|mon..sun|weekend.
const DAYS = ["today", "tomorrow", "mon", "tue", "wed", "thu", "fri", "sat", "sun", "weekend"];
const DAY_RE = /\b(today|tomorrow|mon|tue|wed|thu|fri|sat|sun|weekend)\w*\b/i;
const SLOT_RE = /\b(today|tomorrow|mon|tue|wed|thu|fri|sat|sun|weekend)\s+(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/gi;

type Slot = { day: string; start: number; end: number };

const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const show = (s: Slot) => `${s.day} ${fmt(s.start)}-${fmt(s.end)}`;

export function parseSlot(text: string): Slot | null {
  const m = new RegExp(SLOT_RE.source, "i").exec(text.trim());
  if (!m || !DAYS.includes(m[1].toLowerCase())) return null;
  return { day: m[1].toLowerCase(), start: +m[2] * 60 + +m[3], end: +m[4] * 60 + +m[5] };
}

export function dayOf(text?: string): string | undefined {
  const m = text && DAY_RE.exec(text);
  return m ? m[1].toLowerCase() : undefined;
}

const sameDay = (a: string, b: string) =>
  a === b ? a : a === "weekend" && (b === "sat" || b === "sun") ? b : b === "weekend" && (a === "sat" || a === "sun") ? a : null;

/** Overlapping windows (at least 30 minutes) between two slot lists, earliest first. */
export function overlap(a: string[], b: string[]): string[] {
  const out: Slot[] = [];
  for (const x of a.map(parseSlot)) {
    for (const y of b.map(parseSlot)) {
      if (!x || !y) continue;
      const day = sameDay(x.day, y.day);
      const start = Math.max(x.start, y.start);
      const end = Math.min(x.end, y.end);
      if (day && end - start >= 30) out.push({ day, start, end });
    }
  }
  return out.sort((p, q) => p.day.localeCompare(q.day) || p.start - q.start).map(show);
}

export const slotsForDay = (slots: string[], day?: string) =>
  slots.filter((s) => {
    const p = parseSlot(s);
    return p && (!day || sameDay(p.day, day));
  });

/** "tomorrow 18:00-21:00" -> "tomorrow 18:00" */
export const slotStart = (slot: string) => slot.replace(/-\d{1,2}:\d{2}$/, "");

const hour = (h: string, mer: string | undefined, assumePm: boolean) => {
  let n = +h;
  if (mer?.toLowerCase() === "pm" && n < 12) n += 12;
  else if (mer?.toLowerCase() === "am" && n === 12) n = 0;
  else if (!mer && assumePm && n < 8) n += 12;
  return n * 60;
};

/** Turns free-form availability ("free after 6pm tomorrow") into slots. ponytail: a few phrasings, not a date parser. */
export function extractSlots(text: string, fallbackDay = "today"): string[] {
  const explicit = [...text.matchAll(SLOT_RE)].map((m) => show(parseSlot(m[0])!));
  if (explicit.length) return explicit;
  const day = dayOf(text) ?? fallbackDay;
  const after = /after\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.exec(text);
  if (after) {
    const start = hour(after[1], after[3], true) + +(after[2] ?? 0);
    return [show({ day, start, end: Math.max(start + 60, 22 * 60) })];
  }
  const range = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|to|until)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.exec(text);
  if (range) {
    const end = hour(range[4], range[6], true) + +(range[5] ?? 0);
    const start = hour(range[1], range[3] ?? range[6], true) + +(range[2] ?? 0);
    if (end > start) return [show({ day, start, end })];
  }
  if (/morning/i.test(text)) return [show({ day, start: 540, end: 720 })];
  if (/afternoon/i.test(text)) return [show({ day, start: 780, end: 1020 })];
  if (/evening|tonight|night/i.test(text)) return [show({ day, start: 1080, end: 1260 })];
  return [];
}
