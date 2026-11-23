import { useQuery } from "@tanstack/react-query";
import { getWorkProjectComments } from "@/fetchers/work-project/comments";

export function useWorkProjectComments(id: string) {
  return useQuery({
    queryKey: ["work-project", id, "comments"],
    queryFn: () => getWorkProjectComments(id),
  });
}
