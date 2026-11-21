import type { Insights } from "@/lib/insights/compute-insights";
import { segmentColor } from "./segment-color";

/** Issue count per slice, stacked by segment. */
export function InsightsBarChart({ insights }: { insights: Insights }) {
  const max = insights.maxValue || 1;

  return (
    <div className="flex h-44 items-end gap-1.5 border-border/80 border-b pb-px">
      {insights.slices.map((slice) => (
        <div
          key={slice.key}
          title={`${slice.name}: ${slice.value}`}
          className="flex min-w-0 flex-1 flex-col-reverse overflow-hidden rounded-t-sm"
          style={{ height: `${(slice.value / max) * 100}%` }}
        >
          {slice.counts.map((count, index) =>
            count ? (
              <div
                key={insights.segments[index]?.key ?? index}
                title={`${slice.name} · ${insights.segments[index]?.name}: ${count}`}
                style={{
                  height: `${(count / slice.value) * 100}%`,
                  background: segmentColor(index),
                }}
              />
            ) : null,
          )}
        </div>
      ))}
    </div>
  );
}
