import { describe, expect, it } from "vite-plus/test";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { withArchived } from "./with-archived";

const board = (archived: string[]) =>
  ({
    columns: [{ id: "todo", tasks: [{ id: "t1" } as Task] }],
    archivedTasks: archived.map((id) => ({ id }) as Task),
  }) as unknown as ProjectWithTasks;

describe("withArchived", () => {
  it("adds archived issues as an Archived column", () => {
    const shown = withArchived(board(["a1", "a2"]));
    expect(shown.columns.map((c) => c.id)).toEqual(["todo", "archived"]);
    expect(shown.columns[1].tasks.map((t) => t.id)).toEqual(["a1", "a2"]);
  });
  it("leaves a board without archived issues alone", () => {
    const plain = board([]);
    expect(withArchived(plain)).toBe(plain);
  });
});
