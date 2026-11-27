import { useMutation, useQueryClient } from "@tanstack/react-query";
import { disconnectCalendar } from "@/fetchers/calendar-sync/calendar-sync";

export function useDisconnectCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: disconnectCalendar,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["calendar-sync"] }),
  });
}
