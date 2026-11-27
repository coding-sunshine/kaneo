import type { OutOfOffice } from "./profile-types";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// A bare date is a calendar day where the reader is: read it at local noon.
function toInstant(value: string) {
  if (!DATE_ONLY.test(value)) return new Date(value);
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, 12);
}

/**
 * Whether assigning a ticket to someone with this range deserves a warning:
 * they are away now, the ticket is due while they are away, or they will be
 * away soon and the ticket has no due date.
 */
export function warnsOutOfOffice(
  range: OutOfOffice | null | undefined,
  dueDate: string | null | undefined,
  now: Date,
) {
  if (!range) return false;
  const from = new Date(range.from);
  const until = new Date(range.until);
  if (until <= now) return false;
  if (from <= now) return true;
  if (!dueDate) return true;
  const due = toInstant(dueDate);
  return due >= from && due <= until;
}
