import { useQuery } from "@tanstack/react-query";
import { getInitiative } from "@/fetchers/initiative/initiatives";
import { initiativeKeys } from "./initiative-keys";

export function useGetInitiative(id: string) {
  return useQuery({
    enabled: Boolean(id),
    queryKey: initiativeKeys.detail(id),
    queryFn: () => getInitiative(id),
  });
}
