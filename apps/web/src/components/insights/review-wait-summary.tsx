import { useTranslation } from "react-i18next";
import type { ReviewWait } from "@/lib/insights/compute-review-wait";

/** How long the team's issues in review have waited. */
export function ReviewWaitSummary({ wait }: { wait: ReviewWait }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-muted-foreground text-xs">
        {t("tasks:insights.report.reviewWait.title")}
      </h4>
      <p className="text-[13px]">
        {wait.count === 0
          ? t("tasks:insights.report.reviewWait.empty")
          : t("tasks:insights.report.reviewWait.summary", {
              count: wait.count,
              median: wait.medianDays,
              longest: wait.longestDays,
            })}
      </p>
    </div>
  );
}
