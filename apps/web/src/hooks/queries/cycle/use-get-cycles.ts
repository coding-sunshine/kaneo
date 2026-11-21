import { queryOptions, useQuery } from "@tanstack/react-query";
import getCycles from "@/fetchers/cycle/get-cycles";

export function cyclesQueryOptions(projectId: string) {
  return queryOptions({
    queryKey: ["cycles", projectId],
    queryFn: () => getCycles(projectId),
  });
}

export function useGetCycles(projectId: string) {
  return useQuery({
    ...cyclesQueryOptions(projectId),
    enabled: Boolean(projectId),
  });
}
