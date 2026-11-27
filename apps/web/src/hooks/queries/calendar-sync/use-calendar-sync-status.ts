import { useQuery } from "@tanstack/react-query";
import { getCalendarSyncStatus } from "@/fetchers/calendar-sync/calendar-sync";

export const calendarSyncStatusKey = ["calendar-sync", "status"] as const;

export function useCalendarSyncStatus() {
  return useQuery({
    queryKey: calendarSyncStatusKey,
    queryFn: getCalendarSyncStatus,
  });
}
