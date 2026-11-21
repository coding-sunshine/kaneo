import { useMutation, useQueryClient } from "@tanstack/react-query";
import type getProjects from "@/fetchers/project/get-projects";
import updateTeamMembership, {
  type TeamMembershipChanges,
} from "@/fetchers/project/update-team-membership";

type ProjectList = NonNullable<Awaited<ReturnType<typeof getProjects>>>;
type Variables = TeamMembershipChanges & { projectId: string };

/** The caller's own join/leave and Subscribe toggles. */
function useUpdateTeamMembership(workspaceId: string) {
  const queryClient = useQueryClient();
  const queryKey = ["projects", workspaceId];

  return useMutation({
    mutationFn: ({ projectId, ...changes }: Variables) =>
      updateTeamMembership(projectId, changes),
    // The checkbox and the sidebar move on click, not a round trip later.
    onMutate: async ({ projectId, ...changes }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ProjectList>(queryKey);
      queryClient.setQueryData<ProjectList>(queryKey, (projects) =>
        projects?.map((project) =>
          project.id === projectId
            ? { ...project, membership: { ...project.membership, ...changes } }
            : project,
        ),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous)
        queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: (_data, _error, { projectId }) => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({
        queryKey: ["workspace-users", workspaceId, "project", projectId],
      });
    },
  });
}

export default useUpdateTeamMembership;
