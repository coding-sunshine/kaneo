import { useQuery } from "@tanstack/react-query";
import { getInitiatives } from "@/fetchers/initiative/initiatives";
import { initiativeKeys } from "./initiative-keys";

export function useGetInitiatives(workspaceId: string) {
  return useQuery({
    queryKey: initiativeKeys.list(workspaceId),
    queryFn: () => getInitiatives(workspaceId),
  });
}
