import { describe, expect, it } from "vite-plus/test";
import { groupProjectBy } from "@/lib/group-project";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { computeInsights, type GroupFn } from "./compute-insights";

const DAY = 86_400_000;
const now = Date.parse("2026-11-22T00:00:00.000Z");

const task = (id: string, over: Partial<Task>): Task =>
  ({
    id,
    title: id,
    priority: null,
    assigneeId: null,
    assigneeName: null,
    labels: [],
    createdAt: new Date(now - 2 * DAY).toISOString(),
    ...over,
  }) as Task;

const column = (id: string, name: string, tasks: Task[]) => ({
  id,
  name,
  icon: "Circle",
  isFinal: false,
  tasks,
});

const project = {
  columns: [
    column("todo", "Todo", [
      task("a", {
        priority: "high",
        createdAt: new Date(now - DAY).toISOString(),
      }),
      task("b", {
        priority: "low",
        labels: [
          { id: "l1", name: "Bug", color: "red" },
          { id: "l2", name: "UI", color: "blue" },
        ],
      }),
    ]),
    column("doing", "In Progress", [
      task("c", {
        priority: "high",
        createdAt: new Date(now - 5 * DAY).toISOString(),
      }),
    ]),
    column("done", "Done", []),
  ],
} as unknown as ProjectWithTasks;

const group: GroupFn = (p, by) => groupProjectBy(p, by, (key) => key);

describe("computeInsights", () => {
  it("counts issues per slice and drops empty slices", () => {
    const result = computeInsights(project, "status", "none", group, now);

    expect(result.slices.map((s) => [s.name, s.value])).toEqual([
      ["Todo", 2],
      ["In Progress", 1],
    ]);
    expect(result.issueCount).toBe(3);
    expect(result.maxValue).toBe(2);
  });

  it("splits each slice by segment", () => {
    const result = computeInsights(project, "status", "priority", group, now);

    expect(result.segments.map((s) => s.name)).toEqual([
      "priority.high",
      "priority.low",
    ]);
    expect(result.slices.map((s) => s.counts)).toEqual([
      [1, 1],
      [1, 0],
    ]);
  });

  it("counts a multi-label issue once per label slice", () => {
    const result = computeInsights(project, "label", "none", group, now);

    expect(result.slices.map((s) => [s.name, s.value])).toEqual([
      ["Bug", 1],
      ["UI", 1],
      ["display.noLabel", 2],
    ]);
  });

  it("measures issue age in days with a median per slice", () => {
    const result = computeInsights(project, "priority", "none", group, now);

    const high = result.slices.find((s) => s.name === "priority.high");
    expect(high?.points.map((p) => p.days)).toEqual([1, 5]);
    expect(high?.medianAge).toBe(3);
    expect(result.maxAge).toBe(5);
  });
});
