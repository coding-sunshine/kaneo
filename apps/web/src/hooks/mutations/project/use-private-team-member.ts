import { useMutation, useQueryClient } from "@tanstack/react-query";
import addPrivateTeamMember from "@/fetchers/project/add-private-team-member";
import removePrivateTeamMember from "@/fetchers/project/remove-private-team-member";

type Members = { projectId: string; userIds: string[] };

function usePrivateTeamMemberMutation(
  workspaceId: string,
  mutationFn: typeof addPrivateTeamMember,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      queryClient.setQueryData<Members[]>(
        ["private-team-members", workspaceId],
        (current) => [
          ...(current ?? []).filter((m) => m.projectId !== data.projectId),
          data,
        ],
      );
      void queryClient.invalidateQueries({
        queryKey: ["private-team-members", workspaceId],
      });
    },
  });
}

export function useAddPrivateTeamMember(workspaceId: string) {
  return usePrivateTeamMemberMutation(workspaceId, addPrivateTeamMember);
}

export function useRemovePrivateTeamMember(workspaceId: string) {
  return usePrivateTeamMemberMutation(workspaceId, removePrivateTeamMember);
}
