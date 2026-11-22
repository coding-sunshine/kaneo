import { describe, expect, it } from "vite-plus/test";
import { getTaskLabelOptions } from "./get-task-label-options";

describe("getTaskLabelOptions", () => {
  it("excludes a pending workspace label and its remaining task copy", () => {
    const labels = [
      { id: "copy", name: "Bug", taskId: "task-1" },
      {
        id: "root",
        name: "Bug",
        taskId: null,
        deletionStartedAt: "2026-09-19T12:00:00Z",
      },
      { id: "other", name: "Ready", taskId: null },
    ];
    expect(
      getTaskLabelOptions(labels, "task-1").map((label) => label.id),
    ).toEqual(["other"]);
  });
  it("excludes labels assigned to other tasks", () => {
    const labels = [
      { id: "workspace", name: "Bug", taskId: null },
      { id: "current", name: "Imported", taskId: "task-1" },
      { id: "other", name: "Other", taskId: "task-2" },
    ];

    const options = getTaskLabelOptions(labels, "task-1");

    expect(options.map((label) => label.id)).toEqual(["workspace", "current"]);
  });

  it("prefers a workspace label over a task-scoped copy", () => {
    const labels = [
      { id: "task-copy", name: "Bug", taskId: "task-1" },
      { id: "workspace", name: "Bug", taskId: null },
    ];

    const options = getTaskLabelOptions(labels, "task-1");

    expect(options).toEqual([
      { id: "workspace", name: "Bug", taskId: null, displayName: "Bug" },
    ]);
  });

  it("shows team labels only for that team and hides group parents", () => {
    const labels = [
      { id: "g", name: "Priority", taskId: null },
      { id: "c", name: "High", taskId: null, parentLabelId: "g" },
      { id: "a", name: "A-only", taskId: null, projectId: "team-a" },
      { id: "b", name: "B-only", taskId: null, projectId: "team-b" },
    ];

    const options = getTaskLabelOptions(labels, "task-1", "team-a");

    expect(options.map((label) => label.displayName)).toEqual([
      "Priority / High",
      "A-only",
    ]);
  });
});
