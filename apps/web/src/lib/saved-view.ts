import type { BoardFilters } from "@/hooks/use-task-filters";

export type SavedViewInput = {
  workspaceId: string;
  projectId: string | null;
  visibility?: "personal" | "shared";
  name: string;
  filters: Record<string, unknown>;
  display: Record<string, unknown>;
};

/**
 * Layout and grouping a view restores; filters live in `filters`. The
 * "it-queue" preset shows each request's age and SLA state.
 */
export type ViewDisplay = {
  layout?: "board" | "list";
  groupBy?: string;
  preset?: "it-queue";
};

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
  Object.entries(filters).filter(([key, value]) =>
    key === "matchAny"
      ? false
      : Array.isArray(value)
        ? value.length > 0
        : typeof value === "boolean"
          ? value
          : value !== null && value !== undefined,
  ).length;
