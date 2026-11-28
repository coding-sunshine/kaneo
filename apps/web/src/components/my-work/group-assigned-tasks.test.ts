import { describe, expect, it } from "vite-plus/test";
import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import { getDueBucket } from "./due-bucket";
import {
  groupAssignedTasksByActivity,
  groupAssignedTasksByDueDate,
  groupAssignedTasksByProject,
} from "./group-assigned-tasks";

const now = new Date(2026, 9, 2, 15, 0);

function task(
  id: string,
  dueDate: Date | null,
  projectId = "project-1",
): AssignedTask {
  return {
    id,
    projectId,
    number: 1,
    title: id,
    status: "to-do",
    statusName: "To Do",
    statusIcon: null,
    priority: "medium",
    dueDate: dueDate ? dueDate.toISOString() : null,
    position: null,
    inCycle: false,
    blockedBy: [],
    hasHiddenBlocker: false,
    projectName: projectId,
    projectSlug: "WEB",
    projectIcon: null,
    labels: [],
    lastActivityAt: null,
    lastActivityType: null,
    reviewRequestedAt: null,
    reviewSlaDueAt: null,
    workProjectId: null,
    workProjectMilestoneId: null,
  };
}

describe("getDueBucket", () => {
  it("uses calendar days rather than elapsed hours", () => {
    expect(getDueBucket(new Date(2026, 9, 2, 0, 5).toISOString(), now)).toBe(
      "today",
    );
    expect(getDueBucket(new Date(2026, 9, 1, 23, 55).toISOString(), now)).toBe(
      "overdue",
    );
    expect(getDueBucket(new Date(2026, 9, 3, 0, 5).toISOString(), now)).toBe(
      "thisWeek",
    );
  });

  it("separates the coming week from later work", () => {
    expect(getDueBucket(new Date(2026, 9, 9, 12).toISOString(), now)).toBe(
      "thisWeek",
    );
    expect(getDueBucket(new Date(2026, 9, 10, 12).toISOString(), now)).toBe(
      "later",
    );
    expect(getDueBucket(null, now)).toBe("noDueDate");
  });
});

describe("groupAssignedTasksByDueDate", () => {
  it("returns only the buckets in use, most urgent first", () => {
    const groups = groupAssignedTasksByDueDate(
      [
        task("undated", null),
        task("later", new Date(2026, 10, 1)),
        task("late", new Date(2026, 8, 30)),
        task("today", new Date(2026, 9, 2, 9)),
      ],
      now,
    );

    expect(groups.map((group) => group.bucket)).toEqual([
      "overdue",
      "today",
      "later",
      "noDueDate",
    ]);
    expect(groups[0].tasks.map((item) => item.id)).toEqual(["late"]);
  });
});

describe("groupAssignedTasksByProject", () => {
  it("keeps projects in the order their first task appears", () => {
    const groups = groupAssignedTasksByProject([
      task("a", null, "api"),
      task("b", null, "web"),
      task("c", null, "api"),
    ]);

    expect(groups.map((group) => group.id)).toEqual(["api", "web"]);
    expect(groups[0].tasks.map((item) => item.id)).toEqual(["a", "c"]);
  });
});

describe("groupAssignedTasksByActivity", () => {
  it("groups by days since last activity, newest first", () => {
    const at = (d: number) =>
      ({
        ...task(`t${d}`, null),
        lastActivityAt: new Date(2026, 9, 2 - d, 9, 0).toISOString(),
      }) as AssignedTask;
    const groups = groupAssignedTasksByActivity(
      [at(0), at(1), at(4), at(4)],
      now,
    );
    expect(groups.map((g) => [g.title, g.tasks.length])).toEqual([
      ["Today", 1],
      ["Yesterday", 1],
      ["4 days ago", 2],
    ]);
  });
});
