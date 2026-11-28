function partsAt(now: Date, timeZone: string | null) {
  const read = (zone: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = read(timeZone || "UTC");
  } catch {
    parts = read("UTC");
  }
  const part = (type: string) =>
    Number(parts.find((item) => item.type === type)?.value ?? 0);
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
  };
}

const pad = (value: number) => String(value).padStart(2, "0");

/** The local day (YYYY-MM-DD) and hour at `now` in an IANA zone, UTC if unknown. */
export function localTime(now: Date, timeZone: string | null) {
  const parts = partsAt(now, timeZone);
  return {
    day: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
    hour: parts.hour,
  };
}

/**
 * The instant a local day starts in an IANA zone. The date picker stores a
 * due date as the local midnight of the chosen day, so this is where "due
 * today" begins for the person.
 */
export function zoneMidnight(day: string, timeZone: string | null) {
  const guess = Date.parse(`${day}T00:00:00.000Z`);
  let instant = guess;
  // Twice, so a day whose offset differs from the guess's still lands.
  for (let pass = 0; pass < 2; pass += 1) {
    const local = partsAt(new Date(instant), timeZone);
    const shown = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
    );
    instant -= shown - guess;
  }
  return new Date(instant);
}
