import { useQuery } from "@tanstack/react-query";
import { getCalendarEvents } from "@/fetchers/calendar-sync/calendar-sync";

export const calendarEventsKey = ["calendar-sync", "events"] as const;

/** Events from the signed-in person's connected calendars in a range. */
export function useCalendarEvents(from: Date, to: Date, enabled: boolean) {
  return useQuery({
    queryKey: [...calendarEventsKey, from.toISOString(), to.toISOString()],
    queryFn: () => getCalendarEvents(from, to),
    enabled,
    staleTime: 60_000,
  });
}
