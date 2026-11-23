import { describe, expect, it } from "vite-plus/test";
import type { TaskDraft } from "@/fetchers/task-draft/task-drafts";
import { fromDraft, toDraftInput } from "./create-task-draft";

const form = {
  title: "T",
  description: "D",
  priority: "high",
  assigneeId: "u1",
  startDate: null,
  dueDate: "2026-12-01T00:00:00.000Z",
  labels: [{ name: "bug", color: "red" }],
  projectId: "p1",
  cycleId: "c1",
};

describe("create task draft mapping", () => {
  it("round-trips the form through a saved draft", () => {
    const input = toDraftInput(form);
    expect(input.projectId).toBe("p1");
    expect(input.properties).not.toHaveProperty("title");
    const record = { ...input, id: "d1" } as unknown as TaskDraft;
    expect(fromDraft(record)).toEqual(form);
  });

  it("stores no project as null and restores sparse properties", () => {
    expect(toDraftInput({ ...form, projectId: "" }).projectId).toBeNull();
    const sparse = {
      id: "d1",
      title: "x",
      description: "",
      projectId: null,
      properties: {},
    } as unknown as TaskDraft;
    expect(fromDraft(sparse)).toMatchObject({
      projectId: "",
      priority: "no-priority",
      labels: [],
      cycleId: null,
    });
  });
});
