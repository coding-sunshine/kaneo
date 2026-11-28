import { useMutation, useQueryClient } from "@tanstack/react-query";
import declineDuplicateSuggestion from "@/fetchers/duplicate-suggestion/decline-duplicate-suggestion";

function useDeclineDuplicateSuggestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: declineDuplicateSuggestion,
    onSuccess: (_, { taskId, otherTaskId }) => {
      // The pair is hidden from both tickets.
      for (const id of [taskId, otherTaskId])
        void queryClient.invalidateQueries({
          queryKey: ["duplicate-suggestions", id],
        });
    },
  });
}

export default useDeclineDuplicateSuggestion;
