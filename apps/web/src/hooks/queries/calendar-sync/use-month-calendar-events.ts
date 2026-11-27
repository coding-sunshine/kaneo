import { addDays } from "date-fns";
import { useMemo } from "react";
import { groupEventsByDay } from "@/lib/external-events-by-day";
import { useCalendarEvents } from "./use-calendar-events";
import { useCalendarSyncStatus } from "./use-calendar-sync-status";

/** Connected calendars and their events for the visible month grid. */
export function useMonthCalendarEvents(weeks: Date[][]) {
  const { data: status } = useCalendarSyncStatus();
  const connected = useMemo(
    () =>
      status?.providers
        .filter((item) => item.state === "connected")
        .map((item) => item.provider) ?? [],
    [status],
  );
  const from = weeks[0]?.[0] ?? new Date();
  const lastDay = weeks.at(-1)?.at(-1) ?? from;
  const { data } = useCalendarEvents(
    from,
    addDays(lastDay, 1),
    connected.length > 0,
  );
  const eventsByDay = useMemo(
    () => groupEventsByDay(data?.events ?? []),
    [data],
  );
  return {
    connected,
    eventsByDay,
    unavailable: data?.unavailable ?? [],
  };
}
