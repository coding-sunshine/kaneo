const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Where `now` falls in the person's week: whether it is Saturday or Sunday
 * there, and the local Monday that starts the week, as YYYY-MM-DD.
 */
export function localWeek(now: Date, timeZone: string) {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
  } catch {
    return localWeek(now, "UTC");
  }
  const part = (type: string) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  const day = WEEKDAYS.indexOf(part("weekday"));
  const localDate = Date.UTC(
    Number(part("year")),
    Number(part("month")) - 1,
    Number(part("day")),
  );
  const monday = new Date(localDate - ((day + 6) % 7) * DAY_MS);
  return {
    weekend: day === 0 || day === 6,
    week: monday.toISOString().slice(0, 10),
  };
}
