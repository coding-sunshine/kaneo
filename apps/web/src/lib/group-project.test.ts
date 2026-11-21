import { describe, expect, it } from "vite-plus/test";
import { FLAT_GROUP_ID, groupProjectBy } from "./group-project";

const task = (id: string, labels: { id: string; name: string }[] = []) =>
  ({ id, labels }) as never;
const project = {
  columns: [
    {
      id: "todo",
      name: "Todo",
      isFinal: false,
      tasks: [
        task("a"),
        task("b", [{ id: "l1", name: "bug" }]),
        task("c", [{ id: "l2", name: "bug" }]),
      ],
    },
  ],
} as never;
const label = (key: string) => key;

describe("groupProjectBy", () => {
  it("none puts everything in one flat group", () => {
    const { columns } = groupProjectBy(project, "none", label);
    expect(columns.map((c) => c.id)).toEqual([FLAT_GROUP_ID]);
    expect(columns[0].tasks).toHaveLength(3);
  });

  it("label groups by label with unlabeled last", () => {
    const { columns } = groupProjectBy(project, "label", label);
    expect(columns.map((c) => c.name)).toEqual(["bug", "display.noLabel"]);
    expect(columns[0].tasks).toHaveLength(2);
    expect(columns[0].tasks).toHaveLength(2);
  });
});

const wpTask = (id: string, workProjectId?: string) => ({ id, workProjectId });
const wpBoard = {
  columns: [
    { id: "a", tasks: [wpTask("1", "p1"), wpTask("2")] },
    { id: "b", tasks: [wpTask("3", "p1"), wpTask("4", "p2")] },
  ],
} as never;

describe("groupProjectBy project", () => {
  it("buckets tasks by work project, no project last", () => {
    const grouped = groupProjectBy(
      wpBoard,
      "project",
      (key) => key,
      (id) => ({ p1: "Zeta", p2: "Alpha" })[id],
    );
    expect(
      grouped.columns.map((c) => [c.name, c.tasks.map((t) => t.id)]),
    ).toEqual([
      ["Alpha", ["4"]],
      ["Zeta", ["1", "3"]],
      ["display.noProject", ["2"]],
    ]);
  });
});
