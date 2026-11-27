import { useTranslation } from "react-i18next";
import { SlaChip } from "@/components/task-chips/sla-chip";
import { formatAge } from "@/lib/format-age";
import { getReviewSlaStatus } from "@/lib/review-sla-status";

/** How long a design review has waited, with its SLA risk once it nears due. */
export function ReviewAgeChip({
  requestedAt,
  slaDueAt,
  showLabel = false,
}: {
  requestedAt: string;
  slaDueAt: string | null;
  showLabel?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const age = formatAge(requestedAt, Date.now(), i18n.language);
  const status = getReviewSlaStatus(slaDueAt);
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-muted-foreground text-xs">
      <span
        title={t("tasks:designReview.waitingTitle", { age })}
        className="tabular-nums"
      >
        {age}
      </span>
      {status && slaDueAt && (
        <SlaChip
          task={{ slaDueAt, completedAt: null }}
          status={status}
          showLabel={showLabel}
        />
      )}
    </span>
  );
}
