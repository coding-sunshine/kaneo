import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function setSubscription(taskId: string, subscribe: boolean) {
  const route = client.task[":id"].subscription;
  const response = subscribe
    ? await route.$post({ param: { id: taskId } })
    : await route.$delete({ param: { id: taskId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export function useToggleTaskSubscription(taskId: string) {
  const queryClient = useQueryClient();
  const key = ["task", taskId];

  return useMutation({
    mutationFn: (subscribe: boolean) => setSubscription(taskId, subscribe),
    onMutate: async (subscribe) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      queryClient.setQueryData(key, (task: object | undefined) =>
        task ? { ...task, isSubscribed: subscribe } : task,
      );
      return { previous };
    },
    onError: (_error, _subscribe, context) =>
      queryClient.setQueryData(key, context?.previous),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: ["assigned-tasks"] });
    },
  });
}
