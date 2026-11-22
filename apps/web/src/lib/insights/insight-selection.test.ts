import { describe, expect, it } from "vite-plus/test";
import type { ProjectWithTasks } from "@/types/project";
import type { Insights } from "./compute-insights";
import {
  narrowToIssues,
  selectedIssueIds,
  toggleSelection,
} from "./insight-selection";

const point = (id: string, segments: number[]) => ({
  task: { id },
  days: 1,
  segment: segments[0],
  segments,
});
const insights = {
  slices: [
    { key: "todo", points: [point("a", [0]), point("b", [0, 1])] },
    { key: "done", points: [point("c", [1])] },
  ],
} as unknown as Insights;

describe("selectedIssueIds", () => {
  it("is null without a selection", () => {
    expect(selectedIssueIds(insights, null)).toBeNull();
  });
  it("selects a slice", () => {
    expect([...(selectedIssueIds(insights, { slice: "todo" }) ?? [])]).toEqual([
      "a",
      "b",
    ]);
  });
  it("selects a segment across slices, counting multi-segment issues", () => {
    expect([...(selectedIssueIds(insights, { segment: 1 }) ?? [])]).toEqual([
      "b",
      "c",
    ]);
  });
  it("selects a cell", () => {
    expect([
      ...(selectedIssueIds(insights, { slice: "todo", segment: 1 }) ?? []),
    ]).toEqual(["b"]);
  });
});

describe("toggleSelection", () => {
  it("clears when the same target is chosen again", () => {
    expect(toggleSelection({ slice: "todo" }, { slice: "todo" })).toBeNull();
    expect(toggleSelection({ slice: "todo" }, { slice: "done" })).toEqual({
      slice: "done",
    });
    expect(toggleSelection(null, { segment: 0 })).toEqual({ segment: 0 });
  });
});

describe("narrowToIssues", () => {
  const project = {
    columns: [{ id: "x", tasks: [{ id: "a" }, { id: "b" }] }],
  } as unknown as ProjectWithTasks;
  it("keeps only the listed issues", () => {
    const narrowed = narrowToIssues(project, new Set(["b"]));
    expect(narrowed.columns[0].tasks.map((t) => t.id)).toEqual(["b"]);
  });
  it("returns the project itself for null", () => {
    expect(narrowToIssues(project, null)).toBe(project);
  });
});
