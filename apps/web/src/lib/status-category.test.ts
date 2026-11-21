import { describe, expect, it } from "vite-plus/test";
import {
  type CompletedIssues,
  filterCompletedIssues,
  hideSubIssues,
  scopeProjectToView,
  statusCategory,
  triageTasks,
} from "./status-category";

const col = (id: string, isFinal = false) => ({ id, isFinal, tasks: [{ id }] });
const project = {
  columns: ["triage", "backlog", "todo", "in-progress", "done", "canceled"].map(
    (id) => col(id, id === "done" || id === "canceled"),
  ),
} as never;
const ids = (p: { columns: { id: string }[] }) => p.columns.map((c) => c.id);

describe("status categories", () => {
  it("maps slugs and falls back on isFinal", () => {
    expect(statusCategory({ id: "in-review", isFinal: false })).toBe("started");
    expect(statusCategory({ id: "shipped", isFinal: true })).toBe("completed");
  });

  it("hides Triage from All issues, keeps the rest", () => {
    expect(ids(scopeProjectToView(project, "all"))).toEqual([
      "backlog",
      "todo",
      "in-progress",
      "done",
      "canceled",
    ]);
  });

  it("Active excludes Backlog, Triage and closed; Backlog shows only backlog", () => {
    expect(ids(scopeProjectToView(project, "active"))).toEqual([
      "todo",
      "in-progress",
    ]);
    expect(ids(scopeProjectToView(project, "backlog"))).toEqual(["backlog"]);
  });

  it("collects triage tasks", () => {
    expect(triageTasks(project)).toEqual([{ id: "triage" }]);
  });
});

describe("hideSubIssues", () => {
  it("drops subtask targets and counts them", () => {
    const project = {
      columns: [{ id: "todo", tasks: [{ id: "a" }, { id: "b" }, { id: "c" }] }],
    };
    const out = hideSubIssues(project, [
      { targetTaskId: "b", relationType: "subtask" },
      { targetTaskId: "c", relationType: "blocks" },
    ]);
    expect(out.hidden).toBe(1);
    expect(out.project.columns[0].tasks.map((t) => t.id)).toEqual(["a", "c"]);
  });
});

describe("filterCompletedIssues", () => {
  const now = Date.parse("2026-11-21T00:00:00Z");
  const day = 864e5;
  const project = {
    columns: [
      { id: "todo", isFinal: false, tasks: [{ updatedAt: "2020-01-01" }] },
      {
        id: "done",
        isFinal: true,
        tasks: [
          { updatedAt: new Date(now - 2 * day).toISOString() },
          { updatedAt: new Date(now - 20 * day).toISOString() },
          { updatedAt: new Date(now - 90 * day).toISOString() },
        ],
      },
    ],
  };
  const counts = (mode: CompletedIssues) =>
    filterCompletedIssues(project, mode, now).columns.map(
      (c) => c.tasks.length,
    );

  it("keeps everything for all, leaves open columns alone otherwise", () => {
    expect(counts("all")).toEqual([1, 3]);
    expect(counts("week")).toEqual([1, 1]);
    expect(counts("month")).toEqual([1, 2]);
    expect(counts("none")).toEqual([1, 0]);
  });
});
