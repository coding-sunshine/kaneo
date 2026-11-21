import { useTranslation } from "react-i18next";
import type { InsightMeasure, Insights } from "@/lib/insights/compute-insights";

type InsightsTableProps = {
  insights: Insights;
  measure: InsightMeasure;
  sliceLabel: string;
};

/** The numbers behind the chart, one row per slice. */
export function InsightsTable({
  insights,
  measure,
  sliceLabel,
}: InsightsTableProps) {
  const { t } = useTranslation();
  const total = insights.slices.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <table className="w-full text-[13px]">
      <thead className="text-muted-foreground text-xs">
        <tr className="border-border/80 border-b">
          <th className="py-1.5 text-left font-normal">{sliceLabel}</th>
          <th className="py-1.5 text-right font-normal">
            {t("tasks:insights.issues")}
          </th>
          <th className="py-1.5 text-right font-normal">
            {measure === "count"
              ? t("tasks:insights.share")
              : t("tasks:insights.medianAge")}
          </th>
        </tr>
      </thead>
      <tbody>
        {insights.slices.map((slice) => (
          <tr key={slice.key} className="border-border/60 border-b">
            <td className="max-w-0 truncate py-1.5 pr-2">{slice.name}</td>
            <td className="py-1.5 text-right tabular-nums">{slice.value}</td>
            <td className="py-1.5 text-right text-muted-foreground tabular-nums">
              {measure === "count"
                ? `${Math.round((slice.value / (total || 1)) * 100)}%`
                : t("tasks:insights.days", {
                    count: Math.round(slice.medianAge),
                  })}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
