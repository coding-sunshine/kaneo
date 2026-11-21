import { useTranslation } from "react-i18next";
import type { Insights } from "@/lib/insights/compute-insights";
import { formatDuration } from "@/lib/insights/format-duration";
import { segmentColor } from "./segment-color";

/** The measured time per issue, one column per slice. */
export function InsightsScatter({ insights }: { insights: Insights }) {
  const { t } = useTranslation();
  const max = insights.maxDays || 1;

  return (
    <div className="flex h-44 gap-1.5 border-border/80 border-b">
      {insights.slices.map((slice) => (
        <div key={slice.key} className="relative min-w-0 flex-1">
          {slice.points.map((point, index) => (
            <span
              key={point.task.id}
              title={`${point.task.title} · ${formatDuration(t, point.days)}`}
              className="absolute size-1.5 -translate-x-1/2 translate-y-1/2 rounded-full"
              style={{
                // Spread points across the column so equal ages stay visible.
                left: `${15 + ((index * 37) % 70)}%`,
                bottom: `${(point.days / max) * 100}%`,
                background: segmentColor(point.segment),
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
