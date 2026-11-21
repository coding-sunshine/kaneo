import { useQuery } from "@tanstack/react-query";
import getCycles from "@/fetchers/cycle/get-cycles";

export function useGetCycles(projectId: string) {
  return useQuery({
    enabled: Boolean(projectId),
    queryKey: ["cycles", projectId],
    queryFn: () => getCycles(projectId),
  });
}
