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
    const result = computeInsights(
      project,
      "count",
      "status",
      "none",
      group,
      now,
    );

    expect(result.slices.map((s) => [s.name, s.value])).toEqual([
      ["Todo", 2],
      ["In Progress", 1],
    ]);
    expect(result.issueCount).toBe(3);
    expect(result.maxValue).toBe(2);
  });

  it("sums estimates for effort and leaves out zero-weight issues", () => {
    const points: Record<string, number> = { a: 3, b: 5 };
    const result = computeInsights(
      project,
      "effort",
      "status",
      "none",
      group,
      now,
      (t) => points[t.id] ?? 0,
    );

    expect(result.slices.map((s) => [s.name, s.value])).toEqual([["Todo", 8]]);
    expect(result.issueCount).toBe(2);
  });

  it("splits each slice by segment", () => {
    const result = computeInsights(
      project,
      "count",
      "status",
      "priority",
      group,
      now,
    );

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
    const result = computeInsights(
      project,
      "count",
      "label",
      "none",
      group,
      now,
    );

    expect(result.slices.map((s) => [s.name, s.value])).toEqual([
      ["Bug", 1],
      ["UI", 1],
      ["display.noLabel", 2],
    ]);
  });

  it("measures issue age in days with a median per slice", () => {
    const result = computeInsights(
      project,
      "age",
      "priority",
      "none",
      group,
      now,
    );

    const high = result.slices.find((s) => s.name === "priority.high");
    expect(high?.points.map((p) => p.days)).toEqual([1, 5]);
    expect(high?.medianDays).toBe(3);
    expect(result.maxDays).toBe(5);
  });

  it("plots only the issues each time measure applies to", () => {
    const iso = (daysAgo: number) =>
      new Date(now - daysAgo * DAY).toISOString();
    const timed = {
      columns: [
        column("done", "Done", [
          // Started, then done: every measure but triage.
          task("s", {
            createdAt: iso(10),
            startedAt: iso(6),
            completedAt: iso(2),
          }),
          // Done straight from Todo: lead time only, like Linear.
          task("d", { createdAt: iso(8), completedAt: iso(1) }),
          // Left triage after 6 hours.
          task("t", {
            createdAt: iso(4),
            startedTriageAt: iso(4),
            triagedAt: iso(4 - 0.25),
          }),
        ]),
      ],
    } as unknown as ProjectWithTasks;
    const days = (measure: Parameters<typeof computeInsights>[1]) =>
      computeInsights(
        timed,
        measure,
        "status",
        "none",
        group,
        now,
      ).slices.flatMap((s) => s.points.map((p) => [p.task.id, p.days]));

    expect(days("cycleTime")).toEqual([["s", 4]]);
    expect(days("leadTime")).toEqual([
      ["s", 8],
      ["d", 7],
    ]);
    expect(days("triageTime")).toEqual([["t", 0.25]]);
    expect(
      computeInsights(timed, "cycleTime", "status", "none", group, now)
        .issueCount,
    ).toBe(1);
  });

  it("marks the times 25, 50, 75 and 95% of plotted issues take", () => {
    const aged = {
      columns: [
        column(
          "todo",
          "Todo",
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((age) =>
            task(`t${age}`, {
              createdAt: new Date(now - age * DAY).toISOString(),
            }),
          ),
        ),
      ],
    } as unknown as ProjectWithTasks;

    expect(
      computeInsights(aged, "age", "status", "none", group, now).percentiles,
    ).toEqual([
      { percent: 25, days: 3 },
      { percent: 50, days: 5 },
      { percent: 75, days: 8 },
      { percent: 95, days: 10 },
    ]);
  });
});
