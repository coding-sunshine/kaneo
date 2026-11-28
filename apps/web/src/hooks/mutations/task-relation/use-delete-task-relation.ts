import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteTaskRelation from "@/fetchers/task-relation/delete-task-relation";

import { invalidateMyWork } from "@/lib/invalidate-my-work";
import { invalidateRelationTaskProject } from "./invalidate-relation-task-project";

function useDeleteTaskRelation(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTaskRelation,
    onSuccess: (deleted) => {
      void invalidateRelationTaskProject(queryClient, deleted.sourceTaskId);
      // Up next moves blocked work down, so a blocker changes its order.
      invalidateMyWork(queryClient);
      // Both ends go stale, and only one of them is the task this hook was
      // opened for. Queries default to refetchOnMount: false, so a closed but
      // cached end must refetch now or reopening it still lists the relation.
      const endpoints = new Set([
        taskId,
        deleted.sourceTaskId,
        deleted.targetTaskId,
      ]);
      for (const endpoint of endpoints) {
        queryClient.invalidateQueries({
          queryKey: ["task-relations", endpoint],
          refetchType: "all",
        });
      }
      // The project-scoped query the list view reads is keyed by neither, and
      // the prefix covers every project a mounted view holds.
      queryClient.invalidateQueries({
        queryKey: ["task-relations", "project"],
      });
    },
  });
}

export default useDeleteTaskRelation;
