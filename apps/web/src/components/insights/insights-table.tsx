import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type { InsightMeasure, Insights } from "@/lib/insights/compute-insights";
import { formatDuration } from "@/lib/insights/format-duration";
import type { InsightSelection } from "@/lib/insights/insight-selection";
import { segmentColor } from "./segment-color";

type InsightsTableProps = {
  insights: Insights;
  measure: InsightMeasure;
  sliceLabel: string;
  segmented: boolean;
  selection: InsightSelection | null;
  hovered: string | null;
  onHover: (sliceKey: string | null) => void;
  onSelect: (next: InsightSelection) => void;
};

const pick =
  "w-full cursor-pointer rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * The numbers behind the chart, one row per slice. A row, a segment column or
 * a cell selects those issues; the row under the pointer lights up its points.
 */
export function InsightsTable({
  insights,
  measure,
  sliceLabel,
  segmented,
  selection,
  hovered,
  onHover,
  onSelect,
}: InsightsTableProps) {
  const { t } = useTranslation();
  const total = insights.slices.reduce((sum, slice) => sum + slice.value, 0);
  const isPicked = (next: InsightSelection) =>
    selection?.slice === next.slice && selection?.segment === next.segment;

  return (
    <table className="w-full text-[13px]">
      <thead className="text-muted-foreground text-xs">
        <tr className="border-border/80 border-b">
          <th className="py-1.5 text-left font-normal">{sliceLabel}</th>
          {segmented &&
            insights.segments.map((item, index) => (
              <th
                key={item.key}
                className="max-w-14 py-1.5 text-right font-normal"
              >
                <button
                  type="button"
                  aria-pressed={isPicked({ segment: index })}
                  title={item.name}
                  onClick={() => onSelect({ segment: index })}
                  className={cn(
                    pick,
                    "flex items-center justify-end gap-1 truncate",
                    isPicked({ segment: index }) && "text-foreground",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: segmentColor(index) }}
                  />
                  <span className="truncate">{item.name}</span>
                </button>
              </th>
            ))}
          <th className="py-1.5 text-right font-normal">
            {measure === "effort"
              ? t("tasks:insights.measures.effort")
              : t("tasks:insights.issues")}
          </th>
          <th className="py-1.5 text-right font-normal">
            {measure === "count" || measure === "effort"
              ? t("tasks:insights.share")
              : t("tasks:insights.median")}
          </th>
        </tr>
      </thead>
      <tbody>
        {insights.slices.map((slice) => (
          <tr
            key={slice.key}
            onMouseEnter={() => onHover(slice.key)}
            onMouseLeave={() => onHover(null)}
            className={cn(
              "border-border/60 border-b",
              (hovered === slice.key || isPicked({ slice: slice.key })) &&
                "bg-accent",
            )}
          >
            <td className="max-w-0 py-1.5 pr-2">
              <button
                type="button"
                aria-pressed={isPicked({ slice: slice.key })}
                onClick={() => onSelect({ slice: slice.key })}
                className={cn(pick, "truncate text-left")}
              >
                {slice.name}
              </button>
            </td>
            {segmented &&
              slice.counts.map((count, index) => (
                <td
                  key={insights.segments[index]?.key ?? index}
                  className="py-1.5 text-right tabular-nums"
                >
                  <button
                    type="button"
                    aria-pressed={isPicked({
                      slice: slice.key,
                      segment: index,
                    })}
                    disabled={count === 0}
                    onClick={() =>
                      onSelect({ slice: slice.key, segment: index })
                    }
                    className={cn(
                      pick,
                      "text-right disabled:cursor-default disabled:text-muted-foreground/50",
                      isPicked({ slice: slice.key, segment: index }) &&
                        "font-medium",
                    )}
                  >
                    {count}
                  </button>
                </td>
              ))}
            <td className="py-1.5 text-right tabular-nums">{slice.value}</td>
            <td className="py-1.5 text-right text-muted-foreground tabular-nums">
              {measure === "count" || measure === "effort"
                ? `${Math.round((slice.value / (total || 1)) * 100)}%`
                : formatDuration(t, slice.medianDays)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
