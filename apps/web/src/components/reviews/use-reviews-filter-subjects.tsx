import { GitMerge, TriangleAlert, UserCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FilterSubject } from "@/components/project/task-filters/filter-subject";
import { operatorLabels } from "@/components/project/task-filters/operator-labels";
import {
  approverLogins,
  clearFilter,
  MERGE_STATUSES,
  type ReviewFilterId,
  type ReviewsFilters,
  setFilterNegated,
  toggleFilterValue,
} from "@/lib/reviews-filters";
import type { ReviewItem } from "@/lib/reviews-view";

/** The Reviews filter menu's entries, in the shape the shared filter menu and chips read. */
export function useReviewsFilterSubjects(
  items: ReviewItem[],
  filters: ReviewsFilters,
  onChange: (filters: ReviewsFilters) => void,
): FilterSubject[] {
  const { t } = useTranslation();
  const subject = (
    id: ReviewFilterId,
    icon: FilterSubject["icon"],
    options: FilterSubject["options"],
    emptyLabel = "",
  ): FilterSubject => {
    const selected = filters[id]?.values ?? [];
    return {
      id,
      kind: "core",
      label: t(`workspace:reviews.filter.${id}`),
      icon,
      operators: operatorLabels("is", selected.length, t),
      options,
      selected,
      negated: filters[id]?.negated ?? false,
      onToggle: (value) => onChange(toggleFilterValue(filters, id, value)),
      onNegate: (negated) => onChange(setFilterNegated(filters, id, negated)),
      onClear: () => onChange(clearFilter(filters, id)),
      emptyLabel,
    };
  };
  return [
    subject(
      "mergeStatus",
      <GitMerge />,
      MERGE_STATUSES.map((value) => ({
        value,
        label: t(`workspace:reviews.filter.merge.${value}`),
      })),
    ),
    subject("hasConflicts", <TriangleAlert />, [
      { value: "true", label: t("workspace:reviews.filter.yes") },
    ]),
    subject(
      "approvedBy",
      <UserCheck />,
      // Selected people stay listed so they can be unticked after the data changes.
      [
        ...new Set([
          ...approverLogins(items),
          ...(filters.approvedBy?.values ?? []),
        ]),
      ]
        .sort((a, b) => a.localeCompare(b))
        .map((login) => ({ value: login, label: login })),
      t("workspace:reviews.filter.noApprovers"),
    ),
  ];
}
