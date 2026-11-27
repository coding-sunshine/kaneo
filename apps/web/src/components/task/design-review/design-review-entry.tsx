import { CircleCheck, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ReviewAgeChip } from "@/components/task-chips/review-age-chip";
import { Button } from "@/components/ui/button";
import type { DesignReview } from "@/fetchers/design-review/get-design-reviews";
import useApproveDesignReview from "@/hooks/mutations/design-review/use-approve-design-review";
import useWithdrawDesignReview from "@/hooks/mutations/design-review/use-withdraw-design-review";

type DesignReviewEntryProps = {
  review: DesignReview;
  isMine: boolean;
  canWithdraw: boolean;
};

export function DesignReviewEntry({
  review,
  isMine,
  canWithdraw,
}: DesignReviewEntryProps) {
  const { t } = useTranslation();
  const approve = useApproveDesignReview();
  const withdraw = useWithdrawDesignReview();
  const pending = review.status === "pending";
  const name = review.reviewerName ?? t("tasks:designReview.unknownReviewer");

  return (
    <div className="group flex h-8 min-w-0 items-center gap-2 px-2 text-[13px]">
      <span className="min-w-0 flex-1 truncate text-foreground">{name}</span>
      {pending ? (
        <ReviewAgeChip
          requestedAt={review.requestedAt}
          slaDueAt={review.slaDueAt}
        />
      ) : (
        <span className="inline-flex shrink-0 items-center gap-1 text-muted-foreground text-xs">
          <CircleCheck className="size-3.5 text-green-600" />
          {t("tasks:designReview.approved")}
        </span>
      )}
      {pending && isMine && (
        <Button
          size="xs"
          variant="outline"
          disabled={approve.isPending}
          onClick={() => approve.mutate({ taskId: review.taskId })}
        >
          {t("tasks:designReview.approve")}
        </Button>
      )}
      {pending && canWithdraw && (
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={t("tasks:designReview.withdraw", { name })}
          title={t("tasks:designReview.withdraw", { name })}
          disabled={withdraw.isPending}
          onClick={() =>
            withdraw.mutate({
              taskId: review.taskId,
              reviewerId: review.reviewerId,
            })
          }
        >
          <X />
        </Button>
      )}
    </div>
  );
}
