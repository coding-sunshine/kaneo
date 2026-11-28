import { useQuery } from "@tanstack/react-query";
import getWorkspaceMembers from "@/fetchers/workspace-user/get-workspace-members";

function useGetWorkspaceMembers(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["workspace-users", workspaceId, "members"],
    queryFn: () => getWorkspaceMembers(workspaceId ?? ""),
    enabled: !!workspaceId,
  });
}

export default useGetWorkspaceMembers;
