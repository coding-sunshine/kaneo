import { useQueryClient } from "@tanstack/react-query";

// A review change moves the task in or out of someone's Needs my review list,
// so every tab and count of the assigned-tasks lists refetches.
export function useInvalidateDesignReviews() {
  const queryClient = useQueryClient();
  return (taskId: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["design-reviews", taskId] }),
      queryClient.invalidateQueries({ queryKey: ["assigned-tasks"] }),
    ]);
}
