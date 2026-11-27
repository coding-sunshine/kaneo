import type { BoardFilters } from "@/hooks/use-task-filters";

export function countActiveFilters(filters: BoardFilters) {
  const listCount = (
    [
      "status",
      "priority",
      "assignee",
      "dueDate",
      "startDate",
      "labels",
      "workProject",
      "cycle",
      "estimate",
    ] as const
  ).filter((key) => (filters[key]?.length ?? 0) > 0).length;
  const customFieldCount = Object.values(filters.customFields ?? {}).filter(
    (values) => values.length > 0,
  ).length;
  return listCount + customFieldCount + (filters.workable ? 1 : 0);
}
