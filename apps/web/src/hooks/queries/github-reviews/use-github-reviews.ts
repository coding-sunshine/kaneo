import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  disconnectReviews,
  getReviewsList,
  getReviewsStatus,
} from "@/fetchers/github-reviews/github-reviews";

export function useReviewsStatus() {
  return useQuery({
    queryKey: ["github-reviews", "status"],
    queryFn: getReviewsStatus,
  });
}

export function useReviewsList(
  options: { includeDrafts: boolean; includeClosed: boolean },
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["github-reviews", "list", options],
    queryFn: () => getReviewsList(options),
    enabled,
  });
}

export function useDisconnectReviews() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: disconnectReviews,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["github-reviews"] }),
  });
}
