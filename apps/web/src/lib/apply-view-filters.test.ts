import { describe, expect, it } from "vite-plus/test";
import { applyViewFilters } from "./apply-view-filters";
import type { ProjectWithTasks } from "@/types/project";

const task = (id: string, priority: string) => ({ id, priority }) as never;
const project = {
  id: "p",
  columns: [{ id: "c", tasks: [task("a", "high"), task("b", "low")] }],
  plannedTasks: [],
  archivedTasks: [],
} as unknown as ProjectWithTasks;

describe("applyViewFilters", () => {
  it("keeps only tasks matching the saved filters", () => {
    const out = applyViewFilters(project, { priority: ["high"] });
    expect(out.columns[0].tasks.map((t) => t.id)).toEqual(["a"]);
  });
  it("keeps everything without filters", () => {
    expect(applyViewFilters(project, {}).columns[0].tasks).toHaveLength(2);
  });
});
