import { Plus, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActiveFilterChip } from "@/components/project/task-filters/active-filter-chip";
import { FilterRootPanel } from "@/components/project/task-filters/filter-root-panel";
import type { FilterSubject } from "@/components/project/task-filters/filter-subject";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ReviewsAdvancedFilter } from "@/lib/reviews-filters";

type Operator = ReviewsAdvancedFilter["operator"];

/** Linear's Advanced filter: a chip that opens its conditions, joined by one and/or operator. */
export function ReviewsAdvancedFilterChip({
  operator,
  subjects,
  open,
  onOpenChange,
  onOperatorChange,
  onRemove,
}: {
  operator: Operator;
  /** The filter subjects bound to the advanced filter's own conditions. */
  subjects: FilterSubject[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOperatorChange: (operator: Operator) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const conditions = subjects.filter((subject) => subject.selected.length > 0);
  const operatorLabel =
    operator === "and"
      ? t("workspace:reviews.filters.advanced.and")
      : t("workspace:reviews.filters.advanced.or");
  const operatorToggle = (
    <button
      type="button"
      aria-label={t("workspace:reviews.filters.advanced.toggleOperator", {
        operator: operatorLabel,
      })}
      onClick={() => onOperatorChange(operator === "and" ? "or" : "and")}
      className="h-7 w-9 shrink-0 rounded-md text-muted-foreground text-xs outline-none hover:bg-accent hover:text-foreground focus-visible:bg-accent"
    >
      {operatorLabel}
    </button>
  );

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <div className="inline-flex h-7 items-stretch overflow-hidden rounded-md border border-border bg-background text-xs shadow-xs/5 *:border-border *:not-last:border-r dark:bg-input/32">
        <PopoverTrigger
          render={
            <button
              type="button"
              className="px-2 outline-none hover:bg-accent focus-visible:bg-accent data-popup-open:bg-accent"
            />
          }
        >
          {conditions.length > 0
            ? t("workspace:reviews.filters.advanced.conditions", {
                count: conditions.length,
              })
            : t("workspace:reviews.filters.advanced.label")}
        </PopoverTrigger>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("workspace:reviews.filters.advanced.remove")}
          className="inline-flex w-7 shrink-0 items-center justify-center text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:bg-accent"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <PopoverContent
        align="start"
        aria-label={t("workspace:reviews.filters.advanced.label")}
        className="w-auto min-w-64 max-w-[28rem]"
      >
        <ul className="flex flex-col gap-1.5">
          {conditions.map((subject, index) => (
            <li key={subject.id} className="flex items-center gap-1.5">
              {index > 0 && operatorToggle}
              <ActiveFilterChip subject={subject} />
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            {conditions.length > 0 && operatorToggle}
            <Popover open={adding} onOpenChange={setAdding}>
              <PopoverTrigger
                render={<Button variant="outline" size="xs" className="h-7" />}
              >
                <Plus />
                {t("workspace:reviews.filters.advanced.addFilter")}
              </PopoverTrigger>
              <PopoverContent align="start" className="w-60">
                <FilterRootPanel
                  subjects={subjects}
                  onApplied={() => setAdding(false)}
                />
              </PopoverContent>
            </Popover>
          </li>
        </ul>
      </PopoverContent>
    </Popover>
  );
}
