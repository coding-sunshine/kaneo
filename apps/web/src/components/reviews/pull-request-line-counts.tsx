import { useState } from "react";
import { useTranslation } from "react-i18next";
import { lineCounts } from "@/components/reviews/line-counts";
import type { PullRef } from "@/fetchers/github-reviews/github-reviews";
import { usePullRequestFiles } from "@/hooks/queries/github-reviews/use-github-reviews";
import { useFileCategories } from "@/hooks/use-file-categories";

/** Header +/- like Linear: implementation lines, with [*] for the total and "Generated only". */
export function PullRequestLineCounts({
  pullRef,
  headSha,
  additions,
  deletions,
}: {
  pullRef: PullRef;
  headSha: string;
  additions: number;
  deletions: number;
}) {
  const { t } = useTranslation();
  const files = usePullRequestFiles(pullRef, true);
  const categoryOf = useFileCategories(pullRef, headSha);
  const [showTotal, setShowTotal] = useState(false);
  const counts = files.data ? lineCounts(files.data, categoryOf) : null;
  const total = counts?.total ?? { additions, deletions };
  const shown = showTotal || !counts ? total : counts.implementation;
  const totalText = `+${total.additions} -${total.deletions}`;
  return (
    <>
      {counts?.generatedOnly && !showTotal ? (
        <button
          type="button"
          aria-label={t(
            "workspace:reviews.diffOptions2.counts.generatedOnlyLabel",
          )}
          onClick={() => setShowTotal(true)}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          {t("workspace:reviews.diffOptions2.counts.generatedOnly")}
        </button>
      ) : (
        <>
          <span className="shrink-0 text-success-foreground tabular-nums">
            +{shown.additions}
          </span>
          <span className="shrink-0 text-destructive-foreground tabular-nums">
            -{shown.deletions}
          </span>
          {counts?.differs && !showTotal && (
            <span
              title={t("workspace:reviews.diffOptions2.counts.total", {
                total: totalText,
              })}
              className="shrink-0 cursor-help text-muted-foreground"
            >
              [*]
            </span>
          )}
        </>
      )}
    </>
  );
}
