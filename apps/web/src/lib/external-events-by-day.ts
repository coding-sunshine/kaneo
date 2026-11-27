import { eachDayOfInterval, format, parseISO, startOfDay } from "date-fns";

export type DayEvent = {
  id: string;
  start: string;
  end: string;
  allDay: boolean;
};

// A runaway event (a year-long block) should not fill every cell.
const MAX_DAYS = 62;

export const dayKey = (day: Date) => format(day, "yyyy-MM-dd");

function eventDays(event: DayEvent) {
  if (event.allDay) {
    return { first: parseISO(event.start), last: parseISO(event.end) };
  }
  const start = new Date(event.start);
  // An event ending at midnight does not occupy the next day.
  const end = new Date(Math.max(start.getTime(), Date.parse(event.end) - 1));
  return { first: startOfDay(start), last: startOfDay(end) };
}

/** Calendar events keyed by local day, all-day first, then by start time. */
export function groupEventsByDay<TEvent extends DayEvent>(events: TEvent[]) {
  const byDay = new Map<string, TEvent[]>();
  for (const event of events) {
    const { first, last } = eventDays(event);
    if (Number.isNaN(first.getTime()) || last < first) continue;
    const days = eachDayOfInterval({ start: first, end: last }).slice(
      0,
      MAX_DAYS,
    );
    for (const day of days) {
      const key = dayKey(day);
      byDay.set(key, [...(byDay.get(key) ?? []), event]);
    }
  }
  for (const list of byDay.values()) {
    list.sort(
      (a, b) =>
        Number(b.allDay) - Number(a.allDay) ||
        Date.parse(a.start) - Date.parse(b.start),
    );
  }
  return byDay;
}
