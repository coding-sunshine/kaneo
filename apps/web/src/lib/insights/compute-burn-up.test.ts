import { describe, expect, it } from "vite-plus/test";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { computeBurnUp } from "./compute-burn-up";

const task = (id: string, over: Partial<Task>) => ({ id, ...over }) as Task;
const project = (tasks: Task[]) =>
  ({ columns: [{ id: "c", tasks }] }) as unknown as ProjectWithTasks;

const tasks = [
  task("a", {
    createdAt: "2026-09-10T00:00:00Z",
    startedAt: "2026-09-20T00:00:00Z",
    completedAt: "2026-10-05T00:00:00Z",
  }),
  task("b", {
    createdAt: "2026-10-02T00:00:00Z",
    startedAt: "2026-10-03T00:00:00Z",
  }),
  task("c", { createdAt: "2026-11-15T00:00:00Z" }),
];
const now = Date.parse("2026-11-22T00:00:00Z");

describe("computeBurnUp", () => {
  it("accumulates per month from the first issue to now", () => {
    const buckets = computeBurnUp(project(tasks), "month", now);
    expect(buckets.map((b) => b.key)).toEqual([
      "2026-09-01",
      "2026-10-01",
      "2026-11-01",
    ]);
    expect(buckets.map((b) => [b.created, b.started, b.completed])).toEqual([
      [1, 1, 0],
      [2, 2, 1],
      [3, 2, 1],
    ]);
  });

  it("buckets by week starting Monday", () => {
    const buckets = computeBurnUp(project(tasks), "week", now);
    expect(buckets[0].key).toBe("2026-09-07");
    expect(buckets.at(-1)?.key).toBe("2026-11-16");
    expect(buckets.at(-1)?.created).toBe(3);
  });

  it("is empty without issues", () => {
    expect(computeBurnUp(project([]), "month", now)).toEqual([]);
  });
});
