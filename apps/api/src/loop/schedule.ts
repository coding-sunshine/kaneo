export const FREQUENCIES = [
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
] as const;
export type Frequency = (typeof FREQUENCIES)[number];

// Calendar math in UTC; "monthly" and "yearly" keep the day of month (JS rolls
// 31 Jan + 1 month into March, which is acceptable for a recurring digest).
export function nextRunAfter(frequency: Frequency, from: Date): Date {
  const next = new Date(from);
  switch (frequency) {
    case "hourly":
      next.setUTCHours(next.getUTCHours() + 1);
      break;
    case "daily":
      next.setUTCDate(next.getUTCDate() + 1);
      break;
    case "weekly":
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case "monthly":
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
    case "yearly":
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      break;
  }
  return next;
}
