import { describe, expect, it } from "vite-plus/test";
import type { ProjectWithTasks } from "@/types/project";
import { mergeBoardsForWorkProject } from "./merge-boards";

const task = (id: string, workProjectId: string | null) =>
  ({ id, workProjectId }) as never;
const board = (id: string, columns: [string, unknown[]][]) =>
  ({
    id,
    slug: id.toUpperCase(),
    columns: columns.map(([name, tasks]) => ({
      id: `${id}-${name}`,
      name,
      tasks,
    })),
    archivedTasks: [],
    plannedTasks: [],
  }) as unknown as ProjectWithTasks;

describe("mergeBoardsForWorkProject", () => {
  it("keeps only the project's tasks and merges columns by name across teams", () => {
    const merged = mergeBoardsForWorkProject(
      [
        board("a", [
          ["Todo", [task("1", "p"), task("2", null)]],
          ["Done", []],
        ]),
        board("b", [
          ["Todo", [task("3", "p")]],
          ["Done", [task("4", "x")]],
        ]),
      ],
      "p",
    );
    expect(
      merged?.columns.map((c) => [c.name, c.tasks.map((t) => t.id)]),
    ).toEqual([["Todo", ["1", "3"]]]);
    expect(merged?.columns[0].tasks.map((t) => t.teamSlug)).toEqual(["A", "B"]);
    expect(merged?.columns[0].id.startsWith("group:")).toBe(true);
  });

  it("returns undefined without boards", () => {
    expect(mergeBoardsForWorkProject([], "p")).toBeUndefined();
  });
});
