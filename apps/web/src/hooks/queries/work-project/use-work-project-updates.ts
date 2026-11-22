import { useQuery } from "@tanstack/react-query";
import { getWorkProjectUpdates } from "@/fetchers/work-project/updates";

export function useWorkProjectUpdates(id: string) {
  return useQuery({
    queryKey: ["work-project", id, "updates"],
    queryFn: () => getWorkProjectUpdates(id),
  });
}
