import { describe, expect, it } from "vite-plus/test";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { mergeTeamIssues } from "./merge-team-issues";

const board = (id: string, columns: [string, string[]][]) =>
  ({
    id,
    slug: id.toUpperCase(),
    columns: columns.map(([slug, tasks]) => ({
      id: slug,
      name: slug,
      icon: "Circle",
      isFinal: false,
      tasks: tasks.map((task) => ({ id: task }) as Task),
    })),
  }) as unknown as ProjectWithTasks;

describe("mergeTeamIssues", () => {
  it("puts every team's issues for a status in one column, in workflow order", () => {
    const merged = mergeTeamIssues([
      board("eng", [
        ["todo", ["e1"]],
        ["done", ["e2"]],
      ]),
      board("con", [
        ["todo", ["c1"]],
        ["triage", ["c2"]],
      ]),
    ]);
    expect(
      merged?.columns.map((c) => [c.id, c.tasks.map((t) => t.id)]),
    ).toEqual([
      ["triage", ["c2"]],
      ["todo", ["e1", "c1"]],
      ["done", ["e2"]],
    ]);
  });

  it("keeps each issue's own team key", () => {
    const merged = mergeTeamIssues([
      board("eng", [["todo", ["e1"]]]),
      board("con", [["todo", ["c1"]]]),
    ]);
    expect(merged?.columns[0].tasks.map((t) => t.teamSlug)).toEqual([
      "ENG",
      "CON",
    ]);
  });

  it("has nothing to show before any team loads", () => {
    expect(mergeTeamIssues([])).toBeUndefined();
  });
});
