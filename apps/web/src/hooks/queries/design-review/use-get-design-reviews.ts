import { useQuery } from "@tanstack/react-query";
import getDesignReviews from "@/fetchers/design-review/get-design-reviews";

export default function useGetDesignReviews(taskId: string) {
  return useQuery({
    queryKey: ["design-reviews", taskId],
    queryFn: () => getDesignReviews(taskId),
    enabled: Boolean(taskId),
  });
}
