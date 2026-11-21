import { useQuery, useQueryClient } from "@tanstack/react-query";
import getTask from "@/fetchers/task/get-task";

type CachedTask = Awaited<ReturnType<typeof getTask>>;
type BoardCache = {
  columns?: Array<{ tasks?: Array<{ id: string }> }>;
  plannedTasks?: Array<{ id: string }>;
  archivedTasks?: Array<{ id: string }>;
};

function useGetTask(taskId: string, refreshWhileVisible = false) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["task", taskId],
    queryFn: () => getTask(taskId),
    enabled: Boolean(taskId),
    refetchOnMount: "always",
    staleTime: 0,
    refetchInterval: refreshWhileVisible ? 30_000 : false,
    refetchOnWindowFocus: refreshWhileVisible ? "always" : false,
    // Peek and full page paint instantly from the already-loaded board card;
    // the description arrives with the detail fetch (consumers check
    // isPlaceholderData before hydrating it).
    placeholderData: () => {
      for (const [, board] of queryClient.getQueriesData<BoardCache>({
        queryKey: ["tasks"],
      })) {
        const cards = [
          ...(board?.columns?.flatMap((column) => column.tasks ?? []) ?? []),
          ...(board?.plannedTasks ?? []),
          ...(board?.archivedTasks ?? []),
        ];
        const card = cards.find((item) => item.id === taskId);
        if (card) return card as unknown as CachedTask;
      }
      return undefined;
    },
  });
}

export default useGetTask;
