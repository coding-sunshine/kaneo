import { useMutation } from "@tanstack/react-query";
import { syncCalendarTasks } from "@/fetchers/calendar-sync/calendar-sync";

export function useSyncCalendarTasks() {
  return useMutation({ mutationFn: syncCalendarTasks });
}
