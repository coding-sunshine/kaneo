import { useTranslation } from "react-i18next";
import type {
  BurnUpBucket,
  BurnUpInterval,
} from "@/lib/insights/compute-burn-up";
import { segmentColor } from "./segment-color";

const SERIES = ["created", "started", "completed"] as const;
const W = 320;
const H = 160;

/** Linear's burn-up: cumulative issues created, started and completed over time. */
export function InsightsBurnUp({
  buckets,
  interval,
}: {
  buckets: BurnUpBucket[];
  interval: BurnUpInterval;
}) {
  const { t, i18n } = useTranslation();
  const max = Math.max(1, ...buckets.map((bucket) => bucket.created));
  const x = (index: number) =>
    buckets.length < 2 ? W / 2 : (index / (buckets.length - 1)) * W;
  const y = (value: number) => H - (value / max) * H;
  const period = (bucket: BurnUpBucket) =>
    new Intl.DateTimeFormat(i18n.language, {
      timeZone: "UTC",
      month: "short",
      ...(interval === "month" ? { year: "2-digit" } : { day: "numeric" }),
    }).format(bucket.start);

  return (
    <>
      <figure
        aria-label={t("tasks:insights.burnUp")}
        className="flex flex-col gap-2"
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={t("tasks:insights.burnUp")}
          className="h-40 w-full overflow-visible border-border/80 border-b"
          preserveAspectRatio="none"
        >
          {SERIES.map((name, index) => (
            <polyline
              key={name}
              fill="none"
              vectorEffect="non-scaling-stroke"
              stroke={segmentColor(index)}
              strokeWidth={2}
              points={buckets
                .map((bucket, i) => `${x(i)},${y(bucket[name])}`)
                .join(" ")}
            />
          ))}
        </svg>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground text-xs">
          {SERIES.map((name, index) => (
            <li key={name} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2 rounded-full"
                style={{ background: segmentColor(index) }}
              />
              {t(`tasks:insights.burnUpSeries.${name}`)}
            </li>
          ))}
        </ul>
      </figure>
      <table className="w-full text-[13px]">
        <thead className="text-muted-foreground text-xs">
          <tr className="border-border/80 border-b">
            <th className="py-1.5 text-left font-normal">
              {t(`tasks:insights.intervals.${interval}`)}
            </th>
            {SERIES.map((name) => (
              <th key={name} className="py-1.5 text-right font-normal">
                {t(`tasks:insights.burnUpSeries.${name}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...buckets].reverse().map((bucket) => (
            <tr key={bucket.key} className="border-border/60 border-b">
              <td className="py-1.5">{period(bucket)}</td>
              {SERIES.map((name) => (
                <td key={name} className="py-1.5 text-right tabular-nums">
                  {bucket[name]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
