import { useMutation, useQueryClient } from "@tanstack/react-query";
import snoozeTask from "@/fetchers/task/snooze-task";

export function useSnoozeTask(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      snoozedUntil,
    }: {
      taskId: string;
      snoozedUntil: string | null;
    }) => snoozeTask(taskId, snoozedUntil),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
  });
}
