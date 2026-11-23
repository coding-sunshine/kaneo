import { useTranslation } from "react-i18next";
import type { PullRef } from "@/fetchers/github-reviews/github-reviews";
import { useMarkPullRequestReady } from "@/hooks/queries/github-reviews/use-github-reviews";
import { toast } from "@/lib/toast";

/** Takes a draft out of draft on GitHub and toasts the outcome. */
export function useReadyForReview(pullRef: PullRef) {
  const { t } = useTranslation();
  const mutation = useMarkPullRequestReady(pullRef);
  return {
    pending: mutation.isPending,
    markReady: () =>
      mutation.mutate(undefined, {
        onSuccess: () => toast.success(t("workspace:reviews.detail.readyDone")),
        onError: (error) => toast.error(error.message),
      }),
  };
}
