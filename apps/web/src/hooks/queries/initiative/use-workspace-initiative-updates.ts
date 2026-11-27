import { useQuery } from "@tanstack/react-query";
import { getWorkspaceInitiativeUpdates } from "@/fetchers/initiative/updates";
import { initiativeKeys } from "./initiative-keys";

export function useWorkspaceInitiativeUpdates(workspaceId: string) {
  return useQuery({
    queryKey: initiativeKeys.pulse(workspaceId),
    queryFn: () => getWorkspaceInitiativeUpdates(workspaceId),
  });
}
