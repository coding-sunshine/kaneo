import { useQuery } from "@tanstack/react-query";
import getWorkProject from "@/fetchers/work-project/get-work-project";

export function useGetWorkProject(id: string) {
  return useQuery({
    enabled: Boolean(id),
    queryKey: ["work-project", id],
    queryFn: () => getWorkProject(id),
  });
}
