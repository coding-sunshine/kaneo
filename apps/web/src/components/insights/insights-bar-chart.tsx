import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type { Insights } from "@/lib/insights/compute-insights";
import { formatDuration } from "@/lib/insights/format-duration";
import type { InsightSelection } from "@/lib/insights/insight-selection";
import { segmentColor } from "./segment-color";

type InsightsBarChartProps = {
  insights: Insights;
  segmented: boolean;
  selection: InsightSelection | null;
  hovered: string | null;
  onHover: (sliceKey: string | null) => void;
  onSelect: (next: InsightSelection) => void;
};

/**
 * Issue count per slice, stacked by segment. Hovering a bar shows its numbers
 * and issue-age percentiles; clicking a bar segment selects those issues.
 */
export function InsightsBarChart({
  insights,
  segmented,
  selection,
  hovered,
  onHover,
  onSelect,
}: InsightsBarChartProps) {
  const { t } = useTranslation();
  const max = insights.maxValue || 1;
  const picked = (sliceKey: string, index: number) =>
    !selection ||
    ((selection.slice === undefined || selection.slice === sliceKey) &&
      (selection.segment === undefined || selection.segment === index));

  return (
    <div className="flex h-44 items-end gap-1.5 border-border/80 border-b pb-px">
      {insights.slices.map((slice, sliceIndex) => (
        <div
          key={slice.key}
          role="group"
          aria-label={`${slice.name}: ${slice.value}`}
          onMouseEnter={() => onHover(slice.key)}
          onMouseLeave={() => onHover(null)}
          className={cn(
            "group/bar relative min-w-0 flex-1 transition-opacity",
            hovered && hovered !== slice.key && "opacity-50",
          )}
          style={{ height: `${(slice.value / max) * 100}%` }}
        >
          <div className="flex h-full flex-col-reverse overflow-hidden rounded-t-sm">
            {slice.counts.map((count, index) =>
              count ? (
                <button
                  type="button"
                  key={insights.segments[index]?.key ?? index}
                  aria-pressed={
                    !!selection &&
                    picked(slice.key, index) &&
                    (selection.slice === slice.key ||
                      selection.segment === index)
                  }
                  aria-label={
                    segmented
                      ? `${slice.name} · ${insights.segments[index]?.name}: ${count}`
                      : `${slice.name}: ${count}`
                  }
                  onFocus={() => onHover(slice.key)}
                  onBlur={() => onHover(null)}
                  onClick={() =>
                    onSelect({
                      slice: slice.key,
                      segment: segmented ? index : undefined,
                    })
                  }
                  className={cn(
                    "block w-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                    !picked(slice.key, index) && "opacity-30",
                  )}
                  style={{
                    height: `${(count / slice.value) * 100}%`,
                    background: segmentColor(index),
                  }}
                />
              ) : null,
            )}
          </div>
          <div
            role="tooltip"
            className={cn(
              "pointer-events-none absolute bottom-full z-10 mb-1 hidden w-48 flex-col gap-1 rounded-md border border-border bg-popover p-2 text-popover-foreground text-xs shadow-md group-focus-within/bar:flex group-hover/bar:flex",
              sliceIndex < insights.slices.length / 2 ? "left-0" : "right-0",
            )}
          >
            <div className="flex justify-between gap-2 font-medium">
              <span className="truncate">{slice.name}</span>
              <span className="tabular-nums">{slice.value}</span>
            </div>
            {segmented &&
              slice.counts.map((count, index) =>
                count ? (
                  <div
                    key={insights.segments[index]?.key ?? index}
                    className="flex items-center gap-1.5 text-muted-foreground"
                  >
                    <span
                      aria-hidden="true"
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: segmentColor(index) }}
                    />
                    <span className="flex-1 truncate">
                      {insights.segments[index]?.name}
                    </span>
                    <span className="tabular-nums">{count}</span>
                  </div>
                ) : null,
              )}
            <div className="mt-0.5 border-border/60 border-t pt-1 text-muted-foreground">
              <div>{t("tasks:insights.ageBreakdown")}</div>
              {slice.percentiles.map((marker) => (
                <div key={marker.percent} className="flex justify-between">
                  <span>{marker.percent}%</span>
                  <span className="tabular-nums">
                    {formatDuration(t, marker.days)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
