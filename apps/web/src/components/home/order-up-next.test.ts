import { describe, expect, it } from "vite-plus/test";
import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import { orderUpNext } from "./order-up-next";

const task = (id: string, overrides: Partial<AssignedTask> = {}) =>
  ({
    id,
    priority: "no-priority",
    dueDate: null,
    position: null,
    inCycle: false,
    blockedBy: [],
    hasHiddenBlocker: false,
    ...overrides,
  }) as AssignedTask;

const ids = (tasks: AssignedTask[]) => orderUpNext(tasks).map((r) => r.task.id);

describe("orderUpNext", () => {
  it("puts in-cycle work first, then priority, then blocked work last", () => {
    const ordered = orderUpNext([
      task("overdue-low", { priority: "low", dueDate: "2020-01-01T00:00:00Z" }),
      task("blocked-urgent", { priority: "urgent", blockedBy: ["web-6"] }),
      task("urgent", { priority: "urgent" }),
      task("cycle-low", { priority: "low", inCycle: true }),
    ]);
    expect(ordered.map((row) => row.task.id)).toEqual([
      "cycle-low",
      "urgent",
      "overdue-low",
      "blocked-urgent",
    ]);
    expect(ordered.map((row) => row.reason.kind)).toEqual([
      "cycle",
      "priority",
      "priority",
      "blocked",
    ]);
  });

  it("uses the due date only to break a priority tie, then manual position", () => {
    expect(
      ids([
        task("undated-pos-2", { priority: "high", position: 2 }),
        task("later", { priority: "high", dueDate: "2030-02-01T00:00:00Z" }),
        task("undated-pos-1", { priority: "high", position: 1 }),
        task("sooner", { priority: "high", dueDate: "2030-01-01T00:00:00Z" }),
      ]),
    ).toEqual(["sooner", "later", "undated-pos-1", "undated-pos-2"]);
  });

  it("gives every row a reason", () => {
    const reasons = orderUpNext([
      task("due", { dueDate: "2030-01-01T00:00:00Z" }),
      task("manual", { position: 3 }),
      task("hidden-blocker", { hasHiddenBlocker: true }),
    ]).map((row) => row.reason);
    expect(reasons).toEqual([
      { kind: "due" },
      { kind: "position" },
      { kind: "blocked", blockers: [], hidden: true },
    ]);
  });
});
