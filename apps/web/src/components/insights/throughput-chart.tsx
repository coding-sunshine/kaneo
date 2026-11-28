import { useTranslation } from "react-i18next";
import type { ThroughputWeek } from "@/lib/insights/compute-throughput";
import { segmentColor } from "./segment-color";

const W = 320;
const H = 120;

/** Issues the team completed each week, with the four-week rolling median as a line. */
export function ThroughputChart({ weeks }: { weeks: ThroughputWeek[] }) {
  const { t, i18n } = useTranslation();
  const max = Math.max(1, ...weeks.map((week) => week.count));
  const slot = W / Math.max(1, weeks.length);
  const y = (value: number) => H - (value / max) * H;
  const label = (week: ThroughputWeek) =>
    new Intl.DateTimeFormat(i18n.language, {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
    }).format(week.start);

  return (
    <figure className="flex flex-col gap-1.5">
      <figcaption className="text-muted-foreground text-xs">
        {t("tasks:insights.report.throughput.title")}
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={t("tasks:insights.report.throughput.title")}
        className="h-28 w-full overflow-visible border-border/80 border-b"
        preserveAspectRatio="none"
      >
        {weeks.map((week, index) => (
          <rect
            key={week.key}
            data-throughput-week={week.key}
            x={index * slot + slot * 0.15}
            y={y(week.count)}
            width={slot * 0.7}
            height={H - y(week.count)}
            fill={segmentColor(0)}
            opacity={0.6}
          >
            <title>
              {t("tasks:insights.report.throughput.week", {
                week: label(week),
                count: week.count,
                median: week.rollingMedian,
              })}
            </title>
          </rect>
        ))}
        <polyline
          data-rolling-median
          fill="none"
          vectorEffect="non-scaling-stroke"
          stroke={segmentColor(1)}
          strokeWidth={2}
          points={weeks
            .map(
              (week, index) =>
                `${index * slot + slot / 2},${y(week.rollingMedian)}`,
            )
            .join(" ")}
        />
      </svg>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground text-xs">
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2 rounded-full"
            style={{ background: segmentColor(0) }}
          />
          {t("tasks:insights.report.throughput.completed")}
        </li>
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2 rounded-full"
            style={{ background: segmentColor(1) }}
          />
          {t("tasks:insights.report.throughput.rollingMedian")}
        </li>
      </ul>
    </figure>
  );
}
