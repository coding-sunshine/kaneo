import { useTranslation } from "react-i18next";
import { useReadyForReview } from "@/components/reviews/use-ready-for-review";
import { Button } from "@/components/ui/button";
import type { PullRef } from "@/fetchers/github-reviews/github-reviews";

export function ReadyForReviewButton({ pullRef }: { pullRef: PullRef }) {
  const { t } = useTranslation();
  const { markReady, pending } = useReadyForReview(pullRef);
  return (
    <Button size="sm" disabled={pending} onClick={markReady}>
      {t("workspace:reviews.detail.ready")}
    </Button>
  );
}
