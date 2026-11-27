import { useTranslation } from "react-i18next";
import type { Cycle } from "@/fetchers/cycle/get-cycles";

type Props = { summary: NonNullable<Cycle["summary"]> };

/** Team totals of a completed cycle: plain counts, nobody singled out. */
export function CycleSummary({ summary }: Props) {
  const { t } = useTranslation();
  const items = [
    ["workspace:cycles.summary.completed", summary.completed],
    ["workspace:cycles.summary.addedAfterStart", summary.addedAfterStart],
    ["workspace:cycles.summary.carriedOver", summary.carriedOver],
  ] as const;

  return (
    <section
      aria-labelledby="cycle-summary-title"
      className="flex flex-wrap items-center gap-x-6 gap-y-2 border-border/80 border-b px-4 py-3"
    >
      <h2 id="cycle-summary-title" className="font-medium text-[13px]">
        {t("workspace:cycles.summary.title")}
      </h2>
      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
        {items.map(([label, value]) => (
          <div key={label} className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground">{t(label)}</dt>
            <dd className="font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
