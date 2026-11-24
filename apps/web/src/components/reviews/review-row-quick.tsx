import { Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useReviewsStatus } from "@/hooks/queries/github-reviews/use-github-reviews";
import { isQuickToReview } from "@/lib/reviews-quick";
import type { ReviewItem } from "@/lib/reviews-view";

export function ReviewRowQuick({ pr }: { pr: ReviewItem }) {
  const { t } = useTranslation();
  const me = useReviewsStatus().data?.login ?? null;
  if (!isQuickToReview(pr, me)) return null;
  const label = t("workspace:reviews.chips.quick");
  return (
    <span
      title={t("workspace:reviews.filters.subject.quickToReview")}
      className="inline-flex shrink-0 items-center gap-1 text-muted-foreground text-xs"
    >
      <Zap aria-hidden className="size-3.5" />
      {label}
    </span>
  );
}
