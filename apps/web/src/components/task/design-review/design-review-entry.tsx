import { CircleCheck, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SlaChip } from "@/components/task-chips/sla-chip";
import { Button } from "@/components/ui/button";
import type { DesignReview } from "@/fetchers/design-review/get-design-reviews";
import useApproveDesignReview from "@/hooks/mutations/design-review/use-approve-design-review";
import useWithdrawDesignReview from "@/hooks/mutations/design-review/use-withdraw-design-review";
import { formatAge } from "@/lib/format-age";

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
  const { t, i18n } = useTranslation();
  const approve = useApproveDesignReview();
  const withdraw = useWithdrawDesignReview();
  const pending = review.status === "pending";
  const name = review.reviewerName ?? t("tasks:designReview.unknownReviewer");
  const age = formatAge(review.requestedAt, Date.now(), i18n.language);

  return (
    <div className="group flex h-8 min-w-0 items-center gap-2 px-2 text-[13px]">
      <span className="min-w-0 flex-1 truncate text-foreground">{name}</span>
      {pending ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 text-muted-foreground text-xs">
          <span
            title={t("tasks:designReview.waitingTitle", { age })}
            className="tabular-nums"
          >
            {age}
          </span>
          <SlaChip task={{ slaDueAt: review.slaDueAt, completedAt: null }} />
        </span>
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
      {canWithdraw && (
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
