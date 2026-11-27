import { useQuery } from "@tanstack/react-query";
import getDoneTasks from "@/fetchers/task/get-done-tasks";

function useGetDoneTasks(workspaceId: string, since: string) {
  return useQuery({
    queryKey: ["done-tasks", workspaceId, since],
    queryFn: () => getDoneTasks(workspaceId, since),
    // Same freshness as the other Home lists: tasks finish on other pages.
    refetchOnMount: "always",
    refetchInterval: 30_000,
    refetchOnWindowFocus: "always",
  });
}

export default useGetDoneTasks;
