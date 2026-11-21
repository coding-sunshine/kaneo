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
