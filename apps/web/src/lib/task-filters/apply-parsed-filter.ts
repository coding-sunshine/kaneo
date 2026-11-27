import type { BoardFilters } from "@/hooks/use-task-filters";
import { DEFAULT_FILTERS } from "@/hooks/use-task-filters-with-labels-support";

/** The filter the server read from a sentence; ids, as the board uses them. */
export type ParsedFilter = Partial<
  Pick<
    BoardFilters,
    "assignee" | "labels" | "status" | "priority" | "createdAt"
  >
> & { blocked?: boolean };

/** Replaces the board's filters with the parsed ones, as if picked by hand. */
export function applyParsedFilter(parsed: ParsedFilter): BoardFilters {
  return {
    ...DEFAULT_FILTERS,
    ...Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => value !== undefined),
    ),
  };
}
