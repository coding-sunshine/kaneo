import { describe, expect, it } from "vite-plus/test";
import type { ProjectWithTasks } from "@/types/project";
import { completesTask } from "./completes-task";

const board = {
  columns: [
    { slug: "in-progress", isFinal: false, tasks: [{ id: "a" }] },
    { slug: "done", isFinal: true, tasks: [{ id: "b" }] },
  ],
} as unknown as ProjectWithTasks;

describe("completesTask", () => {
  it("is true when a task moves from an open column into a final one", () => {
    expect(completesTask(board, [{ id: "a", status: "done" }])).toBe(true);
  });

  it("is false for a reorder inside the final column", () => {
    expect(completesTask(board, [{ id: "b", status: "done" }])).toBe(false);
    expect(completesTask(board, [{ id: "b" }])).toBe(false);
  });

  it("is false when a task moves into an open column", () => {
    expect(completesTask(board, [{ id: "b", status: "in-progress" }])).toBe(
      false,
    );
  });
});
