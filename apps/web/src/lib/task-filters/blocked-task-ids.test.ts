import { describe, expect, it } from "vite-plus/test";
import { getBlockedTaskIds } from "./blocked-task-ids";

const projectWith = (
  columns: Array<{
    id: string;
    slug?: string;
    isFinal: boolean;
    tasks: Array<{ id: string }>;
  }>,
  extra?: {
    plannedTasks?: Array<{ id: string }>;
    archivedTasks?: Array<{ id: string }>;
  },
) => ({
  columns,
  plannedTasks: extra?.plannedTasks ?? [],
  archivedTasks: extra?.archivedTasks ?? [],
});

describe("getBlockedTaskIds", () => {
  it("marks B blocked when A blocks B and A is open, while leaving A unblocked", () => {
    const project = projectWith([
      {
        id: "to-do",
        slug: "to-do",
        isFinal: false,
        tasks: [{ id: "A" }, { id: "B" }],
      },
      { id: "done", slug: "done", isFinal: true, tasks: [] },
    ]);

    const blocked = getBlockedTaskIds(project, [
      { sourceTaskId: "A", targetTaskId: "B", relationType: "blocks" },
    ]);

    expect(blocked.has("B")).toBe(true);
    expect(blocked.has("A")).toBe(false);
  });

  it("unblocks B once A is closed in a final, canceled, or archived state", () => {
    const relations = [
      { sourceTaskId: "A", targetTaskId: "B", relationType: "blocks" },
    ];

    const doneProject = projectWith([
      { id: "to-do", slug: "to-do", isFinal: false, tasks: [{ id: "B" }] },
      { id: "done", slug: "done", isFinal: true, tasks: [{ id: "A" }] },
    ]);
    expect(getBlockedTaskIds(doneProject, relations).has("B")).toBe(false);

    const customFinalProject = projectWith([
      { id: "to-do", slug: "to-do", isFinal: false, tasks: [{ id: "B" }] },
      { id: "shipped", slug: "shipped", isFinal: true, tasks: [{ id: "A" }] },
    ]);
    expect(getBlockedTaskIds(customFinalProject, relations).has("B")).toBe(
      false,
    );

    const canceledProject = projectWith([
      { id: "to-do", slug: "to-do", isFinal: false, tasks: [{ id: "B" }] },
      {
        id: "canceled",
        slug: "canceled",
        isFinal: false,
        tasks: [{ id: "A" }],
      },
    ]);
    expect(getBlockedTaskIds(canceledProject, relations).has("B")).toBe(false);

    const archivedProject = projectWith(
      [{ id: "to-do", slug: "to-do", isFinal: false, tasks: [{ id: "B" }] }],
      { archivedTasks: [{ id: "A" }] },
    );
    expect(getBlockedTaskIds(archivedProject, relations).has("B")).toBe(false);
  });

  it("keeps B blocked until every blocking ticket is closed", () => {
    const project = projectWith([
      {
        id: "to-do",
        slug: "to-do",
        isFinal: false,
        tasks: [{ id: "B" }, { id: "C" }],
      },
      { id: "done", slug: "done", isFinal: true, tasks: [{ id: "A" }] },
    ]);
    const relations = [
      { sourceTaskId: "A", targetTaskId: "B", relationType: "blocks" },
      { sourceTaskId: "C", targetTaskId: "B", relationType: "blocks" },
    ];

    expect(getBlockedTaskIds(project, relations).has("B")).toBe(true);
  });

  it("treats a planned blocker as open", () => {
    const project = projectWith(
      [{ id: "to-do", slug: "to-do", isFinal: false, tasks: [{ id: "B" }] }],
      { plannedTasks: [{ id: "A" }] },
    );

    const blocked = getBlockedTaskIds(project, [
      { sourceTaskId: "A", targetTaskId: "B", relationType: "blocks" },
    ]);
    expect(blocked.has("B")).toBe(true);
  });

  it("ignores non-blocking relation types, missing blockers, and self-loops", () => {
    const project = projectWith([
      {
        id: "to-do",
        slug: "to-do",
        isFinal: false,
        tasks: [{ id: "A" }, { id: "B" }],
      },
    ]);

    const blocked = getBlockedTaskIds(project, [
      { sourceTaskId: "A", targetTaskId: "B", relationType: "related" },
      { sourceTaskId: "A", targetTaskId: "B", relationType: "subtask" },
      { sourceTaskId: "A", targetTaskId: "B", relationType: "duplicate" },
      { sourceTaskId: "missing", targetTaskId: "B", relationType: "blocks" },
      { sourceTaskId: "B", targetTaskId: "B", relationType: "blocks" },
    ]);

    expect(blocked.size).toBe(0);
  });
});
