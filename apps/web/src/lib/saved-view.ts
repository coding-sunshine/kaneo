import type { BoardFilters } from "@/hooks/use-task-filters";

export type SavedViewInput = {
  workspaceId: string;
  projectId: string | null;
  name: string;
  filters: Record<string, unknown>;
  display: Record<string, unknown>;
};

/** Layout and grouping a view restores; filters live in `filters`. */
export type ViewDisplay = { layout?: "board" | "list"; groupBy?: string };

export const boardFiltersKey = (projectId: string) =>
  `kaneo:board-filters:${projectId}`;

/** The filters last applied to a team's issues, read back from local storage. */
export function readBoardFilters(projectId: string): Partial<BoardFilters> {
  try {
    const raw = window.localStorage.getItem(boardFiltersKey(projectId));
    return raw ? (JSON.parse(raw) as Partial<BoardFilters>) : {};
  } catch {
    return {};
  }
}

export const countViewFilters = (filters: Partial<BoardFilters>) =>
  Object.values(filters).filter((value) =>
    Array.isArray(value)
      ? value.length > 0
      : value !== null && value !== undefined,
  ).length;
