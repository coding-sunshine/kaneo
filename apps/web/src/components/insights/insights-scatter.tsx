import { Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type { Insights } from "@/lib/insights/compute-insights";
import { formatDuration } from "@/lib/insights/format-duration";
import { segmentColor } from "./segment-color";

type InsightsScatterProps = {
  insights: Insights;
  /** Team key for issues that carry none (single-team boards). */
  slug: string;
  segmented: boolean;
};

/**
 * The measured time per issue, one column per slice. Like Linear: hovering
 * shows the 25/50/75/95% markers, a marker zooms the y-axis to it, and a point
 * opens its issue.
 */
export function InsightsScatter({
  insights,
  slug,
  segmented,
}: InsightsScatterProps) {
  const { t } = useTranslation();
  const { workspaceId = "" } = useParams({ strict: false });
  const [zoom, setZoom] = useState<number | null>(null);
  const max = zoom ?? (insights.maxDays || 1);
  const height = (days: number) => `${(days / max) * 100}%`;

  return (
    <div className="group/scatter flex flex-col gap-1 border-border/80 border-b">
      <span className="text-[11px] text-muted-foreground tabular-nums">
        {formatDuration(t, max)}
      </span>
      <div className="relative flex h-40 gap-1.5">
        {insights.slices.map((slice) => (
          <div key={slice.key} className="relative min-w-0 flex-1">
            {slice.points
              .filter((point) => point.days <= max)
              .map((point, index) => {
                const id = `${point.task.teamSlug ?? slug}-${point.task.number}`;
                const where = segmented
                  ? `${slice.name} · ${insights.segments[point.segment]?.name}`
                  : slice.name;
                return (
                  <Link
                    key={point.task.id}
                    to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
                    params={{
                      workspaceId,
                      projectId: point.task.projectId,
                      taskId: point.task.id,
                    }}
                    // The table and list already reach every issue by keyboard.
                    tabIndex={-1}
                    aria-label={`${id} ${point.task.title}`}
                    title={`${id} ${point.task.title}\n${where} · ${formatDuration(t, point.days)}`}
                    className="absolute size-1.5 -translate-x-1/2 translate-y-1/2 rounded-full transition-transform hover:scale-150"
                    style={{
                      // Spread points across the column so equal times stay visible.
                      left: `${15 + ((index * 37) % 70)}%`,
                      bottom: height(point.days),
                      background: segmentColor(point.segment),
                    }}
                  />
                );
              })}
          </div>
        ))}
        {insights.percentiles
          .filter((marker) => marker.days <= max)
          .map((marker) => {
            const zoomed = zoom === marker.days;
            const duration = formatDuration(t, marker.days);
            return (
              <button
                key={marker.percent}
                type="button"
                aria-pressed={zoomed}
                aria-label={t("tasks:insights.percentile", {
                  percent: marker.percent,
                  duration,
                })}
                onClick={() => setZoom(zoomed ? null : marker.days)}
                className={cn(
                  // Only the label takes clicks, so points under the line stay reachable.
                  "pointer-events-none absolute inset-x-0 flex h-3 translate-y-1/2 items-center opacity-0 outline-none transition-opacity focus-visible:opacity-100 group-hover/scatter:opacity-100",
                  zoomed && "opacity-100",
                )}
                style={{ bottom: height(marker.days) }}
              >
                <span className="h-px flex-1 border-muted-foreground/60 border-t border-dashed" />
                <span className="pointer-events-auto cursor-pointer rounded bg-popover px-1 text-[10px] text-muted-foreground tabular-nums shadow-xs">
                  {marker.percent}% · {duration}
                </span>
              </button>
            );
          })}
      </div>
    </div>
  );
}
