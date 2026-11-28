import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { computeAging } from "@/lib/insights/compute-aging";
import { computeReviewWait } from "@/lib/insights/compute-review-wait";
import { computeThroughput } from "@/lib/insights/compute-throughput";
import type { ProjectWithTasks } from "@/types/project";
import { AgingTable } from "./aging-table";
import { ReviewWaitSummary } from "./review-wait-summary";
import { ThroughputChart } from "./throughput-chart";

const THROUGHPUT_WEEKS = 12;

/** Team-level report: aging work, weekly throughput and review wait. Nothing is split by person. */
export function ReportPack({
  project,
  now: fixedNow,
}: {
  project: ProjectWithTasks;
  now?: number;
}) {
  const { t } = useTranslation();
  // Read the clock once, so hover re-renders keep the memoised results.
  const [mountedAt] = useState(() => Date.now());
  const now = fixedNow ?? mountedAt;
  const aging = useMemo(() => computeAging(project, now), [project, now]);
  const weeks = useMemo(
    () => computeThroughput(project, THROUGHPUT_WEEKS, now),
    [project, now],
  );
  const reviewWait = useMemo(
    () => computeReviewWait(project, now),
    [project, now],
  );

  return (
    <section
      aria-label={t("tasks:insights.report.title")}
      className="flex flex-col gap-4 border-border/80 border-t pt-4"
    >
      <h3 className="font-medium text-[13px]">
        {t("tasks:insights.report.title")}
      </h3>
      <AgingTable items={aging} />
      <ThroughputChart weeks={weeks} />
      <ReviewWaitSummary wait={reviewWait} />
    </section>
  );
}
