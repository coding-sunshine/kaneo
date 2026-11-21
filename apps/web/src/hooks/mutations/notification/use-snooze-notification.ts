import { useMutation, useQueryClient } from "@tanstack/react-query";
import snoozeNotification from "@/fetchers/notification/snooze-notification";

function useSnoozeNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, until }: { id: string; until: Date | null }) =>
      snoozeNotification(id, until),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export default useSnoozeNotification;
