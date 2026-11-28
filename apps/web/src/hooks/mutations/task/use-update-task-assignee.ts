import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { invalidateMyWork } from "@/lib/invalidate-my-work";
import updateTaskAssignee from "@/fetchers/task/update-task-assignee";
import { warnOutOfOffice } from "@/lib/people/warn-out-of-office";
import type { OutOfOffice } from "@/lib/people/profile-types";
import { isPerTaskRelationQuery } from "@/lib/relation-query-keys";
import {
  applyOptimisticBoardPatch,
  rollbackOptimisticBoardPatch,
} from "@/lib/optimistic-board-task";
import type Task from "@/types/task";

type CachedMember = {
  id: string;
  name?: string | null;
  image?: string | null;
  profile?: { outOfOffice: OutOfOffice | null };
};

function findCachedMember(queryClient: QueryClient, userId: string | null) {
  return queryClient
    .getQueriesData<CachedMember[]>({ queryKey: ["workspace-users"] })
    .flatMap(([, members]) => (Array.isArray(members) ? members : []))
    .find((member) => member.id === userId);
}

export function useUpdateTaskAssignee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (task: Task) => updateTaskAssignee(task.id, task),
    onMutate: (task: Task) => {
      const member = findCachedMember(queryClient, task.userId);
      return applyOptimisticBoardPatch(queryClient, task, {
        userId: task.userId,
        assigneeName: member?.name ?? null,
        assigneeImage: member?.image ?? null,
      });
    },
    onError: (_error, _task, context) =>
      rollbackOptimisticBoardPatch(queryClient, context),
    onSuccess: (_, variables) => {
      const assignee = findCachedMember(queryClient, variables.userId);
      if (assignee) warnOutOfOffice(assignee, variables.dueDate);
      invalidateMyWork(queryClient);
      queryClient.invalidateQueries({
        queryKey: ["task", variables.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["tasks", variables.projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["notifications"],
      });
      queryClient.invalidateQueries({
        queryKey: ["projects"],
      });
      queryClient.invalidateQueries({
        queryKey: ["activities", variables.id],
      });
      // Per-task relation responses embed the linked tasks' status and
      // assignee, so they stale here; the project-scoped query returns edges
      // alone and does not.
      queryClient.invalidateQueries({ predicate: isPerTaskRelationQuery });
    },
  });
}
