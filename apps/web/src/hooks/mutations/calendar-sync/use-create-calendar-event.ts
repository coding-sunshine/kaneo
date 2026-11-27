import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createCalendarEvent } from "@/fetchers/calendar-sync/calendar-sync";
import { calendarEventsKey } from "@/hooks/queries/calendar-sync/use-calendar-events";

export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCalendarEvent,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: calendarEventsKey }),
  });
}
