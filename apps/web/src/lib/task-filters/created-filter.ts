import { differenceInCalendarDays, isValid, parseISO } from "date-fns";

/** The "Created" filter's presets, in days. */
export const OLDER_THAN_PRESETS = [7, 14, 30] as const;

export const olderThanValue = (days: number) => `olderThan:${days}`;

/** The days of an `olderThan:<days>` value, or null for any other value. */
export function parseOlderThan(value: string): number | null {
  const match = /^olderThan:(\d{1,4})$/.exec(value);
  const days = match ? Number(match[1]) : 0;
  return days > 0 ? days : null;
}

/** Whether a ticket created at `createdAt` is older than the value's days. */
export function matchesCreated(
  createdAt: string | Date | null | undefined,
  value: string,
  today: Date,
) {
  const days = parseOlderThan(value);
  if (days === null || !createdAt) return false;
  const created =
    typeof createdAt === "string" ? parseISO(createdAt) : createdAt;
  return isValid(created) && differenceInCalendarDays(today, created) > days;
}
