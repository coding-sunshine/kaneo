import { useTranslation } from "react-i18next";
import type { AgingItem } from "@/lib/insights/compute-aging";

/** In-progress issues past their team's median cycle time. */
export function AgingTable({ items }: { items: AgingItem[] }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-1.5">
      <h4 className="text-muted-foreground text-xs">
        {t("tasks:insights.report.aging.title")}
      </h4>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          {t("tasks:insights.report.aging.empty")}
        </p>
      ) : (
        <table
          aria-label={t("tasks:insights.report.aging.title")}
          className="w-full text-[13px]"
        >
          <thead className="text-muted-foreground text-xs">
            <tr className="border-border/80 border-b">
              <th className="py-1.5 text-left font-normal">
                {t("tasks:insights.report.aging.issue")}
              </th>
              <th className="py-1.5 text-right font-normal">
                {t("tasks:insights.report.aging.age")}
              </th>
              <th className="py-1.5 text-right font-normal">
                {t("tasks:insights.report.aging.teamMedian")}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map(({ task, days, medianDays }) => (
              <tr key={task.id} className="border-border/60 border-b">
                <td className="max-w-0 truncate py-1.5">{task.title}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {t("tasks:insights.days", { count: days })}
                </td>
                <td className="py-1.5 text-right text-muted-foreground tabular-nums">
                  {t("tasks:insights.days", {
                    count: Math.round(medianDays * 10) / 10,
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
