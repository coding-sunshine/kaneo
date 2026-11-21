import {
  addDays,
  addHours,
  addMonths,
  addWeeks,
  isBefore,
  nextMonday,
  set,
} from "date-fns";

export type SnoozeOption = { id: string; label: string; date: Date };

const at9 = (date: Date) =>
  set(date, { hours: 9, minutes: 0, seconds: 0, milliseconds: 0 });

export function getSnoozeOptions(now = new Date()): SnoozeOption[] {
  return [
    { id: "hour", label: "An hour from now", date: addHours(now, 1) },
    { id: "hours3", label: "In 3 hours", date: addHours(now, 3) },
    { id: "tomorrow", label: "Tomorrow", date: at9(addDays(now, 1)) },
    { id: "week", label: "Next week", date: at9(nextMonday(now)) },
    { id: "month", label: "A month from now", date: at9(addMonths(now, 1)) },
  ];
}

const UNIT = {
  h: addHours,
  d: addDays,
  w: addWeeks,
  m: addMonths,
} as const;

/** "4 pm", "16:30", "2 days", "in 5 weeks" -> a future Date, or null. */
export function parseSnooze(input: string, now = new Date()): Date | null {
  const text = input
    .trim()
    .toLowerCase()
    .replace(/^in\s+/, "");
  const rel = text.match(/^(\d+)\s*(h|hr|hour|d|day|w|wk|week|month|mo)s?$/);
  if (rel) {
    const unit = rel[2] === "month" || rel[2] === "mo" ? "m" : rel[2][0];
    return UNIT[unit as keyof typeof UNIT](now, Number(rel[1]));
  }
  const clock = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!clock) return null;
  let hours = Number(clock[1]);
  if (clock[3] === "pm" && hours < 12) hours += 12;
  if (clock[3] === "am" && hours === 12) hours = 0;
  if (hours > 23 || Number(clock[2] ?? 0) > 59) return null;
  const today = set(now, {
    hours,
    minutes: Number(clock[2] ?? 0),
    seconds: 0,
    milliseconds: 0,
  });
  return isBefore(today, now) ? addDays(today, 1) : today;
}

export function isSnoozed(
  notification: { snoozedUntil?: string | null },
  now = new Date(),
) {
  return (
    !!notification.snoozedUntil && new Date(notification.snoozedUntil) > now
  );
}
