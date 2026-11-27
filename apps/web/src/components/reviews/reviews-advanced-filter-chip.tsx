import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ReviewsAdvancedGroup } from "@/components/reviews/reviews-advanced-group";
import type { ReviewSubjectBinder } from "@/components/reviews/use-reviews-filter-subjects";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  countAdvancedConditions,
  type ReviewsAdvancedFilter,
} from "@/lib/reviews-advanced";
import type { ReviewFilterId } from "@/lib/reviews-filters";

/** Linear's Advanced filter: a chip that opens nested filter groups with independent and/or operators. */
export function ReviewsAdvancedFilterChip({
  filter,
  bindSubject,
  subjectIds,
  open,
  onOpenChange,
  onChange,
  onRemove,
}: {
  filter: ReviewsAdvancedFilter;
  bindSubject: ReviewSubjectBinder;
  subjectIds: readonly ReviewFilterId[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (next: ReviewsAdvancedFilter) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const count = countAdvancedConditions(filter);
  const triggerText =
    count > 0
      ? t("workspace:reviews.filters.advanced.conditions", { count })
      : t("workspace:reviews.filters.advanced.label");

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <div className="inline-flex h-7 items-stretch overflow-hidden rounded-md border border-border bg-background text-xs shadow-xs/5 *:border-border *:not-last:border-r dark:bg-input/32">
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label={
                count > 0
                  ? t("workspace:reviews.filters.advanced.triggerLabel", {
                      conditions: triggerText,
                    })
                  : undefined
              }
              className="px-2 outline-none hover:bg-accent focus-visible:bg-accent data-popup-open:bg-accent"
            />
          }
        >
          {triggerText}
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
        className="w-auto min-w-64 max-w-[42rem]"
      >
        <ReviewsAdvancedGroup
          group={filter}
          bindSubject={bindSubject}
          subjectIds={subjectIds}
          onChange={onChange}
        />
      </PopoverContent>
    </Popover>
  );
}
