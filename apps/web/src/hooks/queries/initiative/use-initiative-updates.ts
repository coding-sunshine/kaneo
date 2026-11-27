import { useQuery } from "@tanstack/react-query";
import { getInitiativeUpdates } from "@/fetchers/initiative/updates";
import { initiativeKeys } from "./initiative-keys";

export function useInitiativeUpdates(id: string) {
  return useQuery({
    queryKey: initiativeKeys.updates(id),
    queryFn: () => getInitiativeUpdates(id),
  });
}
