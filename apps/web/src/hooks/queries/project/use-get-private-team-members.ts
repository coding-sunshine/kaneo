import { useQuery } from "@tanstack/react-query";
import getPrivateTeamMembers from "@/fetchers/project/get-private-team-members";

function useGetPrivateTeamMembers(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: ["private-team-members", workspaceId],
    queryFn: () => getPrivateTeamMembers(workspaceId),
    enabled: enabled && !!workspaceId,
    retry: false,
  });
}

export default useGetPrivateTeamMembers;
